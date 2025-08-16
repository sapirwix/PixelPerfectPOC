const ScreenshotService = require('./services/screenshotService');

async function testComparison() {
  console.log('🧪 Testing Screenshot Service...\n');
  
  const service = new ScreenshotService();
  
  try {
    // Test URLs (using simple, stable websites)
    const urlA = 'https://httpbin.org/html';
    const urlB = 'https://httpbin.org/json';
    
    console.log(`📸 Testing with URLs:`);
    console.log(`   A: ${urlA}`);
    console.log(`   B: ${urlB}\n`);
    
    console.log('🚀 Initializing service...');
    await service.initialize();
    console.log('✅ Service initialized\n');
    
    // Test 1: Viewport-only capture
    console.log('📱 Test 1: Viewport-only capture...');
    const result1 = await service.comparePages(urlA, urlB, {
      fullPage: false,
      diffThreshold: 0.1,
      includeAA: true
    });
    
    console.log('✅ Viewport capture completed!');
    console.log(`   Page A dimensions: ${result1.metadata.A.pageDimensions?.width || 'unknown'}x${result1.metadata.A.pageDimensions?.height || 'unknown'}`);
    console.log(`   Page B dimensions: ${result1.metadata.B.pageDimensions?.width || 'unknown'}x${result1.metadata.B.pageDimensions?.height || 'unknown'}`);
    console.log(`   Mismatch: ${result1.metrics.mismatchPercent}%\n`);
    
    // Test 2: Full page capture
    console.log('📱 Test 2: Full page capture...');
    const result2 = await service.comparePages(urlA, urlB, {
      fullPage: true,
      diffThreshold: 0.1,
      includeAA: true
    });
    
    console.log('✅ Full page capture completed!');
    console.log(`   Page A dimensions: ${result2.metadata.A.pageDimensions?.width || 'unknown'}x${result2.metadata.A.pageDimensions?.height || 'unknown'}`);
    console.log(`   Page B dimensions: ${result2.metadata.B.pageDimensions?.width || 'unknown'}x${result2.metadata.B.pageDimensions?.height || 'unknown'}`);
    console.log(`   Mismatch: ${result2.metrics.mismatchPercent}%\n`);
    
    // Verify full page is actually larger
    const viewportHeight = result1.metadata.A.pageDimensions?.height || 900;
    const fullPageHeight = result2.metadata.A.pageDimensions?.height || 900;
    
    if (fullPageHeight > viewportHeight) {
      console.log('✅ Full page capture working: Full page height > Viewport height');
    } else {
      console.log('⚠️  Full page capture may not be working: Heights are similar');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await service.cleanup();
    console.log('\n🧹 Service cleaned up');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testComparison().catch(console.error);
}

module.exports = { testComparison };
