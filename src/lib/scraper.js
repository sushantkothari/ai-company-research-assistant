import axios from 'axios';
import * as cheerio from 'cheerio';

const IMPORTANT_PAGES = ['about', 'products', 'product', 'services', 'service', 'solutions', 'solution', 'pricing', 'contact', 'careers'];

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

// Wrapper to retry failed axios requests
async function fetchWithRetry(url, options, retries = 0) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, options);
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(res => setTimeout(res, 500));
    }
  }
}

export async function scrapeWebsiteDeep(baseUrl) {
  try {
    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = 'https://' + baseUrl;
    }
    
    // 1. Fetch the home page
    const { data } = await fetchWithRetry(baseUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 4000 // 4s timeout for home page
    }, 0);
    
    const $ = cheerio.load(data);
    
    const linksToCrawl = new Set();
    // Prioritize links
    const foundImportantLinks = [];
    
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const lowerHref = href.toLowerCase();
        // Ignore auth, cart, and irrelevant links immediately
        if (lowerHref.includes('login') || lowerHref.includes('signup') || lowerHref.includes('auth') || lowerHref.includes('cart')) return;
        
        for (const page of IMPORTANT_PAGES) {
          if (lowerHref.includes(page)) {
            try {
              const absUrl = new URL(href, baseUrl).href;
              // Strict same-origin check to avoid escaping domain boundaries
              if (new URL(absUrl).origin === new URL(baseUrl).origin) {
                if (!linksToCrawl.has(absUrl)) {
                  linksToCrawl.add(absUrl);
                  foundImportantLinks.push({ url: absUrl, priority: IMPORTANT_PAGES.indexOf(page) });
                }
              }
            } catch (e) {
              // Ignore invalid URLs
            }
          }
        }
      }
    });

    // Sort by priority (lower index is better)
    foundImportantLinks.sort((a, b) => a.priority - b.priority);
    const urlsToCrawl = foundImportantLinks.map(l => l.url).slice(0, 5); // Take top 5 subpages

    const contentHashes = new Set();
    const homeText = extractText($);
    contentHashes.add(hashText(homeText));

    let combinedText = `[Home Page]\n${homeText}\n\n`;
    let pagesCrawled = 1;
    
    // 2. Fetch subpages in parallel
    const subpageRequests = urlsToCrawl.map(url => 
      fetchWithRetry(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 3000 // 3s timeout for subpages
      }, 0)
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
          pagesCrawled++;
        }
      } else {
        console.warn(`Skipping inaccessible subpage ${urlsToCrawl[index]}`);
      }
    });

    // Enforce hard limit of 18000 chars for LLM context window safety
    return {
      text: combinedText.substring(0, 18000),
      pagesCrawled
    };
    
  } catch (error) {
    console.error(`Error scraping deep ${baseUrl}:`, error.message);
    return { text: null, pagesCrawled: 0 };
  }
}

function extractText($) {
  // Aggressively remove irrelevant HTML nodes
  $('script, style, noscript, iframe, img, svg, nav, footer, header, form, button').remove();
  
  // Replace semantic tags with spaces to ensure words don't mash together
  $('p, div, br, h1, h2, h3, h4, h5, h6, li').each(function() {
    $(this).append(' ');
  });

  let text = $('body').text();
  // Collapse whitespace completely
  return text.replace(/\s+/g, ' ').trim().substring(0, 4000); // Slightly more text per page
}
