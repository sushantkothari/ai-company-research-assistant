const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FREE_MODELS = [
  { id: 'poolside/laguna-s-2.1:free', name: 'Poolside Laguna S 2.1' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron-3 Ultra 550B' },
  { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B' },
  { id: 'inclusionai/ling-3.0-flash:free', name: 'Ling 3.0 Flash' },
  { id: 'cohere/north-mini-code:free', name: 'Cohere North Mini' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron-3 Super 120B' }
];

async function verifyModels() {
  console.log('Starting Verification of Free Models...\n');
  const validModels = [];

  for (const model of FREE_MODELS) {
    console.log(`=============================================`);
    console.log(`Evaluating Model: ${model.name} (${model.id})`);
    console.log(`=============================================`);

    try {
      // 1. Hit the Research Endpoint
      console.log(`⏳ Triggering Research API...`);
      const researchRes = await axios.post('http://localhost:3000/api/research', {
        query: 'Vercel',
        model: model.id
      }, { timeout: 180000 });

      const data = researchRes.data;

      if (!data || !data.companyName) {
        throw new Error('Invalid JSON response or missing companyName.');
      }

      console.log(`✅ Research Succeeded! JSON keys: ${Object.keys(data).length}`);

      // 2. Hit the PDF Endpoint
      console.log(`⏳ Triggering PDF API...`);
      const pdfRes = await axios.post('http://localhost:3000/api/pdf', data, {
        responseType: 'arraybuffer',
        timeout: 90000
      });

      if (!pdfRes.data || pdfRes.data.byteLength < 100) {
        throw new Error('PDF Generation returned an empty or invalid buffer.');
      }

      // 3. Save PDF to outputs folder
      const outDir = path.join(__dirname, '../outputs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const filename = `Verification_${model.name.replace(/ /g, '_')}.pdf`;
      fs.writeFileSync(path.join(outDir, filename), pdfRes.data);

      console.log(`✅ PDF Generated Successfully: ${filename} (${pdfRes.data.byteLength} bytes)`);
      validModels.push(model);
      console.log(`🟢 ${model.name} is VALID.\n`);

    } catch (err) {
      console.error(`❌ Model ${model.name} FAILED! Reason: ${err.message}`);
      if (err.response && err.response.data) {
          try {
             console.error(`   Data: ${Buffer.from(err.response.data).toString('utf8').substring(0, 200)}`);
          } catch(e) {}
      }
      console.log(`🔴 ${model.name} will be removed from the list.\n`);
    }
  }

  console.log('=== VERIFICATION SUMMARY ===');
  console.log(`Verified ${validModels.length} out of ${FREE_MODELS.length} free models.`);
  console.log('Valid models to keep:');
  console.log(JSON.stringify(validModels, null, 2));
}

verifyModels();
