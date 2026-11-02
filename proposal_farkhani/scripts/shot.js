const { chromium } = require('playwright');
(async () => {
  const [,, html, png] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 820 }, deviceScaleFactor: 2 });
  await p.goto('file://' + html);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const ok = await p.evaluate(() => document.fonts.check('700 48px Naskh'));
  console.log('font loaded:', ok);
  await p.locator('svg').screenshot({ path: png });
  await b.close();
})();
