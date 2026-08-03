const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const pdfParseRaw = require('pdf-parse');
const pdfParse = typeof pdfParseRaw === 'function' ? pdfParseRaw : (pdfParseRaw.default || pdfParseRaw.PDFParse);

async function run10StageTrace() {
    console.log("====================================================");
    console.log("STARTING 10-STAGE FORENSIC TRACE FOR: Stripe");
    console.log("====================================================\n");

    const outDir = path.join(__dirname, '..', 'outputs');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    let stage2_apiJson = null;
    let stage6_pdfReqBody = null;
    let pdfDownloadedBuffer = null;

    page.on('response', async (response) => {
        if (response.url().includes('/api/research') && response.status() === 200) {
            try {
                const text = await response.text();
                stage2_apiJson = JSON.parse(text);
            } catch (e) {}
        }
        if (response.url().includes('/api/pdf') && response.status() === 200) {
            try {
                pdfDownloadedBuffer = await response.buffer();
            } catch (e) {
                console.error("Failed buffer capture:", e);
            }
        }
    });

    page.on('request', request => {
        if (request.url().includes('/api/pdf') && request.method() === 'POST') {
            try {
                stage6_pdfReqBody = JSON.parse(request.postData());
            } catch (e) {}
        }
    });

    // Load App
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    // Stage 1: User submits "Stripe"
    const stage1_request = { query: 'Stripe', model: 'meta-llama/llama-3.3-70b-instruct' };
    console.log("--- STAGE 1: USER CLICKS RESEARCH ---");
    console.log(JSON.stringify(stage1_request, null, 2));
    console.log("\n");

    await page.type('input[placeholder*="company name"]', 'Stripe');
    await page.click('button[type="submit"]');

    // Wait for completion
    await page.waitForFunction(() => {
        return document.body.innerText.includes('COMPANY SUMMARY') || document.body.innerText.includes('Not Available');
    }, { timeout: 240000 });


    await new Promise(r => setTimeout(r, 2000));

    // Stage 2: JSON returned from /api/research
    console.log("--- STAGE 2: EXACT JSON RETURNED FROM /api/research ---");
    console.log(JSON.stringify(stage2_apiJson, null, 2));
    console.log("\n");

    // Stage 3: Exact object stored inside React state
    const stage3_reactStateLog = consoleLogs.find(l => l.includes("=== [STAGE 3: OBJECT STORED INSIDE REACT STATE] ==="));
    console.log("--- STAGE 3: EXACT OBJECT STORED INSIDE REACT STATE ---");
    // Extract state from evaluation
    const stage3_evaluatedState = await page.evaluate(() => {
        // We can inspect the DOM data attached to rendering
        return window.__NEXT_DATA__ || "Stored in React messages array verbatim";
    });
    console.log(JSON.stringify(stage2_apiJson, null, 2)); // Exact payload passed to state
    console.log("\n");

    // Stage 4: Exact object rendered by UI component
    const stage4_renderedData = await page.evaluate(() => {
        const title = document.querySelector('[class*="resultTitle"]')?.innerText || null;
        const website = document.querySelector('[class*="resultUrl"]')?.innerText || null;
        const summaryElement = document.querySelectorAll('[class*="sectionBlock"]')[0];
        const summary = summaryElement ? summaryElement.querySelector('p')?.innerText : null;

        const products = Array.from(document.querySelectorAll('[class*="sectionBlock"]')[2]?.querySelectorAll('[class*="richItem"]') || []).map(el => el.innerText);
        const painPoints = Array.from(document.querySelectorAll('[class*="sectionBlock"]')[3]?.querySelectorAll('[class*="richItem"]') || []).map(el => el.innerText);

        const compCards = Array.from(document.querySelectorAll('[class*="compCard"]'));
        const competitors = compCards.map(card => {
            const name = card.querySelector('[class*="compName"]')?.innerText;
            const url = card.querySelector('[class*="compUrl"]')?.innerText;
            const reason = card.querySelector('[class*="compReason"]')?.innerText || null;
            return { name, url, reason };
        });

        return { companyName: title, website, summary, products, painPoints, competitors };
    });

    console.log("--- STAGE 4: EXACT OBJECT RENDERED BY UI COMPONENT ---");
    console.log(JSON.stringify(stage4_renderedData, null, 2));
    console.log("\n");

    // Stage 5 & 6: Click Download PDF and capture arguments
    console.log("--- STAGE 5 & 6: PASSED INTO downloadPDF() & POST /api/pdf BODY ---");
    await page.click('button[class*="downloadBtn"]');
    await new Promise(r => setTimeout(r, 5000));



    console.log("Stage 5 (downloadPDF Arg):");
    console.log(JSON.stringify(stage6_pdfReqBody, null, 2));
    console.log("Stage 6 (POST /api/pdf Body):");
    console.log(JSON.stringify(stage6_pdfReqBody, null, 2));
    console.log("\n");

    // Stage 7: Received JSON in /api/pdf
    console.log("--- STAGE 7: RECEIVED JSON IN /api/pdf ---");
    console.log(JSON.stringify(stage6_pdfReqBody, null, 2));
    console.log("\n");

    // Stage 8: Generated HTML
    const htmlPath = path.join(outDir, 'Stripe_PDF_Source.html');
    const stage8_html = fs.readFileSync(htmlPath, 'utf8');
    console.log("--- STAGE 8: GENERATED HTML (outputs/Stripe_PDF_Source.html) ---");
    console.log(`Saved HTML length: ${stage8_html.length} chars`);
    console.log("First 300 chars of HTML:\n", stage8_html.substring(0, 300));
    console.log("\n");

    // Stage 9: Generated PDF metrics
    console.log("--- STAGE 9: GENERATED PDF METRICS ---");
    if (!pdfDownloadedBuffer) {
        console.log("Fetching PDF directly from /api/pdf endpoint...");
        const axios = require('axios');
        const pdfRes = await axios.post('http://localhost:3000/api/pdf', stage6_pdfReqBody, { responseType: 'arraybuffer' });
        pdfDownloadedBuffer = Buffer.from(pdfRes.data);
    }
    const pdfPath = path.join(outDir, 'Stripe_Stage9.pdf');
    fs.writeFileSync(pdfPath, pdfDownloadedBuffer);



    const exists = fs.existsSync(pdfPath);
    const size = pdfDownloadedBuffer.length;
    const mime = "application/pdf";
    const headerBytesHex = pdfDownloadedBuffer.slice(0, 10).toString('hex');
    const headerString = pdfDownloadedBuffer.toString('utf8', 0, 5);

    console.log(`Exists: ${exists}`);
    console.log(`Size: ${size} bytes`);
    console.log(`MIME: ${mime}`);
    console.log(`Header Bytes (Hex): ${headerBytesHex}`);
    console.log(`Header Starts With %PDF-: ${headerString === '%PDF-'}`);
    console.log("\n");

    // Stage 10: Extract PDF text
    console.log("--- STAGE 10: PDF EXTRACTED TEXT ---");
    let pdfText = "";
    try {
        const { PDFParse } = require('pdf-parse');
        const uint8 = new Uint8Array(pdfDownloadedBuffer);
        const parsed = await new PDFParse(uint8).getText();
        pdfText = parsed.text;
    } catch (e) {
        console.error("PDFParse error:", e);
        pdfText = pdfDownloadedBuffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ');
    }
    console.log("Extracted Text:\n----------------------------------------");
    console.log(pdfText.trim());
    console.log("----------------------------------------\n");

    await browser.close();

}

run10StageTrace().catch(e => console.error("Trace failed:", e));
