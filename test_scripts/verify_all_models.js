const fs = require('fs');
const path = require('path');

let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    const match = envFile.match(/OPENROUTER_API_KEY=["']?([^"'\r\n]+)["']?/);
    if (match) OPENROUTER_API_KEY = match[1].trim();
  } catch (e) {
    console.error('Could not read .env.local');
  }
}

if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

async function verifyModels() {
  console.log("Fetching list of available models from local API...");
  let models = [];
  try {
    const res = await fetch('http://localhost:3000/api/models');
    const data = await res.json();
    models = data.models.map(m => m.id);
  } catch (e) {
    console.error("Failed to fetch models from local API:", e);
    process.exit(1);
  }
  
  console.log(`Found ${models.length} models. Starting verification (Concurrency: 10)...`);
  
  const failedModels = [];
  const concurrency = 10;
  
  let i = 0;
  
  const testModel = async (modelId) => {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Company Researcher Verification',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with only the word "Hello"' }],
          max_tokens: 10
        }),
      });
      
      if (!res.ok) {
        const text = await res.text();
        console.log(`❌ [${modelId}] HTTP ${res.status}: ${text}`);
        failedModels.push({ id: modelId, reason: `HTTP ${res.status} - ${text}` });
        return;
      }
      
      const data = await res.json();
      if (!data.choices || data.choices.length === 0) {
        console.log(`❌ [${modelId}] No choices returned`);
        failedModels.push({ id: modelId, reason: "No choices returned" });
        return;
      }
      
      console.log(`✅ [${modelId}] Working`);
    } catch (e) {
      console.log(`❌ [${modelId}] Request Failed: ${e.message}`);
      failedModels.push({ id: modelId, reason: e.message });
    }
  };

  const executeBatch = async () => {
    while (i < models.length) {
      const batch = [];
      for (let j = 0; j < concurrency && i < models.length; j++) {
        batch.push(testModel(models[i]));
        i++;
      }
      await Promise.all(batch);
    }
  };

  await executeBatch();
  
  console.log("\n=============================================");
  console.log("VERIFICATION COMPLETE");
  console.log(`Total Models: ${models.length}`);
  console.log(`Failed Models: ${failedModels.length}`);
  console.log("=============================================\n");
  
  if (failedModels.length > 0) {
    console.log("Failed Models List:");
    failedModels.forEach(f => console.log(`- ${f.id} (${f.reason})`));
  }
  
  fs.writeFileSync(path.join(__dirname, '..', 'outputs', 'model_verification_failures.json'), JSON.stringify(failedModels, null, 2));
}

verifyModels().catch(console.error);
