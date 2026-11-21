/* Teilmal – Burg verteidigen in 3D (wird erst beim Spielen geladen)
 *
 * Man steht oben auf der Burgmauer (Zinnen vorne im Bild, links und rechts je eine Kanone). Auf vier Wegen laufen
 * Monster auf die Burg zu – eigene Figuren aus Klötzchen: Goblin, Zyklop, Schleim, Gespenst, Feuerteufelchen.
 * Über jedem Monster ein Schild mit der Rechnung. Ergebnis eintippen (Zahlenfeld oder Tastatur) → die nähere
 * Kanone dreht sich, schiesst, das Monster zerplatzt. Erreicht eines die Mauer, wackelt die Burg (Survive: ein Leben).
 * Spielregeln, Tasten und Eingabe wie in der 2D-Version (js/games2.js: csKey/csTry).
 */
'use strict';

const CS3 = { LANES: [-3.9, -1.3, 1.3, 3.9], Z0: -40, Z1: -8.6 };

/** Monster aus Klötzchen; liefert { root, legs, arms, body, head, kind, h } */
function cs3Monster(T, kind, box, mats) {
  const root = new T.Group(), inner = new T.Group(); root.add(inner);
  const M = (c, extra = {}) => { const k = `${kind}:${c}:${JSON.stringify(extra)}`; if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra })); return mats.get(k); };
  const part = (parent, color, x, y, z, w, h, d, extra) => { const m = new T.Mesh(box, M(color, extra)); m.position.set(x, y, z); m.scale.set(w, h, d); m.castShadow = true; parent.add(m); return m; };
  const limb = (parent, color, x, y, z, w, h, d) => { const g = new T.Group(); g.position.set(x, y, z); part(g, color, 0, -h / 2, 0, w, h, d); parent.add(g); return g; };
  const eyes = (parent, y, z, gap, size, col = 0xffffff, pupil = 0x111827) => {
    for (const s of [-1, 1]) { part(parent, col, s * gap, y, z, size, size, 0.06, { emissive: col === 0xffffff ? 0x000000 : col, emissiveIntensity: 0.6 }); part(parent, pupil, s * gap + s * 0.01, y - size * 0.1, z + 0.035, size * 0.45, size * 0.5, 0.04); }
  };
  const o = { root, inner, legs: [], arms: [], kind };
  if (kind === 'goblin') {
    const g = 0x4caf50, dg = 0x2e7d32;
    o.legs = [limb(inner, dg, -0.16, 0.55, 0, 0.22, 0.55, 0.24), limb(inner, dg, 0.16, 0.55, 0, 0.22, 0.55, 0.24)];
    o.body = part(inner, g, 0, 0.85, 0, 0.62, 0.62, 0.42);
    part(inner, 0x8d6e63, 0, 0.62, 0, 0.64, 0.12, 0.44);
    o.head = new T.Group(); o.head.position.set(0, 1.42, 0); inner.add(o.head);
    part(o.head, g, 0, 0, 0, 0.6, 0.52, 0.52);
    for (const s of [-1, 1]) { const e = part(o.head, g, s * 0.42, 0.06, 0, 0.36, 0.14, 0.08); e.rotation.z = s * 0.45; }
    eyes(o.head, 0.06, 0.27, 0.14, 0.15, 0xfde047);
    part(o.head, 0x1b5e20, 0, -0.14, 0.27, 0.3, 0.06, 0.04);
    for (const s of [-1, 1]) part(o.head, 0xffffff, s * 0.08, -0.1, 0.285, 0.05, 0.07, 0.03);
    o.arms = [limb(inner, g, -0.4, 1.08, 0, 0.18, 0.5, 0.2), limb(inner, g, 0.4, 1.08, 0, 0.18, 0.5, 0.2)];
    const club = part(o.arms[1], 0x8d5a2b, 0, -0.55, 0.22, 0.14, 0.14, 0.6); club.rotation.x = -0.3;
    o.h = 1.8;
  } else if (kind === 'cyclops') {
    const p = 0x8e5bd6, dp = 0x5b3a96;
    o.legs = [limb(inner, dp, -0.24, 0.6, 0, 0.3, 0.6, 0.32), limb(inner, dp, 0.24, 0.6, 0, 0.3, 0.6, 0.32)];
    o.body = part(inner, p, 0, 1.02, 0, 0.95, 0.85, 0.6);
    part(inner, 0xc4a484, 0, 0.72, 0, 0.98, 0.22, 0.62);
    o.head = new T.Group(); o.head.position.set(0, 1.78, 0); inner.add(o.head);
    part(o.head, p, 0, 0, 0, 0.78, 0.64, 0.6);
    part(o.head, 0xffffff, 0, 0.06, 0.31, 0.38, 0.32, 0.04, { emissive: 0x333333 });
    part(o.head, 0x0ea5e9, 0, 0.04, 0.335, 0.18, 0.18, 0.03, { emissive: 0x0369a1, emissiveIntensity: 0.6 });
    part(o.head, 0x111827, 0, 0.04, 0.35, 0.08, 0.09, 0.02);
    for (const s of [-1, 1]) { const h = part(o.head, 0xfef3c7, s * 0.24, 0.42, 0, 0.1, 0.26, 0.1); h.rotation.z = -s * 0.3; }
    part(o.head, 0x3b1d6e, 0, -0.2, 0.31, 0.36, 0.08, 0.04);
    for (const s of [-1, 1]) part(o.head, 0xfef9c3, s * 0.12, -0.13, 0.32, 0.07, 0.1, 0.03);
    o.arms = [limb(inner, p, -0.6, 1.36, 0, 0.26, 0.7, 0.28), limb(inner, p, 0.6, 1.36, 0, 0.26, 0.7, 0.28)];
    o.h = 2.3;
  } else if (kind === 'slime') {
    const mat = M(0x22d3ee, { transparent: true, opacity: 0.86, emissive: 0x0e7490, emissiveIntensity: 0.35, roughness: 0.25 });
    const blob = new T.Mesh(cs3Monster.sphere || (cs3Monster.sphere = new T.SphereGeometry(0.62, 18, 14)), mat);
    blob.scale.set(1, 0.8, 1); blob.position.y = 0.5; blob.castShadow = true; inner.add(blob); o.body = blob;
    o.head = new T.Group(); o.head.position.set(0, 0.62, 0.5); inner.add(o.head);
    eyes(o.head, 0, 0.02, 0.17, 0.2);
    part(o.head, 0x0e7490, 0, -0.2, 0.03, 0.22, 0.06, 0.03);
    const drop = part(inner, 0x67e8f9, 0.2, 1.05, 0, 0.14, 0.18, 0.14, { transparent: true, opacity: 0.85 }); drop.rotation.z = 0.6;
    o.h = 1.3;
  } else if (kind === 'ghost') {
    const w = 0xf1f5f9;
    const cone = new T.Mesh(cs3Monster.cone || (cs3Monster.cone = new T.CylinderGeometry(0.42, 0.62, 1.1, 10, 1, true)), M(w, { emissive: 0x94a3b8, emissiveIntensity: 0.35, transparent: true, opacity: 0.92, side: T.DoubleSide }));
    cone.position.y = 0.75; cone.castShadow = true; inner.add(cone); o.body = cone;
    const headM = new T.Mesh(cs3Monster.sphere2 || (cs3Monster.sphere2 = new T.SphereGeometry(0.46, 16, 12)), M(w, { emissive: 0x94a3b8, emissiveIntensity: 0.35, transparent: true, opacity: 0.95 }));
    headM.position.y = 1.4; headM.castShadow = true; inner.add(headM);
    o.head = new T.Group(); o.head.position.set(0, 1.42, 0.4); inner.add(o.head);
    for (const s of [-1, 1]) part(o.head, 0x111827, s * 0.15, 0.04, 0, 0.12, 0.2, 0.06);
    part(o.head, 0x111827, 0, -0.17, 0, 0.12, 0.12, 0.06);
    o.arms = [limb(inner, w, -0.5, 1.05, 0, 0.14, 0.42, 0.14), limb(inner, w, 0.5, 1.05, 0, 0.14, 0.42, 0.14)];
    o.arms.forEach((a) => { a.rotation.z = 0; a.children[0].material = headM.material; });
    o.h = 1.9; o.float = true;
  } else { // Feuerteufelchen
    const r = 0xef4444, dr = 0xb91c1c;
    o.legs = [limb(inner, dr, -0.13, 0.45, 0, 0.18, 0.45, 0.2), limb(inner, dr, 0.13, 0.45, 0, 0.18, 0.45, 0.2)];
    o.body = part(inner, r, 0, 0.72, 0, 0.5, 0.5, 0.36);
    o.head = new T.Group(); o.head.position.set(0, 1.18, 0); inner.add(o.head);
    part(o.head, r, 0, 0, 0, 0.5, 0.44, 0.44);
    eyes(o.head, 0.04, 0.23, 0.12, 0.13, 0xfde047);
    for (const s of [-1, 1]) { const h = part(o.head, 0x1f2937, s * 0.17, 0.3, 0, 0.08, 0.22, 0.08); h.rotation.z = -s * 0.35; }
    const flame = new T.Mesh(cs3Monster.flame || (cs3Monster.flame = new T.ConeGeometry(0.16, 0.42, 8)), M(0xfb923c, { emissive: 0xf97316, emissiveIntensity: 1.2 }));
    flame.position.set(0, 0.42, 0); o.head.add(flame); o.flame = flame;
    o.arms = [limb(inner, r, -0.33, 0.9, 0, 0.14, 0.4, 0.16), limb(inner, r, 0.33, 0.9, 0, 0.14, 0.4, 0.16)];
    const tail = part(inner, dr, 0, 0.55, -0.3, 0.08, 0.08, 0.4); tail.rotation.x = 0.6;
    o.h = 1.75;
  }
  return o;
}

async function startCastle3D() {
  const T = await w3Three();
  Object.assign(game, { picker: gamePicker(), cs: { mons: [], typed: '', spawnT: 1.2, last: 0, id: 0 }, over: false });
  runStart('castle');
  $('#view').innerHTML = gameShell('castle', `
    ${runHudHTML('bar-hud')}
    <div class="cs-play">
    <div class="cs-stage cs3" id="csstage"><div class="cs3-signs" id="cssigns"></div><div class="cs3-flash" id="csflash"></div></div>
    <div class="cs-input"><span class="cs-typed" id="cstyped">${CS_EMPTY}</span>
      <div class="cs-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="cs-key" data-action="cs-key" data-k="${n}">${n}</button>`).join('')}<button type="button" class="cs-key back" data-action="cs-key" data-k="back">⌫</button><button type="button" class="cs-key" data-action="cs-key" data-k="0">0</button><button type="button" class="cs-key ok" data-action="cs-key" data-k="ok">✓</button></div></div>
    </div>
    <p class="mode-hint">Du stehst auf der Burgmauer. Tippe das Ergebnis eines Monsters ein (Zahlentasten oder Tastatur) – die Kanone feuert, sobald es passt. Erreicht ein Monster die Burg, ${game.run.mode === 'survive' ? 'kostet das ein Leben' : 'ist es weg'}.</p>`);
  setGameKeys((e) => {
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); csKey(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); csKey('back'); }
    else if (e.key === 'Enter') { e.preventDefault(); csKey('ok'); }
  });
  const host = $('#csstage'), signs = $('#cssigns');
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'cs3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const own = [], keep = (...x) => { own.push(...x); return x[0]; };
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const tex = (c, rep) => { const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  // Himmel: Abendstimmung
  const skyTex = tex(cv(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3b5bdb'); gr.addColorStop(0.45, '#7c9cf5'); gr.addColorStop(0.72, '#f9a8d4'); gr.addColorStop(1, '#fdba74'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  scene.background = skyTex;
  scene.fog = new T.Fog(0xf9c8a5, 40, 160);
  const camera = new T.PerspectiveCamera(50, 1, 0.5, 300);
  let portrait = false;
  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); portrait = camera.aspect < 1; camera.fov = portrait ? 66 : 50; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  scene.add(new T.HemisphereLight(0xfff1e0, 0x5a7d3a, 1.3));
  const sun = new T.DirectionalLight(0xffd8a8, 2.4);
  sun.position.set(-14, 22, -20); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 26, bottom: -26, near: 1, far: 90 });
  sun.shadow.bias = -0.0008; sun.target.position.set(0, 0, -22);
  scene.add(sun, sun.target);
  const box = keep(new T.BoxGeometry(1, 1, 1));

  /* ---------- Landschaft ---------- */
  const grass = tex(cv(256, 256, (g, w, h) => { g.fillStyle = '#6fb34a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = ['#62a33f', '#7fc257', '#69ad45'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } }), [40, 40]);
  const ground = new T.Mesh(keep(new T.PlaneGeometry(240, 240)), keep(new T.MeshStandardMaterial({ map: grass, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -40; ground.receiveShadow = true; scene.add(ground);
  const dirt = tex(cv(64, 256, (g, w, h) => { g.fillStyle = '#c9a06a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = ['#b88d58', '#d6b07a', '#a87c49'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); }), [1, 12]);
  const pathMat = keep(new T.MeshStandardMaterial({ map: dirt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  for (const x of CS3.LANES) { const p = new T.Mesh(keep(new T.PlaneGeometry(1.7, 44)), pathMat); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.03, -30); p.receiveShadow = true; scene.add(p); }
  // Burggraben vor der Mauer
  const moat = new T.Mesh(keep(new T.PlaneGeometry(40, 2.4)), keep(new T.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.15, metalness: 0.2, emissive: 0x1e3a8a, emissiveIntensity: 0.25 })));
  moat.rotation.x = -Math.PI / 2; moat.position.set(0, 0.02, -7.4); scene.add(moat);
  const bridgeMat = keep(new T.MeshStandardMaterial({ color: 0x8d5a2b, roughness: 0.9 }));
  for (const x of CS3.LANES) { const b = new T.Mesh(box, bridgeMat); b.scale.set(1.6, 0.12, 2.8); b.position.set(x, 0.06, -7.4); b.receiveShadow = true; scene.add(b); }
  // Rasen zwischen Graben und Mauer
  const glacis = new T.Mesh(keep(new T.PlaneGeometry(40, 6.4)), keep(new T.MeshStandardMaterial({ color: 0x5f9e45, roughness: 1 }))); glacis.rotation.x = -Math.PI / 2; glacis.position.set(0, 0.015, -3.0); glacis.receiveShadow = true; scene.add(glacis);
  // Bäume, Hügel, Berge
  const leaf = keep(new T.MeshStandardMaterial({ color: 0x3f9b46, roughness: 0.9, flatShading: true })), trunk = keep(new T.MeshStandardMaterial({ color: 0x7c4a1e }));
  const crown = keep(new T.ConeGeometry(0.9, 2.2, 7)), stem = keep(new T.CylinderGeometry(0.14, 0.2, 0.8, 6));
  const NT = 46, trees = new T.InstancedMesh(crown, leaf, NT), stems = new T.InstancedMesh(stem, trunk, NT);
  const m4 = new T.Matrix4(), q0 = new T.Quaternion(), v1 = new T.Vector3(), v2 = new T.Vector3();
  for (let i = 0; i < NT; i++) {
    const side = i % 2 ? 1 : -1, x = side * (7.2 + Math.random() * 16), z = -6 - Math.random() * 52, s = 0.8 + Math.random() * 0.8;
    trees.setMatrixAt(i, m4.compose(v1.set(x, 0.8 + 1.1 * s, z), q0, v2.set(s, s, s)));
    stems.setMatrixAt(i, m4.compose(v1.set(x, 0.4, z), q0, v2.set(1, 1, 1)));
  }
  trees.castShadow = true; scene.add(trees, stems);
  const hillMat = keep(new T.MeshStandardMaterial({ color: 0x5c8f4a, roughness: 1, flatShading: true }));
  const hillG = keep(new T.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  for (let i = 0; i < 9; i++) { const h = new T.Mesh(hillG, hillMat); h.position.set(-60 + i * 15 + Math.random() * 6, 0, -70 - Math.random() * 10); h.scale.set(12 + Math.random() * 8, 5 + Math.random() * 7, 8); scene.add(h); }
  const mtnMat = keep(new T.MeshStandardMaterial({ color: 0x9a8fd0, roughness: 1, flatShading: true }));
  const mtnG = keep(new T.ConeGeometry(1, 1, 5));
  for (let i = 0; i < 7; i++) { const m = new T.Mesh(mtnG, mtnMat); m.position.set(-70 + i * 24 + Math.random() * 8, 9, -105); m.scale.set(18, 18 + Math.random() * 12, 12); scene.add(m); }

  /* ---------- Burgmauer (vorne im Bild) mit Zinnen, Türmen, Fahnen und Kanonen ---------- */
  const stone = tex(cv(256, 128, (g, w, h) => { g.fillStyle = '#9ca3af'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = -1; x < 5; x++) { const s = 140 + Math.floor(Math.random() * 40); g.fillStyle = `rgb(${s},${s + 4},${s + 12})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); } }), [6, 1]);
  const stoneMat = keep(new T.MeshStandardMaterial({ map: stone, roughness: 0.95 }));
  const wall = new T.Mesh(box, stoneMat); wall.scale.set(30, 4.6, 1.6); wall.position.set(0, 2.3, -0.2); wall.receiveShadow = true; wall.castShadow = true; scene.add(wall);
  const walk = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0x8b8f98, roughness: 1 }))); walk.scale.set(30, 0.2, 4); walk.position.set(0, 4.5, 1.6); walk.receiveShadow = true; scene.add(walk);
  // niedrige Brüstung vorne (unten im Bild)
  const lip = new T.Mesh(box, keep(new T.MeshStandardMaterial({ map: tex(stone.image, [8, 0.3]), roughness: 0.95 }))); lip.scale.set(30, 0.55, 0.6); lip.position.set(0, 4.85, -0.75); lip.castShadow = true; scene.add(lip);
  const merlonMat = keep(new T.MeshStandardMaterial({ map: tex(stone.image, [1, 0.5]), roughness: 0.95 }));
  for (const x of [3.3, 5.4, 7.5, 9.6, 11.7]) for (const sgn of [-1, 1]) { const m = new T.Mesh(box, merlonMat); m.scale.set(1.15, 1.25, 0.7); m.position.set(sgn * x, 5.2, -0.75); m.castShadow = true; scene.add(m); }
  const flagT = tex(cv(64, 40, (g, w, h) => { g.fillStyle = '#ef4444'; g.fillRect(0, 0, w, h); g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(14, 20); g.lineTo(26, 8); g.lineTo(38, 20); g.lineTo(26, 32); g.fill(); }));
  const flags = [];
  for (const s of [-1, 1]) {
    const tw = new T.Mesh(keep(new T.CylinderGeometry(1.5, 1.7, 7.5, 12)), stoneMat); tw.position.set(s * 9.5, 3.75, -0.4); tw.castShadow = true; scene.add(tw);
    const roofC = new T.Mesh(keep(new T.ConeGeometry(1.9, 2.4, 12)), keep(new T.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 }))); roofC.position.set(s * 9.5, 8.7, -0.4); scene.add(roofC);
    const pole = new T.Mesh(keep(new T.CylinderGeometry(0.04, 0.04, 1.6, 6)), keep(new T.MeshStandardMaterial({ color: 0x374151 }))); pole.position.set(s * 9.5, 10.6, -0.4); scene.add(pole);
    const fl = new T.Mesh(keep(new T.PlaneGeometry(1.1, 0.7, 8, 1)), keep(new T.MeshStandardMaterial({ map: flagT, side: T.DoubleSide }))); fl.position.set(s * 9.5 + 0.55, 11.05, -0.4); scene.add(fl); flags.push(fl);
  }
  // Kanonen
  const iron = keep(new T.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.35, metalness: 0.45, emissive: 0x111827, emissiveIntensity: 0.4 })), wood = keep(new T.MeshStandardMaterial({ color: 0x7c4a1e, roughness: 0.8 }));
  const cannons = [-1, 1].map((s) => {
    const base = new T.Group(); base.position.set(s * 2.25, 5.05, -0.7); base.scale.setScalar(0.62); scene.add(base);
    const cart = new T.Mesh(box, wood); cart.scale.set(0.9, 0.35, 1.2); cart.position.y = 0.25; cart.castShadow = true; base.add(cart);
    for (const w of [-1, 1]) { const wh = new T.Mesh(keep(new T.CylinderGeometry(0.28, 0.28, 0.12, 14)), wood); wh.rotation.z = Math.PI / 2; wh.position.set(w * 0.5, 0.28, 0.2); base.add(wh); }
    const yaw = new T.Group(); yaw.position.y = 0.55; base.add(yaw);
    const pitch = new T.Group(); yaw.add(pitch);
    const barrel = new T.Mesh(keep(new T.CylinderGeometry(0.2, 0.26, 1.5, 14)), iron); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.45; barrel.castShadow = true; pitch.add(barrel);
    const ring = new T.Mesh(keep(new T.TorusGeometry(0.22, 0.05, 8, 16)), iron); ring.position.z = -1.18; pitch.add(ring);
    return { base, yaw, pitch, side: s, kick: 0 };
  });

  /* ---------- Effekte ---------- */
  const ballG = keep(new T.SphereGeometry(0.2, 12, 10));
  const sparkG = keep(new T.BoxGeometry(0.16, 0.16, 0.16));
  const sparkMats = [0xfde047, 0xfb923c, 0xef4444, 0xffffff, 0x9ca3af].map((c) => keep(new T.MeshBasicMaterial({ color: c, transparent: true })));
  const flashMat = keep(new T.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.9 }));
  const fx = []; // fliegende Kugeln, Funken, Blitze
  const monMats = new Map();

  /* ---------- Spiel ---------- */
  const c = game.cs;
  const KINDS = ['goblin', 'cyclops', 'slime', 'ghost', 'imp'];
  const S = { t: 0, last: performance.now(), shake: 0 };
  const flash = () => { const f = $('#csflash'); if (!f) return; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };
  function spawn() {
    const busy = new Set(c.mons.map((m) => m.t.answer));
    const t = game.picker.pool.some((x) => !busy.has(x.answer)) ? game.picker.next((x) => !busy.has(x.answer)) : game.picker.next();
    const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const lane = lanes.find((l) => !c.mons.some((m) => m.lane === l && m.z < CS3.Z0 + 9)) ?? lanes[0];
    const lv = surviveLevel();
    const kind = g2Pick(KINDS);
    const fig = cs3Monster(T, kind, box, monMats);
    const m = { id: ++c.id, t, lane, kind, fig, z: CS3.Z0, x: 100, v: (5.2 + lv * 0.55) * (0.85 + Math.random() * 0.3), phase: Math.random() * 6, el: document.createElement('div') };
    fig.root.position.set(CS3.LANES[lane], 0, CS3.Z0); fig.root.scale.setScalar(1.4); fig.h *= 1.4;
    scene.add(fig.root);
    m.el.className = 'cs3-sign';
    m.el.innerHTML = taskHTML(t, '<span class="slot">?</span>');
    signs.appendChild(m.el);
    c.mons.push(m);
  }
  function removeMon(m, how) {
    c.mons = c.mons.filter((x) => x !== m);
    m.el.classList.add(how === 'hit' ? 'pop' : 'gone');
    setTimeout(() => m.el.remove(), 450);
    m.dying = { t: 0, how };
    fx.push({ kind: 'die', m });
  }
  function burst(p, n = 16) {
    for (let i = 0; i < n; i++) {
      const s = new T.Mesh(sparkG, sparkMats[i % sparkMats.length]);
      s.position.copy(p);
      const a = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.2;
      fx.push({ kind: 'spark', o: s, v: new T.Vector3(Math.cos(a) * 4 * u, 3 + Math.random() * 4, Math.sin(a) * 4 * u), t: 0, life: 0.7 + Math.random() * 0.3 });
      scene.add(s);
    }
    const f = new T.Mesh(ballG, flashMat); f.position.copy(p); scene.add(f);
    fx.push({ kind: 'flash', o: f, t: 0 });
  }
  /* Schuss (wird von csTry aufgerufen, wenn die Eingabe passt) */
  c.r3 = {
    shoot(m) {
      const target = new T.Vector3(CS3.LANES[m.lane], m.fig.h * 0.6, m.z);
      const can = cannons.reduce((a, b) => (Math.abs(b.base.position.x - target.x) < Math.abs(a.base.position.x - target.x) ? b : a));
      const from = new T.Vector3(); can.base.getWorldPosition(from); from.y += 0.4; from.z -= 0.6;
      can.aim = target.clone(); can.kick = 1;
      const ball = new T.Mesh(ballG, iron); ball.position.copy(from); scene.add(ball);
      const dur = 0.28 + Math.abs(m.z) * 0.006;
      m.v = 0; m.frozen = true;
      c.mons = c.mons.filter((x) => x !== m);
      fx.push({ kind: 'ball', o: ball, from, to: target, t: 0, dur, onHit: () => { burst(target); tone([140, 90], 0.12, 'sawtooth', 0.06); c.mons.push(m); removeMon(m, 'hit'); } });
      // Mündungsfeuer
      const mz = new T.Mesh(ballG, flashMat); mz.position.copy(from); scene.add(mz); fx.push({ kind: 'flash', o: mz, t: 0, small: true });
    },
  };

  const proj = new T.Vector3();
  let raf = 0;
  function frame(now) {
    if (!$('#csstage')) return;
    raf = requestAnimationFrame(frame);
    game.raf = raf;
    const dt = Math.max(0, Math.min(0.05, (now - S.last) / 1000)); S.last = now; S.t += dt;
    // Monster erscheinen und laufen (Regeln wie in 2D)
    if (runOn()) {
      const lv = surviveLevel();
      c.spawnT -= dt;
      const maxOn = Math.min(5, 2 + Math.floor(lv / 2));
      if (c.spawnT <= 0 && c.mons.length < maxOn) { spawn(); c.spawnT = Math.max(1.4, 3.6 - lv * 0.25) * (0.8 + Math.random() * 0.4); }
      for (const m of [...c.mons]) {
        if (m.frozen) continue;
        const speed = m.v * (CS3.Z1 - CS3.Z0) / 86; // gleiche Zeit wie 2D (100 % → 14 %)
        m.z += speed * dt; m.x = 100 - ((m.z - CS3.Z0) / (CS3.Z1 - CS3.Z0)) * 86;
        if (m.z >= CS3.Z1) { // an der Mauer
          removeMon(m, 'wall');
          S.shake = 0.5; flash();
          sfx.bad();
          recordAnswer(m.t, '', 20000);
          if (runWrong(m.t)) break;
        }
      }
    }
    // Figuren bewegen
    const all = [...c.mons, ...fx.filter((f) => f.kind === 'die').map((f) => f.m)];
    for (const m of all) {
      const f = m.fig, ph = S.t * (m.frozen ? 2 : 7) + m.phase;
      f.root.position.set(CS3.LANES[m.lane], 0, m.z);
      if (f.float) { f.inner.position.y = 0.35 + Math.sin(ph * 0.5) * 0.15; f.inner.rotation.z = Math.sin(ph * 0.35) * 0.08; }
      else if (m.kind === 'slime') { const k = Math.abs(Math.sin(ph * 0.6)); f.inner.position.y = k * 0.45; f.inner.scale.set(1 + (1 - k) * 0.15, 0.85 + k * 0.25, 1 + (1 - k) * 0.15); }
      else { f.inner.position.y = Math.abs(Math.sin(ph)) * 0.08; f.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + i * Math.PI) * 0.6; }); f.arms.forEach((a, i) => { a.rotation.x = Math.sin(ph + i * Math.PI + Math.PI) * 0.5; }); }
      if (f.flame) f.flame.scale.set(1, 0.8 + Math.sin(S.t * 20) * 0.25, 1);
    }
    // Effekte
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i];
      if (e.kind === 'ball') {
        e.t += dt; const k = Math.min(1, e.t / e.dur);
        e.o.position.lerpVectors(e.from, e.to, k); e.o.position.y += Math.sin(k * Math.PI) * (1.5 + e.from.distanceTo(e.to) * 0.08);
        if (k >= 1) { scene.remove(e.o); fx.splice(i, 1); e.onHit(); }
      } else if (e.kind === 'spark') {
        e.t += dt; e.v.y -= 12 * dt; e.o.position.addScaledVector(e.v, dt); e.o.rotation.x += dt * 8; e.o.scale.setScalar(Math.max(0.01, 1 - e.t / e.life));
        if (e.t > e.life) { scene.remove(e.o); fx.splice(i, 1); }
      } else if (e.kind === 'flash') {
        e.t += dt; e.o.scale.setScalar(e.small ? 0.6 + e.t * 3 : 1 + e.t * 9); e.o.material.opacity = Math.max(0, 0.9 - e.t * 3.2);
        if (e.t > 0.3) { scene.remove(e.o); fx.splice(i, 1); }
      } else if (e.kind === 'die') {
        const m = e.m, d = m.dying; d.t += dt;
        if (d.how === 'hit') { m.fig.root.rotation.x = -d.t * 6; m.fig.root.scale.setScalar(Math.max(0.01, 1.4 * (1 - d.t * 2.2))); m.fig.root.position.y = d.t * 3; }
        else { m.fig.root.scale.setScalar(Math.max(0.01, 1.4 * (1 - d.t * 2.5))); m.fig.root.rotation.y += dt * 12; }
        if (d.t > 0.5) { scene.remove(m.fig.root); fx.splice(i, 1); }
      }
    }
    // Kanonen zielen und rucken zurück
    for (const cn of cannons) {
      if (cn.aim) {
        const p = new T.Vector3(); cn.base.getWorldPosition(p);
        const want = Math.atan2(-(cn.aim.x - p.x), -(cn.aim.z - p.z));
        cn.yaw.rotation.y += (want - cn.yaw.rotation.y) * Math.min(1, dt * 14);
        const dist = Math.hypot(cn.aim.x - p.x, cn.aim.z - p.z);
        cn.pitch.rotation.x += (Math.atan2(4.5, dist) * 0.6 - cn.pitch.rotation.x) * Math.min(1, dt * 14);
      }
      cn.kick = Math.max(0, cn.kick - dt * 4);
      cn.pitch.position.z = cn.kick * 0.3;
    }
    flags.forEach((fl, i) => { const p = fl.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k); p.setZ(k, Math.sin(S.t * 5 + x * 4 + i) * 0.08 * (x + 0.55)); } p.needsUpdate = true; });
    // Kamera auf der Mauer (wackelt, wenn ein Monster ankommt)
    S.shake = Math.max(0, S.shake - dt * 1.4);
    const sh = S.shake * 0.25;
    camera.position.set((Math.random() - 0.5) * sh, (portrait ? 7.6 : 6.6) + (Math.random() - 0.5) * sh, portrait ? 2.2 : 1.1);
    camera.lookAt(0, 0, portrait ? -15 : -16);
    renderer.render(scene, camera);
    // Schilder über den Monstern
    const W = host.clientWidth, H = host.clientHeight;
    for (const m of all) {
      proj.set(CS3.LANES[m.lane], m.fig.h + (m.fig.float ? 0.55 : 0.25), m.z).project(camera);
      const near = (m.z - CS3.Z0) / (CS3.Z1 - CS3.Z0);
      m.el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * W}px, ${(-proj.y * 0.5 + 0.5) * H}px) translate(-50%, -100%) scale(${0.72 + near * 0.42})`;
      m.el.style.zIndex = Math.round(near * 100);
    }
  }
  raf = requestAnimationFrame(frame);
  game.stage3d = {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      trees.dispose?.(); stems.dispose?.();
      own.forEach((x) => { try { x.dispose?.(); } catch { /* */ } });
      monMats.forEach((m) => m.dispose());
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  game.cs3dbg = { S, scene, cannons };
}
