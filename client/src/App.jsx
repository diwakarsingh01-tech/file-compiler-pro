import React, { useState, useCallback } from 'react';
import { Upload, FileText, Download, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = window.location.origin;

function App() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    setError(null);
    setResult(null);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>File Compiler Pro</h1>
        <p>Consolidate Excel and CSV files into a master report seamlessly.</p>
      </header>

      <main>
        <div className="upload-card">
          <div 
            className="drop-zone"
            onClick={() => document.getElementById('fileInput').click()}
          >
            <Upload size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
            <h3>Click or Drag & Drop Files</h3>
            <p>Support for .xlsx and .csv files</p>
            <input 
              id="fileInput"
              type="file" 
              multiple 
              hidden 
              accept=".xlsx,.csv" 
              onChange={onFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, idx) => (
                <div key={idx} className="file-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} />
                    <span>{file.name}</span>
                  </div>
                  <X 
                    size={18} 
                    style={{ cursor: 'pointer', color: 'var(--secondary)' }} 
                    onClick={() => removeFile(idx)}
                  />
                </div>
              ))}
              
              <button 
                className="btn btn-primary" 
                onClick={handleProcess}
                disabled={isUploading}
                style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                  </>
                ) : (
                  'Compile Files'
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="error-msg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} />
                <strong>Error:</strong>
              </div>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <CheckCircle2 size={24} />
                <h3 style={{ margin: 0 }}>Success! Files Merged Successfully.</h3>
              </div>
              <a 
                href={`${API_URL}${result.downloadUrl}`} 
                className="btn btn-success"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', margin: '0 auto' }}
              >
                <Download size={20} />
                Download Merged File
              </a>
            </div>
          )}
        </div>

        {result && result.preview && result.preview.length > 0 && (
          <div className="preview-container">
            <h3>Data Preview (First 5 rows)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="preview-table">
                <thead>
                  <tr>
                    {Object.keys(result.preview[0]).map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
