const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const selectedModel = await page.evaluate(() => {
    const select = document.querySelector('select');
    return select ? select.value : 'No select found';
  });

  console.log("==================================================");
  console.log("DEFAULT SELECTED MODEL IN UI:", selectedModel);
  console.log("==================================================");
  await browser.close();
})();
