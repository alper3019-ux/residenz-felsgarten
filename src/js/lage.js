/**
 * Lage: illustrierte Karte (Inline-SVG, kein Kartendienst -> keine Drittanbieter-Anfragen).
 * Wege werden beim Hineinscrollen per stroke-dashoffset "gezeichnet" (pathLength="1").
 * Verkehrsmittel-Buttons (aria-pressed) schalten die – fiktiven – Wegzeiten um.
 */
import { gsap } from 'gsap';
import { $, $$ } from './utils.js';

const POIS = [
  { name: 'Stadtpark', x: 420, y: 150, d: 'M420 300 V170', t: { walk: 2, bike: 1, transit: null } },
  { name: 'Grundschule', x: 520, y: 400, d: 'M420 300 V400 H505', t: { walk: 6, bike: 2, transit: null } },
  { name: 'Kita Sonnenhof', x: 300, y: 240, d: 'M420 300 V330 H330 V250 H315', t: { walk: 5, bike: 2, transit: null } },
  { name: 'Wochenmarkt', x: 560, y: 470, d: 'M420 300 V400 H560 V455', t: { walk: 8, bike: 3, transit: 5 } },
  { name: 'Ärztehaus', x: 300, y: 455, d: 'M420 300 V400 H300 V440', t: { walk: 7, bike: 3, transit: 6 } },
  { name: 'Café am Fluss', x: 160, y: 330, d: 'M420 300 V330 H178', t: { walk: 12, bike: 4, transit: 7 } },
  { name: 'Bahnhof', x: 735, y: 330, d: 'M420 300 V330 H718', t: { walk: 14, bike: 5, transit: 4 } },
];
const UNIT = { walk: 'zu Fuß', bike: 'mit dem Rad', transit: 'mit Bus/Bahn' };
const NS = 'http://www.w3.org/2000/svg';

export function setupLage({ reduced }) {
  const svg = $('[data-map]');
  if (!svg) return;
  const routes = $('[data-routes]', svg);
  const pois = $('[data-pois]', svg);
  const listEl = $('[data-poi-list]');
  const paths = [];
  const timeLabels = [];

  POIS.forEach((p, i) => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', p.d); path.setAttribute('pathLength', '1'); path.setAttribute('class', 'm-route');
    routes.appendChild(path); paths.push(path);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'm-poi'); g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    const anchorEnd = p.x > 600;
    g.innerHTML = `<circle r="8"/><text x="${anchorEnd ? -14 : 14}" y="-4" text-anchor="${anchorEnd ? 'end' : 'start'}">${p.name}</text><text class="m-time" x="${anchorEnd ? -14 : 14}" y="13" text-anchor="${anchorEnd ? 'end' : 'start'}"></text>`;
    pois.appendChild(g); timeLabels.push(g.querySelector('.m-time'));
    const li = document.createElement('li');
    li.className = 'poi'; li.dataset.i = i;
    li.innerHTML = `<span class="poi__name">${p.name}</span><span class="poi__time mono"></span>`;
    listEl.appendChild(li);
  });
  const listTimes = $$('.poi__time', listEl);

  function setMode(mode) {
    $$('.mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    svg.dataset.mode = mode;
    POIS.forEach((p, i) => {
      const t = p.t[mode];
      const txt = t == null ? 'zu Fuß näher' : `${t} Min.`;
      timeLabels[i].textContent = txt;
      listTimes[i].textContent = t == null ? 'zu Fuß näher' : `${t} Min. ${UNIT[mode]}`;
      paths[i].classList.toggle('is-off', t == null);
    });
  }
  $$('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  setMode('walk');

  // Hervorhebung Liste <-> Karte
  $$('.poi', listEl).forEach((li) => {
    const i = Number(li.dataset.i);
    li.addEventListener('pointerenter', () => { paths[i].classList.add('is-hot'); pois.children[i].classList.add('is-hot'); });
    li.addEventListener('pointerleave', () => { paths[i].classList.remove('is-hot'); pois.children[i].classList.remove('is-hot'); });
  });

  if (reduced) return;
  gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.set(pois.children, { opacity: 0, scale: 0.6, transformOrigin: 'center' });
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    gsap.timeline()
      .to(paths, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', stagger: 0.12 })
      .to(pois.children, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.1 }, 0.5);
  }, { rootMargin: '0px 0px -25% 0px' });
  io.observe(svg);
}
