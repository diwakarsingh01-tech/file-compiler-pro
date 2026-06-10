import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Download, X, Plus, Loader2, Trash2, Share2, Type, MousePointer2,
  FileText, Layers, Scissors, RotateCcw, Lock, Unlock, FileImage, FileDigit, Globe, 
  Hash, Stamp, ScissorsSquare, PenTool, ShieldAlert, FileSearch, FileCheck, FileCode,
  Combine, SplitSquareVertical, FileMinus, FileUp, Scan, Settings, LayoutGrid, FileType, Zap, CheckCircle2
} from 'lucide-react';
import axios from 'axios';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const API_URL = window.location.origin;

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
  
  // Dynamic Tool Inputs
  const [password, setPassword] = useState('');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [signatureText, setSignatureName] = useState('');
  const [selectedPages, setSelectedPages] = useState([]);
  const [rotation, setRotation] = useState(0);

  // Editor/Viewer State
  const [modifications, setModifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const canvasRef = useRef(null);

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    setError(null);
    setResult(null);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) setResult(null);
  };

  useEffect(() => {
    const needsViewer = ['pdf-edit', 'pdf-rotate', 'pdf-remove', 'pdf-extract', 'pdf-watermark', 'pdf-numbers', 'pdf-sign'].includes(currentTool);
    if (needsViewer && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const typedarray = new Uint8Array(e.target.result);
        const loadingTask = pdfjs.getDocument(typedarray);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        renderPage(pdf, 1);
      };
      reader.readAsArrayBuffer(file);
    }
  }, [currentTool, files]);

  const renderPage = async (pdf, pageNum) => {
    if (!pdf) return;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
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
    
    // Add specific tool parameters
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
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process files.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFiles([]); setResult(null); setError(null); setModifications([]); setRotation(0);
    setPdfDoc(null); setPassword(''); setSignatureName(''); setSelectedPages([]);
    setCurrentTool('home');
  };

  const renderDashboard = () => (
    <div className="dashboard-container">
      <div className="segment-tabs">
        <div className={`segment-tab ${activeSegment === 'pdf' ? 'active' : ''}`} onClick={() => setActiveSegment('pdf')}>PDF Suite</div>
        <div className={`segment-tab excel ${activeSegment === 'excel' ? 'active' : ''}`} onClick={() => setActiveSegment('excel')}>Excel Suite</div>
      </div>

      {activeSegment === 'pdf' ? (
        <div className="category-container">
          <div className="category-box">
            <div className="category-title"><Layers size={16} /> Organize</div>
            <div className="compact-grid">
              <CompactToolCard title="Merge PDF" desc="Combine multiple PDFs." icon={Combine} onClick={() => setCurrentTool('pdf-merge')} />
              <CompactToolCard title="Split PDF" desc="Extract pages from PDF." icon={SplitSquareVertical} onClick={() => setCurrentTool('pdf-split')} />
              <CompactToolCard title="Remove pages" desc="Delete specific pages." icon={FileMinus} onClick={() => setCurrentTool('pdf-remove')} />
              <CompactToolCard title="Extract pages" desc="Save specific pages." icon={FileUp} onClick={() => setCurrentTool('pdf-extract')} />
            </div>
          </div>
          <div className="category-box">
            <div className="category-title"><Zap size={16} /> Optimize & Edit</div>
            <div className="compact-grid">
              <CompactToolCard title="Compress PDF" desc="Reduce file size." icon={Zap} onClick={() => setCurrentTool('pdf-compress')} />
              <CompactToolCard title="Edit PDF" desc="Add text and images." icon={PenTool} onClick={() => setCurrentTool('pdf-edit')} />
              <CompactToolCard title="Rotate PDF" desc="Rotate PDF pages." icon={RotateCcw} onClick={() => setCurrentTool('pdf-rotate')} />
              <CompactToolCard title="Watermark" desc="Add text/image stamp." icon={Stamp} onClick={() => setCurrentTool('pdf-watermark')} />
            </div>
          </div>
          <div className="category-box">
            <div className="category-title"><Lock size={16} /> Security</div>
            <div className="compact-grid">
              <CompactToolCard title="Protect PDF" desc="Add password security." icon={Lock} onClick={() => setCurrentTool('pdf-protect')} />
              <CompactToolCard title="Unlock PDF" desc="Remove password." icon={Unlock} onClick={() => setCurrentTool('pdf-unlock')} />
              <CompactToolCard title="Sign PDF" desc="Sign your documents." icon={FileCheck} onClick={() => setCurrentTool('pdf-sign')} />
            </div>
          </div>
        </div>
      ) : (
        <div className="category-container">
          <div className="category-box">
            <div className="category-title"><FileSpreadsheet size={16} /> Data Tools</div>
            <div className="compact-grid">
              <CompactToolCard className="excel" title="Merge Excel" desc="Combine multiple XLSX/CSV." icon={Combine} onClick={() => setCurrentTool('excel-merge')} />
              <CompactToolCard className="excel" title="Excel to PDF" desc="Convert spreadsheets to PDF." icon={FileText} onClick={() => setCurrentTool('excel-to-pdf')} />
              <CompactToolCard className="excel" title="PDF to Excel" desc="Extract tables to XLSX." icon={FileSpreadsheet} onClick={() => setCurrentTool('pdf-to-excel')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-wrapper">
      <header className="premium-header">
        <div className="logo" onClick={reset} style={{cursor: 'pointer'}}><FileSpreadsheet size={24} /> DocuMax Pro</div>
        <div style={{fontSize: '0.8rem', color: '#999', fontWeight: '500', marginLeft: '1rem', flex: 1}}>Created by <span style={{color: '#666', fontWeight: '700'}}>Diwakar Singh</span></div>
        <nav className="main-nav">
          <div className={`nav-link ${currentTool === 'home' ? 'active' : ''}`} onClick={reset}>Home</div>
          <div className={`nav-link ${activeSegment === 'pdf' && currentTool === 'home' ? 'active' : ''}`} onClick={() => {reset(); setActiveSegment('pdf');}}>PDF Tools</div>
          <div className={`nav-link ${activeSegment === 'excel' && currentTool === 'home' ? 'active' : ''}`} onClick={() => {reset(); setActiveSegment('excel');}}>Excel Tools</div>
        </nav>
      </header>

      <main style={{flex: 1, background: 'var(--bg-light)', overflowY: 'auto'}}>
        {currentTool === 'home' ? (
          <div className="hero">
            <h1>Unified File Management</h1>
            <p>Professional PDF and Excel tools in one place.</p>
            {renderDashboard()}
            <footer style={{marginTop: '4rem', padding: '3rem 2rem', color: '#999', fontSize: '0.85rem', borderTop: '1px solid #eee', background: 'white'}}>
              <div style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>&copy; 2026 <strong>DocuMax Pro Suite</strong>. All rights reserved.</div>
                <div>Designed & Engineered by <span style={{color: '#555', fontWeight: '800'}}>Diwakar Singh</span></div>
              </div>
            </footer>
          </div>
        ) : result ? (
          <div className="workspace" style={{justifyContent: 'center'}}>
            <div className="main-content success-view" style={{maxWidth: '800px', alignItems: 'center', textAlign: 'center'}}>
              <CheckCircle2 size={64} color="#198754" style={{marginBottom: '1rem'}} />
              <h2>Success! Your file is ready.</h2>
              <a href={`${API_URL}${result.downloadUrl}`} className="download-link" style={{margin: '2rem 0'}}>Download Now <Download /></a>
              <button className="btn" onClick={reset}>Back to Home</button>
            </div>
          </div>
        ) : (
          <div className="workspace">
            <div className="main-content">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
                <h2 style={{margin: 0, fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase'}}>{currentTool.replace(/-/g, ' ')}</h2>
                <button className="btn" onClick={reset}>Cancel</button>
              </div>

              {files.length === 0 ? (
                <div className="hero" style={{padding: '4rem 0'}}>
                  <div className="select-btn" onClick={() => document.getElementById('fileInput').click()}>Select File</div>
                  <input id="fileInput" type="file" multiple hidden accept={activeSegment === 'pdf' ? '.pdf' : '.xlsx,.csv'} onChange={onFileChange} />
                  <p style={{marginTop: '1.5rem', color: '#888'}}>Private & Secure processing</p>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem'}}>
                   {['pdf-edit', 'pdf-rotate', 'pdf-remove', 'pdf-extract', 'pdf-watermark', 'pdf-sign'].includes(currentTool) && (
                      <div style={{background: 'white', padding: '0.75rem 1.5rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', gap: '15px', alignItems: 'center', border: '1px solid #f0f0f0'}}>
                        <button className="btn" onClick={() => { if(currentPage > 1) { setCurrentPage(currentPage-1); renderPage(pdfDoc, currentPage-1); }}}>Prev</button>
                        <span style={{fontWeight: '700'}}>Page {currentPage} of {pdfDoc?.numPages || '?'}</span>
                        <button className="btn" onClick={() => { if(currentPage < pdfDoc?.numPages) { setCurrentPage(currentPage+1); renderPage(pdfDoc, currentPage+1); }}}>Next</button>
                        
                        {currentTool === 'pdf-remove' || currentTool === 'pdf-extract' ? (
                          <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginLeft: '10px'}}>
                            <input type="checkbox" checked={selectedPages.includes(currentPage-1)} onChange={(e) => {
                              if(e.target.checked) setSelectedPages([...selectedPages, currentPage-1]);
                              else setSelectedPages(selectedPages.filter(p => p !== currentPage-1));
                            }} /> <strong>Select Page</strong>
                          </label>
                        ) : null}
                      </div>
                   )}
                   
                   <div style={{position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s', borderRadius: '4px', overflow: 'hidden'}}>
                      <canvas ref={canvasRef} onClick={handleCanvasClick} style={{cursor: currentTool === 'pdf-edit' ? 'crosshair' : 'default', display: pdfDoc ? 'block' : 'none'}}></canvas>
                      {!pdfDoc && (
                        <div className="file-grid">
                          {files.map((file, idx) => (
                            <div key={idx} className={`file-card ${activeSegment === 'excel' ? 'excel' : ''}`}>
                              <div className="remove-btn" onClick={() => removeFile(idx)}><X size={16} /></div>
                              <div className="icon-container">{activeSegment === 'pdf' ? <Upload size={72} /> : <FileSpreadsheet size={72} />}</div>
                              <div className="file-name">{file.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {currentTool === 'pdf-edit' && modifications.filter(m => m.pageIndex === currentPage - 1).map((m, i) => (
                        <div key={i} style={{ position: 'absolute', left: m.x, top: (canvasRef.current?.height || 0) - m.y, background: 'rgba(255,255,0,0.4)', padding: '2px 4px', fontWeight: '600' }}>{m.text}</div>
                      ))}
                   </div>
                </div>
              )}
            </div>

            {files.length > 0 && (
              <aside className="sidebar">
                <h2>Options</h2>
                
                {currentTool === 'pdf-protect' && (
                  <div className="input-group" style={{marginBottom: '1.5rem'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '0.8rem'}}>SET PASSWORD</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter strong password" style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '2px solid #eee'}} />
                  </div>
                )}

                {currentTool === 'pdf-unlock' && (
                  <div className="input-group" style={{marginBottom: '1.5rem'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '0.8rem'}}>PDF PASSWORD</label>
                    <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter existing password" style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '2px solid #eee'}} />
                  </div>
                )}

                {currentTool === 'pdf-watermark' && (
                  <div className="input-group" style={{marginBottom: '1.5rem'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '0.8rem'}}>WATERMARK TEXT</label>
                    <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '2px solid #eee'}} />
                  </div>
                )}

                {currentTool === 'pdf-sign' && (
                  <div className="input-group" style={{marginBottom: '1.5rem'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '0.8rem'}}>SIGNATURE TEXT</label>
                    <input type="text" value={signatureText} onChange={(e) => setSignatureName(e.target.value)} placeholder="Type your name" style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '2px solid #eee'}} />
                  </div>
                )}

                {currentTool === 'pdf-rotate' && (
                  <button className="btn" style={{width: '100%', marginBottom: '1rem'}} onClick={() => setRotation((rotation + 90) % 360)}>Rotate Right (90°)</button>
                )}

                {currentTool === 'excel-merge' && (
                   <select style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '2px solid #eee', marginBottom: '1.5rem'}} value={compressionLevel} onChange={(e) => setCompressionLevel(e.target.value)}>
                      <option value="low">Low Compression</option>
                      <option value="recommended">Recommended</option>
                      <option value="extreme">Extreme</option>
                   </select>
                )}

                <button className="action-btn" onClick={handleProcess} disabled={isProcessing}>{isProcessing ? 'PROCESSING...' : 'PROCEED'}</button>
                {error && <div className="error-msg" style={{marginTop: '1rem'}}>{error}</div>}
              </aside>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
