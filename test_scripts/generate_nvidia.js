const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'outputs');

async function fixNvidia() {
  console.log('Generating NVIDIA report...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1080 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="text"]');

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/pdf') && response.request().method() === 'POST') {
      try {
        const pdfBuffer = await response.buffer();
        fs.writeFileSync(path.join(outDir, 'NVIDIA_Report.pdf'), pdfBuffer);
        console.log('✅ Saved NVIDIA_Report.pdf');
      } catch(e) {}
    }
  });

  await page.type('input[type="text"]', 'NVIDIA');
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => {
    const els = document.querySelectorAll('div');
    return Array.from(els).some(el => el.innerText.includes('RESEARCH COMPLETE'));
  }, { timeout: 120000 });

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(outDir, 'NVIDIA_UI.png'), fullPage: true });

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const dlBtn = btns.find(b => b.innerText.includes('Download PDF Report'));
    if (dlBtn) dlBtn.click();
  });

  await new Promise(r => setTimeout(r, 6000));
  await browser.close();
  console.log('Done fixing NVIDIA.');
}

fixNvidia().catch(console.error);
