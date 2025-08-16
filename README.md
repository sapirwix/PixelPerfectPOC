# Pixel Perfect POC - Visual UI Comparison Tool

A powerful web application for comparing visual differences between two websites using Playwright and pixelmatch. Perfect for UI testing, design validation, and regression testing.

## 🚀 Features

- **Side-by-side Screenshot Comparison**: Capture and compare screenshots from two different URLs
- **Visual Diff Generation**: Generate diff images highlighting differences between screenshots
- **Multi-viewport Support**: Compare across different device sizes and resolutions
- **Advanced Stabilization**: Freeze animations, mask dynamic elements, and ensure consistent captures
- **Configurable Options**: Adjust diff sensitivity, wait strategies, and masking selectors
- **Modern Web UI**: Beautiful React frontend with real-time progress tracking
- **Download Results**: Export screenshots and comparison data for further analysis

## 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **Browser Automation**: Playwright
- **Image Processing**: pixelmatch + pngjs
- **Frontend**: React + Modern CSS
- **Styling**: CSS Variables + Responsive Design

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn
- Modern web browser

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3. Start the Application

```bash
# Start both backend and frontend (development)
npm run dev

# Or start them separately:
npm run server:dev    # Backend on port 3001
npm run client:dev    # Frontend on port 3000
```

### 4. Open Your Browser

Navigate to `http://localhost:3000` to use the application.

## 🧪 Testing

Test the screenshot service independently:

```bash
npm test
```

This will run a comparison between two test URLs to verify everything is working.

## 📖 Usage

### Basic Comparison

1. Enter two URLs you want to compare
2. Choose basic options (full page capture, anti-aliasing)
3. Click "Start Comparison"
4. View results with side-by-side screenshots and diff image

### Advanced Options

- **Diff Threshold**: Adjust sensitivity for detecting changes (0.1 = 10%)
- **Wait Strategy**: Choose between network idle or waiting for specific CSS selectors
- **Mask Selectors**: Hide dynamic elements like cookie banners, ads, or popups
- **Full Page**: Toggle between viewport-only and full-page screenshots

### Understanding Results

- **Mismatch Percentage**: Percentage of pixels that differ between images
- **Changed Pixels**: Total number of pixels that changed
- **SSIM Score**: Structural similarity index (higher = more similar)
- **Visual Diff**: Red pixels indicate detected differences

## 🔧 Configuration

### Environment Variables

```bash
PORT=3001                    # Backend server port
NODE_ENV=production         # Environment mode
```

### API Endpoints

- `POST /api/compare-ui` - Basic comparison
- `POST /api/compare-multi` - Multi-viewport comparison
- `GET /api/options` - Available configuration options
- `GET /api/health` - Health check

### Request Body Example

```json
{
  "urlA": "https://example.com",
  "urlB": "https://example2.com",
  "options": {
    "fullPage": true,
    "diffThreshold": 0.1,
    "includeAA": true,
    "waitFor": "networkidle",
    "maskSelectors": [".cookie", "#banner", ".ads"]
  }
}
```

## 🎯 Use Cases

- **Design Validation**: Compare design iterations
- **Regression Testing**: Detect unintended UI changes
- **Cross-browser Testing**: Compare rendering across different browsers
- **A/B Testing**: Visual comparison of different versions
- **Quality Assurance**: Ensure consistent UI across environments

## 🚨 Troubleshooting

### Common Issues

1. **Playwright Installation Failed**
   ```bash
   npx playwright install --force
   ```

2. **Screenshot Capture Fails**
   - Check if URLs are accessible
   - Verify network connectivity
   - Try increasing timeout values

3. **High Mismatch Percentages**
   - Adjust diff threshold
   - Add more mask selectors for dynamic elements
   - Check if sites have time-based content

### Performance Tips

- Use `fullPage: false` for faster comparisons
- Set appropriate `diffThreshold` values
- Limit viewport sizes for large comparisons
- Use `networkidle` wait strategy for most cases

## 🔒 Security Considerations

- The application can access any publicly accessible URL
- Screenshots are processed in memory and not permanently stored
- Consider implementing rate limiting for production use
- Validate URLs to prevent SSRF attacks

## 📁 Project Structure

```
pixelPerfectPOC/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.js         # Main application component
│   │   ├── App.css        # Component styles
│   │   ├── index.js       # Entry point
│   │   └── index.css      # Global styles
│   └── public/
│       └── index.html     # HTML template
├── services/
│   └── screenshotService.js # Core screenshot and comparison logic
├── server.js              # Express server and API endpoints
├── test-compare.js        # Test script
├── package.json           # Backend dependencies
└── README.md              # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) for browser automation
- [pixelmatch](https://github.com/mapbox/pixelmatch) for image comparison
- [React](https://reactjs.org/) for the frontend framework

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

---

**Note**: This is a proof-of-concept application. For production use, consider adding authentication, rate limiting, and additional security measures.
