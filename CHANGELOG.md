# Changelog

Alle relevanten Änderungen an diesem Projekt. Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.0.0] – 2026-10-09

### Hinzugefügt
- Startseite „Residenz Felsgarten“ (fiktives Neubauprojekt) mit Hero, Projekt, Gebäude, Wohnungen, Lage, Ausstattung, Kontakt.
- Prozedurales 3D-Gebäude (Three.js r186, keine fremden Modelle): 7 Geschosse + Staffelgeschoss, Eichenlamellen und Bäume als `InstancedMesh`, Loggien, Dachterrasse, Umgebung.
- Scroll-gesteuerte Kamerafahrt (GSAP ScrollTrigger, gepinnt) als Orbit in Polarkoordinaten, Lichtstimmung Nachmittag → blaue Stunde, Fenster leuchten auf.
- Etagenwahl im Modell (Raycaster, Tooltip) und per Etagenliste (Buttons) → filtert den Wohnungsfinder, Fokus springt zur Finder-Überschrift.
- Wohnungsfinder: 36 fiktive Wohnungen, Filter (Zimmer, Etage, Fläche, Außenbereich, nur verfügbare, Sortierung), Live-Ergebniszahl, Detail mit SVG-Grundriss, Gebäudeschnitt, Exposé-/Besichtigungs-CTA mit Formular-Vorbelegung. Übergänge per View Transitions API mit Fallback.
- Lage als eigene SVG-Illustration (kein Kartendienst), Wege werden beim Scrollen gezeichnet, Verkehrsmittel-Umschalter (`aria-pressed`).
- Ausstattung mit 5 frei lizenzierten Musterfotos (Wikimedia Commons, CC BY 2.0 / CC0), AVIF + WebP in mehreren Breiten.
- Kontakt-/Exposé-Formular im ehrlichen Demo-Modus (sendet nichts und sagt das).
- Impressum, Datenschutz, Bildrechte, 404 – alle Platzhalter als fiktiv gekennzeichnet.
- Statische Alternative bei „Bewegung reduzieren“ oder ohne WebGL (kein Pin, Standbild, Etagenliste funktioniert).
- Skripte: Fotoverarbeitung, Poster-Render der eigenen Szene, Icons, Audit (Lighthouse + axe), Interaktionstest, Screenshots, Deploy auf `gh-pages`.

### Performance
- Three.js als eigenes Bundle, erst geladen, wenn der Gebäude-Abschnitt näher als ein Viewport ist; Pin/3D erst nach erster Interaktion aktiviert.
- Rendern nur bei Bedarf (kein Dauer-Loop), Pause außerhalb des Viewports und in Hintergrund-Tabs, Pixelratio gedeckelt.
- Initialisierung der Abschnitte in einzelnen `requestIdleCallback`-Häppchen.
- Hero-Titel ohne Zeilenumbruch → kein Layout-Shift beim Schriftwechsel.
