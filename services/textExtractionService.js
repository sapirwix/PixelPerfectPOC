const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

class TextExtractionService {
  constructor() {
    this.browser = null;
    this.openai = null;
    this.outputDir = path.join(__dirname, '..', 'output', 'text-extraction');
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Text Extraction Service...');
      
      // Create output directory
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      
      // Launch browser with better timeout settings
      const executablePath = this.getChromeExecutablePath();
      console.log(`🔍 Using Chrome executable: ${executablePath}`);
      
      this.browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        timeout: 120000, // 2 minutes
        protocolTimeout: 120000 // 2 minutes
      });
      
      console.log('✅ Browser launched successfully');
      
      // Initialize OpenAI if API key is available
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI API initialized');
      } else {
        console.log('⚠️ OpenAI API key not found, AI features will be disabled');
      }
      
      console.log('✅ Text Extraction Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Text Extraction Service:', error);
      throw error;
    }
  }

  getChromeExecutablePath() {
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
    
    return null;
  }

  async extractTextFromURL(url, options = {}) {
    const startTime = Date.now();
    let page = null;
    
    try {
      console.log(`🌐 Starting text extraction from: ${url}`);
      
      // Create a new page with timeout settings
      page = await this.browser.newPage();
      
      // Set page timeouts
      page.setDefaultTimeout(60000); // 1 minute for operations
      page.setDefaultNavigationTimeout(60000); // 1 minute for navigation
      
      // Navigate to the URL
      console.log('📡 Navigating to URL...');
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Check for redirects
      const currentUrl = page.url();
      if (currentUrl !== url) {
        console.log(`⚠️ Page redirected from ${url} to ${currentUrl}`);
      }
      
      // Wait for content to stabilize
      await this.waitForContentStabilization(page);
      
      // Scroll to load all content
      await this.scrollToLoadContent(page);
      
      // Extract content with preview and analysis
      const extractionResult = await this.extractContentWithPreview(page);
      
      // Debug: Log what we found
      console.log('🔍 Content extraction debug info:');
      console.log(`   - Page title: ${extractionResult.title}`);
      console.log(`   - Total elements found: ${extractionResult.extractedElements.length}`);
      console.log(`   - Total words: ${extractionResult.totalWords}`);
      console.log(`   - Elements: ${extractionResult.extractedElements.map(el => `${el.tagName}:${el.wordCount}w`).join(', ')}`);
      
      // Additional debug info
      if (extractionResult.debugInfo) {
        console.log('🔍 Debug info from browser:');
        console.log(`   - Total DOM elements: ${extractionResult.debugInfo.totalElements}`);
        console.log(`   - Processed elements: ${extractionResult.debugInfo.processedCount}`);
        console.log(`   - Skipped elements: ${extractionResult.debugInfo.skippedCount}`);
        console.log(`   - Successfully extracted: ${extractionResult.debugInfo.extractedCount}`);
        console.log(`   - Unique texts seen: ${extractionResult.debugInfo.seenTextsCount}`);
      }
      
      // Log first few extracted elements for inspection
      console.log('🔍 First 10 extracted elements:');
      extractionResult.extractedElements.slice(0, 10).forEach((el, index) => {
        console.log(`   ${index + 1}. [${el.tagName}] ${el.wordCount}w: "${el.text.substring(0, 100)}${el.text.length > 100 ? '...' : ''}"`);
      });
      
      // Log word count distribution
      const wordCounts = extractionResult.extractedElements.map(el => el.wordCount);
      const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
      const avgWords = totalWords / wordCounts.length;
      console.log(`🔍 Word count analysis:`);
      console.log(`   - Total words: ${totalWords}`);
      console.log(`   - Average words per element: ${avgWords.toFixed(2)}`);
      console.log(`   - Min words: ${Math.min(...wordCounts)}`);
      console.log(`   - Max words: ${Math.max(...wordCounts)}`);
      
      // Use AI to analyze content structure if available
      if (this.openai) {
        console.log('🤖 Using AI to analyze content structure...');
        const aiAnalysis = await this.analyzeContentWithAI(extractionResult);
        extractionResult.aiAnalysis = aiAnalysis;
      }
      
      // Generate PDF
      const fileName = options.fileName || `text-extraction-${Date.now()}.pdf`;
      const pdfPath = await this.generateTextPDF(extractionResult, fileName);
      
      // Read the PDF file and convert to base64 for download
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString('base64');
      
      // Generate summary
      const summary = this.generateSummary(extractionResult, pdfPath, Date.now() - startTime);
      
      await page.close();
      
      console.log('✅ Text extraction completed successfully');
      console.log('📊 Final result structure:', {
        success: true,
        hasSummary: !!summary,
        hasExtractionResult: !!extractionResult,
        hasPdfPath: !!pdfPath,
        extractionResultKeys: extractionResult ? Object.keys(extractionResult) : 'none'
      });
      return {
        success: true,
        summary,
        extractionResult,
        pdfPath,
        pdfBase64, // Add base64 PDF content for direct download
        fileName
      };
      
    } catch (error) {
      console.error('❌ Text extraction failed:', error.message);
      
      // Clean up page if it exists
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.warn('⚠️ Failed to close page:', closeError.message);
        }
      }
      
      throw error;
    }
  }

  async waitForContentStabilization(page) {
    console.log('⏳ Waiting for content to stabilize...');
    
    try {
      // Wait for network to be idle
      await page.waitForFunction(() => {
        return performance.now() - performance.timing.navigationStart > 3000;
      }, { timeout: 15000 });
      
      // Wait for any animations to complete
      await page.waitForTimeout(3000);
      
      // Wait for more content to load
      await page.waitForFunction(() => {
        const initialHeight = document.body.scrollHeight;
        return new Promise((resolve) => {
          setTimeout(() => {
            const finalHeight = document.body.scrollHeight;
            resolve(finalHeight === initialHeight);
          }, 2000);
        });
      }, { timeout: 10000 });
      
      // Additional wait for dynamic content
      await page.waitForTimeout(2000);
      
      // Try to trigger any lazy-loaded content
      await page.evaluate(async () => {
        // Scroll through the page to trigger lazy loading
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        
        for (let i = 0; i < scrollHeight; i += viewportHeight) {
          window.scrollTo(0, i);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Scroll back to top
        window.scrollTo(0, 0);
        
        // Wait a bit more for any content to load
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
      
      console.log('✅ Content stabilized');
    } catch (error) {
      console.log('⚠️ Content stabilization timeout, proceeding anyway');
    }
  }

  async scrollToLoadContent(page) {
    console.log('📜 Scrolling to load all content...');
    
    try {
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
        
        // Scroll back to top
        window.scrollTo(0, 0);
      });
      
      console.log('✅ Content loading completed');
    } catch (error) {
      console.log('⚠️ Content loading failed, proceeding anyway');
    }
  }

  async extractContentWithPreview(page) {
    console.log('🧹 Extracting content with preview and analysis...');
    
    try {
      const extractionData = await page.evaluate(async () => {
        const allElements = document.querySelectorAll('*');
        const extractedElements = [];
        const seenTexts = new Set(); // Track seen text to avoid duplicates
        
        // Helper function to get element position
        const getElementPosition = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top + window.pageYOffset,
            left: rect.left + window.pageXOffset,
            bottom: rect.bottom + window.pageYOffset,
            right: rect.right + window.pageXOffset
          };
        };
        
        // Helper function to analyze content structure (simplified)
        const analyzeContentStructure = (text) => {
          if (!text || text.trim().length === 0) return { isContent: false, score: 0, type: 'empty' };
          text = text.replace(/\s+/g, ' ').trim();
          const words = text.split(/\s+/).filter(word => word.length > 0);
          const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const uniqueWords = new Set(words);
          return {
            isContent: true,
            score: 1, // Default score for all content
            wordCount: words.length,
            sentenceCount: sentences.length,
            diversityRatio: uniqueWords.size / Math.max(words.length, 1),
            type: 'content',
            length: text.length
          };
        };
        
        // First pass: collect all potential content elements
        console.log(`🔍 Processing ${allElements.length} total DOM elements...`);
        let processedCount = 0;
        let skippedCount = 0;
        let extractedCount = 0;
        let allContentElements = [];
        
        for (const element of allElements) {
          processedCount++;
          
          // Skip technical elements
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'EMBED', 'OBJECT', 'TEMPLATE', 'LINK', 'META', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG'].includes(element.tagName)) {
            skippedCount++;
            continue;
          }
          if (element.style && element.style.display === 'none') {
            skippedCount++;
            continue;
          }
          
          // Skip hidden elements
          if (element.style && (element.style.visibility === 'hidden' || element.style.opacity === '0')) {
            skippedCount++;
            continue;
          }
          if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
            skippedCount++;
            continue;
          }
          
          // Skip elements that are positioned off-screen
          try {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              skippedCount++;
              continue;
            }
            if (rect.top < -5000 || rect.left < -5000) {
              skippedCount++;
              continue;
            }
          } catch (error) {
            skippedCount++;
            continue;
          }
          
          // Only extract from meaningful content elements
          const meaningfulTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'SPAN', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'MAIN'];
          if (!meaningfulTags.includes(element.tagName)) {
            skippedCount++;
            continue;
          }
          
          // Skip navigation, footer, and other non-content areas
          const skipClasses = ['nav', 'navigation', 'menu', 'footer', 'header', 'sidebar', 'breadcrumb', 'pagination', 'social', 'advertisement', 'banner', 'cookie', 'popup', 'modal', 'tooltip'];
          const skipIds = ['nav', 'navigation', 'menu', 'footer', 'header', 'sidebar', 'breadcrumb', 'pagination', 'social', 'advertisement', 'banner', 'cookie', 'popup', 'modal', 'tooltip'];
          
          const hasSkipClass = skipClasses.some(cls => 
            element.className && element.className.toLowerCase().split(' ').some(className => className === cls)
          );
          const hasSkipId = skipIds.some(id => 
            element.id && element.id.toLowerCase() === id
          );
          
          if (hasSkipClass || hasSkipId) {
            skippedCount++;
            continue;
          }
          
          // Get text content
          const text = element.innerText || element.textContent || '';
          if (!text || text.trim().length === 0) {
            skippedCount++;
            continue;
          }
          
          const cleanText = text.replace(/\s+/g, ' ').trim();
          if (cleanText.length < 10) {
            skippedCount++;
            continue;
          }
          
          // Analyze content structure
          const analysis = analyzeContentStructure(cleanText);
          if (!analysis.isContent) {
            skippedCount++;
            continue;
          }
          
          // Store all content elements for analysis
          allContentElements.push({
            element: element,
            text: cleanText,
            analysis: analysis,
            tagName: element.tagName,
            className: element.className || '',
            id: element.id || ''
          });
        }
        
        // Find the main content element (highest word count, typically around 650 words)
        console.log(`🔍 Found ${allContentElements.length} content elements, searching for main content...`);
        
        // Sort by word count to find the main content
        allContentElements.sort((a, b) => b.analysis.wordCount - a.analysis.wordCount);
        
        // Log the top 5 elements for debugging
        console.log('🔍 Top 5 content elements by word count:');
        allContentElements.slice(0, 5).forEach((item, index) => {
          console.log(`   ${index + 1}. [${item.tagName}] ${item.analysis.wordCount}w: "${item.text.substring(0, 100)}${item.text.length > 100 ? '...' : ''}"`);
        });
        
        // Only extract the main content element (highest word count)
        if (allContentElements.length > 0) {
          const mainContent = allContentElements[0];
          console.log(`✅ Selected main content: [${mainContent.tagName}] ${mainContent.analysis.wordCount} words`);
          
          // Get element position
          let position;
          try {
            const rect = mainContent.element.getBoundingClientRect();
            if (rect && rect.top !== undefined && rect.left !== undefined) {
              position = {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height
              };
            } else {
              position = {
                top: 0,
                left: 0,
                bottom: 100,
                right: 800,
                width: 800,
                height: 100
              };
            }
          } catch (error) {
            position = {
              top: 0,
              left: 0,
              bottom: 100,
              right: 800,
              width: 800,
              height: 100
            };
          }
          
          // Create the extracted element
          extractedElements.push({
            id: 'main-content',
            text: mainContent.text,
            type: 'main-content',
            level: 0,
            score: mainContent.analysis.score,
            wordCount: mainContent.analysis.wordCount,
            sentenceCount: mainContent.analysis.sentenceCount,
            diversityRatio: mainContent.analysis.diversityRatio,
            quality: 'main-content',
            length: mainContent.analysis.length,
            tagName: mainContent.tagName,
            className: mainContent.className,
            isSelected: true,
            position: position
          });
          
          extractedCount = 1;
        }
        
        // Only extract the main content element, no fallback needed
        
        // Since we only have one main content element, no sorting needed
        
        // Calculate totals
        const totalWords = extractedElements.reduce((sum, el) => sum + (el.wordCount || 0), 0);
        const selectedElements = extractedElements.filter(el => el.isSelected);
        const selectedWords = selectedElements.reduce((sum, el) => sum + (el.wordCount || 0), 0);
        
        // Final summary logging
        console.log(`📊 Extraction Summary:`);
        console.log(`   - Total DOM elements processed: ${processedCount}`);
        console.log(`   - Elements skipped: ${skippedCount}`);
        console.log(`   - Elements successfully extracted: ${extractedCount}`);
        console.log(`   - Total words extracted: ${totalWords}`);
        console.log(`   - Unique texts seen: ${seenTexts.size}`);
        
        // Debug logging for word count accuracy
        console.log('🔍 Word count analysis:');
        extractedElements.forEach((el, index) => {
          console.log(`  ${index + 1}. ${el.tagName}: ${el.wordCount}w - "${el.text.substring(0, 50)}${el.text.length > 50 ? '...' : ''}"`);
        });
        console.log(`📊 Total extracted words: ${totalWords}`);
        
        // Return debug info to Node.js context
        return {
          extractedElements,
          totalWords,
          selectedElements,
          selectedWords,
          title: document.title || 'Extracted Content',
          url: window.location.href,
          debugInfo: {
            totalElements: allElements.length,
            meaningfulElements: extractedElements.length,
            seenTextsCount: seenTexts.size,
            processedCount,
            skippedCount,
            extractedCount
          }
        };
      });
      
      console.log('✅ Content extraction with preview completed');
      console.log('📊 Extraction data structure:', {
        hasExtractedElements: !!extractionData.extractedElements,
        extractedElementsCount: extractionData.extractedElements?.length || 0,
        hasSelectedElements: !!extractionData.selectedElements,
        selectedElementsCount: extractionData.selectedElements?.length || 0,
        totalWords: extractionData.totalWords,
        selectedWords: extractionData.selectedWords
      });
      
      return extractionData;
      
    } catch (error) {
      console.error('❌ Error during content extraction:', error);
      throw error;
    } finally {
      // await page.close(); // This line was removed as per the new_code, as the page is now managed by the caller.
    }
  }

  async analyzeContentWithAI(extractionResult) {
    if (!this.openai) {
      return { error: 'OpenAI API not available' };
    }
    
    try {
      console.log('🤖 Analyzing content structure with AI...');
      
      const contentSummary = extractionResult.extractedElements
        .slice(0, 10) // Limit to first 10 elements for analysis
        .map(el => `${el.type.toUpperCase()}: ${el.text.substring(0, 100)}...`)
        .join('\n');
      
      const prompt = `Analyze this web page content and provide insights:

Content Preview:
${contentSummary}

Total Elements: ${extractionResult.extractedElements.length}
Total Words: ${extractionResult.totalWords}
Selected Elements: ${extractionResult.selectedElements.length}
Selected Words: ${extractionResult.selectedWords}

Please provide:
1. Content type and purpose
2. Main topics covered
3. Content quality assessment
4. Recommendations for what to include/exclude
5. Estimated reading time

Format as JSON with keys: contentType, purpose, mainTopics, qualityAssessment, recommendations, readingTime.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
      });

      const aiResponse = completion.choices[0].message.content;
      
      try {
        const analysis = JSON.parse(aiResponse);
        console.log('✅ AI analysis completed');
        return analysis;
      } catch (parseError) {
        console.log('⚠️ AI response parsing failed, returning raw response');
        return { rawResponse: aiResponse };
      }
      
    } catch (error) {
      console.warn('AI analysis failed:', error.message);
      return { error: error.message };
    }
  }

  async generateTextPDF(extractionResult, fileName) {
    console.log('📄 Generating PDF with selected content...');
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      
      const pdfPath = path.join(this.outputDir, fileName);
      
      // Create HTML content for PDF
      const htmlContent = this.createPDFHTML(extractionResult);
      
      // Generate PDF using Puppeteer
      const page = await this.browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true
      });
      
      await page.close();
      
      console.log(`✅ PDF generated: ${pdfPath}`);
      return pdfPath;
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error.message);
      throw error;
    }
  }

  createPDFHTML(extractionResult) {
    const { title, url, extractedElements, totalWords, selectedElements, selectedWords, aiAnalysis } = extractionResult;
    const sourceUrl = url;
    
    // Create content sections
    const contentSections = selectedElements.map(element => {
      const elementClass = `element-${element.type} element-quality-${element.quality}`;
      const elementHeader = element.type === 'heading' ? `<h${element.level} class="${elementClass}">${element.text}</h${element.level}>` : `<p class="${elementClass}">${element.text}</p>`;
      
      return `
        <div class="content-element" data-id="${element.id}">
          ${elementHeader}
          <div class="element-meta">
            <span class="quality">Quality: ${element.quality}</span>
            <span class="score">Score: ${element.score}</span>
            <span class="words">Words: ${element.wordCount}</span>
          </div>
        </div>
      `;
    }).join('');
    
    // Create AI analysis section
    const aiSection = aiAnalysis && !aiAnalysis.error ? `
      <div class="ai-analysis">
        <h2>🤖 AI Content Analysis</h2>
        <div class="ai-insights">
          ${aiAnalysis.contentType ? `<p><strong>Content Type:</strong> ${aiAnalysis.contentType}</p>` : ''}
          ${aiAnalysis.purpose ? `<p><strong>Purpose:</strong> ${aiAnalysis.purpose}</p>` : ''}
          ${aiAnalysis.mainTopics ? `<p><strong>Main Topics:</strong> ${aiAnalysis.mainTopics}</p>` : ''}
          ${aiAnalysis.qualityAssessment ? `<p><strong>Quality Assessment:</strong> ${aiAnalysis.qualityAssessment}</p>` : ''}
          ${aiAnalysis.recommendations ? `<p><strong>Recommendations:</strong> ${aiAnalysis.recommendations}</p>` : ''}
          ${aiAnalysis.readingTime ? `<p><strong>Estimated Reading Time:</strong> ${aiAnalysis.readingTime}</p>` : ''}
        </div>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Text Extraction: ${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
          .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .content-section { margin-bottom: 30px; }
          .content-element { margin-bottom: 20px; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
          .element-heading { border-left-color: #28a745; }
          .element-quality-excellent { border-left-color: #28a745; }
          .element-quality-good { border-left-color: #17a2b8; }
          .element-quality-acceptable { border-left-color: #ffc107; }
          .element-quality-poor { border-left-color: #dc3545; }
          .element-meta { font-size: 12px; color: #666; margin-top: 10px; }
          .element-meta span { margin-right: 15px; }
          .ai-analysis { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .ai-insights p { margin: 8px 0; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .stat-card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
          .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
          .stat-label { color: #666; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📄 Text Extraction Report</h1>
          <p><strong>Source URL:</strong> ${sourceUrl}</p>
          <p><strong>Extracted on:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Extraction Type:</strong> Complete Content Capture - ALL VISIBLE TEXT</p>
          <p><strong>Scope:</strong> Single URL - No subdirectories processed</p>
          <p><strong>Content Filtering:</strong> None - All visible text included</p>
          <p><strong>Accuracy:</strong> Comprehensive text extraction without quality restrictions</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <div class="stat-number">${extractedElements.length}</div>
            <div class="stat-label">Total Elements Found</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${totalWords}</div>
            <div class="stat-label">Total Words Available</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${selectedElements.length}</div>
            <div class="stat-label">Selected Elements</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${selectedWords}</div>
            <div class="stat-label">Selected Words</div>
          </div>
        </div>
        
        ${aiSection}
        
        <div class="content-section">
          <h2>📝 Selected Content (${selectedElements.length} elements, ${selectedWords} words)</h2>
          ${contentSections}
        </div>
      </body>
      </html>
    `;
  }

  generateSummary(extractionResult, pdfPath, duration) {
    const { extractedElements, totalWords, selectedElements, selectedWords } = extractionResult;
    
    return {
      totalElements: extractedElements.length,
      totalWords,
      selectedElements: selectedElements.length,
      selectedWords,
      pdfPath: path.basename(pdfPath),
      duration: Math.round(duration / 1000)
    };
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('🧹 Text Extraction Service cleaned up');
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

module.exports = TextExtractionService;
