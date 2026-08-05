const fs = require('fs');
const path = require('path');

const COMPANIES = [
  'BrowserStack', 'Chargebee', 'Freshworks', 'LambdaTest', 'Observe.ai',
  'Databricks', 'Snowflake', 'Palantir', 'CloudBees', 'Cohere',
  'Kingston', 'Corsair', 'Gigabyte', 'ASRock', 'Findability.ai',
  'Daydreamsoft Infotech LLP', 'TechAvidus', 'GalaxEye', 'Uniphore', 'Hasura',
  'Kissflow', 'Postman', 'CRED', 'Zepto', 'Agnikul',
  'Redis', 'Hashicorp', 'SentinelOne', 'Intel', 'Supabase'
];

async function runEvaluator() {
  console.log('🚀 Starting Release Candidate Evaluator (Phase 1-3)...');
  const targetHost = process.argv.includes('--target=vercel') 
    ? 'https://ai-company-researcher.vercel.app' 
    : 'http://localhost:3000';
  
  console.log(`Target: ${targetHost}`);
  
  const results = [];
  let passedCount = 0;
  
  for (const company of COMPANIES) {
    console.log(`\n=============================================`);
    console.log(`Evaluating: ${company}`);
    console.log(`=============================================`);
    
    let success = true;
    let failureReasons = [];
    
    try {
      const startTime = Date.now();
      const res = await fetch(`${targetHost}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: company, model: 'meta-llama/llama-3.3-70b-instruct' })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${await res.text()}`);
      }
      
      const data = await res.json();
      
      if (!data || data.error) {
         throw new Error(data?.error || 'Empty JSON response');
      }

      // Check pages crawled
      if (data.metadata?.pagesCrawled === 0) {
        failureReasons.push('pages_crawled === 0 (Scraper failed entirely)');
      }
      
      // Check competitors
      if (data.competitors && data.competitors.length > 0) {
        const comp = data.competitors[0];
        const name = comp.name || comp.company || comp;
        if (typeof name === 'string' && name.split(' ').length === 1 && name.length < 3) {
          failureReasons.push('Empty or single-word competitor anomaly');
          success = false;
        }
      } else {
        failureReasons.push('No competitors identified');
      }
      
      // Check Not Available frequency
      let notAvailCount = 0;
      const strData = JSON.stringify(data);
      const matches = strData.match(/Not Available/g);
      if (matches && matches.length > 3) {
         failureReasons.push(`High frequency of "Not Available" (${matches.length} instances)`);
         success = false;
      }
      
      // Check vague ICPs
      if (data.targetAudience) {
         const lower = data.targetAudience.toLowerCase();
         if (lower === 'businesses' || lower === 'consumers' || lower.length < 20) {
            failureReasons.push('Vague ICP detected');
            success = false;
         }
      } else {
         failureReasons.push('Target Audience missing');
         success = false;
      }
      
      if (success) passedCount++;
      
      results.push({
        company,
        success,
        duration: Date.now() - startTime,
        pagesCrawled: data.metadata?.pagesCrawled || 0,
        failureReasons
      });
      
      if (success) {
         console.log(`✅ ${company} Passed (${data.metadata?.pagesCrawled} pages scraped)`);
      } else {
         console.log(`❌ ${company} Failed: ${failureReasons.join(', ')}`);
      }
      
    } catch (e) {
      console.log(`❌ ${company} Exception: ${e.message}`);
      results.push({
        company,
        success: false,
        duration: 0,
        pagesCrawled: 0,
        failureReasons: [e.message]
      });
    }
  }
  
  console.log('\n=============================================');
  console.log('EVALUATION SUMMARY');
  console.log('=============================================');
  console.log(`Score: ${passedCount}/${COMPANIES.length} (${Math.round((passedCount/COMPANIES.length)*100)}%)`);
  
  const outDir = path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  
  fs.writeFileSync(path.join(outDir, 'rc_failure_report.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    targetHost,
    score: `${passedCount}/${COMPANIES.length}`,
    passRate: `${Math.round((passedCount/COMPANIES.length)*100)}%`,
    results
  }, null, 2));
  
  console.log(`Detailed report saved to outputs/rc_failure_report.json`);
}

runEvaluator().catch(console.error);
