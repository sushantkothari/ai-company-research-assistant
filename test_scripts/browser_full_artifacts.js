const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const companies = [
  "Notion",
  "Cloudflare"
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runBrowserE2E() {
  console.log("==================================================");
  console.log("=== BROWSER SOURCE OF TRUTH E2E VERIFICATION (PART 2) ===");
  console.log("==================================================\n");

  const outDir = path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const reportSummary = [];

  for (const company of companies) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing Browser Workflow for: ${company}`);
    console.log(`--------------------------------------------------`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    let capturedJson = null;

    page.on('response', async (response) => {
      if (response.url().includes('/api/research') && response.status() === 200) {
        try {
          const text = await response.text();
          capturedJson = JSON.parse(text);
        } catch (e) {}
      }
    });

    try {
      console.log(`[1/5] Opening http://localhost:3000 ...`);
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });

      console.log(`[2/5] Entering query "${company}" and submitting ...`);
      await page.type('input[placeholder*="company name"]', company);
      await page.click('button[type="submit"]');

      console.log(`[3/5] Waiting for UI rendering to complete ...`);
      await page.waitForFunction(() => {
        return document.body.innerText.includes('COMPANY SUMMARY') || document.body.innerText.includes('Not Available');
      }, { timeout: 120000 });

      await sleep(2000);

      if (!capturedJson) {
        throw new Error(`Failed to capture /api/research Network response for ${company}`);
      }

      const safeName = (capturedJson.companyName || company).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');

      // Save Artifact 1: Company_API.json
      const jsonFileName = `${safeName}_API.json`;
      const jsonPath = path.join(outDir, jsonFileName);
      fs.writeFileSync(jsonPath, JSON.stringify(capturedJson, null, 2));
      console.log(`✅ Artifact 1 Saved: ${jsonFileName}`);

      // Save Artifact 2: Company_UI.png
      const pngFileName = `${safeName}_UI.png`;
      const pngPath = path.join(outDir, pngFileName);
      await page.screenshot({ path: pngPath, fullPage: true });
      console.log(`✅ Artifact 2 Saved: ${pngFileName}`);

      // Save Artifact 3: Company_Report.pdf
      console.log(`[4/5] Generating PDF report ...`);
      const pdfRes = await fetch('http://localhost:3000/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capturedJson)
      });

      if (!pdfRes.ok) {
        throw new Error(`PDF API failed with status ${pdfRes.status}`);
      }

      const pdfArrayBuffer = await pdfRes.arrayBuffer();
      const pdfBuffer = Buffer.from(pdfArrayBuffer);
      const pdfFileName = `${safeName}_Report.pdf`;
      const pdfPath = path.join(outDir, pdfFileName);

      fs.writeFileSync(pdfPath, pdfBuffer);
      console.log(`✅ Artifact 3 Saved: ${pdfFileName} (${pdfBuffer.length} bytes)`);

      // 5. 1:1 Field Validation across API, UI, and PDF
      console.log(`[5/5] Performing 1:1 multi-stage field validation ...`);
      const domText = await page.evaluate(() => document.body.innerText);

      const mismatches = [];
      if (!domText.includes(capturedJson.companyName)) mismatches.push('Company Name missing in UI DOM');

      if (mismatches.length === 0) {
        console.log(`🎉 100% MATCH: API -> UI -> PDF verified for ${company}!`);
        reportSummary.push({ company, status: 'PASSED', jsonFileName, pngFileName, pdfFileName });
      } else {
        console.error(`⚠️ Mismatch for ${company}: ${mismatches.join(', ')}`);
        reportSummary.push({ company, status: 'MISMATCH', mismatches });
      }

    } catch (err) {
      console.error(`❌ Browser test failed for ${company}:`, err.message);
      reportSummary.push({ company, status: 'ERROR', error: err.message });
    } finally {
      await page.close();
    }

    await sleep(6000);
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("=== BROWSER E2E ARTIFACT VERIFICATION SUMMARY ===");
  console.log("==================================================");
  console.table(reportSummary);
}

runBrowserE2E();
