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
    
    console.log('📱 Capturing screenshots...');
    const result = await service.comparePages(urlA, urlB, {
      fullPage: false,
      diffThreshold: 0.1,
      includeAA: true
    });
    
    console.log('✅ Comparison completed!\n');
    console.log('📊 Results:');
    console.log(`   Mismatch: ${result.metrics.mismatchPercent}%`);
    console.log(`   Changed Pixels: ${result.metrics.changedPixels}`);
    console.log(`   SSIM Score: ${result.metrics.ssimScore}`);
    console.log(`   Dimensions: ${result.metrics.width} × ${result.metrics.height}`);
    console.log(`   Images captured: ${result.images.A ? 'Site A ✓' : 'Site A ✗'}, ${result.images.B ? 'Site B ✓' : 'Site B ✗'}, ${result.images.diff ? 'Diff ✓' : 'Diff ✗'}`);
    
    console.log('\n🎉 Test completed successfully!');
    
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
