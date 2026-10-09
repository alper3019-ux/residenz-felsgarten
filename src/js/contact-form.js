/**
 * Kontakt-/Exposé-Formular. Versandart über VITE_FORM_MODE (.env):
 *   "demo"   – kein Versand; die Seite sagt das offen (keine vorgetäuschte Erfolgsmeldung)
 *   "mailto" – öffnet das E-Mail-Programm mit vorbereiteter Nachricht an VITE_CONTACT_EMAIL
 * Barrierefreiheit: aria-invalid erst nach dem Absenden-Versuch, Fehlermeldungen per
 * aria-describedby, Fokus auf das erste fehlerhafte Feld, Status in einer Live-Region.
 */
import { $, $$ } from './utils.js';
import { APARTMENTS, formatArea } from '../data/apartments.js';

const MODE = import.meta.env.VITE_FORM_MODE || 'demo';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';
const NOTES = {
  demo: 'Demo-Version: Dieses Formular sendet und speichert keine Daten. Projekt, Vertriebsbüro und Kontaktadresse sind fiktiv.',
  mailto: `Beim Absenden öffnet sich Ihr E-Mail-Programm mit einer vorbereiteten Nachricht an ${CONTACT_EMAIL}.`,
};

export function setupContactForm() {
  const form = $('[data-form]');
  if (!form) return { prefill() {} };
  const status = $('.form__status', form);
  const note = $('#form-note', form);
  const aptSelect = $('[data-apt-select]', form);
  if (NOTES[MODE]) { note.textContent = NOTES[MODE]; note.hidden = false; }

  APARTMENTS.filter((a) => a.status !== 'verkauft').forEach((a) => {
    aptSelect.add(new Option(`Whg. ${a.id} · ${a.floorLabel} · ${a.rooms} Zi. · ${formatArea(a.area)}`, a.id));
  });

  const isOk = (input) => (input.type === 'checkbox' ? input.checked : input.checkValidity() && input.value.trim() !== '');
  function setInvalid(input, invalid) {
    input.closest('.field, .check')?.classList.toggle('is-invalid', invalid);
    if (invalid) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  form.addEventListener('input', (e) => {
    const input = e.target;
    if (input.getAttribute('aria-invalid') === 'true' && isOk(input)) setInvalid(input, false);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.className = 'form__status mono';
    const invalid = $$('[required]', form).filter((input) => { const bad = !isOk(input); setInvalid(input, bad); return bad; });
    if (invalid.length) {
      status.textContent = invalid.length === 1 ? 'Bitte prüfen Sie das markierte Feld.' : `Bitte prüfen Sie die ${invalid.length} markierten Felder.`;
      status.classList.add('is-err');
      invalid[0].focus();
      return;
    }
    const data = new FormData(form);
    if (MODE === 'mailto') {
      const body = [`Anliegen: ${data.get('anliegen')}`, `Name: ${data.get('name')}`, `E-Mail: ${data.get('email')}`, `Telefon: ${data.get('telefon') || '–'}`,
        `Wohnung: ${data.get('wohnung') || '–'}`, '', String(data.get('nachricht') || '')].join('\n');
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${data.get('anliegen')} – Residenz Felsgarten`)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Ihr E-Mail-Programm sollte sich jetzt öffnen. Bitte senden Sie die Nachricht dort ab.';
      return;
    }
    status.textContent = `Demo-Modus: Ihre Anfrage (${data.get('anliegen')}) ist vollständig, wurde aber nicht gesendet und nicht gespeichert.`;
    status.classList.add('is-ok');
  });

  return {
    /** Vorbelegung aus dem Wohnungsfinder */
    prefill(aptId, anliegen = 'Exposé') {
      if ([...aptSelect.options].some((o) => o.value === aptId)) aptSelect.value = aptId;
      const r = $(`input[name="anliegen"][value="${anliegen}"]`, form);
      if (r) r.checked = true;
    },
  };
}
