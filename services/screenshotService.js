const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ScreenshotService {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  async initialize() {
    if (this.browser) return;
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      userAgent: 'PixelPerfect-Comparer/1.0 (+Playwright)',
      ignoreHTTPSErrors: true,
      locale: 'en-US',
      timezoneId: 'UTC'
    });

    // Store viewport dimensions for consistent use
    this.viewportWidth = 1440;
    this.viewportHeight = 900;
  }

  async capturePage(url, options = {}) {
    const {
      waitFor = 'networkidle',
      fullPage = true,
      maskSelectors = ['.cookie', '#cookie', '.banner', '.ads', '[data-testid="cookie"]'],
      timeout = 45000,
      stabilizationDelay = 1000
    } = options;

    if (!this.context) {
      await this.initialize();
    }

    const page = await this.context.newPage();

    try {
      // Set viewport size explicitly for consistent capture
      await page.setViewportSize({
        width: this.viewportWidth || 1440,
        height: this.viewportHeight || 900
      });

      console.log(`Viewport set to: ${this.viewportWidth || 1440}x${this.viewportHeight || 900}`);

      // Inject stabilization scripts before navigation
      await page.addInitScript(() => {
        // Freeze animations and transitions
        const style = document.createElement('style');
        style.id = '__visual-stabilizer__';
        style.textContent = `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            caret-color: transparent !important;
          }
          html {
            scroll-behavior: auto !important;
          }
          .carousel, .slider, .rotating {
            animation: none !important;
          }
        `;
        
        // Wait for DOM to be ready before appending
        if (document.head) {
          document.head.appendChild(style);
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
          });
        }
      });

      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });

      // Navigate to the page
      console.log(`Navigating to: ${url}`);
      
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout 
        });
      } catch (navError) {
        if (navError.message.includes('net::ERR_CONNECTION_REFUSED')) {
          throw new Error(`Connection refused to ${url}. Please check if the URL is accessible.`);
        } else if (navError.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
          throw new Error(`Could not resolve hostname for ${url}. Please check the URL spelling.`);
        } else if (navError.message.includes('net::ERR_SSL_PROTOCOL_ERROR')) {
          throw new Error(`SSL/TLS error for ${url}. The site may have certificate issues.`);
        } else if (navError.message.includes('timeout')) {
          throw new Error(`Navigation timeout for ${url}. The site may be slow or unresponsive.`);
        } else {
          throw new Error(`Navigation failed for ${url}: ${navError.message}`);
        }
      }

      // Wait strategy implementation
      if (waitFor === 'networkidle') {
        try {
          await page.waitForLoadState('networkidle', { timeout: 15000 });
        } catch (e) {
          console.warn('Network idle timeout, proceeding anyway');
        }
      } else if (typeof waitFor === 'string' && waitFor.startsWith('css:')) {
        const selector = waitFor.slice(4);
        try {
          await page.waitForSelector(selector, { timeout: 20000 });
        } catch (e) {
          throw new Error(`Required element "${selector}" not found on page. Please check the selector or use a different wait strategy.`);
        }
      }

      // Handle cookie banners and popups
      await this.dismissCookieBanners(page);

      // Apply masking to dynamic elements
      if (maskSelectors.length > 0) {
        const maskCSS = maskSelectors.join(', ') + ' { visibility: hidden !important; opacity: 0 !important; }';
        try {
          await page.addStyleTag({ content: maskCSS });
        } catch (e) {
          console.warn('Could not apply mask selectors:', e.message);
        }
      }

      // Additional stabilization delay
      await page.waitForTimeout(stabilizationDelay);

      // For full page capture, ensure we scroll to load all content
      if (fullPage) {
        await this.scrollToLoadContent(page);
        
        // Get the actual page dimensions after scrolling
        const pageDimensions = await page.evaluate(() => {
          return {
            width: Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
              document.documentElement.offsetWidth,
              document.body.offsetWidth
            ),
            height: Math.max(
              document.documentElement.scrollHeight,
              document.body.scrollHeight,
              document.documentElement.offsetHeight,
              document.body.offsetHeight
            )
          };
        });
        
        console.log(`Page dimensions after scroll: ${pageDimensions.width}x${pageDimensions.height}`);
        
        // Scroll back to top for consistent capture
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
      }

      // Capture screenshot with proper options
      let screenshot;
      let captureMethod = 'unknown';
      
      try {
        const screenshotOptions = {
          fullPage: fullPage,
          type: 'png'
        };

        // Only add clip if not capturing full page
        if (!fullPage) {
          const clipWidth = this.viewportWidth || 1440;
          const clipHeight = this.viewportHeight || 900;
          
          // Validate clip dimensions
          if (clipWidth <= 0 || clipHeight <= 0) {
            throw new Error('Invalid viewport dimensions for screenshot capture');
          }
          
          screenshotOptions.clip = { 
            x: 0, 
            y: 0, 
            width: clipWidth, 
            height: clipHeight 
          };
        }

        // Validate screenshot options before capture
        if (screenshotOptions.clip && (!screenshotOptions.clip.width || !screenshotOptions.clip.height)) {
          throw new Error('Invalid clip dimensions for screenshot capture');
        }

        console.log(`Capturing screenshot with options:`, {
          fullPage: screenshotOptions.fullPage,
          clip: screenshotOptions.clip ? 'viewport' : 'full page',
          viewportSize: { width: this.viewportWidth, height: this.viewportHeight }
        });

        // For full page capture, let's try a different approach
        if (fullPage) {
          console.log('Attempting full page capture...');
          
          // First, try the standard fullPage option
          try {
            screenshot = await page.screenshot(screenshotOptions);
            captureMethod = 'standard_fullPage';
            console.log(`Standard fullPage screenshot captured. Size: ${screenshot.length} bytes`);
          } catch (fullPageError) {
            console.log(`Standard fullPage failed: ${fullPageError.message}, trying alternative method...`);
            
            // Alternative: manually calculate full page dimensions and use clip
            const fullPageDimensions = await page.evaluate(() => {
              const body = document.body;
              const html = document.documentElement;
              
              return {
                width: Math.max(
                  body.scrollWidth,
                  body.offsetWidth,
                  html.clientWidth,
                  html.scrollWidth,
                  html.offsetWidth
                ),
                height: Math.max(
                  body.scrollHeight,
                  body.offsetHeight,
                  html.clientHeight,
                  html.scrollHeight,
                  html.offsetHeight
                )
              };
            });
            
            console.log(`Calculated full page dimensions: ${fullPageDimensions.width}x${fullPageDimensions.height}`);
            
            // Use clip with calculated dimensions
            screenshotOptions.clip = {
              x: 0,
              y: 0,
              width: fullPageDimensions.width,
              height: fullPageDimensions.height
            };
            
            // Remove fullPage option when using clip
            delete screenshotOptions.fullPage;
            
            console.log(`Using clip-based full page capture: ${fullPageDimensions.width}x${fullPageDimensions.height}`);
            screenshot = await page.screenshot(screenshotOptions);
            captureMethod = 'clip_based_fullPage';
            console.log(`Clip-based full page screenshot captured. Size: ${screenshot.length} bytes`);
          }
        } else {
          // Viewport capture
          screenshot = await page.screenshot(screenshotOptions);
          captureMethod = 'viewport';
          console.log(`Viewport screenshot captured. Size: ${screenshot.length} bytes`);
        }
        
        console.log(`Screenshot captured successfully using method: ${captureMethod}. Size: ${screenshot.length} bytes`);
        
      } catch (screenshotError) {
        console.error('Screenshot error details:', screenshotError);
        
        // Fallback: try viewport capture if full page fails
        if (fullPage && !screenshot) {
          console.log('Full page capture failed, falling back to viewport capture...');
          try {
            screenshot = await page.screenshot({
              type: 'png',
              clip: {
                x: 0,
                y: 0,
                width: this.viewportWidth || 1440,
                height: this.viewportHeight || 900
              }
            });
            captureMethod = 'fallback_viewport';
            console.log(`Fallback viewport screenshot captured. Size: ${screenshot.length} bytes`);
          } catch (fallbackError) {
            console.error('Fallback capture also failed:', fallbackError.message);
            throw screenshotError; // Throw original error
          }
        } else {
          throw screenshotError;
        }
      }

      // Get page metadata
      const title = await page.title().catch(() => '');
      const finalUrl = page.url();
      
      // Get final page dimensions
      const finalDimensions = await page.evaluate(() => {
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollWidth: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          ),
          scrollHeight: Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
          )
        };
      });

      await page.close();

      return {
        buffer: screenshot,
        metadata: {
          url: finalUrl,
          title,
          timestamp: new Date().toISOString(),
          viewport: { 
            width: this.viewportWidth || 1440, 
            height: this.viewportHeight || 900 
          },
          fullPage,
          pageDimensions: finalDimensions,
          captureMethod
        }
      };

    } catch (error) {
      await page.close();
      
      // Enhance error messages with context
      if (error.message.includes('Connection refused')) {
        throw new Error(`Network Error: ${error.message}`);
      } else if (error.message.includes('Could not resolve hostname')) {
        throw new Error(`DNS Error: ${error.message}`);
      } else if (error.message.includes('SSL/TLS error')) {
        throw new Error(`Security Error: ${error.message}`);
      } else if (error.message.includes('Navigation timeout')) {
        throw new Error(`Timeout Error: ${error.message}`);
      } else if (error.message.includes('Required element')) {
        throw new Error(`Content Error: ${error.message}`);
      } else if (error.message.includes('Page crashed')) {
        throw new Error(`Stability Error: ${error.message}`);
      } else if (error.message.includes('Screenshot capture failed')) {
        throw new Error(`Capture Error: ${error.message}`);
      } else {
        throw new Error(`Screenshot capture failed for ${url}: ${error.message}`);
      }
    }
  }

  async dismissCookieBanners(page) {
    const cookieSelectors = [
      'button[aria-label*="Accept"]',
      'button[aria-label*="accept"]',
      'button:has-text("Accept")',
      'button:has-text("OK")',
      'button:has-text("I agree")',
      'button:has-text("Got it")',
      '#onetrust-accept-btn-handler',
      '.cookie-accept',
      '[data-testid="cookie-accept"]',
      '[data-cy="cookie-accept"]'
    ];

    for (const selector of cookieSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isVisible();
          if (isVisible) {
            await button.click({ timeout: 3000 });
            await page.waitForTimeout(500); // Brief pause after click
            console.log(`Dismissed cookie banner using selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }
  }

  async scrollToLoadContent(page) {
    try {
      console.log('Starting content loading scroll...');
      
      // Get initial scroll dimensions
      let lastHeight = await page.evaluate(() => {
        return Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
      });
      
      let lastWidth = await page.evaluate(() => {
        return Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth
        );
      });
      
      console.log(`Initial dimensions: ${lastWidth}x${lastHeight}`);
      
      // Scroll down in chunks to load lazy content
      let currentPosition = 0;
      const scrollStep = Math.min(800, lastHeight / 4); // Adaptive scroll step
      let scrollAttempts = 0;
      const maxScrollAttempts = 20; // Prevent infinite scrolling
      
      while (currentPosition < lastHeight && scrollAttempts < maxScrollAttempts) {
        currentPosition += scrollStep;
        
        // Scroll to position
        await page.evaluate((pos) => {
          window.scrollTo(0, pos);
        }, currentPosition);
        
        // Wait for content to load
        await page.waitForTimeout(300);
        
        // Check if new content loaded
        const newHeight = await page.evaluate(() => {
          return Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
          );
        });
        
        const newWidth = await page.evaluate(() => {
          return Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          );
        });
        
        if (newHeight > lastHeight || newWidth > lastWidth) {
          console.log(`New content loaded: ${newWidth}x${newHeight}`);
          lastHeight = newHeight;
          lastWidth = newWidth;
        }
        
        scrollAttempts++;
        
        // Prevent excessive scrolling for very long pages
        if (lastHeight > 50000) {
          console.log('Page is very long, limiting scroll depth');
          break;
        }
      }
      
      // Scroll back to top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
      // Wait for any final animations to settle
      await page.waitForTimeout(500);
      
      // Get final dimensions
      const finalDimensions = await page.evaluate(() => {
        return {
          width: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
            document.documentElement.offsetWidth,
            document.body.offsetWidth
          ),
          height: Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            document.documentElement.offsetHeight,
            document.body.offsetHeight
          )
        };
      });
      
      console.log(`Final page dimensions after scroll: ${finalDimensions.width}x${finalDimensions.height}`);
      console.log(`Content loading scroll completed in ${scrollAttempts} attempts`);
      
    } catch (e) {
      console.warn('Scroll loading failed:', e.message);
      // Continue with screenshot capture even if scrolling fails
    }
  }

  async setViewport(width, height) {
    if (width <= 0 || height <= 0) {
      throw new Error('Viewport dimensions must be positive numbers');
    }
    
    if (width > 10000 || height > 10000) {
      throw new Error('Viewport dimensions too large. Maximum supported: 10000x10000');
    }
    
    await this.context.setViewportSize({ width, height });
    this.viewportWidth = width;
    this.viewportHeight = height;
    
    console.log(`Viewport updated to ${width}x${height}`);
  }

  computeVisualDiff(bufferA, bufferB, options = {}) {
    const { threshold = 0.1, includeAA = true } = options;

    try {
      const imgA = PNG.sync.read(bufferA);
      const imgB = PNG.sync.read(bufferB);

      // Validate image data
      if (!imgA.data || !imgB.data) {
        throw new Error('Invalid image data received');
      }

      // Normalize dimensions to the smaller size
      const width = Math.min(imgA.width, imgB.width);
      const height = Math.min(imgA.height, imgB.height);

      if (width === 0 || height === 0) {
        throw new Error('Invalid image dimensions: width or height is 0');
      }

      if (width > 10000 || height > 10000) {
        throw new Error('Image dimensions too large. Maximum supported: 10000x10000 pixels');
      }

      // Create cropped versions
      const aCrop = new PNG({ width, height });
      const bCrop = new PNG({ width, height });
      
      try {
        PNG.bitblt(imgA, aCrop, 0, 0, width, height, 0, 0);
        PNG.bitblt(imgB, bCrop, 0, 0, width, height, 0, 0);
      } catch (bitbltError) {
        throw new Error(`Failed to process image data: ${bitbltError.message}`);
      }

      // Create diff image
      const diff = new PNG({ width, height });
      
      let changedPixels;
      try {
        changedPixels = pixelmatch(
          aCrop.data, bCrop.data, diff.data,
          width, height,
          { 
            threshold, 
            includeAA,
            alpha: 0.2,
            diffColor: [255, 0, 0],
            diffColorAlt: [0, 255, 0]
          }
        );
      } catch (pixelmatchError) {
        throw new Error(`Pixel comparison failed: ${pixelmatchError.message}`);
      }

      const totalPixels = width * height;
      const mismatchPercent = (changedPixels / totalPixels) * 100;

      // Calculate additional metrics
      const ssimScore = 1 - (mismatchPercent / 100); // Simplified SSIM approximation

      return {
        metrics: {
          width,
          height,
          totalPixels,
          changedPixels,
          mismatchPercent: Math.round(mismatchPercent * 100) / 100,
          ssimScore: Math.round(ssimScore * 10000) / 10000,
          threshold,
          includeAA
        },
        images: {
          original: {
            A: aCrop,
            B: bCrop
          },
          diff: diff
        }
      };

    } catch (error) {
      if (error.message.includes('Invalid image data')) {
        throw new Error('Image processing failed: Invalid or corrupted image data received');
      } else if (error.message.includes('Invalid image dimensions')) {
        throw new Error('Image processing failed: Invalid image dimensions');
      } else if (error.message.includes('Image dimensions too large')) {
        throw new Error('Image processing failed: Image is too large to process');
      } else if (error.message.includes('Failed to process image data')) {
        throw new Error('Image processing failed: Could not extract image data');
      } else if (error.message.includes('Pixel comparison failed')) {
        throw new Error('Image comparison failed: Could not compute visual differences');
      } else {
        throw new Error(`Visual diff computation failed: ${error.message}`);
      }
    }
  }

  async comparePages(urlA, urlB, options = {}) {
    const comparisonId = uuidv4();
    console.log(`Starting comparison ${comparisonId}: ${urlA} vs ${urlB}`);
    console.log('Comparison options:', options);

    try {
      // Capture both pages in parallel
      const [resultA, resultB] = await Promise.all([
        this.capturePage(urlA, options),
        this.capturePage(urlB, options)
      ]);

      console.log(`Page A captured: ${resultA.metadata.fullPage ? 'Full page' : 'Viewport only'}, dimensions: ${resultA.metadata.pageDimensions?.scrollWidth || 'unknown'}x${resultA.metadata.pageDimensions?.scrollHeight || 'unknown'}`);
      console.log(`Page B captured: ${resultB.metadata.fullPage ? 'Full page' : 'Viewport only'}, dimensions: ${resultB.metadata.pageDimensions?.scrollWidth || 'unknown'}x${resultB.metadata.pageDimensions?.scrollHeight || 'unknown'}`);

      // Compute visual diff
      const diffResult = this.computeVisualDiff(
        resultA.buffer, 
        resultB.buffer, 
        {
          threshold: options.diffThreshold || 0.1,
          includeAA: options.includeAA !== false
        }
      );

      // Convert images to base64
      const imageA = PNG.sync.write(diffResult.images.original.A);
      const imageB = PNG.sync.write(diffResult.images.original.B);
      const imageDiff = PNG.sync.write(diffResult.images.diff);

      const finalResult = {
        id: comparisonId,
        urls: { A: urlA, B: urlB },
        metadata: {
          A: resultA.metadata,
          B: resultB.metadata,
          comparedAt: new Date().toISOString()
        },
        images: {
          A: imageA.toString('base64'),
          B: imageB.toString('base64'),
          diff: imageDiff.toString('base64')
        },
        metrics: diffResult.metrics
      };

      console.log(`Comparison ${comparisonId} completed successfully`);
      console.log(`Final metrics: mismatch ${diffResult.metrics.mismatchPercent}%, changed pixels: ${diffResult.metrics.changedPixels}`);

      return finalResult;

    } catch (error) {
      console.error(`Comparison ${comparisonId} failed:`, error);
      throw error;
    }
  }

  async cleanup() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = ScreenshotService;
