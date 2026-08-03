const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const companies = [
  'Microsoft',
  'NVIDIA',
  'Stripe',
  'OpenAI',
  'Adobe',
  'Notion',
  'Cloudflare'
];

const outDir = path.join(__dirname, '..', 'outputs');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runEvaluation() {
  console.log('Starting UI Evaluation Protocol...');
  const browser = await puppeteer.launch({
    headless: true, // Need true for environment
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1080 });

  // Enable download behavior
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: outDir
  });

  for (const company of companies) {
    console.log(`\n=============================================`);
    console.log(`Evaluating: ${company}`);
    console.log(`=============================================`);
    
    // Refresh page for clean state
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for input to be ready
    await page.waitForSelector('input[type="text"]', { timeout: 60000 });

    let apiJson = null;
    let pdfBuffer = null;
    let pdfDownloaded = false;

    // Listen for responses
    const responseHandler = async (response) => {
      const url = response.url();
      if (url.includes('/api/research') && response.request().method() === 'POST') {
        try {
          apiJson = await response.json();
          fs.writeFileSync(
            path.join(outDir, `${company}_API.json`), 
            JSON.stringify(apiJson, null, 2)
          );
          console.log(`✅ Saved API JSON for ${company}`);
        } catch(e) {}
      }
      if (url.includes('/api/pdf') && response.request().method() === 'POST') {
        try {
          pdfBuffer = await response.buffer();
          fs.writeFileSync(
            path.join(outDir, `${company}_Report.pdf`), 
            pdfBuffer
          );
          console.log(`✅ Saved PDF for ${company}`);
          pdfDownloaded = true;
        } catch(e) {}
      }
    };

    page.on('response', responseHandler);

    // Type query
    await page.focus('input[type="text"]');
    // Clear input first just in case
    await page.evaluate(() => {
      document.querySelector('input[type="text"]').value = '';
    });
    await page.type('input[type="text"]', company);
    await page.click('button[type="submit"]');
    
    console.log(`⏳ Waiting for research to complete...`);
    // Wait for the Complete Badge
    try {
      await page.waitForFunction(() => {
        const els = document.querySelectorAll('div');
        return Array.from(els).some(el => el.innerText.includes('RESEARCH COMPLETE'));
      }, { timeout: 120000 });
      console.log(`✅ UI Rendered "RESEARCH COMPLETE"`);
    } catch(e) {
      console.log(`❌ Timeout waiting for UI render for ${company}`);
    }

    // Wait for animation to settle
    await new Promise(r => setTimeout(r, 2000));

    // Take UI Screenshot
    try {
      await page.screenshot({ 
        path: path.join(outDir, `${company}_UI.png`),
        fullPage: true 
      });
      console.log(`✅ Saved UI Screenshot for ${company}`);
    } catch (e) {
      console.log(`❌ Failed to save screenshot for ${company}`);
    }

    // Click Download PDF
    console.log(`⏳ Triggering PDF Download...`);
    try {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dlBtn = btns.find(b => b.innerText.includes('Download PDF Report'));
        if (dlBtn) dlBtn.click();
      });
      
      // Wait for PDF to be intercepted
      for (let i = 0; i < 20; i++) {
        if (pdfDownloaded) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      console.log(`❌ Failed to trigger/download PDF for ${company}`);
    }
    
    // Clean up listener
    page.off('response', responseHandler);
  }

  await browser.close();
  console.log('\n🎉 All evaluations completed successfully.');
}

runEvaluation().catch(console.error);
