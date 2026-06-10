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

const ToolCard = ({ title, desc, icon: Icon, onClick, className = "" }) => (
  <div className={`tool-card ${className}`} onClick={onClick}>
    <div className="icon-wrapper"><Icon size={32} /></div>
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
);

function App() {
  const [currentTool, setCurrentTool] = useState('home'); 
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
    const viewport = page.getViewport({ scale: 1.2 });
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
        x: x / 1.2,
        y: (canvasRef.current.height - y) / 1.2,
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
      <div className="dashboard-section">
        <div className="section-header">
          <Layers size={24} color="#e5322d" />
          <h2>Organize PDF</h2>
        </div>
        <div className="tool-grid">
          <ToolCard title="Merge PDF" desc="Combine PDFs in the order you want." icon={Combine} onClick={() => setCurrentTool('pdf-merge')} />
          <ToolCard title="Split PDF" desc="Separate one page or a whole set." icon={SplitSquareVertical} onClick={() => setCurrentTool('pdf-split')} />
          <ToolCard title="Remove pages" desc="Delete pages from a PDF file." icon={FileMinus} onClick={() => setCurrentTool('pdf-remove')} />
          <ToolCard title="Extract pages" desc="Get specific pages as a new PDF." icon={FileUp} onClick={() => setCurrentTool('pdf-extract')} />
          <ToolCard title="Organize PDF" desc="Sort, add and delete PDF pages." icon={LayoutGrid} onClick={() => setCurrentTool('pdf-organize')} />
          <ToolCard title="Scan to PDF" desc="Convert scanned images to PDF." icon={Scan} onClick={() => setCurrentTool('pdf-scan')} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <Zap size={24} color="#e5322d" />
          <h2>Optimize PDF</h2>
        </div>
        <div className="tool-grid">
          <ToolCard title="Compress PDF" desc="Reduce file size while optimizing quality." icon={Zap} onClick={() => setCurrentTool('pdf-compress')} />
          <ToolCard title="Repair PDF" desc="Recover data from a damaged PDF." icon={Settings} onClick={() => setCurrentTool('pdf-repair')} />
          <ToolCard title="OCR PDF" desc="Make scanned PDFs searchable." icon={FileSearch} onClick={() => setCurrentTool('pdf-ocr')} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <Plus size={24} color="#e5322d" />
          <h2>Convert to PDF</h2>
        </div>
        <div className="tool-grid">
          <ToolCard title="JPG to PDF" desc="Convert JPG, PNG, BMP images to PDF." icon={FileImage} onClick={() => setCurrentTool('jpg-to-pdf')} />
          <ToolCard title="WORD to PDF" desc="Convert DOCX to PDF." icon={FileText} onClick={() => setCurrentTool('word-to-pdf')} />
          <ToolCard title="POWERPOINT to PDF" desc="Convert PPTX to PDF." icon={FileType} onClick={() => setCurrentTool('ppt-to-pdf')} />
          <ToolCard title="EXCEL to PDF" desc="Convert XLSX to PDF." icon={FileSpreadsheet} onClick={() => setCurrentTool('excel-to-pdf')} />
          <ToolCard title="HTML to PDF" desc="Convert webpages to PDF." icon={Globe} onClick={() => setCurrentTool('html-to-pdf')} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <Download size={24} color="#e5322d" />
          <h2>Convert from PDF</h2>
        </div>
        <div className="tool-grid">
          <ToolCard title="PDF to JPG" desc="Extract images or save pages as JPG." icon={FileImage} onClick={() => setCurrentTool('pdf-to-jpg')} />
          <ToolCard title="PDF to WORD" desc="Convert PDF to editable DOCX." icon={FileText} onClick={() => setCurrentTool('pdf-to-word')} />
          <ToolCard title="PDF to POWERPOINT" desc="Convert PDF to PPTX." icon={FileType} onClick={() => setCurrentTool('pdf-to-ppt')} />
          <ToolCard title="PDF to EXCEL" desc="Convert PDF to XLSX spreadsheets." icon={FileSpreadsheet} onClick={() => setCurrentTool('pdf-to-excel')} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <PenTool size={24} color="#e5322d" />
          <h2>Edit PDF</h2>
        </div>
        <div className="tool-grid">
          <ToolCard title="Edit PDF" desc="Add text, images, shapes and more." icon={PenTool} onClick={() => setCurrentTool('pdf-edit')} />
          <ToolCard title="Rotate PDF" desc="Rotate your PDF pages." icon={RotateCcw} onClick={() => setCurrentTool('pdf-rotate')} />
          <ToolCard title="Page Numbers" desc="Add page numbers to PDF easily." icon={Hash} onClick={() => setCurrentTool('pdf-numbers')} />
          <ToolCard title="Add Watermark" desc="Stamp an image or text over your PDF." icon={Stamp} onClick={() => setCurrentTool('pdf-watermark')} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <Lock size={24} color="#555" />
          <h2>Security</h2>
        </div>
        <div className="tool-grid">
          <ToolCard className="security" title="Unlock PDF" desc="Remove PDF password security." icon={Unlock} onClick={() => setCurrentTool('pdf-unlock')} />
          <ToolCard className="security" title="Protect PDF" desc="Encrypt PDF with a password." icon={Lock} onClick={() => setCurrentTool('pdf-protect')} />
          <ToolCard className="security" title="Sign PDF" desc="Sign yourself or request signatures." icon={FileCheck} onClick={() => setCurrentTool('pdf-sign')} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <FileSpreadsheet size={24} color="#2e7d32" />
          <h2>Excel Tools</h2>
        </div>
        <div className="tool-grid">
          <ToolCard className="excel" title="Merge Excel" desc="Combine multiple Excel/CSV files." icon={Combine} onClick={() => setCurrentTool('excel-merge')} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      <header className="premium-header">
        <div className="logo" onClick={reset} style={{cursor: 'pointer'}}>
          <FileSpreadsheet size={32} /> FileMaster Suite
        </div>
        <nav style={{display: 'flex', gap: '1rem'}}>
          <div className="nav-link" onClick={() => setCurrentTool('home')}>Home</div>
          <div className="nav-link" onClick={() => setCurrentTool('excel-merge')}>Excel</div>
          <div className="nav-link" onClick={() => setCurrentTool('pdf-edit')}>PDF Editor</div>
        </nav>
      </header>

      <main style={{flex: 1, background: 'var(--bg-light)', overflowY: 'auto'}}>
        {currentTool === 'home' ? (
          <div className="hero">
            <h1>Every tool you need for PDF & Excel</h1>
            <p>100% Free and Private</p>
            {renderDashboard()}
          </div>
        ) : result ? (
          <div className="workspace" style={{justifyContent: 'center'}}>
            <div className="main-content success-view" style={{maxWidth: '800px'}}>
              <h2>Processed Successfully!</h2>
              <a href={`${API_URL}${result.downloadUrl}`} className="download-link">
                Download Result <Download />
              </a>
              <button className="btn" onClick={reset} style={{marginTop: '2rem'}}>Start Over</button>
            </div>
          </div>
        ) : (
          <div className="workspace">
            <div className="main-content" style={{position: 'relative'}}>
              {files.length === 0 ? (
                <div className="hero">
                  <h2>{currentTool.replace('-', ' ').toUpperCase()}</h2>
                  <div className="select-btn" onClick={() => document.getElementById('fileInput').click()}>
                    Select File
                  </div>
                  <input 
                    id="fileInput" 
                    type="file" 
                    multiple 
                    hidden 
                    accept={currentTool.includes('pdf') || currentTool.includes('to-pdf') ? '.pdf,.jpg,.png,.docx,.pptx,.xlsx' : '.xlsx,.csv'} 
                    onChange={onFileChange} 
                  />
                </div>
              ) : ['pdf-edit', 'pdf-rotate'].includes(currentTool) ? (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
                  <div style={{background: '#eee', padding: '10px', borderRadius: '5px', display: 'flex', gap: '10px', alignItems: 'center'}}>
                    {currentTool === 'pdf-rotate' ? (
                      <>
                        <button onClick={() => setRotation((rotation + 90) % 360)}>Rotate Right (90°)</button>
                        <span style={{fontWeight: 'bold'}}>Current Rotation: {rotation}°</span>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { if(currentPage > 1) { setCurrentPage(currentPage-1); renderPage(pdfDoc, currentPage-1); }}}>Prev</button>
                        <span>Page {currentPage} of {pdfDoc?.numPages}</span>
                        <button onClick={() => { if(currentPage < pdfDoc?.numPages) { setCurrentPage(currentPage+1); renderPage(pdfDoc, currentPage+1); }}}>Next</button>
                        <div style={{borderLeft: '1px solid #ccc', margin: '0 10px'}}></div>
                        <span style={{fontSize: '0.8rem', color: '#666'}}><Type size={14} /> Click to add text</span>
                      </>
                    )}
                  </div>
                  <div style={{position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.2)', transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s'}}>
                    <canvas ref={canvasRef} onClick={handleCanvasClick} style={{cursor: currentTool === 'pdf-edit' ? 'crosshair' : 'default'}}></canvas>
                    {currentTool === 'pdf-edit' && modifications.filter(m => m.pageIndex === currentPage - 1).map((m, i) => (
                      <div key={i} style={{
                        position: 'absolute',
                        left: m.x * 1.2,
                        top: (canvasRef.current?.height || 0) - (m.y * 1.2),
                        color: 'black',
                        fontSize: '18px',
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
                        {file.name.toLowerCase().endsWith('.pdf') ? <Upload size={64} /> : <FileSpreadsheet size={64} />}
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
                      accept={currentTool.includes('pdf') || currentTool.includes('to-pdf') ? '.pdf,.jpg,.png,.docx,.pptx,.xlsx' : '.xlsx,.csv'} 
                      onChange={onFileChange} 
                    />
                  </div>
                </div>
              )}
            </div>

            {files.length > 0 && (
              <aside className="sidebar">
                <h2>{currentTool.replace('-', ' ')}</h2>
                <div className="option-card active">
                  <div className="option-title">Process File</div>
                  <div className="option-desc">Apply your changes and download.</div>
                </div>
                <button className="action-btn" onClick={handleProcess} disabled={isProcessing}>
                  {isProcessing ? 'PROCESSING...' : 'Download Result'}
                </button>
              </aside>
            )}
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="loading-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(255,255,255,0.9)', display: 'flex', 
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <Loader2 size={64} className="animate-spin" color="var(--primary)" />
          <h2>Processing your files...</h2>
        </div>
      )}
    </div>
  );
}

export default App;
