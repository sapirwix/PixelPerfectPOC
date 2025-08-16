const ScreenshotService = require('./services/screenshotService');

async function testFullPageCapture() {
  console.log('🧪 Testing Full Page Capture...\n');
  
  const service = new ScreenshotService();
  
  try {
    // Test with a simple URL that should have content below the fold
    const testUrl = 'https://httpbin.org/html';
    
    console.log(`📸 Testing with URL: ${testUrl}\n`);
    
    console.log('🚀 Initializing service...');
    await service.initialize();
    console.log('✅ Service initialized\n');
    
    // Test 1: Viewport capture
    console.log('📱 Test 1: Viewport-only capture...');
    const viewportResult = await service.capturePage(testUrl, {
      fullPage: false,
      waitFor: 'networkidle'
    });
    
    console.log('✅ Viewport capture completed!');
    console.log(`   Capture method: ${viewportResult.metadata.captureMethod}`);
    console.log(`   Viewport dimensions: ${viewportResult.metadata.viewport.width}x${viewportResult.metadata.viewport.height}`);
    console.log(`   Page dimensions: ${viewportResult.metadata.pageDimensions.scrollWidth}x${viewportResult.metadata.pageDimensions.scrollHeight}`);
    console.log(`   Screenshot size: ${viewportResult.buffer.length} bytes\n`);
    
    // Test 2: Full page capture
    console.log('📱 Test 2: Full page capture...');
    const fullPageResult = await service.capturePage(testUrl, {
      fullPage: true,
      waitFor: 'networkidle'
    });
    
    console.log('✅ Full page capture completed!');
    console.log(`   Capture method: ${fullPageResult.metadata.captureMethod}`);
    console.log(`   Viewport dimensions: ${fullPageResult.metadata.viewport.width}x${fullPageResult.metadata.viewport.height}`);
    console.log(`   Page dimensions: ${fullPageResult.metadata.pageDimensions.scrollWidth}x${fullPageResult.metadata.pageDimensions.scrollHeight}`);
    console.log(`   Screenshot size: ${fullPageResult.buffer.length} bytes\n`);
    
    // Compare results
    const viewportHeight = viewportResult.metadata.pageDimensions.scrollHeight;
    const fullPageHeight = fullPageResult.metadata.pageDimensions.scrollHeight;
    const viewportSize = viewportResult.buffer.length;
    const fullPageSize = fullPageResult.buffer.length;
    
    console.log('📊 Comparison Results:');
    console.log(`   Viewport height: ${viewportHeight}px`);
    console.log(`   Full page height: ${fullPageHeight}px`);
    console.log(`   Height difference: ${fullPageHeight - viewportHeight}px`);
    console.log(`   Viewport file size: ${(viewportSize / 1024).toFixed(1)} KB`);
    console.log(`   Full page file size: ${(fullPageSize / 1024).toFixed(1)} KB`);
    console.log(`   Size difference: ${((fullPageSize - viewportSize) / 1024).toFixed(1)} KB`);
    
    if (fullPageHeight > viewportHeight) {
      console.log('\n✅ Full page capture is working: Full page height > Viewport height');
    } else {
      console.log('\n⚠️  Full page capture may not be working: Heights are similar');
    }
    
    if (fullPageSize > viewportSize) {
      console.log('✅ Full page capture is working: Full page file size > Viewport file size');
    } else {
      console.log('⚠️  Full page capture may not be working: File sizes are similar');
    }
    
    console.log('\n🎉 Full page capture test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await service.cleanup();
    console.log('\n🧹 Service cleaned up');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testFullPageCapture().catch(console.error);
}

module.exports = { testFullPageCapture };
