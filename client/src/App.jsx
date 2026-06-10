import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Download, X, Plus, Loader2, Trash2, Share2, Type, MousePointer2
} from 'lucide-react';
import axios from 'axios';
import * as pdfjs from 'pdfjs-dist';

// Set up pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const API_URL = window.location.origin;

function App() {
  const [currentTool, setCurrentTool] = useState('home'); 
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Editor State
  const [modifications, setModifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const canvasRef = useRef(null);

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    setError(null);
  };

  // Load PDF for Editor
  useEffect(() => {
    if (currentTool === 'pdf-edit' && files.length > 0) {
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
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
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
      // Convert browser Y (top-down) to PDF Y (bottom-up)
      // pdf-lib expects Y from bottom-left. 
      // We'll send raw canvas coords and height, and let backend or a calc fix it.
      setModifications([...modifications, {
        type: 'text',
        text,
        x: x / 1.5, // adjust for scale
        y: (canvasRef.current.height - y) / 1.5, // flip Y for pdf-lib
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
    
    let endpoint = '/api/upload';
    if (currentTool === 'pdf-merge') endpoint = '/api/pdf/merge';
    if (currentTool === 'pdf-split') endpoint = '/api/pdf/split';
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
    setPdfDoc(null);
    setCurrentTool('home');
  };

  const renderDashboard = () => (
    <div className="tool-grid">
      <div className="tool-card excel" onClick={() => setCurrentTool('excel-merge')}>
        <FileSpreadsheet size={48} />
        <h3>Merge Excel</h3>
        <p>Combine multiple Excel/CSV files.</p>
      </div>
      <div className="tool-card pdf" onClick={() => setCurrentTool('pdf-merge')}>
        <Upload size={48} />
        <h3>Merge PDF</h3>
        <p>Combine multiple PDF files.</p>
      </div>
      <div className="tool-card pdf" onClick={() => setCurrentTool('pdf-split')}>
        <X size={48} />
        <h3>Split PDF</h3>
        <p>Separate pages from a PDF.</p>
      </div>
      <div className="tool-card pdf" onClick={() => setCurrentTool('pdf-edit')}>
        <Plus size={48} />
        <h3>Edit PDF</h3>
        <p>Add text to your PDF pages.</p>
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
            <h1>All the tools you need for PDF & Excel</h1>
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
                  <input id="fileInput" type="file" multiple hidden onChange={onFileChange} />
                </div>
              ) : currentTool === 'pdf-edit' ? (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
                  <div style={{background: '#eee', padding: '10px', borderRadius: '5px', display: 'flex', gap: '10px'}}>
                    <button onClick={() => { if(currentPage > 1) { setCurrentPage(currentPage-1); renderPage(pdfDoc, currentPage-1); }}}>Prev</button>
                    <span>Page {currentPage} of {pdfDoc?.numPages}</span>
                    <button onClick={() => { if(currentPage < pdfDoc?.numPages) { setCurrentPage(currentPage+1); renderPage(pdfDoc, currentPage+1); }}}>Next</button>
                    <div style={{borderLeft: '1px solid #ccc', margin: '0 10px'}}></div>
                    <span style={{fontSize: '0.8rem', color: '#666'}}><Type size={14} inline /> Click anywhere on page to add text</span>
                  </div>
                  <div style={{position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.2)'}}>
                    <canvas ref={canvasRef} onClick={handleCanvasClick} style={{cursor: 'crosshair'}}></canvas>
                    {modifications.filter(m => m.pageIndex === currentPage - 1).map((m, i) => (
                      <div key={i} style={{
                        position: 'absolute',
                        left: m.x * 1.5,
                        top: canvasRef.current.height - (m.y * 1.5),
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
                        {file.name.endsWith('.pdf') ? <Upload size={64} /> : <FileSpreadsheet size={64} />}
                      </div>
                      <div className="file-name">{file.name}</div>
                    </div>
                  ))}
                  <div className="file-card add-more-card" onClick={() => document.getElementById('fileInput').click()}>
                    <Plus size={48} />
                    <input id="fileInput" type="file" multiple hidden onChange={onFileChange} />
                  </div>
                </div>
              )}
            </div>

            {files.length > 0 && (
              <aside className="sidebar">
                <h2>{currentTool.replace('-', ' ')}</h2>
                <div className="option-card active">
                  <div className="option-title">Apply Changes</div>
                  <div className="option-desc">This will generate your edited file.</div>
                </div>
                <button className="action-btn" onClick={handleProcess} disabled={isProcessing}>
                  {isProcessing ? 'SAVING...' : 'Save & Download'}
                </button>
              </aside>
            )}
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="loading-overlay">
          <Loader2 size={64} className="animate-spin" color="var(--primary)" />
          <h2>Finalizing your PDF...</h2>
        </div>
      )}
    </div>
  );
}

export default App;
