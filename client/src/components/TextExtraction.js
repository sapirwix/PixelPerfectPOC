import React, { useState } from 'react';
import './TextExtraction.css';

const TextExtraction = () => {
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('text-extraction.pdf');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'url') setUrl(value);
    if (name === 'fileName') setFileName(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          options: { fileName }
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('📊 Received data:', data); // Debug log
        
        // Validate data structure
        if (!data.extractionResult) {
          setError('Invalid response structure: missing extractionResult');
          return;
        }
        
        if (!Array.isArray(data.extractionResult.extractedElements)) {
          setError('Invalid response structure: missing extractedElements array');
          return;
        }
        
        setResults(data);
      } else {
        setError(data.error || 'Text extraction failed');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!results?.extractionResult?.extractedElements) {
      setError('No content to generate PDF from.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          options: {
            fileName: fileName,
            selectedElements: results.extractionResult.extractedElements
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.pdfBase64) {
          // Convert base64 to blob and download
          const pdfBlob = new Blob([Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0))], {
            type: 'application/pdf'
          });
          
          const downloadLink = document.createElement('a');
          downloadLink.href = URL.createObjectURL(pdfBlob);
          downloadLink.download = data.fileName || fileName;
          downloadLink.style.display = 'none';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(downloadLink.href);
          
          // Show success message
          alert(`PDF generated successfully! Downloading: ${data.fileName || fileName}`);
        } else {
          setError('PDF generated but content not found');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      setError('Failed to generate PDF: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setUrl('');
    setFileName('text-extraction.pdf');
    setResults(null);
    setError(null);
  };

  const renderContentPreview = () => {
    if (!results?.extractionResult?.extractedElements) return null;

    const elements = results.extractionResult.extractedElements;
    
    return (
      <div className="content-preview">
        <div className="content-preview-header">
          <h3>📄 Content Review - All Detected Text</h3>
          <p className="content-preview-subtitle">
            Text elements sorted by position on page (top to bottom, left to right)
          </p>
          <div className="content-stats">
            <span className="stat">
              <strong>Total Elements:</strong> {elements.length}
            </span>
            <span className="stat">
              <strong>Total Words:</strong> {results.extractionResult.totalWords}
            </span>
          </div>
        </div>

        <div className="content-elements">
          {elements.map((element, index) => (
            <div 
              key={element.id || index}
              className="content-element"
            >
              <div className="element-header">
                <div className="element-info">
                  <span className="element-tag">{element.tagName || 'TEXT'}</span>
                  <span className="element-words">{element.wordCount || 0} words</span>
                </div>
              </div>
              <div className="element-content">
                <div className="text-content">
                  <strong>Text:</strong>
                  <p>{element.text}</p>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="text-extraction">
      <div className="container">
        <div className="header">
          <h1>🔍 AI-Enhanced Text Extraction</h1>
          <p>Extract pure text content from any URL with AI analysis and manual selection</p>
        </div>

        <form onSubmit={handleSubmit} className="extraction-form">
          <div className="form-group">
            <label htmlFor="url">Website URL:</label>
            <input
              type="url"
              id="url"
              name="url"
              value={url}
              onChange={handleInputChange}
              placeholder="https://example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fileName">PDF Filename:</label>
            <input
              type="text"
              id="fileName"
              name="fileName"
              value={fileName}
              onChange={handleInputChange}
              placeholder="extracted-text.pdf"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? '🔄 Extracting...' : '🚀 Extract Text'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {results && (
          <div className="results-section">
            <h2>📊 Extraction Results</h2>
            
            <div className="stats-grid horizontal">
              <div className="stat-item">
                <span className="stat-label">Total Elements</span>
                <span className="stat-value">{results.extractionResult?.extractedElements?.length || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Words</span>
                <span className="stat-value">{results.extractionResult?.totalWords || 0}</span>
              </div>
            </div>

            <div className="content-preview">
              <h3>📝 Content Preview</h3>
              <div className="content-elements">
                {results.extractionResult?.extractedElements?.map((element, index) => (
                  <div 
                    key={element.id || index}
                    className="content-element"
                  >
                    <div className="element-header">
                      <div className="element-info">
                        <span className="element-tag">{element.tagName || 'TEXT'}</span>
                        <span className="element-words">{element.wordCount || 0} words</span>
                      </div>
                    </div>
                    <div className="element-content">
                      <div className="text-content">
                        <strong>Text:</strong>
                        <p>{element.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pdf-generation">
              <h3>📄 Generate PDF</h3>
              <p>Generate a PDF with all extracted content</p>
              <button 
                onClick={handleGeneratePDF}
                className="btn btn-success"
                disabled={!results.extractionResult?.extractedElements?.length}
              >
                📥 Download PDF
              </button>
            </div>
          </div>
        )}

        <button 
          onClick={resetForm}
          className="btn btn-secondary reset-btn"
          style={{ marginTop: '20px' }}
        >
          🔄 Reset Form
        </button>
      </div>
    </div>
  );
};

export default TextExtraction;
