const puppeteer = require('puppeteer');
const fs = require('fs');
const zlib = require('zlib');
const PDFParse = require('pdf-parse');

async function testPdfText() {
    const html1 = `<!DOCTYPE html><html><head><style>body { font-family: Arial, sans-serif; }</style></head><body><h1>Hello World Stripe Report</h1><p>This is a test paragraph for Stripe.</p></body></html>`;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setContent(html1, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
        format: 'Letter',
        margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
        printBackground: true
    });

    await browser.close();

    const parsed = await PDFParse(pdfBuffer);
    console.log("PDF Parse Extracted Text:", repr(parsed.text));
}

function repr(str) {
    return JSON.stringify(str);
}

testPdfText();
