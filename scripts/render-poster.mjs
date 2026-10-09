/**
 * Rendert Standbilder der eigenen 3D-Szene (Fortschritt 0 = Startansicht der Kamerafahrt)
 * als Hero-/Poster-Bild und OG-Bild. Voraussetzung: laufender Dev-Server (npm run dev).
 *   DEV=http://127.0.0.1:5181/residenz-felsgarten/ node scripts/render-poster.mjs
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const DEV = process.env.DEV || 'http://127.0.0.1:5181/residenz-felsgarten/';
mkdirSync('public/poster', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function shot(w, h, dpr, mobile, sx = 0, sy = 0) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`${DEV}tools/poster.html?mobile=${mobile ? 1 : 0}&sx=${sx}&sy=${sy}`);
  await page.waitForFunction(() => window.__posterReady, null, { timeout: 120000 });
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ type: 'png' });
  await page.close();
  return buf;
}

const land = await shot(1600, 1000, 1.5, false, 0.16, 0.04);   // 2400×1500
for (const w of [960, 1600, 2400]) {
  const img = sharp(land).resize(w);
  await img.clone().avif({ quality: 55, effort: 6 }).toFile(`public/poster/hero-${w}.avif`);
  await img.clone().webp({ quality: 78, effort: 6 }).toFile(`public/poster/hero-${w}.webp`);
}
await sharp(land).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80, mozjpeg: true }).toFile('public/og.jpg');
const port = await shot(450, 800, 2, true, 0, 0.2);         // 900×1600
for (const w of [540, 900]) {
  const img = sharp(port).resize(w);
  await img.clone().avif({ quality: 55, effort: 6 }).toFile(`public/poster/hero-portrait-${w}.avif`);
  await img.clone().webp({ quality: 78, effort: 6 }).toFile(`public/poster/hero-portrait-${w}.webp`);
}
await browser.close();
console.log('Poster geschrieben');
