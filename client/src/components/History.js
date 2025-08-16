import React, { useState, useEffect } from 'react';
import { Clock, Download, Eye, Trash2, Calendar, Link, BarChart3 } from 'lucide-react';
import './History.css';

const History = ({ onViewComparison, onDeleteComparison }) => {
  const [comparisons, setComparisons] = useState([]);
  const [filteredComparisons, setFilteredComparisons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedComparison, setSelectedComparison] = useState(null);

  useEffect(() => {
    loadComparisons();
  }, []);

  useEffect(() => {
    filterAndSortComparisons();
  }, [comparisons, searchTerm, sortBy, sortOrder]);

  const loadComparisons = () => {
    const saved = localStorage.getItem('comparisonHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setComparisons(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse comparison history:', e);
        setComparisons([]);
      }
    }
  };

  const filterAndSortComparisons = () => {
    let filtered = comparisons.filter(comp => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        comp.urls.A.toLowerCase().includes(searchLower) ||
        comp.urls.B.toLowerCase().includes(searchLower) ||
        comp.id.toLowerCase().includes(searchLower)
      );
    });

    // Sort comparisons
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.metadata.A.timestamp);
          bValue = new Date(b.metadata.A.timestamp);
          break;
        case 'mismatch':
          aValue = a.metrics.mismatchPercent;
          bValue = b.metrics.mismatchPercent;
          break;
        case 'urls':
          aValue = a.urls.A + a.urls.B;
          bValue = b.urls.A + b.urls.B;
          break;
        default:
          aValue = a[sortBy];
          bValue = b[sortBy];
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredComparisons(filtered);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this comparison?')) {
      const updated = comparisons.filter(comp => comp.id !== id);
      setComparisons(updated);
      localStorage.setItem('comparisonHistory', JSON.stringify(updated));
      
      if (onDeleteComparison) {
        onDeleteComparison(id);
      }
    }
  };

  const handleView = (comparison) => {
    setSelectedComparison(comparison);
  };

  const handleCloseView = () => {
    setSelectedComparison(null);
  };

  const downloadComparison = (comparison) => {
    const dataStr = JSON.stringify(comparison, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `comparison-${comparison.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getMismatchColor = (percentage) => {
    if (percentage < 5) return 'var(--success-color)';
    if (percentage < 20) return 'var(--warning-color)';
    return 'var(--error-color)';
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all comparison history? This cannot be undone.')) {
      setComparisons([]);
      localStorage.removeItem('comparisonHistory');
    }
  };

  return (
    <div className="history-page">
      <div className="history-header">
        <h1><Clock size={32} /> Comparison History</h1>
        <p>View and manage your previous website comparisons</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="history-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by URL or comparison ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="sort-controls">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="timestamp">Date & Time</option>
            <option value="mismatch">Mismatch %</option>
            <option value="urls">URLs</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order-btn"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <button onClick={clearHistory} className="clear-history-btn">
          <Trash2 size={16} />
          Clear All
        </button>
      </div>

      {/* Results Count */}
      <div className="results-count">
        Showing {filteredComparisons.length} of {comparisons.length} comparisons
      </div>

      {/* Comparisons List */}
      {filteredComparisons.length === 0 ? (
        <div className="empty-state">
          <Clock size={64} />
          <h3>No comparisons yet</h3>
          <p>Start comparing websites to see your history here</p>
        </div>
      ) : (
        <div className="comparisons-list">
          {filteredComparisons.map((comparison) => (
            <div key={comparison.id} className="comparison-card">
              <div className="comparison-header">
                <div className="comparison-id">
                  <span className="id-label">ID:</span>
                  <span className="id-value">{comparison.id.slice(0, 8)}...</span>
                </div>
                <div className="comparison-date">
                  <Calendar size={14} />
                  {formatDate(comparison.metadata.A.timestamp)}
                </div>
              </div>

              <div className="comparison-urls">
                <div className="url-item">
                  <span className="url-label">Site A:</span>
                  <span className="url-value" title={comparison.urls.A}>
                    {comparison.urls.A.length > 50 
                      ? comparison.urls.A.substring(0, 50) + '...' 
                      : comparison.urls.A}
                  </span>
                </div>
                <div className="url-item">
                  <span className="url-label">Site B:</span>
                  <span className="url-value" title={comparison.urls.B}>
                    {comparison.urls.B.length > 50 
                      ? comparison.urls.B.substring(0, 50) + '...' 
                      : comparison.urls.B}
                  </span>
                </div>
              </div>

              <div className="comparison-metrics">
                <div className="metric-item">
                  <BarChart3 size={16} />
                  <span className="metric-label">Mismatch:</span>
                  <span 
                    className="metric-value"
                    style={{ color: getMismatchColor(comparison.metrics.mismatchPercent) }}
                  >
                    {comparison.metrics.mismatchPercent}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Changed Pixels:</span>
                  <span className="metric-value">
                    {comparison.metrics.changedPixels.toLocaleString()}
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">SSIM:</span>
                  <span className="metric-value">
                    {comparison.metrics.ssimScore}
                  </span>
                </div>
              </div>

              <div className="comparison-actions">
                <button
                  onClick={() => handleView(comparison)}
                  className="action-btn view-btn"
                  title="View Details"
                >
                  <Eye size={16} />
                  View
                </button>
                <button
                  onClick={() => downloadComparison(comparison)}
                  className="action-btn download-btn"
                  title="Download Results"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(comparison.id)}
                  className="action-btn delete-btn"
                  title="Delete Comparison"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Detail Modal */}
      {selectedComparison && (
        <div className="modal-overlay" onClick={handleCloseView}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Comparison Details</h2>
              <button onClick={handleCloseView} className="modal-close">×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h3>URLs</h3>
                <div className="detail-urls">
                  <div><strong>Site A:</strong> {selectedComparison.urls.A}</div>
                  <div><strong>Site B:</strong> {selectedComparison.urls.B}</div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Metrics</h3>
                <div className="detail-metrics">
                  <div><strong>Mismatch:</strong> {selectedComparison.metrics.mismatchPercent}%</div>
                  <div><strong>Changed Pixels:</strong> {selectedComparison.metrics.changedPixels.toLocaleString()}</div>
                  <div><strong>SSIM Score:</strong> {selectedComparison.metrics.ssimScore}</div>
                  <div><strong>Dimensions:</strong> {selectedComparison.metrics.width} × {selectedComparison.metrics.height}</div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Metadata</h3>
                <div className="detail-metadata">
                  <div><strong>Comparison ID:</strong> {selectedComparison.id}</div>
                  <div><strong>Completed:</strong> {formatDate(selectedComparison.metadata.A.timestamp)}</div>
                  <div><strong>Threshold:</strong> {selectedComparison.metrics.threshold}</div>
                  <div><strong>Anti-aliasing:</strong> {selectedComparison.metrics.includeAA ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>

              <div className="detail-actions">
                <button
                  onClick={() => downloadComparison(selectedComparison)}
                  className="btn btn-primary"
                >
                  <Download size={16} />
                  Download Full Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
