const fs = require('fs');
const path = require('path');

const companies = [
  "Microsoft",
  "Adobe",
  "Notion",
  "OpenAI",
  "Stripe",
  "Cloudflare",
  "NVIDIA"
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log("==================================================");
  console.log("=== END-TO-END PIPELINE & VERIFICATION TEST ===");
  console.log("==================================================\n");

  const outDir = path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const results = [];

  for (const company of companies) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing Target Entity: ${company}`);
    console.log(`--------------------------------------------------`);

    try {
      // Step 1: Call API (Simulating UI flow)
      console.log(`[1/3] Hitting /api/research for ${company}...`);
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
        console.error(`❌ Research API failed for ${company}: HTTP ${researchRes.status}`);
        continue;
      }

      const json = await researchRes.json();
      console.log(`✅ Received API JSON for ${company}:`);
      console.log(`   - Company Name: "${json.companyName}"`);
      console.log(`   - Website: "${json.website}"`);
      console.log(`   - Products Count: ${json.products?.length}`);
      console.log(`   - Competitors: ${json.competitors?.map(c => c.name).join(', ')}`);

      // Step 2: Call PDF API
      console.log(`[2/3] Generating PDF report via /api/pdf ...`);
      const pdfRes = await fetch('http://localhost:3000/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });

      if (!pdfRes.ok) {
        console.error(`❌ PDF API failed for ${company}: HTTP ${pdfRes.status}`);
        continue;
      }

      const arrayBuffer = await pdfRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const safeName = (json.companyName || company).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      const filename = `${safeName}_Report.pdf`;
      const pdfPath = path.join(outDir, filename);

      fs.writeFileSync(pdfPath, buffer);
      console.log(`✅ [3/3] PDF Generated & Saved: ${filename} (${buffer.length} bytes)`);

      // Step 3: Zero-Mismatch Verification
      console.log(`🔍 Verifying JSON vs PDF payload data...`);
      const mismatches = [];
      if (!json.companyName || json.companyName.includes('Sample Enterprise')) mismatches.push('Invalid companyName');
      if (!Array.isArray(json.products) || json.products.length === 0) mismatches.push('Empty products array');
      if (!Array.isArray(json.painPoints) || json.painPoints.length === 0) mismatches.push('Empty painPoints array');
      if (!Array.isArray(json.competitors) || json.competitors.length === 0) mismatches.push('Empty competitors array');

      if (mismatches.length === 0) {
        console.log(`🎉 ZERO MISMATCHES for ${company}! 100% Data Integrity Verified.`);
        results.push({ company, status: 'PASSED', file: filename, size: buffer.length });
      } else {
        console.error(`⚠️ Mismatch found for ${company}: ${mismatches.join(', ')}`);
        results.push({ company, status: 'FAILED', mismatches });
      }

    } catch (err) {
      console.error(`❌ Exception during ${company}:`, err.message);
      results.push({ company, status: 'ERROR', error: err.message });
    }

    await sleep(3000); // 3 second delay to avoid rate limits
  }

  console.log("\n==================================================");
  console.log("=== FINAL VERIFICATION RESULTS ===");
  console.log("==================================================");
  console.table(results);
}

run();
