import { NextResponse } from 'next/server';
// Forced cache refresh: 2026-08-03


export async function POST(request) {
  try {
    const data = await request.json();
    const companyName = data.companyName || data['Company Name'] || data.company || data.name || 'Company';
    if (!companyName || companyName === 'Company') {
      console.warn('Warning: Missing company name in data payload.');
    }

    const sanitize = (val) => (!val || val === 'Information unavailable' || val === 'null' || val === null ? 'Not Available' : val);

    const getArrayContent = (arr, titleKey, descKey) => {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return '<div class="card"><div class="card-desc">Not Available</div></div>';
      
      return arr.map(item => {
        if (typeof item === 'string') {
          return `<div class="card"><div class="card-title">${item}</div></div>`;
        }
        const title = item[titleKey] || item.name || item.topic || item.title || item.company || '';
        const desc = item[descKey] || item.description || item.explanation || item.reason || item.desc || '';
        return `
          <div class="card">
            ${title ? `<div class="card-title">${title}</div>` : ''}
            ${desc ? `<div class="card-desc">${desc}</div>` : ''}
          </div>
        `;
      }).join('');
    };

    const getCompetitorRows = (arr) => {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return '<tr><td colspan="3">No specific competitors identified in the retrieved evidence.</td></tr>';
      return arr.map(c => {
        if (typeof c === 'string') {
          return `
            <tr style="page-break-inside: avoid;">
              <td><strong>${c}</strong></td>
              <td>Not Available</td>
              <td>Direct market competitor</td>
            </tr>
          `;
        }
        const name = c.name || c.company || c.competitor || 'Competitor';
        const rawUrl = c.website || c.url || c.link || 'Not Available';
        const url = rawUrl !== 'Not Available' ? (rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl) : 'Not Available';
        const reason = c.reason || c.description || c.explanation || 'Direct market competitor';
        return `
          <tr style="page-break-inside: avoid;">
            <td><strong>${name}</strong></td>
            <td>${url !== 'Not Available' ? `<a href="${url}" target="_blank">${url}</a>` : 'Not Available'}</td>
            <td>${reason}</td>
          </tr>
        `;
      }).join('');
    };

    const getListContent = (arr) => {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return '<li>Not Available</li>';
      return arr.map(item => `<li>${item}</li>`).join('');
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: letter; margin: 0.8in; }
          body {
            font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            background: #ffffff;
            line-height: 1.6;
          }
          .header-banner {
            border-top: 6px solid #2563eb;
            padding-top: 25px;
            margin-bottom: 35px;
          }
          .subtitle {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .title {
            font-size: 34px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 16px 0;
            letter-spacing: -0.02em;
          }
          .meta-info {
            display: flex;
            gap: 25px;
            font-size: 12px;
            color: #475569;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
          }
          .meta-info div {
            display: flex;
            align-items: center;
          }
          .meta-info strong {
            color: #334155;
            margin-right: 6px;
            font-weight: 600;
          }
          .metadata-bar {
            display: flex;
            background: #f1f5f9;
            padding: 12px 16px;
            border-radius: 6px;
            gap: 20px;
            margin-bottom: 30px;
            font-size: 11px;
            font-family: monospace;
            color: #475569;
            border: 1px solid #cbd5e1;
          }
          .metadata-bar strong {
            color: #0f172a;
            margin-right: 4px;
          }
          h2 {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 30px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
            page-break-after: avoid;
          }
          .section-block {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          p {
            font-size: 13px;
            color: #334155;
            margin: 0 0 12px 0;
            text-align: justify;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            page-break-inside: avoid;
            margin-bottom: 15px;
          }
          .card-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 6px;
          }
          .card-desc {
            font-size: 13px;
            color: #475569;
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12px;
            page-break-inside: avoid;
          }
          th {
            background: #f1f5f9;
            font-weight: 700;
            color: #334155;
            text-align: left;
            padding: 12px 14px;
            border-bottom: 2px solid #cbd5e1;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
          }
          td {
            padding: 12px 14px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
            vertical-align: top;
            line-height: 1.5;
          }
          ul {
            margin: 0;
            padding-left: 20px;
          }
          li {
            font-size: 13px;
            color: #334155;
            margin-bottom: 8px;
          }
          a {
            color: #2563eb;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div class="subtitle">Executive Intelligence Report</div>
          <h1 class="title">${sanitize(companyName)}</h1>
          <div class="meta-info">
            <div><strong>Website:</strong> ${data.website !== 'Not Available' ? `<a href="${data.website}" target="_blank">${sanitize(data.website)}</a>` : 'Not Available'}</div>
            <div><strong>Phone:</strong> ${sanitize(data.phone)}</div>
            <div><strong>Address:</strong> ${sanitize(data.address)}</div>
          </div>
        </div>

        ${data.metadata ? `
        <div class="metadata-bar">
          <div><strong>CONFIDENCE:</strong> ${data.confidenceScore || 90}%</div>
          <div><strong>PAGES CRAWLED:</strong> ${data.metadata.pagesCrawled || 0}</div>
          <div><strong>DURATION:</strong> ${((data.metadata.researchDuration || 0) / 1000).toFixed(1)}s</div>
          <div><strong>MODEL:</strong> ${data.metadata.modelUsed || 'Unknown'}</div>
        </div>
        ` : ''}

        <div class="section-block">
          <h2>Executive Summary</h2>
          <p>${sanitize(data.summary)}</p>
        </div>

        <div class="section-block">
          <h2>Market Positioning</h2>
          <p>${sanitize(data.targetAudience)}</p>
        </div>

        <div class="section-block">
          <h2>Business Model</h2>
          <p>${sanitize(data.businessModel)}</p>
        </div>

        <div class="section-block">
          <h2>Key Observations</h2>
          <ul>
            ${getListContent(data.keyObservations)}
          </ul>
        </div>

        <div class="section-block">
          <h2>Products & Services</h2>
          <div class="grid-2">
            ${getArrayContent(data.products, 'name', 'description')}
          </div>
        </div>

        <div class="section-block">
          <h2>Strategic Challenges & Pain Points</h2>
          <div class="grid-2">
            ${getArrayContent(data.painPoints, 'topic', 'explanation')}
          </div>
        </div>

        <div class="section-block">
          <h2>Strategic Insights</h2>
          <ul>
            ${getListContent(data.strategicInsights)}
          </ul>
        </div>

        <div class="section-block">
          <h2>Competitive Landscape</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 25%">Company</th>
                <th style="width: 30%">Website</th>
                <th style="width: 45%">Strategic Overlap / Differentiator</th>
              </tr>
            </thead>
            <tbody>
              ${getCompetitorRows(data.competitors)}
            </tbody>
          </table>
        </div>

      </body>
      </html>
    `;

    let browser;
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    
    if (isVercel) {
      const puppeteerCore = (await import('puppeteer-core')).default;
      const chromium = (await import('@sparticuz/chromium-min')).default;
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'),
        headless: chromium.headless,
      });
    } else {
      const puppeteerModule = await import('puppeteer');
      const puppeteer = puppeteerModule.default || puppeteerModule;
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }
    
    console.log("=== [/api/pdf RECEIVED JSON] ===", JSON.stringify(data, null, 2));
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      const outDir = path.join(process.cwd(), 'outputs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'Stripe_PDF_Source.html'), htmlContent);
    } catch (e) {
      // Ignored in read-only serverless environments like Vercel
    }
    console.log("=== [/api/pdf SAVED HTML] ===");

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    
    const headerTemplate = `
      <div style="width: 100%; font-size: 8px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #94a3b8; padding: 0 0.8in; display: flex; justify-content: space-between;">
        <span>Relu AI Intelligence</span>
        <span>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    `;

    const footerTemplate = `
      <div style="width: 100%; font-size: 9px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #64748b; padding: 0 0.8in; display: flex; justify-content: space-between; align-items: center;">
        <span>CONFIDENTIAL - FOR INTERNAL REVIEW</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '1in', right: '0.8in', bottom: '1in', left: '0.8in' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate
    });
    
    await browser.close();

    // Ensure buffer is correctly typed for Vercel Node Runtime
    const uint8Array = new Uint8Array(pdfBuffer);
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      const outDir = path.join(process.cwd(), 'outputs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
      fs.writeFileSync(path.join(outDir, `${safeName}_Report.pdf`), pdfBuffer);
    } catch (e) {
      console.error('Failed to write PDF to outputs directory:', e);
    }

    const bypassIdm = request.headers.get('x-bypass-idm') === 'true';

    const headers = {
      'Content-Type': bypassIdm ? 'application/octet-stream' : 'application/pdf',
      'Content-Length': uint8Array.length.toString(),
    };

    if (!bypassIdm) {
      headers['Content-Disposition'] = `inline; filename="${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`;
    }

    return new NextResponse(uint8Array, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
