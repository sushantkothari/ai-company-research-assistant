import { NextResponse } from 'next/server';
import { searchGoogle } from '@/lib/serper';
import { scrapeWebsiteDeep } from '@/lib/scraper';
import { analyzeCompanyData } from '@/lib/openrouter';

const BLOCKED_DOMAINS = [
  'wikipedia.org', 'linkedin.com', 'facebook.com', 'crunchbase.com', 
  'bloomberg.com', 'g2.com', 'capterra.com', 'yelp.com', 'glassdoor.com',
  'yahoo.com', 'forbes.com', 'zoominfo.com', 'owler.com', 'pitchbook.com',
  'twitter.com', 'x.com', 'instagram.com', 'tiktok.com'
];

function isBlockedDomain(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(domain => hostname.includes(domain));
  } catch (e) {
    return true; // Invalid URL
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    let { query, model, openRouterKey, serperKey } = body;
    const startTime = Date.now();

    // 1. Input Sanitization & Validation
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Valid query is required' }, { status: 400 });
    }
    
    query = query.trim().substring(0, 150);
    console.log('\n==================================================');
    console.log('=== [1. INPUT QUERY] ===:', query);

    let targetUrl = query;
    let searchData = null;

    // 2. Robust URL Detection
    const isUrl = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(query);

    if (!isUrl) {
      // Find official website using Serper
      const searchRes = await searchGoogle(`${query} official website`, serperKey);
      searchData = searchRes;
      
      let foundValidUrl = false;
      if (searchRes && Array.isArray(searchRes.organic)) {
        for (const result of searchRes.organic) {
          if (!isBlockedDomain(result.link)) {
            targetUrl = result.link;
            foundValidUrl = true;
            break;
          }
        }
      }
      
      if (!foundValidUrl) {
        const cleanName = query.toLowerCase().replace(/[^a-z0-9]/g, '');
        targetUrl = `https://${cleanName}.com`;
      }
    } else {
      if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
      }
      try {
        new URL(targetUrl);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid URL provided.' }, { status: 400 });
      }
    }

    console.log('=== [2. SERPER OFFICIAL URL] ===:', targetUrl);

    // 3. Resilient Crawling
    const scraperResult = await scrapeWebsiteDeep(targetUrl);
    const websiteData = scraperResult ? scraperResult.text : null;
    const pagesCrawled = scraperResult ? scraperResult.pagesCrawled : 0;
    console.log('=== [3. CRAWLER EXTRACTED LENGTH] ===:', websiteData ? websiteData.length : 0, 'characters');

    // 4. Competitor Discovery via Search
    let competitorSearchContext = '';
    let domainForSearch = query;
    if (isUrl) {
      try {
         domainForSearch = new URL(targetUrl).hostname.replace('www.', '');
      } catch (e) {}
    }
    const compRes = await searchGoogle(`${domainForSearch} top competitors alternatives software industry`, serperKey);
    if (compRes && Array.isArray(compRes.organic)) {
      competitorSearchContext = compRes.organic.slice(0, 5).map(r => `${r.title}: ${r.link}`).join('\n');
    }
    console.log('=== [4. SERPER COMPETITOR SEARCH CONTEXT] ===:', competitorSearchContext ? competitorSearchContext.substring(0, 150) + '...' : 'None');

    // 5. Assemble highly structured AI Prompt
    const prompt = `
      Target Entity: ${query}
      Identified Official Website: ${targetUrl}
      
      --- Website Crawl Data ---
      ${websiteData ? websiteData : 'Could not extract website data.'}
      
      --- Google Search Context ---
      ${searchData ? JSON.stringify(searchData.organic?.slice(0, 3)) : ''}
      
      --- Competitor Search Context ---
      ${competitorSearchContext}
      
      Based on the above data, generate the comprehensive JSON report as requested.
    `;

    // 6. Generate AI Analysis
    const selectedModel = model || 'meta-llama/llama-3.3-70b-instruct';
    console.log('=== [5. OPENROUTER REQUEST SENT] === Model:', selectedModel);
    
    let result = await analyzeCompanyData(prompt, selectedModel, openRouterKey);

    // Final Sanitization Pass (Replace any residual "Information unavailable" strings with "Not Available")
    const sanitizeStr = (str) => (!str || str.includes('Information unavailable') || str.includes('unavailable') ? 'Not Available' : str);

    result.website = sanitizeStr(result.website === 'Not Available' ? targetUrl : result.website);
    result.phone = sanitizeStr(result.phone);
    result.address = sanitizeStr(result.address);
    result.targetAudience = sanitizeStr(result.targetAudience);
    result.metadata = {
      researchDuration: Date.now() - startTime,
      pagesCrawled: pagesCrawled,
      modelUsed: selectedModel
    };

    console.log('=== [6. OPENROUTER RETURNED & SANITIZED JSON] ===:', JSON.stringify(result, null, 2));
    console.log('=== [7. RETURNED TO UI] === Status 200 OK');
    console.log('==================================================\n');
    return NextResponse.json(result);

  } catch (error) {
    console.error('=== [ERROR OCCURRED IN RESEARCH PIPELINE] ===:', error.message);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred during research.' }, { status: 500 });
  }
}
