const axios = require('axios');
const fs = require('fs');

async function testPdf() {
  try {
    const data = JSON.parse(fs.readFileSync('./outputs/30_company_eval.json', 'utf8') || "{}");
    const testData = {
      companyName: "Test Company",
      targetAudience: "Everyone",
      businessModel: "B2C",
      products: ["Product A"],
      competitors: ["Competitor B"],
      keyObservations: ["Observation 1"],
      strategicInsights: ["Insight 1"],
      contactDetails: {
        phone: "123", address: "123", email: "test", socials: { twitter: "x" }
      }
    };
    
    console.log("Sending PDF generation request...");
    const res = await axios.post('http://localhost:3000/api/pdf', testData, {
      responseType: 'arraybuffer'
    });
    console.log("PDF generation response:", res.status, res.data.length, "bytes");
    fs.writeFileSync('./outputs/TestLocalPDF.pdf', res.data);
  } catch (e) {
    console.error("PDF generation failed:", e.message);
  }
}

testPdf();
