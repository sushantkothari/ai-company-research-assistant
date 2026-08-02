import axios from 'axios';
import * as cheerio from 'cheerio';

const IMPORTANT_PAGES = ['about', 'product', 'service', 'solution', 'contact', 'pricing'];

// Simple hash function for duplicate content detection
function hashText(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

export async function scrapeWebsiteDeep(baseUrl) {
  try {
    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = 'https://' + baseUrl;
    }
    
    // 1. Fetch the home page
    const { data } = await axios.get(baseUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 8000 // 8s timeout to avoid hanging
    });
    
    const $ = cheerio.load(data);
    
    const linksToCrawl = new Set();
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const lowerHref = href.toLowerCase();
        // Ignore auth and irrelevant links immediately
        if (lowerHref.includes('login') || lowerHref.includes('signup') || lowerHref.includes('auth') || lowerHref.includes('cart')) return;
        
        for (const page of IMPORTANT_PAGES) {
          if (lowerHref.includes(page)) {
            try {
              const absUrl = new URL(href, baseUrl).href;
              // Strict same-origin check to avoid escaping domain boundaries
              if (new URL(absUrl).origin === new URL(baseUrl).origin) {
                linksToCrawl.add(absUrl);
              }
            } catch (e) {
              // Ignore invalid URLs
            }
          }
        }
      }
    });

    const contentHashes = new Set();
    const homeText = extractText($);
    contentHashes.add(hashText(homeText));

    let combinedText = `[Home Page]\n${homeText}\n\n`;
    
    // Limit to max 4 subpages to prevent LLM context overflow and speed up scraping
    const urlsToCrawl = Array.from(linksToCrawl).slice(0, 4);
    
    // 2. Fetch subpages in parallel
    const subpageRequests = urlsToCrawl.map(url => 
      axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 5000 // Shorter timeout for subpages
      })
    );

    const results = await Promise.allSettled(subpageRequests);

    results.forEach((res, index) => {
      if (res.status === 'fulfilled' && res.value?.data) {
        const subUrl = urlsToCrawl[index];
        const sub$ = cheerio.load(res.value.data);
        const subText = extractText(sub$);
        
        const textHash = hashText(subText);
        // Ensure we aren't adding duplicate text (e.g. if 'about' and 'contact' redirect to same page)
        if (!contentHashes.has(textHash) && subText.length > 50) {
          contentHashes.add(textHash);
          combinedText += `[${subUrl}]\n${subText}\n\n`;
        }
      } else {
        console.warn(`Failed to crawl subpage ${urlsToCrawl[index]}:`, res.reason?.message);
      }
    });

    // Enforce hard limit of 15000 chars for LLM context window safety
    return combinedText.substring(0, 15000);
    
  } catch (error) {
    console.error(`Error scraping deep ${baseUrl}:`, error.message);
    return null;
  }
}

function extractText($) {
  // Aggressively remove irrelevant HTML nodes
  $('script, style, noscript, iframe, img, svg, nav, footer, header, form, button').remove();
  let text = $('body').text();
  // Collapse whitespace completely
  return text.replace(/\s+/g, ' ').trim().substring(0, 3000);
}
