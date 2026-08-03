import axios from 'axios';
import * as cheerio from 'cheerio';
const IMPORTANT_PAGES = ['about', 'products', 'product', 'services', 'service', 'solutions', 'solution', 'pricing', 'contact', 'careers'];

function hashText(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

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

async function scrapeWithPuppeteer(baseUrl) {
  let browser = null;
  try {
    console.log(`Fallback to Puppeteer for ${baseUrl}`);
    
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    
    if (isVercel) {
      const puppeteerCore = (await import('puppeteer-core')).default;
      const chromium = (await import('@sparticuz/chromium-min')).default;
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'),
        headless: chromium.headless,
      });
    } else {
      const puppeteerModule = await import('puppeteer');
      const puppeteer = puppeteerModule.default || puppeteerModule;
      browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
      });
    }
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    const tryExtract = async (url) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3500)); // wait for cloudflare
      const html = await page.content();
      const $ = cheerio.load(html);
      return extractText($);
    };
    
    let homeText = await tryExtract(baseUrl);
    
    // If Cloudflare blocked the home page, try the about page which might be less strictly cached/blocked
    if (homeText.length < 200 || homeText.toLowerCase().includes('cloudflare') || homeText.toLowerCase().includes('just a moment')) {
       console.log('Puppeteer home page blocked or short, trying /about...');
       const aboutUrl = baseUrl.endsWith('/') ? baseUrl + 'about' : baseUrl + '/about';
       const aboutText = await tryExtract(aboutUrl);
       if (aboutText.length > 200 && !aboutText.toLowerCase().includes('cloudflare')) {
         homeText = aboutText;
       }
    }
    
    await browser.close();
    
    if (homeText.length < 200) {
      throw new Error('Puppeteer extracted insufficient text (possible bot protection)');
    }
    
    return {
      text: `[Scraped Page]\n${homeText}\n\n`,
      pagesCrawled: 1
    };
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

export async function scrapeWebsiteDeep(baseUrl) {
  try {
    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = 'https://' + baseUrl;
    }
    
    let data = null;
    let fallbackToPuppeteer = false;
    
    try {
      const res = await fetchWithRetry(baseUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 4000
      }, 0);
      data = res.data;
    } catch (e) {
      fallbackToPuppeteer = true;
    }
    
    if (!fallbackToPuppeteer) {
      const $ = cheerio.load(data);
      const homeText = extractText($);
      
      // If Cloudflare block page or very short
      if (homeText.length < 300 || homeText.toLowerCase().includes('cloudflare') || homeText.toLowerCase().includes('just a moment')) {
        fallbackToPuppeteer = true;
      } else {
        const linksToCrawl = new Set();
        const foundImportantLinks = [];
        
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const lowerHref = href.toLowerCase();
            if (lowerHref.includes('login') || lowerHref.includes('signup') || lowerHref.includes('auth') || lowerHref.includes('cart')) return;
            
            for (const page of IMPORTANT_PAGES) {
              if (lowerHref.includes(page)) {
                try {
                  const absUrl = new URL(href, baseUrl).href;
                  if (new URL(absUrl).origin === new URL(baseUrl).origin) {
                    if (!linksToCrawl.has(absUrl)) {
                      linksToCrawl.add(absUrl);
                      foundImportantLinks.push({ url: absUrl, priority: IMPORTANT_PAGES.indexOf(page) });
                    }
                  }
                } catch (e) {}
              }
            }
          }
        });

        foundImportantLinks.sort((a, b) => a.priority - b.priority);
        const urlsToCrawl = foundImportantLinks.map(l => l.url).slice(0, 5);

        const contentHashes = new Set();
        contentHashes.add(hashText(homeText));

        let combinedText = `[Home Page]\n${homeText}\n\n`;
        let pagesCrawled = 1;
        
        const subpageRequests = urlsToCrawl.map(url => 
          fetchWithRetry(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 3000
          }, 0)
        );

        const results = await Promise.allSettled(subpageRequests);

        results.forEach((res, index) => {
          if (res.status === 'fulfilled' && res.value?.data) {
            const subUrl = urlsToCrawl[index];
            const sub$ = cheerio.load(res.value.data);
            const subText = extractText(sub$);
            
            const textHash = hashText(subText);
            if (!contentHashes.has(textHash) && subText.length > 50) {
              contentHashes.add(textHash);
              combinedText += `[${subUrl}]\n${subText}\n\n`;
              pagesCrawled++;
            }
          }
        });

        return {
          text: combinedText.substring(0, 18000),
          pagesCrawled
        };
      }
    }
    
    if (fallbackToPuppeteer) {
      try {
        return await scrapeWithPuppeteer(baseUrl);
      } catch (puppeteerErr) {
        console.error(`Puppeteer fallback failed for ${baseUrl}:`, puppeteerErr.message);
        return { text: null, pagesCrawled: 0 };
      }
    }
    
  } catch (error) {
    console.error(`Error scraping deep ${baseUrl}:`, error.message);
    return { text: null, pagesCrawled: 0 };
  }
}

function extractText($) {
  $('script, style, noscript, iframe, img, svg, nav, footer, header, form, button').remove();
  $('p, div, br, h1, h2, h3, h4, h5, h6, li').each(function() {
    $(this).append(' ');
  });
  let text = $('body').text();
  return text.replace(/\s+/g, ' ').trim().substring(0, 4000);
}
