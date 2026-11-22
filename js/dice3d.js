/* Teilmal – Würfel-Duell in 3D (wird erst beim Spielen geladen)
 *
 * Eine Filz-Spielmatte, schräg von vorne: vorne würfelst du, hinten Robo. Echte Würfel mit runden Kanten fliegen
 * auf die Matte, springen ein paar Mal, kullern aus und bleiben dann ruhig liegen – oben die gewürfelte Zahl.
 * Würfel neu werfen: Würfel antippen (oder den 🔄-Knopf darunter).
 * Spiellogik in js/games2.js (startDice, dcDoRoll, dcReroll, dcCpu …); hier nur das Bild.
 */
'use strict';

/** Würfel mit runden Kanten: Box, deren Ecken auf Kugeln geschoben werden (Normalen exakt) */
function dc3RoundBox(T, size, rad, seg = 5) {
  const g = new T.BoxGeometry(size, size, size, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal, v = new T.Vector3(), c = new T.Vector3(), h = size / 2 - rad;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
    v.sub(c).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
    v.multiplyScalar(rad).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

function dc3Mount(T, host) {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x4a3322, 1);
  renderer.domElement.className = 'dc3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.5, 100);
  const own = [], keep = (x) => { own.push(x); return x; };
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  scene.add(new T.HemisphereLight(0xfff4e6, 0x4a3322, 1.15));
  const sun = new T.DirectionalLight(0xfff1dc, 2.2); sun.position.set(-4, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, near: 1, far: 34 }); sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
  scene.add(sun);
  const lamp = new T.PointLight(0xffd6a0, 22, 26, 1.6); lamp.position.set(0, 8.5, 0.6); scene.add(lamp); // warme Tischlampe

  /* ---------- Spielmatte (Filz, liegt auf der Seite – kein Kasten); quer für breite, hoch für schmale Flächen ---------- */
  const RR = 0.75;
  const LAYOUTS = {
    land: { W: 12, D: 7.8, z: [1.95, -1.85], x: [-2.1, 0.2] },
    port: { W: 7.8, D: 11, z: [2.6, -2.35], x: [-1.55, 0.4] },
    square: { W: 9.6, D: 8.4, z: [2.1, -1.95], x: [-1.85, 0.2] }, // fast quadratische Fläche (Handy hoch)
  };
  function makeMat(L, cw, ch) {
    const { W, D } = L, shape = new T.Shape();
    shape.moveTo(-W / 2 + RR, -D / 2); shape.lineTo(W / 2 - RR, -D / 2); shape.quadraticCurveTo(W / 2, -D / 2, W / 2, -D / 2 + RR);
    shape.lineTo(W / 2, D / 2 - RR); shape.quadraticCurveTo(W / 2, D / 2, W / 2 - RR, D / 2); shape.lineTo(-W / 2 + RR, D / 2);
    shape.quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - RR); shape.lineTo(-W / 2, -D / 2 + RR); shape.quadraticCurveTo(-W / 2, -D / 2, -W / 2 + RR, -D / 2);
    const g = keep(new T.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 }));
    g.rotateX(-Math.PI / 2); g.translate(0, -0.13, 0); // Oberseite auf y = 0
    const felt = keep(new T.CanvasTexture(cv(cw, ch, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.62); gr.addColorStop(0, '#22a05a'); gr.addColorStop(1, '#13723d'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 9000; k++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.setLineDash([16, 12]);
      c.beginPath(); c.roundRect?.(30, 30, w - 60, h - 60, 56); if (!c.roundRect) c.rect(30, 30, w - 60, h - 60); c.stroke();
      c.setLineDash([10, 14]); c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(70, h / 2); c.lineTo(w - 70, h / 2); c.stroke();
      c.setLineDash([]); c.fillStyle = 'rgba(255,255,255,.12)'; c.font = `900 ${Math.round(Math.min(w, h) * 0.17)}px "Bricolage Grotesque", Lexend, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('ROBO', w / 2, h * 0.25); c.fillText('DU', w / 2, h * 0.76);
    })));
    felt.colorSpace = T.SRGBColorSpace; felt.anisotropy = 8; felt.repeat.set(1 / W, 1 / D); felt.offset.set(0.5, 0.5);
    const m = new T.Mesh(g, [keep(new T.MeshStandardMaterial({ map: felt, roughness: 0.95 })), keep(new T.MeshStandardMaterial({ color: 0x0f5a30, roughness: 0.9 }))]);
    m.receiveShadow = true; m.castShadow = true; m.visible = false; scene.add(m);
    return m;
  }
  LAYOUTS.land.mesh = makeMat(LAYOUTS.land, 1024, 666);
  LAYOUTS.port.mesh = makeMat(LAYOUTS.port, 726, 1024);
  LAYOUTS.square.mesh = makeMat(LAYOUTS.square, 1024, 896);
  let L = LAYOUTS.land;
  /* ---------- Holztisch, auf dem die Matte liegt (füllt das ganze Bild) ---------- */
  const woodTex = keep(new T.CanvasTexture(cv(512, 512, (c, w, h) => {
    const boards = 4, bh = h / boards;
    for (let b = 0; b < boards; b++) {
      const base = [[168, 112, 63], [158, 104, 58], [176, 120, 70], [162, 108, 60]][b];
      c.fillStyle = `rgb(${base.join(',')})`; c.fillRect(0, b * bh, w, bh);
      for (let k = 0; k < 26; k++) { // Maserung
        c.strokeStyle = `rgba(${k % 3 ? '90,55,25' : '210,160,100'},${0.08 + Math.random() * 0.12})`; c.lineWidth = 1 + Math.random() * 2;
        const y0 = b * bh + Math.random() * bh, a = 2 + Math.random() * 5, f = 0.004 + Math.random() * 0.01, ph = Math.random() * 6;
        c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y0 + Math.sin(x * f + ph) * a); c.stroke();
      }
      if (Math.random() < 0.7) { const kx = Math.random() * w, ky = b * bh + bh * (0.3 + Math.random() * 0.4); c.fillStyle = 'rgba(90,50,20,.35)'; c.beginPath(); c.ellipse(kx, ky, 14, 6, 0, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(40,22,10,.55)'; c.fillRect(0, b * bh, w, 3); // Fuge
    }
  })));
  woodTex.colorSpace = T.SRGBColorSpace; woodTex.wrapS = woodTex.wrapT = T.RepeatWrapping; woodTex.repeat.set(9, 9); woodTex.anisotropy = 8;
  const table = new T.Mesh(keep(new T.PlaneGeometry(70, 70)), keep(new T.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0 })));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.165; table.receiveShadow = true; scene.add(table);
  // Würfelbecher (Leder), Notizblock mit Stift, ein paar Münzen – sichtbar, wo neben der Matte Platz ist
  const props = [];
  {
    const cup = new T.Group();
    const leather = keep(new T.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.75, side: T.DoubleSide }));
    const wall = new T.Mesh(keep(new T.CylinderGeometry(0.78, 0.64, 1.55, 28, 1, true)), leather); wall.position.y = 0.6; wall.castShadow = true; cup.add(wall);
    const bottom = new T.Mesh(keep(new T.CircleGeometry(0.64, 28)), leather); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.16; cup.add(bottom);
    const rim = new T.Mesh(keep(new T.TorusGeometry(0.78, 0.05, 8, 32)), keep(new T.MeshStandardMaterial({ color: 0xf5c518, metalness: 0.8, roughness: 0.3 }))); rim.rotation.x = Math.PI / 2; rim.position.y = 1.37; cup.add(rim);
    scene.add(cup); props.push({ o: cup, y: 0, at: (W, D) => [W / 2 + 1.45, -D / 2 + 1.3] });
    const pad = new T.Group();
    const padTex = keep(new T.CanvasTexture(cv(256, 340, (c, w, h) => { c.fillStyle = '#fffdf5'; c.fillRect(0, 0, w, h); c.fillStyle = '#fde68a'; c.fillRect(0, 0, w, 40); c.strokeStyle = '#bfdbfe'; c.lineWidth = 2; for (let y = 70; y < h; y += 26) { c.beginPath(); c.moveTo(14, y); c.lineTo(w - 14, y); c.stroke(); } c.fillStyle = '#1e3a8a'; c.font = '700 22px Lexend, sans-serif'; c.fillText('Du    Robo', 26, 92); c.fillStyle = '#334155'; c.fillText('I        I', 34, 118); })));
    padTex.colorSpace = T.SRGBColorSpace;
    const sheet = new T.Mesh(keep(new T.BoxGeometry(1.5, 0.08, 2)), [0, 1, 2, 3, 4, 5].map((i) => keep(i === 2 ? new T.MeshStandardMaterial({ map: padTex, roughness: 0.9 }) : new T.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.9 })))); sheet.castShadow = true; sheet.receiveShadow = true; pad.add(sheet);
    const pencil = new T.Mesh(keep(new T.CylinderGeometry(0.06, 0.06, 1.6, 6)), keep(new T.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 }))); pencil.rotation.set(0, 0, Math.PI / 2); pencil.position.set(0.15, 0.1, 1.2); pencil.castShadow = true; pad.add(pencil);
    const tip = new T.Mesh(keep(new T.ConeGeometry(0.06, 0.2, 6)), keep(new T.MeshStandardMaterial({ color: 0xe7c9a0 }))); tip.rotation.z = -Math.PI / 2; tip.position.set(1.05, 0.1, 1.2); pad.add(tip);
    pad.rotation.y = 0.35; scene.add(pad); props.push({ o: pad, y: -0.125, at: (W, D) => [-W / 2 - 1.5, D / 2 - 1.6] });
    const coinsG = new T.Group();
    const cg = keep(new T.CylinderGeometry(0.3, 0.3, 0.07, 24)), cm = keep(new T.MeshStandardMaterial({ color: 0xffcf33, metalness: 0.85, roughness: 0.3, emissive: 0x553300, emissiveIntensity: 0.25 }));
    for (let i = 0; i < 6; i++) { const m = new T.Mesh(cg, cm); m.position.set((i % 3) * 0.04, -0.125 + i * 0.075, 0); m.castShadow = true; coinsG.add(m); }
    for (let i = 0; i < 3; i++) { const m = new T.Mesh(cg, cm); m.position.set(0.7 + i * 0.35, -0.125, 0.3 - i * 0.2); m.rotation.y = i; m.castShadow = true; coinsG.add(m); }
    scene.add(coinsG); props.push({ o: coinsG, y: 0, at: (W, D) => [-W / 2 - 1.3, -D / 2 + 1.4] });
  }

  /* ---------- Würfel ---------- */
  const S = 1.1, H = S / 2;
  const dieG = keep(dc3RoundBox(T, S, 0.17, 5));
  const faceCanvas = (v, row) => cv(256, 256, (g, w, h) => {
    g.fillStyle = row ? '#e11d48' : '#fbfcfe'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, w * 0.75); gr.addColorStop(0, row ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(0,0,0,.06)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = row ? '#fff' : '#0f172a'; g.font = `900 ${String(v).length > 1 ? 118 : 140}px "Bricolage Grotesque", Lexend, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(v), w / 2, h / 2 + 8);
    if (v === 6 || v === 9) g.fillRect(w / 2 - 30, h / 2 + 66, 60, 10); // 6 und 9 unterscheiden
  });
  const dice = [0, 1].map((side) => [0, 1].map((k) => {
    const mats = Array.from({ length: 6 }, () => { const t = keep(new T.CanvasTexture(faceCanvas('?', k === 1))); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return keep(new T.MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0 })); });
    const m = new T.Mesh(dieG, mats); m.castShadow = true; m.receiveShadow = true; m.visible = false; m.userData = { side, k }; scene.add(m);
    return { m, mats, side, k, v: null, anim: null, home: new T.Vector3(), q: new T.Quaternion(), jit: [0, 0] };
  }));
  const pools = () => [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], game.dc?.rows?.length ? game.dc.rows : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]];
  /** Seiten neu bemalen: oben (+y, Index 2) die Zahl, sonst andere mögliche Werte */
  function paint(d, v) {
    const pool = pools()[d.k], others = pool.filter((x) => x !== v);
    d.mats.forEach((mt, i) => { const val = i === 2 ? v : (others.length ? others[Math.floor(Math.random() * others.length)] : v); mt.map.image = faceCanvas(val, d.k === 1); mt.map.needsUpdate = true; });
    d.v = v;
  }
  // Ringe unter den eigenen Würfeln, wenn man einen neu werfen darf
  const ringM = keep(new T.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.8, depthWrite: false }));
  const rings = [0, 1].map(() => { const r = new T.Mesh(keep(new T.RingGeometry(0.82, 0.96, 40)), ringM); r.rotation.x = -Math.PI / 2; r.position.y = 0.012; r.visible = false; scene.add(r); return r; });
  const chips = $('#dcmine');
  let picking = false;

  /* ---------- Kamera passend zur Matte ---------- */
  function fit() {
    const r = host.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const nl = camera.aspect < 0.95 ? LAYOUTS.port : camera.aspect < 1.4 ? LAYOUTS.square : LAYOUTS.land;
    if (nl !== L || !L.mesh.visible) { L.mesh.visible = false; L = nl; L.mesh.visible = true; dice.flat().forEach((d) => { setHome(d); if (!d.anim) d.m.position.copy(d.home); }); }
    const { W, D } = L;
    // Blickwinkel: je höher die Fläche im Verhältnis zur Matte, desto mehr von oben (füllt den Platz besser)
    const tilt = Math.asin(Math.min(Math.sin(1.15), Math.max(Math.sin(0.82), (W / D) / camera.aspect)));
    const pts = [[-W / 2, D / 2], [W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2]].map(([x, z]) => new T.Vector3(x, 0, z));
    const v = new T.Vector3(), look = new T.Vector3(0, 0, 0.2);
    const place = (dist) => { camera.position.set(0, Math.sin(tilt) * dist, look.z + Math.cos(tilt) * dist); camera.lookAt(look); camera.updateMatrixWorld(); };
    let lo = 3, hi = 80;
    for (let k = 0; k < 26; k++) { const m = (lo + hi) / 2; place(m); if (pts.every((q) => { v.copy(q).project(camera); return Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.86; })) hi = m; else lo = m; }
    place(hi);
    props.forEach((pr) => { const [x, z] = pr.at(W, D); pr.o.position.set(x, pr.y, z); v.set(x, 0.3, z).project(camera); pr.o.visible = Math.abs(v.x) < 0.97 && Math.abs(v.y) < 0.97; });
    // Schilder auf die Matte: links die Namen, rechts die Ergebnisse, in der Mitte rechts die Zielzahl
    const at = (x, z) => { v.set(x, 0, z).project(camera); return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]; };
    const put = (sel, x, z, right, below) => { const el = host.querySelector(sel); if (!el) return; const [px, py] = at(x, z); el.style.left = right ? 'auto' : `${px}px`; el.style.right = right ? `${w - px}px` : 'auto'; el.style.top = below ? `${py}px` : 'auto'; el.style.bottom = below ? 'auto' : `${h - py}px`; };
    put('.dc-lab.cpu', -W / 2 + 0.55, -D / 2 + 0.5, false, true);
    put('.dc-res.cpu', W / 2 - 0.55, -D / 2 + 0.5, true, true);
    put('.dc-lab.me', -W / 2 + 0.5, D / 2 - 0.45, false, false);
    put('.dc-res.me', W / 2 - 0.5, D / 2 - 0.45, true, false);
    const coin = host.querySelector('.dc-target');
    if (coin) { const [px, py] = at(W / 2 - (L === LAYOUTS.land ? 1.3 : 1.1), 0); coin.style.left = `${px}px`; coin.style.top = `${py}px`; }
  }
  const ro = new ResizeObserver(fit); ro.observe(host); fit();

  /* ---------- Wurf ---------- */
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const m3 = new T.Matrix3(), m4 = new T.Matrix4(), qa = new T.Quaternion(), ax = new T.Vector3();
  function setHome(d) { d.home.set(L.x[d.k] + d.jit[0], H, L.z[d.side] + d.jit[1]); }
  function throwDie(d, v, delay = 0) {
    paint(d, v);
    d.jit = [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.35]; setHome(d);
    d.q.setFromAxisAngle(new T.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.7);
    const from = new T.Vector3(d.home.x * 0.4 + (Math.random() - 0.5) * 2, 2.6, d.side === 0 ? L.D / 2 + 1.3 : -L.D / 2 - 1.1);
    ax.set(d.side === 0 ? 1 : -1, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8).normalize();
    d.anim = { t: -delay, dur: 1.15 + Math.random() * 0.2, from, axis: ax.clone(), spin: (3 + Math.random() * 2) * Math.PI * 2, bounced: 0 };
    d.m.visible = true;
  }
  function stepDie(d, dt) {
    const a = d.anim;
    if (!a) return;
    a.t += dt;
    if (a.t < 0) { d.m.visible = false; return; }
    d.m.visible = true;
    const t = Math.min(1, a.t / a.dur), e = easeOut(t);
    // Drehung: wird wie durch Reibung langsamer und endet genau mit der Zahl oben
    qa.setFromAxisAngle(a.axis, a.spin * (1 - e));
    d.m.quaternion.copy(d.q).multiply(qa);
    // Höhe: drei Hüpfer, die kleiner werden; der Würfel steht nie in der Matte (tiefste Ecke zählt)
    m4.makeRotationFromQuaternion(d.m.quaternion); m3.setFromMatrix4(m4);
    const el = m3.elements, low = (H - 0.17) * (Math.abs(el[1]) + Math.abs(el[4]) + Math.abs(el[7])) + 0.17;
    const hop = 2.1 * (1 - t) ** 2.2 * Math.abs(Math.sin(Math.PI * (t * 3 + 0.5)));
    d.m.position.set(a.from.x + (d.home.x - a.from.x) * e, low + hop, a.from.z + (d.home.z - a.from.z) * e);
    const b = t >= 5 / 6 ? 3 : t >= 0.5 ? 2 : t >= 1 / 6 ? 1 : 0;
    if (b > a.bounced) { a.bounced = b; snd.clack?.(b === 1 ? 1 : b === 2 ? 0.6 : 0.3); }
    if (t >= 1) { d.m.quaternion.copy(d.q); d.m.position.copy(d.home); d.anim = null; }
  }

  /* ---------- Antippen zum Neu-Werfen ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!picking) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(dice[0].map((d) => d.m))[0];
    if (hit) dcReroll(hit.object.userData.k);
  });

  /* ---------- Schnittstelle für die Spiellogik ---------- */
  const r3 = {
    /** side 0 = du, 1 = Robo; vals ['?','?'] = noch nicht gewürfelt; roll = Würfel, die gerade fliegen; pick = antippbar */
    show(side, vals, roll = [0, 1], pick = false) {
      dice[side].forEach((d, i) => {
        if (vals[i] === '?') { d.m.visible = false; d.anim = null; d.v = null; return; }
        if (roll.includes(i)) throwDie(d, vals[i], i * 0.12);
        else if (d.v !== vals[i]) { paint(d, vals[i]); d.m.visible = true; }
      });
      if (side === 0) r3.pick(pick);
    },
    pick(on) {
      picking = !!on;
      rings.forEach((r) => { r.visible = picking; });
      if (chips) chips.innerHTML = picking ? [0, 1].map((i) => `<button type="button" class="dc-rr" data-action="dc-reroll" data-i="${i}">🔄 neu werfen</button>`).join('') : '';
    },
  };
  game.dc.r3 = r3;

  /* ---------- Schleife ---------- */
  const proj = new T.Vector3();
  let raf = 0, last = performance.now(), clock = 0;
  const frame = (now) => {
    if (!host.isConnected) return;
    raf = requestAnimationFrame(frame); game.raf = raf;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; clock += dt;
    dice.flat().forEach((d) => stepDie(d, dt));
    const still = !dice[0].some((d) => d.anim);
    rings.forEach((r) => { r.visible = picking && still; });
    if (chips) chips.style.visibility = picking && still ? 'visible' : 'hidden';
    if (picking && still) {
      ringM.opacity = 0.45 + Math.sin(clock * 4) * 0.25;
      const W2 = host.clientWidth, H2 = host.clientHeight;
      dice[0].forEach((d, i) => {
        rings[i].position.set(d.m.position.x, 0.012, d.m.position.z);
        const b = chips?.children[i];
        if (b) { proj.set(d.m.position.x, 0, d.m.position.z + 0.95).project(camera); b.style.transform = `translate(${(proj.x * 0.5 + 0.5) * W2}px, ${(-proj.y * 0.5 + 0.5) * H2}px) translate(-50%, 0)`; }
      });
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  game.stage3d = {
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      dice.flat().forEach((d) => d.mats.forEach((m) => m.map?.dispose()));
      own.forEach((x) => { try { x.dispose?.(); } catch { /* */ } });
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  return r3;
}
