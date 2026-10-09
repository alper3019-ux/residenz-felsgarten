/**
 * Screenshots für README/Abnahme nach screens/.
 *   URL=https://alper3019-ux.github.io/residenz-felsgarten/ node scripts/screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4191/residenz-felsgarten/';
mkdirSync('screens', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// Desktop
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screens/desktop-hero.png' });
await page.mouse.wheel(0, 100);
await page.waitForTimeout(2000);
await page.evaluate(() => window.scrollTo(0, document.querySelector('#gebaeude').offsetTop + window.innerHeight * 0.45));
await page.waitForFunction(() => document.querySelector('#gebaeude').classList.contains('is-live'), null, { timeout: 60000 });
await page.waitForTimeout(4000);
await page.hover('.floor-btn[data-floor="4"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screens/desktop-gebaeude-etage.png' });
await page.click('.floor-btn[data-floor="4"]');
await page.waitForTimeout(2500);
await page.locator('.apt-card').nth(2).click();
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, document.querySelector('.filters').getBoundingClientRect().top + scrollY - 90));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screens/desktop-wohnungsfinder.png' });
await page.evaluate(() => window.scrollTo(0, document.querySelector('#lage').offsetTop));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screens/desktop-lage.png' });
await page.close();

// Mobil
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.goto(URL, { waitUntil: 'networkidle' });
await m.waitForTimeout(2500);
await m.screenshot({ path: 'screens/mobile-hero.png' });
await m.evaluate(() => window.scrollTo(0, document.querySelector('#gebaeude').offsetTop + 10));
await m.waitForTimeout(500);
await m.evaluate(() => window.scrollTo(0, document.querySelector('#gebaeude').offsetTop + window.innerHeight * 1.2));
await m.waitForFunction(() => document.querySelector('#gebaeude').classList.contains('is-live'), null, { timeout: 60000 }).catch(() => {});
await m.waitForTimeout(4000);
await m.screenshot({ path: 'screens/mobile-gebaeude.png' });
await m.evaluate(() => window.scrollTo(0, document.querySelector('.apt-detail').getBoundingClientRect().top + scrollY - 70));
await m.waitForTimeout(1500);
await m.screenshot({ path: 'screens/mobile-grundriss.png' });
await browser.close();
console.log('Screenshots in screens/');
