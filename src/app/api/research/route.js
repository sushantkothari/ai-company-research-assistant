import { NextResponse } from 'next/server';
import { searchGoogle } from '@/lib/serper';
import { scrapeWebsiteDeep } from '@/lib/scraper';
import { analyzeCompanyData } from '@/lib/openrouter';

export async function POST(request) {
  try {
    const { query, model } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    let targetUrl = query;
    let searchData = null;

    // 1. Identify if it's a URL or Company Name
    const isUrl = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(query);

    if (!isUrl) {
      // It's a company name, find the official website using Serper
      const searchRes = await searchGoogle(`${query} official website`);
      searchData = searchRes;
      
      if (searchRes && searchRes.organic && searchRes.organic.length > 0) {
        targetUrl = searchRes.organic[0].link;
      } else {
        return NextResponse.json({ error: 'Could not find official website for this company.' }, { status: 404 });
      }
    }

    // 2. Crawl the target website
    const websiteData = await scrapeWebsiteDeep(targetUrl);

    // 3. Search for competitors if needed to enrich context
    let competitorSearchContext = '';
    if (!isUrl) {
      const compRes = await searchGoogle(`${query} competitors alternatives`);
      if (compRes && compRes.organic) {
        competitorSearchContext = compRes.organic.map(r => `${r.title}: ${r.link}`).join('\n');
      }
    } else {
      // Extract domain from url to search
      try {
        const domain = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`).hostname;
        const compRes = await searchGoogle(`${domain} competitors alternatives`);
        if (compRes && compRes.organic) {
          competitorSearchContext = compRes.organic.map(r => `${r.title}: ${r.link}`).join('\n');
        }
      } catch (e) {}
    }

    // 4. Assemble the prompt for OpenRouter
    const prompt = `
      Target Company/URL: ${query}
      Identified Official Website: ${targetUrl}
      
      --- Website Crawl Data ---
      ${websiteData ? websiteData : 'Could not extract website data.'}
      
      --- Google Search Data (for context) ---
      ${searchData ? JSON.stringify(searchData.organic?.slice(0, 3)) : ''}
      
      --- Competitor Search Data ---
      ${competitorSearchContext}
      
      Based on the above data, generate the comprehensive JSON report as requested. 
      Ensure you extract the company name, phone, address, and list their main products/services.
      Generate 3 insightful pain points that this company or its customers might face based on their industry.
      Identify 3-5 real competitors.
    `;

    // 5. Generate AI Analysis
    const result = await analyzeCompanyData(prompt, model);

    // Ensure we fall back to the identified website if the AI misses it
    if (!result.website) {
      result.website = targetUrl;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Research API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
