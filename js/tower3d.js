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
/** Fassade in drei Stilen: «classic» (Bogenfenster mit Läden), «glass» (Glasfront), «brick» (Backstein mit Blumenkästen) */
function tw3FacadeCanvas(col, lit, style = 'classic') {
  const on = () => Math.random() < [0.15, 0.45, 0.8][lit];
  const glass = (g, x, y, ww, hh, light) => {
    if (light) { const wg = g.createLinearGradient(x, y, x, y + hh); wg.addColorStop(0, '#fff7cc'); wg.addColorStop(1, '#fbbf24'); g.fillStyle = wg; }
    else { const wg = g.createLinearGradient(x, y, x + ww, y + hh); wg.addColorStop(0, '#d6ecff'); wg.addColorStop(0.5, '#6aa3d6'); wg.addColorStop(1, '#2c5a8a'); g.fillStyle = wg; }
    g.fillRect(x, y, ww, hh);
    g.fillStyle = 'rgba(255,255,255,.38)'; g.beginPath(); g.moveTo(x + 4, y + hh - 4); g.lineTo(x + ww * 0.42, y + 3); g.lineTo(x + ww * 0.58, y + 3); g.lineTo(x + ww * 0.2, y + hh - 4); g.fill();
  };
  return tw3Canvas(256, 128, (g, w, h) => {
    if (style === 'glass') {
      g.fillStyle = '#1e293b'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) for (let row = 0; row < 2; row++) glass(g, 4 + i * 42, 10 + row * 56, 38, 50, on());
      g.fillStyle = col; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
      g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i <= 6; i++) g.fillRect(2 + i * 42, 0, 3, h);
      return;
    }
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    if (style === 'brick') {
      for (let y = 0; y < h; y += 10) for (let x = (y / 10) % 2 ? -12 : 0; x < w; x += 24) { g.fillStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.08})`; g.fillRect(x + 1, y + 1, 22, 8); }
    }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 9, w, 9);
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 80, y = 20, ww = 52, hh = 70;
      if (style === 'classic') {
        // Läden, Bogenfenster mit weissem Rahmen
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - 16, y + 6, 12, hh - 6); g.fillRect(x + ww + 4, y + 6, 12, hh - 6);
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x - 4, y + hh + 4); g.lineTo(x - 4, y + 22); g.arc(x + ww / 2, y + 22, ww / 2 + 4, Math.PI, 0); g.lineTo(x + ww + 4, y + hh + 4); g.fill();
        g.save(); g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x, y + 22); g.arc(x + ww / 2, y + 22, ww / 2, Math.PI, 0); g.lineTo(x + ww, y + hh); g.closePath(); g.clip();
        glass(g, x, y - 6, ww, hh + 6, on()); g.restore();
        g.fillStyle = '#ffffff'; g.fillRect(x + ww / 2 - 2, y + 4, 4, hh - 4); g.fillRect(x, y + 40, ww, 4);
        g.fillStyle = '#f8fafc'; g.fillRect(x - 8, y + hh + 2, ww + 16, 6);
      } else {
        g.fillStyle = '#f1f5f9'; g.fillRect(x - 5, y - 5, ww + 10, hh + 10);
        glass(g, x, y, ww, hh, on());
        g.fillStyle = '#f1f5f9'; g.fillRect(x + ww / 2 - 2, y, 4, hh); g.fillRect(x, y + hh / 2 - 2, ww, 4);
        // Blumenkasten
        g.fillStyle = '#7c4a1e'; g.fillRect(x - 6, y + hh + 4, ww + 12, 10);
        for (let k = 0; k < 7; k++) { g.fillStyle = ['#ef4444', '#f472b6', '#facc15', '#22c55e'][k % 4]; g.beginPath(); g.arc(x - 2 + k * 9.5, y + hh + 3, 4.5, 0, 7); g.fill(); }
      }
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
  const facade = (c, lit, st) => { const k = `${c}|${lit}|${st}`; if (!facadeCache.has(k)) facadeCache.set(k, tw3FacadeCanvas(c, lit, st)); return facadeCache.get(k); };
  const STYLES = ['classic', 'classic', 'brick', 'glass'];
  const corniceMat = keep(new T.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.8 }));
  const topMat = keep(new T.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.9 }));
  /** Ein Stockwerk als Mesh (Breite in Prozent) */
  function floorMesh(f, wPct, base = false) {
    const W = wPct / 10, D = TW3.D;
    const cv = base ? baseCanvas : facade(f.c, f.lit, f.st);
    const front = keep(new T.CanvasTexture(cv)); front.colorSpace = T.SRGBColorSpace; front.wrapS = T.RepeatWrapping; front.repeat.set(base ? 1 : W / 2, 1);
    const side = keep(new T.CanvasTexture(cv)); side.colorSpace = T.SRGBColorSpace; side.wrapS = T.RepeatWrapping; side.repeat.set(base ? 0.6 : D / 2, 1);
    const fm = keep(new T.MeshStandardMaterial({ map: front, roughness: 0.75 })), sm = keep(new T.MeshStandardMaterial({ map: side, roughness: 0.75 }));
    const m = new T.Mesh(box, [sm, sm, topMat, topMat, fm, fm]);
    m.scale.set(W, TW3.FH, D); m.castShadow = true; m.receiveShadow = true;
    m.userData = { front, side };
    // Gesims oben (etwas breiter, hell)
    const cor = new T.Mesh(box, corniceMat); cor.scale.set(1 + 0.16 / W, 0.1 / TW3.FH, 1 + 0.16 / D); cor.position.y = 0.5 - 0.05 / TW3.FH; cor.castShadow = true; m.add(cor);
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

  /* ---------- Pendel: das Stockwerk hängt an einem Seil (Aufhängung oben ausserhalb des Bildes) ---------- */
  const ropeMat = keep(new T.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.55, metalness: 0.3 }));
  const rope = new T.Mesh(keep(new T.CylinderGeometry(0.035, 0.035, 1, 8)), ropeMat); rope.castShadow = true; scene.add(rope);
  const clamp = new T.Group();
  const clampBar = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.4 }))); clampBar.scale.set(1.2, 0.12, 0.3); clamp.add(clampBar);
  const ring = new T.Mesh(keep(new T.TorusGeometry(0.13, 0.04, 8, 16)), ropeMat); ring.position.y = 0.16; clamp.add(ring);
  for (const sx of [-0.55, 0.55]) { const l = new T.Mesh(box, ropeMat); l.scale.set(0.05, 0.35, 0.05); l.position.set(sx, -0.12, 0); l.rotation.z = sx > 0 ? -0.25 : 0.25; clamp.add(l); }
  scene.add(clamp);
  const yUp = new T.Vector3(0, 1, 0), vDir = new T.Vector3();
  function placeRope(ax, ay, bx, by) { vDir.set(bx - ax, by - ay, 0); const len = vDir.length(); rope.position.set((ax + bx) / 2, (ay + by) / 2, 0); rope.scale.set(1, len, 1); rope.quaternion.setFromUnitVectors(yUp, vDir.normalize()); }
  // Skyline weit hinten (wandert mit der Höhe langsamer mit)
  const skyline = tw3Canvas(1024, 256, (g, w, h) => {
    let x = 0;
    while (x < w) { const bw = 30 + Math.random() * 60, bh = 60 + Math.random() * 170; g.fillStyle = `rgba(${90 + Math.random() * 30},${120 + Math.random() * 30},${175 + Math.random() * 30},.9)`; g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = 'rgba(255,240,190,.5)'; for (let yy = h - bh + 8; yy < h - 6; yy += 14) for (let xx = x + 5; xx < x + bw - 6; xx += 10) if (Math.random() < 0.3) g.fillRect(xx, yy, 4, 6);
      x += bw + 2; }
  });
  const skyT = keep(new T.CanvasTexture(skyline)); skyT.colorSpace = T.SRGBColorSpace;
  const skyMesh = new T.Mesh(keep(new T.PlaneGeometry(150, 37)), keep(new T.MeshBasicMaterial({ map: skyT, transparent: true, fog: false })));
  skyMesh.position.set(0, 15, -70); scene.add(skyMesh);
  // Glitzer bei «Perfekt!»
  const starT = keep(new T.CanvasTexture(tw3Canvas(64, 64, (g) => { g.fillStyle = '#fde047'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 12 : 30; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); })));
  starT.colorSpace = T.SRGBColorSpace;
  const starMat = keep(new T.SpriteMaterial({ map: starT, transparent: true, depthWrite: false }));
  const stars = [];
  function starBurst(x, y) { for (let i = 0; i < 16; i++) { const sp = new T.Sprite(starMat.clone()); own.push(sp.material); sp.position.set(x, y, TW3.D / 2 + 0.3); sp.scale.setScalar(0.35); const a = (i / 16) * Math.PI * 2; stars.push({ sp, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, t: 0 }); scene.add(sp); } }

  /* ---------- Spiel-Zustand der Szene ---------- */
  const S = { camY: 2.2, pivY: 6, t: 0, last: performance.now(), hang: null, falls: [], landT: 0 };
  game.tw.blocks.forEach((b, i) => addFloor(b, i));
  placeRoof();
  const ROPE = 3.6, AMP = 0.92;
  function setHeight() { const el = $('#twheight b'); if (el) el.textContent = game.tw.blocks.length - 1; }

  const tw = game.tw;
  tw.r3 = {
    /** richtige Antwort: neues Stockwerk hängt am Kran */
    hang(label) {
      const top = tw.blocks[tw.blocks.length - 1];
      const f = { w: top.w, label, c: COLORS[Math.floor(Math.random() * COLORS.length)], lit: Math.floor(Math.random() * 3), st: g2Pick(STYLES) };
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
      const yLand = TW3.FH * (level + 0.5);
      tw.hang = null;
      if (ov <= 0.5) { // daneben: fällt am Turm vorbei
        S.falls.push({ m: h.mesh, vy: 0, vx: (x < top.x ? -1 : 1) * 1.2, spin: (x < top.x ? 1 : -1) * 2.2, t: 0, life: 1.8 });
        gLater(() => { sfx.bad(); tone([300, 200], 0.12, 'sawtooth', 0.04); if (runWrong()) return; twAsk(); }, 450);
        return;
      }
      S.drop = { m: h.mesh, vy: 0, y1: yLand, done: () => {
        const perfect = Math.abs(x - top.x) < 1.3;
        const nb = perfect ? { x: top.x, w: Math.min(46, top.w + 2.5), label: h.label, c: h.c, lit: h.lit, st: h.st } : { x: Math.max(x, top.x), w: ov, label: h.label, c: h.c, lit: h.lit, st: h.st };
        // überstehendes Stück bricht ab und fällt
        if (!perfect) {
          const cutL = x < top.x, cw = h.w - ov;
          const piece = floorMesh({ c: h.c, lit: h.lit, st: h.st }, cw);
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
          starBurst(m.position.x, m.position.y);
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
    // Pendel: je höher der Turm, desto schneller
    tw.swingT += dt * Math.min(3.1, 1.6 + (n - 1) * 0.1);
    const th = Math.sin(tw.swingT) * AMP;
    const topY = TW3.FH * n;
    S.pivY += (topY + 0.7 + TW3.FH + 0.25 + ROPE - S.pivY) * Math.min(1, dt * 2.5);
    S.camY += (topY + 0.9 - S.camY) * Math.min(1, dt * 2.2);
    const bx = Math.sin(th) * ROPE, by = S.pivY - Math.cos(th) * ROPE;
    tw.hx = 50 + bx * 10; // Mitte in Prozent (für die Regeln wie in 2D)
    clamp.position.set(bx, by, 0); clamp.rotation.z = th * 0.55;
    placeRope(0, S.pivY + 6, bx, by + 0.22);
    if (tw.hang) { const tl = th * 0.55; tw.hang.mesh.position.set(bx - Math.sin(tl) * (TW3.FH / 2 + 0.12), by - Math.cos(tl) * (TW3.FH / 2 + 0.12), 0); tw.hang.mesh.rotation.z = tl; }
    // fallen lassen (mit Schwerkraft; die Drehung richtet sich auf)
    if (S.drop) {
      const d = S.drop; d.vy -= 22 * dt;
      d.m.position.y += d.vy * dt; d.m.rotation.z *= Math.max(0, 1 - dt * 14);
      if (d.m.position.y <= d.y1) { d.m.position.y = d.y1; d.m.rotation.z = 0; const cb = d.done; S.drop = null; cb(); }
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
    for (let i = stars.length - 1; i >= 0; i--) { const st = stars[i]; st.t += dt; st.sp.position.x += st.vx * dt; st.sp.position.y += st.vy * dt; st.sp.material.opacity = Math.max(0, 1 - st.t / 0.8); st.sp.material.rotation += dt * 4; if (st.t > 0.8) { scene.remove(st.sp); stars.splice(i, 1); } }
    // Wolken ziehen, Himmel wird mit der Höhe dunkler
    for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 30) c.position.x = -30; }
    sky.copy(skyLow).lerp(skyHigh, Math.min(1, topY / 45)); scene.fog.color.copy(sky);
    // Kamera: frontal, leicht von oben
    const back = portrait ? 16 : 12.5;
    camera.position.set(0, S.camY + 1.6, back);
    look.set(0, S.camY - 0.2, 0);
    camera.lookAt(look);
    skyMesh.position.y = 15 + S.camY * 0.55;
    sun.position.set(5, S.camY + 9, 12); sun.target.position.set(0, S.camY - 2, 0);
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
