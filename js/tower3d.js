/* Teilmal – Turmbau in 3D (wird erst beim Spielen geladen)
 *
 * Gleiches Spiel wie die 2D-Version (js/games2.js): richtige Antwort → ein Hochhaus-Stockwerk hängt am Kran und
 * schwingt hin und her; tippen lässt es fallen, was übersteht, bricht ab. Hier aber als 3D-Szene: Stockwerke mit
 * Fensterfassaden und einem Leuchtschild mit der gelösten Rechnung, ein Kletterkran mit Seil, eine Stadt rundherum,
 * Wolken, durch die der Turm hindurchwächst, und ein Himmel, der mit der Höhe dunkler wird.
 * Masse wie in 2D: x und Breite in Prozent der Bühne (0–100) → Welt: (p − 50) / 10.
 */
'use strict';

const TW3 = { FH: 0.95, D: 2.6, FALL: 0.32 };
const tw3X = (p) => (p - 50) / 10;

function tw3Canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
/** Fassade: Farbe, Simse, zwei Fensterreihen (je nach «lit» mehr oder weniger beleuchtet) */
function tw3FacadeCanvas(col, lit) {
  return tw3Canvas(256, 128, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 10, w, 10);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 7, w, 3);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
      const x = 14 + i * 60, y = 22 + row * 50, ww = 40, hh = 34;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 3, y - 3, ww + 6, hh + 6);
      const on = Math.random() < [0.15, 0.45, 0.8][lit];
      if (on) { const wg = g.createLinearGradient(x, y, x, y + hh); wg.addColorStop(0, '#fff7cc'); wg.addColorStop(1, '#fbbf24'); g.fillStyle = wg; }
      else { const wg = g.createLinearGradient(x, y, x + ww, y + hh); wg.addColorStop(0, '#bfe3ff'); wg.addColorStop(0.55, '#5f95c4'); wg.addColorStop(1, '#2f5f8f'); g.fillStyle = wg; }
      g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x + 4, y + hh - 4); g.lineTo(x + 16, y + 4); g.lineTo(x + 22, y + 4); g.lineTo(x + 10, y + hh - 4); g.fill();
      g.fillStyle = 'rgba(40,40,40,.55)'; g.fillRect(x + ww / 2 - 1, y, 2, hh); g.fillRect(x, y + hh / 2 - 1, ww, 2);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x - 4, y + hh + 3, ww + 8, 3);
    }
  });
}
/** Leuchtschild mit der gelösten Rechnung */
function tw3SignCanvas(text) {
  return tw3Canvas(512, 128, (g, w, h) => {
    const r = 40;
    g.beginPath(); g.moveTo(r, 8); g.arcTo(w - 8, 8, w - 8, h - 8, r); g.arcTo(w - 8, h - 8, 8, h - 8, r); g.arcTo(8, h - 8, 8, 8, r); g.arcTo(8, 8, w - 8, 8, r); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1e1b4b'); gr.addColorStop(1, '#0f172a'); g.fillStyle = gr; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#a78bfa'; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 78; const f = (s) => `900 ${s}px "Bricolage Grotesque", Lexend, system-ui, sans-serif`; g.font = f(fs);
    while (g.measureText(text).width > w - 60 && fs > 30) { fs -= 4; g.font = f(fs); }
    g.shadowColor = '#c4b5fd'; g.shadowBlur = 14; g.fillText(text, w / 2, h / 2 + 3);
  });
}

async function startTower3D() {
  const T = await w3Three();
  Object.assign(game, { picker: gamePicker(), tw: { blocks: [{ x: 30, w: 40, label: 'Erdgeschoss' }], phase: 'ask', hang: null, t: null, swingT: 0 }, over: false });
  const r = runStart('tower');
  $('#view').innerHTML = gameShell('tower', `
    ${runHudHTML('bar-hud')}
    ${r.mode === 'survive' ? '<div class="shot-clock tw-clock" id="twclock"><i></i></div>' : ''}
    <div class="tw-stage tw3" id="twstage">
      <div class="tw-tip" id="twtip" hidden>Tippe, um das Stockwerk loszulassen!</div>
      <div class="tw3-pop" id="twpop"></div>
      <div class="tw3-height" id="twheight">🏢 <b>0</b> Stockwerke</div>
    </div>
    <div class="tw-ask" id="twask"></div>
    <p class="mode-hint">Richtige Antwort → ein Stockwerk hängt am Kran. Tippe ins Bild (oder Leertaste), um es fallen zu lassen. Was übersteht, bricht ab – genau getroffen gibt «Perfekt!».</p>`);
  const host = $('#twstage');
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'tw3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const skyLow = new T.Color('#9ad4ff'), skyHigh = new T.Color('#3b4fb8'), sky = skyLow.clone();
  scene.background = sky; scene.fog = new T.Fog(sky, 26, 70);
  const camera = new T.PerspectiveCamera(42, 1, 0.1, 300);
  let portrait = false;
  const resize = () => { const rr = host.getBoundingClientRect(); renderer.setSize(Math.max(1, rr.width), Math.max(1, rr.height), false); camera.aspect = Math.max(1, rr.width) / Math.max(1, rr.height); portrait = camera.aspect < 0.9; camera.fov = portrait ? 52 : 42; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  const own = [];
  const keep = (...x) => { own.push(...x); return x[0]; };
  scene.add(new T.HemisphereLight(0xffffff, 0x6b8f4a, 1.25));
  const sun = new T.DirectionalLight(0xfff0d8, 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  const box = keep(new T.BoxGeometry(1, 1, 1));

  /* ---------- Boden, Platz, Strasse ---------- */
  const grassTex = keep(new T.CanvasTexture(tw3Canvas(256, 256, (g, w, h) => { g.fillStyle = '#7cc35a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = ['#6db24c', '#8ad066', '#74bb52'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } })));
  grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping; grassTex.repeat.set(40, 40); grassTex.colorSpace = T.SRGBColorSpace;
  const ground = new T.Mesh(keep(new T.PlaneGeometry(300, 300)), keep(new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const plazaTex = keep(new T.CanvasTexture(tw3Canvas(256, 256, (g, w, h) => { g.fillStyle = '#d6d0c4'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const s = 196 + Math.floor(Math.random() * 30); g.fillStyle = `rgb(${s},${s - 6},${s - 16})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } })));
  plazaTex.wrapS = plazaTex.wrapT = T.RepeatWrapping; plazaTex.repeat.set(4, 3); plazaTex.colorSpace = T.SRGBColorSpace;
  const plaza = new T.Mesh(keep(new T.PlaneGeometry(16, 12)), keep(new T.MeshStandardMaterial({ map: plazaTex, roughness: 0.9 })));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.01, 0.5); plaza.receiveShadow = true; scene.add(plaza);
  const road = new T.Mesh(keep(new T.PlaneGeometry(300, 3.4)), keep(new T.MeshStandardMaterial({ color: 0x3f444d, roughness: 0.95 })));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.012, 8.2); road.receiveShadow = true; scene.add(road);
  const stripe = new T.Mesh(keep(new T.PlaneGeometry(300, 0.12)), keep(new T.MeshBasicMaterial({ color: 0xfacc15 })));
  stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.02, 8.2); scene.add(stripe);

  /* ---------- Stadt rundherum (eine Instanz-Gruppe) und Bäume ---------- */
  const cityTex = keep(new T.CanvasTexture(tw3Canvas(128, 256, (g, w, h) => {
    g.fillStyle = '#8ea3bf'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 22) for (let x = 8; x < w - 8; x += 22) { g.fillStyle = Math.random() < 0.3 ? '#ffe9a3' : '#5b7393'; g.fillRect(x, y, 12, 14); }
  })));
  cityTex.colorSpace = T.SRGBColorSpace;
  const cityMat = keep(new T.MeshStandardMaterial({ map: cityTex, roughness: 0.8 }));
  const CITY = 46, city = new T.InstancedMesh(box, cityMat, CITY);
  const m4 = new T.Matrix4(), q0 = new T.Quaternion(), v1 = new T.Vector3(), v2 = new T.Vector3(), col = new T.Color();
  for (let i = 0; i < CITY; i++) {
    const a = (i / CITY) * Math.PI * 2 + Math.random() * 0.08, rad = 20 + Math.random() * 22;
    let x = Math.sin(a) * rad, z = Math.cos(a) * rad - 6;
    if (z > 4 && Math.abs(x) < 16) z = -z - 10; // nicht vor die Kamera
    const hh = 3 + Math.random() * 12, ww = 2.4 + Math.random() * 2.6;
    city.setMatrixAt(i, m4.compose(v1.set(x, hh / 2, z), q0, v2.set(ww, hh, ww * (0.8 + Math.random() * 0.4))));
    city.setColorAt(i, col.setHSL(0.58 + Math.random() * 0.12, 0.25, 0.72 + Math.random() * 0.2));
  }
  city.receiveShadow = true; scene.add(city);
  const leaf = keep(new T.MeshStandardMaterial({ color: 0x3f9b46, roughness: 0.9, flatShading: true })), trunk = keep(new T.MeshStandardMaterial({ color: 0x8b5a2b }));
  const crown = keep(new T.IcosahedronGeometry(0.75, 0)), stem = keep(new T.CylinderGeometry(0.1, 0.14, 0.8, 6));
  const trees = new T.InstancedMesh(crown, leaf, 16), stems = new T.InstancedMesh(stem, trunk, 16);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, x = side * (6.2 + Math.random() * 2.5), z = -4 + (i >> 1) * 1.6 + Math.random() * 0.5, s = 0.8 + Math.random() * 0.5;
    trees.setMatrixAt(i, m4.compose(v1.set(x, 1.1 * s + 0.4, z), q0, v2.set(s, s * 1.15, s)));
    stems.setMatrixAt(i, m4.compose(v1.set(x, 0.4, z), q0, v2.set(1, 1, 1)));
  }
  trees.castShadow = true; scene.add(trees, stems);

  /* ---------- Wolken: der Turm wächst durch sie hindurch ---------- */
  const cloudMat = keep(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xe6efff, emissiveIntensity: 0.55, transparent: true, opacity: 0.95 }));
  const puff = keep(new T.IcosahedronGeometry(1, 3));
  const clouds = [];
  for (let i = 0; i < 22; i++) {
    const c = new T.Group();
    for (let k = 0; k < 5; k++) { const m = new T.Mesh(puff, cloudMat); m.position.set((k - 2) * 1.1 + Math.random() * 0.4, Math.random() * 0.5, Math.random() * 0.8); m.scale.setScalar(0.9 + Math.random() * 0.8); c.add(m); }
    const y = 9 + i * 1.8 + Math.random() * 2, side = i % 2 ? 1 : -1;
    c.position.set(side * (7 + Math.random() * 18), y, -12 - Math.random() * 18);
    c.userData.v = 0.15 + Math.random() * 0.25;
    c.scale.setScalar(0.8 + Math.random() * 0.7);
    scene.add(c); clouds.push(c);
  }

  /* ---------- Stockwerke ---------- */
  const COLORS = ['#e76f51', '#e9c46a', '#2a9d8f', '#8ab17d', '#f4a261', '#6d8db8', '#b56576', '#d4a373', '#5fa8d3', '#c9ada7'];
  const facadeCache = new Map();
  const facade = (c, lit) => { const k = `${c}|${lit}`; if (!facadeCache.has(k)) facadeCache.set(k, tw3FacadeCanvas(c, lit)); return facadeCache.get(k); };
  const topMat = keep(new T.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.9 }));
  /** Ein Stockwerk als Mesh (Breite in Prozent) */
  function floorMesh(f, wPct, base = false) {
    const W = wPct / 10, D = TW3.D;
    const cv = base ? baseCanvas : facade(f.c, f.lit);
    const front = keep(new T.CanvasTexture(cv)); front.colorSpace = T.SRGBColorSpace; front.wrapS = T.RepeatWrapping; front.repeat.set(base ? 1 : W / 2, 1);
    const side = keep(new T.CanvasTexture(cv)); side.colorSpace = T.SRGBColorSpace; side.wrapS = T.RepeatWrapping; side.repeat.set(base ? 0.6 : D / 2, 1);
    const fm = keep(new T.MeshStandardMaterial({ map: front, roughness: 0.75 })), sm = keep(new T.MeshStandardMaterial({ map: side, roughness: 0.75 }));
    const m = new T.Mesh(box, [sm, sm, topMat, topMat, fm, fm]);
    m.scale.set(W, TW3.FH, D); m.castShadow = true; m.receiveShadow = true;
    m.userData = { front, side };
    if (f.label && !base) {
      const st = keep(new T.CanvasTexture(tw3SignCanvas(f.label))); st.colorSpace = T.SRGBColorSpace;
      const sw = Math.min(W * 0.82, 2.2), sign = new T.Mesh(keep(new T.PlaneGeometry(1, 1)), keep(new T.MeshBasicMaterial({ map: st, transparent: true })));
      sign.scale.set(sw / W, (sw / 4) / TW3.FH, 1); sign.position.set(0, -0.5 + (sw / 8 + 0.06) / TW3.FH, 0.501);
      m.add(sign); m.userData.sign = sign;
    }
    return m;
  }
  const baseCanvas = tw3Canvas(512, 128, (g, w, h) => {
    g.fillStyle = '#e2e8f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#94a3b8'; g.fillRect(0, 0, w, 14);
    for (let i = 0; i < 4; i++) { const x = 20 + i * 122; const wg = g.createLinearGradient(x, 30, x, 120); wg.addColorStop(0, '#dbeafe'); wg.addColorStop(1, '#60a5fa'); g.fillStyle = wg; g.fillRect(x, 34, 100, 94); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + 8, 40, 10, 80); }
    g.fillStyle = '#7c4a1e'; g.fillRect(w / 2 - 26, 50, 52, 78); g.fillStyle = '#fde68a'; g.fillRect(w / 2 + 14, 88, 6, 6);
  });
  const baseLabel = tw3Canvas(512, 128, (g, w, h) => { g.fillStyle = '#111827'; g.fillRect(0, 0, w, h); g.fillStyle = '#fde047'; g.font = '900 70px "Bricolage Grotesque", Lexend, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🏪 START', w / 2, h / 2 + 4); });
  const floors = []; // Meshes der Stockwerke (Index = Ebene)
  function addFloor(b, level) {
    const m = floorMesh(b, b.w, level === 0);
    m.position.set(tw3X(b.x + b.w / 2), TW3.FH * (level + 0.5), 0);
    if (level === 0) {
      // Markise und Ladenschild
      const awn = keep(new T.CanvasTexture(tw3Canvas(256, 32, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ef4444'; g.fillRect(i * 16, 0, 16, h); } })));
      awn.colorSpace = T.SRGBColorSpace;
      const a = new T.Mesh(box, keep(new T.MeshStandardMaterial({ map: awn })));
      a.scale.set(1.04, 0.06 / TW3.FH, 0.5 / TW3.D); a.position.set(0, 0.47, 0.62); a.rotation.x = 0.35; m.add(a);
      const lt = keep(new T.CanvasTexture(baseLabel)); lt.colorSpace = T.SRGBColorSpace;
      const s = new T.Mesh(keep(new T.PlaneGeometry(1, 1)), keep(new T.MeshBasicMaterial({ map: lt })));
      s.scale.set(0.5, 0.22, 1); s.position.set(0, 0.3, 0.505); m.add(s);
    }
    scene.add(m); floors[level] = m;
    return m;
  }
  /* ---------- Dach mit Antenne (auf dem obersten Stockwerk) ---------- */
  const roof = new T.Group();
  const slab = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 }))); slab.scale.set(1, 0.12, TW3.D + 0.12); slab.position.y = 0.06; slab.castShadow = true; roof.add(slab);
  const hut = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0xcbd5e1 }))); hut.scale.set(0.7, 0.45, 0.7); hut.position.set(0, 0.34, -0.4); hut.castShadow = true; roof.add(hut);
  const mast = new T.Mesh(keep(new T.CylinderGeometry(0.03, 0.04, 1.3, 6)), keep(new T.MeshStandardMaterial({ color: 0x374151 }))); mast.position.set(0, 0.8, -0.4); roof.add(mast);
  const blink = new T.Mesh(keep(new T.SphereGeometry(0.07, 10, 8)), keep(new T.MeshBasicMaterial({ color: 0xef4444 }))); blink.position.set(0, 1.47, -0.4); roof.add(blink);
  scene.add(roof);
  function placeRoof() {
    const tw = game.tw, top = tw.blocks[tw.blocks.length - 1];
    roof.visible = tw.blocks.length > 1;
    roof.position.set(tw3X(top.x + top.w / 2), TW3.FH * tw.blocks.length, 0);
    slab.scale.x = top.w / 10 + 0.12;
    hut.position.x = Math.min(0.3, top.w / 40);
  }

  /* ---------- Kletterkran ---------- */
  const yellow = keep(new T.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6, metalness: 0.2 })), dark = keep(new T.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 }));
  const latticeTex = keep(new T.CanvasTexture(tw3Canvas(64, 128, (g, w, h) => { g.fillStyle = '#facc15'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a16207'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4); g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h / 2); g.lineTo(0, h); g.moveTo(w, 0); g.lineTo(0, h / 2); g.lineTo(w, h); g.stroke(); })));
  latticeTex.colorSpace = T.SRGBColorSpace; latticeTex.wrapT = T.RepeatWrapping;
  const latMat = keep(new T.MeshStandardMaterial({ map: latticeTex, roughness: 0.6, transparent: true, alphaTest: 0.1 }));
  const craneMast = new T.Mesh(box, latMat); craneMast.castShadow = true; scene.add(craneMast);
  const jib = new T.Mesh(box, yellow); jib.castShadow = true; scene.add(jib);
  const counter = new T.Mesh(box, dark); counter.castShadow = true; scene.add(counter);
  const cab = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0xf97316 }))); cab.castShadow = true; scene.add(cab);
  const trolley = new T.Mesh(box, dark); trolley.scale.set(0.5, 0.22, 0.5); scene.add(trolley);
  const cable = new T.Mesh(keep(new T.CylinderGeometry(0.025, 0.025, 1, 6)), dark); scene.add(cable);
  const hook = new T.Mesh(box, dark); hook.scale.set(0.5, 0.12, 0.12); scene.add(hook);
  const MAST_X = -7.2, MAST_Z = -1.4;
  function placeCrane(jibY) {
    craneMast.scale.set(0.55, jibY, 0.55); craneMast.position.set(MAST_X, jibY / 2, MAST_Z);
    latticeTex.repeat.set(1, jibY / 1.1);
    jib.scale.set(14.5, 0.32, 0.4); jib.position.set(MAST_X + 6.9, jibY + 0.16, MAST_Z);
    counter.scale.set(1.4, 0.7, 0.7); counter.position.set(MAST_X - 1.6, jibY, MAST_Z);
    cab.scale.set(0.7, 0.6, 0.7); cab.position.set(MAST_X + 0.6, jibY - 0.35, MAST_Z + 0.2);
  }

  /* ---------- Spiel-Zustand der Szene ---------- */
  const S = { camY: 2.2, jibY: 4.5, t: 0, last: performance.now(), hang: null, falls: [], landT: 0 };
  game.tw.blocks.forEach((b, i) => addFloor(b, i));
  placeRoof();
  const hangY = () => TW3.FH * (game.tw.blocks.length + 0.5) + 1.7;
  function setHeight() { const el = $('#twheight b'); if (el) el.textContent = game.tw.blocks.length - 1; }

  const tw = game.tw;
  tw.r3 = {
    /** richtige Antwort: neues Stockwerk hängt am Kran */
    hang(label) {
      const top = tw.blocks[tw.blocks.length - 1];
      const f = { w: top.w, label, c: COLORS[Math.floor(Math.random() * COLORS.length)], lit: Math.floor(Math.random() * 3) };
      f.mesh = floorMesh(f, f.w);
      scene.add(f.mesh);
      tw.hang = f;
    },
    /** loslassen */
    drop() {
      const h = tw.hang, top = tw.blocks[tw.blocks.length - 1];
      if (!h) return;
      tw.phase = 'fall';
      $('#twtip').hidden = true;
      const x = tw.hx - h.w / 2, level = tw.blocks.length;
      const ov = Math.min(x + h.w, top.x + top.w) - Math.max(x, top.x);
      const y0 = h.mesh.position.y, yLand = TW3.FH * (level + 0.5);
      tw.hang = null;
      if (ov <= 0.5) { // daneben: fällt am Turm vorbei
        S.falls.push({ m: h.mesh, vy: 0, vx: (x < top.x ? -1 : 1) * 1.2, spin: (x < top.x ? 1 : -1) * 2.2, t: 0, life: 1.6 });
        gLater(() => { sfx.bad(); tone([300, 200], 0.12, 'sawtooth', 0.04); if (runWrong()) return; twAsk(); }, 450);
        return;
      }
      S.drop = { m: h.mesh, y0, y1: yLand, t: 0, done: () => {
        const perfect = Math.abs(x - top.x) < 1.3;
        const nb = perfect ? { x: top.x, w: Math.min(46, top.w + 2.5), label: h.label, c: h.c, lit: h.lit } : { x: Math.max(x, top.x), w: ov, label: h.label, c: h.c, lit: h.lit };
        // überstehendes Stück bricht ab und fällt
        if (!perfect) {
          const cutL = x < top.x, cw = h.w - ov;
          const piece = floorMesh({ c: h.c, lit: h.lit }, cw);
          piece.position.set(tw3X((cutL ? x : top.x + top.w) + cw / 2), yLand, 0);
          scene.add(piece);
          S.falls.push({ m: piece, vy: 0.5, vx: (cutL ? -1 : 1) * 1.6, spin: (cutL ? 1 : -1) * 3, t: 0, life: 1.4 });
        }
        scene.remove(h.mesh);
        tw.blocks.push(nb);
        const m = addFloor(nb, tw.blocks.length - 1);
        S.land = { m, t: 0 };
        placeRoof(); setHeight();
        if (perfect) {
          tone([880, 1320], 0.08, 'triangle', 0.06);
          const p = $('#twpop'); if (p) { p.textContent = 'Perfekt!'; p.classList.remove('on'); void p.offsetWidth; p.classList.add('on'); }
          S.glow = { m, t: 0 };
        } else tone([392], 0.06, 'square', 0.04);
        if (runRight()) return;
        gLater(twAsk, perfect ? 500 : 300);
      } };
    },
  };

  /* ---------- Bild ---------- */
  let raf = 0;
  const look = new T.Vector3();
  function frame(now) {
    if (!$('#twstage')) return;
    raf = requestAnimationFrame(frame);
    game.raf = raf;
    const dt = Math.max(0, Math.min(0.05, (now - S.last) / 1000)); S.last = now; S.t += dt;
    const n = tw.blocks.length;
    // Schwingen (wie in 2D)
    tw.swingT += dt * Math.min(3.3, 1.5 + (n - 1) * 0.11);
    const w = tw.hang ? tw.hang.w : 30;
    tw.hx = 50 + Math.sin(tw.swingT) * (50 - w / 2 - 1);
    // Kran klettert mit, Kamera folgt der Turmspitze
    const topY = TW3.FH * n;
    S.jibY += (topY + 3.6 - S.jibY) * Math.min(1, dt * 2.5);
    S.camY += (topY + 0.6 - S.camY) * Math.min(1, dt * 2.2);
    placeCrane(S.jibY);
    const hx = tw3X(tw.hx), hy = Math.min(hangY(), S.jibY - 1.1);
    trolley.position.set(hx, S.jibY - 0.08, MAST_Z);
    if (tw.hang) tw.hang.mesh.position.set(hx, hy + Math.sin(S.t * 3) * 0.04, 0);
    const cableTop = S.jibY - 0.15, cableBot = tw.hang ? hy + TW3.FH / 2 + 0.06 : S.jibY - 1.0;
    cable.scale.y = Math.max(0.1, cableTop - cableBot); cable.position.set(hx, (cableTop + cableBot) / 2, tw.hang ? 0 : MAST_Z);
    cable.rotation.x = tw.hang ? Math.atan2(MAST_Z, cableTop - cableBot) * 0 : 0;
    hook.position.set(hx, cableBot, tw.hang ? 0 : MAST_Z);
    if (tw.hang) { cable.position.z = 0; hook.position.z = 0; trolley.position.z = 0; jib.position.z = 0; jib.scale.z = 0.4; }
    // fallen lassen
    if (S.drop) {
      const d = S.drop; d.t += dt / TW3.FALL;
      const k = Math.min(1, d.t);
      d.m.position.y = d.y0 + (d.y1 - d.y0) * k * k;
      if (k >= 1) { const cb = d.done; S.drop = null; cb(); }
    }
    // abgebrochene / danebengefallene Stücke
    for (let i = S.falls.length - 1; i >= 0; i--) {
      const f = S.falls[i]; f.t += dt; f.vy -= 14 * dt;
      f.m.position.y += f.vy * dt; f.m.position.x += f.vx * dt; f.m.rotation.z += f.spin * dt;
      if (f.m.position.y < TW3.FH * 0.5) { f.m.position.y = TW3.FH * 0.5; f.vy = Math.abs(f.vy) * 0.25; f.vx *= 0.6; f.spin *= 0.5; }
      if (f.t > f.life) { scene.remove(f.m); S.falls.splice(i, 1); }
    }
    // Aufsetzen: kurz zusammendrücken; perfekt: kurz leuchten
    if (S.land) { S.land.t += dt * 6; const k = Math.min(1, S.land.t); S.land.m.scale.y = TW3.FH * (1 - Math.sin(k * Math.PI) * 0.12); if (k >= 1) { S.land.m.scale.y = TW3.FH; S.land = null; } }
    if (S.glow) { S.glow.t += dt; const e = Math.max(0, 1 - S.glow.t / 0.8); S.glow.m.material.forEach((mm) => { if (mm.emissive) { mm.emissive.setRGB(1, 0.85, 0.3); mm.emissiveIntensity = e * 0.7; } }); if (e <= 0) S.glow = null; }
    blink.visible = Math.sin(S.t * 5) > 0;
    // Wolken ziehen, Himmel wird mit der Höhe dunkler
    for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 30) c.position.x = -30; }
    sky.copy(skyLow).lerp(skyHigh, Math.min(1, topY / 45)); scene.fog.color.copy(sky);
    // Kamera
    const back = portrait ? 15.5 : 12.5;
    camera.position.set(portrait ? 3.2 : 5.5, S.camY + 2.6, back);
    look.set(0, S.camY - 0.6, 0);
    camera.lookAt(look);
    sun.position.set(6, S.camY + 12, 8); sun.target.position.set(0, S.camY - 2, 0);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  host.addEventListener('pointerdown', (e) => { if (game.tw?.phase === 'drop') { e.preventDefault(); twDrop(); } });
  setGameKeys((e) => {
    if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') && game.tw?.phase === 'drop') { e.preventDefault(); twDrop(); return; }
    const k = Number(e.key);
    if (game.tw?.phase === 'ask' && k >= 1 && k <= 4) $$('#twask .tw-ans')[k - 1]?.click();
  });
  game.stage3d = {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      city.dispose?.(); trees.dispose?.(); stems.dispose?.();
      own.forEach((x) => { try { x.dispose?.(); } catch { /* */ } });
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  game.tw3dbg = { S, scene, render: () => renderer.render(scene, camera) };
  setHeight();
  twAsk();
}
