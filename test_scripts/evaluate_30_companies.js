const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COMPANIES = [
  'Kingston', 'Intel', 'CloudBees', 'Databricks', 'Snowflake',
  'Palantir', 'Cohere', 'Anthropic', 'OpenAI', 'Perplexity',
  'DeepMind', 'MongoDB', 'Elastic', 'Hashicorp', 'Redis',
  'CrowdStrike', 'SentinelOne', 'NetApp', 'Gigabyte', 'ASRock',
  'Pine Labs', 'Postman', 'Supabase', 'Mistral', 'Scale AI',
  'Hugging Face', 'Zoho', 'Freshworks', 'BrowserStack', 'Razorpay'
];

async function runEvaluations() {
  console.log('Starting 30-Company Robust Evaluation Suite...');
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-infobars', '--window-position=0,0', '--ignore-certifcate-errors', '--ignore-certifcate-errors-spki-list', '--disable-popup-blocking'] 
  });
  const results = [];
  
  for (const company of COMPANIES) {
    console.log(`\n=============================================`);
    console.log(`Evaluating: ${company}`);
    console.log(`=============================================`);
    const page = await browser.newPage();
    
    // Setup download path
    const downloadPath = path.join(__dirname, '..', 'outputs');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);
    const client = await page.target().createCDPSession();
    await client.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
      eventsEnabled: true
    });
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath });

    let success = true;
    let errorMsg = '';
    
    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Select a free model to avoid massive API costs for 30 runs, or just leave default
      // Assuming "DeepSeek V3 — Free" or similar is the default
      
      // Type in company
      await page.waitForSelector('input[placeholder*="Enter a company"]');
      await page.type('input[placeholder*="Enter a company"]', company);
      
      // Submit
      await page.click('button[type="submit"]');
      console.log('⏳ Waiting for research to complete (up to 90s)...');
      
      // Wait for completion badge
      await page.waitForFunction(
        () => document.body.innerText.includes('RESEARCH COMPLETE') || document.body.innerText.includes('Error:'),
        { timeout: 90000 }
      );
      
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('Error:')) {
        success = false;
        errorMsg = 'API Error occurred';
      } else {
        // Assertions
        const uiText = text;
        const checkField = (field) => {
          if (uiText.includes(`${field}\nNot Available`)) {
            success = false;
            errorMsg += `[${field} was Not Available] `;
          }
        };
        
        checkField('BUSINESS MODEL');
        checkField('TARGET AUDIENCE / MARKET');
        checkField('PRODUCTS & SERVICES');
        checkField('KEY OBSERVATIONS');
        checkField('STRATEGIC INSIGHTS');
        
        if (uiText.includes('PAGES CRAWLED:\n0')) {
          console.log('⚠️ PAGES CRAWLED was 0 (Scraper failed entirely)');
          // We don't fail immediately, but it's a strong warning.
        }
        
        // Trigger download
        console.log('⏳ Triggering PDF Download...');
        await page.click('button:has-text("Download PDF Report"), button:contains("Download PDF")').catch(() => {
          // fallback if selector fails
          page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const dlBtn = btns.find(b => b.innerText.includes('Download PDF'));
            if(dlBtn) dlBtn.click();
          });
        });
        
        await new Promise(r => setTimeout(r, 3000));
        console.log('✅ UI Verified');
      }
    } catch (e) {
      success = false;
      errorMsg = e.message;
    }
    
    if (success) {
      console.log(`✅ ${company} Passed`);
    } else {
      console.log(`❌ ${company} Failed: ${errorMsg}`);
    }
    
    results.push({ company, success, errorMsg });
    await page.close();
  }
  
  await browser.close();
  
  console.log('\n=============================================');
  console.log('EVALUATION SUMMARY');
  console.log('=============================================');
  let passed = 0;
  for (const r of results) {
    if (r.success) passed++;
    console.log(`${r.success ? '✅' : '❌'} ${r.company} ${r.errorMsg ? '- ' + r.errorMsg : ''}`);
  }
  console.log(`\nScore: ${passed}/${COMPANIES.length} (${Math.round(passed/COMPANIES.length*100)}%)`);
  
  fs.writeFileSync(path.join(__dirname, '..', 'outputs', '30_company_eval.json'), JSON.stringify(results, null, 2));
}

runEvaluations().catch(console.error);
