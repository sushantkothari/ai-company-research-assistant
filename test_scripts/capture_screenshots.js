const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 900 });
  
  console.log('Navigating to local dev server...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  await page.type('input[type="text"]', 'Aurora Labs');
  await page.keyboard.press('Enter');
  
  console.log('Waiting for research to complete (fixed delay for safety)...');
  await new Promise(r => setTimeout(r, 10000));
  
  
  const outputDir = path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const uiScreenshotPath = path.join(outputDir, 'ui_screenshot.png');
  await page.screenshot({ path: uiScreenshotPath, fullPage: true });
  console.log('Saved UI screenshot to', uiScreenshotPath);
  
  // Make PDF template visible
  await page.evaluate(() => {
    const pdfWrapper = document.querySelector('[class*="pdfTemplateWrapper"]');
    if (pdfWrapper) {
      pdfWrapper.style.position = 'static';
      pdfWrapper.style.height = 'auto';
      pdfWrapper.style.visibility = 'visible';
    }
  });
  
  const pdfScreenshotPath = path.join(outputDir, 'pdf_template_screenshot.png');
  await page.screenshot({ path: pdfScreenshotPath, fullPage: true });
  console.log('Saved PDF template screenshot to', pdfScreenshotPath);
  
  await browser.close();
}

captureScreenshots().catch(console.error);
