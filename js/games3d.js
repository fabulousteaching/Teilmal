/* Teilmal – 3D-Spiele (three.js, MIT-Lizenz, liegt in js/vendor)
 *
 * Elfmeter vor dem Tor im Stadion, Meteoriten aus dem Cockpit der Rakete, Frosch-Hüpfen über einen Teich.
 * Beim Elfmeter sind die Zahlen HTML-Schilder im Tor; bei Meteoriten und Frosch stecken sie als Bild direkt im Stein
 * bzw. stehen auf der Seerose (Antippen: das nächste Ziel auf dem Bildschirm zählt).
 * Gibt es kein WebGL (sehr alte Geräte), laufen die 2D-Versionen.
 */
'use strict';

let THREE = null;
let threeLoading = null;
function loadThree() {
  if (THREE) return Promise.resolve(THREE);
  if (!threeLoading) {
    threeLoading = import(new URL('js/vendor/three.module.min.js', document.baseURI).href)
      .then((m) => { THREE = m; return m; })
      .catch((e) => { threeLoading = null; throw e; });
  }
  return threeLoading;
}
const webglOK = (() => {
  let ok = null;
  return () => {
    if (ok != null) return ok;
    try { const c = document.createElement('canvas'); ok = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { ok = false; }
    return ok;
  };
})();

/* ---------------- Gemeinsame Bühne ---------------- */
const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
function createStage(host, { fov = 55, near = 0.05, far = 600, shadows = false, clear = 0x000000 } = {}) {
  const T = THREE;
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(clear);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; }
  renderer.domElement.className = 'g3-canvas';
  host.appendChild(renderer.domElement);
  const overlay = document.createElement('div');
  overlay.className = 'g3-labels';
  host.appendChild(overlay);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(fov, 1, near, far);
  const st = {
    T, renderer, scene, camera, overlay, host, labels: new Set(), frameFns: new Set(), tweens: new Set(),
    shakeAmt: 0, raf: 0, last: performance.now(), time: 0, w: 1, h: 1, disposed: false,
  };
  const v = new T.Vector3();
  function resize() {
    const r = host.getBoundingClientRect();
    st.w = Math.max(1, r.width); st.h = Math.max(1, r.height);
    renderer.setSize(st.w, st.h, false);
    camera.aspect = st.w / st.h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  /** Schild an einer Stelle im Raum. pos(): Vector3. Grösse wächst, je näher es ist. */
  st.addLabel = (el, pos, { base = 1, min = 0.45, max = 1.6, dist = 6 } = {}) => {
    const L = { el, pos, base, min, max, dist };
    overlay.appendChild(el);
    st.labels.add(L);
    return L;
  };
  st.removeLabel = (L) => { if (!L) return; L.el.remove(); st.labels.delete(L); };
  st.onFrame = (fn) => { st.frameFns.add(fn); return () => st.frameFns.delete(fn); };
  /** Einfache Animation: fn(t 0..1, e) während ms; liefert ein Promise */
  st.tween = (ms, fn, easing = ease.inOut) => new Promise((resolve) => {
    const tw = { t0: st.time, ms: reduceMotion() ? 1 : ms, fn, easing, resolve };
    st.tweens.add(tw);
  });
  st.shake = (a) => { st.shakeAmt = Math.max(st.shakeAmt, a); };
  st.project = (p) => {
    v.copy(p).project(camera);
    return { x: (v.x + 1) / 2 * st.w, y: (1 - v.y) / 2 * st.h, z: v.z };
  };
  const camShake = new T.Vector3();
  function frame(now) {
    if (st.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - st.last) / 1000));
    st.last = now; st.time += dt * 1000;
    for (const tw of [...st.tweens]) {
      const t = clamp((st.time - tw.t0) / tw.ms, 0, 1);
      tw.fn(t, tw.easing(t));
      if (t >= 1) { st.tweens.delete(tw); tw.resolve(); }
    }
    for (const fn of st.frameFns) fn(dt, st.time / 1000);
    camera.position.sub(camShake);
    if (st.shakeAmt > 0.001) {
      camShake.set((Math.random() - 0.5) * st.shakeAmt, (Math.random() - 0.5) * st.shakeAmt, 0);
      st.shakeAmt *= Math.pow(0.02, dt);
    } else camShake.set(0, 0, 0);
    camera.position.add(camShake);
    renderer.render(scene, camera);
    for (const L of st.labels) {
      const p = typeof L.pos === 'function' ? L.pos() : L.pos;
      if (!p) { L.el.style.display = 'none'; continue; }
      const q = st.project(p);
      const d = camera.position.distanceTo(p);
      if (q.z > 1 || q.z < -1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = '';
      const sc = clamp((L.dist / Math.max(0.1, d)) * L.base, L.min, L.max);
      L.el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
      L.el.style.zIndex = String(1000 - Math.round(d * 10));
    }
    st.raf = requestAnimationFrame(frame);
  }
  st.raf = requestAnimationFrame(frame);
  st.dispose = () => {
    st.disposed = true;
    cancelAnimationFrame(st.raf);
    ro.disconnect();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => { Object.values(m).forEach((x) => x?.isTexture && x.dispose()); m.dispose(); });
    });
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
    overlay.remove();
  };
  return st;
}
function canvasTex(w, h, draw, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function glowTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, inner); r.addColorStop(1, outer);
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}
/** Funken/Explosion: Partikel, die auseinanderfliegen und verblassen */
function burst(st, pos, { n = 90, colors = [0xffc233, 0xff6b4a, 0xffffff], speed = 4, life = 0.9, size = 0.18, gravity = -3, spread = 1 } = {}) {
  const T = THREE;
  const geo = new T.BufferGeometry();
  const p = new Float32Array(n * 3), vel = [], col = new Float32Array(n * 3);
  const cc = colors.map((c) => new T.Color(c));
  for (let i = 0; i < n; i++) {
    p.set([pos.x, pos.y, pos.z], i * 3);
    const dir = new T.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8) * spread);
    vel.push(dir);
    const c = cc[i % cc.length];
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('position', new T.BufferAttribute(p, 3));
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const mat = new T.PointsMaterial({ size, map: st.dot || (st.dot = glowTex()), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const pts = new T.Points(geo, mat);
  st.scene.add(pts);
  let age = 0;
  const off = st.onFrame((dt) => {
    age += dt;
    const a = geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      vel[i].y += gravity * dt;
      a[i * 3] += vel[i].x * dt; a[i * 3 + 1] += vel[i].y * dt; a[i * 3 + 2] += vel[i].z * dt;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - age / life);
    if (age >= life) { off(); st.scene.remove(pts); geo.dispose(); mat.dispose(); }
  });
}
/** Grosses Wort mitten im Bild (TOR!, GEHALTEN! …) */
function bigWord(host, html, cls = '') {
  const el = document.createElement('div');
  el.className = `g3-word ${cls}`;
  el.innerHTML = html;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}
function g3Label(html, cls, data = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `g3-tag ${cls}`;
  b.innerHTML = html;
  Object.entries(data).forEach(([k, v]) => { b.dataset[k] = v; });
  return b;
}
/** Zahl als Bild (für Sprites und Flächen im 3D-Raum): kräftige Schrift mit dunklem Rand, gut lesbar */
const NUM_FONT = (px) => `800 ${px}px "Bricolage Grotesque", Lexend, system-ui, sans-serif`;
function numCanvasTex(text, { fill = '#ffffff', stroke = '#1d130b', glow = null, w = 320, h = 180, size = 128, line = 0.17 } = {}) {
  return canvasTex(w, h, (g) => {
    let fs = size;
    g.font = NUM_FONT(fs);
    const tw = g.measureText(text).width;
    if (tw > w - 44) { fs = Math.floor((fs * (w - 44)) / tw); g.font = NUM_FONT(fs); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const y = h / 2 + fs * 0.05;
    if (glow) { g.shadowColor = glow; g.shadowBlur = 30; g.fillStyle = glow; g.fillText(text, w / 2, y); g.shadowBlur = 0; }
    g.lineWidth = Math.max(10, fs * line); g.strokeStyle = stroke; g.strokeText(text, w / 2, y);
    g.fillStyle = fill; g.fillText(text, w / 2, y);
  });
}
/** Schrift für die Zahlen im 3D-Raum laden (sonst zeichnet die Leinwand mit einer Ersatzschrift) */
const loadNumFont = () => (document.fonts?.load ? document.fonts.load(NUM_FONT(64)).catch(() => {}) : Promise.resolve());
/** Antippen im 3D-Bild: fn(x, y) mit Koordinaten relativ zur Bühne. Knöpfe und Karten darüber sind ausgenommen. */
function stageTap(st, fn) {
  const h = (e) => {
    if (e.button > 0 || e.target.closest('button, .g3-card, a')) return;
    const r = st.host.getBoundingClientRect();
    fn(e.clientX - r.left, e.clientY - r.top, e);
  };
  st.host.addEventListener('pointerdown', h);
}
/** Wie gross erscheint etwas mit Radius r (Welt) an der Stelle p auf dem Bildschirm (Pixel)? */
function screenRadius(st, p, r) {
  const d = Math.max(0.1, st.camera.position.distanceTo(p));
  return (r / (d * Math.tan((st.camera.fov * Math.PI) / 360))) * (st.h / 2);
}

/** Kurzes Rauschen (Jubel, Wind, Platschen) */
function noise(dur = 0.8, { freq = 1200, q = 0.6, gain = 0.12, sweep = 0 } = {}) {
  if (!db.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const f = audioCtx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), audioCtx.currentTime + dur);
    const g = audioCtx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(audioCtx.destination);
    src.start();
  } catch { /* */ }
}
/* Torjubel: echte Aufnahme eines jubelnden Fussball-Publikums (audio/torjubel.mp3).
   Quelle: «Crowd Cheer» von FoolBoyMedia, freesound.org/s/397434 – CC0 (gemeinfrei); gekürzt und ausgeblendet.
   Gespielt werden nur die ersten 1,3 Sekunden (danach ausgeblendet), damit der Jubel vor der nächsten Rechnung vorbei ist. */
let CHEER_BUF = null, CHEER_LOADING = null;
/** Aufnahme einmal laden (vor dem ersten Tor), damit der Jubel sofort kommt */
function loadCheer() {
  if (CHEER_BUF) return Promise.resolve(CHEER_BUF);
  if (CHEER_LOADING) return CHEER_LOADING;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    CHEER_LOADING = fetch(new URL('audio/torjubel.mp3', document.baseURI).href)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => audioCtx.decodeAudioData(b))
      .then((buf) => { CHEER_BUF = buf; return buf; })
      .catch((e) => { console.warn('Torjubel nicht geladen', e); CHEER_LOADING = null; return null; });
    return CHEER_LOADING;
  } catch { return Promise.resolve(null); }
}
/** Das Publikum jubelt (Tor!) – kurz: nach gut einer Sekunde ausgeblendet, damit es nicht in die nächste Rechnung hineinklatscht */
let CHEER_SRC = null;
function crowdCheer(gain = 0.9, dur = 1.3) {
  if (!db.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const play = (buf) => {
      if (!buf) return;
      try { CHEER_SRC?.stop(); } catch { /* */ }
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const g = audioCtx.createGain(), t0 = audioCtx.currentTime;
      g.gain.setValueAtTime(gain, t0);
      g.gain.setValueAtTime(gain, t0 + dur * 0.55);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur); // sanft ausblenden
      src.connect(g).connect(audioCtx.destination);
      src.start(t0); src.stop(t0 + dur + 0.05);
      CHEER_SRC = src;
    };
    if (CHEER_BUF) play(CHEER_BUF); else loadCheer().then(play);
  } catch { /* */ }
}

/* =========================================================
   ⚽ Elfmeter 3D – vor dem Tor im Stadion
   ========================================================= */
/* Ball mit Sternen (angelehnt an einen modernen Matchball: weiss, Sterne mit grün-blau-pinkem Rand,
   hellblaue Wolken; ohne Logos). Wird einmal pro Seitenaufruf berechnet: Für jeden Bildpunkt der Kugel
   wird der nächste von 12 Sternmittelpunkten gesucht – so sind die Sterne auf der Kugel nicht verzerrt. */
let STAR_BALL_CANVAS = null;
function starBallCanvas() {
  if (STAR_BALL_CANVAS) return STAR_BALL_CANVAS;
  const W = 768, H = 384;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  const f = (1 + Math.sqrt(5)) / 2;
  const C = [[-1, f, 0], [1, f, 0], [-1, -f, 0], [1, -f, 0], [0, -1, f], [0, 1, f], [0, -1, -f], [0, 1, -f], [f, 0, -1], [f, 0, 1], [-f, 0, -1], [-f, 0, 1]]
    .map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; });
  const B = C.map(([x, y, z], i) => {
    const up = Math.abs(y) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [up[1] * z - up[2] * y, up[2] * x - up[0] * z, up[0] * y - up[1] * x];
    const l1 = Math.hypot(...e1); e1 = e1.map((v) => v / l1);
    const e2 = [y * e1[2] - z * e1[1], z * e1[0] - x * e1[2], x * e1[1] - y * e1[0]];
    return { e1, e2, rot: i * 0.9 };
  });
  const K = (2 * Math.PI) / 5, A = K / 2, RO = 0.52, RI = 0.22;
  const starR = (th) => { let t = ((th % K) + K) % K; if (t > A) t = K - t; return (RO * RI * Math.sin(A)) / (RO * Math.sin(t) + RI * Math.sin(A - t)); };
  for (let py = 0; py < H; py++) {
    const th0 = ((py + 0.5) / H) * Math.PI, sT = Math.sin(th0), cT = Math.cos(th0);
    for (let px = 0; px < W; px++) {
      const ph = ((px + 0.5) / W) * Math.PI * 2;
      const x = -Math.cos(ph) * sT, y = cT, z = Math.sin(ph) * sT;
      let i1 = 0, d1 = -2, d2 = -2;
      for (let i = 0; i < 12; i++) { const dd = x * C[i][0] + y * C[i][1] + z * C[i][2]; if (dd > d1) { d2 = d1; d1 = dd; i1 = i; } else if (dd > d2) d2 = dd; }
      const b = B[i1];
      const u = x * b.e1[0] + y * b.e1[1] + z * b.e1[2], v = x * b.e2[0] + y * b.e2[1] + z * b.e2[2];
      const r = Math.acos(Math.min(1, d1));
      const sr = starR(Math.atan2(v, u) + b.rot);
      let R = 255, G = 255, Bl = 255;
      const dr = r - sr;
      if (dr > 0) {
        // hellblaue Wolken zwischen den Sternen, am Rand mit feinem Raster
        const n = Math.sin(3.1 * x + 2.3 * Math.sin(4.2 * y)) + Math.sin(2.7 * z + 3.3 * Math.sin(3.7 * x)) + Math.sin(4.1 * y + 2.1 * Math.sin(2.9 * z));
        let cl = Math.max(0, Math.min(1, (n - 0.55) / 0.8));
        if (cl > 0 && cl < 0.6 && ((px >> 1) + (py >> 1)) % 3 !== 0) cl *= 0.55;
        R = 255 - cl * 100; G = 255 - cl * 55; Bl = 255 - cl * 18;
        if (dr < 0.035) { const k = 1 - dr / 0.035; R = R * (1 - k) + 80 * k; G = G * (1 - k) + 225 * k; Bl = Bl * (1 - k) + 95 * k; } // grüner Schein aussen
      } else if (dr > -0.06) {
        const k = -dr / 0.06;
        if (k < 0.55) { R = 25; G = 105; Bl = 215; } else if (k < 0.8) { R = 60; G = 160; Bl = 235; } else { R = 215; G = 60; Bl = 195; }
      }
      if (d1 - d2 < 0.005) { R *= 0.84; G *= 0.86; Bl *= 0.9; } // Nähte
      const o = (py * W + px) * 4; d[o] = R; d[o + 1] = G; d[o + 2] = Bl; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  STAR_BALL_CANVAS = c;
  return c;
}
async function startElfmeter3D() {
  const T = await loadThree();
  await loadNumFont();
  Object.assign(game, { picker: gamePicker(), locked: true, task: null });
  const run = runStart('elfmeter', { onEnd: () => { game.locked = true; } });
  $('#view').innerHTML = gameShell('elfmeter', `
    <div class="g3 g3-elf" id="g3">
      <div class="g3-hud top"><div class="elf-board">${runHudHTML('in-board')}<span class="eb-task" id="etask"></span></div></div>
      ${run.mode === 'survive' ? '<div class="g3-clock" id="sclock"><i></i></div>' : ''}
    </div>
    <p class="mode-hint">Tippe auf die Zahl mit dem richtigen Ergebnis – der Ball fliegt los. Tasten 1–3 gehen auch.</p>`);
  const host = $('#g3');
  const st = createStage(host, { fov: 40, shadows: true, clear: 0x7fb6e6 });
  if (db.settings.sound) loadCheer(); // Torjubel vorladen
  game.stage3d = st;
  const { scene, camera } = st;
  scene.fog = new T.Fog(0x9cc8ef, 40, 120);
  scene.add(new T.HemisphereLight(0xdbeeff, 0x3f6b2a, 1.1));
  const sun = new T.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(-8, 18, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -4, near: 1, far: 50 });
  scene.add(sun);
  // Himmel
  const sky = new T.Mesh(new T.SphereGeometry(200, 32, 16), new T.MeshBasicMaterial({ side: T.BackSide, map: canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f6fc4'); gr.addColorStop(0.45, '#8cc4f2'); gr.addColorStop(0.55, '#f7d9a8'); gr.addColorStop(1, '#f7d9a8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }), fog: false }));
  scene.add(sky);
  // Rasen mit Mähstreifen
  const grass = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3f9a45' : '#4aa851'; g.fillRect(0, (i * h) / 8, w, h / 8); }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${20 + Math.random() * 40},${90 + Math.random() * 70},${30 + Math.random() * 30},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3); }
  }, { repeat: [6, 6] });
  const pitch = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.z = 20; pitch.receiveShadow = true;
  scene.add(pitch);
  // Linien
  const lineMat = new T.MeshBasicMaterial({ color: 0xf4f8f2 });
  const line = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new T.Mesh(new T.PlaneGeometry(len, 0.12), lineMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, 0.006, (z1 + z2) / 2);
    scene.add(m);
  };
  line(-30, 0, 30, 0); line(-9.6, 0, -9.6, 5.5); line(9.6, 0, 9.6, 5.5); line(-9.6, 5.5, 9.6, 5.5);
  line(-20.16, 0, -20.16, 16.5); line(20.16, 0, 20.16, 16.5); line(-20.16, 16.5, 20.16, 16.5);
  const arc = new T.Mesh(new T.RingGeometry(9.1, 9.22, 64, 1, Math.PI * 0.2, Math.PI * 0.6), lineMat);
  arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.006, 11); scene.add(arc);
  const spot = new T.Mesh(new T.CircleGeometry(0.13, 24), lineMat);
  spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.007, 11); scene.add(spot);
  // Tribüne mit Publikum
  const crowd = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#26334a'; g.fillRect(0, 0, w, h);
    const cols = ['#ff6b4a', '#ffc233', '#ffffff', '#0f766e', '#38bdf8', '#e11d48', '#a855f7', '#22c55e'];
    for (let row = 0; row < 14; row++) for (let i = 0; i < 120; i++) {
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.beginPath(); g.arc(i * 8.6 + (row % 2) * 4 + Math.random() * 2, h - 10 - row * 17, 3.4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let row = 0; row < 14; row++) g.fillRect(0, h - 4 - row * 17, w, 2);
  });
  const stand = new T.Mesh(new T.CylinderGeometry(55, 48, 16, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76), new T.MeshStandardMaterial({ map: crowd, side: T.BackSide, roughness: 1 }));
  stand.position.set(0, 7, 18);
  scene.add(stand);
  const roof = new T.Mesh(new T.CylinderGeometry(56, 56, 1, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76), new T.MeshStandardMaterial({ color: 0xdfe6ee, side: T.DoubleSide }));
  roof.position.set(0, 15.5, 18); scene.add(roof);
  const lightMat = new T.SpriteMaterial({ map: glowTex('rgba(255,255,240,1)', 'rgba(255,255,200,0)'), blending: T.AdditiveBlending, depthWrite: false });
  [-40, -26, 26, 40].forEach((x) => { const sp = new T.Sprite(lightMat); sp.position.set(x, 24, -34); sp.scale.set(3.2, 3.2, 1); scene.add(sp); });
  // Werbebanden
  const ads = canvasTex(1024, 64, (g, w) => {
    const items = [['#0f766e', '1×1'], ['#ff6b4a', 'RECHNEN'], ['#2563eb', 'FAIR PLAY'], ['#ffc233', 'TOOOR'], ['#9333ea', '7·8=56']];
    items.forEach(([c, t], i) => { g.fillStyle = c; g.fillRect((i * w) / 5, 0, w / 5, 64); g.fillStyle = '#fff'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.fillText(t, (i + 0.5) * (w / 5), 45); });
  }, { repeat: [3, 1] });
  const boards = new T.Mesh(new T.PlaneGeometry(70, 0.9), new T.MeshBasicMaterial({ map: ads }));
  boards.position.set(0, 0.45, -8.5); scene.add(boards);
  // Tor (etwas grösser als ein echtes, damit die Zahlen gut Platz haben)
  const GW = 8.4, GH = 2.8, GD = 2.2;
  const postMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
  const post = (x) => { const m = new T.Mesh(new T.CylinderGeometry(0.065, 0.065, GH, 16), postMat); m.position.set(x, GH / 2, 0); m.castShadow = true; scene.add(m); return m; };
  const posts = { [-1]: post(-GW / 2), 1: post(GW / 2) };
  const bar = new T.Mesh(new T.CylinderGeometry(0.065, 0.065, GW + 0.13, 16), postMat);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, GH, 0); bar.castShadow = true; scene.add(bar);
  const netTex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8 - w / 16, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / 8); g.lineTo(w, (i * h) / 8); g.stroke(); }
  }, { repeat: [9, 3.4] });
  const netMat = new T.MeshStandardMaterial({ map: netTex, transparent: true, side: T.DoubleSide, alphaTest: 0.05, roughness: 1 });
  const backNet = new T.Mesh(new T.PlaneGeometry(GW, Math.hypot(GH, GD * 0.6), 30, 12), netMat);
  backNet.position.set(0, GH / 2, -GD * 0.7); backNet.rotation.x = -Math.atan2(GD * 0.6, GH);
  scene.add(backNet);
  const backBase = backNet.geometry.attributes.position.array.slice();
  [-1, 1].forEach((sgn) => {
    const side = new T.Mesh(new T.PlaneGeometry(GD, GH), netMat);
    side.rotation.y = Math.PI / 2; side.position.set((sgn * GW) / 2, GH / 2, -GD / 2); scene.add(side);
  });
  const top = new T.Mesh(new T.PlaneGeometry(GW, GD * 0.4), netMat);
  top.rotation.x = Math.PI / 2; top.position.set(0, GH, -GD * 0.2); scene.add(top);
  let netHit = null; // {x, y, t}
  st.onFrame((dt) => {
    const pos = backNet.geometry.attributes.position;
    if (!netHit) return;
    netHit.t += dt;
    const k = Math.exp(-netHit.t * 3) * Math.cos(netHit.t * 18) * 0.7;
    for (let i = 0; i < pos.count; i++) {
      const x = backBase[i * 3], y = backBase[i * 3 + 1];
      const d2 = (x - netHit.x) ** 2 + (y - (netHit.y - GH / 2)) ** 2;
      pos.array[i * 3 + 2] = backBase[i * 3 + 2] - k * Math.exp(-d2 * 0.9);
    }
    pos.needsUpdate = true;
    if (netHit.t > 2) { netHit = null; pos.array.set(backBase); pos.needsUpdate = true; }
  });
  // Ball
  const ballTex = new T.CanvasTexture(starBallCanvas());
  ballTex.colorSpace = T.SRGBColorSpace; ballTex.anisotropy = 4;
  const ball = new T.Mesh(new T.SphereGeometry(0.11, 48, 32), new T.MeshPhysicalMaterial({ map: ballTex, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.28 }));
  ball.castShadow = true;
  ball.rotation.set(0.4, 0.8, 0);
  scene.add(ball);
  const START = { cam: new T.Vector3(0, 0.9, 13.7), look: new T.Vector3(0, 0.98, 0), ball: new T.Vector3(0, 0.11, 11) };
  const look = START.look.clone();
  function resetScene() {
    camera.position.copy(START.cam); look.copy(START.look); camera.lookAt(look);
    ball.position.copy(START.ball); ball.visible = true;
  }
  resetScene();
  // Hochformat (Handy): weitwinkliger, damit das ganze Tor zu sehen ist
  let lastFov = 0;
  st.onFrame(() => {
    const fov = 40 + 26 * clamp((1.2 - camera.aspect) / 0.6, 0, 1);
    if (Math.abs(fov - lastFov) > 0.2) { lastFov = fov; camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.lookAt(look);
  });
  // Zahlenscheiben vor dem Tor: Der Ball fliegt durch die gewählte Zahl, die dabei zerbricht
  const SPOTS = [[-2.9, 1.6], [0, 2.05], [2.9, 1.6]];
  const TZ = 1.3, TR = 0.62;
  const discGeo = new T.CircleGeometry(TR, 48);
  function makeTarget(v, i) {
    const tex = canvasTex(256, 256, (g) => {
      const gr = g.createRadialGradient(100, 90, 10, 128, 128, 128); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.78, '#f1f6f3'); gr.addColorStop(1, '#cfdcd5');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
      g.lineWidth = 9; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
      let fs = 128; g.font = NUM_FONT(fs);
      const tw = g.measureText(String(v)).width;
      if (tw > 190) { fs = Math.floor((fs * 190) / tw); g.font = NUM_FONT(fs); }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#10282C';
      g.fillText(String(v), 128, 134);
    });
    const m = new T.Mesh(discGeo, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.set(SPOTS[i][0], SPOTS[i][1], TZ);
    m.userData = { val: v, i, base: SPOTS[i][1], ph: Math.random() * 6 };
    m.renderOrder = 4;
    m.scale.setScalar(0.01);
    st.tween(380, (u, e) => m.scale.setScalar(Math.max(0.01, e)), ease.back);
    scene.add(m);
    return m;
  }
  let targets = [];
  st.onFrame((dt, t) => targets.forEach((m) => {
    if (m.userData.gone) return;
    m.position.y = m.userData.base + Math.sin(t * 2 + m.userData.ph) * 0.05;
    m.lookAt(camera.position);
    if (m.userData.hint) { const k = 1 + Math.sin(t * 9) * 0.07; m.scale.setScalar(k); }
  }));
  function dropTargets() {
    targets.forEach((m) => { if (!m.userData.gone) { scene.remove(m); m.material.map.dispose(); m.material.dispose(); } });
    targets = [];
  }
  /** Zahl zerbricht in Scherben (gleiche Bildtextur, Stücke fliegen auseinander) und leuchtet grün (richtig) oder rot (falsch) auf */
  const flashTex = glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  function shatter(m, { wrong = false, dir = new T.Vector3(0, 0, -1) } = {}) {
    m.userData.gone = true;
    const glow = new T.Sprite(new T.SpriteMaterial({ map: flashTex, color: wrong ? 0xff3b3b : 0x3dff6e, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    glow.position.copy(m.position); glow.scale.setScalar(TR * 3); glow.renderOrder = 6;
    scene.add(glow);
    st.tween(650, (u) => { glow.scale.setScalar(TR * (3 + u * 3)); glow.material.opacity = 1 - u; }).then(() => { scene.remove(glow); glow.material.dispose(); });
    const tex = m.material.map, n = 14, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.3; pts.push([Math.cos(a) * TR, Math.sin(a) * TR]); }
    const c0 = [(Math.random() - 0.5) * TR * 0.35, (Math.random() - 0.5) * TR * 0.35];
    const shards = [];
    for (let i = 0; i < n; i++) {
      const P = [c0, pts[i], pts[(i + 1) % n]];
      const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3;
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(P.flatMap(([x, y]) => [x - cx, y - cy, 0]), 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(P.flatMap(([x, y]) => [x / (2 * TR) + 0.5, y / (2 * TR) + 0.5]), 2));
      const s = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, color: wrong ? 0xff5c5c : 0x5cff86, depthWrite: false }));
      s.quaternion.copy(m.quaternion);
      s.position.copy(new T.Vector3(cx, cy, 0).applyQuaternion(m.quaternion).add(m.position));
      const out = new T.Vector3(cx, cy, 0).normalize().applyQuaternion(m.quaternion);
      s.userData = { v: out.multiplyScalar(1.6 + Math.random() * 2.2).add(dir.clone().multiplyScalar(1.5 + Math.random() * 2)).add(new T.Vector3(0, 1.4, 0)), spin: new T.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10) };
      s.renderOrder = 5;
      scene.add(s); shards.push(s);
    }
    scene.remove(m); m.material.dispose();
    let age = 0;
    const off = st.onFrame((dt) => {
      age += dt;
      shards.forEach((s) => { const u = s.userData; u.v.y -= 9 * dt; s.position.addScaledVector(u.v, dt); s.rotation.x += u.spin.x * dt; s.rotation.y += u.spin.y * dt; s.rotation.z += u.spin.z * dt; s.material.opacity = Math.max(0, 1 - age / 1.1); });
      if (age > 1.15) { off(); shards.forEach((s) => { scene.remove(s); s.geometry.dispose(); s.material.dispose(); }); tex.dispose(); }
    });
    burst(st, m.position.clone(), { n: 50, colors: wrong ? [0xff4d4d, 0xff9a9a, 0xffffff] : [0x3dff6e, 0xb6ffc8, 0xffffff], speed: 3, life: 0.6, size: 0.11, gravity: -4 });
  }
  function nextShot() {
    if (!runOn() || st.disposed) return;
    dropTargets();
    resetScene();
    const t = game.picker.next();
    game.task = t;
    $('#etask').innerHTML = taskHTML(t, '<span class="slot">?</span>');
    targets = choicesFor(t, 3).map((v, i) => makeTarget(v, i));
    game.locked = false;
    t.shownAt = performance.now();
    if (game.run.mode === 'survive') taskClock($('#sclock i'), surviveMs(7000, 1800), () => shoot(null));
  }
  async function shoot(m) {
    if (game.locked || !runOn()) return;
    game.locked = true;
    taskClockStop($('#sclock i'));
    const t = game.task;
    const ok = recordAnswer(t, m ? m.userData.val : '', performance.now() - t.shownAt);
    const right = targets.find((x) => x.userData.val === t.answer);
    if (!m) { // zu spät (Survive): kein Schuss
      sfx.bad();
      if (right) { right.material.color.set(0xb9ffb0); right.userData.hint = true; }
      bigWord(host, `Zu spät!<small>${esc(taskText(t, true))}</small>`, 'bad');
      if (runWrong(t)) return;
      await sleep(1100);
      if (!st.disposed) nextShot();
      return;
    }
    const [tx, ty] = SPOTS[m.userData.i];
    const T0 = m.position.clone();
    // Richtig: durch die Zahl ins Netz. Falsch: durch die Zahl, dann an die Latte (Mitte) bzw. an den Pfosten (links/rechts).
    const sgn = Math.sign(tx) || (Math.random() < 0.5 ? -1 : 1);
    const miss = ok ? null : (Math.abs(tx) > 1 ? 'post' : 'bar');
    const BALL_R = 0.11, POST_R = 0.065;
    const F = ok ? new T.Vector3(tx * 1.04, ty * 0.95, -0.95)
      : miss === 'post' ? new T.Vector3(sgn * (GW / 2 - 0.04), clamp(ty * 0.95, 0.5, GH - 0.35), POST_R + BALL_R - 0.02)
        : new T.Vector3(tx + (Math.random() - 0.5) * 0.6, GH - 0.03, POST_R + BALL_R - 0.02);
    sfx.kick();
    noise(0.25, { freq: 500, gain: 0.08 });
    const p0 = START.ball.clone();
    const ctrl = new T.Vector3(T0.x * 0.4 + (Math.random() - 0.5) * 0.8, Math.max(T0.y, 1) + 0.7, 6);
    const bez = (u) => p0.clone().multiplyScalar((1 - u) ** 2).add(ctrl.clone().multiplyScalar(2 * u * (1 - u))).add(T0.clone().multiplyScalar(u * u));
    const cam0 = camera.position.clone(), look0 = look.clone();
    const camTo = new T.Vector3(tx * 0.12, 0.95, 11.4);
    const follow = (u) => { camera.position.lerpVectors(cam0, camTo, ease.inOut(Math.min(1, u))); look.lerpVectors(look0, new T.Vector3(ball.position.x * 0.45, Math.max(1, ball.position.y * 0.6 + 0.45), 0), Math.min(1, u)); };
    // 1. bis zur Zahl
    await st.tween(520, (u, e) => { ball.position.copy(bez(e)); ball.rotation.x -= 0.45; ball.rotation.y += 0.18; follow(u * 0.7); }, (x) => 1 - Math.pow(1 - x, 1.5));
    if (st.disposed) return;
    shatter(m, { wrong: !ok, dir: F.clone().sub(T0).normalize() });
    // 2. weiter ins Netz bzw. daneben
    const p1 = ball.position.clone();
    await st.tween(ok ? 220 : 240, (u, e) => { ball.position.lerpVectors(p1, F, e); ball.rotation.x -= 0.4; follow(0.7 + u * 0.3); }, (x) => x);
    if (st.disposed) return;
    let ended;
    if (ok) {
      netHit = { x: tx, y: ty, t: 0 };
      st.shake(0.1);
      burst(st, F.clone().setZ(-0.3), { n: 120, colors: [0xffc233, 0xff6b4a, 0x38bdf8, 0x22c55e, 0xffffff], speed: 5, life: 1.2, size: 0.12, gravity: -2 });
      crowdCheer(); // Tor: das Publikum jubelt
      bigWord(host, 'TOR!', 'good');
      host.classList.remove('flash'); void host.offsetWidth; host.classList.add('flash');
      st.tween(420, (u, e) => { ball.position.z = F.z - 0.45 * e; ball.position.y = F.y * (1 - e) + 0.11 * e; });
      ended = runRight();
    } else {
      sfx.bad();
      tone([1568, 2093, 1760], 0.09, 'triangle', 0.09); // Klong!
      noise(0.18, { freq: 2600, gain: 0.06 });
      st.shake(0.07);
      burst(st, F.clone(), { n: 26, colors: [0xffffff, 0xdfe6ee], speed: 2.2, life: 0.45, size: 0.06, gravity: -4 });
      // Pfosten bzw. Latte zittern kurz
      const hitObj = miss === 'post' ? posts[sgn] : bar, base = hitObj.position.clone();
      st.tween(450, (u) => { const w = Math.sin(u * 46) * 0.025 * (1 - u); hitObj.position.set(base.x + (miss === 'post' ? w : 0), base.y + (miss === 'bar' ? w : 0), base.z - Math.abs(w)); })
        .then(() => hitObj.position.copy(base));
      // Abpraller zurück ins Feld
      const b0 = F.clone();
      const b1 = miss === 'post' ? new T.Vector3(sgn * (GW / 2 + 1.6), 0.11, 3.6) : new T.Vector3(b0.x * 0.6 + (Math.random() - 0.5), 0.11, 4.2);
      const up = miss === 'post' ? 0.55 : 1.4;
      st.tween(750, (u, e) => {
        ball.position.lerpVectors(b0, b1, e);
        ball.position.y = Math.max(0.11, b0.y * (1 - e) + 0.11 * e + Math.sin(u * Math.PI) * up);
        ball.rotation.x += 0.25; ball.rotation.z += 0.2;
      }, ease.out);
      if (right) { right.material.color.set(0xb9ffb0); right.userData.hint = true; }
      bigWord(host, `${miss === 'post' ? 'Pfosten!' : 'Latte!'}<small>${esc(taskText(t, true))}</small>`, 'bad');
      ended = runWrong(t);
    }
    if (ended) return;
    // schnell zurück in die Ausgangslage
    await sleep(ok ? 450 : 950);
    if (st.disposed || !runOn()) return;
    const camA = camera.position.clone(), lookA = look.clone();
    targets.forEach((x) => { if (!x.userData.gone) st.tween(250, (u) => x.scale.setScalar(Math.max(0.01, 1 - u))); });
    await st.tween(300, (u, e) => { camera.position.lerpVectors(camA, START.cam, e); look.lerpVectors(lookA, START.look, e); });
    if (!st.disposed) nextShot();
  }
  // Antippen: die Zahl, die dem Finger am nächsten ist
  stageTap(st, (x, y) => {
    if (game.locked) return;
    let best = null, bestD = Infinity;
    targets.forEach((m) => {
      if (m.userData.gone) return;
      const q = st.project(m.position);
      const rad = Math.max(44, screenRadius(st, m.position, TR * 1.25));
      const d = Math.hypot(q.x - x, q.y - y) / rad;
      if (d < 1 && d < bestD) { best = m; bestD = d; }
    });
    if (best) shoot(best);
  });
  game.pickVal = (v) => shoot(targets.find((m) => !m.userData.gone && m.userData.val === Number(v)));
  game.targetPos = () => targets.filter((m) => !m.userData.gone).map((m) => ({ v: m.userData.val, ...st.project(m.position) }));
  setGameKeys((e) => { if (/^[1-3]$/.test(e.key)) shoot(targets.filter((m) => !m.userData.gone).sort((a, b) => a.position.x - b.position.x)[+e.key - 1]); });
  nextShot();
}

/* =========================================================
   ☄️ Meteoriten 3D – aus dem Cockpit der Rakete
   ========================================================= */
const COCKPIT_HTML = `
  <div class="cockpit" aria-hidden="true">
    <svg class="ck-frame" viewBox="0 0 1000 600" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ckHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34405f"/><stop offset=".55" stop-color="#1c2540"/><stop offset="1" stop-color="#121a2e"/></linearGradient>
        <linearGradient id="ckStrut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b2440"/><stop offset=".45" stop-color="#55678f"/><stop offset="1" stop-color="#1b2440"/></linearGradient>
        <linearGradient id="ckGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe6ff" stop-opacity=".13"/><stop offset=".35" stop-color="#bfe6ff" stop-opacity="0"/><stop offset=".8" stop-color="#bfe6ff" stop-opacity="0"/><stop offset="1" stop-color="#bfe6ff" stop-opacity=".08"/></linearGradient>
      </defs>
      <path fill="url(#ckHull)" fill-rule="evenodd" d="M0 0H1000V600H0Z M80 46 Q500 -4 920 46 L985 452 Q500 420 15 452 Z"/>
      <path d="M80 46 Q500 -4 920 46 L985 452 Q500 420 15 452 Z" fill="url(#ckGlass)"/>
      <path d="M80 46 Q500 -4 920 46" fill="none" stroke="#56688f" stroke-width="5" vector-effect="non-scaling-stroke"/>
      <path d="M80 46 L15 452 M920 46 L985 452" stroke="#56688f" stroke-width="6" vector-effect="non-scaling-stroke"/>
      <path class="ck-strut" d="M262 22 L246 22 L196 446 L226 444 Z" fill="url(#ckStrut)"/>
      <path class="ck-strut" d="M738 22 L754 22 L804 446 L774 444 Z" fill="url(#ckStrut)"/>
      <path d="M80 46 Q500 -4 920 46 L985 452 Q500 420 15 452 Z" fill="none" stroke="#7dd3fc" stroke-opacity=".45" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      <path d="M150 92 L104 300" stroke="#fff" stroke-opacity=".07" stroke-width="26"/>
      <path d="M196 84 L168 208" stroke="#fff" stroke-opacity=".05" stroke-width="10"/>
      <path d="M470 34 h60" stroke="#7dd3fc" stroke-opacity=".5" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <path d="M500 24 v18" stroke="#7dd3fc" stroke-opacity=".5" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg>
    <span class="ck-gun l"><i></i></span><span class="ck-gun r"><i></i></span>
  </div>
  <div class="ck-dash">
    <div class="ck-panel ck-left">
      __CK_LEFT__
      <span class="ck-leds"><i></i><i></i><i></i><i></i></span>
    </div>
    <div class="ck-screen"><span class="ck-label">Zielrechnung</span><span class="dash-task" id="mtask"></span></div>
    <div class="ck-panel ck-right">
      <span class="ck-gauge" id="ckspeed"><svg viewBox="0 0 64 38"><path d="M7 34 A25 25 0 0 1 57 34" fill="none" stroke="#24304f" stroke-width="7" stroke-linecap="round"/><path d="M7 34 A25 25 0 0 1 57 34" fill="none" stroke="url(#ckSpd)" stroke-width="3" stroke-linecap="round"/><defs><linearGradient id="ckSpd"><stop offset="0" stop-color="#22c55e"/><stop offset=".6" stop-color="#facc15"/><stop offset="1" stop-color="#ef4444"/></linearGradient></defs><line class="needle" x1="32" y1="34" x2="32" y2="12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="34" r="3.5" fill="#cbd5e1"/></svg><span class="ck-label">Tempo</span></span>
      <span class="ck-col m-score" data-run="okbox"><span class="ck-label">Treffer</span><b data-run="ok">0</b>__CK_GOAL__</span>
    </div>
  </div>`;
async function startMeteor3D() {
  const T = await loadThree();
  await loadNumFont();
  Object.assign(game, { picker: gamePicker(), wave: [], task: null, over: false, recorded: false, waveDone: true, alienT: 0, alienSeen: false });
  const run = runStart('meteor', { onEnd: () => { game.waveDone = true; } });
  // Cockpit links: Schilde (Survive), Restzeit (Countdown) oder Stoppuhr (Speed)
  const left = run.mode === 'survive'
    ? `<span class="ck-col"><span class="ck-label">Schilde</span><span class="lives" id="lives">${'<i class="on"></i>'.repeat(RUN.lives)}</span></span><span class="ck-col ck-lvl" data-run="levelbox"><span class="ck-label">Level</span><b data-run="level">1</b><em class="run-levelup">schneller!</em></span>`
    : `<span class="ck-col"><span class="ck-label">${run.mode === 'countdown' ? 'Restzeit' : 'Zeit'}</span><span class="ck-time"><b data-run="time">${run.mode === 'countdown' ? RUN.ms / 1000 : '0,0'}</b> s</span>${run.mode === 'countdown' ? '<span class="run-bar ck-bar"><i data-run="bar"></i></span>' : ''}</span><span class="ck-col ck-lvl" data-run="levelbox"><span class="ck-label">Level</span><b data-run="level">1</b><em class="run-levelup">schneller!</em></span>`;
  game.onRunHud = (r) => $$('#lives i').forEach((el, i) => el.classList.toggle('on', i < r.lives));
  $('#view').innerHTML = gameShell('meteor', `
    <div class="g3 g3-space" id="g3">
      ${COCKPIT_HTML.replace('__CK_LEFT__', left).replace('__CK_GOAL__', run.mode === 'speed' ? `<small class="ck-goal">/${RUN.goal}</small>` : '')}
      <div class="ck-alert" id="ckalert" aria-live="polite"></div>
      <div class="crack" id="crack" aria-hidden="true"><svg viewBox="0 0 400 300"><path d="M200 150 L120 60 M200 150 L300 40 M200 150 L360 190 M200 150 L90 230 M200 150 L230 290 M120 60 L80 20 M300 40 L340 10 M360 190 L400 200 M90 230 L30 260 M150 105 L110 120 M260 95 L290 110 M280 170 L300 150" stroke="#fff" stroke-width="2.5" fill="none" opacity=".85"/></svg></div>
    </div>
    <p class="mode-hint">Tippe den Meteoriten mit der richtigen Zahl an, bevor er die Rakete trifft. Tasten 1–4 gehen auch.</p>`);
  const host = $('#g3');
  const st = createStage(host, { fov: 68, clear: 0x03040c });
  game.stage3d = st;
  const { scene, camera } = st;
  camera.position.set(0, 0, 0); camera.lookAt(0, 0, -1);
  scene.fog = new T.FogExp2(0x03040c, 0.006);
  scene.add(new T.AmbientLight(0x6070a0, 0.8));
  const key = new T.DirectionalLight(0xffe2c0, 2.4); key.position.set(4, 3, 2); scene.add(key);
  const rim = new T.DirectionalLight(0x6aa8ff, 1.2); rim.position.set(-5, -2, -6); scene.add(rim);
  // Sterne, die vorbeiziehen
  const N = 1800;
  const sGeo = new T.BufferGeometry();
  const sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) sp.set([(Math.random() - 0.5) * 160, (Math.random() - 0.5) * 100, -Math.random() * 300], i * 3);
  sGeo.setAttribute('position', new T.BufferAttribute(sp, 3));
  const stars = new T.Points(sGeo, new T.PointsMaterial({ size: 0.45, map: glowTex(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xdfe9ff }));
  scene.add(stars);
  // Lichtstreifen bei hoher Geschwindigkeit
  const L = 160;
  const lGeo = new T.BufferGeometry();
  const lp = new Float32Array(L * 6);
  const lineInit = (i) => { const x = (Math.random() - 0.5) * 60, y = (Math.random() - 0.5) * 40, z = -Math.random() * 200; lp.set([x, y, z, x, y, z - 4], i * 6); };
  for (let i = 0; i < L; i++) lineInit(i);
  lGeo.setAttribute('position', new T.BufferAttribute(lp, 3));
  const streaks = new T.LineSegments(lGeo, new T.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
  scene.add(streaks);
  // Nebel und Planet in der Ferne
  [[0x7c3aed, -90, 30, -280, 160], [0x0ea5e9, 110, -20, -300, 180], [0xdb2777, 20, 60, -260, 120]].forEach(([c, x, y, z, s]) => {
    const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex(`rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},.55)`, 'rgba(0,0,0,0)'), blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set(x, y, z); m.scale.set(s, s, 1); scene.add(m);
  });
  const planet = new T.Mesh(new T.SphereGeometry(40, 48, 32), new T.MeshStandardMaterial({ roughness: 1, fog: false, map: canvasTex(512, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) { const k = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.031) * 0.5; g.fillStyle = `rgb(${190 + k * 40},${110 + k * 50},${70 + k * 30})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,240,220,.12)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 4 + Math.random() * 6, 0, 0, Math.PI * 2); g.fill(); }
  }) }));
  planet.position.set(-95, -45, -230); planet.rotation.z = 0.3;
  scene.add(planet);
  const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,170,110,.5)', 'rgba(255,120,60,0)'), blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  glow.position.copy(planet.position); glow.scale.set(120, 120, 1); scene.add(glow);
  let speed = 18;
  const gauge = $('#ckspeed');
  st.onFrame((dt, t) => {
    const a = sGeo.attributes.position.array;
    for (let i = 0; i < N; i++) { a[i * 3 + 2] += speed * dt; if (a[i * 3 + 2] > 2) a[i * 3 + 2] -= 300; }
    sGeo.attributes.position.needsUpdate = true;
    const b = lGeo.attributes.position.array;
    const len = 2 + speed * 0.25;
    for (let i = 0; i < L; i++) {
      b[i * 6 + 2] += speed * 2 * dt; b[i * 6 + 5] = b[i * 6 + 2] - len;
      if (b[i * 6 + 2] > 2) lineInit(i);
    }
    lGeo.attributes.position.needsUpdate = true;
    planet.rotation.y += dt * 0.02;
    // die Rakete schaukelt ganz leicht
    camera.rotation.z = Math.sin(t * 0.7) * 0.012;
    camera.position.y = Math.sin(t * 1.1) * 0.04;
  });
  // Meteoriten: unregelmässige Felsbrocken, die Zahl steckt mitten im Stein
  const R = 2.2;
  function rockGeo() {
    const g = new T.IcosahedronGeometry(R, 2);
    const pos = g.attributes.position;
    const seed = Math.random() * 10;
    const tmp = new T.Vector3();
    const cache = new Map();
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      const k = `${tmp.x.toFixed(3)},${tmp.y.toFixed(3)},${tmp.z.toFixed(3)}`;
      let f = cache.get(k);
      if (f == null) { f = 1 + 0.16 * Math.sin(tmp.x * 2.2 + seed) * Math.cos(tmp.y * 1.9 + seed) + 0.08 * Math.sin(tmp.z * 3.6 + seed * 2); cache.set(k, f); }
      tmp.multiplyScalar(f);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    g.computeVertexNormals();
    return g;
  }
  const fire = glowTex('rgba(255,170,60,.9)', 'rgba(255,60,20,0)');
  const NUM_ASPECT = 320 / 180;
  function spawnWave() {
    if (game.over || st.disposed) return;
    game.wave.forEach((m) => removeMeteor(m));
    const t = game.picker.next();
    game.task = t; game.recorded = false; game.waveDone = false;
    $('#mtask').innerHTML = taskHTML(t, '<span class="slot">?</span>');
    const n = game.run.ok >= 12 ? 4 : 3;
    const opts = choicesFor(t, n);
    // Zeit bis zum Einschlag: in allen Modi alle 5 richtigen ein Level schneller (10 % weniger Zeit), wie in den anderen Spielen
    const dur = surviveMs(10000, 2200) / 1000;
    if (gauge) gauge.style.setProperty('--spd', String(clamp((12 - dur) / 7, 0, 1)));
    game.wave = opts.map((v, i) => {
      const mesh = new T.Mesh(rockGeo(), new T.MeshStandardMaterial({ color: new T.Color().setHSL(0.07 + Math.random() * 0.04, 0.25, 0.3 + Math.random() * 0.08), roughness: 0.95, flatShading: true, emissive: 0x000000 }));
      const halo = new T.Sprite(new T.SpriteMaterial({ map: fire, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
      halo.scale.set(R * 3.3, R * 3.3, 1); mesh.add(halo); halo.position.z = -1.1;
      const label = new T.Sprite(new T.SpriteMaterial({ map: numCanvasTex(String(v), { fill: '#fff8e8', stroke: '#2a1405', glow: 'rgba(255,140,40,.95)' }), depthTest: false, depthWrite: false, transparent: true }));
      label.renderOrder = 10;
      scene.add(label);
      // weit auseinander starten, damit sich die Zahlen nie überdecken
      const spread = (n === 4 ? 8 : 9.5) * clamp(camera.aspect / 1.6, 0.48, 1);
      const x0 = (i - (n - 1) / 2) * spread + (Math.random() - 0.5) * 1.5;
      const y0 = (i % 2 ? 3.4 : -1.6) + (Math.random() - 0.5) * 1.8;
      const z0 = -48 - Math.random() * 10;
      mesh.position.set(x0, y0, z0);
      mesh.userData = { spin: new T.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.4), x0, y0, z0 };
      mesh.scale.setScalar(0.01);
      st.tween(420, (u, e) => mesh.scale.setScalar(Math.max(0.01, e)), ease.back);
      scene.add(mesh);
      return { mesh, label, val: v, correct: v === t.answer, dead: false, vz: (-z0 - 3) / dur, tint: null };
    });
    t.shownAt = performance.now();
  }
  function removeMeteor(m) {
    m.dead = true;
    scene.remove(m.mesh); scene.remove(m.label);
    m.mesh.geometry.dispose(); m.mesh.material.dispose();
    m.label.material.map.dispose(); m.label.material.dispose();
  }
  const tmpV = new T.Vector3();
  st.onFrame((dt, t) => {
    for (const m of game.wave) {
      if (m.dead) continue;
      const u = m.mesh.userData;
      if (!game.over && !game.waveDone) {
        m.mesh.position.z += m.vz * dt;
        const prog = 1 - (m.mesh.position.z + 3) / (u.z0 + 3);
        m.mesh.position.x = u.x0 * (1 - 0.72 * prog);
        m.mesh.position.y = u.y0 * (1 - 0.72 * prog) - 0.4 * prog;
      }
      m.mesh.rotation.x += u.spin.x * dt; m.mesh.rotation.y += u.spin.y * dt;
      // Zahl: sitzt im Stein, wird mit ihm grösser, ist aber auch von weitem lesbar (mind. 34 Pixel hoch)
      const d = m.mesh.position.length();
      const minH = (40 * 2 * d * Math.tan((camera.fov * Math.PI) / 360)) / st.h;
      const hgt = Math.max(minH, R * 0.95) * m.mesh.scale.x * (m.pulse ? 1 + Math.sin(t * 10) * 0.08 : 1);
      tmpV.copy(m.mesh.position).multiplyScalar(-1).normalize().multiplyScalar(R * 0.4);
      m.label.position.copy(m.mesh.position).add(tmpV);
      m.label.scale.set(hgt * NUM_ASPECT * 1.4, hgt * 1.4, 1);
      if (game.over || game.waveDone) continue;
      if (m.correct && m.mesh.position.z > -3.2) { impact(m); break; }
      if (!m.correct && m.mesh.position.z > -2) removeMeteor(m);
    }
  });
  // Grüne Laser: heller Kern, Leuchten und Schimmer; schiessen von beiden Kanonen kurz nacheinander
  const beamGeo = new T.CylinderGeometry(1, 0.3, 1, 12, 1, true); // an der Kanone schmal, zum Ziel hin breiter
  const flashTex = glowTex('rgba(225,255,225,1)', 'rgba(60,255,120,0)');
  const UP = new T.Vector3(0, 1, 0);
  function laser(to) {
    [-1, 1].forEach((s, k) => setTimeout(() => {
      if (st.disposed) return;
      const from = new T.Vector3(s * 1.3, -0.36 + camera.position.y, -1.2);
      const dir = to.clone().sub(from);
      const len = dir.length();
      const n = dir.normalize();
      const q = new T.Quaternion().setFromUnitVectors(UP, n);
      const parts = [[0.02, 0xf2fff2, 1], [0.07, 0x39ff6a, 0.7], [0.2, 0x22c55e, 0.16]].map(([r, c, op]) => {
        const b = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
        b.quaternion.copy(q); b.userData = { r, op }; b.scale.set(r, 0.001, r); b.position.copy(from);
        scene.add(b);
        return b;
      });
      const spr = (p, sc) => { const x = new T.Sprite(new T.SpriteMaterial({ map: flashTex, color: 0x9dffb0, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); x.position.copy(p); x.scale.setScalar(sc); scene.add(x); return x; };
      const muzzle = spr(from, 0.2), spot = spr(to, 0.01);
      st.tween(110, (u, e) => {
        const l = len * e;
        parts.forEach((b) => { b.scale.y = Math.max(0.001, l); b.position.copy(from).addScaledVector(n, l / 2); });
        muzzle.scale.setScalar(0.2 + e * 0.2);
      }, ease.out).then(() => {
        spot.scale.setScalar(2.4);
        burst(st, to, { n: 26, colors: [0xb6ffc4, 0xffffff, 0x39ff6a], speed: 3.5, life: 0.35, size: 0.22, gravity: 0 });
        return st.tween(280, (u) => {
          parts.forEach((b) => { b.material.opacity = b.userData.op * (1 - u); const r = b.userData.r * (1 - 0.7 * u); b.scale.x = r; b.scale.z = r; });
          muzzle.material.opacity = 1 - u;
          spot.material.opacity = 1 - u; spot.scale.setScalar(2.4 + u * 1.5);
        });
      }).then(() => {
        parts.forEach((b) => { scene.remove(b); b.material.dispose(); });
        [muzzle, spot].forEach((x) => { scene.remove(x); x.material.dispose(); });
      });
    }, k * 70));
    $$('.ck-gun').forEach((g) => { g.classList.toggle('fire', false); void g.offsetWidth; g.classList.add('fire'); });
    sfx.zap();
    tone([1320, 880], 0.05, 'sawtooth', 0.03);
  }
  const shieldFx = (cls, i) => { const el = $$('#lives i')[i]; if (el) { el.classList.toggle(cls, false); void el.offsetWidth; el.classList.add(cls); } };
  /** Falsch: getroffen (crash) oder den falschen Meteoriten angetippt. Survive: ein Schutzschild weniger. */
  function loseLife(word, crash) {
    game.waveDone = true;
    const t = game.task;
    if (crash) {
      sfx.boom(); noise(0.7, { freq: 200, gain: 0.2 });
      st.shake(0.5);
      $('#crack').classList.add('show');
    } else {
      sfx.bad(); noise(0.35, { freq: 260, gain: 0.1 });
      st.shake(0.15);
    }
    host.classList.add('hit');
    bigWord(host, word, 'bad');
    setTimeout(() => { host.classList.toggle('hit', false); $('#crack')?.classList.toggle('show', false); }, 1500);
    if (runWrong(t)) return;
    if (game.run.mode === 'survive') {
      shieldFx('lost', game.run.lives);
      if (game.run.lives === 1) scheduleAlien(2600 + Math.random() * 1500);
    }
    gLater(spawnWave, crash ? 1600 : 1800);
  }
  function hit(m) {
    if (!m || m.dead || !runOn() || game.waveDone) return;
    const t = game.task;
    if (m.correct) {
      if (!game.recorded) recordAnswer(t, m.val, performance.now() - t.shownAt);
      game.recorded = true;
      game.waveDone = true;
      laser(m.mesh.position.clone());
      const p = m.mesh.position.clone();
      setTimeout(() => {
        if (st.disposed) return;
        burst(st, p, { n: 160, colors: [0xffc233, 0xff6b4a, 0xffffff, 0xfff1a6], speed: 9, life: 1.1, size: 0.6, gravity: 0 });
        burst(st, p, { n: 40, colors: [0x8a6f5a, 0x5b4636], speed: 5, life: 1.4, size: 0.35, gravity: 0 });
        const fl = new T.PointLight(0xffaa55, 30, 30); fl.position.copy(p); scene.add(fl);
        st.tween(400, (u) => { fl.intensity = 30 * (1 - u); }).then(() => scene.remove(fl));
        sfx.boom();
        st.shake(0.08);
      }, 120);
      removeMeteor(m);
      game.wave.forEach((x) => { if (!x.dead) { x.dead = true; x.label.material.opacity = 0.3; st.tween(350, (u) => { x.mesh.scale.setScalar(Math.max(0.01, 1 - u)); }).then(() => removeMeteor(x)); } });
      if (runRight()) return;
      speed = Math.min(80, 18 / SURVIVE.factor ** (surviveLevel() - 1)); // Sterne ziehen mit jedem Level schneller vorbei
      bigWord(host, `+1${game.run.streak >= 3 ? `<small>${game.run.streak}er-Serie!</small>` : ''}`, 'good small sky');
      gLater(spawnWave, 800);
    } else {
      // Falsch: kostet einen Schutzschild, der richtige Meteorit leuchtet grün auf, dann kommt die nächste Welle
      if (!game.recorded) { recordAnswer(t, m.val, performance.now() - t.shownAt); game.recorded = true; }
      laser(m.mesh.position.clone());
      m.mesh.material.emissive.set(0xaa1111);
      m.label.material.color.set(0xff7a7a);
      const px = m.mesh.position.x;
      st.tween(450, (k) => { m.mesh.position.x = px + Math.sin(k * 30) * 0.4 * (1 - k); });
      const right = game.wave.find((x) => x.correct && !x.dead);
      if (right) { right.mesh.material.emissive.set(0x1f5a10); right.label.material.color.set(0xb9ffa0); right.pulse = true; }
      loseLife(`Falsch!<small>${esc(taskText(t, true))}</small>`, false);
    }
  }
  function impact(m) {
    const t = game.task;
    if (!game.recorded) { recordAnswer(t, '', performance.now() - t.shownAt); game.recorded = true; }
    removeMeteor(m);
    game.wave.forEach((x) => { if (!x.dead) removeMeteor(x); });
    loseLife(`Treffer!<small>${esc(taskText(t, true))}</small>`, true);
  }

  // ---------- Ufo mit kleinem Alien: kommt nur beim letzten Schutzschild, Treffer = Extraleben ----------
  let alien = null;
  function makeAlien() {
    // Untertasse dreht sich, Kuppel mit dem kleinen grünen Alien schaut immer nach vorn; leicht zum Cockpit geneigt
    const g = new T.Group(), spinner = new T.Group();
    g.add(spinner);
    const metal = new T.MeshStandardMaterial({ color: 0xc7d2e0, metalness: 0.75, roughness: 0.25, emissive: 0x111827 });
    const saucer = new T.Mesh(new T.SphereGeometry(0.62, 28, 14), metal); saucer.scale.set(1, 0.26, 1); spinner.add(saucer);
    const ring = new T.Mesh(new T.TorusGeometry(0.62, 0.05, 8, 32), new T.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 })); ring.rotation.x = Math.PI / 2; spinner.add(ring);
    const lights = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const l = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), new T.MeshBasicMaterial({ color: [0xff4d6d, 0xffd93d, 0x4dd8ff][i % 3] }));
      l.position.set(Math.cos(a) * 0.58, -0.02, Math.sin(a) * 0.58); spinner.add(l); lights.push(l);
    }
    const skin = new T.MeshStandardMaterial({ color: 0x5ee05e, roughness: 0.45, emissive: 0x145214 });
    const head = new T.Mesh(new T.SphereGeometry(0.2, 18, 14), skin); head.scale.set(1.05, 1.1, 0.95); head.position.set(0, 0.27, 0); g.add(head);
    const eyeM = new T.MeshBasicMaterial({ color: 0x0b0b0b });
    const shineM = new T.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach((s) => {
      const eye = new T.Mesh(new T.SphereGeometry(0.065, 12, 10), eyeM); eye.scale.set(1, 1.35, 0.6); eye.position.set(s * 0.085, 0.3, 0.17); eye.rotation.z = s * 0.35; g.add(eye);
      const shine = new T.Mesh(new T.SphereGeometry(0.018, 6, 6), shineM); shine.position.set(s * 0.085 - 0.015, 0.33, 0.21); g.add(shine);
      const ant = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.2, 4), skin); ant.position.set(s * 0.09, 0.52, 0); ant.rotation.z = -s * 0.4; g.add(ant);
      const tip = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), new T.MeshBasicMaterial({ color: 0xfff27a })); tip.position.set(s * 0.13, 0.62, 0); g.add(tip);
    });
    const dome = new T.Mesh(new T.SphereGeometry(0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xb8f0ff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, depthWrite: false }));
    dome.position.y = 0.08; g.add(dome);
    const beam = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(140,255,160,.9)', 'rgba(60,255,120,0)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    beam.position.y = -0.22; beam.scale.set(1.8, 0.9, 1); g.add(beam);
    g.scale.setScalar(1.15);
    g.userData = { lights, spinner };
    return g;
  }
  function alienAlert(html) {
    const el = $('#ckalert');
    if (!el) return;
    el.innerHTML = html;
    el.classList.toggle('show', false); void el.offsetWidth; el.classList.add('show');
  }
  function launchAlien() {
    if (alien || !runOn() || st.disposed) return;
    const g = makeAlien();
    const z = -15 - Math.random() * 5;
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect * -z;
    const side = Math.random() < 0.5 ? -1 : 1;
    alien = { g, t0: st.time, dur: 2300 + Math.random() * 700, z, x0: side * (halfW + 1.5), x1: -side * (halfW + 1.5), y: 0.6 + Math.random() * 3, ph: Math.random() * 6, gone: false };
    g.position.set(alien.x0, alien.y, z);
    scene.add(g);
    if (!game.alienSeen) { game.alienSeen = true; alienAlert('👾 Ein Ufo! Triff es für ein <b>Extraleben</b>'); }
    tone([520, 780, 520, 780, 1040], 0.07, 'sine', 0.05);
  }
  function dropAlien() {
    if (!alien) return;
    scene.remove(alien.g);
    alien.g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    alien = null;
  }
  st.onFrame((dt, t) => {
    if (!alien || alien.gone) return;
    const u = (st.time - alien.t0) / alien.dur;
    if (u >= 1) { dropAlien(); return; }
    const a = alien;
    a.g.position.set(a.x0 + (a.x1 - a.x0) * u + Math.sin(u * Math.PI * 6 + a.ph) * 0.7, a.y + Math.sin(u * Math.PI * 4 + a.ph) * 1.1, a.z + Math.sin(u * Math.PI * 3) * 1.5);
    a.g.userData.spinner.rotation.y += dt * 6;
    a.g.rotation.x = 0.5;
    a.g.rotation.z = Math.cos(u * Math.PI * 4 + a.ph) * 0.3;
    a.g.userData.lights.forEach((l, i) => { l.visible = Math.floor(t * 8 + i) % 2 === 0; });
  });
  function scheduleAlien(ms) {
    clearTimeout(game.alienT);
    game.alienT = gLater(() => {
      if (!runOn() || game.run.mode !== 'survive' || game.run.lives !== 1) return;
      launchAlien();
      scheduleAlien(7000 + Math.random() * 4000);
    }, ms);
  }
  function hitAlien() {
    if (!alien || alien.gone || !runOn()) return;
    const p = alien.g.position.clone();
    alien.gone = true;
    laser(p);
    setTimeout(() => {
      if (st.disposed) return;
      dropAlien();
      burst(st, p, { n: 180, colors: [0x39ff6a, 0xfff27a, 0x4dd8ff, 0xff4d6d, 0xffffff], speed: 7, life: 1.2, size: 0.4, gravity: 0 });
      st.shake(0.06);
    }, 140);
    runGainLife();
    shieldFx('gain', game.run.lives - 1);
    clearTimeout(game.alienT);
    sfx.win();
    tone([660, 880, 1175, 1568], 0.09, 'triangle', 0.08);
    bigWord(host, '+1 Schild!<small>Extraleben</small>', 'good small sky');
  }
  // Antippen: zuerst das Ufo (genau treffen!), sonst der Meteorit, der dem Finger am nächsten ist (grosszügig)
  stageTap(st, (x, y) => {
    if (alien && !alien.gone) {
      const q = st.project(alien.g.position);
      const rad = Math.max(16, screenRadius(st, alien.g.position, 0.7));
      if (q.z < 1 && Math.hypot(q.x - x, q.y - y) <= rad) { hitAlien(); return; }
    }
    if (game.waveDone) return;
    let best = null, bestD = Infinity;
    for (const m of game.wave) {
      if (m.dead) continue;
      const q = st.project(m.mesh.position);
      if (q.z > 1) continue;
      const rad = Math.max(42, screenRadius(st, m.mesh.position, R * 1.25 * m.mesh.scale.x));
      const d = Math.hypot(q.x - x, q.y - y) / rad;
      if (d < 1 && d < bestD) { best = m; bestD = d; }
    }
    if (best) hit(best);
  });
  game.pickVal = (v) => hit(game.wave.find((m) => !m.dead && m.val === Number(v)));
  game.alienPos = () => { if (!alien || alien.gone) return null; const q = st.project(alien.g.position); return { x: q.x, y: q.y, r: Math.max(16, screenRadius(st, alien.g.position, 0.7)) }; };
  game.launchAlien = launchAlien;
  setGameKeys((e) => {
    if (!/^[1-4]$/.test(e.key)) return;
    const live = game.wave.filter((m) => !m.dead).sort((a, b) => a.mesh.position.x - b.mesh.position.x);
    hit(live[+e.key - 1]);
  });
  gLater(spawnWave, 400);
}

/* =========================================================
   🐸 Frosch-Hüpfen 3D – über einen ruhigen Teich, hin und zurück
   ========================================================= */
async function startFrog3D() {
  const T = await loadThree();
  await loadNumFont();
  Object.assign(game, { picker: gamePicker(), tries: 0, locked: true, task: null });
  const run = runStart('frog', { onEnd: () => { game.locked = true; } });
  $('#view').innerHTML = gameShell('frog', `
    <div class="g3 g3-pond" id="g3">
      <div class="g3-hud top"><div class="pond-board"><span class="pb-task" id="ftask"></span>${runHudHTML('in-board')}</div></div>
      ${run.mode === 'survive' ? '<div class="g3-clock" id="fclock"><i></i></div>' : ''}
    </div>
    <p class="mode-hint">Tippe auf die Seerose mit dem richtigen Ergebnis – der Frosch springt. Tasten 1–3 gehen auch.</p>`);
  const host = $('#g3');
  const st = createStage(host, { fov: 55, clear: 0xbfe3f2 });
  game.stage3d = st;
  const { scene, camera } = st;
  scene.fog = new T.Fog(0xd3e9ef, 26, 80);
  scene.add(new T.HemisphereLight(0xeaf6ff, 0x3d5a2a, 1.2));
  const sunL = new T.DirectionalLight(0xfff1d6, 2.1); sunL.position.set(9, 18, 14); scene.add(sunL);

  // ---------- Himmel, Sonne, Wolken ----------
  const sky = new T.Mesh(new T.SphereGeometry(160, 32, 16), new T.MeshBasicMaterial({ side: T.BackSide, fog: false, map: canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4f9be0'); gr.addColorStop(0.38, '#9fd0f2'); gr.addColorStop(0.5, '#e6f3f6'); gr.addColorStop(1, '#e6f3f6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }) }));
  scene.add(sky);
  const sunS = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,248,215,1)', 'rgba(255,230,170,0)'), blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  sunS.position.set(45, 34, -110); sunS.scale.set(34, 34, 1); scene.add(sunS);
  const cloudTex = canvasTex(256, 128, (g) => {
    g.fillStyle = '#fff';
    [[70, 80, 40], [115, 62, 50], [165, 76, 42], [200, 88, 30], [40, 92, 26], [130, 92, 46]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  });
  for (let i = 0; i < 12; i++) {
    const c = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
    c.position.set(Math.cos(a) * 110, 22 + Math.random() * 12, -10 + Math.sin(a) * 110);
    const s = 16 + Math.random() * 14; c.scale.set(s, s / 2, 1);
    scene.add(c);
  }

  // ---------- Der Teich: abgeschlossen, mit Ufer ringsum ----------
  const P = { cx: 0, cz: -9.6, rx: 8.4, rz: 12.4 }; // Ufer vorne bei z = 2.8, drüben bei z = -22
  const edgeX = (z, m = 0) => { const q = (z - P.cz) / P.rz; return q * q >= 1 ? 0 : Math.max(0, P.rx * Math.sqrt(1 - q * q) - m); };
  const inPond = (x, z, m = 0) => Math.abs(x) <= edgeX(z, m) && edgeX(z, m) > 0;
  const WATER_Y = -0.06;
  // Teichgrund (durch das leicht durchsichtige Wasser zu ahnen)
  const bottom = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshStandardMaterial({ color: 0x3b4a2c, roughness: 1 }));
  bottom.rotation.x = -Math.PI / 2; bottom.scale.set(P.rx + 1, P.rz + 1, 1); bottom.position.set(0, -0.62, P.cz);
  scene.add(bottom);
  // Wasser: fast still, nur ein ganz leichtes Kräuseln
  const water = new T.Mesh(new T.PlaneGeometry(64, 64, 80, 80), new T.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uFogColor: { value: new T.Color(0xd3e9ef) }, uCam: { value: new T.Vector3() } },
    vertexShader: `uniform float uTime; varying vec3 vW; varying float vH;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0);
        float h = sin(w.x*0.6+uTime*0.35)*0.004 + sin(w.z*0.8-uTime*0.3)*0.003;
        w.y += h; vW = w.xyz; vH = h; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uFogColor; uniform vec3 uCam; varying vec3 vW; varying float vH;
      void main(){ vec3 deep = vec3(0.08,0.24,0.21); vec3 shallow = vec3(0.19,0.38,0.33);
        float d = length(vW.xz - uCam.xz);
        vec3 c = mix(shallow, deep, clamp(d/24.0,0.0,1.0)) + vH*6.0;
        float spark = pow(max(0.0, sin(vW.x*2.1+uTime*0.5)*sin(vW.z*1.9-uTime*0.4)), 60.0);
        c += vec3(1.0,0.97,0.88)*spark*0.18;
        vec3 view = normalize(uCam - vW); float fres = pow(1.0 - clamp(view.y, 0.0, 1.0), 3.0);
        c = mix(c, vec3(0.74,0.86,0.9), fres*0.6);
        float f = smoothstep(28.0, 80.0, d);
        float a = mix(0.66, 0.96, clamp(d/16.0, 0.0, 1.0));
        gl_FragColor = vec4(mix(c, uFogColor, f), a); }`,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, P.cz);
  water.renderOrder = 1;
  scene.add(water);
  st.onFrame((dt, t) => { water.material.uniforms.uTime.value = t; water.material.uniforms.uCam.value.copy(camera.position); });
  // Ufer: Ring um den Teich, innen schlammig/sandig, aussen Wiese und sanfte Hügel
  const bankY = (d, n = 0) => (d <= 0 ? -0.36 + (d + 0.9) * 0.24 : -0.15 + 0.55 * (1 - Math.exp(-d / 0.9)) + (d > 5 ? (d - 5) * 0.06 : 0) + n * 0.14 * Math.min(1, d / 3));
  const bankNoise = (a) => Math.sin(a * 7 + 1.3) * 0.5 + Math.sin(a * 13 + 0.7) * 0.3 + Math.sin(a * 3) * 0.4;
  /** Bodenhöhe am Ufer an der Stelle (x, z) */
  const groundY = (x, z) => {
    const qx = x / P.rx, qz = (z - P.cz) / P.rz, rho = Math.hypot(qx, qz);
    return bankY((rho - 1) * Math.min(P.rz, P.rx * 1.45), bankNoise(Math.atan2(qz, qx)));
  };
  {
    const DS = [-0.9, 0, 0.3, 0.7, 1.2, 1.9, 2.8, 4, 5.5, 7.5, 10, 14, 19, 26, 36];
    const SEG = 180;
    const pos = [], col = [], uv = [], idx = [];
    const cMud = new T.Color(0x5f5438), cSand = new T.Color(0x9a8a5e), cGrass = new T.Color(0x67a548), cGrass2 = new T.Color(0x4f8f37), cDark = new T.Color(0x3e7a2c);
    for (let j = 0; j < DS.length; j++) {
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2, d = DS[j], n = bankNoise(a);
        const x = P.cx + (P.rx + d) * Math.cos(a), z = P.cz + (P.rz + d) * Math.sin(a);
        pos.push(x, bankY(d, n), z);
        uv.push(x / 2.5, z / 2.5);
        const c = d < 0.3 ? cMud.clone().lerp(cSand, clamp((d + 0.9) / 1.2, 0, 1)) : d < 1.3 ? cSand.clone().lerp(cGrass, (d - 0.3) / 1.0) : cGrass.clone().lerp(n > 0 ? cGrass2 : cDark, Math.min(1, Math.abs(n)) * 0.7);
        col.push(c.r, c.g, c.b);
      }
    }
    const W = SEG + 1;
    for (let j = 0; j < DS.length - 1; j++) for (let i = 0; i < SEG; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, b, c, b, d, c); // Vorderseite nach oben
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const grassTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { const v = 170 + Math.random() * 85; g.fillStyle = `rgba(${v},${v},${v},.55)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3 + Math.random() * 3); }
    }, { repeat: [1, 1] });
    scene.add(new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, map: grassTex, roughness: 1 })));
  }
  // Bäume, Büsche und Steine am Ufer – nicht dort, wo der Frosch an Land geht und die Kamera steht
  const NEAR_Z = P.cz + P.rz, FAR_Z = P.cz - P.rz;
  const camZone = (x, z, w) => Math.abs(x) < w && ((z > NEAR_Z - 1 && z < NEAR_Z + 5) || (z < FAR_Z + 1 && z > FAR_Z - 5));
  const leafMats = [0x2f6b3a, 0x3a7d3f, 0x4a8c3a].map((c) => new T.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  const trunkMat = new T.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
  const stoneMat = new T.MeshStandardMaterial({ color: 0x8b8f87, roughness: 0.95, flatShading: true });
  const ringPos = (a, d) => ({ x: P.cx + (P.rx + d) * Math.cos(a), z: P.cz + (P.rz + d) * Math.sin(a), y: bankY(d, bankNoise(a)) });
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, d = 2.6 + Math.random() * 15;
    const p = ringPos(a, d);
    if (camZone(p.x, p.z, 6.5)) continue;
    const tr = new T.Group();
    const h = 2.6 + Math.random() * 3.6;
    if (Math.random() < 0.55) {
      for (let k = 0; k < 3; k++) { const c = new T.Mesh(new T.ConeGeometry((1.3 - k * 0.3) * (h / 4), h * 0.5, 8), leafMats[k % 3]); c.position.y = h * (0.35 + k * 0.2); tr.add(c); }
    } else {
      const crown = new T.Mesh(new T.IcosahedronGeometry(h * 0.33, 1), leafMats[rand(3)]); crown.position.y = h * 0.72; crown.scale.y = 0.85; tr.add(crown);
    }
    const tk = new T.Mesh(new T.CylinderGeometry(0.1, 0.16, h * 0.45, 6), trunkMat); tk.position.y = h * 0.22; tr.add(tk);
    tr.position.set(p.x, p.y - 0.05, p.z); tr.rotation.y = Math.random() * 6;
    scene.add(tr);
  }
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = 0.9 + Math.random() * 2.2;
    const p = ringPos(a, d);
    if (camZone(p.x, p.z, 4.5)) continue;
    const b = new T.Mesh(new T.IcosahedronGeometry(0.35 + Math.random() * 0.35, 0), leafMats[rand(3)]);
    b.position.set(p.x, p.y + 0.15, p.z); b.scale.y = 0.7; scene.add(b);
  }
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, d = -0.2 + Math.random() * 1.4;
    const p = ringPos(a, d);
    if (camZone(p.x, p.z, 3.5)) continue;
    const s = new T.Mesh(new T.DodecahedronGeometry(0.18 + Math.random() * 0.3, 0), stoneMat);
    s.position.set(p.x, p.y + 0.05, p.z); s.scale.y = 0.6; s.rotation.set(Math.random(), Math.random() * 6, 0); scene.add(s);
  }
  // Schilf und Rohrkolben im seichten Wasser am Rand – wiegen sich nur ganz leicht
  const reedMat = new T.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 1 });
  const catMat = new T.MeshStandardMaterial({ color: 0x6b3f1f, roughness: 1 });
  const reeds = new T.Group(); scene.add(reeds);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, d = -0.6 + Math.random() * 0.8;
    const p = ringPos(a, d);
    if (Math.abs(p.x) < 3.6 && (p.z > NEAR_Z - 3 || p.z < FAR_Z + 3)) continue; // Start und Ziel frei
    for (let k = 0; k < 7; k++) {
      const g = new T.Group();
      const h = 0.8 + Math.random() * 1.0;
      const s1 = new T.Mesh(new T.CylinderGeometry(0.012, 0.022, h, 5), reedMat); s1.position.y = h / 2; g.add(s1);
      if (Math.random() < 0.45) { const c = new T.Mesh(new T.CapsuleGeometry(0.04, 0.2, 3, 6), catMat); c.position.y = h - 0.04; g.add(c); }
      g.position.set(p.x + (Math.random() - 0.5) * 1.1, WATER_Y - 0.05, p.z + (Math.random() - 0.5) * 1.1);
      g.userData.ph = Math.random() * 6;
      reeds.add(g);
    }
  }
  st.onFrame((dt, t) => reeds.children.forEach((g) => { g.rotation.z = Math.sin(t * 0.55 + g.userData.ph) * 0.018; g.rotation.x = Math.cos(t * 0.45 + g.userData.ph) * 0.012; }));

  // ---------- Seerosen ----------
  const padTex = canvasTex(256, 256, (g) => {
    const r = g.createRadialGradient(128, 128, 8, 128, 128, 128); r.addColorStop(0, '#93d66a'); r.addColorStop(0.75, '#4c9f38'); r.addColorStop(1, '#3a842b');
    g.fillStyle = r; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(38,100,30,.5)'; g.lineWidth = 2.5;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(128, 128); g.quadraticCurveTo(128 + Math.cos(a + 0.15) * 60, 128 + Math.sin(a + 0.15) * 60, 128 + Math.cos(a) * 122, 128 + Math.sin(a) * 122); g.stroke(); }
  });
  const padMat = new T.MeshStandardMaterial({ map: padTex, roughness: 0.55, side: T.DoubleSide });
  const rimMat = new T.MeshStandardMaterial({ color: 0x2f7d26, roughness: 0.6 });
  const petalMats = [0xffb6d5, 0xffffff].map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  const seedMat = new T.MeshStandardMaterial({ color: 0xffd34d });
  function makePad(rad = 0.7, flower = false) {
    const g = new T.Group();
    const m = new T.Mesh(new T.CircleGeometry(rad, 40, 0.25, Math.PI * 2 - 0.5), padMat);
    m.rotation.x = -Math.PI / 2; g.add(m);
    const rim = new T.Mesh(new T.TorusGeometry(rad, 0.022, 6, 40, Math.PI * 2 - 0.5), rimMat);
    rim.rotation.x = -Math.PI / 2; rim.rotation.z = 0.25; g.add(rim);
    if (flower) {
      const f = new T.Group(), pm = petalMats[rand(2)];
      for (let i = 0; i < 8; i++) { const p = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), pm); p.scale.set(0.6, 0.35, 1.6); const a = (i / 8) * Math.PI * 2; p.position.set(Math.cos(a) * 0.09, 0.09, Math.sin(a) * 0.09); p.rotation.y = -a; p.rotation.x = 0.6; f.add(p); }
      const c = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), seedMat); c.position.y = 0.11; f.add(c);
      f.position.set(-rad * 0.5, 0, -rad * 0.3); g.add(f);
    }
    g.rotation.y = Math.random() * 6;
    g.userData = { ph: Math.random() * 6, baseY: 0.0, dip: 0, bob: true };
    scene.add(g);
    return g;
  }
  // Auf dem Teich liegen nur die Seerosen mit Zahlen (keine Schmuck-Seerosen, die würden verwirren)
  st.onFrame((dt, t) => scene.children.forEach((o) => { const u = o.userData; if (u?.bob) { u.dip *= Math.pow(0.03, dt); o.position.y = u.baseY + Math.sin(t * 0.8 + u.ph) * 0.004 - u.dip; } }));
  // Wellenringe
  function ripple(p, n = 2, r0 = 0.5) {
    for (let i = 0; i < n; i++) {
      const ring = new T.Mesh(new T.RingGeometry(r0, r0 + 0.035, 48), new T.MeshBasicMaterial({ color: 0xe8f6f2, transparent: true, opacity: 0.2, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, WATER_Y + 0.02, p.z);
      ring.renderOrder = 2;
      scene.add(ring);
      setTimeout(() => { if (st.disposed) return; st.tween(1600, (u) => { ring.scale.setScalar(1 + u * 1.3); ring.material.opacity = 0.2 * (1 - u); }, ease.out).then(() => { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); }); }, i * 260);
    }
  }
  const splash = (p, n = 40) => burst(st, new T.Vector3(p.x, WATER_Y + 0.08, p.z), { n, colors: [0xffffff, 0xd8f0f3], speed: 1.8, life: 0.7, size: 0.07, gravity: -6 });

  // ---------- Ab und zu schwimmt gemächlich ein Fisch vorbei (unter Wasser, kein Springen) ----------
  const fishTex = canvasTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3c4526'); gr.addColorStop(0.45, '#8f7a3a'); gr.addColorStop(0.75, '#c9a85a'); gr.addColorStop(1, '#e8dcb5');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,35,15,.35)'; g.lineWidth = 2;
    for (let x = 10; x < w; x += 14) for (let y = 20; y < h * 0.8; y += 12) { g.beginPath(); g.arc(x + ((y / 12) % 2) * 7, y, 6, 0.2, Math.PI - 0.2); g.stroke(); } // Schuppen
  });
  const fishMat = new T.MeshStandardMaterial({ map: fishTex, roughness: 0.5, metalness: 0.15, transparent: true });
  const finMat = new T.MeshStandardMaterial({ color: 0x7a6a3a, roughness: 0.6, transparent: true, opacity: 0.85, side: T.DoubleSide });
  function makeFish() {
    const f = new T.Group();
    const body = new T.Mesh(new T.SphereGeometry(0.1, 20, 14), fishMat); body.scale.set(0.62, 0.85, 2.7); f.add(body);
    const tailShape = new T.Shape(); tailShape.moveTo(0, 0); tailShape.quadraticCurveTo(0.07, 0.1, 0.16, 0.13); tailShape.quadraticCurveTo(0.1, 0, 0.16, -0.13); tailShape.quadraticCurveTo(0.07, -0.1, 0, 0);
    const tail = new T.Mesh(new T.ShapeGeometry(tailShape), finMat); tail.rotation.y = -Math.PI / 2; tail.position.z = 0.25; f.add(tail);
    const dorsal = new T.Mesh(new T.ShapeGeometry(new T.Shape([new T.Vector2(0, 0), new T.Vector2(0.14, 0), new T.Vector2(0.03, 0.07)])), finMat); dorsal.rotation.y = -Math.PI / 2; dorsal.position.set(0, 0.07, 0.02); f.add(dorsal);
    f.userData.tail = tail;
    f.scale.setScalar(1.3);
    return f;
  }
  const fishes = [];
  function spawnFish() {
    if (st.disposed) return;
    if (fishes.length < 2) {
      const fwd = -Math.cos(heading), z = frog.position.z + fwd * (2.5 + Math.random() * 5);
      const ex = edgeX(z, 1.4);
      if (ex > 1) {
        const f = makeFish();
        const x = (Math.random() * 2 - 1) * Math.min(ex, 3.5);
        f.position.set(x, WATER_Y - 0.4, z);
        f.userData = { ...f.userData, dir: Math.random() * Math.PI * 2, sp: 0.22 + Math.random() * 0.12, turn: (Math.random() - 0.5) * 0.25, age: 0, life: 9 + Math.random() * 5 };
        f.traverse((o) => { if (o.material) o.material = o.material.clone(); });
        scene.add(f); fishes.push(f);
      }
    }
    gLater(spawnFish, 14000 + Math.random() * 10000);
  }
  st.onFrame((dt, t) => {
    for (const f of [...fishes]) {
      const u = f.userData;
      u.age += dt;
      u.dir += u.turn * dt + Math.sin(t * 0.4 + u.sp * 20) * dt * 0.15;
      const nx = f.position.x + Math.cos(u.dir) * u.sp * dt, nz = f.position.z + Math.sin(u.dir) * u.sp * dt;
      if (!inPond(nx, nz, 1.2)) u.dir += Math.PI * 0.6 * dt * 2; else { f.position.x = nx; f.position.z = nz; }
      f.rotation.y = -u.dir - Math.PI / 2;
      u.tail.rotation.x = Math.sin(t * 5 + u.sp * 9) * 0.35;
      // langsam auftauchen und wieder in die Tiefe gleiten
      const k = Math.min(1, u.age / 2.5, (u.life - u.age) / 2.5);
      f.position.y = WATER_Y - 0.42 + 0.32 * Math.max(0, k);
      f.traverse((o) => { if (o.material) o.material.opacity = Math.max(0, k) * (o.material === undefined ? 1 : 1); });
      if (u.age >= u.life) {
        scene.remove(f); fishes.splice(fishes.indexOf(f), 1);
        f.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      }
    }
  });

  // ---------- Ab und zu eine Fliege oder eine Libelle – gemächlich ----------
  const flyMat = new T.MeshBasicMaterial({ color: 0x1b1b1b });
  const wingMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false });
  let fly = null;
  function spawnFly() {
    if (st.disposed) return;
    if (!fly) {
      const g = new T.Group();
      g.add(new T.Mesh(new T.SphereGeometry(0.022, 8, 6), flyMat));
      const w1 = new T.Mesh(new T.PlaneGeometry(0.05, 0.025), wingMat), w2 = w1.clone();
      w1.position.set(0.025, 0.012, 0); w2.position.set(-0.025, 0.012, 0); g.add(w1, w2);
      const fwd = -Math.cos(heading);
      fly = { g, w1, w2, c: new T.Vector3(frog.position.x + (Math.random() - 0.5) * 2.5, 0.7 + Math.random() * 0.4, frog.position.z + fwd * (1.5 + Math.random() * 2)), age: 0, life: 7 + Math.random() * 4, a: 0.5 + Math.random() * 0.4, b: 0.7 + Math.random() * 0.4 };
      scene.add(g);
    }
    gLater(spawnFly, 13000 + Math.random() * 9000);
  }
  const dfly = new T.Group();
  {
    const dm = new T.MeshStandardMaterial({ color: 0x1fa3b8, metalness: 0.5, roughness: 0.3 });
    const b = new T.Mesh(new T.CylinderGeometry(0.018, 0.012, 0.36, 6), dm); b.rotation.x = Math.PI / 2; dfly.add(b);
    const hd = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), dm); hd.position.z = -0.2; dfly.add(hd);
    const dw = new T.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.45, side: T.DoubleSide, depthWrite: false });
    dfly.userData.wings = [-1, 1].flatMap((s) => [-0.09, -0.03].map((z) => { const w = new T.Mesh(new T.PlaneGeometry(0.24, 0.045), dw); w.position.set(s * 0.13, 0.01, z); w.rotation.x = -Math.PI / 2; dfly.add(w); return w; }));
    dfly.visible = false;
    scene.add(dfly);
  }
  let dragon = null;
  function spawnDragonfly() {
    if (st.disposed) return;
    if (!dragon) {
      const fwd = -Math.cos(heading), side = Math.random() < 0.5 ? -1 : 1;
      const pts = [0, 1, 2].map((i) => new T.Vector3(frog.position.x + (Math.random() - 0.5) * 4, 0.6 + Math.random() * 0.6, frog.position.z + fwd * (2 + i * 1.2 + Math.random())));
      const from = new T.Vector3(frog.position.x + side * 7, 1.2, frog.position.z + fwd * 3), to = new T.Vector3(frog.position.x - side * 7, 1.6, frog.position.z + fwd * 5);
      dragon = { path: [from, ...pts, to], i: 0, wait: 0 };
      dfly.position.copy(from); dfly.visible = true;
    }
    gLater(spawnDragonfly, 22000 + Math.random() * 12000);
  }
  st.onFrame((dt, t) => {
    if (fly) {
      fly.age += dt;
      const k = fly.age > fly.life ? (fly.age - fly.life) : 0;
      fly.g.position.set(fly.c.x + Math.sin(t * fly.a * 2) * 0.45 + k * 2, fly.c.y + Math.sin(t * fly.b * 2.4) * 0.1 + k * 1.2, fly.c.z + Math.cos(t * fly.a * 1.6) * 0.45);
      const s = Math.abs(Math.sin(t * 90)); fly.w1.scale.y = s; fly.w2.scale.y = s;
      if (k > 3) { scene.remove(fly.g); fly.g.traverse((o) => o.geometry?.dispose()); fly = null; }
    }
    if (dragon) {
      const target = dragon.path[dragon.i];
      if (dragon.wait > 0) dragon.wait -= dt;
      else {
        const prev = dfly.position.clone();
        dfly.position.lerp(target, 1 - Math.exp(-dt * 1.1));
        const mv = dfly.position.clone().sub(prev);
        if (mv.lengthSq() > 1e-7) dfly.rotation.y = Math.atan2(-mv.x, -mv.z);
        if (dfly.position.distanceTo(target) < 0.08) {
          dragon.i++; dragon.wait = 0.8 + Math.random() * 1.2;
          if (dragon.i >= dragon.path.length) { dragon = null; dfly.visible = false; }
        }
      }
      dfly.position.y += Math.sin(t * 6) * 0.0015;
    }
    if (dfly.visible) dfly.userData.wings.forEach((w, i) => { w.rotation.y = Math.sin(t * 60 + i) * 0.3; });
  });

  // ---------- Der Frosch (von hinten zu sehen) ----------
  const frog = new T.Group();
  const legs = [];
  {
    const skin = new T.MeshStandardMaterial({ color: 0x4caf3f, roughness: 0.42 });
    const dark = new T.MeshStandardMaterial({ color: 0x2f7d2a, roughness: 0.5 });
    const light = new T.MeshStandardMaterial({ color: 0xc8eb8a, roughness: 0.6 });
    const eyeM = new T.MeshStandardMaterial({ color: 0xf2d75a, roughness: 0.25 });
    const pupM = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const body = new T.Mesh(new T.SphereGeometry(0.3, 28, 20), skin); body.scale.set(1.05, 0.7, 1.25); body.position.set(0, 0.25, 0.04); body.rotation.x = 0.28; frog.add(body);
    const bel = new T.Mesh(new T.SphereGeometry(0.26, 20, 14), light); bel.scale.set(0.95, 0.55, 1.05); bel.position.set(0, 0.17, -0.06); frog.add(bel);
    const head = new T.Mesh(new T.SphereGeometry(0.24, 24, 18), skin); head.scale.set(1.12, 0.72, 1.0); head.position.set(0, 0.37, -0.3); frog.add(head);
    [-1, 1].forEach((s) => {
      const bulge = new T.Mesh(new T.SphereGeometry(0.088, 16, 12), skin); bulge.position.set(s * 0.14, 0.47, -0.34); frog.add(bulge);
      const eye = new T.Mesh(new T.SphereGeometry(0.068, 16, 12), eyeM); eye.position.set(s * 0.15, 0.49, -0.38); frog.add(eye);
      const pup = new T.Mesh(new T.SphereGeometry(0.034, 10, 8), pupM); pup.scale.set(1.4, 0.8, 1); pup.position.set(s * 0.155, 0.5, -0.435); frog.add(pup);
      const leg = new T.Group(); leg.position.set(s * 0.2, 0.2, 0.2);
      const thigh = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), skin); thigh.scale.set(0.95, 0.85, 2.0); thigh.position.set(s * 0.06, -0.02, -0.06); thigh.rotation.y = s * 0.35; leg.add(thigh);
      const shin = new T.Mesh(new T.CapsuleGeometry(0.055, 0.28, 4, 10), skin); shin.rotation.x = Math.PI / 2; shin.rotation.y = s * -0.2; shin.position.set(s * 0.12, -0.11, -0.02); leg.add(shin);
      const foot = new T.Mesh(new T.SphereGeometry(0.09, 12, 8), dark); foot.scale.set(1.3, 0.25, 1.6); foot.position.set(s * 0.15, -0.17, 0.14); leg.add(foot);
      frog.add(leg); legs.push(leg);
      const arm = new T.Mesh(new T.CapsuleGeometry(0.04, 0.16, 4, 8), skin); arm.position.set(s * 0.17, 0.1, -0.38); arm.rotation.z = s * 0.25; frog.add(arm);
      const hand = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), dark); hand.scale.set(1.3, 0.3, 1.3); hand.position.set(s * 0.2, 0.02, -0.42); frog.add(hand);
    });
    for (let i = 0; i < 6; i++) {
      const sp = new T.Mesh(new T.SphereGeometry(0.04 + Math.random() * 0.03, 10, 6), dark);
      sp.scale.y = 0.3; sp.position.set((Math.random() - 0.5) * 0.36, 0.43 - Math.random() * 0.05, 0.12 - Math.random() * 0.34); frog.add(sp);
    }
    frog.scale.setScalar(1.05);
  }
  scene.add(frog);
  // Steine an Land: Start und Ziel jeder Überquerung
  const STONE_D = 0.8; // so weit hinter dem Wasserrand
  const shoreZ = (dir) => (dir < 0 ? FAR_Z - STONE_D : NEAR_Z + STONE_D);
  function makeStone(x, z, r = 0.5) {
    const s = new T.Mesh(new T.DodecahedronGeometry(r, 1), stoneMat);
    s.scale.set(1, 0.42, 0.9); s.rotation.y = Math.random() * 6;
    const y = groundY(x, z);
    s.position.set(x, y + r * 0.18, z);
    s.userData.top = y + r * 0.18 + r * 0.4;
    scene.add(s);
    return s;
  }
  // Auf jeder Uferseite liegen immer genau drei Steine (links, Mitte, rechts) – es kommen keine neuen dazu
  const STONE_GAP = 1.85 - 0.35 * clamp((1.25 - camera.aspect) / 0.65, 0, 1);
  const shoreStones = { [1]: [], [-1]: [] };
  [1, -1].forEach((side) => { for (let i = 0; i < 3; i++) shoreStones[side].push(makeStone((i - 1) * STONE_GAP, shoreZ(side) + side * (Math.random() * 0.15), i === 1 && side === 1 ? 0.55 : 0.5)); });
  let home = shoreStones[1][1]; // Start: mittlerer Stein am vorderen Ufer
  frog.position.set(home.position.x, home.userData.top, home.position.z);

  // ---------- Richtung, Kamera ----------
  let heading = 0; // 0: Blick nach −z (hinüber), π: zurück
  let dirZ = -1;
  let crossStartZ = frog.position.z, jumpNo = 0;
  const JUMPS = 10;
  const CAM_OFF = new T.Vector3(0, 1.6, 2.4);
  const portrait = () => clamp((1.25 - camera.aspect) / 0.65, 0, 1);
  let lastFit = -1;
  const fitView = () => {
    const f = portrait();
    if (Math.abs(f - lastFit) < 0.01) return;
    lastFit = f;
    camera.fov = 55 + 16 * f; camera.updateProjectionMatrix();
    CAM_OFF.set(0, 1.6 + 0.6 * f, 2.4 + 1.3 * f);
  };
  fitView();
  st.onFrame(fitView);
  const lookAt = new T.Vector3(), camGoal = new T.Vector3(), lookGoal = new T.Vector3();
  const setGoals = () => {
    camGoal.set(frog.position.x + Math.sin(heading) * CAM_OFF.z, Math.max(frog.position.y + 1.4, CAM_OFF.y + Math.max(0, frog.position.y)), frog.position.z + Math.cos(heading) * CAM_OFF.z);
    lookGoal.set(frog.position.x - Math.sin(heading) * 3.1, 0.05, frog.position.z - Math.cos(heading) * 3.1);
  };
  setGoals(); camera.position.copy(camGoal); lookAt.copy(lookGoal); camera.lookAt(lookAt);
  st.onFrame((dt) => {
    setGoals();
    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(camGoal, k);
    lookAt.lerp(lookGoal, k);
    camera.lookAt(lookAt);
  });
  let idle = true;
  st.onFrame((dt, t) => { if (!idle) return; const b = 1 + Math.sin(t * 2.2) * 0.022; frog.scale.set(1.05 * b, 1.05 / b, 1.05 * b); });
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------- Zahlen auf den Seerosen und Steinen ----------
  const NUM_H = 0.8, NUM_AR = 320 / 180;
  function padNumber(v) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: numCanvasTex(String(v), { fill: '#ffffff', stroke: '#123d1c', size: 136, line: 0.2 }), transparent: true, depthWrite: false }));
    s.center.set(0.5, 0.14);
    s.scale.set(NUM_H * NUM_AR, NUM_H, 1);
    s.renderOrder = 5;
    scene.add(s);
    return s;
  }
  let choices = [];
  st.onFrame((dt, t) => choices.forEach((c) => {
    c.label.position.set(c.obj.position.x, c.stone ? c.obj.userData.top : c.obj.position.y + 0.03, c.obj.position.z);
    if (c.hint) { const k = 1 + Math.sin(t * 9) * 0.07; c.label.scale.set(NUM_H * NUM_AR * k, NUM_H * k, 1); }
  }));
  const freeLabel = (c) => { scene.remove(c.label); c.label.material.map.dispose(); c.label.material.dispose(); };
  function dropChoice(c, sink = true) {
    choices = choices.filter((x) => x !== c);
    if (c.stone) { // Stein bleibt liegen, nur die Zahl verschwindet
      st.tween(500, (u) => { c.label.material.opacity = 1 - u; }).then(() => freeLabel(c));
      if (sink) { const x0 = c.obj.position.x; st.tween(400, (u) => { c.obj.position.x = x0 + Math.sin(u * 30) * 0.05 * (1 - u); }); }
      return;
    }
    const y0 = c.obj.position.y;
    c.obj.userData.bob = false;
    st.tween(sink ? 700 : 400, (u) => { c.obj.position.y = y0 - u * 0.4; c.obj.rotation.z = u * 0.4; c.label.material.opacity = 1 - u; })
      .then(() => { scene.remove(c.obj); freeLabel(c); });
  }
  function clearChoices() { [...choices].forEach((c) => dropChoice(c, false)); }
  function step() {
    if (!runOn() || st.disposed) return;
    const t = game.picker.next();
    game.task = { ...t, shownAt: performance.now() };
    game.tries = 0;
    $('#ftask').innerHTML = taskHTML(t, '<span class="slot">?</span>');
    const vals = choicesFor(t, 3);
    const last = jumpNo === JUMPS - 1;
    const zEnd = shoreZ(dirZ);
    const zBase = last ? zEnd : crossStartZ + ((zEnd - crossStartZ) * (jumpNo + 1)) / JUMPS;
    const f = portrait(), gap = 1.85 - 0.35 * f;
    const bound = last ? 3.2 : edgeX(zBase, 1.0);
    const cx = clamp(frog.position.x, -Math.max(0, bound - gap), Math.max(0, bound - gap));
    choices = vals.map((v, i) => {
      const x = cx + (i - 1) * gap + (Math.random() - 0.5) * 0.2;
      const label = padNumber(v);
      label.material.opacity = 0;
      if (last) { // letztes Ziel: die drei Steine am Ufer (immer dieselben), die Zahlen erscheinen darauf
        const s = shoreStones[dirZ][i];
        st.tween(520, (u) => { label.material.opacity = clamp(u * 1.6 - 0.3, 0, 1); });
        return { obj: s, stone: true, label, val: v };
      }
      const z = zBase + dirZ * (Math.random() * 0.3 + (i === 1 ? 0.2 : 0)) * 0.5;
      const pad = makePad(0.68 - 0.06 * f + Math.random() * 0.05, Math.random() < 0.22);
      pad.position.set(x, -0.35, z);
      pad.userData.bob = false;
      pad.scale.setScalar(0.4);
      st.tween(520, (u, e) => { pad.position.y = -0.35 * (1 - e); pad.scale.setScalar(0.4 + 0.6 * e); label.material.opacity = clamp(u * 1.6 - 0.3, 0, 1); }, ease.back)
        .then(() => { pad.userData.bob = true; });
      ripple(new T.Vector3(x, 0, z), 1, 0.6);
      return { obj: pad, stone: false, label, val: v };
    });
    game.locked = false;
    if (game.run.mode === 'survive') taskClock($('#fclock i'), surviveMs(8000, 2200), timeout);
  }
  function timeout() {
    if (game.locked || !runOn()) return;
    game.locked = true;
    const t = game.task;
    if (game.tries === 0) recordAnswer(t, '', performance.now() - t.shownAt);
    sfx.bad();
    bigWord(host, `Zu spät!<small>${esc(taskText(t, true))}</small>`, 'bad');
    const right = choices.find((c) => c.val === t.answer);
    if (right) { right.hint = true; right.label.material.color.set(0xd9ffb8); }
    if (runWrong(t)) return;
    gLater(() => { clearChoices(); step(); }, 1300);
  }
  async function jumpTo(target, { height = 0.95, ms = 640 } = {}) {
    idle = false;
    const p0 = frog.position.clone();
    const yaw0 = frog.rotation.y, far = Math.hypot(target.x - p0.x, target.z - p0.z) > 0.05;
    const yaw1 = far ? heading + wrapA(Math.atan2(-(target.x - p0.x), -(target.z - p0.z)) - heading) : yaw0;
    await st.tween(140, (u) => { frog.scale.set(1.05 * (1 + 0.1 * u), 1.05 * (1 - 0.2 * u), 1.05 * (1 + 0.06 * u)); frog.rotation.y = yaw0 + (yaw1 - yaw0) * u; legs.forEach((l) => { l.rotation.x = 0.15 * u; }); });
    sfx.jump();
    await st.tween(ms, (u, e) => {
      frog.position.lerpVectors(p0, target, e);
      frog.position.y = p0.y + (target.y - p0.y) * e + Math.sin(u * Math.PI) * height;
      const s = Math.sin(u * Math.PI);
      frog.scale.set(1.05 * (1 - 0.06 * s), 1.05 * (1 + 0.12 * s), 1.05 * (1 + 0.14 * s));
      frog.rotation.x = -0.35 * Math.sin(Math.min(1, u * 1.5) * Math.PI) + (u > 0.6 ? 0.25 * (u - 0.6) / 0.4 : 0);
      const ext = u < 0.25 ? u / 0.25 : u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      legs.forEach((l) => { l.rotation.x = -1.35 * ext; });
    }, (x) => x);
    frog.rotation.x = 0;
    await st.tween(170, (u) => { const s = 1 - u; frog.scale.set(1.05 * (1 + 0.12 * s), 1.05 * (1 - 0.22 * s), 1.05 * (1 + 0.08 * s)); legs.forEach((l) => { l.rotation.x = 0.15 * s; }); });
    st.tween(450, (u, e) => { frog.rotation.y = yaw1 + (heading - yaw1) * e; });
    idle = true;
  }
  async function pick(c) {
    if (game.locked || !c || !choices.includes(c) || !runOn()) return;
    const t = game.task;
    const first = game.tries === 0;
    game.tries++;
    if (first) recordAnswer(t, c.val, performance.now() - t.shownAt);
    if (c.val !== t.answer) {
      sfx.splash(); noise(0.5, { freq: 700, gain: 0.07, sweep: -500 });
      c.label.material.color.set(0xff8a8a);
      if (!c.stone) { splash(c.obj.position, 50); ripple(c.obj.position, 2, 0.6); }
      dropChoice(c);
      const y0 = frog.rotation.y; // Frosch schüttelt den Kopf
      st.tween(420, (u) => { frog.rotation.y = y0 + Math.sin(u * Math.PI * 4) * 0.18 * (1 - u); });
      // falsch: zählt (Survive: jedes Mal ein Leben, sonst nur der erste Versuch)
      if ((first || game.run.mode === 'survive') && runWrong(t)) return;
      if (choices.length === 1) choices[0].hint = true;
      return;
    }
    taskClockStop($('#fclock i'));
    game.locked = true;
    const ended = first ? runRight() : false;
    choices.filter((x) => x !== c).forEach((x) => dropChoice(x, false));
    c.label.material.color.set(0xd9ffb8);
    const target = c.stone ? new T.Vector3(c.obj.position.x, c.obj.userData.top, c.obj.position.z) : new T.Vector3(c.obj.position.x, 0.02, c.obj.position.z);
    await jumpTo(target, c.stone ? { height: 1.05, ms: 700 } : {});
    if (st.disposed) return;
    if (c.stone) { st.shake(0.03); burst(st, target.clone(), { n: 24, colors: [0xcfc6a8, 0x9a8a5e], speed: 1.4, life: 0.6, size: 0.06, gravity: -5 }); }
    else { c.obj.userData.dip = 0.05; splash(target, 26); ripple(target, 2, 0.7); sfx.splash(); }
    // die alte Seerose versinkt langsam (Steine bleiben liegen), die Zahl verschwindet
    const old = home;
    if (old && !old.userData.top) { old.userData.bob = false; const y0 = old.position.y; st.tween(1400, (u) => { old.position.y = y0 - u * 0.3; }).then(() => scene.remove(old)); }
    home = c.obj;
    choices = choices.filter((x) => x !== c);
    st.tween(300, (u) => { c.label.material.opacity = 1 - u; }).then(() => freeLabel(c));
    if (ended || !runOn()) return;
    jumpNo++;
    if (jumpNo >= JUMPS) {
      // am Ufer angekommen: kurz freuen, umdrehen und zurück
      tone([196, 147], 0.16, 'square', 0.05); // Quaken
      burst(st, frog.position.clone().add(new T.Vector3(0, 0.7, 0)), { n: 70, colors: [0xfff6b0, 0xffc233, 0x9be36f, 0x38bdf8], speed: 2.2, life: 1.2, size: 0.09, gravity: 0.4 });
      bigWord(host, 'Ufer erreicht!<small>Und zurück …</small>', 'good small');
      dirZ *= -1; jumpNo = 0; crossStartZ = frog.position.z;
      const h0 = heading, h1 = heading + Math.PI;
      await st.tween(900, (u, e) => { heading = h0 + (h1 - h0) * e; frog.rotation.y = heading; });
      heading = wrapA(h1); frog.rotation.y = heading;
      if (st.disposed || !runOn()) return;
    }
    step();
  }
  // Antippen: die Seerose / der Stein (oder die Zahl), die dem Finger am nächsten ist
  stageTap(st, (x, y) => {
    if (game.locked) return;
    let best = null, bestD = Infinity;
    for (const c of choices) {
      const q1 = st.project(c.obj.position), q2 = st.project(c.label.position.clone().add(new T.Vector3(0, NUM_H * 0.35, 0)));
      const rad = Math.max(46, screenRadius(st, c.obj.position, 0.85));
      const d = Math.min(Math.hypot(q1.x - x, q1.y - y), Math.hypot(q2.x - x, q2.y - y)) / rad;
      if (d < 1 && d < bestD) { best = c; bestD = d; }
    }
    if (best) pick(best);
  });
  game.pickVal = (v) => pick(choices.find((c) => c.val === Number(v)));
  game.frogFx = { spawnFish, spawnFly, spawnDragonfly, fishes, frog };
  game.frogInfo = () => ({ jumpNo, dirZ, heading, z: frog.position.z, stones: choices.some((c) => c.stone), vals: choices.map((c) => c.val) });
  setGameKeys((e) => {
    if (!/^[1-3]$/.test(e.key)) return;
    const s = [...choices].sort((a, b) => (a.obj.position.x - b.obj.position.x) * (heading > 1 ? -1 : 1));
    pick(s[+e.key - 1]);
  });
  gLater(spawnFish, 5000);
  gLater(spawnFly, 8000);
  gLater(spawnDragonfly, 15000);
  gLater(step, 350);
}
