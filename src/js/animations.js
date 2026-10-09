/**
 * Dezente Einblend-Animationen. Ausgangszustände setzt erst JavaScript;
 * ohne JS oder bei "Bewegung reduzieren" ist alles sofort sichtbar.
 * Hero: nur transform (kein opacity: 0 auf dem Text), damit LCP nicht verzögert wird.
 */
import { gsap } from 'gsap';
import { $$ } from './utils.js';

export function setupHero({ reduced }) {
  if (reduced) return;
  gsap.from('.hero__title .line > span', { yPercent: 105, duration: 1.1, ease: 'power4.out', stagger: 0.1, delay: 0.05 });
  gsap.from('.hero__media img', { scale: 1.06, duration: 2.2, ease: 'power2.out' });
  if (window.matchMedia('(min-width: 761px)').matches) {
    gsap.to('.hero__media', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  }
}

export function setupReveals({ reduced }) {
  if (reduced || !('IntersectionObserver' in window)) return;
  // Ein IntersectionObserver + CSS-Transition statt je eines ScrollTriggers pro Element:
  // weniger Layout-Arbeit auf schwachen Geräten.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.remove('is-pending'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  const vh = window.innerHeight;
  $$('.reveal').forEach((el) => {
    if (el.getBoundingClientRect().top < vh) return; // schon sichtbar: nicht verstecken
    el.classList.add('is-pending');
    io.observe(el);
  });
}
