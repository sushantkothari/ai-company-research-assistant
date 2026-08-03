const fs = require('fs');
const path = require('path');

async function testMicrosoft() {
  console.log("==================================================");
  console.log("=== EXECUTING PIPELINE FOR: Microsoft ===");
  console.log("==================================================");

  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
  const serperKey = process.env.SERPER_API_KEY || "";

  // Step 1: Research
  console.log("\n[1] POSTing to http://localhost:3000/api/research ...");
  const researchRes = await fetch('http://localhost:3000/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Microsoft',
      openRouterKey: openRouterKey,
      serperKey: serperKey
    })
  });

  console.log("[1] HTTP Status Code:", researchRes.status);
  const jsonText = await researchRes.text();
  console.log("\n=== RAW JSON RETURNED BY /api/research ===");
  console.log(jsonText);
  console.log("==========================================\n");

  if (!researchRes.ok) {
    console.error("Research failed!");
    return;
  }

  const data = JSON.parse(jsonText);

  // Step 2: PDF Generation
  console.log("[2] POSTing to http://localhost:3000/api/pdf ...");
  const pdfRes = await fetch('http://localhost:3000/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  console.log("[2] HTTP Status Code:", pdfRes.status);
  if (!pdfRes.ok) {
    console.error("PDF generation failed!");
    return;
  }

  const arrayBuffer = await pdfRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const companyName = data.companyName || data['Company Name'] || data.company || data.name || 'Company';
  const safeName = companyName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const filename = `${safeName}_Report.pdf`;

  const outDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  const pdfPath = path.join(outDir, filename);
  fs.writeFileSync(pdfPath, buffer);

  console.log(`\n[3] PDF GENERATED SUCCESSFULLY!`);
  console.log(`Saved File: ${pdfPath}`);
  console.log(`File Size: ${buffer.length} bytes`);
  console.log("==================================================\n");
}

testMicrosoft();
