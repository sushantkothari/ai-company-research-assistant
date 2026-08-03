const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("Launching browser for UI test...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log("Navigating to http://localhost:3000...");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    console.log("Typing 'Microsoft' into search...");
    await page.type('input[placeholder*="company name"]', 'Microsoft');
    
    console.log("Clicking search button...");
    await page.click('button[type="submit"]');
    
    console.log("Waiting for results to load (up to 120s)...");
    await page.waitForFunction(() => {
      const texts = Array.from(document.querySelectorAll('h3, td, div')).map(el => el.textContent);
      return texts.some(t => t.includes('COMPANY SUMMARY') || t.includes('Microsoft'));
    }, { timeout: 120000 });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const outDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    
    const screenshotPath = path.join(outDir, 'UI_Workflow.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("Saved UI screenshot to", screenshotPath);
    
  } catch (err) {
    console.error("UI Test Error:", err);
  } finally {
    await browser.close();
  }
})();
