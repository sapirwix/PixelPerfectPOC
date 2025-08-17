import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, Download, Settings, Eye, EyeOff, RotateCcw, Upload, FileText, X } from 'lucide-react';
import Navigation from './components/Navigation';
import History from './components/History';
import CSVImport from './components/CSVImport';
import BatchResults from './components/BatchResults';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('compare');
  const [formData, setFormData] = useState({
    urlA: '',
    urlB: '',
    fullPage: true,
    diffThreshold: 0.1,
    includeAA: true,
    waitFor: 'networkidle',
    maskSelectors: '.cookie, #cookie, .banner, .ads'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [batchComparisons, setBatchComparisons] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState([]);
  const [showBatchResults, setShowBatchResults] = useState(false);
  
  // Modal state
  const [modalImage, setModalImage] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalUrl, setModalUrl] = useState('');

  const [importedURLs, setImportedURLs] = useState([]);
  const [showImportedURLs, setShowImportedURLs] = useState(false);

  // Load comparison history when component mounts
  useEffect(() => {
    loadComparisonHistory();
  }, []);

  const loadComparisonHistory = () => {
    const saved = localStorage.getItem('comparisonHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
          localStorage.removeItem('comparisonHistory');
        }
      } catch (e) {
        localStorage.removeItem('comparisonHistory');
      }
    }
  };

  const saveComparisonToHistory = (comparisonResult) => {
    try {
      const existing = localStorage.getItem('comparisonHistory');
      let history = existing ? JSON.parse(existing) : [];
      
      if (!Array.isArray(history)) {
        history = [];
      }
      
      // Add new comparison to the beginning
      history.unshift(comparisonResult);
      
      // Keep only last 50 comparisons to prevent localStorage from getting too large
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      
      localStorage.setItem('comparisonHistory', JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save comparison to history:', e);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Clear any existing results when switching pages
    if (page === 'compare') {
      setResults(null);
      setError(null);
      setErrorDetails(null);
      setBatchComparisons([]);
      setCurrentBatchIndex(0);
      setBatchResults([]);
      setShowBatchResults(false);
    }
  };

  const handleCSVImport = (comparisons) => {
    setImportedURLs(comparisons);
    setShowImportedURLs(true);
    setShowCSVImport(false);
    setBatchComparisons([]);
    setBatchResults([]);
    setCurrentBatchIndex(0);
    
    // Don't auto-start batch processing - let user review and configure first
  };

  const startBatchProcessingFromImported = () => {
    if (importedURLs.length === 0) return;
    
    setBatchComparisons(importedURLs);
    setCurrentBatchIndex(0);
    setShowImportedURLs(false);
    setImportedURLs([]);
    
    // Start batch processing with current form settings
    startBatchProcessing(importedURLs);
  };

  const clearImportedURLs = () => {
    setImportedURLs([]);
    setShowImportedURLs(false);
    setBatchComparisons([]);
    setBatchResults([]);
    setCurrentBatchIndex(0);
  };

  const startBatchProcessing = async (comparisons) => {
    if (comparisons.length === 0) return;
    
    setIsBatchProcessing(true);
    setCurrentBatchIndex(0);
    setResults(null);
    setError(null);
    setErrorDetails(null);
    setBatchResults([]);
    
    const results = [];
    
    // Process comparisons one by one
    for (let i = 0; i < comparisons.length; i++) {
      setCurrentBatchIndex(i);
      
      try {
        const comparison = comparisons[i];
        setFormData(prev => ({
          ...prev,
          urlA: comparison.urlA,
          urlB: comparison.urlB
        }));
        
        // Wait a bit between comparisons to avoid overwhelming the server
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Process this comparison
        const result = await processComparison(comparison.urlA, comparison.urlB, true);
        
        // Add to batch results
        if (result) {
          results.push({
            ...result,
            urlA: comparison.urlA,
            urlB: comparison.urlB,
            batchIndex: i,
            originalData: comparison.originalData
          });
        } else {
          // Handle failed comparison
          results.push({
            urlA: comparison.urlA,
            urlB: comparison.urlB,
            batchIndex: i,
            originalData: comparison.originalData,
            error: 'Comparison failed',
            errorDetails: {
              suggestion: 'Try processing this comparison individually'
            }
          });
        }
        
      } catch (error) {
        console.error(`Batch comparison ${i + 1} failed:`, error);
        
        // Add error result
        results.push({
          urlA: comparisons[i].urlA,
          urlB: comparisons[i].urlB,
          batchIndex: i,
          originalData: comparisons[i].originalData,
          error: error.message || 'Comparison failed',
          errorDetails: {
            suggestion: 'Try processing this comparison individually'
          }
        });
      }
    }
    
    setIsBatchProcessing(false);
    setCurrentBatchIndex(0);
    setBatchResults(results);
    
    // Show batch results
    setShowBatchResults(true);
  };

  const processComparison = async (urlA, urlB, isBatch = false) => {
    if (!isBatch) {
      setIsLoading(true);
    }
    setError(null);
    setErrorDetails(null);
    if (!isBatch) {
      setResults(null);
      setProgress(0);
    }

    try {
      // Simulate progress for non-batch comparisons
      let progressInterval;
      if (!isBatch) {
        progressInterval = setInterval(() => {
          setProgress(prev => Math.min(prev + Math.random() * 20, 90));
        }, 500);
      }

      const requestData = {
        urlA,
        urlB,
        options: {
          fullPage: formData.fullPage,
          diffThreshold: parseFloat(formData.diffThreshold),
          includeAA: formData.includeAA,
          waitFor: formData.waitFor,
          maskSelectors: formData.maskSelectors.split(',').map(s => s.trim()).filter(Boolean)
        }
      };

      const response = await axios.post('/api/compare-ui', requestData);

      if (progressInterval) {
        clearInterval(progressInterval);
        setProgress(100);
      }

      const result = response.data;
      
      if (!isBatch) {
        setResults(result);
        // Save to history
        saveComparisonToHistory(result);
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
      }

      return result;

    } catch (err) {
      console.error('Comparison failed:', err);
      
      const errorData = err.response?.data || {};
      const errorCode = errorData.code || 'UNKNOWN_ERROR';
      const errorMessage = errorData.error || err.message || 'Comparison failed';
      
      if (!isBatch) {
        setError(getErrorMessage(errorCode, errorMessage));
        setErrorDetails({
          code: errorCode,
          suggestion: getErrorSuggestion(errorCode),
          timestamp: errorData.timestamp || new Date().toISOString(),
          details: errorData
        });
      }

      throw err;
    } finally {
      if (!isBatch) {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateUrls = () => {
    if (!formData.urlA || !formData.urlB) {
      setError('Both URLs are required');
      return false;
    }

    try {
      new URL(formData.urlA);
      new URL(formData.urlB);
    } catch {
      setError('Please enter valid URLs (including http:// or https://)');
      return false;
    }

    if (formData.urlA === formData.urlB) {
      setError('URLs must be different');
      return false;
    }

    return true;
  };

  const getErrorMessage = (errorCode, errorMessage) => {
    const errorMap = {
      'MISSING_URLS': 'Please enter both URLs to compare.',
      'INVALID_URL_A': 'The first URL is not valid. Please check the format.',
      'INVALID_URL_B': 'The second URL is not valid. Please check the format.',
      'SERVICE_NOT_READY': 'The comparison service is not ready. Please try again in a moment.',
      'NETWORK_ERROR': 'Network connection issue. Please check your internet connection.',
      'DNS_ERROR': 'Could not find the website. Please check the URL spelling.',
      'SSL_ERROR': 'Security certificate issue. The site may have SSL problems.',
      'TIMEOUT_ERROR': 'The website took too long to respond. Please try again.',
      'CONTENT_ERROR': 'Required content not found. Try a different wait strategy.',
      'STABILITY_ERROR': 'The page crashed during capture. Try a different URL.',
      'CAPTURE_ERROR': 'Screenshot capture failed. The page may be too complex.',
      'IMAGE_PROCESSING_ERROR': 'Image processing failed. Please try again.',
      'COMPARISON_ERROR': 'Visual comparison failed. Please try again.',
      'VALIDATION_ERROR': 'Invalid input provided. Please check your settings.',
      'INTERNAL_ERROR': 'An unexpected error occurred. Please try again.',
      'NOT_FOUND': 'The requested endpoint was not found.',
      'MULTI_COMPARISON_FAILED': 'Multi-viewport comparison failed. Please try again.'
    };

    return errorMap[errorCode] || errorMessage || 'An unexpected error occurred.';
  };

  const getErrorSuggestion = (errorCode) => {
    const suggestionMap = {
      'NETWORK_ERROR': 'Try checking your internet connection and firewall settings.',
      'DNS_ERROR': 'Verify the URL spelling and try again.',
      'SSL_ERROR': 'Try accessing the site directly in your browser first.',
      'TIMEOUT_ERROR': 'The site may be slow. Try again or use a different URL.',
      'CONTENT_ERROR': 'Try using "Network Idle" wait strategy instead.',
      'STABILITY_ERROR': 'Try a simpler website or reduce the page complexity.',
      'CAPTURE_ERROR': 'Try disabling full-page capture or use a different URL.',
      'IMAGE_PROCESSING_ERROR': 'Try with smaller viewport or simpler pages.',
      'COMPARISON_ERROR': 'Try adjusting the diff threshold or use different URLs.'
    };

    return suggestionMap[errorCode] || 'If the problem persists, try different URLs or settings.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateUrls()) return;

    // Check if there are imported URLs that should be processed instead
    if (showImportedURLs && importedURLs.length > 0) {
      setError('You have imported URLs ready for batch processing. Please use the "Start Batch Comparison" button above, or clear the imported URLs first.');
      return;
    }

    await processComparison(formData.urlA, formData.urlB);
  };

  const downloadImage = (base64Data, filename) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadResults = () => {
    if (!results) return;

    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `comparison-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadResultsCSV = () => {
    if (!results) return;

    // Determine if this is a batch result or single comparison
    const isBatchResult = Array.isArray(results) && results.length > 0;
    const dataToProcess = isBatchResult ? results : [results];

    // Create CSV data with the specified columns
    const csvData = [
      ['Original Site', 'Migrated Site', 'Content', 'Design', 'Diff URL']
    ];

    // Process each comparison result
    dataToProcess.forEach((result, index) => {
      if (result && result.metrics) {
        csvData.push([
          result.urls?.A || result.urlA || 'N/A',
          result.urls?.B || result.urlB || 'N/A',
          `${result.metrics.mismatchPercent || 0}% mismatch, ${(result.metrics.changedPixels || 0).toLocaleString()} pixels changed`,
          `${result.metrics.width || 'N/A'} × ${result.metrics.height || 'N/A'} dimensions, SSIM: ${result.metrics.ssimScore || 'N/A'}`,
          `Comparison ID: ${result.id || `batch-${index + 1}`}`
        ]);
      } else if (result && result.error) {
        // Handle failed comparisons
        csvData.push([
          result.urlA || 'N/A',
          result.urlB || 'N/A',
          `Error: ${result.error}`,
          'N/A',
          `Failed comparison ${index + 1}`
        ]);
      }
    });

    // Convert to CSV string
    const csvString = csvData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Create and download the CSV file
    const csvBlob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvBlob);
    
    // Set filename based on whether it's batch or single
    if (isBatchResult) {
      link.download = `batch-comparison-${dataToProcess.length}-results-${Date.now()}.csv`;
    } else {
      link.download = `comparison-${results.id || Date.now()}.csv`;
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetForm = () => {
    setFormData({
      urlA: '',
      urlB: '',
      fullPage: true,
      diffThreshold: 0.1,
      includeAA: true,
      waitFor: 'networkidle',
      maskSelectors: '.cookie, #cookie, .banner, .ads'
    });
    setResults(null);
    setError(null);
    setErrorDetails(null);
    setProgress(0);
    setBatchComparisons([]);
    setCurrentBatchIndex(0);
    setBatchResults([]);
    setShowBatchResults(false);
  };

  const handleBatchResultsClose = () => {
    setShowBatchResults(false);
  };

  const handleNewComparison = () => {
    setShowBatchResults(false);
    resetForm();
  };

  const handleDeleteComparison = (id) => {
    // This will be handled by the History component
    // We can add additional logic here if needed
  };

  const openModal = (imageData, url, title) => {
    setModalImage(imageData);
    setModalUrl(url);
    setModalTitle(title);
  };

  const closeModal = () => {
    setModalImage(null);
    setModalUrl('');
    setModalTitle('');
  };

  const renderComparePage = () => (
    <>
      <header className="header">
        <div className="container">
          <h1><Camera size={48} /> Pixel Perfect POC</h1>
          <p>Visual UI Comparison Tool - Compare two websites side by side</p>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {/* Batch Processing Status */}
          {isBatchProcessing && batchComparisons.length > 0 && (
            <div className="batch-status">
              <h3>Batch Processing</h3>
              <div className="batch-progress">
                <div className="batch-info">
                  <span>Processing {currentBatchIndex + 1} of {batchComparisons.length}</span>
                  <span className="current-urls">
                    {batchComparisons[currentBatchIndex]?.urlA} vs {batchComparisons[currentBatchIndex]?.urlB}
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${((currentBatchIndex + 1) / batchComparisons.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Form */}
          <section className="form-section">
            <div className="form-header">
              <h2>Compare Two Websites</h2>
            </div>
            
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCSVImport(true)}
              >
                <FileText size={16} />
                Import from CSV
              </button>
            </div>

            {/* Imported URLs Section */}
            {showImportedURLs && importedURLs.length > 0 && (
              <div className="imported-urls-section">
                <div className="section-header">
                  <h3>📁 Imported URLs from CSV</h3>
                  <span className="url-count">{importedURLs.length} URL pairs ready for comparison</span>
                </div>
                
                <div className="imported-urls-list">
                  {importedURLs.slice(0, 5).map((comparison, index) => (
                    <div key={index} className="imported-url-pair">
                      <div className="url-item">
                        <span className="url-label">Site A:</span>
                        <span className="url-value" title={comparison.urlA}>
                          {comparison.urlA.length > 50 
                            ? comparison.urlA.substring(0, 50) + '...' 
                            : comparison.urlA}
                        </span>
                      </div>
                      <div className="url-item">
                        <span className="url-label">Site B:</span>
                        <span className="url-value" title={comparison.urlB}>
                          {comparison.urlB.length > 50 
                            ? comparison.urlB.substring(0, 50) + '...' 
                            : comparison.urlB}
                        </span>
                      </div>
                    </div>
                  ))}
                  {importedURLs.length > 5 && (
                    <div className="more-urls">
                      ... and {importedURLs.length - 5} more URL pairs
                    </div>
                  )}
                </div>

                <div className="imported-urls-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={startBatchProcessingFromImported}
                  >
                    🚀 Start Batch Comparison ({importedURLs.length} URLs)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={clearImportedURLs}
                  >
                    ✕ Clear Imported URLs
                  </button>
                </div>

                <div className="imported-urls-note">
                  💡 Configure your comparison options below before starting the batch process
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              {showImportedURLs && importedURLs.length > 0 && (
                <div className="form-note">
                  <p>📝 <strong>Single Comparison Form:</strong> Use this form for individual URL comparisons. For the imported URLs above, use the "Start Batch Comparison" button.</p>
                </div>
              )}
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="urlA">Original Site URL *</label>
                  <input
                    type="url"
                    id="urlA"
                    name="urlA"
                    className="form-control"
                    value={formData.urlA}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="urlB">Migrated Site URL *</label>
                  <input
                    type="url"
                    id="urlB"
                    name="urlB"
                    className="form-control"
                    placeholder="https://example2.com"
                    value={formData.urlB}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {/* Basic Options */}
              <div className="options-grid">
                <div className="form-group">
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="fullPage"
                      name="fullPage"
                      checked={formData.fullPage}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="fullPage">Capture full page</label>
                  </div>
                  <div className="help-text">Include content below the fold</div>
                </div>

                <div className="form-group">
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="includeAA"
                      name="includeAA"
                      checked={formData.includeAA}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="includeAA">Include anti-aliasing</label>
                  </div>
                  <div className="help-text">Account for font rendering differences</div>
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ marginBottom: showAdvanced ? '1rem' : '0' }}
              >
                {showAdvanced ? <EyeOff size={16} /> : <Settings size={16} />}
                {showAdvanced ? ' Hide Advanced Options' : ' Show Advanced Options'}
              </button>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="advanced-options">
                  <h4>Advanced Configuration</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="diffThreshold">Diff Threshold</label>
                      <input
                        type="number"
                        id="diffThreshold"
                        name="diffThreshold"
                        className="form-control"
                        value={formData.diffThreshold}
                        onChange={handleInputChange}
                        min="0"
                        max="1"
                        step="0.01"
                      />
                      <div className="help-text">Sensitivity for detecting changes (0.1 = 10%)</div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="waitFor">Wait Strategy</label>
                      <select
                        id="waitFor"
                        name="waitFor"
                        className="form-control"
                        value={formData.waitFor}
                        onChange={handleInputChange}
                      >
                        <option value="networkidle">Network Idle</option>
                        <option value="css:.main">Wait for CSS Selector</option>
                      </select>
                      <div className="help-text">How long to wait before capturing</div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="maskSelectors">Elements to Hide</label>
                    <input
                      type="text"
                      id="maskSelectors"
                      name="maskSelectors"
                      className="form-control"
                      value={formData.maskSelectors}
                      onChange={handleInputChange}
                      placeholder=".cookie, #banner, .ads"
                    />
                    <div className="help-text">CSS selectors for dynamic elements (comma-separated)</div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading || isBatchProcessing}
                >
                  <Camera size={16} />
                  {isLoading ? 'Comparing...' : 'Start Comparison'}
                </button>
                
                {results && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetForm}
                    style={{ marginLeft: '1rem' }}
                  >
                    <RotateCcw size={16} />
                    New Comparison
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Progress Bar */}
          {isLoading && (
            <div className="form-section">
              <h3>Processing Comparison...</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p>Capturing screenshots and computing differences...</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <strong>Error:</strong> {error}
                  {errorDetails && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      <strong>Suggestion:</strong> {errorDetails.suggestion}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setError(null);
                    setErrorDetails(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '0',
                    lineHeight: '1'
                  }}
                >
                  ×
                </button>
              </div>
              
              {errorDetails && process.env.NODE_ENV === 'development' && (
                <details style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                  <summary>Technical Details</summary>
                  <pre style={{ 
                    background: 'rgba(0,0,0,0.1)', 
                    padding: '0.5rem', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    marginTop: '0.5rem'
                  }}>
                    {JSON.stringify(errorDetails.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Results Section */}
          {results && (
            <section className="results-section">
              <div className="results-header">
                <h2>Comparison Results</h2>
                <div className="download-section">
                  <button
                    className="btn btn-secondary"
                    onClick={downloadResults}
                  >
                    <Download size={16} />
                    Download JSON
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={downloadResultsCSV}
                  >
                    <Download size={16} />
                    Download CSV
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{results.metrics.mismatchPercent}%</div>
                  <div className="metric-label">Mismatch</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{results.metrics.changedPixels.toLocaleString()}</div>
                  <div className="metric-label">Changed Pixels</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{results.metrics.ssimScore}</div>
                  <div className="metric-label">SSIM Score</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{results.metrics.width} × {results.metrics.height}</div>
                  <div className="metric-label">Dimensions</div>
                </div>
              </div>

              {/* Capture Status Summary */}
              <div style={{ 
                marginTop: '2rem', 
                padding: '1rem', 
                background: 'var(--background-color)', 
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>📸 Capture Status</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ 
                    padding: '1rem', 
                    background: results.metadata.A.fullPage ? 'rgba(0,255,0,0.1)' : 'rgba(255,165,0,0.1)',
                    borderRadius: '8px',
                    border: `2px solid ${results.metadata.A.fullPage ? 'var(--success-color)' : 'var(--warning-color)'}`
                  }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Original Site</h5>
                    <div style={{ fontSize: '0.875rem' }}>
                      <div><strong>Status:</strong> {results.metadata.A.fullPage ? '✅ Full Page Capture' : '⚠️ Viewport Only'}</div>
                      <div><strong>Method:</strong> {results.metadata.A.captureMethod || 'N/A'}</div>
                      <div><strong>Page Dimensions:</strong> {results.metadata.A.pageDimensions?.scrollWidth || 'N/A'} × {results.metadata.A.pageDimensions?.scrollHeight || 'N/A'}</div>
                      {results.metadata.A.capturedDimensions && (
                        <div><strong>Captured:</strong> {results.metadata.A.capturedDimensions.capturedWidth} × {results.metadata.A.capturedDimensions.capturedHeight}</div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ 
                    padding: '1rem', 
                    background: results.metadata.B.fullPage ? 'rgba(0,255,0,0.1)' : 'rgba(255,165,0,0.1)',
                    borderRadius: '8px',
                    border: `2px solid ${results.metadata.B.fullPage ? 'var(--success-color)' : 'var(--warning-color)'}`
                  }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Migrated Site</h5>
                    <div style={{ fontSize: '0.875rem' }}>
                      <div><strong>Status:</strong> {results.metadata.B.fullPage ? '✅ Full Page Capture' : '⚠️ Viewport Only'}</div>
                      <div><strong>Method:</strong> {results.metadata.B.captureMethod || 'N/A'}</div>
                      <div><strong>Page Dimensions:</strong> {results.metadata.B.pageDimensions?.scrollWidth || 'N/A'} × {results.metadata.B.pageDimensions?.scrollHeight || 'N/A'}</div>
                      {results.metadata.B.capturedDimensions && (
                        <div><strong>Captured:</strong> {results.metadata.B.capturedDimensions.capturedWidth} × {results.metadata.B.capturedDimensions.capturedHeight}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {results.metadata.A.fullPage && results.metadata.B.fullPage ? (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: 'rgba(0,255,0,0.1)', 
                    borderRadius: '6px',
                    border: '1px solid var(--success-color)',
                    color: 'var(--success-color)',
                    fontWeight: 'bold'
                  }}>
                    🎉 Both sites captured with full page mode enabled!
                  </div>
                ) : results.metadata.A.fullPage || results.metadata.B.fullPage ? (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: 'rgba(255,165,0,0.1)', 
                    borderRadius: '6px',
                    border: '1px solid var(--warning-color)',
                    color: 'var(--warning-color)',
                    fontWeight: 'bold'
                  }}>
                    ⚠️ Mixed capture methods detected. One site used full page, the other used viewport.
                  </div>
                ) : (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: 'rgba(255,0,0,0.1)', 
                    borderRadius: '6px',
                    border: '1px solid var(--error-color)',
                    color: 'var(--error-color)',
                    fontWeight: 'bold'
                  }}>
                    ❌ Both sites captured with viewport mode only. Full page capture was not used.
                  </div>
                )}
              </div>

              {/* Comparison Viewer */}
              <div className="comparison-viewer">
                <div className="image-container" onClick={() => openModal(results.images.A, results.urls.A, 'Original Site')}>
                  <h4>Original Site</h4>
                  <img
                    src={`data:image/png;base64,${results.images.A}`}
                    alt="Original Site Screenshot"
                    className="comparison-image"
                  />
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: '4px'
                  }}>
                    {results.metadata.A.fullPage ? '📄 Full Page' : '📱 Viewport'} • {results.metadata.A.pageDimensions?.scrollWidth || 'N/A'} × {results.metadata.A.pageDimensions?.scrollHeight || 'N/A'}
                  </div>
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--success-color)', 
                    marginTop: '0.25rem',
                    padding: '0.25rem',
                    background: 'rgba(0,255,0,0.1)',
                    borderRadius: '4px'
                  }}>
                    🖼️ Image: {results.metadata.A.pageDimensions?.scrollWidth || 'N/A'} × {results.metadata.A.pageDimensions?.scrollHeight || 'N/A'}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {results.urls.A}
                  </p>
                </div>

                <div className="image-container" onClick={() => openModal(results.images.B, results.urls.B, 'Migrated Site')}>
                  <h4>Migrated Site</h4>
                  <img
                    src={`data:image/png;base64,${results.images.B}`}
                    alt="Migrated Site Screenshot"
                    className="comparison-image"
                  />
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: '4px'
                  }}>
                    {results.metadata.B.fullPage ? '📄 Full Page' : '📱 Viewport'} • {results.metadata.B.pageDimensions?.scrollWidth || 'N/A'} × {results.metadata.B.pageDimensions?.scrollHeight || 'N/A'}
                  </div>
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--success-color)', 
                    marginTop: '0.25rem',
                    padding: '0.25rem',
                    background: 'rgba(0,255,0,0.1)',
                    borderRadius: '4px'
                  }}>
                    🖼️ Image: {results.metadata.B.pageDimensions?.scrollWidth || 'N/A'} × {results.metadata.B.pageDimensions?.scrollHeight || 'N/A'}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {results.urls.B}
                  </p>
                </div>

                <div className="image-container" onClick={() => openModal(results.images.diff, 'Visual Diff', 'Visual Diff')}>
                  <h4>Visual Diff</h4>
                  <img
                    src={`data:image/png;base64,${results.images.diff}`}
                    alt="Visual Difference"
                    className="comparison-image"
                  />
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Red = Changes detected
                  </p>
                </div>
              </div>

              {/* Metadata */}
              <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--background-color)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Comparison Details</h4>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <p><strong>Comparison ID:</strong> {results.id}</p>
                  <p><strong>Completed:</strong> {new Date(results.metadata.A.timestamp).toLocaleString()}</p>
                  <p><strong>Threshold:</strong> {results.metrics.threshold}</p>
                  <p><strong>Anti-aliasing:</strong> {results.metrics.includeAA ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* CSV Import Modal */}
      {showCSVImport && (
        <CSVImport
          onImport={handleCSVImport}
          onClose={() => setShowCSVImport(false)}
        />
      )}

      {/* Batch Results Modal */}
      {showBatchResults && batchResults.length > 0 && (
        <BatchResults
          results={batchResults}
          onClose={handleBatchResultsClose}
          onNewComparison={handleNewComparison}
        />
      )}

      {/* Modal for full-size images */}
      {modalImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="btn" onClick={closeModal}>
              <X size={20} />
            </button>
            <h3>{modalTitle}</h3>
            <img src={`data:image/png;base64,${modalImage}`} alt={modalTitle} />
            <p>{modalUrl}</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="App">
      <Navigation currentPage={currentPage} onPageChange={handlePageChange} />
      
      {currentPage === 'compare' ? renderComparePage() : <History onDeleteComparison={handleDeleteComparison} />}
    </div>
  );
}

export default App;
