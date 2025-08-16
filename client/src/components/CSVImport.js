import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { parseCSV, generateCSVTemplate, validateCSVFile } from '../utils/csvParser';
import './CSVImport.css';

const CSVImport = ({ onImport, onClose }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (selectedFile) => {
    setError(null);
    setParsedData(null);
    
    // Validate file
    const validationErrors = validateCSVFile(selectedFile);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }
    
    setFile(selectedFile);
    
    try {
      setIsProcessing(true);
      const data = await parseCSV(selectedFile);
      setParsedData(data);
      console.log('CSV parsed successfully:', data);
    } catch (err) {
      setError(err.message);
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (parsedData && parsedData.comparisons.length > 0) {
      onImport(parsedData.comparisons);
      onClose();
    }
  };

  const handleDownloadTemplate = () => {
    generateCSVTemplate();
  };

  const removeFile = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="csv-import-overlay" onClick={onClose}>
      <div className="csv-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FileText size={24} /> Import URLs from CSV</h2>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {!parsedData ? (
            <>
              <div className="import-section">
                <h3>Upload CSV File</h3>
                <p>Upload a CSV file with two columns containing URLs to compare.</p>
                
                <div className="template-section">
                  <button 
                    onClick={handleDownloadTemplate}
                    className="btn btn-secondary template-btn"
                  >
                    <Download size={16} />
                    Download Template
                  </button>
                  <span className="template-info">
                    Use our template to see the correct format
                  </span>
                </div>

                <div 
                  className={`drop-zone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                  
                  {!file ? (
                    <div className="drop-content">
                      <Upload size={48} />
                      <h4>Drop CSV file here or click to browse</h4>
                      <p>Supports .csv files up to 5MB</p>
                    </div>
                  ) : (
                    <div className="file-info">
                      <FileText size={32} />
                      <div className="file-details">
                        <h4>{file.name}</h4>
                        <p>{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button 
                        onClick={removeFile}
                        className="remove-file-btn"
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="error-message">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="preview-section">
              <div className="preview-header">
                <h3>CSV Preview</h3>
                <div className="preview-stats">
                  <span className="stat">
                    <CheckCircle size={16} />
                    {parsedData.totalRows} URL pairs found
                  </span>
                  <span className="stat">
                    <FileText size={16} />
                    Columns: {parsedData.columns.urlA.name} & {parsedData.columns.urlB.name}
                  </span>
                </div>
              </div>

              <div className="url-preview">
                <h4>First 5 URL pairs:</h4>
                <div className="url-list">
                  {parsedData.comparisons.slice(0, 5).map((comparison, index) => (
                    <div key={index} className="url-pair">
                      <div className="url-item">
                        <span className="url-label">Site A:</span>
                        <span className="url-value" title={comparison.urlA}>
                          {comparison.urlA.length > 40 
                            ? comparison.urlA.substring(0, 40) + '...' 
                            : comparison.urlA}
                        </span>
                      </div>
                      <div className="url-item">
                        <span className="url-label">Site B:</span>
                        <span className="url-value" title={comparison.urlB}>
                          {comparison.urlB.length > 40 
                            ? comparison.urlB.substring(0, 40) + '...' 
                            : comparison.urlB}
                        </span>
                      </div>
                    </div>
                  ))}
                  {parsedData.comparisons.length > 5 && (
                    <div className="more-urls">
                      ... and {parsedData.comparisons.length - 5} more
                    </div>
                  )}
                </div>
              </div>

              <div className="import-actions">
                <button 
                  onClick={handleImport}
                  className="btn btn-primary import-btn"
                  disabled={isProcessing}
                >
                  <Upload size={16} />
                  Import {parsedData.totalRows} URL Pairs
                </button>
                <button 
                  onClick={() => setParsedData(null)}
                  className="btn btn-secondary"
                >
                  Choose Different File
                </button>
              </div>
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="processing-overlay">
            <div className="spinner"></div>
            <p>Processing CSV file...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImport;
