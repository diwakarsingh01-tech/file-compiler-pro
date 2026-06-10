import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Download, X, Plus, Loader2, Trash2, Share2,
  FileText, Layers, RotateCcw, Lock, Unlock, FileImage,
  Stamp, PenTool, ShieldAlert, FileCheck,
  Combine, SplitSquareVertical, FileMinus, FileUp, Zap, CheckCircle2,
  Copy, Sun, Moon, AlertCircle, Image as ImageIcon
} from 'lucide-react';
import axios from 'axios';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const API_URL = window.location.origin;

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const Toast = ({ toasts, removeToast }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)}>
        {t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'error' ? <AlertCircle size={18} /> : null}
        {t.message}
      </div>
    ))}
  </div>
);

const CompactToolCard = ({ title, desc, icon: Icon, onClick, className = "" }) => (
  <div className={`compact-tool-card ${className}`} onClick={onClick}>
    <div className="tool-icon"><Icon size={20} /></div>
    <div className="tool-info">
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  </div>
);

function App() {
  const [currentTool, setCurrentTool] = useState('home');
  const [activeSegment, setActiveSegment] = useState('pdf');
  const [files, setFiles] = useState([]);
  const [compressionLevel, setCompressionLevel] = useState('recommended');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [password, setPassword] = useState('');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [signatureText, setSignatureName] = useState('');
  const [selectedPages, setSelectedPages] = useState([]);
  const [rotation, setRotation] = useState(0);

  const [modifications, setModifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [toasts, setToasts] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const onFileChange = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.size <= MAX_FILE_SIZE);
    if (selected.length !== e.target.files.length) addToast('Some files exceed 50MB limit', 'error');
    setFiles(prev => [...prev, ...selected]);
    setError(null);
    setResult(null);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length <= 1) setResult(null);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.size <= MAX_FILE_SIZE);
    setFiles(prev => [...prev, ...dropped]);
  };

  useEffect(() => {
    const needsViewer = ['pdf-edit', 'pdf-rotate', 'pdf-remove', 'pdf-extract', 'pdf-watermark', 'pdf-sign'].includes(currentTool);
    if (needsViewer && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          const loadingTask = pdfjs.getDocument(typedarray);
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setCurrentPage(1);
          renderPage(pdf, 1);
        } catch { addToast('Could not load PDF preview', 'error'); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setPdfDoc(null);
    }
  }, [currentTool, files]);

  const renderPage = async (pdf, pageNum) => {
    if (!pdf) return;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport: viewport }).promise;
    } catch { /* ignore render errors */ }
  };

  const handleCanvasClick = (e) => {
    if (currentTool !== 'pdf-edit') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const text = prompt("Enter text to add:");
    if (text) {
      setModifications([...modifications, { type: 'text', text, x, y: canvasRef.current.height - y, pageIndex: currentPage - 1 }]);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('level', compressionLevel);
    formData.append('password', password);
    formData.append('watermark', watermarkText);
    formData.append('signature', signatureText);
    formData.append('indices', JSON.stringify(selectedPages));
    formData.append('degree', rotation);
    formData.append('modifications', JSON.stringify(modifications));

    let endpoint = '/api/upload';
    if (currentTool.startsWith('pdf-')) endpoint = `/api/pdf/${currentTool.split('-')[1]}`;
    if (currentTool.includes('to-pdf')) endpoint = `/api/pdf/convert-to`;
    if (currentTool.includes('pdf-to')) endpoint = `/api/pdf/convert-from`;

    try {
      const response = await axios.post(`${API_URL}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      addToast('File processed successfully!', 'success');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to process files.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFiles([]); setResult(null); setError(null); setModifications([]);
    setRotation(0); setPdfDoc(null); setPassword(''); setSignatureName('');
    setSelectedPages([]); setCurrentTool('home'); setCurrentPage(1);
  };

  const copyDownloadLink = () => {
    if (result?.downloadUrl) {
      navigator.clipboard.writeText(`${API_URL}${result.downloadUrl}`);
      setCopied(true);
      addToast('Link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getAccept = () => {
    if (currentTool === 'pdf-images') return '.png,.jpg,.jpeg,.webp';
    if (currentTool.includes('to-pdf') || currentTool === 'excel-merge') return '.xlsx,.csv';
    if (currentTool.startsWith('pdf-') || currentTool === 'pdf-to-excel') return '.pdf';
    return activeSegment === 'pdf' ? '.pdf' : '.xlsx,.csv';
  };

  const renderDashboard = () => (
    <div className="dashboard-container">
      <div className="segment-tabs">
        <div className={`segment-tab ${activeSegment === 'pdf' ? 'active' : ''}`} onClick={() => setActiveSegment('pdf')}>
          <Layers size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> PDF Suite
        </div>
        <div className={`segment-tab excel ${activeSegment === 'excel' ? 'active' : ''}`} onClick={() => setActiveSegment('excel')}>
          <FileSpreadsheet size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Excel Suite
        </div>
      </div>

      {activeSegment === 'pdf' ? (
        <div className="category-container">
          <div className="category-box">
            <div className="category-title"><Layers size={14} /> Organize</div>
            <div className="compact-grid">
              <CompactToolCard title="Merge PDF" desc="Combine multiple PDFs" icon={Combine} onClick={() => setCurrentTool('pdf-merge')} />
              <CompactToolCard title="Split PDF" desc="Extract pages from PDF" icon={SplitSquareVertical} onClick={() => setCurrentTool('pdf-split')} />
              <CompactToolCard title="Remove Pages" desc="Delete specific pages" icon={FileMinus} onClick={() => setCurrentTool('pdf-remove')} />
              <CompactToolCard title="Extract Pages" desc="Save specific pages" icon={FileUp} onClick={() => setCurrentTool('pdf-extract')} />
            </div>
          </div>
          <div className="category-box">
            <div className="category-title"><Zap size={14} /> Optimize & Edit</div>
            <div className="compact-grid">
              <CompactToolCard title="Compress PDF" desc="Reduce file size" icon={Zap} onClick={() => setCurrentTool('pdf-compress')} />
              <CompactToolCard title="Edit PDF" desc="Add text and images" icon={PenTool} onClick={() => setCurrentTool('pdf-edit')} />
              <CompactToolCard title="Rotate PDF" desc="Rotate PDF pages" icon={RotateCcw} onClick={() => setCurrentTool('pdf-rotate')} />
              <CompactToolCard title="Watermark" desc="Add text stamp" icon={Stamp} onClick={() => setCurrentTool('pdf-watermark')} />
            </div>
          </div>
          <div className="category-box">
            <div className="category-title"><Lock size={14} /> Security & Convert</div>
            <div className="compact-grid">
              <CompactToolCard title="Protect PDF" desc="Add password" icon={Lock} onClick={() => setCurrentTool('pdf-protect')} />
              <CompactToolCard title="Unlock PDF" desc="Remove password" icon={Unlock} onClick={() => setCurrentTool('pdf-unlock')} />
              <CompactToolCard title="Sign PDF" desc="Sign documents" icon={FileCheck} onClick={() => setCurrentTool('pdf-sign')} />
              <CompactToolCard title="Image to PDF" desc="Convert images to PDF" icon={ImageIcon} onClick={() => setCurrentTool('pdf-images')} />
            </div>
          </div>
        </div>
      ) : (
        <div className="category-container">
          <div className="category-box">
            <div className="category-title"><FileSpreadsheet size={14} /> Data Tools</div>
            <div className="compact-grid">
              <CompactToolCard className="excel" title="Merge Excel" desc="Combine XLSX/CSV files" icon={Combine} onClick={() => setCurrentTool('excel-merge')} />
              <CompactToolCard className="excel" title="Excel to PDF" desc="Convert to PDF" icon={FileText} onClick={() => setCurrentTool('excel-to-pdf')} />
              <CompactToolCard className="excel" title="PDF to Excel" desc="Extract data to XLSX" icon={FileSpreadsheet} onClick={() => setCurrentTool('pdf-to-excel')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFileCard = (file, idx) => (
    <div key={idx} className={`file-card ${activeSegment === 'excel' ? 'excel' : ''} ${currentTool === 'pdf-images' ? 'image' : ''}`}>
      <div className="remove-btn" onClick={() => removeFile(idx)}><X size={14} /></div>
      <div className="file-icon">
        {currentTool === 'pdf-images' ? <ImageIcon size={36} /> :
         activeSegment === 'excel' ? <FileSpreadsheet size={36} /> : <FileText size={36} />}
      </div>
      <div className="file-name" title={file.name}>{file.name}</div>
      <div className="file-size">{formatSize(file.size)}</div>
    </div>
  );

  const renderToolbar = () => (
    <div className="toolbar">
      <h2>{currentTool.replace(/-/g, ' ')}</h2>
      <button className="btn" onClick={reset}>Cancel</button>
    </div>
  );

  const renderSidebar = () => (
    <aside className="sidebar">
      <h2>Options</h2>

      {currentTool === 'pdf-protect' && (
        <div className="input-group">
          <label>Set Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter strong password" />
        </div>
      )}

      {currentTool === 'pdf-unlock' && (
        <div className="input-group">
          <label>PDF Password</label>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter existing password" />
        </div>
      )}

      {currentTool === 'pdf-watermark' && (
        <div className="input-group">
          <label>Watermark Text</label>
          <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
        </div>
      )}

      {currentTool === 'pdf-sign' && (
        <div className="input-group">
          <label>Signature Text</label>
          <input type="text" value={signatureText} onChange={(e) => setSignatureName(e.target.value)} placeholder="Type your name" />
        </div>
      )}

      {currentTool === 'pdf-rotate' && (
        <button className="btn" style={{ width: '100%', marginBottom: '1rem' }} onClick={() => setRotation((rotation + 90) % 360)}>
          Rotate Right 90°
        </button>
      )}

      {currentTool === 'excel-merge' && (
        <div className="input-group">
          <label>Compression</label>
          <select value={compressionLevel} onChange={(e) => setCompressionLevel(e.target.value)}>
            <option value="low">Low</option>
            <option value="recommended">Recommended</option>
            <option value="extreme">Extreme (dedup)</option>
          </select>
        </div>
      )}

      <button className="action-btn" onClick={handleProcess} disabled={isProcessing || files.length === 0}>
        {isProcessing ? 'Processing...' : 'Proceed'}
      </button>

      {isProcessing && <div className="progress-bar"><div className="progress-bar-fill" /></div>}
      {error && <div className="error-msg">{error}</div>}
    </aside>
  );

  return (
    <div className="app-wrapper">
      <Toast toasts={toasts} removeToast={removeToast} />

      <header className="premium-header">
        <div className="logo" onClick={reset}>
          <FileSpreadsheet size={22} /> <span>DocuMax</span>
        </div>
        <div className="header-right">
          {currentTool !== 'home' && files.length > 0 && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-light)', padding: '2px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
              {files.length} file{files.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="creator-badge">by <strong>Diwakar Singh</strong></span>
          <nav className="main-nav">
            <div className={`nav-link ${currentTool === 'home' ? 'active' : ''}`} onClick={reset}>Home</div>
            <div className={`nav-link ${activeSegment === 'pdf' && currentTool === 'home' ? 'active' : ''}`}
              onClick={() => { reset(); setActiveSegment('pdf'); }}>PDF</div>
            <div className={`nav-link ${activeSegment === 'excel' && currentTool === 'home' ? 'active' : ''}`}
              onClick={() => { reset(); setActiveSegment('excel'); }}>Excel</div>
          </nav>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle theme">
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </header>

      <main style={{ flex: 1, background: 'var(--bg-light)', overflowY: 'auto' }}>
        {currentTool === 'home' ? (
          <div className="hero">
            <h1>DocuMax Pro</h1>
            <p>PDF, Image & Excel tools — one tap away</p>
            {renderDashboard()}
            <div className="site-footer">
              &copy; 2026 <strong>DocuMax Pro Suite</strong> by <strong>Diwakar Singh</strong>
            </div>
          </div>
        ) : result ? (
          <div className="workspace" style={{ justifyContent: 'center' }}>
            <div className="main-content success-view">
              <CheckCircle2 size={56} color="#198754" />
              <h2>Done! File ready.</h2>
              <a href={`${API_URL}${result.downloadUrl}`} className="download-link" download>
                <Download size={20} /> Download
              </a>
              <button className="copy-link-btn" onClick={copyDownloadLink}>
                <Copy size={16} /> {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button className="btn" onClick={reset}>Back Home</button>
            </div>
          </div>
        ) : (
          <div className="workspace">
            <div className="main-content">
              {renderToolbar()}

              {files.length === 0 ? (
                <div
                  className={`select-area ${dragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    accept={getAccept()}
                    onChange={onFileChange}
                  />
                  <div className="select-btn">
                    <Upload size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    Choose Files
                  </div>
                  <div className="select-hint">or tap to browse</div>
                  <div className="select-hint" style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}>
                    Max 50MB &bull; Private & secure
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  {['pdf-edit', 'pdf-rotate', 'pdf-remove', 'pdf-extract', 'pdf-watermark', 'pdf-sign'].includes(currentTool) && (
                    <div className="pdf-controls">
                      <button className="btn" onClick={() => { if (currentPage > 1) { const p = currentPage - 1; setCurrentPage(p); renderPage(pdfDoc, p); }}} disabled={currentPage <= 1}>
                        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>‹</span>
                      </button>
                      <span>{currentPage}/{pdfDoc?.numPages || '?'}</span>
                      <button className="btn" onClick={() => { if (currentPage < pdfDoc?.numPages) { const p = currentPage + 1; setCurrentPage(p); renderPage(pdfDoc, p); }}} disabled={currentPage >= (pdfDoc?.numPages || 0)}>
                        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>›</span>
                      </button>

                      {(currentTool === 'pdf-remove' || currentTool === 'pdf-extract') && (
                        <label>
                          <input type="checkbox" checked={selectedPages.includes(currentPage - 1)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedPages([...selectedPages, currentPage - 1]);
                              else setSelectedPages(selectedPages.filter(p => p !== currentPage - 1));
                            }} />
                          <strong>Sel</strong>
                        </label>
                      )}
                    </div>
                  )}

                  <div className="file-grid">
                    {files.map((file, idx) => renderFileCard(file, idx))}
                    <div className="file-card add-more-card" onClick={() => fileInputRef.current?.click()}>
                      <input type="file" multiple hidden accept={getAccept()} onChange={onFileChange} />
                      <Plus size={28} />
                      <div style={{ fontSize: '0.6rem', marginTop: '0.3rem' }}>Add</div>
                    </div>
                  </div>

                  {['pdf-edit', 'pdf-rotate', 'pdf-remove', 'pdf-extract', 'pdf-watermark', 'pdf-sign'].includes(currentTool) && (
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', maxWidth: '100%', width: '100%' }}>
                      <div style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s', width: '100%' }}>
                        <canvas ref={canvasRef} onClick={handleCanvasClick}
                          style={{ cursor: currentTool === 'pdf-edit' ? 'crosshair' : 'default', display: pdfDoc ? 'block' : 'none', width: '100%', height: 'auto', maxHeight: '60vh' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {files.length > 0 && renderSidebar()}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
