const chromium = require('@sparticuz/chromium-min');
const puppeteerCore = require('puppeteer-core');

async function testVercelPuppeteer() {
  try {
    console.log("Launching chromium-min...");
    const browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.tar'),
      headless: chromium.headless,
    });
    
    console.log("Browser launched successfully! Version:", await browser.version());
    
    const page = await browser.newPage();
    await page.setContent('<h1>Test</h1>', { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf();
    
    console.log("PDF generated successfully! Size:", pdf.length);
    await browser.close();
  } catch(e) {
    console.error("FAILED:", e);
  }
}

testVercelPuppeteer();
