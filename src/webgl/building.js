/**
 * Residenz Felsgarten – prozedurale 3D-Szene (Three.js r186, WebGLRenderer).
 * Keine externen Modelle: Gebäude, Bäume, Umgebung entstehen aus Grundkörpern.
 *
 * - Kamerafahrt: Position und Blickziel laufen auf zwei CatmullRomCurve3-Pfaden,
 *   gesteuert über einen Fortschrittswert 0…1 (ScrollTrigger, siehe flight.js);
 *   getPointAt() sorgt für gleichmäßiges Tempo entlang der Kurve.
 * - Etagen: je Geschoss ein unsichtbarer Treffer-Körper für den Raycaster
 *   (setFromCamera + intersectObjects) und eine goldene Hervorhebung.
 * - Lichtstimmung: von Nachmittag (p = 0) zur blauen Stunde (p = 1); Fenster
 *   leuchten über eine Emissive-Map zunehmend warm.
 * - Kein Dauer-Loop: gerendert wird nur, solange sich Werte noch angleichen.
 */
import * as THREE from 'three';
import { FLOOR_COUNT } from '../data/apartments.js';

const FLOOR_H = 3.2;
const PLINTH = 0.6;
const W = 36, D = 14;          // Regelgeschoss
const PW = 22, PD = 10;        // Penthouse (Staffelgeschoss)

export const floorY = (f) => PLINTH + f * FLOOR_H;

function rng(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

/** Fensterraster als Canvas-Textur: map = Glas/Profile, emissive = beleuchtete Räume. */
function windowTextures(cols, seed) {
  const cw = 64, ch = 128;
  const make = () => { const c = document.createElement('canvas'); c.width = cols * cw; c.height = ch; return c; };
  const base = make(), glow = make();
  const b = base.getContext('2d'), g = glow.getContext('2d');
  const r = rng(seed);
  g.fillStyle = '#000'; g.fillRect(0, 0, glow.width, ch);
  for (let i = 0; i < cols; i++) {
    const x = i * cw;
    const grad = b.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#5d6e78'); grad.addColorStop(0.55, '#2b3840'); grad.addColorStop(1, '#1d262c');
    b.fillStyle = grad; b.fillRect(x, 0, cw, ch);
    b.fillStyle = 'rgba(255,255,255,0.06)'; b.fillRect(x + 6, 4, cw * 0.35, ch - 8);
    b.fillStyle = '#20282c'; b.fillRect(x, 0, 3, ch); b.fillRect(x, ch * 0.78, cw, 3);
    const lit = r();
    if (lit > 0.42) {
      const warm = 200 + Math.floor(r() * 40);
      const gg = g.createLinearGradient(0, 0, 0, ch);
      gg.addColorStop(0, `rgb(255,${warm},150)`); gg.addColorStop(1, `rgb(190,${warm - 70},80)`);
      g.globalAlpha = 0.45 + r() * 0.55; g.fillStyle = gg; g.fillRect(x + 3, 0, cw - 3, ch * 0.78);
      g.globalAlpha = 1;
    }
  }
  const t1 = new THREE.CanvasTexture(base); t1.colorSpace = THREE.SRGBColorSpace;
  const t2 = new THREE.CanvasTexture(glow); t2.colorSpace = THREE.SRGBColorSpace;
  [t1, t2].forEach((t) => { t.anisotropy = 4; t.generateMipmaps = true; });
  return { map: t1, emissiveMap: t2 };
}

// Kamera-Keyframes als Orbit: [Winkel° um die Hochachse (0 = Süden), Abstand, Höhe, Blickhöhe].
// Interpoliert wird in diesen Polarkoordinaten -> die Kamera umkreist das Haus und
// schneidet es nie. Knapp 340° = "einmal rundherum".
const ORBIT = [
  [36, 104, 40, 10],    // Ankommen: Übersicht von Südosten
  [18, 72, 15, 10],     // Annäherung an die Südfassade
  [-8, 56, 5, 10],      // Fassade aus Fußgängerperspektive
  [-55, 64, 18, 12],    // Parkseite / Südwest-Ecke
  [-120, 76, 40, 18],   // Westen, Blick auf das Staffelgeschoss
  [-215, 84, 46, 19],   // Norden, über die Dachterrasse
  [-322, 116, 30, 11],  // zurück nach Südost, Totale zur blauen Stunde
];
// Lichtstimmung: Himmel oben/unten, Sonne, Fensterleuchten
const MOODS = [
  { top: '#93abbd', bot: '#e8e3d4', sun: '#ffe2b8', sunI: 2.6, hemi: 1.15, glow: 0.15, elev: 0.55 },
  { top: '#7890a6', bot: '#efd2ae', sun: '#ffc98e', sunI: 2.2, hemi: 0.95, glow: 0.45, elev: 0.32 },
  { top: '#2e3f58', bot: '#d89a76', sun: '#ff9e6a', sunI: 1.2, hemi: 0.6, glow: 1.25, elev: 0.12 },
];

export async function createBuilding(container, { mobile = false, onHover, onPick, shift = { x: 0, y: 0 } } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'flight__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__posterMode });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xefd9bd, 160, 520);
  const camera = new THREE.PerspectiveCamera(mobile ? 50 : 38, 1, 0.5, 600);

  // Licht
  const hemi = new THREE.HemisphereLight(0xdfe8ef, 0x4a5236, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 10, far: 220 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // Materialien
  const concrete = new THREE.MeshStandardMaterial({ color: 0xebe5da, roughness: 0.86 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8f877a, roughness: 0.95 });
  const oak = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.72 });
  const darkGlass = new THREE.MeshStandardMaterial({ color: 0x27333a, roughness: 0.25, metalness: 0.4 });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xc9d6dc, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false });
  const glassMats = [];
  const floorGlass = [];

  const building = new THREE.Group();
  scene.add(building);
  const add = (geo, mat, x, y, z, { cast = true, receive = true, parent = building } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m;
  };

  // Sockel
  add(new THREE.BoxGeometry(W + 2, PLINTH, D + 2), stone, 0, PLINTH / 2, 0);

  const hits = [];
  const highlights = [];
  const fins = [];
  const balconies = [];
  for (let f = 0; f < FLOOR_COUNT; f++) {
    const ph = f === FLOOR_COUNT - 1;
    const fw = ph ? PW : W, fd = ph ? PD : D;
    const cx = ph ? -3 : 0;
    const y0 = floorY(f);
    const gh = FLOOR_H - 0.45;
    // Glas je Geschoss: lange Seiten (±z) / kurze Seiten (±x) mit eigenem Raster
    const long = windowTextures(Math.round(fw / 1.5), 11 + f * 7);
    const short = windowTextures(Math.round(fd / 1.5), 101 + f * 13);
    const mk = (t) => { const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.22, metalness: 0.35 }); glassMats.push(m); return m; };
    const mLong = mk(long), mShort = mk(short);
    floorGlass.push([mLong, mShort]);
    const mats = [mShort, mShort, darkGlass, darkGlass, mLong, mLong];
    add(new THREE.BoxGeometry(fw - 1.2, gh, fd - 1.2), mats, cx, y0 + gh / 2, 0);
    // Deckenband
    add(new THREE.BoxGeometry(fw + 0.4, 0.45, fd + 0.4), concrete, cx, y0 + FLOOR_H - 0.225, 0);
    // Lamellen aus Eiche (InstancedMesh, siehe unten)
    for (let x = -fw / 2 + 0.8; x <= fw / 2 - 0.8; x += 1.5) { fins.push([cx + x, y0 + gh / 2, fd / 2 - 0.45]); fins.push([cx + x, y0 + gh / 2, -fd / 2 + 0.45]); }
    for (let z = -fd / 2 + 1.2; z <= fd / 2 - 1.2; z += 1.5) { fins.push([cx + fw / 2 - 0.45, y0 + gh / 2, z, 1]); fins.push([cx - fw / 2 + 0.45, y0 + gh / 2, z, 1]); }
    // Loggien an der Südseite (1.–5. OG): auskragende Platte + Glasbrüstung
    if (f >= 1 && f <= 5) {
      [-14.4, -7.2, 0, 7.2, 14.4].forEach((bx, i) => { if ((i + f) % 2 === 0) balconies.push([bx, y0, fd / 2]); });
    }
    // Treffer-Körper und Hervorhebung
    const hb = new THREE.Mesh(new THREE.BoxGeometry(fw + 1.2, FLOOR_H - 0.1, fd + 1.2), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    hb.position.set(cx, y0 + FLOOR_H / 2, 0);
    hb.userData.floor = f;
    hb.renderOrder = 2;
    building.add(hb);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(hb.geometry), new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0 }));
    edges.position.copy(hb.position);
    building.add(edges);
    hits.push(hb);
    highlights.push({ fill: hb.material, line: edges.material, v: 0, target: 0 });
  }
  // Dach Penthouse + Dachterrasse auf dem 6. OG
  const roofY = floorY(FLOOR_COUNT);
  add(new THREE.BoxGeometry(PW + 1.2, 0.5, PD + 1.2), concrete, -3, roofY + 0.25, 0);
  const terraceY = floorY(FLOOR_COUNT - 1);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 1.0, 0.06), parapetMat); rail.position.set(0, terraceY + 0.5, D / 2 + 0.17); building.add(rail);
  const rail2 = rail.clone(); rail2.position.z = -D / 2 - 0.17; building.add(rail2);

  const finGeo = new THREE.BoxGeometry(0.14, FLOOR_H - 0.45, 0.62);
  const finMesh = new THREE.InstancedMesh(finGeo, oak, fins.length);
  const mtx = new THREE.Matrix4(); const q = new THREE.Quaternion(); const one = new THREE.Vector3(1, 1, 1);
  const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  fins.forEach(([x, y, z, side], i) => { mtx.compose(new THREE.Vector3(x, y, z), side ? rotY : q, one); finMesh.setMatrixAt(i, mtx); });
  finMesh.castShadow = true; finMesh.receiveShadow = true; building.add(finMesh);

  const slabGeo = new THREE.BoxGeometry(6.4, 0.24, 1.9);
  const parGeo = new THREE.BoxGeometry(6.4, 1.0, 0.05);
  const slabMesh = new THREE.InstancedMesh(slabGeo, concrete, balconies.length);
  const parMesh = new THREE.InstancedMesh(parGeo, parapetMat, balconies.length);
  balconies.forEach(([x, y, z], i) => {
    mtx.compose(new THREE.Vector3(x, y + 0.12, z + 0.95), q, one); slabMesh.setMatrixAt(i, mtx);
    mtx.compose(new THREE.Vector3(x, y + 0.74, z + 1.85), q, one); parMesh.setMatrixAt(i, mtx);
  });
  slabMesh.castShadow = true; slabMesh.receiveShadow = true;
  building.add(slabMesh, parMesh);

  // Umgebung: Boden, Platz, Wege
  const ground = new THREE.Mesh(new THREE.CircleGeometry(700, 72), new THREE.MeshStandardMaterial({ color: 0x9aa37f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const paveMat = new THREE.MeshStandardMaterial({ color: 0xd6cdbd, roughness: 0.95 });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(56, 34), paveMat); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; scene.add(plaza);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(5, 120), paveMat); path.rotation.x = -Math.PI / 2; path.rotation.z = 0.35; path.position.set(18, 0.03, 68); path.receiveShadow = true; scene.add(path);
  // Wasserbecken vor dem Eingang
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), new THREE.MeshStandardMaterial({ color: 0x41606b, roughness: 0.08, metalness: 0.6 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-8, 0.05, 13); scene.add(pool);

  // Bäume (InstancedMesh, Kronen in leicht variierenden Grüntönen)
  const r = rng(4242);
  const trees = [];
  for (let i = 0; trees.length < (mobile ? 170 : 260) && i < 2000; i++) {
    const a = r() * Math.PI * 2, rad = 30 + Math.pow(r(), 1.1) * 210;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad * 0.85;
    if (Math.abs(x) < 32 && Math.abs(z) < 20) continue;
    if (z > 15 && Math.abs(x - 18 - (z - 68) * -0.36) < 6) continue; // Weg frei halten
    trees.push({ x, z, s: 2.4 + r() * 2.8, h: r() });
  }
  // Bäume auf der Dachterrasse
  const roofTrees = [[10, terraceY, 3], [13.5, terraceY, -3], [16, terraceY, 2.5], [-2, roofY + 0.5, 2], [-8, roofY + 0.5, -2]].map(([x, y, z]) => ({ x, z, y, s: 1.1, h: 0.5 }));
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6);
  const all = [...trees, ...roofTrees];
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), all.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 }), all.length);
  const col = new THREE.Color();
  all.forEach((t, i) => {
    const y = t.y || 0;
    mtx.compose(new THREE.Vector3(t.x, y + t.s * 1.55, t.z), q, new THREE.Vector3(t.s * 0.95, t.s * 1.25, t.s * 0.95)); crowns.setMatrixAt(i, mtx);
    mtx.compose(new THREE.Vector3(t.x, y + t.s * 0.45, t.z), q, new THREE.Vector3(t.s, t.s * 0.9, t.s)); trunks.setMatrixAt(i, mtx);
    col.setHSL(0.22 + t.h * 0.09, 0.2 + t.h * 0.14, 0.34 + t.h * 0.12); crowns.setColorAt(i, col);
  });
  crowns.castShadow = true; crowns.receiveShadow = true; trunks.castShadow = true;
  scene.add(crowns, trunks);

  // Nachbarbebauung in der Ferne (einfache Kuben)
  const nbMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2, rad = 270 + r() * 80;
    const h = 6 + r() * 12;
    const m = add(new THREE.BoxGeometry(14 + r() * 16, h, 10 + r() * 10), nbMat, Math.cos(a) * rad, h / 2, Math.sin(a) * rad, { cast: false, receive: false, parent: scene });
    m.rotation.y = r() * Math.PI;
  }

  // Kamerapfade
  const orbit = new THREE.CatmullRomCurve3(ORBIT.map(([a, r, h]) => new THREE.Vector3(a, r, h)), false, 'catmullrom', 0.5);
  const tgtY = new THREE.CatmullRomCurve3(ORBIT.map(([, , , t], i) => new THREE.Vector3(i, t, 0)), false, 'catmullrom', 0.5);
  const o = new THREE.Vector3(), ty = new THREE.Vector3();

  // Zustand
  let target = 0, current = -1, raf = 0, visible = true, hovered = -1, selected = -1;
  let distScale = 1, glow = 0.15;
  const GOLD = new THREE.Color(0xffc477), WHITE = new THREE.Color(0xffffff);
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  const cTop = new THREE.Color(), cBot = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();

  function mood(p) {
    const seg = p < 0.5 ? 0 : 1; const t = p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
    const a = MOODS[seg], b = MOODS[seg + 1];
    const mix = (k) => a[k] + (b[k] - a[k]) * t;
    cTop.set(a.top).lerp(cB.set(b.top), t); cBot.set(a.bot).lerp(cB.set(b.bot), t);
    container.style.setProperty('--sky-top', `#${cTop.getHexString()}`);
    container.style.setProperty('--sky-bot', `#${cBot.getHexString()}`);
    scene.fog.color.copy(cBot);
    sun.color.set(a.sun).lerp(cA.set(b.sun), t); sun.intensity = mix('sunI');
    hemi.intensity = mix('hemi');
    const el = mix('elev');
    sun.position.set(-60 * Math.cos(el), 120 * Math.sin(el) + 12, 70);
    glow = mix('glow');
  }

  function apply(p) {
    const k = Math.min(Math.max(p, 0), 1);
    orbit.getPoint(k, o); tgtY.getPoint(k, ty);
    const ang = THREE.MathUtils.degToRad(o.x);
    const rad = o.y * distScale;
    tgt.set(0, ty.y, 0);
    pos.set(Math.sin(ang) * rad, ty.y + (o.z - ty.y) * Math.min(distScale, 1.3), Math.cos(ang) * rad);
    camera.position.copy(pos); camera.lookAt(tgt);
    mood(k);
  }

  let last = 0;
  function frame(now) {
    raf = 0;
    // zeitbasierte Glättung: gleiche Trägheit bei 30 oder 120 fps
    const dt = Math.min((now - (last || now)) / 1000, 0.1) || 1 / 60;
    last = now;
    const k = 1 - Math.exp(-dt * 7);
    let busy = false;
    const d = target - current;
    if (current < 0) current = target;
    else if (Math.abs(d) > 0.0003) { current += d * k; busy = true; } else current = target;
    apply(current);
    highlights.forEach((h, i) => {
      h.target = i === hovered ? 1 : i === selected ? 0.75 : 0;
      const dv = h.target - h.v;
      if (Math.abs(dv) > 0.01) { h.v += dv * Math.min(1, k * 1.8); busy = true; } else h.v = h.target;
      h.fill.opacity = h.v * 0.42; h.line.opacity = h.v;
      // gewählte Etage: Fenster leuchten warm auf
      floorGlass[i].forEach((m) => { m.emissiveIntensity = glow + h.v * 2.4; m.emissive.copy(WHITE).lerp(GOLD, h.v); });
    });
    renderer.render(scene, camera);
    if (busy) request(); else last = 0;
  }
  const request = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // schmale Formate: Kamera weiter weg, damit das Gebäude ins Bild passt
    distScale = camera.aspect < 1 ? 1.25 + (1 - camera.aspect) * 0.5 : 1;
    scene.fog.near = 50 * distScale; scene.fog.far = 560 * distScale;
    // Bildausschnitt verschieben (Platz für Text/Bedienfelder), ohne die Kamera zu drehen
    if (shift.x || shift.y) camera.setViewOffset(w, h, -shift.x * w, shift.y * h, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    request();
  }
  const ro = new ResizeObserver(resize); ro.observe(container);
  resize();

  // Zeigen & Klicken auf Etagen
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    return hit ? hit.object.userData.floor : -1;
  }
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const f = pick(e);
    if (f !== hovered) { hovered = f; canvas.style.cursor = f >= 0 ? 'pointer' : ''; onHover?.(f, e); request(); }
    else if (f >= 0) onHover?.(f, e);
  });
  canvas.addEventListener('pointerleave', () => { if (hovered !== -1) { hovered = -1; onHover?.(-1); request(); } });
  canvas.addEventListener('click', (e) => { const f = pick(e); if (f >= 0) onPick?.(f); });

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) request(); });
  io.observe(container);
  document.addEventListener('visibilitychange', request);

  const api = {
    debug: () => ({ target, current, hovered, selected, hv: highlights.map((h) => +h.v.toFixed(2)), cam: camera.position.toArray().map((v) => +v.toFixed(1)) }),
    setProgress(p) { target = p; request(); },
    highlight(f) { hovered = f; request(); },
    select(f) { selected = f; request(); },
    renderNow(p) { target = p; current = p; apply(p); renderer.render(scene, camera); },
    dispose() { ro.disconnect(); io.disconnect(); cancelAnimationFrame(raf); renderer.dispose(); },
  };
  if (import.meta.env.DEV) window.__building = api;
  return api;
}
