# Text Extraction Service

A service that extracts pure text content from any URL and generates a clean, professional PDF without any design elements, images, media, or HTML structure.

## 🎯 **What It Does**

**Input:** URL
**Output:** PDF showing all text from the specific domain (no subdirectories)

## ✨ **Features**

- ✅ **Pure Text Extraction**: Only text content, no HTML structure
- ✅ **No Media**: Ignores images, videos, audio, canvas, SVG
- ✅ **No Design Elements**: Ignores colors, styling, CSS
- ✅ **No HTML Attributes**: Ignores HTML tags, properties, structure
- ✅ **No Interactive Elements**: Ignores buttons, links, forms
- ✅ **Clean PDF Output**: Professional, readable format
- ✅ **Main Page Only**: No subdirectory crawling

## 🔧 **Technical Implementation**

### **Service Architecture**
- **Puppeteer**: Browser automation for content extraction
- **Stealth Plugin**: Avoids detection during scraping
- **PDF Generation**: Clean, professional document output
- **Content Filtering**: Smart element exclusion

### **Content Filtering Rules**
```javascript
// Skip these element types entirely:
- SCRIPT, STYLE, NOSCRIPT, IFRAME, EMBED, OBJECT
- BUTTON, A, INPUT, SELECT, TEXTAREA (interactive)
- IMG, VIDEO, AUDIO, CANVAS, SVG (media)
- Navigation, ads, banners, popups, modals
```

### **Text Extraction Process**
1. **Navigate**: Load the specified URL
2. **Stabilize**: Wait for content to load completely
3. **Scroll**: Load lazy content by scrolling
4. **Extract**: Parse DOM and extract pure text
5. **Filter**: Remove non-text elements
6. **Generate**: Create clean PDF with extracted content

## 🚀 **Usage**

### **Via Frontend**
1. Navigate to the "Text Extraction" tab
2. Enter the URL you want to extract text from
3. Set the output filename (optional)
4. Click "Start Text Extraction"
5. Download the generated PDF

### **Via API**
```bash
curl -X POST http://localhost:3001/api/extract-text \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "fileName": "extracted-text.pdf"
    }
  }'
```

### **Via Code**
```javascript
const TextExtractionService = require('./services/textExtractionService');

const service = new TextExtractionService();
await service.initialize();

const result = await service.extractTextFromURL('https://example.com', {
  fileName: 'output.pdf'
});

await service.cleanup();
```

## 📊 **Output Structure**

### **Generated Files**
```
extractions/
└── {extraction-id}/
    └── {filename}.pdf
```

### **API Response**
```json
{
  "id": "extraction-uuid",
  "url": "https://example.com",
  "pdfPath": "/path/to/output.pdf",
  "summary": {
    "url": "https://example.com",
    "extractionId": "uuid",
    "totalWords": 2416,
    "totalElements": 6,
    "duration": 7461,
    "outputPath": "/path/to/output.pdf",
    "title": "Page Title"
  },
  "metadata": {
    "extractedAt": "2025-08-19T14:37:00.000Z",
    "duration": 7461,
    "totalWords": 2416,
    "totalElements": 6
  }
}
```

## 🎨 **PDF Output Features**

### **Content Organization**
- **Header**: Page title, source URL, extraction details
- **Formatted Content**: Headings, paragraphs, lists, tables
- **Raw Text**: All extracted text in monospace format

### **Styling**
- **Typography**: Times New Roman, professional layout
- **Structure**: Clear headings, proper spacing
- **Format**: A4 size, clean margins
- **Readability**: Optimized for text consumption

## 🔍 **What Gets Extracted**

### **Included Content**
- ✅ **Headings**: H1-H6 with proper hierarchy
- ✅ **Paragraphs**: Text content from `<p>` elements
- ✅ **Lists**: Ordered and unordered list items
- ✅ **Tables**: Data in readable format
- ✅ **Text Blocks**: Substantial text content (>20 chars)

### **Excluded Content**
- ❌ **Images**: No image elements or alt text
- ❌ **Media**: No video, audio, canvas, SVG
- ❌ **Interactive**: No buttons, links, forms
- ❌ **Navigation**: No menus, headers, footers
- ❌ **Ads**: No advertisements or promotional content
- ❌ **HTML**: No tags, attributes, or structure

## 📈 **Performance**

### **Typical Results**
- **Small Pages**: 100-500 words, 2-5 seconds
- **Medium Pages**: 500-2000 words, 5-15 seconds
- **Large Pages**: 2000+ words, 15-30 seconds

### **Optimization Features**
- **Lazy Loading**: Scrolls to load dynamic content
- **Content Stabilization**: Waits for animations to complete
- **Smart Filtering**: Efficient element exclusion
- **Memory Management**: Proper cleanup and resource handling

## 🛠 **Installation & Setup**

### **Dependencies**
```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth fs-extra uuid
```

### **Chrome Installation**
```bash
npx puppeteer browsers install chrome
```

### **Service Initialization**
```javascript
const service = new TextExtractionService();
await service.initialize();
// ... use service
await service.cleanup();
```

## 🔒 **Security & Privacy**

### **Features**
- **Incognito Mode**: Clean browser context for each extraction
- **Stealth Mode**: Avoids detection and blocking
- **Resource Isolation**: No persistent data storage
- **Cleanup**: Automatic resource cleanup after each use

### **Best Practices**
- **Rate Limiting**: Implement delays between extractions
- **User Agent**: Rotating user agents to avoid detection
- **Error Handling**: Graceful failure with detailed logging
- **Validation**: URL validation and sanitization

## 🚨 **Error Handling**

### **Common Errors**
- **Invalid URL**: Malformed or unsupported URLs
- **Network Issues**: Connection timeouts or failures
- **Content Errors**: Pages that can't be loaded
- **Service Errors**: Browser or PDF generation failures

### **Error Response Format**
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "duration": 5000,
  "timestamp": "2025-08-19T14:37:00.000Z"
}
```

## 🔮 **Future Enhancements**

### **Planned Features**
- **Batch Processing**: Multiple URLs in one request
- **Content Analysis**: Word count, readability metrics
- **Format Options**: Different PDF styles and layouts
- **Language Detection**: Multi-language content support
- **Content Filtering**: Custom exclusion rules

### **Integration Possibilities**
- **Webhook Support**: Notify external services on completion
- **Storage Options**: Cloud storage for generated PDFs
- **Analytics**: Usage statistics and performance metrics
- **API Rate Limiting**: Configurable request limits

## 📝 **Examples**

### **Basic Text Extraction**
```javascript
const result = await service.extractTextFromURL('https://news.ycombinator.com');
// Generates PDF with pure text content from Hacker News
```

### **Custom Filename**
```javascript
const result = await service.extractTextFromURL('https://example.com', {
  fileName: 'my-extracted-content.pdf'
});
```

### **Error Handling**
```javascript
try {
  const result = await service.extractTextFromURL(url);
  console.log('Extraction successful:', result.summary.totalWords, 'words');
} catch (error) {
  console.error('Extraction failed:', error.message);
}
```

## 🤝 **Contributing**

### **Development Setup**
1. Clone the repository
2. Install dependencies: `npm install`
3. Install Chrome: `npx puppeteer browsers install chrome`
4. Run tests: `node demo-text-extraction.js`
5. Start development server: `npm run dev`

### **Testing**
- **Unit Tests**: Service functionality
- **Integration Tests**: API endpoints
- **Performance Tests**: Large page extraction
- **Error Tests**: Invalid URLs and edge cases

---

**Text Extraction Service** - Pure content, clean output, professional results! 🎉
