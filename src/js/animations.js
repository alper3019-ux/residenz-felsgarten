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
  gsap.to('.hero__media', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

export function setupReveals({ reduced }) {
  if (reduced) return;
  $$('.reveal').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) return; // schon sichtbar: nicht verstecken
    gsap.from(el, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
}
