const { chromium } = require('playwright');
const fs = require('fs');
const steps = process.argv[3].split(' ');
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['sv', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript((l) => { localStorage.setItem('rpv.lang', l); localStorage.setItem('rpv.mode', 'concept'); localStorage.setItem('rpv.api', 'opengl'); }, lang);
    await page.goto('http://localhost:4173/#/intro/1'); await page.waitForTimeout(3000);
    for (const s of steps) {
      const name = s.replace('#/', '').replace('/', '-');
      const file = `${out}/${lang}/${name}.png`;
      if (fs.existsSync(file)) continue;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto('http://localhost:4173/' + s); await page.waitForTimeout(2500 + attempt * 1500);
          const box = await page.locator('.slide .visual').last().boundingBox();
          await page.screenshot({ path: file, clip: box });
          console.log('ok', lang, name);
          break;
        } catch (e) { console.log('retry', lang, name, String(e).split('\n')[0]); }
      }
    }
    await page.close();
  }
  await browser.close();
})();
