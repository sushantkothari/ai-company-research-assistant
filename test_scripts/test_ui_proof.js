const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("==================================================");
  console.log("=== BROWSER UI & NETWORK PROOF TEST ===");
  console.log("==================================================");

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    let networkJsonResponse = null;

    // Listen to network responses to capture the exact /api/research response
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/research')) {
        console.log(`[NETWORK EVENT] Caught response from ${url} | Status: ${response.status()}`);
        try {
          networkJsonResponse = await response.text();
        } catch (e) {
          console.error("Failed to read response text:", e);
        }
      }
    });

    console.log("[1] Navigating browser to http://localhost:3000 ...");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    console.log("[2] Typing 'Microsoft' in search bar ...");
    await page.type('input[placeholder*="company name"]', 'Microsoft');

    console.log("[3] Submitting research form ...");
    await page.click('button[type="submit"]');

    console.log("[4] Waiting for research to complete ...");
    await page.waitForFunction(() => {
      const el = document.querySelector('h1, h2, h3, div');
      return document.body.innerText.includes('Microsoft 365') || document.body.innerText.includes('COMPANY SUMMARY');
    }, { timeout: 90000 });

    await new Promise(r => setTimeout(r, 2000));

    console.log("\n=== RAW NETWORK JSON CAPTURED BY BROWSER DEVTOOLS ===");
    console.log(networkJsonResponse);
    console.log("======================================================\n");

    // Extract UI Header text
    const uiText = await page.evaluate(() => {
      const companyNameEl = document.querySelector('.MainUI_companyTitle__4m1_g, [class*="companyTitle"], [class*="uiHeaderTitle"]');
      return {
        bodySnippet: document.body.innerText.substring(0, 500),
        renderedTitle: companyNameEl ? companyNameEl.innerText : 'Title element not found'
      };
    });

    console.log("[5] RENDERED BROWSER UI TITLE:", uiText.renderedTitle);
    console.log("[6] BROWSER UI BODY SNIPPET:\n", uiText.bodySnippet);

    // Save screenshot
    const outDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    const screenshotPath = path.join(outDir, 'Microsoft_UI_Proof.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n[7] SCREENSHOT SAVED TO: ${screenshotPath}`);

  } catch (err) {
    console.error("Proof Test Exception:", err);
  } finally {
    await browser.close();
  }
})();
