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

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
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
  };

  // 1. Initial Selection View
  if (files.length === 0 && !result) {
    return (
      <div className="app-wrapper">
        <header className="premium-header">
          <div className="logo"><FileSpreadsheet size={32} /> ILoveExcel</div>
        </header>
        <main className="hero">
          <h1>Compress EXCEL</h1>
          <p>Compress and merge Excel and CSV files without losing quality.</p>
          <div className="select-btn" onClick={() => document.getElementById('fileInput').click()}>
            Select Excel files
          </div>
          <input id="fileInput" type="file" multiple hidden accept=".xlsx,.csv" onChange={onFileChange} />
        </main>
      </div>
    );
  }

  // 2. Success View
  if (result) {
    return (
      <div className="app-wrapper">
        <header className="premium-header">
          <div className="logo" onClick={reset} style={{cursor: 'pointer'}}><FileSpreadsheet size={32} /> ILoveExcel</div>
        </header>
        <main className="workspace" style={{justifyContent: 'center'}}>
          <div className="main-content success-view" style={{maxWidth: '800px'}}>
            <h2 style={{fontSize: '2rem'}}>Excel files have been compressed!</h2>
            <a href={`${API_URL}${result.downloadUrl}`} className="download-link">
              Download merged Excel <Download />
            </a>
            
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{result.stats.originalRows}</div>
                <div className="stat-label">Original Rows</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{result.stats.finalRows}</div>
                <div className="stat-label">Final Rows</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{result.stats.removedEmpty}</div>
                <div className="stat-label">Empty Removed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{result.stats.removedDuplicates}</div>
                <div className="stat-label">Duplicates Removed</div>
              </div>
            </div>

            <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
              <button className="btn" onClick={reset} style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <Trash2 size={18} /> Delete now
              </button>
              <button className="btn" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <Share2 size={18} /> Share link
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Workspace View (Grid + Sidebar)
  return (
    <div className="app-wrapper">
      <header className="premium-header">
        <div className="logo" onClick={reset} style={{cursor: 'pointer'}}><FileSpreadsheet size={32} /> ILoveExcel</div>
      </header>
      
      <main className="workspace">
        <div className="main-content">
          <div className="file-grid">
            {files.map((file, idx) => (
              <div key={idx} className="file-card">
                <div className="remove-btn" onClick={() => removeFile(idx)}><X size={14} /></div>
                <div className="icon-container"><FileSpreadsheet size={64} /></div>
                <div className="file-name">{file.name}</div>
              </div>
            ))}
            <div className="file-card add-more-card" onClick={() => document.getElementById('fileInput').click()}>
              <Plus size={48} />
              <input id="fileInput" type="file" multiple hidden accept=".xlsx,.csv" onChange={onFileChange} />
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <h2>Compression options</h2>
          
          <div 
            className={`option-card ${compressionLevel === 'extreme' ? 'active' : ''}`}
            onClick={() => setCompressionLevel('extreme')}
          >
            <div className="option-title">Extreme Compression</div>
            <div className="option-desc">Smallest file size. Removes duplicates and empty rows.</div>
          </div>

          <div 
            className={`option-card ${compressionLevel === 'recommended' ? 'active' : ''}`}
            onClick={() => setCompressionLevel('recommended')}
          >
            <div className="option-title">Recommended Compression</div>
            <div className="option-desc">Good quality, good compression. Removes empty rows.</div>
          </div>

          <div 
            className={`option-card ${compressionLevel === 'low' ? 'active' : ''}`}
            onClick={() => setCompressionLevel('low')}
          >
            <div className="option-title">Low Compression</div>
            <div className="option-desc">High quality, low compression. Just merges files.</div>
          </div>

          {error && <div className="error-msg" style={{marginBottom: '1rem'}}>{error}</div>}

          <button className="action-btn" onClick={handleProcess} disabled={isProcessing}>
            {isProcessing ? 'COMPRESSING...' : 'Compress & Merge'}
          </button>
        </aside>
      </main>

      {isProcessing && (
        <div className="loading-overlay">
          <Loader2 size={64} className="animate-spin" color="var(--primary)" />
          <h2 style={{marginTop: '2rem'}}>Merging and compressing your files...</h2>
        </div>
      )}
    </div>
  );
}

export default App;
