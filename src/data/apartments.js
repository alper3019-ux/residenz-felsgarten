/**
 * Wohnungsdaten der Residenz Felsgarten.
 * ALLE ANGABEN SIND FIKTIV (Demo-Projekt): Flächen, Preise, Status und Ausrichtung
 * werden deterministisch erzeugt, damit Finder, 3D-Etagen und Formular dieselben
 * Daten verwenden. Für ein echtes Projekt ersetzt man diese Datei durch einen
 * CMS-/API-Export mit gleicher Struktur.
 */

export const FLOOR_LABELS = ['EG', '1. OG', '2. OG', '3. OG', '4. OG', '5. OG', '6. OG', 'Penthouse'];
export const FLOOR_COUNT = FLOOR_LABELS.length;

/** Grundriss-Typen. rooms: Zimmerzahl, base: Wohnfläche im 1. OG (m²). */
export const TYPES = {
  A: { rooms: 2, base: 61, label: '2-Zimmer' },
  B: { rooms: 3, base: 84, label: '3-Zimmer' },
  C: { rooms: 4, base: 108, label: '4-Zimmer' },
  D: { rooms: 5, base: 176, label: '5-Zimmer-Penthouse' },
};

// Lage der Einheiten im Geschoss (von West nach Ost); x = Mittelpunkt in Gebäudebreite 0…1
const LAYOUT_STANDARD = [
  { type: 'B', x: 0.1, orient: 'Süd-West' },
  { type: 'A', x: 0.3, orient: 'Süd' },
  { type: 'C', x: 0.5, orient: 'Süd' },
  { type: 'A', x: 0.7, orient: 'Süd' },
  { type: 'B', x: 0.9, orient: 'Süd-Ost' },
];
const LAYOUT_6OG = [
  { type: 'C', x: 0.14, orient: 'Süd-West' },
  { type: 'B', x: 0.38, orient: 'Süd' },
  { type: 'B', x: 0.62, orient: 'Süd' },
  { type: 'C', x: 0.86, orient: 'Süd-Ost' },
];
const LAYOUT_PH = [
  { type: 'D', x: 0.27, orient: 'Süd-West' },
  { type: 'D', x: 0.73, orient: 'Süd-Ost' },
];

// kleiner deterministischer Zufallsgenerator (mulberry32)
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build() {
  const r = rng(20280917);
  const list = [];
  for (let f = 0; f < FLOOR_COUNT; f++) {
    const layout = f === 7 ? LAYOUT_PH : f === 6 ? LAYOUT_6OG : LAYOUT_STANDARD;
    layout.forEach((u, i) => {
      const t = TYPES[u.type];
      const area = Math.round((t.base + (f === 7 ? (i ? 10 : -8) : (f - 1) * 0.4 + (r() - 0.5) * 3)) * 10) / 10;
      const roll = r();
      const status = f === 7 ? (i === 0 ? 'reserviert' : 'verfügbar')
        : roll < 0.6 ? 'verfügbar' : roll < 0.84 ? 'reserviert' : 'verkauft';
      const outdoor = f === 0 ? 'Garten' : f === 7 ? 'Dachterrasse' : f === 6 ? 'Dachterrasse' : 'Loggia';
      const outdoorArea = Math.round((f === 0 ? 38 + r() * 30 : f >= 6 ? 34 + r() * 46 : 8 + r() * 5) * 10) / 10;
      const pricePerM2 = 7200 + f * 210 + (f === 7 ? 1900 : 0);
      list.push({
        id: `${f}.${String(i + 1).padStart(2, '0')}`,
        floor: f,
        floorLabel: FLOOR_LABELS[f],
        index: i,
        position: u.x,
        type: u.type,
        typeLabel: t.label,
        rooms: t.rooms,
        area,
        outdoor,
        outdoorArea,
        orientation: u.orient,
        status,
        price: status === 'verkauft' ? null : Math.round((area * pricePerM2) / 1000) * 1000,
      });
    });
  }
  return list;
}

export const APARTMENTS = build();

export const formatArea = (n) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
export const formatPrice = (n) => (n == null ? '—' : `${n.toLocaleString('de-DE')} €`);

export function floorStats(floor) {
  const units = APARTMENTS.filter((a) => a.floor === floor);
  return { total: units.length, free: units.filter((a) => a.status === 'verfügbar').length };
}
