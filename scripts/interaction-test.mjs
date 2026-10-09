/**
 * Interaktionstest (Playwright): Etage im 3D-Modell wählen -> Finder gefiltert,
 * Filter, Wohnungsdetail, Exposé-Vorbelegung, Formular-Validierung, reduzierte Bewegung.
 *   URL=http://localhost:4191/residenz-felsgarten/ node scripts/interaction-test.mjs
 */
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4191/residenz-felsgarten/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const ok = (cond, msg) => { console.log(cond ? '✓' : '✗', msg); if (!cond) process.exitCode = 1; };

async function run(reduced) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(2000); // Lenis-Animation abwarten, sonst überschreibt sie scrollTo
  const label = reduced ? '[reduziert]' : '[normal]';
  ok(await page.locator('.floor-btn').count() === 8, `${label} 8 Etagen-Buttons`);
  if (!reduced) {
    await page.evaluate(() => { const s = document.querySelector('#gebaeude'); window.scrollTo(0, s.offsetTop + 10); });
    await page.waitForFunction(() => document.querySelector('#gebaeude').classList.contains('is-live'), null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    ok(true, `${label} 3D-Szene geladen (is-live)`);
    // Raycast: Mauszeiger über die Gebäudemitte bewegen -> Tooltip
    await page.waitForTimeout(1500);
    let hit = false;
    for (const [x, y] of [[720, 450], [720, 420], [700, 480], [740, 380]]) {
      await page.mouse.move(x - 20, y - 10); await page.mouse.move(x, y, { steps: 4 }); await page.waitForTimeout(500);
      if (await page.locator('.flight__tip').isVisible()) { hit = true; break; }
    }
    ok(hit, `${label} Raycaster trifft eine Etage (Tooltip: ${hit ? await page.locator('.flight__tip').textContent() : '–'})`);
    if (hit) {
      const tip = await page.locator('.flight__tip').textContent();
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(2500);
      const sel = await page.$eval('#f-floor', (s) => s.options[s.selectedIndex].text);
      ok(tip.startsWith(sel), `${label} Klick im Modell filtert Finder auf „${sel}“`);
    }
  }
  // Etagen-Button
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#gebaeude').offsetTop + 10));
  await page.waitForTimeout(600);
  await page.locator('.floor-btn[data-floor="7"]').click();
  await page.waitForTimeout(2500);
  ok(await page.$eval('#f-floor', (s) => s.value) === '7', `${label} Etagen-Button „Penthouse“ setzt Filter`);
  ok(await page.evaluate(() => document.activeElement?.id) === 'wohnungen-title', `${label} Fokus landet auf der Finder-Überschrift`);
  ok(await page.locator('.apt-card').count() === 2, `${label} Penthouse: 2 Wohnungen`);
  // Filter
  await page.selectOption('#f-floor', '');
  await page.locator('.chip:has(input[value="4"])').click();
  await page.waitForTimeout(600);
  const c = await page.locator('[data-count]').textContent();
  ok(/von 36/.test(c), `${label} Zimmerfilter: ${c}`);
  await page.locator('.switch').click();
  await page.waitForTimeout(600);
  const allFree = await page.$$eval('.apt-card .status', (s) => s.every((x) => x.textContent.trim() === 'verfügbar'));
  ok(allFree, `${label} „nur verfügbare“ filtert`);
  // Detail
  const second = page.locator('.apt-card').nth(1);
  const id = await second.getAttribute('data-id');
  await second.click(); await page.waitForTimeout(800);
  ok((await page.locator('#apt-detail-title').textContent()).includes(id), `${label} Detail zeigt Wohnung ${id}`);
  ok(await page.locator('.apt-detail svg.fp').count() === 1, `${label} Grundriss-SVG vorhanden`);
  // Exposé
  await page.locator('[data-enquire="Besichtigung"]').click();
  await page.waitForTimeout(2500);
  ok(await page.$eval('#c-apt', (s) => s.value) === id, `${label} Formular mit Wohnung ${id} vorbelegt`);
  ok(await page.$eval('input[name="anliegen"]:checked', (r) => r.value) === 'Besichtigung', `${label} Anliegen „Besichtigung“ gewählt`);
  // Formular
  await page.locator('.form button[type="submit"]').click();
  await page.waitForTimeout(300);
  ok(await page.$eval('#c-email', (i) => i.getAttribute('aria-invalid')) === 'true', `${label} Pflichtfelder werden markiert`);
  await page.fill('#c-name', 'Erika Muster'); await page.fill('#c-email', 'erika@example.org'); await page.check('#c-privacy');
  await page.locator('.form button[type="submit"]').click();
  await page.waitForTimeout(300);
  ok(/nicht gesendet/.test(await page.locator('.form__status').textContent()), `${label} Demo-Hinweis statt Fake-Erfolg`);
  // Lage-Modus
  await page.locator('.mode[data-mode="bike"]').click();
  ok(await page.$eval('.mode[data-mode="bike"]', (b) => b.getAttribute('aria-pressed')) === 'true', `${label} Verkehrsmittel umschaltbar`);
  if (reduced) ok(await page.$eval('#gebaeude', (s) => s.classList.contains('is-static')), `${label} statische 3D-Alternative`);
  await page.close();
}
await run(false);
await run(true);
ok(errors.length === 0, `keine Konsolenfehler ${errors.length ? JSON.stringify(errors) : ''}`);
await browser.close();
