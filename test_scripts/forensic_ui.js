const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function runUIForensic() {
    console.log("====================================================");
    console.log("STARTING UI FORENSIC INVESTIGATION FOR: Stripe");
    console.log("====================================================\n");

    const query = "Stripe";
    const outDir = path.join(__dirname, '..', 'outputs');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    let apiRawJson = null;

    page.on('response', async (response) => {
        if (response.url().includes('/api/research') && response.status() === 200) {
            try {
                const text = await response.text();
                apiRawJson = JSON.parse(text);
                
                const apiPath = path.join(outDir, 'Stripe_API_Raw.json');
                fs.writeFileSync(apiPath, JSON.stringify(apiRawJson, null, 2));
                console.log(`Saved Stripe_API_Raw.json`);
            } catch (e) {
                console.error("Failed to parse API response", e);
            }
        }
    });

    // 1. User submits "Stripe"
    console.log(`Loading localhost:3000...`);
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    console.log(`Submitting query: ${query}...`);
    await page.type('input[placeholder*="company name"]', query);
    await page.click('button[type="submit"]');

    // Wait for research to complete
    await page.waitForFunction(() => {
        return document.body.innerText.includes('COMPANY SUMMARY') || document.body.innerText.includes('Not Available');
    }, { timeout: 120000 });

    await new Promise(r => setTimeout(r, 2000));

    // UI Screenshots and extraction
    const pngPath = path.join(outDir, 'Stripe_UI.png');
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`Saved Stripe_UI.png`);

    // Extract what React actually rendered for Competitors
    const renderedData = await page.evaluate(() => {
        const compCards = Array.from(document.querySelectorAll('[class*="compCard"]'));
        return compCards.map(card => {
            const name = card.querySelector('[class*="compName"]')?.innerText;
            const url = card.querySelector('[class*="compUrl"]')?.innerText;
            const reason = card.querySelector('[class*="compReason"]')?.innerText || null;
            return { name, url, reason };
        });
    });

    const renderedPath = path.join(outDir, 'Stripe_RenderedData.json');
    fs.writeFileSync(renderedPath, JSON.stringify(renderedData, null, 2));
    console.log(`Saved Stripe_RenderedData.json`);

    // Click download PDF to intercept the request
    let pdfRequestJson = null;
    page.on('request', request => {
        if (request.url().includes('/api/pdf') && request.method() === 'POST') {
            try {
                pdfRequestJson = JSON.parse(request.postData());
                const reqPath = path.join(outDir, 'Stripe_PDF_Request.json');
                fs.writeFileSync(reqPath, JSON.stringify(pdfRequestJson, null, 2));
                console.log(`Saved Stripe_PDF_Request.json`);
            } catch(e) {}
        }
    });

    console.log(`Clicking Download PDF...`);
    // Need to trigger download to capture request to /api/pdf
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download PDF Report'));
        if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 3000));

    await browser.close();
    
    console.log("\n====================================================");
    console.log("UI FORENSIC TRACE COMPLETED");
    console.log("====================================================\n");
}

runUIForensic();
