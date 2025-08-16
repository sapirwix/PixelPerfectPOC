import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Eye, EyeOff, RotateCcw, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import './BatchResults.css';

const BatchResults = ({ results, onClose, onNewComparison }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // all, success, error

  const currentResult = results[currentIndex];
  const totalResults = results.length;

  // Filter results based on status
  const filteredResults = results.filter(result => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'success') return !result.error;
    if (filterStatus === 'error') return result.error;
    return true;
  });

  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;

  const navigateToResult = (index) => {
    if (index >= 0 && index < totalResults) {
      setCurrentIndex(index);
    }
  };

  const navigateToNext = () => {
    if (currentIndex < totalResults - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const navigateToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const downloadImage = (base64Data, filename) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `batch-comparison-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCurrentResult = () => {
    if (!currentResult || currentResult.error) return;
    
    const dataStr = JSON.stringify(currentResult, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `comparison-${currentResult.id || Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusIcon = (result) => {
    if (result.error) {
      return <AlertCircle size={16} className="status-icon error" />;
    }
    return <CheckCircle size={16} className="status-icon success" />;
  };

  const getStatusText = (result) => {
    if (result.error) {
      return 'Failed';
    }
    return 'Success';
  };

  const getStatusClass = (result) => {
    if (result.error) {
      return 'status-failed';
    }
    return 'status-success';
  };

  return (
    <div className="batch-results-overlay">
      <div className="batch-results-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <h2><FileText size={24} /> Batch Comparison Results</h2>
            <div className="results-summary">
              <span className="summary-item">
                <CheckCircle size={16} />
                {successCount} Successful
              </span>
              <span className="summary-item">
                <AlertCircle size={16} />
                {errorCount} Failed
              </span>
              <span className="summary-item">
                <Clock size={16} />
                {totalResults} Total
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="btn btn-secondary"
              title={showDetails ? 'Hide Details' : 'Show Details'}
            >
              {showDetails ? <EyeOff size={16} /> : <Eye size={16} />}
              {showDetails ? ' Hide' : ' Show'} Details
            </button>
            <button onClick={onClose} className="close-btn">
              ×
            </button>
          </div>
        </div>

        {/* Navigation and Filters */}
        <div className="navigation-section">
          <div className="filter-controls">
            <label>Filter by status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Results ({totalResults})</option>
              <option value="success">Successful ({successCount})</option>
              <option value="error">Failed ({errorCount})</option>
            </select>
          </div>

          <div className="navigation-controls">
            <button
              onClick={navigateToPrev}
              disabled={currentIndex === 0}
              className="nav-btn"
              title="Previous Result"
            >
              <ChevronLeft size={20} />
            </button>
            
            <span className="navigation-info">
              {currentIndex + 1} of {totalResults}
            </span>
            
            <button
              onClick={navigateToNext}
              disabled={currentIndex === totalResults - 1}
              className="nav-btn"
              title="Next Result"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="results-list">
          {filteredResults.map((result, index) => (
            <div
              key={index}
              className={`result-item ${index === currentIndex ? 'active' : ''} ${getStatusClass(result)}`}
              onClick={() => setCurrentIndex(index)}
            >
              <div className="result-status">
                {getStatusIcon(result)}
                <span className="status-text">{getStatusText(result)}</span>
              </div>
              
              <div className="result-urls">
                <div className="url-pair">
                  <span className="url-label">A:</span>
                  <span className="url-value" title={result.urlA}>
                    {result.urlA.length > 30 
                      ? result.urlA.substring(0, 30) + '...' 
                      : result.urlA}
                  </span>
                </div>
                <div className="url-pair">
                  <span className="url-label">B:</span>
                  <span className="url-value" title={result.urlB}>
                    {result.urlB.length > 30 
                      ? result.urlB.substring(0, 30) + '...' 
                      : result.urlB}
                  </span>
                </div>
              </div>

              {!result.error && result.metrics && (
                <div className="result-metrics">
                  <span className="metric">
                    {result.metrics.mismatchPercent}% diff
                  </span>
                  <span className="metric">
                    {result.metrics.changedPixels?.toLocaleString()} pixels
                  </span>
                </div>
              )}

              {result.error && (
                <div className="result-error">
                  {result.error}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Current Result Details */}
        {showDetails && currentResult && (
          <div className="current-result-details">
            <div className="details-header">
              <h3>Result {currentIndex + 1} Details</h3>
              <div className="detail-actions">
                {!currentResult.error && (
                  <>
                    <button
                      onClick={() => downloadImage(currentResult.images?.A, 'site-a.png')}
                      className="btn btn-secondary"
                      disabled={!currentResult.images?.A}
                    >
                      <Download size={16} />
                      Site A
                    </button>
                    <button
                      onClick={() => downloadImage(currentResult.images?.B, 'site-b.png')}
                      className="btn btn-secondary"
                      disabled={!currentResult.images?.B}
                    >
                      <Download size={16} />
                      Site B
                    </button>
                    <button
                      onClick={() => downloadImage(currentResult.images?.diff, 'diff.png')}
                      className="btn btn-secondary"
                      disabled={!currentResult.images?.diff}
                    >
                      <Download size={16} />
                      Diff
                    </button>
                  </>
                )}
                <button
                  onClick={downloadCurrentResult}
                  className="btn btn-secondary"
                >
                  <Download size={16} />
                  JSON
                </button>
              </div>
            </div>

            {currentResult.error ? (
              <div className="error-details">
                <div className="error-message">
                  <AlertCircle size={20} />
                  <strong>Error:</strong> {currentResult.error}
                </div>
                {currentResult.errorDetails && (
                  <div className="error-suggestion">
                    <strong>Suggestion:</strong> {currentResult.errorDetails.suggestion}
                  </div>
                )}
              </div>
            ) : (
              <div className="success-details">
                {/* Metrics */}
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-value">{currentResult.metrics?.mismatchPercent}%</div>
                    <div className="metric-label">Mismatch</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{currentResult.metrics?.changedPixels?.toLocaleString()}</div>
                    <div className="metric-label">Changed Pixels</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{currentResult.metrics?.ssimScore}</div>
                    <div className="metric-label">SSIM Score</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{currentResult.metrics?.width} × {currentResult.metrics?.height}</div>
                    <div className="metric-label">Dimensions</div>
                  </div>
                </div>

                {/* Images */}
                {currentResult.images && (
                  <div className="comparison-images">
                    <div className="image-container">
                      <h4>Site A</h4>
                      <img
                        src={`data:image/png;base64,${currentResult.images.A}`}
                        alt="Site A Screenshot"
                        className="comparison-image"
                      />
                    </div>
                    <div className="image-container">
                      <h4>Site B</h4>
                      <img
                        src={`data:image/png;base64,${currentResult.images.B}`}
                        alt="Site B Screenshot"
                        className="comparison-image"
                      />
                    </div>
                    <div className="image-container">
                      <h4>Visual Diff</h4>
                      <img
                        src={`data:image/png;base64,${currentResult.images.diff}`}
                        alt="Visual Difference"
                        className="comparison-image"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="modal-footer">
          <div className="footer-actions">
            <button
              onClick={downloadAllResults}
              className="btn btn-secondary"
            >
              <Download size={16} />
              Download All Results
            </button>
            <button
              onClick={onNewComparison}
              className="btn btn-primary"
            >
              <RotateCcw size={16} />
              New Comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchResults;
