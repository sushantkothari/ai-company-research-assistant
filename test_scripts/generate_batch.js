const fs = require('fs');
const path = require('path');

const companies = [
  "Microsoft",
  "NVIDIA",
  "Stripe",
  "OpenAI",
  "Notion",
  "Adobe",
  "Cloudflare"
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const outDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  for (const company of companies) {
    console.log(`\n===========================================`);
    console.log(`Processing ${company}...`);
    try {
      // Step 1: Research
      console.log(`Fetching research data for ${company}...`);
      const researchRes = await fetch('http://localhost:3000/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: company,
          model: 'meta-llama/llama-3.3-70b-instruct',
          openRouterKey: process.env.OPENROUTER_API_KEY || "",
          serperKey: process.env.SERPER_API_KEY || ""
        })
      });

      if (!researchRes.ok) {
        console.error(`[Error] Research failed for ${company}:`, await researchRes.text());
        continue;
      }

      const data = await researchRes.json();
      console.log(`Got data for ${company}! Company Name in data: ${data.companyName}`);

      // Step 2: PDF
      console.log(`Generating PDF for ${company}...`);
      const pdfRes = await fetch('http://localhost:3000/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!pdfRes.ok) {
        console.error(`[Error] PDF generation failed for ${company}:`, await pdfRes.text());
        continue;
      }

      const arrayBuffer = await pdfRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const companyName = data.companyName || data['Company Name'] || data.company || data.name || 'Company';
      const safeName = companyName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      const filename = `${safeName}_Report.pdf`;

      fs.writeFileSync(path.join(outDir, filename), buffer);
      console.log(`[Success] Saved ${filename} (${buffer.length} bytes)`);

    } catch (err) {
      console.error(`[Exception] Processing ${company} failed:`, err);
    }

    await sleep(2000); // delay
  }
}

run();
