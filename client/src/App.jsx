import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Download, X, Plus, Loader2, Trash2, Share2, Type, MousePointer2,
  FileText, Layers, Scissors, RotateCcw, Lock, Unlock, FileImage, FileDigit, Globe, 
  Hash, Stamp, ScissorsSquare, PenTool, ShieldAlert, FileSearch, FileCheck, FileCode,
  Combine, SplitSquareVertical, FileMinus, FileUp, Scan, Settings, LayoutGrid, FileType, Zap
} from 'lucide-react';
import axios from 'axios';
import * as pdfjs from 'pdfjs-dist';

// Set up pdf.js worker
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
  const [activeSegment, setActiveSegment] = useState('pdf'); // pdf or excel
  const [files, setFiles] = useState([]);
  const [compressionLevel, setCompressionLevel] = useState('recommended');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Advanced Tool States
  const [modifications, setModifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const canvasRef = useRef(null);

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    setError(null);
  };

  // Load PDF for Editor/Viewer
  useEffect(() => {
    const needsViewer = ['pdf-edit', 'pdf-rotate', 'pdf-remove'].includes(currentTool);
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

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    await page.render(renderContext).promise;
  };

  const handleCanvasClick = (e) => {
    if (currentTool !== 'pdf-edit') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const text = prompt("Enter text to add:");
    if (text) {
      setModifications([...modifications, {
        type: 'text',
        text,
        x: x,
        y: (canvasRef.current.height - y),
        pageIndex: currentPage - 1
      }]);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('level', compressionLevel);
    
    let endpoint = '/api/upload';
    if (currentTool === 'pdf-merge') endpoint = '/api/pdf/merge';
    if (currentTool === 'pdf-split') endpoint = '/api/pdf/split';
    if (currentTool === 'pdf-rotate') {
      endpoint = '/api/pdf/rotate';
      formData.append('degree', rotation);
    }
    if (currentTool === 'pdf-edit') {
      endpoint = '/api/pdf/edit';
      formData.append('modifications', JSON.stringify(modifications));
    }

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
    setFiles([]);
    setResult(null);
    setError(null);
    setModifications([]);
    setRotation(0);
    setPdfDoc(null);
    setCurrentTool('home');
  };

  const renderDashboard = () => (
    <div className="dashboard-container">
      <div className="segment-tabs">
        <div 
          className={`segment-tab ${activeSegment === 'pdf' ? 'active' : ''}`}
          onClick={() => setActiveSegment('pdf')}
        >
          PDF Suite
        </div>
        <div 
          className={`segment-tab excel ${activeSegment === 'excel' ? 'active' : ''}`}
          onClick={() => setActiveSegment('excel')}
        >
          Excel Suite
        </div>
      </div>

      {activeSegment === 'pdf' ? (
        <div className="category-container">
          <div className="category-box">
            <div className="category-title"><Layers size={16} /> Organize</div>
            <div className="compact-grid">
              <CompactToolCard title="Merge PDF" desc="Combine multiple PDFs." icon={Combine} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-merge'); }} />
              <CompactToolCard title="Split PDF" desc="Extract pages from PDF." icon={SplitSquareVertical} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-split'); }} />
              <CompactToolCard title="Remove pages" desc="Delete specific pages." icon={FileMinus} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-remove'); }} />
              <CompactToolCard title="Extract pages" desc="Save specific pages." icon={FileUp} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-extract'); }} />
            </div>
          </div>

          <div className="category-box">
            <div className="category-title"><Zap size={16} /> Optimize & Edit</div>
            <div className="compact-grid">
              <CompactToolCard title="Compress PDF" desc="Reduce file size." icon={Zap} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-compress'); }} />
              <CompactToolCard title="Edit PDF" desc="Add text and images." icon={PenTool} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-edit'); }} />
              <CompactToolCard title="Rotate PDF" desc="Rotate PDF pages." icon={RotateCcw} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-rotate'); }} />
              <CompactToolCard title="Watermark" desc="Add text/image stamp." icon={Stamp} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-watermark'); }} />
            </div>
          </div>

          <div className="category-box">
            <div className="category-title"><Lock size={16} /> Security</div>
            <div className="compact-grid">
              <CompactToolCard title="Protect PDF" desc="Add password security." icon={Lock} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-protect'); }} />
              <CompactToolCard title="Unlock PDF" desc="Remove password." icon={Unlock} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-unlock'); }} />
              <CompactToolCard title="Sign PDF" desc="Sign your documents." icon={FileCheck} onClick={() => { setActiveSegment('pdf'); setCurrentTool('pdf-sign'); }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="category-container">
          <div className="category-box">
            <div className="category-title"><FileSpreadsheet size={16} /> Data Tools</div>
            <div className="compact-grid">
              <CompactToolCard className="excel" title="Merge Excel" desc="Combine multiple XLSX/CSV." icon={Combine} onClick={() => { setActiveSegment('excel'); setCurrentTool('excel-merge'); }} />
              <CompactToolCard className="excel" title="Excel to PDF" desc="Convert spreadsheets to PDF." icon={FileText} onClick={() => { setActiveSegment('excel'); setCurrentTool('excel-to-pdf'); }} />
              <CompactToolCard className="excel" title="PDF to Excel" desc="Extract tables to XLSX." icon={FileSpreadsheet} onClick={() => { setActiveSegment('excel'); setCurrentTool('pdf-to-excel'); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-wrapper">
      <header className="premium-header">
        <div className="logo" onClick={reset} style={{cursor: 'pointer'}}>
          <FileSpreadsheet size={24} /> DocuMax Pro
        </div>
        <div style={{fontSize: '0.8rem', color: '#999', fontWeight: '500', marginLeft: '1rem', flex: 1}}>
          Created by <span style={{color: '#666', fontWeight: '700'}}>Diwakar Singh</span>
        </div>
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
            <div className="main-content success-view" style={{maxWidth: '800px'}}>
              <h2>Operation Successful!</h2>
              <a href={`${API_URL}${result.downloadUrl}`} className="download-link">
                Download Processed File <Download />
              </a>
              <button className="btn" onClick={reset} style={{marginTop: '2rem'}}>Start New Task</button>
            </div>
          </div>
        ) : (
          <div className="workspace">
            <div className="main-content">
              {files.length === 0 ? (
                <div className="hero">
                  <h2 style={{textTransform: 'uppercase'}}>{currentTool.replace(/-/g, ' ')}</h2>
                  <div className="select-btn" onClick={() => document.getElementById('fileInput').click()}>
                    Select File
                  </div>
                  <input 
                    id="fileInput" 
                    type="file" 
                    multiple 
                    hidden 
                    accept={activeSegment === 'pdf' ? '.pdf' : '.xlsx,.csv'} 
                    onChange={onFileChange} 
                  />
                </div>
              ) : ['pdf-edit', 'pdf-rotate'].includes(currentTool) ? (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
                  <div style={{background: 'white', padding: '10px', borderRadius: '8px', boxShadow: 'var(--shadow)', display: 'flex', gap: '10px', alignItems: 'center'}}>
                    {currentTool === 'pdf-rotate' ? (
                      <>
                        <button className="btn" onClick={() => setRotation((rotation + 90) % 360)}>Rotate +90°</button>
                        <span style={{fontWeight: 'bold'}}>{rotation}°</span>
                      </>
                    ) : (
                      <>
                        <button className="btn" onClick={() => { if(currentPage > 1) { setCurrentPage(currentPage-1); renderPage(pdfDoc, currentPage-1); }}}>Prev</button>
                        <span style={{fontSize: '0.9rem'}}>Page {currentPage} of {pdfDoc?.numPages}</span>
                        <button className="btn" onClick={() => { if(currentPage < pdfDoc?.numPages) { setCurrentPage(currentPage+1); renderPage(pdfDoc, currentPage+1); }}}>Next</button>
                        <div style={{borderLeft: '1px solid #ccc', height: '20px', margin: '0 5px'}}></div>
                        <span style={{fontSize: '0.8rem', color: '#666'}}>Click on page to add text</span>
                      </>
                    )}
                  </div>
                  <div style={{position: 'relative', boxShadow: '0 0 30px rgba(0,0,0,0.1)', transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s'}}>
                    <canvas ref={canvasRef} onClick={handleCanvasClick} style={{cursor: currentTool === 'pdf-edit' ? 'crosshair' : 'default', maxWidth: '100%'}}></canvas>
                    {currentTool === 'pdf-edit' && modifications.filter(m => m.pageIndex === currentPage - 1).map((m, i) => (
                      <div key={i} style={{
                        position: 'absolute',
                        left: m.x,
                        top: (canvasRef.current?.height || 0) - m.y,
                        color: 'black',
                        fontSize: '16px',
                        pointerEvents: 'none',
                        background: 'rgba(255,255,0,0.3)',
                        padding: '2px'
                      }}>
                        {m.text}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="file-grid">
                  {files.map((file, idx) => (
                    <div key={idx} className="file-card">
                      <div className="remove-btn" onClick={() => removeFile(idx)}><X size={14} /></div>
                      <div className="icon-container">
                        {activeSegment === 'pdf' ? <Upload size={64} /> : <FileSpreadsheet size={64} />}
                      </div>
                      <div className="file-name">{file.name}</div>
                    </div>
                  ))}
                  <div className="file-card add-more-card" onClick={() => document.getElementById('fileInput').click()}>
                    <Plus size={48} />
                    <input 
                      id="fileInput" 
                      type="file" 
                      multiple 
                      hidden 
                      onChange={onFileChange} 
                    />
                  </div>
                </div>
              )}
            </div>

            {files.length > 0 && (
              <aside className="sidebar">
                <h2 style={{fontSize: '1.2rem', marginBottom: '1rem'}}>{currentTool.replace(/-/g, ' ')}</h2>
                <div className="option-card active">
                  <div className="option-title">Standard Processing</div>
                  <div className="option-desc">Optimal quality and speed.</div>
                </div>
                <button className="action-btn" onClick={handleProcess} disabled={isProcessing}>
                  {isProcessing ? 'PROCESSING...' : 'Process & Download'}
                </button>
              </aside>
            )}
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="loading-overlay">
          <Loader2 size={48} className="animate-spin" color="var(--primary)" />
          <h2 style={{marginTop: '1rem'}}>Processing your files...</h2>
        </div>
      )}
    </div>
  );
}

export default App;
