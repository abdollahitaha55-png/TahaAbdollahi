// Renders scripts/conceptual_model.html to proposal/conceptual_model.png at 2x.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto('file://' + path.join(root, 'scripts', 'conceptual_model.html'));
  await page.waitForTimeout(300);
  await page.locator('#fig').screenshot({ path: path.join(root, 'proposal', 'conceptual_model.png') });
  await browser.close();
  console.log('rendered proposal/conceptual_model.png');
})().catch(e => { console.error(e); process.exit(1); });
