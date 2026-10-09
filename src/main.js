import './styles/main.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion as reduced, $ } from './js/utils.js';
import { createSmoothScroll } from './js/smooth-scroll.js';
import { setupNavigation } from './js/navigation.js';
import { setupFlight } from './js/flight.js';
import { setupFinder } from './js/finder.js';
import { setupLage } from './js/lage.js';
import { setupContactForm } from './js/contact-form.js';
import { setupHero, setupReveals } from './js/animations.js';

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add('js');

// Sofort: Scrollen, Navigation, Hero. Alles weitere in einzelnen Leerlauf-Häppchen,
// damit der Hauptthread beim ersten Aufbau nicht lange blockiert (Total Blocking Time).
const { lenis, scrollTo } = createSmoothScroll({ reduced });
setupNavigation({ lenis, scrollTo });
setupHero({ reduced });

const idle = (fn, name) => new Promise((resolve) => {
  const run = () => { const t = performance.now(); fn(); performance.measure(`init:${name}`, { start: t, end: performance.now() }); resolve(); };
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 800 }); else setTimeout(run, 1);
});

let contact, finder;
(async () => {
  await idle(() => { contact = setupContactForm(); }, 'kontakt');
  await idle(() => {
    finder = setupFinder({
      reduced,
      onEnquire: {
        scrollTo: (el) => scrollTo(el),
        enquire(id, kind) {
          contact.prefill(id, kind);
          scrollTo('#kontakt', { onComplete: () => $('#c-name').focus({ preventScroll: true }) });
        },
      },
    });
  }, 'finder');
  let flight;
  await idle(() => {
    flight = setupFlight({
      reduced,
      onFloor(f) {
        finder.setFloor(f);
        scrollTo('#wohnungen', { onComplete: () => $('#wohnungen-title').focus({ preventScroll: true }) });
      },
    });
  }, 'flight');
  // Pin + 3D erst bei erster Interaktion oder wenn der Abschnitt näher kommt
  const activate = () => flight.activate();
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, activate, { once: true, passive: true, capture: true }));
  if (window.scrollY > 0 || location.hash) activate();
  await idle(() => setupLage({ reduced }), 'lage');
  await idle(() => setupReveals({ reduced }), 'reveals');
  // Direktaufruf mit Anker (z. B. …/#wohnungen): nach dem Aufbau korrekt positionieren
  if (location.hash && $(location.hash)) scrollTo(location.hash);
})();

