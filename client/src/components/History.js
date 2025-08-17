import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Trash2, Eye, Calendar, BarChart3, Globe, FileText, Users } from 'lucide-react';
import './History.css';

const History = ({ onDeleteComparison }) => {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedComparison, setSelectedComparison] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem('comparisonHistory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const saveHistory = (newHistory) => {
    try {
      localStorage.setItem('comparisonHistory', JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const deleteComparison = (id) => {
    const newHistory = history.filter(item => item.id !== id);
    saveHistory(newHistory);
    if (onDeleteComparison) {
      onDeleteComparison(id);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all comparison history? This action cannot be undone.')) {
      localStorage.removeItem('comparisonHistory');
      setHistory([]);
      setSelectedComparison(null);
      setShowModal(false);
    }
  };

  const downloadComparison = (comparison) => {
    if (!comparison || comparison.error) return;
    
    const dataStr = JSON.stringify(comparison, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `comparison-${comparison.id || Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImage = (base64Data, filename) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openComparison = (comparison) => {
    setSelectedComparison(comparison);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedComparison(null);
  };

  // Filter and sort history
  const filteredHistory = history
    .filter(item => {
      // Search filter
      const searchMatch = !searchTerm || 
        item.urls?.A?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.urls?.B?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.urlA && item.urlA.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.urlB && item.urlB.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Status filter
      let statusMatch = true;
      if (filterStatus === 'success') {
        statusMatch = !item.error;
      } else if (filterStatus === 'error') {
        statusMatch = !!item.error;
      }
      
      return searchMatch && statusMatch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.metadata?.A?.timestamp || a.timestamp || 0);
          const dateB = new Date(b.metadata?.B?.timestamp || b.timestamp || 0);
          return dateB - dateA;
        case 'mismatch':
          if (a.error || b.error) return 0;
          return (b.metrics?.mismatchPercent || 0) - (a.metrics?.mismatchPercent || 0);
        case 'urls':
          const urlA = (a.urls?.A || a.urlA || '').toLowerCase();
          const urlB = (b.urls?.B || b.urlB || '').toLowerCase();
          return urlA.localeCompare(urlB);
        default:
          return 0;
      }
    });

  const getStatusIcon = (item) => {
    if (item.error) {
      return <div className="status-icon error" title="Failed">⚠️</div>;
    }
    return <div className="status-icon success" title="Successful">✓</div>;
  };

  const getStatusText = (item) => {
    if (item.error) {
      return 'Failed';
    }
    return 'Successful';
  };

  const getStatusClass = (item) => {
    if (item.error) {
      return 'status-failed';
    }
    return 'status-success';
  };

  const getUrlA = (item) => {
    return item.urls?.A || item.urlA || 'N/A';
  };

  const getUrlB = (item) => {
    return item.urls?.B || item.urlB || 'N/A';
  };

  const getTimestamp = (item) => {
    const timestamp = item.metadata?.A?.timestamp || item.timestamp;
    if (timestamp) {
      return new Date(timestamp).toLocaleString();
    }
    return 'Unknown';
  };

  const getMismatchPercent = (item) => {
    if (item.error || !item.metrics) return 'N/A';
    return `${item.metrics.mismatchPercent}%`;
  };

  const getChangedPixels = (item) => {
    if (item.error || !item.metrics) return 'N/A';
    return item.metrics.changedPixels?.toLocaleString() || 'N/A';
  };

  const isBatchResult = (item) => {
    return item.batchIndex !== undefined;
  };

  const getBatchInfo = (item) => {
    if (!isBatchResult(item)) return null;
    return {
      batchIndex: item.batchIndex,
      originalData: item.originalData
    };
  };

  return (
    <div className="history-page">
      <header className="history-header">
        <div className="container">
          <h1><FileText size={48} /> Comparison History</h1>
          <p>View and manage your previous website comparisons</p>
        </div>
      </header>

      <main className="history-content">
        <div className="container">
          {/* Controls */}
          <div className="history-controls">
            <div className="search-section">
              <div className="search-input">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search by URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-group">
                <label htmlFor="sortBy">Sort by:</label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date">Date (Newest)</option>
                  <option value="mismatch">Mismatch % (High to Low)</option>
                  <option value="urls">URLs (A-Z)</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filterStatus">Status:</label>
                <select
                  id="filterStatus"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Results</option>
                  <option value="success">Successful</option>
                  <option value="error">Failed</option>
                </select>
              </div>

              <button
                onClick={clearHistory}
                className="btn btn-danger"
                title="Clear all history"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            </div>
          </div>

          {/* Results Count */}
          <div className="results-count">
            <span>
              Showing {filteredHistory.length} of {history.length} comparisons
            </span>
            {filteredHistory.length !== history.length && (
              <span className="filtered-note">
                (filtered results)
              </span>
            )}
          </div>

          {/* History List */}
          {filteredHistory.length === 0 ? (
            <div className="empty-history">
              <FileText size={64} />
              <h3>No comparisons found</h3>
              <p>
                {history.length === 0 
                  ? "You haven't made any comparisons yet. Start comparing websites to see your history here."
                  : "No comparisons match your current search and filter criteria. Try adjusting your filters."
                }
              </p>
            </div>
          ) : (
            <div className="history-list">
              {filteredHistory.map((item, index) => {
                const batchInfo = getBatchInfo(item);
                
                return (
                  <div
                    key={item.id || index}
                    className={`history-item ${getStatusClass(item)}`}
                  >
                    <div className="item-header">
                      <div className="item-status">
                        {getStatusIcon(item)}
                        <span className="status-text">{getStatusText(item)}</span>
                        {batchInfo && (
                          <span className="batch-badge" title="Imported from CSV">
                            <Users size={12} />
                            Batch #{batchInfo.batchIndex + 1}
                          </span>
                        )}
                      </div>
                      
                      <div className="item-actions">
                        <button
                          onClick={() => openComparison(item)}
                          className="btn btn-secondary"
                          title="View details"
                        >
                          <Eye size={16} />
                          View
                        </button>
                        <button
                          onClick={() => downloadComparison(item)}
                          className="btn btn-secondary"
                          title="Download JSON"
                          disabled={!!item.error}
                        >
                          <Download size={16} />
                          JSON
                        </button>
                        <button
                          onClick={() => deleteComparison(item.id)}
                          className="btn btn-danger"
                          title="Delete comparison"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="item-content">
                      <div className="urls-section">
                        <div className="url-item">
                          <span className="url-label">Original Site:</span>
                          <span className="url-value" title={getUrlA(item)}>
                            {getUrlA(item).length > 50 
                              ? getUrlA(item).substring(0, 50) + '...' 
                              : getUrlA(item)}
                          </span>
                        </div>
                        <div className="url-item">
                          <span className="url-label">Migrated Site:</span>
                          <span className="url-value" title={getUrlB(item)}>
                            {getUrlB(item).length > 50 
                              ? getUrlB(item).substring(0, 50) + '...' 
                              : getUrlB(item)}
                          </span>
                        </div>
                      </div>

                      <div className="metrics-section">
                        <div className="metric">
                          <Calendar size={16} />
                          <span>{getTimestamp(item)}</span>
                        </div>
                        {!item.error && (
                          <>
                            <div className="metric">
                              <BarChart3 size={16} />
                              <span>{getMismatchPercent(item)} mismatch</span>
                            </div>
                            <div className="metric">
                              <Globe size={16} />
                              <span>{getChangedPixels(item)} pixels changed</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Comparison Detail Modal */}
      {showModal && selectedComparison && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Comparison Details</h2>
              <button onClick={closeModal} className="close-btn">×</button>
            </div>

            <div className="modal-body">
              {selectedComparison.error ? (
                <div className="error-details">
                  <div className="error-message">
                    <strong>Error:</strong> {selectedComparison.error}
                  </div>
                  {selectedComparison.errorDetails?.suggestion && (
                    <div className="error-suggestion">
                      <strong>Suggestion:</strong> {selectedComparison.errorDetails.suggestion}
                    </div>
                  )}
                </div>
              ) : (
                <div className="comparison-details">
                  {/* URLs */}
                  <div className="detail-section">
                    <h3>URLs Compared</h3>
                    <div className="url-details">
                      <div className="url-detail">
                        <strong>Original Site:</strong> {getUrlA(selectedComparison)}
                      </div>
                      <div className="url-detail">
                        <strong>Migrated Site:</strong> {getUrlB(selectedComparison)}
                      </div>
                    </div>
                  </div>

                  {/* Batch Info */}
                  {getBatchInfo(selectedComparison) && (
                    <div className="detail-section">
                      <h3>Batch Information</h3>
                      <div className="batch-details">
                        <div className="batch-detail">
                          <strong>Batch Position:</strong> #{getBatchInfo(selectedComparison).batchIndex + 1}
                        </div>
                        {getBatchInfo(selectedComparison).originalData && (
                          <div className="batch-detail">
                            <strong>Original Data:</strong> {JSON.stringify(getBatchInfo(selectedComparison).originalData)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metrics */}
                  {selectedComparison.metrics && (
                    <div className="detail-section">
                      <h3>Comparison Metrics</h3>
                      <div className="metrics-grid">
                        <div className="metric-card">
                          <div className="metric-value">{selectedComparison.metrics.mismatchPercent}%</div>
                          <div className="metric-label">Mismatch</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-value">{selectedComparison.metrics.changedPixels?.toLocaleString()}</div>
                          <div className="metric-label">Changed Pixels</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-value">{selectedComparison.metrics.ssimScore}</div>
                          <div className="metric-label">SSIM Score</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-value">{selectedComparison.metrics.width} × {selectedComparison.metrics.height}</div>
                          <div className="metric-label">Dimensions</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {selectedComparison.images && (
                    <div className="detail-section">
                      <h3>Screenshots</h3>
                      <div className="images-grid">
                        <div className="image-item">
                                              <h4>Original Site</h4>
                    <img
                      src={`data:image/png;base64,${selectedComparison.images.A}`}
                      alt="Original Site Screenshot"
                      className="detail-image"
                    />
                          <button
                            onClick={() => downloadImage(selectedComparison.images.A, 'site-a.png')}
                            className="btn btn-secondary"
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </div>
                        <div className="image-item">
                          <h4>Site B</h4>
                          <img
                            src={`data:image/png;base64,${selectedComparison.images.B}`}
                            alt="Site B Screenshot"
                            className="detail-image"
                          />
                          <button
                            onClick={() => downloadImage(selectedComparison.images.B, 'site-b.png')}
                            className="btn btn-secondary"
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </div>
                        <div className="image-item">
                          <h4>Visual Diff</h4>
                          <img
                            src={`data:image/png;base64,${selectedComparison.images.diff}`}
                            alt="Visual Difference"
                            className="detail-image"
                          />
                          <button
                            onClick={() => downloadImage(selectedComparison.images.diff, 'diff.png')}
                            className="btn btn-secondary"
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="detail-section">
                    <h3>Additional Information</h3>
                    <div className="metadata-grid">
                      <div className="metadata-item">
                        <strong>Comparison ID:</strong> {selectedComparison.id || 'N/A'}
                      </div>
                      <div className="metadata-item">
                        <strong>Completed:</strong> {getTimestamp(selectedComparison)}
                      </div>
                      {selectedComparison.metrics && (
                        <>
                          <div className="metadata-item">
                            <strong>Threshold:</strong> {selectedComparison.metrics.threshold || 'N/A'}
                          </div>
                          <div className="metadata-item">
                            <strong>Anti-aliasing:</strong> {selectedComparison.metrics.includeAA ? 'Enabled' : 'Disabled'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={closeModal} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
