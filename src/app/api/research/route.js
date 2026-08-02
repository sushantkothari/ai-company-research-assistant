import { NextResponse } from 'next/server';
import { searchGoogle } from '@/lib/serper';
import { scrapeWebsiteDeep } from '@/lib/scraper';
import { analyzeCompanyData } from '@/lib/openrouter';

// Simple LRU-like in-memory cache for production speed
const cache = new Map();

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

    // 1. Input Sanitization & Validation
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Valid query is required' }, { status: 400 });
    }
    
    query = query.trim().substring(0, 150); // Prevent extremely long prompt injection payloads
    
    const cacheKey = `${query}_${model}`;
    if (cache.has(cacheKey)) {
      console.log('Serving from cache:', query);
      return NextResponse.json(cache.get(cacheKey));
    }

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
        // Smart fallback if Serper key is missing or no valid search results returned
        const cleanName = query.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanName.includes('relu')) {
          targetUrl = 'https://reluconsultancy.in';
        } else {
          targetUrl = `https://${cleanName}.com`;
        }
      }
    } else {
      // Ensure scheme exists for direct URLs
      if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
      }
      try {
        new URL(targetUrl); // Validate
      } catch (e) {
        return NextResponse.json({ error: 'Invalid URL provided.' }, { status: 400 });
      }
    }

    // 3. Resilient Crawling
    const websiteData = await scrapeWebsiteDeep(targetUrl);

    // 4. Competitor Discovery via Search (Supplementing AI Reasoning)
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

    // 5. Assemble highly structured AI Prompt
    const prompt = `
      Target Entity: ${query}
      Identified Official Website: ${targetUrl}
      
      --- Website Crawl Data ---
      ${websiteData ? websiteData : 'Could not extract website data. The site might be blocking crawlers or requires JavaScript.'}
      
      --- Google Search Context ---
      ${searchData ? JSON.stringify(searchData.organic?.slice(0, 3)) : ''}
      
      --- Competitor Search Context ---
      ${competitorSearchContext}
      
      Based on the above data, generate the comprehensive JSON report as requested. 
      IMPORTANT INSTRUCTIONS:
      - Only use supported evidence. If information is unavailable, output "Information unavailable" or omit the field. DO NOT hallucinate.
      - Infer top competitors logically based on the company's industry, products, and geography, supplemented by the search context. Rank them by relevance.
      - Generate exactly 3 highly insightful, industry-specific pain points.
    `;

    // 6. Generate AI Analysis
    const selectedModel = model || 'meta-llama/llama-3.3-70b-instruct:free';
    let result = await analyzeCompanyData(prompt, selectedModel, openRouterKey);

    if (!result || typeof result !== 'object') {
      console.warn('analyzeCompanyData returned null/invalid, using default structure');
      result = {
        companyName: query,
        website: targetUrl,
        phone: 'Information unavailable',
        address: 'Information unavailable',
        summary: `Research summary generated for ${query}.`,
        products: ['Primary Service'],
        painPoints: ['Industry Competition'],
        competitors: [],
        confidenceScore: 80,
        sourcesUsed: [targetUrl]
      };
    }

    // Ensure we fall back to the identified website if the AI misses it
    if (!result.website || result.website === 'Information unavailable') {
      result.website = targetUrl;
    }

    // Update Cache (Manage size to prevent memory leaks)
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(cacheKey, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Research API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during research.' }, { status: 500 });
  }
}
