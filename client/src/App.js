import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, Download, Settings, Eye, EyeOff, RotateCcw, Upload, FileText } from 'lucide-react';
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
    setBatchComparisons(comparisons);
    setCurrentBatchIndex(0);
    setShowCSVImport(false);
    setBatchResults([]);
    
    // Auto-start batch processing if there are comparisons
    if (comparisons.length > 0) {
      startBatchProcessing(comparisons);
    }
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

      const response = await axios.post('/api/compare-ui', {
        urlA,
        urlB,
        options: {
          fullPage: formData.fullPage,
          diffThreshold: parseFloat(formData.diffThreshold),
          includeAA: formData.includeAA,
          waitFor: formData.waitFor,
          maskSelectors: formData.maskSelectors.split(',').map(s => s.trim()).filter(Boolean)
        }
      });

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
              <button
                onClick={() => setShowCSVImport(true)}
                className="btn btn-secondary csv-import-btn"
              >
                <FileText size={16} />
                Import from CSV
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="urlA">Website A URL *</label>
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
                  <label htmlFor="urlB">Website B URL *</label>
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
                    onClick={() => downloadImage(results.images.A, 'site-a.png')}
                  >
                    <Download size={16} />
                    Download Site A
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => downloadImage(results.images.B, 'site-b.png')}
                  >
                    <Download size={16} />
                    Download Site B
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => downloadImage(results.images.diff, 'diff.png')}
                  >
                    <Download size={16} />
                    Download Diff
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={downloadResults}
                  >
                    <Download size={16} />
                    Download JSON
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

              {/* Comparison Viewer */}
              <div className="comparison-viewer">
                <div className="image-container">
                  <h4>Site A</h4>
                  <img
                    src={`data:image/png;base64,${results.images.A}`}
                    alt="Site A Screenshot"
                    className="comparison-image"
                  />
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {results.urls.A}
                  </p>
                </div>

                <div className="image-container">
                  <h4>Site B</h4>
                  <img
                    src={`data:image/png;base64,${results.images.B}`}
                    alt="Site B Screenshot"
                    className="comparison-image"
                  />
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {results.urls.B}
                  </p>
                </div>

                <div className="image-container">
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
