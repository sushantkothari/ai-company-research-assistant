const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1);
            }
            process.env[match[1].trim()] = val;
        }
    });
}

function cleanJSON(str) {
    let s = str.trim();
    if (s.startsWith('```json')) s = s.substring(7);
    else if (s.startsWith('```')) s = s.substring(3);
    if (s.endsWith('```')) s = s.substring(0, s.length - 3);
    return s.trim();
}

async function runForensic() {
    console.log("====================================================");
    console.log("STARTING FORENSIC INVESTIGATION FOR: Stripe");
    console.log("====================================================\n");

    const query = "Stripe";
    const outDir = path.join(__dirname, '..', 'outputs');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    let report = "# Forensic Investigation: Stripe\n\n";

    // ----------------------------------------------------
    // 2. SERPER
    // ----------------------------------------------------
    console.log("--> Running Serper...");
    let serperData;
    try {
        const serperRes = await axios.post('https://google.serper.dev/search', {
            q: `${query} company official website`,
            num: 3
        }, {
            headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }
        });
        
        const competitorRes = await axios.post('https://google.serper.dev/search', {
            q: `${query} top competitors alternatives`,
            num: 5
        }, {
            headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }
        });

        const officialWebsite = serperRes.data.organic?.[0]?.link || "Not Found";
        const competitorUrls = competitorRes.data.organic?.map(r => r.link) || [];
        
        serperData = {
            officialWebsite,
            competitorQuery: `${query} top competitors alternatives`,
            rawResponseTopLevel: JSON.stringify(competitorRes.data.organic?.slice(0,2), null, 2),
            competitorUrls
        };

        report += "## 2. SERPER\n```\n";
        report += `Official Website Returned: ${officialWebsite}\n`;
        report += `Competitor Search Query: ${query} top competitors alternatives\n`;
        report += `Competitor URLs Returned:\n${competitorUrls.join('\n')}\n`;
        report += `Raw Serper Response (first 2 organic):\n${serperData.rawResponseTopLevel}\n`;
        report += "```\n\n";
        console.log("Serper Complete. Official URL:", officialWebsite);
    } catch (e) {
        console.error("Serper failed", e.message);
        return;
    }

    // ----------------------------------------------------
    // 1. WEBSITE CRAWLER
    // ----------------------------------------------------
    console.log("--> Running Website Crawler...");
    let crawlData;
    try {
        const cheerio = require('cheerio');
        
        let baseUrl = serperData.officialWebsite;
        if (!/^https?:\/\//i.test(baseUrl)) baseUrl = 'https://' + baseUrl;
        
        const { data: homeData } = await axios.get(baseUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000
        });
        const $ = cheerio.load(homeData);
        
        const IMPORTANT_PAGES = ['about', 'products', 'product', 'services', 'service', 'solutions', 'solution', 'pricing', 'contact', 'careers'];
        const linksToCrawl = new Set();
        const foundImportantLinks = [];
        
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                const lowerHref = href.toLowerCase();
                if (lowerHref.includes('login') || lowerHref.includes('signup') || lowerHref.includes('auth') || lowerHref.includes('cart')) return;
                for (const page of IMPORTANT_PAGES) {
                    if (lowerHref.includes(page)) {
                        try {
                            const absUrl = new URL(href, baseUrl).href;
                            if (new URL(absUrl).origin === new URL(baseUrl).origin) {
                                if (!linksToCrawl.has(absUrl)) {
                                    linksToCrawl.add(absUrl);
                                    foundImportantLinks.push({ url: absUrl, priority: IMPORTANT_PAGES.indexOf(page) });
                                }
                            }
                        } catch(e){}
                    }
                }
            }
        });
        
        foundImportantLinks.sort((a, b) => a.priority - b.priority);
        const urlsToCrawl = foundImportantLinks.map(l => l.url).slice(0, 5);
        
        report += "## 1. WEBSITE CRAWLER\n```\n";
        report += `Pages Discovered (Important): ${foundImportantLinks.length}\n`;
        report += `Pages Actually Crawled (Max 5): ${urlsToCrawl.length + 1} (including home)\n`;
        report += `URLs:\n  - ${baseUrl} (Home)\n  - ${urlsToCrawl.join('\n  - ')}\n`;
        
        function extractText(ch) {
            ch('script, style, nav, footer, iframe, noscript').remove();
            let text = ch('body').text() || '';
            return text.replace(/\s+/g, ' ').trim();
        }
        
        const homeText = extractText($);
        let totalTextLength = homeText.length;
        
        report += `\n[Home Page]\nExtracted Length: ${homeText.length}\nFirst 500 chars: ${homeText.substring(0, 500)}\n`;
        
        const subpageRequests = urlsToCrawl.map(url => axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }).catch(e => null));
        const subResults = await Promise.all(subpageRequests);
        
        for (let i=0; i<subResults.length; i++) {
            if (subResults[i] && subResults[i].data) {
                const subText = extractText(cheerio.load(subResults[i].data));
                totalTextLength += subText.length;
                report += `\n[${urlsToCrawl[i]}]\nExtracted Length: ${subText.length}\nFirst 500 chars: ${subText.substring(0, 500)}\n`;
            }
        }
        
        report += `\nTotal Extracted Text Length: ${totalTextLength}\n`;
        report += "```\n\n";
        
        crawlData = {
            totalTextLength
        };
        console.log("Crawler Complete. Total length:", totalTextLength);
        
    } catch (e) {
        console.error("Crawler failed", e.message);
        return;
    }

    // ----------------------------------------------------
    // 3. OPENROUTER
    // ----------------------------------------------------
    console.log("--> Generating OpenRouter Request...");
    let openRouterData;
    try {
        const contextText = `(Crawled ${crawlData.totalTextLength} chars...)\n(Serper URLs: ${serperData.competitorUrls.join(', ')})`;
        const prompt = `You are a strict JSON data extractor.
Analyze the following company: ${query}

CONTEXT:
${contextText}

Extract and return ONLY a valid JSON object matching this schema exactly:
{
  "companyName": "string",
  "website": "string",
  "summary": "string",
  "products": ["string"],
  "painPoints": ["string"],
  "competitors": [
    { "name": "string", "website": "string", "reasoning": "string" }
  ]
}`;
        const model = 'meta-llama/llama-3.3-70b-instruct';
        
        report += "## 3. OPENROUTER\n```\n";
        report += `Exact Model: ${model}\n`;
        report += `Exact Prompt (Truncated Context for brevity):\n${prompt}\n\n`;

        console.log("--> Sending to OpenRouter...");
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'AI Company Researcher'
            }
        });

        const rawResponse = response.data.choices[0].message.content;
        report += `Raw Response:\n${rawResponse}\n\n`;
        
        const cleanedStr = cleanJSON(rawResponse);
        const parsed = JSON.parse(cleanedStr);
        const tokens = response.data.usage || {};
        
        report += `Token Count: Prompt=${tokens.prompt_tokens}, Completion=${tokens.completion_tokens}, Total=${tokens.total_tokens}\n\n`;
        report += `Parsed JSON:\n${JSON.stringify(parsed, null, 2)}\n`;
        report += "```\n\n";
        
        openRouterData = parsed;
        console.log("OpenRouter Complete.");

    } catch (e) {
        console.error("OpenRouter failed", e.response?.data || e.message);
        return;
    }

    // ----------------------------------------------------
    // 4. PDF
    // ----------------------------------------------------
    console.log("--> Generating PDF...");
    try {
        const data = openRouterData;
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${data.companyName} - Research Report</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 40px; background-color: #f9fafb; }
    h1 { color: #111827; font-size: 28px; margin-bottom: 10px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #1f2937; font-size: 20px; margin-top: 30px; margin-bottom: 15px; }
    .header-box { background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 30px; }
    .header-box p { margin: 5px 0; }
    .section-box { background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px; page-break-inside: avoid; }
    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 8px; page-break-inside: avoid; }
    table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 15px; }
    th { background-color: #f3f4f6; color: #374151; font-weight: 600; text-align: left; padding: 12px; border: 1px solid #e5e7eb; }
    td { padding: 12px; border: 1px solid #e5e7eb; vertical-align: top; word-break: break-all; overflow-wrap: break-word; }
    tr { page-break-inside: avoid; }
    .col-name { width: 25%; }
    .col-url { width: 30%; }
    .col-reason { width: 45%; }
  </style>
</head>
<body>
  <div class="header-box">
    <h1>${data.companyName || 'Unknown Company'}</h1>
    <p><strong>Website:</strong> <a href="${data.website}">${data.website}</a></p>
  </div>
  <div class="section-box">
    <h2>Executive Summary</h2>
    <p>${data.summary}</p>
  </div>
  <div class="section-box">
    <h2>Products & Services</h2>
    <ul>${(data.products || []).map(p => `<li>${p}</li>`).join('')}</ul>
  </div>
  <div class="section-box">
    <h2>Key Pain Points</h2>
    <ul>${(data.painPoints || []).map(p => `<li>${p}</li>`).join('')}</ul>
  </div>
  <div class="section-box">
    <h2>Competitor Analysis</h2>
    <table>
      <thead>
        <tr><th class="col-name">Competitor</th><th class="col-url">Website</th><th class="col-reason">Reasoning</th></tr>
      </thead>
      <tbody>
        ${(data.competitors || []).map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><a href="${c.website}">${c.website}</a></td>
            <td>${c.reasoning}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

        const htmlPath = path.join(outDir, 'Stripe.html');
        fs.writeFileSync(htmlPath, htmlContent);
        
        report += "## 4. PDF\n```\n";
        report += `HTML Generated: YES\n`;
        report += `HTML Saved To: outputs/Stripe.html (${htmlContent.length} bytes)\n`;

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        report += `Puppeteer Launches: YES\n`;
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });
        await browser.close();

        const pdfPath = path.join(outDir, 'Stripe_Forensic.pdf');
        fs.writeFileSync(pdfPath, pdfBuffer);

        const mimeType = "application/pdf"; 
        const first20 = pdfBuffer.slice(0, 20).toString('hex');
        
        report += `PDF Buffer Size: ${pdfBuffer.length} bytes\n`;
        report += `Final PDF Size: ${fs.statSync(pdfPath).size} bytes\n`;
        report += `MIME Type: ${mimeType}\n`;
        report += `First 20 Bytes (Hex): ${first20}\n`;

        const isPdf = pdfBuffer.toString('utf8', 0, 5) === '%PDF-';
        report += `PDF starts with %PDF-: ${isPdf}\n`;
        report += "```\n\n";

        console.log("PDF Complete. Size:", pdfBuffer.length);

    } catch (e) {
        console.error("PDF failed", e.message);
        return;
    }

    const reportPath = path.join(outDir, 'forensic_report.md');
    fs.writeFileSync(reportPath, report);
    console.log("Forensic Report saved to outputs/forensic_report.md");
}

runForensic();
