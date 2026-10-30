/**
 * Spieltest-Bot im Browser (Playwright, ohne Bildschirm). Vorher `npm run build`.
 * Aufruf: node tools/bot.cjs "<URL-Parameter>" <sea|crater|glacier> <Runs> <Sekunden> <bericht.json>
 * Beispiel: node tools/bot.cjs "seed=7&kapitel2" sea 4 300 bericht.json
 * Zusammenfassung: python3 tools/bot-summary.py bericht.json
 * Optional BASE=http://localhost:5173/ für den Entwicklungsserver.
 */
const { chromium } = require('playwright');
(async () => {
  const [,, query, mode, runs, seconds, outFile] = process.argv;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
  const errors = [];
  const warnings = {};
  page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') { const k = m.text().slice(0, 120); warnings[k] = (warnings[k] || 0) + 1; }
  });
  await page.goto((process.env.BASE || 'file:///home/user/SurfGuy/dist/index.html') + `?bot&${query}`);
  await page.waitForFunction(() => window.surfguy?.phase === 'home' && window.surfguyBot, null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  const t0 = Date.now();
  const report = await page.evaluate(async (o) => window.surfguyBot.runMany(o), { runs: Number(runs), seconds: Number(seconds), mode });
  const result = { query, mode, realSeconds: Math.round((Date.now() - t0) / 1000), report, errors, warnings };
  require('fs').writeFileSync(outFile, JSON.stringify(result, null, 1));
  console.log(`fertig in ${result.realSeconds}s, Fehler: ${errors.length}`);
  await browser.close();
})();
