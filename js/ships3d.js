/* Teilmal – Schiffe versenken in 3D (wird erst beim Spielen geladen)
 *
 * Zwei Meere, halb von oben betrachtet: gross das Meer des Computers mit einem Raster aus Bojen (Spalten 1–10,
 * Reihen = die gewählten Reihen), daneben klein das eigene Meer, auf dem die eigenen Schiffe schwimmen.
 * Boje antippen → Rechnung (Spalte · Reihe). Richtig: Schuss. Wasser = Gischtring; Treffer = ein neutraler Block
 * taucht auf (man sieht nicht, wie das Schiff liegt) – erst wenn alle Teile getroffen sind, verwandelt er sich
 * in das ganze Schiff (Wrack mit Rauch). Spiellogik in js/games2.js (startShips, shFire, shCpu …); hier nur das Bild.
 */
'use strict';

/** Schiffsmodell (Länge in Feldern), liegt entlang der x-Achse */
function sh3ShipModel(T, len, mats) {
  const g = new T.Group();
  const L = len * 0.94, W = 0.6;
  const shape = new T.Shape();
  shape.moveTo(-L / 2, -W * 0.42); shape.lineTo(L / 2 - 0.45, -W / 2); shape.quadraticCurveTo(L / 2 - 0.04, -W / 4, L / 2, 0); shape.quadraticCurveTo(L / 2 - 0.04, W / 4, L / 2 - 0.45, W / 2);
  shape.lineTo(-L / 2, W * 0.42); shape.quadraticCurveTo(-L / 2 - 0.1, 0, -L / 2, -W * 0.42);
  const hullG = new T.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); hullG.rotateX(-Math.PI / 2);
  const hull = new T.Mesh(hullG, mats.hull); hull.castShadow = true; g.add(hull);
  const bandG = new T.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }); bandG.rotateX(-Math.PI / 2);
  const band = new T.Mesh(bandG, mats.red); band.scale.set(1.02, 1, 1.04); band.position.y = -0.04; g.add(band);
  const deckG = new T.ShapeGeometry(shape); deckG.rotateX(-Math.PI / 2);
  const deck = new T.Mesh(deckG, mats.deck); deck.scale.set(0.93, 1, 0.86); deck.position.y = 0.335; g.add(deck);
  const sup = new T.Mesh(mats.box, mats.white); sup.scale.set(Math.min(1.1, L * 0.3), 0.3, 0.38); sup.position.set(-L * 0.12, 0.5, 0); sup.castShadow = true; g.add(sup);
  const win = new T.Mesh(mats.box, mats.glass); win.scale.set(Math.min(1.1, L * 0.3) * 0.9, 0.07, 0.4); win.position.set(-L * 0.12, 0.56, 0); g.add(win);
  const bridge = new T.Mesh(mats.box, mats.white); bridge.scale.set(0.4, 0.18, 0.3); bridge.position.set(-L * 0.12, 0.74, 0); bridge.castShadow = true; g.add(bridge);
  if (len >= 3) {
    const fun = new T.Mesh(mats.funnel, mats.red); fun.position.set(-L * 0.3, 0.78, 0); fun.castShadow = true; g.add(fun);
    const top = new T.Mesh(mats.funnelTop, mats.dark); top.position.set(-L * 0.3, 0.95, 0); g.add(top);
    for (const sx of [0.3, len >= 4 ? -0.42 : null].filter((v) => v != null)) {
      const tur = new T.Mesh(mats.turret, mats.dark); tur.position.set(L * sx, 0.42, 0); g.add(tur);
      const bar = new T.Mesh(mats.box, mats.dark); bar.scale.set(0.36, 0.05, 0.05); bar.position.set(L * sx + (sx > 0 ? 0.2 : -0.2), 0.46, 0); g.add(bar);
    }
  }
  const mast = new T.Mesh(mats.mast, mats.dark); mast.position.set(-L * 0.02, 0.95, 0); g.add(mast);
  g.userData.geos = [hullG, bandG, deckG];
  return g;
}

/** Ein Meer mit Raster, Beschriftung und Effekten */
function sh3Sea(T, host, { R, C, rows, own }) {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'sh3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(own ? '#0c4a7a' : '#0b4f8a');
  scene.fog = new T.Fog(scene.background, 14, 34);
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
  const own_ = [], keep = (...x) => { own_.push(...x); return x[0]; };
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const tex = (c) => { const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  scene.add(new T.HemisphereLight(0xdff4ff, 0x0b3a6e, 1.35));
  const sun = new T.DirectionalLight(0xfff4e0, 2.1); sun.position.set(-6, 12, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.001;
  scene.add(sun);
  const cellX = (c) => c - (C - 1) / 2, cellZ = (r) => r - (R - 1) / 2;
  // Wasser: Low-Poly-Wellen
  const WS = 46, wGeo = keep(new T.PlaneGeometry(C + 18, R + 18, WS, WS)); wGeo.rotateX(-Math.PI / 2);
  const wMat = keep(new T.MeshStandardMaterial({ color: 0x1d8fe0, roughness: 0.22, metalness: 0.15, flatShading: true }));
  const water = new T.Mesh(wGeo, wMat); water.receiveShadow = true; scene.add(water);
  const base = wGeo.attributes.position.array.slice();
  // Raster auf dem Wasser
  const gridT = tex(cv(64 * C, 64 * R, (g, w, h) => {
    g.strokeStyle = 'rgba(255,255,255,.42)'; g.lineWidth = 3;
    for (let i = 0; i <= C; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); }
    for (let i = 0; i <= R; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  }));
  const grid = new T.Mesh(keep(new T.PlaneGeometry(C, R)), keep(new T.MeshBasicMaterial({ map: gridT, transparent: true, depthWrite: false })));
  grid.rotation.x = -Math.PI / 2; grid.position.y = 0.13; grid.renderOrder = 2; scene.add(grid);
  // Beschriftung: Spalten 1–10 oben, Reihen links
  const labelTex = (text, on) => tex(cv(128, 96, (g, w, h) => {
    g.fillStyle = on ? '#facc15' : 'rgba(15,23,42,.82)'; g.beginPath(); g.roundRect?.(8, 8, w - 16, h - 16, 26); if (!g.roundRect) g.rect(8, 8, w - 16, h - 16); g.fill();
    g.fillStyle = on ? '#422006' : '#fff'; g.font = '900 54px "Bricolage Grotesque", Lexend, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  }));
  const labels = { col: [], row: [] };
  const mkLabel = (text, x, z, arr) => { const off = keep(new T.SpriteMaterial({ map: labelTex(text, false), depthWrite: false })), on = keep(new T.SpriteMaterial({ map: labelTex(text, true), depthWrite: false })); const sp = new T.Sprite(off); sp.position.set(x, 0.55, z); sp.scale.set(0.62, 0.47, 1); sp.renderOrder = 4; scene.add(sp); arr.push({ sp, off, on }); };
  for (let c = 0; c < C; c++) mkLabel(String(c + 1), cellX(c), cellZ(0) - 0.85, labels.col);
  for (let r = 0; r < R; r++) mkLabel(String(rows[r]), cellX(0) - 0.95, cellZ(r), labels.row);
  // Bojen (nur beim Gegner)
  let buoys = null, tops = null;
  const N = R * C, hidden = new Uint8Array(N), phase = Float32Array.from({ length: N }, () => Math.random() * 6);
  if (!own) {
    buoys = new T.InstancedMesh(keep(new T.CylinderGeometry(0.07, 0.15, 0.3, 10)), keep(new T.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })), N);
    tops = new T.InstancedMesh(keep(new T.SphereGeometry(0.075, 10, 8)), keep(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x334155 })), N);
    buoys.castShadow = true; scene.add(buoys, tops);
  }
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v1 = new T.Vector3(), v2 = new T.Vector3();
  // Zielring
  const aimRing = new T.Mesh(keep(new T.TorusGeometry(0.36, 0.05, 8, 28)), keep(new T.MeshBasicMaterial({ color: 0xfde047 })));
  aimRing.rotation.x = -Math.PI / 2; aimRing.visible = false; scene.add(aimRing);
  const hoverRing = new T.Mesh(aimRing.geometry, keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })));
  hoverRing.rotation.x = -Math.PI / 2; hoverRing.visible = false; scene.add(hoverRing);
  // Materialien für Schiffe, Blöcke, Effekte
  const mats = {
    box: keep(new T.BoxGeometry(1, 1, 1)), hull: keep(new T.MeshStandardMaterial({ color: 0x3b4a5e, roughness: 0.6, metalness: 0.25 })),
    red: keep(new T.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 })), deck: keep(new T.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.8 })),
    white: keep(new T.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.6 })), glass: keep(new T.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.2, emissive: 0x0ea5e9, emissiveIntensity: 0.25 })),
    dark: keep(new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 })), funnel: keep(new T.CylinderGeometry(0.09, 0.11, 0.32, 12)), funnelTop: keep(new T.CylinderGeometry(0.095, 0.095, 0.05, 12)),
    turret: keep(new T.CylinderGeometry(0.14, 0.16, 0.12, 12)), mast: keep(new T.CylinderGeometry(0.018, 0.018, 0.5, 6)),
  };
  const blockMat = keep(new T.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.45, metalness: 0.55 }));
  const stripeT = tex(cv(64, 64, (g, w, h) => { g.fillStyle = '#facc15'; g.fillRect(0, 0, w, h); g.fillStyle = '#111827'; for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 + 8 + h, h); g.lineTo(i * 16 + h, h); g.fill(); } }));
  const stripeMat = keep(new T.MeshStandardMaterial({ map: stripeT, roughness: 0.6 }));
  const foamMat = keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  const ringG = keep(new T.TorusGeometry(0.26, 0.045, 6, 20));
  const dropG = keep(new T.SphereGeometry(0.06, 6, 5));
  const puffT = tex(cv(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }));
  const smokeMat = keep(new T.SpriteMaterial({ map: puffT, color: 0x4b5563, transparent: true, depthWrite: false }));
  const fireMat = keep(new T.SpriteMaterial({ map: puffT, color: 0xff9a3c, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  const fx = [], fires = [], later = [];
  let clock = 0;
  const after = (sec, fn) => later.push({ at: clock + sec, fn });
  function splash(x, z, big = false) {
    for (let i = 0; i < (big ? 14 : 9); i++) { const d = new T.Mesh(dropG, foamMat); d.position.set(x, 0.15, z); const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 0.9; fx.push({ k: 'drop', o: d, v: new T.Vector3(Math.cos(a) * s, 2.2 + Math.random() * 1.6, Math.sin(a) * s), t: 0 }); scene.add(d); }
    const r = new T.Mesh(ringG, keep(foamMat.clone())); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.16, z); scene.add(r); fx.push({ k: 'ring', o: r, t: 0 });
  }
  function fireAt(x, y, z) { fires.push({ x, y, z, next: 0 }); }
  function puff(x, y, z, mat, scale, life, vy) { const s = new T.Sprite(mat.clone()); own_.push(s.material); s.position.set(x, y, z); s.scale.setScalar(scale); scene.add(s); fx.push({ k: 'puff', o: s, t: 0, life, vy, s0: scale }); }
  // Kamera passend zum Raster (halb von oben)
  function fit() {
    const r = host.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    const tilt = 0.98, f = Math.tan((camera.fov * Math.PI) / 360);
    const halfW = (C + 2.4) / 2, halfD = (R + 2.2) / 2;
    const d = Math.max(halfD * 0.95 / f, halfW / (f * camera.aspect)) * 0.97;
    camera.position.set(-0.3, Math.sin(tilt) * d, Math.cos(tilt) * d - 0.3);
    camera.lookAt(-0.3, 0, -0.45);
  }
  const ro = new ResizeObserver(fit); ro.observe(host); fit();
  function update(dt) {
    clock += dt;
    for (let i = later.length - 1; i >= 0; i--) if (later[i].at <= clock) { const f = later[i].fn; later.splice(i, 1); f(); }
    // Wellen
    const p = wGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { const x = base[i], z = base[i + 2]; p[i + 1] = Math.sin(x * 0.9 + clock * 1.4) * 0.06 + Math.cos(z * 0.8 - clock * 1.1) * 0.05 + Math.sin((x + z) * 0.5 + clock * 0.7) * 0.03; }
    wGeo.attributes.position.needsUpdate = true; wGeo.computeVertexNormals();
    if (buoys) {
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const i = r * C + c, ph = phase[i] + clock * 2.2;
        const sc = hidden[i] ? 0 : 1, y = 0.2 + Math.sin(ph) * 0.04;
        q.setFromEuler(e.set(Math.sin(ph * 0.8) * 0.12, 0, Math.cos(ph * 0.7) * 0.12));
        buoys.setMatrixAt(i, m4.compose(v1.set(cellX(c), y, cellZ(r)), q, v2.set(sc, sc, sc)));
        tops.setMatrixAt(i, m4.compose(v1.set(cellX(c), y + 0.19 * sc, cellZ(r)), q, v2.set(sc, sc, sc)));
      }
      buoys.instanceMatrix.needsUpdate = true; tops.instanceMatrix.needsUpdate = true;
    }
    aimRing.scale.setScalar(1 + Math.sin(clock * 6) * 0.08);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt;
      if (f.k === 'drop') { f.v.y -= 9 * dt; f.o.position.addScaledVector(f.v, dt); if (f.o.position.y < 0) { scene.remove(f.o); fx.splice(i, 1); } }
      else if (f.k === 'ring') { f.o.scale.setScalar(1 + f.t * 3); f.o.material.opacity = Math.max(0, 0.85 - f.t * 1.2); if (f.t > 0.75) { scene.remove(f.o); f.o.material.dispose(); fx.splice(i, 1); } }
      else if (f.k === 'puff') { f.o.position.y += f.vy * dt; f.o.scale.setScalar(f.s0 * (1 + f.t * 1.6)); f.o.material.opacity = Math.max(0, 1 - f.t / f.life); if (f.t > f.life) { scene.remove(f.o); fx.splice(i, 1); } }
      else if (f.k === 'rise') { const k = Math.min(1, f.t / f.dur); f.o.position.y = f.y0 + (f.y1 - f.y0) * (1 - (1 - k) ** 3); if (f.spin) f.o.rotation.y = (1 - k) * f.spin; if (k >= 1) fx.splice(i, 1); }
      else if (f.k === 'scale') { const k = Math.min(1, f.t / f.dur); const sc = f.from + (f.to - f.from) * (f.to > f.from ? 1 - (1 - k) ** 3 : k * k); f.o.scale.setScalar(Math.max(0.001, sc)); if (k >= 1) { if (f.done) f.done(); fx.splice(i, 1); } }
      else if (f.k === 'lerp') { const k = Math.min(1, f.t / f.dur); f.set(f.a + (f.b - f.a) * k); if (k >= 1) fx.splice(i, 1); }
      else if (f.k === 'bob') { f.o.position.y = f.y + Math.sin(clock * 1.6 + f.ph) * 0.035; f.o.rotation.z = Math.sin(clock * 1.2 + f.ph) * 0.03 + (f.tilt || 0); f.o.rotation.x = Math.cos(clock * 1.1 + f.ph) * 0.02; }
    }
    for (const fi of fires) { fi.next -= dt; if (fi.next <= 0) { fi.next = 0.22 + Math.random() * 0.2; puff(fi.x + (Math.random() - 0.5) * 0.15, fi.y, fi.z + (Math.random() - 0.5) * 0.15, smokeMat, 0.3, 1.6, 0.6); puff(fi.x, fi.y - 0.05, fi.z, fireMat, 0.28, 0.35, 0.5); } }
    renderer.render(scene, camera);
  }
  function setAim(r, c, hover = false) {
    const ring = hover ? hoverRing : aimRing;
    if (r == null) { ring.visible = false; if (!hover) [...labels.col, ...labels.row].forEach((l) => { l.sp.material = l.off; }); return; }
    ring.visible = true; ring.position.set(cellX(c), 0.2, cellZ(r));
    if (!hover) { labels.col.forEach((l, i) => { l.sp.material = i === c ? l.on : l.off; }); labels.row.forEach((l, i) => { l.sp.material = i === r ? l.on : l.off; }); }
  }
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new T.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(ndc, camera);
    const hit = new T.Vector3();
    if (!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -0.15), hit)) return null;
    const c = Math.round(hit.x + (C - 1) / 2), rr = Math.round(hit.z + (R - 1) / 2);
    return c >= 0 && c < C && rr >= 0 && rr < R ? { r: rr, c } : null;
  }
  return { T, scene, camera, renderer, cellX, cellZ, hidden, C, R, mats, blockMat, stripeMat, foamMat, ringG, splash, fireAt, puff, smokeMat, fx, after, update, setAim, pick, keep,
    dispose() { ro.disconnect(); buoys?.dispose?.(); tops?.dispose?.(); own_.forEach((x) => { try { x.dispose?.(); } catch { /* */ } }); try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ } renderer.domElement.remove(); } };
}

/** Beide Meere aufbauen und an die Spiellogik hängen */
function sh3Mount(T) {
  const s = game.sh;
  const enemy = sh3Sea(T, $('#shcpu'), { R: s.R, C: s.C, rows: s.rows, own: false });
  const mine = sh3Sea(T, $('#shme'), { R: s.R, C: s.C, rows: s.rows, own: true });
  const center = (sea, ship) => { const n = ship.pts.length; let x = 0, z = 0; ship.pts.forEach(([r, c]) => { x += sea.cellX(c); z += sea.cellZ(r); }); return { x: x / n, z: z / n }; };
  const placeShip = (sea, ship, y) => {
    const m = sh3ShipModel(T, ship.len, sea.mats); m.userData.geos.forEach((g) => sea.keep(g));
    const p = center(sea, ship); m.position.set(p.x, y, p.z); m.rotation.y = ship.hor ? 0 : Math.PI / 2;
    sea.scene.add(m);
    return m;
  };
  // eigene Schiffe schwimmen von Anfang an
  s.me.ships.forEach((ship, i) => { ship.m3 = placeShip(mine, ship, 0.02); mine.fx.push({ k: 'bob', o: ship.m3, y: 0.02, ph: i * 1.3 }); });
  const seen = { cpu: new Set(), me: new Set() };
  const blocks = new Map(); // gegnerische Treffer-Blöcke: 'r:c' → Mesh
  function sync() {
    // Gegner
    let stagger = 0;
    for (const [k, v] of s.cpu.shots) {
      if (seen.cpu.has(k)) continue;
      seen.cpu.add(k);
      const [r, c] = k.split(':').map(Number), x = enemy.cellX(c), z = enemy.cellZ(r);
      enemy.hidden[r * s.C + c] = 1;
      if (v === 'miss') {
        const d = stagger; stagger += 0.07;
        enemy.after(d, () => {
          enemy.splash(x, z);
          const ring = new T.Mesh(enemy.ringG, enemy.foamMat); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.17, z); ring.scale.setScalar(0.7); enemy.scene.add(ring);
        });
      } else {
        // Treffer: ein neutraler Block taucht auf (Richtung des Schiffs bleibt geheim)
        const g = new T.Group();
        const b = new T.Mesh(enemy.mats.box, enemy.blockMat); b.scale.set(0.66, 0.42, 0.66); b.castShadow = true; g.add(b);
        const st = new T.Mesh(enemy.mats.box, enemy.stripeMat); st.scale.set(0.68, 0.1, 0.68); st.position.y = 0.08; g.add(st);
        g.position.set(x, -0.5, z); enemy.scene.add(g); blocks.set(k, g);
        enemy.splash(x, z, true);
        enemy.fx.push({ k: 'rise', o: g, y0: -0.5, y1: 0.22, t: 0, dur: 0.6, spin: 1.2 });
        enemy.after(0.5, () => enemy.fireAt(x, 0.5, z));
      }
    }
    for (const ship of s.cpu.ships) {
      if (ship.hits < ship.len || ship.done3) continue;
      ship.done3 = true;
      // versenkt: die Blöcke verwandeln sich ins ganze Schiff
      enemy.after(0.75, () => {
        ship.pts.forEach(([r, c]) => { const b = blocks.get(`${r}:${c}`); if (b) enemy.fx.push({ k: 'scale', o: b, from: 1, to: 0, t: 0, dur: 0.3, done: () => enemy.scene.remove(b) }); enemy.puff(enemy.cellX(c), 0.4, enemy.cellZ(r), enemy.smokeMat, 0.6, 0.8, 0.4); });
        enemy.after(0.3, () => {
          const m = placeShip(enemy, ship, -0.12);
          m.scale.setScalar(0.01);
          enemy.fx.push({ k: 'scale', o: m, from: 0.01, to: 1, t: 0, dur: 0.45 });
          enemy.fx.push({ k: 'bob', o: m, y: -0.12, ph: Math.random() * 6, tilt: 0.1 });
          const p = center(enemy, ship); enemy.fireAt(p.x, 0.75, p.z);
        });
      });
    }
    // eigenes Meer: Schüsse des Computers
    for (const [k, v] of s.me.shots) {
      if (seen.me.has(k)) continue;
      seen.me.add(k);
      const [r, c] = k.split(':').map(Number), x = mine.cellX(c), z = mine.cellZ(r);
      if (v === 'miss') { mine.splash(x, z); const ring = new T.Mesh(mine.ringG, mine.foamMat); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.17, z); ring.scale.setScalar(0.7); mine.scene.add(ring); }
      else { mine.splash(x, z, true); mine.fireAt(x, 0.45, z); }
    }
    for (const ship of s.me.ships) {
      if (ship.hits < ship.len || ship.sunk3) continue;
      ship.sunk3 = true;
      const b = mine.fx.find((f) => f.k === 'bob' && f.o === ship.m3); if (b) { b.tilt = 0.16; mine.fx.push({ k: 'lerp', a: 0.02, b: -0.24, t: 0, dur: 1.4, set: (v) => { b.y = v; } }); }
    }
  }
  // Antippen
  const cnv = enemy.renderer.domElement;
  let down = null;
  cnv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  cnv.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { down = null; return; }
    down = null;
    const p = enemy.pick(e.clientX, e.clientY);
    if (p) shCell(p.r, p.c);
  });
  cnv.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const p = enemy.pick(e.clientX, e.clientY); if (p && !s.cpu.shots.has(`${p.r}:${p.c}`) && s.turn === 'me' && !s.ask) enemy.setAim(p.r, p.c, true); else enemy.setAim(null, null, true); });
  cnv.addEventListener('pointerleave', () => enemy.setAim(null, null, true));
  let raf = 0, last = performance.now();
  const frame = (now) => {
    if (!$('#shcpu')) return;
    raf = requestAnimationFrame(frame); game.raf = raf;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    enemy.update(dt); mine.update(dt);
  };
  raf = requestAnimationFrame(frame);
  const screenY = (r, c) => { const v = new T.Vector3(enemy.cellX(c), 0.3, enemy.cellZ(r)).project(enemy.camera); const rc = enemy.renderer.domElement.getBoundingClientRect(); return rc.top + (-v.y * 0.5 + 0.5) * rc.height + 18; };
  s.r3 = { sync, aim: (r, c) => enemy.setAim(r, c), screenY, enemy, mine };
  game.stage3d = { dispose() { cancelAnimationFrame(raf); enemy.dispose(); mine.dispose(); } };
  sync();
}
