import React, { useState } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  X, 
  Plus, 
  ShieldCheck, 
  Zap, 
  Check,
  Loader2,
  Trash2,
  Share2
} from 'lucide-react';
import axios from 'axios';

const API_URL = window.location.origin;

function App() {
  const [currentTool, setCurrentTool] = useState('home'); // home, excel-merge, pdf-merge, pdf-split, pdf-edit
  const [files, setFiles] = useState([]);
  const [compressionLevel, setCompressionLevel] = useState('recommended');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    setError(null);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) setResult(null);
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
    setCurrentTool('home');
  };

  const renderDashboard = () => (
    <div className="tool-grid">
      <div className="tool-card excel" onClick={() => setCurrentTool('excel-merge')}>
        <FileSpreadsheet size={48} />
        <h3>Merge Excel</h3>
        <p>Combine multiple Excel/CSV files into one.</p>
      </div>
      <div className="tool-card pdf" onClick={() => setCurrentTool('pdf-merge')}>
        <Upload size={48} />
        <h3>Merge PDF</h3>
        <p>Combine multiple PDF files into one.</p>
      </div>
      <div className="tool-card pdf" onClick={() => setCurrentTool('pdf-split')}>
        <X size={48} />
        <h3>Split PDF</h3>
        <p>Separate pages from a PDF file.</p>
      </div>
      <div className="tool-card pdf" onClick={() => setCurrentTool('pdf-edit')}>
        <Plus size={48} />
        <h3>Edit PDF</h3>
        <p>Add text, images or shapes to a PDF.</p>
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
          <div className="nav-link" onClick={() => setCurrentTool('excel-merge')}>Excel Merge</div>
          <div className="nav-link" onClick={() => setCurrentTool('pdf-merge')}>PDF Merge</div>
        </nav>
      </header>

      <main style={{flex: 1, background: 'var(--bg-light)'}}>
        {currentTool === 'home' ? (
          <div className="hero">
            <h1>Every tool you need to work with files</h1>
            <p>100% FREE, private, and easy to use.</p>
            {renderDashboard()}
          </div>
        ) : result ? (
          <div className="workspace" style={{justifyContent: 'center'}}>
            <div className="main-content success-view" style={{maxWidth: '800px'}}>
              <h2 style={{fontSize: '2rem'}}>Your files have been processed!</h2>
              <a href={`${API_URL}${result.downloadUrl}`} className="download-link">
                Download Result <Download />
              </a>
              {result.stats && (
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{result.stats.finalRows || result.stats.pages}</div>
                    <div className="stat-label">{result.stats.finalRows ? 'Final Rows' : 'Total Pages'}</div>
                  </div>
                </div>
              )}
              <button className="btn" onClick={reset} style={{marginTop: '2rem'}}>Process another</button>
            </div>
          </div>
        ) : (
          <div className="workspace">
            <div className="main-content">
              {files.length === 0 ? (
                <div className="hero" style={{padding: '2rem'}}>
                  <h2>{currentTool.replace('-', ' ').toUpperCase()}</h2>
                  <div className="select-btn" onClick={() => document.getElementById('fileInput').click()}>
                    Select Files
                  </div>
                  <input 
                    id="fileInput" 
                    type="file" 
                    multiple 
                    hidden 
                    accept={currentTool.includes('pdf') ? '.pdf' : '.xlsx,.csv'} 
                    onChange={onFileChange} 
                  />
                </div>
              ) : (
                <div className="file-grid">
                  {files.map((file, idx) => (
                    <div key={idx} className="file-card">
                      <div className="remove-btn" onClick={() => removeFile(idx)}><X size={14} /></div>
                      <div className="icon-container">
                        {currentTool.includes('pdf') ? <Upload size={64} /> : <FileSpreadsheet size={64} />}
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
                      accept={currentTool.includes('pdf') ? '.pdf' : '.xlsx,.csv'} 
                      onChange={onFileChange} 
                    />
                  </div>
                </div>
              )}
            </div>

            {files.length > 0 && (
              <aside className="sidebar">
                <h2>{currentTool.replace('-', ' ')} options</h2>
                <div className={`option-card active`}>
                  <div className="option-title">Standard Processing</div>
                  <div className="option-desc">Best quality and performance.</div>
                </div>
                {error && <div className="error-msg">{error}</div>}
                <button className="action-btn" onClick={handleProcess} disabled={isProcessing}>
                  {isProcessing ? 'PROCESSING...' : 'Process Files'}
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
