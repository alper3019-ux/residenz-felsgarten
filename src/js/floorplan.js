/**
 * Schematische Grundrisse als Inline-SVG (keine Bilddateien, skaliert verlustfrei,
 * Raumnamen bleiben echter Text). Vier Typen, Raumflächen werden proportional zur
 * Wohnfläche der jeweiligen Wohnung berechnet. Rein illustrativ – nicht maßstäblich.
 * Süden (Fassade mit Fenstern und Außenbereich) liegt unten.
 */
const T = {
  A: { w: 8, d: 8, rooms: [['Bad', 0, 0, 3, 3], ['Flur', 3, 0, 2, 3], ['Kochen', 5, 0, 3, 3.6], ['Wohnen / Essen', 0, 3, 5, 5], ['Schlafen', 5, 3.6, 3, 4.4]] },
  B: { w: 10, d: 8.4, rooms: [['Bad', 0, 0, 2.8, 3], ['Flur', 2.8, 0, 2.6, 3], ['Zimmer', 5.4, 0, 4.6, 3.4], ['Wohnen / Kochen', 0, 3, 5.4, 5.4], ['Schlafen', 5.4, 3.4, 4.6, 5]] },
  C: { w: 12, d: 9, rooms: [['Bad', 0, 0, 2.8, 3.2], ['Flur', 2.8, 0, 2.4, 3.2], ['Dusche', 5.2, 0, 2, 3.2], ['Zimmer 1', 7.2, 0, 4.8, 3.6], ['Wohnen / Essen', 0, 3.2, 5.6, 5.8], ['Schlafen', 5.6, 3.6, 3.2, 5.4], ['Zimmer 2', 8.8, 3.6, 3.2, 5.4]] },
  D: { w: 16, d: 11, rooms: [['Bad', 0, 0, 3.2, 3.4], ['Flur', 3.2, 0, 3, 3.4], ['Ankleide', 6.2, 0, 2.6, 3.4], ['Arbeiten', 8.8, 0, 3.4, 3.8], ['Zimmer', 12.2, 0, 3.8, 3.8], ['Wohnen / Essen / Kochen', 0, 3.4, 8.8, 7.6], ['Schlafen', 8.8, 3.8, 4, 7.2], ['Gäste', 12.8, 3.8, 3.2, 7.2]] },
};

const fmt = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function floorplanSVG(apt, { titleId } = {}) {
  const t = T[apt.type];
  const S = 34; // px je Einheit
  const pad = 26;
  const outD = apt.outdoor === 'Loggia' ? 1.7 : 2.8;
  const W = t.w * S + pad * 2;
  const H = (t.d + outD) * S + pad * 2 + 18;
  const sum = t.rooms.reduce((s, r) => s + r[3] * r[4], 0);
  const k = apt.area / sum;
  const x = (u) => pad + u * S;
  const y = (u) => pad + u * S;

  const rooms = t.rooms.map(([name, rx, ry, rw, rh]) => {
    const living = /Wohnen/.test(name);
    const wet = /Bad|Dusche/.test(name);
    const cx = x(rx + rw / 2), cy = y(ry + rh / 2);
    const small = rw < 2.6;
    return `<rect x="${x(rx)}" y="${y(ry)}" width="${rw * S}" height="${rh * S}" class="fp-room${living ? ' fp-room--living' : ''}${wet ? ' fp-room--wet' : ''}"/>
      <text x="${cx}" y="${cy - 3}" class="fp-label${small ? ' fp-label--s' : ''}">${name}</text>
      <text x="${cx}" y="${cy + 12}" class="fp-area">${fmt(rw * rh * k)} m²</text>`;
  }).join('');

  // Fenster an der Südfassade: Lücken in der Außenwand mit zwei Glaslinien
  const wins = [];
  const step = t.w / Math.round(t.w / 2.2);
  for (let u = step / 2; u < t.w; u += step) {
    wins.push(`<g class="fp-win"><line x1="${x(u - 0.6)}" y1="${y(t.d)}" x2="${x(u + 0.6)}" y2="${y(t.d)}" class="fp-win__gap"/><line x1="${x(u - 0.6)}" y1="${y(t.d) - 3}" x2="${x(u + 0.6)}" y2="${y(t.d) - 3}"/><line x1="${x(u - 0.6)}" y1="${y(t.d) + 3}" x2="${x(u + 0.6)}" y2="${y(t.d) + 3}"/></g>`);
  }
  const outX = apt.outdoor === 'Loggia' ? 0.4 : 0;
  const outW = apt.outdoor === 'Loggia' ? Math.min(5.4, t.w * 0.55) : t.w;
  const out = `<rect x="${x(outX)}" y="${y(t.d) + 4}" width="${outW * S}" height="${outD * S - 8}" class="fp-out"/>
    <text x="${x(outX + outW / 2)}" y="${y(t.d + outD / 2) + 4}" class="fp-label fp-label--out">${apt.outdoor} · ${fmt(apt.outdoorArea)} m²</text>`;
  // Eingangstür (Flur, Nordseite) als Viertelkreis
  const flur = t.rooms.find((r) => r[0] === 'Flur');
  const dx = x(flur[1] + 0.4);
  const door = `<path d="M${dx} ${y(0)} v${0.9 * S} A ${0.9 * S} ${0.9 * S} 0 0 0 ${dx + 0.9 * S} ${y(0)}" class="fp-door"/>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="fp" role="img" ${titleId ? `aria-labelledby="${titleId}"` : ''} xmlns="http://www.w3.org/2000/svg">
    ${titleId ? `<title id="${titleId}">Schematischer Grundriss Wohnung ${apt.id}: ${t.rooms.map((r) => r[0]).join(', ')}, ${apt.outdoor}</title>` : ''}
    <defs><pattern id="fp-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="fp-hatch"/></pattern></defs>
    ${out}
    <g class="fp-rooms">${rooms}</g>
    <rect x="${x(0)}" y="${y(0)}" width="${t.w * S}" height="${t.d * S}" class="fp-outer"/>
    ${wins.join('')}
    ${door}
    <g class="fp-north" transform="translate(${W - pad - 6} ${pad + 6})"><path d="M0 -12 L6 6 L0 2 L-6 6 Z"/><text y="20">N</text></g>
    <text x="${pad}" y="${H - 8}" class="fp-note">Schematisch, nicht maßstäblich · fiktive Flächen</text>
  </svg>`;
}
