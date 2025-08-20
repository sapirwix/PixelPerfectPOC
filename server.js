const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const ScreenshotService = require('./services/screenshotService');
const TextExtractionService = require('./services/textExtractionService');
const fs = require('fs'); // Added for PDF download

const app = express();
const PORT = process.env.PORT || 3001;

// Global service instances
let screenshotService = null;
let textExtractionService = null;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow base64 images
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from React build (in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
}

// Initialize services
async function initializeServices() {
  try {
    // Initialize screenshot service
    screenshotService = new ScreenshotService();
    await screenshotService.initialize();
    console.log('Screenshot service initialized successfully');
    
    // Initialize text extraction service
    textExtractionService = new TextExtractionService();
    await textExtractionService.initialize();
    console.log('Text extraction service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Utility function to validate URLs
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: screenshotService ? 'initialized' : 'not initialized'
  });
});

// Main comparison endpoint
app.post('/api/compare-ui', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { urlA, urlB, options = {} } = req.body;

    // Validation
    if (!urlA || !urlB) {
      return res.status(400).json({
        error: 'Both urlA and urlB are required',
        code: 'MISSING_URLS'
      });
    }

    if (!isValidUrl(urlA)) {
      return res.status(400).json({
        error: `Invalid URL A: ${urlA}`,
        code: 'INVALID_URL_A'
      });
    }

    if (!isValidUrl(urlB)) {
      return res.status(400).json({
        error: `Invalid URL B: ${urlB}`,
        code: 'INVALID_URL_B'
      });
    }

    if (!screenshotService) {
      return res.status(503).json({
        error: 'Screenshot service not initialized',
        code: 'SERVICE_NOT_READY'
      });
    }

    // Merge options with defaults
    const comparisonOptions = {
      waitFor: options.waitFor || 'networkidle',
      fullPage: options.fullPage !== false,
      maskSelectors: options.maskSelectors || [
        '.cookie', '#cookie', '.banner', '.ads', 
        '[data-testid="cookie"]', '.popup', '.modal',
        '.notification', '.alert'
      ],
      diffThreshold: Math.min(Math.max(options.diffThreshold || 0.1, 0), 1),
      includeAA: options.includeAA !== false,
      timeout: Math.min(options.timeout || 45000, 120000), // Max 2 minutes
      stabilizationDelay: Math.min(options.stabilizationDelay || 1000, 5000)
    };

    console.log(`Starting comparison: ${urlA} vs ${urlB}`);
    console.log('Options:', comparisonOptions);

    // Perform comparison
    const result = await screenshotService.comparePages(urlA, urlB, comparisonOptions);

    const duration = Date.now() - startTime;
    console.log(`Comparison completed in ${duration}ms`);

    // Add performance metadata
    result.performance = {
      duration,
      timestamp: new Date().toISOString()
    };

    res.json(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Comparison failed:', error);

    // Determine error type and status code
    let statusCode = 500;
    let errorCode = 'COMPARISON_FAILED';

    if (error.message.includes('net::')) {
      statusCode = 400;
      errorCode = 'NETWORK_ERROR';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message.includes('Navigation failed')) {
      statusCode = 400;
      errorCode = 'NAVIGATION_ERROR';
    }

    res.status(statusCode).json({
      error: error.message,
      code: errorCode,
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// Advanced comparison endpoint with multiple viewports
app.post('/api/compare-multi', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { urlA, urlB, viewports, options = {} } = req.body;

    if (!urlA || !urlB) {
      return res.status(400).json({
        error: 'Both urlA and urlB are required',
        code: 'MISSING_URLS'
      });
    }

    if (!isValidUrl(urlA) || !isValidUrl(urlB)) {
      return res.status(400).json({
        error: 'Invalid URLs provided',
        code: 'INVALID_URLS'
      });
    }

    if (!screenshotService) {
      return res.status(503).json({
        error: 'Screenshot service not initialized',
        code: 'SERVICE_NOT_READY'
      });
    }

    // Default viewports if none provided
    const defaultViewports = [
      { name: 'Desktop', width: 1440, height: 900, dpr: 1 },
      { name: 'Tablet', width: 768, height: 1024, dpr: 2 },
      { name: 'Mobile', width: 390, height: 844, dpr: 3 }
    ];

    const targetViewports = viewports || defaultViewports;
    const results = [];

    console.log(`Starting multi-viewport comparison: ${urlA} vs ${urlB}`);

    // Process each viewport
    for (const viewport of targetViewports) {
      try {
        // Update context for this viewport
        await screenshotService.cleanup();
        screenshotService = new ScreenshotService();
        await screenshotService.initialize();

        // Update viewport settings
        try {
          await screenshotService.setViewport(viewport.width, viewport.height);
        } catch (viewportError) {
          console.error(`Failed to set viewport ${viewport.name}:`, viewportError);
          results.push({
            viewport: viewport,
            error: `Viewport configuration failed: ${viewportError.message}`,
            failed: true
          });
          continue;
        }

        const result = await screenshotService.comparePages(urlA, urlB, {
          ...options,
          viewport: viewport
        });

        result.viewport = viewport;
        results.push(result);

        console.log(`Completed ${viewport.name} viewport`);

      } catch (viewportError) {
        console.error(`Failed for viewport ${viewport.name}:`, viewportError);
        results.push({
          viewport: viewport,
          error: viewportError.message,
          failed: true
        });
      }
    }

    const duration = Date.now() - startTime;

    res.json({
      urlA,
      urlB,
      results,
      summary: {
        total: targetViewports.length,
        successful: results.filter(r => !r.failed).length,
        failed: results.filter(r => r.failed).length,
        avgMismatch: results
          .filter(r => !r.failed && r.metrics)
          .reduce((acc, r, _, arr) => acc + (r.metrics.mismatchPercent / arr.length), 0)
      },
      performance: {
        duration,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Multi-viewport comparison failed:', error);

    res.status(500).json({
      error: error.message,
      code: 'MULTI_COMPARISON_FAILED',
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// Get comparison options/capabilities
app.get('/api/options', (req, res) => {
  res.json({
    defaultOptions: {
      waitFor: 'networkidle',
      fullPage: true,
      diffThreshold: 0.1,
      includeAA: true,
      timeout: 45000,
      stabilizationDelay: 1000
    },
    waitStrategies: ['networkidle', 'css:selector'],
    maxTimeout: 120000,
    supportedFormats: ['png'],
    defaultMaskSelectors: [
      '.cookie', '#cookie', '.banner', '.ads',
      '[data-testid="cookie"]', '.popup', '.modal',
      '.notification', '.alert'
    ],
    viewportPresets: [
      { name: 'Desktop', width: 1440, height: 900, dpr: 1 },
      { name: 'Desktop Large', width: 1920, height: 1080, dpr: 1 },
      { name: 'Tablet', width: 768, height: 1024, dpr: 2 },
      { name: 'Mobile', width: 390, height: 844, dpr: 3 },
      { name: 'Mobile Small', width: 320, height: 568, dpr: 2 }
    ]
  });
});

// Text extraction endpoint
app.post('/api/extract-text', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { url, options = {} } = req.body;

    // Validation
    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        code: 'MISSING_URL'
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        error: `Invalid URL: ${url}`,
        code: 'INVALID_URL'
      });
    }

    if (!textExtractionService) {
      return res.status(503).json({
        error: 'Text extraction service not initialized',
        code: 'SERVICE_NOT_READY'
      });
    }

    console.log(`Text extraction request for: ${url}`);
    
    const result = await textExtractionService.extractTextFromURL(url, options);
    
    const duration = Date.now() - startTime;
    
    res.json({
      ...result,
      performance: {
        duration,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Text extraction failed:', error);

    res.status(500).json({
      error: error.message,
      code: 'TEXT_EXTRACTION_FAILED',
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// PDF download endpoint
app.get('/api/download-pdf', (req, res) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return res.status(400).json({
        error: 'File path is required',
        code: 'MISSING_FILE'
      });
    }

    // Security check: ensure the file is within the output directory
    const outputDir = path.join(__dirname, 'output', 'text-extraction');
    const requestedPath = path.resolve(file);
    const normalizedOutputDir = path.resolve(outputDir);
    
    console.log('Download request:', { file, requestedPath, normalizedOutputDir });
    
    if (!requestedPath.startsWith(normalizedOutputDir)) {
      return res.status(403).json({
        error: 'Access denied - file outside output directory',
        code: 'ACCESS_DENIED'
      });
    }

    // Check if file exists
    if (!fs.existsSync(requestedPath)) {
      return res.status(404).json({
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(requestedPath)}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(requestedPath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('PDF download failed:', error);
    res.status(500).json({
      error: 'Failed to download PDF',
      code: 'DOWNLOAD_FAILED'
    });
  }
});

// Serve React app (in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Determine error type and provide appropriate response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let userMessage = 'An unexpected error occurred';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    userMessage = err.message;
  } else if (err.name === 'TimeoutError') {
    statusCode = 408;
    errorCode = 'TIMEOUT_ERROR';
    userMessage = 'The operation timed out. Please try again.';
  } else if (err.message.includes('Network Error')) {
    statusCode = 400;
    errorCode = 'NETWORK_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('DNS Error')) {
    statusCode = 400;
    errorCode = 'DNS_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('SSL/TLS error')) {
    statusCode = 400;
    errorCode = 'SSL_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('Timeout Error')) {
    statusCode = 408;
    errorCode = 'TIMEOUT_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('Content Error')) {
    statusCode = 400;
    errorCode = 'CONTENT_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('Stability Error')) {
    statusCode = 500;
    errorCode = 'STABILITY_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('Capture Error')) {
    statusCode = 500;
    errorCode = 'CAPTURE_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('Image processing failed')) {
    statusCode = 500;
    errorCode = 'IMAGE_PROCESSING_ERROR';
    userMessage = err.message;
  } else if (err.message.includes('Image comparison failed')) {
    statusCode = 500;
    errorCode = 'COMPARISON_ERROR';
    userMessage = err.message;
  }

  res.status(statusCode).json({
    error: userMessage,
    code: errorCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      originalError: err.message 
    })
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /api/health',
      'POST /api/compare-ui',
      'POST /api/compare-multi',
      'GET /api/options',
      'POST /api/extract-text'
    ]
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (screenshotService) {
    await screenshotService.cleanup();
  }
  if (textExtractionService) {
    await textExtractionService.cleanup();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (screenshotService) {
    await screenshotService.cleanup();
  }
  if (textExtractionService) {
    await textExtractionService.cleanup();
  }
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Pixel Perfect POC Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔍 Compare API: POST http://localhost:${PORT}/api/compare-ui`);
      console.log(`📄 Text Extraction API: POST http://localhost:${PORT}/api/extract-text`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🌐 Frontend dev server should run on http://localhost:3000`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
