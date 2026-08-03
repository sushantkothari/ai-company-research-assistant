const fs = require('fs');
const path = require('path');

const data = {
  companyName: "Microsoft",
  website: "https://microsoft.com",
  phone: "Not publicly listed",
  address: "One Microsoft Way, Redmond, WA 98052",
  summary: "Microsoft is a multinational technology corporation which produces computer software, consumer electronics, personal computers, and related services.",
  targetAudience: "Global consumers and enterprise businesses.",
  products: [
    { name: "Windows", description: "Operating system for personal computers." },
    { name: "Azure", description: "Cloud computing platform and services." }
  ],
  painPoints: [
    { topic: "Security", explanation: "Continuous need to patch vulnerabilities across a vast ecosystem." }
  ],
  competitors: [
    { name: "Apple", website: "apple.com", reason: "Competes in OS and hardware." }
  ]
};

(async () => {
  console.log("Hitting API...");
  try {
    const res = await fetch('http://localhost:3000/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      console.error("API Failed with status:", res.status);
      console.log(await res.text());
      return;
    }
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const outDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    
    fs.writeFileSync(path.join(outDir, 'Microsoft_Report_API.pdf'), buffer);
    console.log('Saved Microsoft_Report_API.pdf. Size:', buffer.length);
  } catch (err) {
    console.error("Error:", err);
  }
})();
