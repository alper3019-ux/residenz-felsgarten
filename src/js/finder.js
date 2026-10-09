/**
 * Wohnungsfinder: Filter, Ergebnisliste, Detail mit Grundriss.
 * Listen- und Detailwechsel laufen – wo unterstützt und ohne "Bewegung reduzieren" –
 * über die View Transitions API (document.startViewTransition), sonst sofort.
 * Jede Karte trägt einen eindeutigen view-transition-name, damit Karten beim Filtern
 * an ihre neue Position gleiten statt zu springen.
 */
import { $, $$ } from './utils.js';
import { APARTMENTS, FLOOR_LABELS, FLOOR_COUNT, formatArea, formatPrice } from '../data/apartments.js';
import { floorplanSVG } from './floorplan.js';

const STATUS_CLASS = { 'verfügbar': 'ok', 'reserviert': 'res', 'verkauft': 'sold' };

function transition(update, reduced) {
  if (reduced || !document.startViewTransition) { update(); return; }
  document.startViewTransition(update);
}

/** Mini-Schnitt des Gebäudes: welche Etage, welche Position */
function sectionSVG(apt) {
  const rows = [];
  const H = 14, gap = 3;
  for (let f = FLOOR_COUNT - 1; f >= 0; f--) {
    const y = (FLOOR_COUNT - 1 - f) * (H + gap);
    const ph = f === FLOOR_COUNT - 1;
    const x0 = ph ? 30 : 0, w = ph ? 120 : 200;
    rows.push(`<rect x="${x0}" y="${y}" width="${w}" height="${H}" class="sec-floor${f === apt.floor ? ' is-on' : ''}"/>`);
    if (f === apt.floor) {
      const units = APARTMENTS.filter((a) => a.floor === f);
      const uw = w / units.length;
      units.forEach((u, i) => rows.push(`<rect x="${x0 + i * uw + 1.5}" y="${y + 2}" width="${uw - 3}" height="${H - 4}" class="sec-unit${u.id === apt.id ? ' is-me' : ''}"/>`));
    }
  }
  const total = FLOOR_COUNT * (H + gap);
  return `<svg viewBox="-2 -2 204 ${total + 2}" class="sec" aria-hidden="true">${rows.join('')}</svg>`;
}

export function setupFinder({ reduced, onEnquire }) {
  const form = $('[data-filters]');
  const list = $('[data-apt-list]');
  const detail = $('[data-apt-detail]');
  const count = $('[data-count]');
  const floorSel = $('#f-floor', form);
  FLOOR_LABELS.forEach((l, i) => floorSel.add(new Option(l, String(i))));
  let selected = null;

  const state = () => {
    const d = new FormData(form);
    return {
      rooms: d.getAll('rooms').map(Number),
      floor: d.get('floor') === '' ? null : Number(d.get('floor')),
      area: Number(d.get('area') || 0),
      outdoor: d.get('outdoor') || '',
      free: d.get('free') === 'on',
      sort: d.get('sort') || 'id',
    };
  };

  function filtered() {
    const s = state();
    let r = APARTMENTS.filter((a) => (!s.rooms.length || s.rooms.includes(a.rooms))
      && (s.floor === null || a.floor === s.floor)
      && a.area >= s.area
      && (!s.outdoor || a.outdoor === s.outdoor)
      && (!s.free || a.status === 'verfügbar'));
    if (s.sort === 'price') r = [...r].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (s.sort === 'area') r = [...r].sort((a, b) => b.area - a.area);
    return r;
  }

  const vtName = (a) => `apt-${a.id.replace('.', '-')}`;
  function card(a) {
    return `<li style="view-transition-name:${vtName(a)}"><button type="button" class="apt-card${selected === a.id ? ' is-selected' : ''}" data-id="${a.id}" aria-pressed="${selected === a.id}" aria-controls="apt-detail">
      <span class="apt-card__id mono">Whg. ${a.id}</span>
      <span class="apt-card__status status status--${STATUS_CLASS[a.status]}">${a.status}</span>
      <span class="apt-card__main">${a.rooms} Zimmer · ${formatArea(a.area)}</span>
      <span class="apt-card__meta">${a.floorLabel} · ${a.outdoor} · ${a.orientation}</span>
      <span class="apt-card__price mono">${a.price ? formatPrice(a.price) : '—'}</span>
    </button></li>`;
  }

  function renderList() {
    const r = filtered();
    const free = r.filter((a) => a.status === 'verfügbar').length;
    count.textContent = `${r.length} von ${APARTMENTS.length} Wohnungen · ${free} verfügbar`;
    list.innerHTML = r.length ? r.map(card).join('') : `<li class="apt-empty"><p>Keine Wohnung passt zu diesen Filtern.</p><button type="button" class="btn btn--ghost btn--small" data-reset>Filter zurücksetzen</button></li>`;
    return r;
  }

  function renderDetail(a) {
    const sold = a.status === 'verkauft';
    detail.innerHTML = `
      <div class="apt-detail__head">
        <p class="mono apt-detail__kicker">${a.floorLabel} · ${a.typeLabel} · fiktiv</p>
        <h3 id="apt-detail-title">Wohnung ${a.id}</h3>
        <span class="status status--${STATUS_CLASS[a.status]}">${a.status}</span>
      </div>
      <div class="apt-detail__plan">${floorplanSVG(a, { titleId: 'fp-title' })}</div>
      <div class="apt-detail__side">
        <dl class="facts">
          <div><dt class="mono">Wohnfläche</dt><dd>${formatArea(a.area)}</dd></div>
          <div><dt class="mono">Zimmer</dt><dd>${a.rooms}</dd></div>
          <div><dt class="mono">${a.outdoor}</dt><dd>${formatArea(a.outdoorArea)}</dd></div>
          <div><dt class="mono">Ausrichtung</dt><dd>${a.orientation}</dd></div>
          <div><dt class="mono">Kaufpreis</dt><dd>${a.price ? formatPrice(a.price) : 'verkauft'}</dd></div>
          ${a.price ? `<div><dt class="mono">pro m²</dt><dd>${formatPrice(Math.round(a.price / a.area))}</dd></div>` : ''}
        </dl>
        <figure class="apt-detail__sec">${sectionSVG(a)}<figcaption class="mono">Lage im Haus: ${a.floorLabel}, Position ${a.index + 1} von West</figcaption></figure>
        <div class="apt-detail__cta">
          ${sold ? '<p class="note">Diese Wohnung ist bereits verkauft. Ähnliche Wohnungen finden Sie über die Filter.</p>'
            : `<button type="button" class="btn" data-enquire="Exposé">Exposé anfordern</button><button type="button" class="btn btn--ghost" data-enquire="Besichtigung">Besichtigung</button>`}
        </div>
      </div>`;
  }

  function select(id, { focus = false } = {}) {
    const a = APARTMENTS.find((x) => x.id === id);
    if (!a) return;
    selected = id;
    transition(() => {
      $$('.apt-card', list).forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', String(on)); });
      renderDetail(a);
    }, reduced);
    if (focus) detail.focus({ preventScroll: true });
  }

  function update({ keepSelection = true } = {}) {
    transition(() => {
      const r = renderList();
      if (!keepSelection || !r.some((a) => a.id === selected)) {
        const first = r.find((a) => a.status === 'verfügbar') || r[0];
        if (first) { selected = first.id; renderList(); renderDetail(first); }
      }
    }, reduced);
  }

  form.addEventListener('change', () => update());
  form.addEventListener('reset', () => setTimeout(() => update(), 0));
  form.addEventListener('submit', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { form.reset(); return; }
    const b = e.target.closest('.apt-card');
    if (!b) return;
    select(b.dataset.id);
    // schmale Bildschirme: Detail steht unter der Liste -> hinscrollen
    if (window.matchMedia('(max-width: 900px)').matches) onEnquire.scrollTo(detail);
  });
  detail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-enquire]');
    if (b && selected) onEnquire.enquire(selected, b.dataset.enquire);
  });

  // Start: erste verfügbare Wohnung zeigen
  const r = renderList();
  const first = r.find((a) => a.status === 'verfügbar');
  if (first) { selected = first.id; renderList(); renderDetail(first); }

  return {
    /** von der 3D-Ansicht / Etagenliste aufgerufen */
    setFloor(f) {
      floorSel.value = String(f);
      update({ keepSelection: false });
    },
  };
}
