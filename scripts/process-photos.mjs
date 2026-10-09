/**
 * Erzeugt aus den Original-Fotos (Wikimedia Commons, siehe photos/sources.json)
 * responsive AVIF- und WebP-Dateien in public/photos/ und public/photos/manifest.json.
 *   PHOTO_SRC=/pfad/zu/originalen node scripts/process-photos.mjs
 * Die Originale liegen nicht im Repository (Download-URL + SHA-1 in photos/sources.json).
 * Bearbeitung: nur Zuschnitt, Skalierung, Formatkonvertierung.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = process.env.PHOTO_SRC || '/workspace/konzept-1-photos/orig';
const OUT = resolve('public/photos');
mkdirSync(OUT, { recursive: true });
const sources = JSON.parse(readFileSync('photos/sources.json', 'utf8'));

const JOBS = [
  { key: 'kueche', name: 'kueche', aspect: 3 / 2, fx: 0.5, fy: 0.5, widths: [640, 1024, 1600] },
  { key: 'wohnen', name: 'wohnen', aspect: 4 / 5, fx: 0.42, fy: 0.5, widths: [480, 800, 1100] },
  { key: 'parkett', name: 'parkett', aspect: 1, fx: 0.5, fy: 0.5, widths: [480, 800] },
  { key: 'fenster', name: 'fenster', aspect: 4 / 5, fx: 0.42, fy: 0.55, widths: [480, 800] },
  { key: 'ausblick', name: 'ausblick', aspect: 16 / 10, fx: 0.5, fy: 0.42, widths: [640, 1024, 1600] },
];

function cropBox(w, h, aspect, fx = 0.5, fy = 0.5) {
  let cw = w, ch = Math.round(w / aspect);
  if (ch > h) { ch = h; cw = Math.round(h * aspect); }
  const left = Math.round(Math.min(Math.max(fx * w - cw / 2, 0), w - cw));
  const top = Math.round(Math.min(Math.max(fy * h - ch / 2, 0), h - ch));
  return { left, top, width: cw, height: ch };
}

sharp.concurrency(2);
const manifest = {};
for (const v of JOBS) {
  const src = resolve(SRC, sources[v.key].file);
  const meta = await sharp(src, { limitInputPixels: false }).metadata();
  const [W, H] = (meta.orientation || 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const box = cropBox(W, H, v.aspect, v.fx, v.fy);
  const cropped = await sharp(src, { limitInputPixels: false }).rotate().extract(box).toBuffer();
  const files = [];
  for (const w of v.widths) {
    const h = Math.round(w / v.aspect);
    const img = sharp(cropped, { limitInputPixels: false }).resize(w, h, { kernel: 'lanczos3' });
    const avif = await img.clone().avif({ quality: 52, effort: 5 }).toBuffer();
    const webp = await img.clone().webp({ quality: 74, effort: 6 }).toBuffer();
    writeFileSync(resolve(OUT, `${v.name}-${w}.avif`), avif);
    writeFileSync(resolve(OUT, `${v.name}-${w}.webp`), webp);
    files.push({ w, h, avif: avif.length, webp: webp.length });
  }
  manifest[v.name] = { source: v.key, files };
  console.log(v.name, files.map((f) => `${f.w}w ${(f.avif / 1024).toFixed(0)}K/${(f.webp / 1024).toFixed(0)}K`).join(' | '));
}
writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
