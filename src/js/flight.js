/**
 * Abschnitt "Gebäude": gepinnte Bühne mit scroll-gesteuerter Kamerafahrt.
 * - Three.js wird erst geladen, wenn der Abschnitt in die Nähe des Viewports kommt
 *   (dynamischer import() -> eigenes Bundle, belastet den ersten Seitenaufbau nicht).
 * - Bewegung reduzieren oder kein WebGL: kein Pin, statisches Standbild; die
 *   Etagenliste funktioniert genauso (filtert den Wohnungsfinder).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$ } from './utils.js';
import { FLOOR_LABELS, FLOOR_COUNT, floorStats } from '../data/apartments.js';

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export function setupFlight({ reduced, onFloor }) {
  const section = $('#gebaeude');
  const stage = $('.flight__stage', section);
  const wrap = $('[data-flight-canvas]', section);
  const list = $('[data-floor-list]', section);
  const tip = $('.flight__tip', section);
  const chapters = $$('.chapter', section);
  const bar = $('.flight__progress span', section);
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  let building = null;

  // Etagen-Buttons (oben = Penthouse)
  for (let f = FLOOR_COUNT - 1; f >= 0; f--) {
    const { total, free } = floorStats(f);
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="floor-btn" data-floor="${f}">
      <span class="floor-btn__name">${FLOOR_LABELS[f]}</span>
      <span class="floor-btn__free mono">${free}/${total} frei</span>
      <span class="visually-hidden">– Wohnungen dieser Etage im Finder anzeigen</span></button>`;
    list.appendChild(li);
  }
  const buttons = $$('.floor-btn', list);
  const mark = (f) => buttons.forEach((b) => b.classList.toggle('is-hot', Number(b.dataset.floor) === f));
  buttons.forEach((b) => {
    const f = Number(b.dataset.floor);
    b.addEventListener('pointerenter', () => { building?.highlight(f); mark(f); });
    b.addEventListener('focus', () => { building?.highlight(f); mark(f); });
    b.addEventListener('pointerleave', () => { building?.highlight(-1); mark(-1); });
    b.addEventListener('blur', () => { building?.highlight(-1); mark(-1); });
    b.addEventListener('click', () => { building?.select(f); onFloor(f); });
  });

  const live = !reduced && hasWebGL();
  section.classList.toggle('is-static', !live);
  if (!live) return { select() {}, activate() {} };

  // Pin und 3D werden erst aktiviert, wenn die Seite benutzt wird (activate) – das hält
  // den ersten Seitenaufbau frei von Layout-Arbeit, die niemand sieht.
  let active = false;
  function activate() {
    if (active) return;
    active = true;

  // Pin + Fortschritt
  let progress = 0;
  const setChapter = (p) => {
    const idx = Math.min(chapters.length - 1, Math.floor(p * chapters.length * 0.999));
    chapters.forEach((c, i) => c.classList.toggle('is-active', i === idx));
  };
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * (mobile ? 2.6 : 3.2)}`,
    pin: stage,
    pinSpacing: true,
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: (st) => {
      progress = st.progress;
      building?.setProgress(progress);
      bar.style.transform = `scaleX(${progress})`;
      setChapter(progress);
    },
  });

  // Three.js nachladen, sobald der Abschnitt näher als ~1 Viewport ist
  const io = new IntersectionObserver(async ([en]) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    try {
      const { createBuilding } = await import('../webgl/building.js');
      building = await createBuilding(wrap, {
        mobile,
        onHover(f, e) {
          mark(f);
          if (f < 0 || !e) { tip.hidden = true; return; }
          const { total, free } = floorStats(f);
          tip.textContent = `${FLOOR_LABELS[f]} · ${free} von ${total} frei · klicken`;
          const r = stage.getBoundingClientRect();
          tip.style.transform = `translate(${e.clientX - r.left + 16}px, ${e.clientY - r.top + 16}px)`;
          tip.hidden = false;
        },
        onPick(f) { building.select(f); onFloor(f); },
      });
      building.setProgress(progress);
      requestAnimationFrame(() => section.classList.add('is-live'));
    } catch (err) {
      console.warn('3D-Ansicht nicht verfügbar:', err);
      section.classList.add('is-static');
    }
  }, { rootMargin: '100% 0px' });
  io.observe(section);
  }

  return { select(f) { building?.select(f); }, activate };
}
