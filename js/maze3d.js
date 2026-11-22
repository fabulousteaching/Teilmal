/* Teilmal – Rechen-Labyrinth in 3D (wird erst beim Spielen geladen)
 *
 * Ein grosser Heckengarten auf einem Raster, jedes Mal neu erzeugt. Der Weg zum Schatz windet sich hindurch; an Kreuzungen
 * stehen drei magische Tore, über jedem eine Antwort-Blase. Hinter JEDEM Tor geht ein echter Gang weiter – nur das richtige
 * Tor führt zur Schatzkiste (eine Lichtsäule über den Hecken zeigt, wo sie ungefähr liegt; am Ziel geht der Deckel auf,
 * Münzen springen heraus, und Kinder mit Login bekommen 1 echte Münze für den Avatar-Shop). Breite Gänge mit Fallen:
 * Löcher im Boden (eine Rechnung lösen, dann kommen Bretter), Falltüren (klappen auf, man fällt hinein und startet am
 * letzten sicheren Ort). In Sackgassen: Belohnungen (Speed ⚡ Turbo, Sanduhr ⏳ +5 s, Survive ❤️ +1 Leben)
 * oder Deko (Brunnen, Spiegelkugel, Bank, Blumentöpfe, Pilze).
 * Modi: Speed (10 Tore, Zeit zählt; falsches Tor +3 s, Falle +2 s), Countdown = Sanduhr (60 s, richtiges Tor +8 s,
 * falsches −5 s, Falle −4 s; wie weit kommst du?), Survive (3 Leben; Fallen und falsche Tore kosten je eines).
 * Kinder, die im Training schon sicher rechnen, haben an den Toren einen Zeitbalken (12 / 10 / 8,5 s).
 * Kamera auf Augenhöhe hinter dem (verkleinerten) Avatar; Karte oben rechts mit allem, was man schon gesehen hat.
 * Steuerung: Pfeiltasten/WASD (vor, zurück, drehen) oder Joystick (hoch = gehen, seitlich = drehen).
 */
'use strict';

const MZ3 = {
  C: 4.3, T: 0.55, H: 3.3, DOOR: 2.3, DH: 2.5, SPEED: 4.4, TURN: 2.5, R: 0.32, PENALTY: 3000, GAP: 5.5,
  TIME_GATE: 8000, TIME_PICK: 5000, TRAP_TIME: 4000, TRAP_SPEED: 2000,
  speed: { N: 15, G: 10, traps: 9, picks: 4 }, countdown: { N: 19, G: 20, traps: 12, picks: 7 }, survive: { N: 21, G: 24, traps: 18, picks: 3 },
};
const MZ3_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, O, S, W (Raster: x, z)

/** Glas-Blase mit Text (wie die Antwort-Blasen im Welten-Lauf) */
function mz3Bubble(T, text, accent = '#a78bfa') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 220;
  const g = c.getContext('2d'), w = 512, h = 220, r = 92;
  const rr = (x, y, ww, hh, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + ww, y, x + ww, y + hh, rad); g.arcTo(x + ww, y + hh, x, y + hh, rad); g.arcTo(x, y + hh, x, y, rad); g.arcTo(x, y, x + ww, y, rad); g.closePath(); };
  g.save(); g.shadowColor = accent; g.shadowBlur = 26; g.fillStyle = 'rgba(15,23,42,.9)'; rr(14, 14, w - 28, h - 28, r); g.fill(); g.restore();
  const gr = g.createLinearGradient(0, 14, 0, h - 14); gr.addColorStop(0, 'rgba(76,64,196,.97)'); gr.addColorStop(1, 'rgba(15,23,42,.95)');
  g.fillStyle = gr; rr(14, 14, w - 28, h - 28, r); g.fill();
  g.lineWidth = 7; g.strokeStyle = accent; rr(17, 17, w - 34, h - 34, r - 3); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 120; const f = (s) => `900 ${s}px "Bricolage Grotesque", Lexend, system-ui, sans-serif`; g.font = f(fs);
  while (g.measureText(String(text)).width > w - 100 && fs > 40) { fs -= 6; g.font = f(fs); }
  g.fillText(String(text), w / 2, h / 2 + 4);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function mz3CanvasTex(T, w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8;
  return t;
}

/**
 * Labyrinth erzeugen: zuerst ein vollständiges Labyrinth, dessen längster Weg vom Start der Weg zum Schatz wird.
 * Dann bleibt nur dieser Weg; an G Kreuzungen gehen je zwei Seitentore ab, hinter denen eigene Gang-Bäume wachsen
 * (nur durch das Tor erreichbar). Übrige Felder werden zu Sackgassen am Weg – oder bleiben Hecke.
 */
function mz3Maze(N, G) {
  const idx = (x, z) => z * N + x, X = (i) => i % N, Z = (i) => Math.floor(i / N);
  const nb = (i) => MZ3_DIRS.map(([dx, dz], d) => ({ d, x: X(i) + dx, z: Z(i) + dz })).filter((o) => o.x >= 0 && o.z >= 0 && o.x < N && o.z < N).map((o) => ({ d: o.d, j: idx(o.x, o.z) }));
  const pick = (opts, lastD) => opts.find((q) => q.d === lastD && Math.random() < 0.45) || opts[Math.floor(Math.random() * opts.length)];
  const start = idx(N >> 1, N - 1);
  const Lp = Math.round(G * MZ3.GAP + 6);
  let best = null;
  for (let tries = 0; tries < 90; tries++) {
    // 1) vollständiges Labyrinth (Backtracker, gern ein Stück geradeaus)
    const adj = Array.from({ length: N * N }, () => []);
    const seen = new Uint8Array(N * N); seen[start] = 1;
    const st = [[start, 0]];
    while (st.length) {
      const [cur, lastD] = st[st.length - 1];
      const opts = nb(cur).filter((o) => !seen[o.j]);
      if (!opts.length) { st.pop(); continue; }
      const o = pick(opts, lastD);
      adj[cur].push(o.j); adj[o.j].push(cur); seen[o.j] = 1; st.push([o.j, o.d]);
    }
    // 2) längster Weg vom Start (gekürzt auf die gewünschte Länge)
    const par = new Int32Array(N * N).fill(-1), dist = new Int32Array(N * N).fill(-1); dist[start] = 0;
    const q = [start]; let far = start;
    for (let h = 0; h < q.length; h++) { const c = q[h]; if (dist[c] > dist[far]) far = c; for (const j of adj[c]) if (dist[j] < 0) { dist[j] = dist[c] + 1; par[j] = c; q.push(j); } }
    let P = []; for (let c = far; c >= 0; c = par[c]) P.push(c);
    P = P.reverse().slice(0, Lp);
    if (P.length < 12) continue;
    const onP = new Int32Array(N * N).fill(-1); P.forEach((c, i) => { onP[c] = i; });
    const links = new Set(); const lk = (a, b) => links.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    for (let i = 0; i + 1 < P.length; i++) lk(P[i], P[i + 1]);
    const dirTo = (a, b) => nb(a).find((o) => o.j === b).d;
    // 3) Kreuzungen: Wegfelder mit zwei freien Seiten, möglichst gleichmässig verteilt (mind. 3 Felder Abstand)
    const cand = [];
    for (let i = 3; i < P.length - 2; i++) {
      const c = P[i], inD = dirTo(c, P[i - 1]), fwD = dirTo(c, P[i + 1]);
      const sides = nb(c).filter((o) => o.d !== inD && o.d !== fwD && onP[o.j] < 0);
      if (sides.length === 2) cand.push({ i, c, inD, fwD, sides });
    }
    const gs = [], used = new Uint8Array(N * N), span = (P.length - 5) / G;
    let prev = 0;
    for (let k = 0; k < G; k++) {
      const target = 3 + span * (k + 0.5);
      const ok = cand.filter((x) => x.i >= prev + 3 && x.sides.every((o) => !used[o.j]));
      if (!ok.length) break;
      ok.sort((a, b) => Math.abs(a.i - target) - Math.abs(b.i - target));
      const g = ok[0];
      g.sides.forEach((o) => { used[o.j] = 1; });
      gs.push(g); prev = g.i;
    }
    // 4) hinter jedem Seitentor wächst ein eigener Gang-Baum (abwechselnd, damit alle Platz bekommen)
    const vis = new Uint8Array(N * N); P.forEach((c) => { vis[c] = 1; });
    const stacks = [];
    gs.forEach((g) => g.sides.forEach((o) => { vis[o.j] = 1; lk(g.c, o.j); stacks.push({ s: [[o.j, o.d]], n: 1 }); }));
    for (let grew = true; grew;) {
      grew = false;
      for (const r of stacks) {
        while (r.s.length) {
          const [cur, lastD] = r.s[r.s.length - 1];
          const opts = nb(cur).filter((o) => !vis[o.j]);
          if (!opts.length) { r.s.pop(); continue; }
          const o = pick(opts, lastD);
          vis[o.j] = 1; lk(cur, o.j); r.s.push([o.j, o.d]); r.n++; grew = true;
          break;
        }
      }
    }
    // 5) übrige Felder: Sackgassen am Weg (nicht an Kreuzungen, Start oder Schatz)
    const junction = new Set(gs.map((g) => g.c));
    for (let c = 0; c < N * N; c++) {
      if (vis[c]) continue;
      const att = nb(c).find((o) => onP[o.j] > 0 && onP[o.j] < P.length - 1 && !junction.has(o.j));
      if (!att) continue;
      vis[c] = 1; lk(att.j, c);
      const s = [[c, (att.d + 2) % 4]];
      while (s.length) {
        const [cur, lastD] = s[s.length - 1];
        const opts = nb(cur).filter((o) => !vis[o.j]);
        if (!opts.length) { s.pop(); continue; }
        const o = pick(opts, lastD);
        vis[o.j] = 1; lk(cur, o.j); s.push([o.j, o.d]);
      }
    }
    // Bewertung: möglichst alle Tore, kein Tor mit nur einem Feld dahinter
    const tiny = stacks.filter((r) => r.n < 2).length;
    const score = gs.length * 10 - tiny * 4;
    if (!best || score > best.score) best = { score, res: { N, P, gates: gs, links, idx, X, Z } };
    if (gs.length === G && tiny === 0) break;
  }
  return best && best.res.gates.length ? best.res : null;
}

async function startMaze3D() {
  const T = await w3Three();
  await w3LoadEngine();
  if (typeof rnBuilder !== 'function') await w3LoadRunner(); // Voxel-Baukasten für die Schatzkiste
  const mode = gameModeOf('maze');
  const cfg = MZ3[mode] || MZ3.speed;
  const M = mz3Maze(cfg.N, cfg.G);
  if (!M) throw new Error('Labyrinth konnte nicht gebaut werden');
  const { N, P, gates: GS, links, idx, X, Z } = M;
  const GN = GS.length, C = MZ3.C, TK = MZ3.T, H = MZ3.H, WIN = C - TK; // WIN: lichte Weite eines Gangs
  // Zeitbalken an den Toren nur für Kinder, die im Training schon sicher rechnen
  let GATE_MS = 0;
  try { const sk = runnerSkill(); GATE_MS = [0, 0, 0, 12000, 10000, 8500][sk.stage] || 0; } catch { /* */ }
  Object.assign(game, { picker: gamePicker(), over: false });
  const run = runStart('maze', { goal: GN });
  runPause(true);
  const modeText = { speed: `${GN} Tore bis zum Schatz – so schnell wie möglich. Falsches Tor +3 s, Falle +2 s. ⚡ in Sackgassen = Turbo.`,
    countdown: `Sanduhr: 60 Sekunden zum Start, jedes richtige Tor +8 s, ⏳ in Sackgassen +5 s. Falsches Tor −5 s, Falle −4 s. Schaffst du es bis zum Schatz?`,
    survive: `3 Leben: Ins Loch fallen, Falltüren und falsche Tore kosten ein Leben. Vor einem Loch im Boden: rechnen, dann kommen Bretter. ❤️ in Sackgassen gibt eines zurück.` }[mode];
  $('#view').innerHTML = gameShell('maze', `
    <div class="mz3" id="mz3">
      <div class="mz3-top">${runHudHTML('rn-hud')}</div>
      <canvas class="mz3-map" id="mz3map" width="240" height="240" aria-hidden="true"></canvas>
      <div class="mz3-ask" id="mz3ask" hidden><small id="mz3hint">Geh durch das Tor mit dem richtigen Ergebnis</small><div class="mz3-q" id="mz3q"></div><span class="mz3-n" id="mz3n"></span><div class="mz3-clock" id="mz3clock" ${GATE_MS ? '' : 'hidden'}><i></i></div></div>
      <div class="mz3-pop" id="mz3pop"></div>
      <div class="mz3-pit" id="mz3pit" hidden><small>Hier fehlt der Boden! Rechne – dann taucht er wieder auf.</small><div class="mz3-q" id="mz3pq"></div><div class="mz3-pans" id="mz3pans"></div></div>
      <div class="mz3-flash" id="mz3flash"></div>
      <div class="g2-joy" id="mz3joy" aria-label="Joystick"><i></i></div>
      <div class="mz3-help" id="mz3help"><span><b>↑</b> gehen</span><span><b>← →</b> drehen</span><span><b>↓</b> zurück</span><small>Pfeiltasten oder Joystick · ⚠️ Achtung Fallen!</small></div>
    </div>
    <p class="mode-hint">${modeText}${GATE_MS ? ` An den Toren läuft ein Zeitbalken (${GATE_MS / 1000} s) – du rechnest schon sicher!` : ''}</p>`);
  const host = $('#mz3');
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'mz3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const fogCol = new T.Color('#cfe8f5');
  scene.fog = new T.Fog(fogCol, 12, 44);
  const camera = new T.PerspectiveCamera(70, 1, 0.08, 400);
  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.fov = camera.aspect < 0.8 ? 80 : 68; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  scene.add(new T.HemisphereLight(0xfffaf0, 0x4f7f34, 1.4));
  const sun = new T.DirectionalLight(0xffeccc, 2.1);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const own = [], keep = (...x) => { own.push(...x); return x[0]; };
  const cnv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const ctex = (c, rep) => { const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 8; return t; };

  /* ---------- Himmel ---------- */
  const skyTex = ctex(cnv(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5aa7ef'); gr.addColorStop(0.55, '#9fd2f7'); gr.addColorStop(0.75, '#cfe8f5'); gr.addColorStop(1, '#cfe8f5'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  const skyDome = new T.Mesh(keep(new T.SphereGeometry(300, 24, 16)), keep(new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false })));
  scene.add(skyDome);
  const cloudTex = ctex(cnv(256, 128, (g) => { g.fillStyle = '#fff'; for (const [x, y, r] of [[70, 80, 40], [120, 60, 50], [175, 78, 38], [140, 92, 34], [95, 95, 30]]) { const gr = g.createRadialGradient(x, y, r * 0.3, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }));
  const cloudMat = keep(new T.SpriteMaterial({ map: cloudTex, transparent: true, fog: false, depthWrite: false }));
  const MID = (N - 1) / 2 * C;
  for (let i = 0; i < 14; i++) { const s = new T.Sprite(cloudMat); const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 80; s.position.set(MID + Math.cos(a) * r, 28 + Math.random() * 22, MID + Math.sin(a) * r); s.scale.set(40, 20, 1); scene.add(s); }

  /* ---------- Materialien ---------- */
  const hedgeTex = ctex(cnv(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3f8a35'); gr.addColorStop(1, '#24521c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1900; i++) {
      const y = Math.random() * h, lt = 1 - y / h;
      g.fillStyle = `hsl(${105 + Math.random() * 18}, ${45 + Math.random() * 15}%, ${18 + lt * 18 + Math.random() * 12}%)`;
      g.beginPath(); g.ellipse(Math.random() * w, y, 3 + Math.random() * 6, 2 + Math.random() * 4, Math.random() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(200,240,140,.35)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h * 0.6, 2.5, 1.5, Math.random() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 22; i++) { g.fillStyle = ['#fde047', '#f9a8d4', '#ffffff', '#c4b5fd'][i % 4]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.4, 0, 7); g.fill(); }
  }), [2, 1.5]);
  const gravelTex = ctex(cnv(256, 256, (g, w, h) => {
    g.fillStyle = '#d9c9a3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const s = 170 + Math.random() * 60; g.fillStyle = `rgb(${s},${s - 12},${s - 38})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 1.6, 0, 7); g.fill(); }
    for (let i = 0; i < 6; i++) { const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 10; g.fillStyle = 'rgba(160,150,135,.55)'; g.beginPath(); g.ellipse(x, y, r, r * 0.75, Math.random() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x - 2, y - 2, r * 0.7, r * 0.45, 0, 0, 7); g.fill(); }
  }), [N * 2.2, N * 2.2]);
  const grassTex = ctex(cnv(256, 256, (g, w, h) => { g.fillStyle = '#6fb24a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2400; i++) { g.fillStyle = ['#5fa03c', '#7cc057', '#68ab44'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } }), [80, 80]);
  const hedgeMat = keep(new T.MeshStandardMaterial({ map: hedgeTex, roughness: 0.95 }));
  const topMat = keep(new T.MeshStandardMaterial({ color: 0x5aa845, roughness: 1 }));
  const pathMat = keep(new T.MeshStandardMaterial({ map: gravelTex, roughness: 0.95 }));
  const ground = new T.Mesh(keep(new T.PlaneGeometry(600, 600)), keep(new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.position.set(MID, -0.01, MID); ground.receiveShadow = true; scene.add(ground);
  const floor = new T.Mesh(keep(new T.PlaneGeometry(N * C, N * C)), pathMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(MID, 0.01, MID); floor.receiveShadow = true; scene.add(floor);
  const veilTex = ctex(cnv(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(167,139,250,.97)'); gr.addColorStop(0.5, 'rgba(56,189,248,.94)'); gr.addColorStop(1, 'rgba(167,139,250,.97)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.45})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, 7); g.fill(); }
  }));
  const boxGeo = keep(new T.BoxGeometry(1, 1, 1));
  const qTex = keep(mz3Bubble(T, '?'));

  /* ---------- Raster, Wände ---------- */
  const cx = (i) => X(i) * C, cz = (i) => Z(i) * C;
  const pk = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const open = (a, b) => links.has(pk(a, b));
  const dirsOf = (c) => MZ3_DIRS.map(([dx, dz], d) => ({ d, x: X(c) + dx, z: Z(c) + dz })).filter((o) => o.x >= 0 && o.z >= 0 && o.x < N && o.z < N && open(c, idx(o.x, o.z))).map((o) => o.d);
  const exitAt = new Map();
  const exits = [];
  GS.forEach((g, k) => {
    g.k = k;
    g.exits = [{ d: g.fwD, j: P[g.i + 1], ok: true }, ...g.sides.map((o) => ({ d: o.d, j: o.j, ok: false }))];
    g.exits.forEach((e) => { e.g = g; exitAt.set(pk(g.c, e.j), e); exits.push(e); });
  });
  const boxes = [], walls = [], solids = [];
  const box = (x, z, w, d, h = H, y = h / 2, solid = true) => { boxes.push({ x, y, z, w, h, d }); if (solid) walls.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); };
  function wall(x, z, horiz, door) {
    const L = C + TK;
    if (!door) { if (horiz) box(x, z, L, TK); else box(x, z, TK, L); return; }
    const side = (L - MZ3.DOOR) / 2, off = MZ3.DOOR / 2 + side / 2;
    if (horiz) { box(x - off, z, side, TK); box(x + off, z, side, TK); box(x, z, MZ3.DOOR, TK, H - MZ3.DH, MZ3.DH + (H - MZ3.DH) / 2, false); }
    else { box(x, z - off, TK, side); box(x, z + off, TK, side); box(x, z, TK, MZ3.DOOR, H - MZ3.DH, MZ3.DH + (H - MZ3.DH) / 2, false); }
  }
  // Wand-Existenz zwischen Feldern (für Säulen und Blumen)
  const wallE = (x, z) => x < 0 || x >= N - 1 || !open(idx(x, z), idx(x + 1, z)); // senkrechte Wand rechts von (x, z)
  const wallS = (x, z) => z < 0 || z >= N - 1 || !open(idx(x, z), idx(x, z + 1)); // waagrechte Wand unter (x, z)
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const c = idx(x, z);
    if (z === 0) wall(x * C, -0.5 * C, true, false);
    if (x === 0) wall(-0.5 * C, z * C, false, false);
    if (x === N - 1 || !open(c, idx(x + 1, z))) wall((x + 0.5) * C, z * C, false, false);
    else if (exitAt.has(pk(c, idx(x + 1, z)))) wall((x + 0.5) * C, z * C, false, true);
    if (z === N - 1 || !open(c, idx(x, z + 1))) wall(x * C, (z + 0.5) * C, true, false);
    else if (exitAt.has(pk(c, idx(x, z + 1)))) wall(x * C, (z + 0.5) * C, true, true);
  }
  const mtx = new T.Matrix4(), qI = new T.Quaternion(), v1 = new T.Vector3(), v2 = new T.Vector3(), col = new T.Color(), eul = new T.Euler();
  const inst = (geo, mat, list, shadow = true) => {
    const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((b, i) => { m.setMatrixAt(i, mtx.compose(v1.set(b.x, b.y, b.z), b.q || qI, v2.set(b.sx ?? b.w ?? 1, b.sy ?? b.h ?? 1, b.sz ?? b.d ?? 1))); if (b.c != null) m.setColorAt(i, col.set(b.c)); });
    m.count = list.length; m.castShadow = shadow; m.receiveShadow = true; scene.add(m); own.push(m); return m;
  };
  inst(boxGeo, hedgeMat, boxes);
  inst(boxGeo, topMat, boxes.map((b) => ({ x: b.x, y: b.y + b.h / 2 + 0.05, z: b.z, w: b.w + 0.1, h: 0.12, d: b.d + 0.1 })), false);
  // Säulen aus Hecke mit Formschnitt-Kugeln an Kreuzungen der Wände
  const posts = [], balls = [];
  for (let z = -1; z < N; z++) for (let x = -1; x < N; x++) {
    const px = (x + 0.5) * C, pz = (z + 0.5) * C;
    const hl = x >= 0 && (z < 0 || z >= N - 1 || wallS(x, z)), hr = x + 1 < N && (z < 0 || z >= N - 1 || wallS(x + 1, z));
    const vu = z >= 0 && (x < 0 || x >= N - 1 || wallE(x, z)), vd = z + 1 < N && (x < 0 || x >= N - 1 || wallE(x, z + 1));
    const n = hl + hr + vu + vd;
    if (!n || (n === 2 && ((hl && hr) || (vu && vd)))) continue;
    posts.push({ x: px, y: (H + 0.3) / 2, z: pz, w: TK + 0.32, h: H + 0.3, d: TK + 0.32 });
    if (n >= 3 || n === 1) balls.push({ x: px, y: H + 0.62, z: pz, sx: 0.5, sy: 0.5, sz: 0.5 });
  }
  inst(boxGeo, hedgeMat, posts);
  inst(keep(new T.SphereGeometry(1, 12, 9)), keep(new T.MeshStandardMaterial({ color: 0x4c9a3c, roughness: 0.9, flatShading: true })), balls);
  // Rasenkante und Blumen am Fuss der Hecken
  const strips = [], flowers = [];
  const FCOL = ['#f472b6', '#fde047', '#ffffff', '#a78bfa', '#fb923c', '#f87171', '#60a5fa'];
  for (let c = 0; c < N * N; c++) {
    if (!dirsOf(c).length) continue;
    const ds = dirsOf(c);
    for (let d = 0; d < 4; d++) {
      if (ds.includes(d)) continue;
      const [dx, dz] = MZ3_DIRS[d], f = C / 2 - TK / 2 - 0.2;
      const x0 = cx(c) + dx * f, z0 = cz(c) + dz * f;
      strips.push({ x: x0, y: 0.03, z: z0, w: dx ? 0.42 : WIN, h: 0.05, d: dx ? WIN : 0.42 });
      const k = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < k; i++) {
        const t = (Math.random() - 0.5) * (WIN - 0.5), s = 0.07 + Math.random() * 0.06;
        flowers.push({ x: x0 + (dx ? (Math.random() - 0.5) * 0.18 : t), y: 0.16 + Math.random() * 0.12, z: z0 + (dz ? (Math.random() - 0.5) * 0.18 : t), sx: s, sy: s, sz: s, c: g2Pick(FCOL) });
      }
    }
  }
  inst(boxGeo, keep(new T.MeshStandardMaterial({ color: 0x5da13f, roughness: 1 })), strips, false);
  inst(keep(new T.IcosahedronGeometry(1, 0)), keep(new T.MeshStandardMaterial({ roughness: 0.7, emissive: 0x222222 })), flowers, false);

  /* ---------- Tore mit Laternen ---------- */
  exits.forEach((e) => {
    const g = e.g, [dx, dz] = MZ3_DIRS[e.d];
    e.p = new T.Vector3(cx(g.c) + dx * C / 2, 0, cz(g.c) + dz * C / 2);
    e.dx = dx; e.dz = dz;
    const yaw = Math.atan2(-dx, -dz);
    const veilMat = keep(new T.MeshBasicMaterial({ map: veilTex, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
    e.veil = new T.Mesh(keep(new T.PlaneGeometry(MZ3.DOOR, MZ3.DH)), veilMat);
    e.veil.position.set(e.p.x, MZ3.DH / 2, e.p.z); e.veil.rotation.y = yaw; scene.add(e.veil);
    const bubMat = keep(new T.MeshBasicMaterial({ map: qTex, transparent: true, depthWrite: false }));
    e.bub = new T.Mesh(keep(new T.PlaneGeometry(1.7, 0.72)), bubMat);
    e.by = MZ3.DH + (H - MZ3.DH) / 2 + 0.08;
    e.bub.position.set(e.p.x - dx * (TK / 2 + 0.06), e.by, e.p.z - dz * (TK / 2 + 0.06)); e.bub.rotation.y = yaw; e.bub.renderOrder = 5; scene.add(e.bub);
    e.state = 'idle';
    e.box = dx ? { x0: e.p.x - 0.15, x1: e.p.x + 0.15, z0: e.p.z - MZ3.DOOR / 2, z1: e.p.z + MZ3.DOOR / 2 } : { x0: e.p.x - MZ3.DOOR / 2, x1: e.p.x + MZ3.DOOR / 2, z0: e.p.z - 0.15, z1: e.p.z + 0.15 };
  });
  {
    const lp = [], lh = [];
    GS.forEach((g) => { for (const [sx, sz] of [[-1, -1], [1, 1]]) { const x = cx(g.c) + sx * (WIN / 2 - 0.3), z = cz(g.c) + sz * (WIN / 2 - 0.3); lp.push({ x, y: 0.9, z, sx: 1, sy: 1, sz: 1 }); lh.push({ x, y: 1.9, z, w: 0.3, h: 0.36, d: 0.3 }); } });
    inst(keep(new T.CylinderGeometry(0.05, 0.08, 1.8, 8)), keep(new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.5 })), lp);
    inst(boxGeo, keep(new T.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffb84d, emissiveIntensity: 1.3 })), lh, false);
    inst(keep(new T.ConeGeometry(0.28, 0.22, 4)), keep(new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.5 })), lh.map((b) => ({ x: b.x, y: b.y + 0.29, z: b.z, sx: 1, sy: 1, sz: 1, q: new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 4) })), false);
  }

  /* ---------- Fallen ---------- */
  const trapAt = new Map(), traps = [];
  const junction = new Set(GS.map((g) => g.c));
  const noTrap = new Set([P[0], P[1], P[2], P[P.length - 1], P[P.length - 2]]);
  GS.forEach((g) => { noTrap.add(P[g.i - 1]); noTrap.add(P[g.i + 1]); g.sides.forEach((o) => noTrap.add(o.j)); });
  const straight = (c) => { const ds = dirsOf(c); return ds.length === 2 && (ds[0] + 2) % 4 === ds[1] ? (ds[0] % 2 ? 'x' : 'z') : null; };
  const near = (c) => [...trapAt.keys()].some((t) => Math.abs(X(t) - X(c)) + Math.abs(Z(t) - Z(c)) <= 2);
  const kinds = ['pit', 'door'];
  // vor allem auf dem Weg zum Schatz, ein paar auch in Nebengängen
  const onPath = P.map((c, i) => ({ c, i })).filter(({ c, i }) => i > 2 && !junction.has(c) && !noTrap.has(c) && straight(c));
  shuffle(onPath);
  const wantP = Math.round(cfg.traps * 0.75);
  for (const { c } of onPath) { if (traps.length >= wantP) break; if (!near(c)) addTrap(c); }
  const others = [];
  for (let c = 0; c < N * N; c++) if (!P.includes(c) && !junction.has(c) && !noTrap.has(c) && straight(c)) others.push(c);
  shuffle(others);
  for (const c of others) { if (traps.length >= cfg.traps) break; if (!near(c)) addTrap(c); }
  function addTrap(c) {
    const ax = straight(c), kind = kinds[traps.length % kinds.length];
    const tr = { c, kind, ax, x: cx(c), z: cz(c), ph: Math.random() * 3, g: new T.Group() };
    tr.g.position.set(tr.x, 0, tr.z); if (ax === 'z') tr.g.rotation.y = Math.PI / 2; // lokal: «entlang» = x
    scene.add(tr.g); trapAt.set(c, tr); traps.push(tr);
  }
  // gemeinsame Teile
  const metal = keep(new T.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.4, metalness: 0.7 }));
  const woodTex = ctex(cnv(128, 128, (g, w, h) => { g.fillStyle = '#8b5a2b'; g.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#7a4d24' : '#94612f'; g.fillRect(0, i * 21, w, 20); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * 21 + 20, w, 2); } g.fillStyle = '#374151'; g.fillRect(10, 0, 8, h); g.fillRect(w - 18, 0, 8, h); }));
  const pitTex = ctex(cnv(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 8, 64, 64, 80); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#3b2f22'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  const DOOR_L = 2.3;
  const pitMat = keep(new T.MeshBasicMaterial({ map: pitTex })), rimMat = keep(new T.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 })), plankMat = keep(new T.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }));
  const qSprite = keep(new T.SpriteMaterial({ map: qTex, transparent: true, depthWrite: false }));
  traps.forEach((tr) => {
    const g = tr.g;
    // dunkles Loch mit Steinrand (liegt sichtbar über dem Kiesboden, nichts in derselben Ebene)
    const hole = () => {
      const pit = new T.Mesh(boxGeo, pitMat); pit.scale.set(DOOR_L, 0.02, WIN - 0.04); pit.position.y = 0.03; g.add(pit);
      for (const sx of [-1, 1]) { const rim = new T.Mesh(boxGeo, rimMat); rim.scale.set(0.26, 0.08, WIN - 0.02); rim.position.set(sx * (DOOR_L / 2 + 0.13), 0.045, 0); rim.receiveShadow = true; g.add(rim); }
    };
    if (tr.kind === 'pit') {
      hole();
      // Bretter, die erscheinen, wenn die Rechnung gelöst ist
      tr.planks = new T.Group(); tr.planks.visible = false; g.add(tr.planks);
      for (let i = 0; i < 6; i++) { const pl = new T.Mesh(boxGeo, plankMat); pl.scale.set(DOOR_L / 6 - 0.04, 0.09, WIN - 0.12); pl.position.set(-DOOR_L / 2 + DOOR_L / 12 + i * DOOR_L / 6, 0.08, 0); pl.receiveShadow = true; pl.castShadow = true; tr.planks.add(pl); }
      const sp = new T.Sprite(qSprite); sp.scale.set(1.5, 0.64, 1); sp.position.set(0, 1.6, 0); g.add(sp); tr.qs = sp;
    } else if (tr.kind === 'door') {
      hole();
      // zwei Klappen, seitlich an den Hecken angeschlagen; sie klappen nach oben auf
      tr.flaps = [-1, 1].map((s) => {
        const hinge = new T.Group(); hinge.position.set(0, 0.1, s * (WIN / 2 - 0.04)); g.add(hinge);
        const f = new T.Mesh(boxGeo, keep(new T.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }))); f.scale.set(DOOR_L - 0.04, 0.08, WIN / 2 - 0.06); f.position.z = -s * (WIN / 4 - 0.01); f.castShadow = true; f.receiveShadow = true; hinge.add(f);
        hinge.userData.s = s; return hinge;
      });
    }
  });
  // Zustand der Fallen zur Zeit t (Sekunden)
  const DR_T = 3.4;
  const doorOpen = (tr, t) => { const u = ((t + tr.ph) % DR_T); return u < 0.4 ? 0 : u < 0.7 ? (u - 0.4) / 0.3 : u < 1.9 ? 1 : u < 2.2 ? 1 - (u - 1.9) / 0.3 : 0; };
  const doorWarn = (tr, t) => { const u = ((t + tr.ph) % DR_T); return u < 0.4 ? Math.sin(u * 60) * 0.05 : 0; };

  /* ---------- Belohnungen in Sackgassen, Deko in den übrigen ---------- */
  const deadEnds = [];
  for (let c = 0; c < N * N; c++) if (dirsOf(c).length === 1 && !P.includes(c) && !trapAt.has(c)) deadEnds.push(c);
  shuffle(deadEnds);
  const pickKind = { speed: 'bolt', countdown: 'hourglass', survive: 'heart' }[mode] || 'bolt';
  const picks = [];
  for (const c of deadEnds) { if (picks.length >= cfg.picks) break; if (picks.some((p) => Math.abs(X(p.c) - X(c)) + Math.abs(Z(p.c) - Z(c)) < 4)) continue; picks.push({ c, kind: pickKind, x: cx(c), z: cz(c), taken: false }); }
  const pickMats = { heart: keep(new T.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.6, roughness: 0.3 })), bolt: keep(new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.7, roughness: 0.3 })), gold: keep(new T.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.25, emissive: 0x7c5a00, emissiveIntensity: 0.4 })), sand: keep(new T.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xb45309, emissiveIntensity: 0.3 })) };
  const ext = (shape) => { const g = keep(new T.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 })); g.center(); return g; };
  const heartS = new T.Shape(); heartS.moveTo(0, -0.34); heartS.bezierCurveTo(-0.5, -0.05, -0.45, 0.34, -0.2, 0.34); heartS.bezierCurveTo(-0.06, 0.34, 0, 0.22, 0, 0.17); heartS.bezierCurveTo(0, 0.22, 0.06, 0.34, 0.2, 0.34); heartS.bezierCurveTo(0.45, 0.34, 0.5, -0.05, 0, -0.34);
  const boltS = new T.Shape(); [[0.12, 0.42], [-0.2, 0.0], [0.0, 0.0], [-0.12, -0.42], [0.22, 0.06], [0.02, 0.06]].forEach(([x, y], i) => (i ? boltS.lineTo(x, y) : boltS.moveTo(x, y)));
  const heartG = ext(heartS), boltG = ext(boltS);
  const coneG = keep(new T.ConeGeometry(0.2, 0.3, 14)), capG = keep(new T.CylinderGeometry(0.26, 0.26, 0.06, 14));
  const ringMatFor = (c) => keep(new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
  const ringG = keep(new T.RingGeometry(0.45, 0.75, 32)); ringG.rotateX(-Math.PI / 2);
  picks.forEach((p) => {
    const g = new T.Group(); g.position.set(p.x, 0, p.z);
    const item = new T.Group(); item.position.y = 1.0; g.add(item);
    if (p.kind === 'heart') item.add(new T.Mesh(heartG, pickMats.heart));
    else if (p.kind === 'bolt') item.add(new T.Mesh(boltG, pickMats.bolt));
    else { const a = new T.Mesh(coneG, pickMats.sand); a.position.y = 0.15; a.rotation.x = Math.PI; item.add(a); const b = new T.Mesh(coneG, pickMats.sand); b.position.y = -0.15; item.add(b); for (const y of [-0.33, 0.33]) { const c = new T.Mesh(capG, pickMats.gold); c.position.y = y; item.add(c); } }
    item.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const ring = new T.Mesh(ringG, ringMatFor({ heart: 0xf87171, bolt: 0xfde047, hourglass: 0xfbbf24 }[p.kind])); ring.position.y = 0.04; g.add(ring);
    scene.add(g); p.g = g; p.item = item; p.ring = ring;
  });
  // Deko in den Sackgassen ohne Belohnung: Brunnen, Spiegelkugel, Bank, Blumentopf, Pilze
  const stoneMat = keep(new T.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 })), waterMat = keep(new T.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.2, emissive: 0x0369a1, emissiveIntensity: 0.35 }));
  const mirrorMat = keep(new T.MeshStandardMaterial({ color: 0xc4b5fd, metalness: 1, roughness: 0.08 })), terraMat = keep(new T.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 })), woodMat = keep(new T.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }));
  const capMat = keep(new T.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })), stemMat = keep(new T.MeshStandardMaterial({ color: 0xfef3c7 }));
  const cyl = (r1, r2, h, s = 16) => keep(new T.CylinderGeometry(r1, r2, h, s));
  const decoGeo = { basin: cyl(0.85, 0.95, 0.45), water: cyl(0.72, 0.72, 0.05), col: cyl(0.12, 0.16, 0.8, 10), bowl: cyl(0.4, 0.2, 0.18), ped: cyl(0.3, 0.38, 0.9, 8), ball: keep(new T.SphereGeometry(0.38, 20, 14)), pot: cyl(0.35, 0.25, 0.5, 12), shrub: keep(new T.IcosahedronGeometry(0.42, 1)), cap: keep(new T.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), stem: cyl(0.06, 0.08, 0.28, 8) };
  const decoKinds = ['fountain', 'mirror', 'bench', 'pot', 'mush'];
  let di = 0;
  for (const c of deadEnds) {
    if (picks.some((p) => p.c === c) || di >= 22) continue;
    const d = dirsOf(c)[0], [dx, dz] = MZ3_DIRS[d];
    const kind = decoKinds[di++ % decoKinds.length];
    const g = new T.Group(); g.position.set(cx(c) - dx * 0.75, 0, cz(c) - dz * 0.75); g.rotation.y = Math.atan2(dx, dz); scene.add(g);
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    if (kind === 'fountain') { add(decoGeo.basin, stoneMat, 0, 0.22, 0); add(decoGeo.water, waterMat, 0, 0.42, 0); add(decoGeo.col, stoneMat, 0, 0.8, 0); add(decoGeo.bowl, stoneMat, 0, 1.2, 0); add(decoGeo.water, waterMat, 0, 1.28, 0, 0.45, 1, 0.45); }
    else if (kind === 'mirror') { add(decoGeo.ped, stoneMat, 0, 0.45, 0); add(decoGeo.ball, mirrorMat, 0, 1.25, 0); }
    else if (kind === 'bench') { add(boxGeo, woodMat, 0, 0.45, 0, 1.6, 0.08, 0.5); add(boxGeo, woodMat, 0, 0.8, -0.24, 1.6, 0.4, 0.06); for (const sx of [-0.65, 0.65]) add(boxGeo, metal, sx, 0.22, 0, 0.08, 0.45, 0.45); }
    else if (kind === 'pot') { for (const sx of [-0.55, 0.55]) { add(decoGeo.pot, terraMat, sx, 0.25, 0); add(decoGeo.shrub, topMat, sx, 0.75, 0); } }
    else { for (let k = 0; k < 4; k++) { const x = (Math.random() - 0.5) * 1.4, z = (Math.random() - 0.5) * 0.9, s = 0.7 + Math.random() * 0.7; add(decoGeo.stem, stemMat, x, 0.14 * s, z, s, s, s); add(decoGeo.cap, capMat, x, 0.26 * s, z, s, s, s); } }
  }

  /* ---------- Schatz am Ende: prächtige Schatzkiste (wie beim Brückenbau in Vokaboom) mit Lichtsäule ----------
     Voxel-Holzkiste mit Eisenbändern, goldenen Ecken und Schloss, innen ein Berg Münzen mit zwei Edelsteinen.
     Wer sie erreicht: Deckel geht auf, goldenes Licht, Münzen springen heraus. */
  const goal = P[P.length - 1];
  const chest = new T.Group();
  const vmats = vxMaterials(T);
  const vox = (build, opts) => { const B = rnBuilder(); build(B); return keep(rnGeo(T, B, opts)); };
  const vmesh = (g) => { const m = new T.Mesh(g, vmats); m.castShadow = true; m.receiveShadow = true; return m; };
  const vrand = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
  const CU = 0.055; // Grösse eines Klötzchens
  const lidPivot = new T.Group();
  const chestGold = new T.PointLight(0xffd54a, 0, 6);
  const coinGeo = keep(new T.CylinderGeometry(0.15, 0.15, 0.035, 20));
  const coinMat = keep(new T.MeshStandardMaterial({ color: 0xffcf33, metalness: 0.9, roughness: 0.25, emissive: 0x553300, emissiveIntensity: 0.3 }));
  const coins = [];
  {
    const wood = (x, y, z) => rnShade(0x8b5a2b, ((Math.floor((x + 20) / 4) % 2) ? 0.06 : -0.04) + (vrand(x * 7 + y * 3 + z) - 0.5) * 0.06);
    const body = vmesh(vox((B) => {
      B.box(-12, 0, -8, 12, 14, 8, wood);
      B.box(-11, 13, -7, 11, 14, 7, 0x3a2412);                                   // dunkler Rand innen
      for (const x of [-12, -4, 4, 12]) B.box(x, 0, -8, x, 14, 8, 0x4a4a55, 3);   // Eisenbänder
      for (const [x, z] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) for (const y of [0, 14]) B.ell(x, y, z, 1.6, 1.6, 1.6, 0xf5c518, { mat: 3 }); // goldene Ecken
      B.box(-3, 7, 8, 3, 13, 9, 0xf5c518, 3); B.box(-1, 8, 9, 1, 11, 10, 0x2a1a0a);  // Schloss
    }, { u: CU, iter: 2 }));
    chest.add(body);
    const pile = vmesh(vox((B) => {
      B.ell(0, 13, 0, 10, 4, 6, (x, y, z) => ((x + y + z) % 3 ? 0xffd54a : 0xf5b400), { mat: 3, keep: (x, y) => y >= 13 });
      for (let k = 0; k < 8; k++) B.ell(-8 + k * 2.2, 16 + (k % 2), (k % 3) - 1, 1.6, 0.6, 1.6, 0xffe680, { mat: 3 });
      B.ell(4, 17, 1, 1.5, 1.5, 1.5, 0x3ad6ff, { mat: 1 }); B.ell(-5, 17, -1, 1.3, 1.3, 1.3, 0xff4d6d, { mat: 1 });
    }, { u: CU, iter: 2 }));
    chest.add(pile);
    lidPivot.position.set(0, 14 * CU, -8 * CU); chest.add(lidPivot);
    const lidM = vmesh(vox((B) => {
      B.tube('x', -12, 12, 8, 0, 8, wood, { keep: (x, y) => y >= 0 });
      for (const x of [-12, -4, 4, 12]) B.tube('x', x, x, 8, 0, 8.4, 0x4a4a55, { mat: 3, keep: (xx, y) => y >= 0 });
      B.box(-3, 0, 15, 3, 4, 17, 0xf5c518, 3);
    }, { u: CU, iter: 2 }));
    lidPivot.add(lidM);
    chestGold.position.set(0, 1.3, 0.3); chest.add(chestGold);
    // Kiste schaut zum Weg, auf dem man kommt (Schloss vorne)
    const prev = P[P.length - 2] ?? goal;
    chest.position.set(cx(goal), 0, cz(goal));
    chest.rotation.y = Math.atan2(cx(prev) - cx(goal), cz(prev) - cz(goal));
    scene.add(chest);
    const beam = new T.Mesh(keep(new T.CylinderGeometry(0.7, 1.1, 70, 20, 1, true)), keep(new T.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })));
    beam.position.set(cx(goal), 35, cz(goal)); scene.add(beam); chest.userData.beam = beam;
  }
  /** Kiste öffnen: Deckel auf, Goldschein, Münzen springen heraus */
  function openChest() {
    chest.userData.open = 0.0001;
    const th = chest.rotation.y, fx = Math.sin(th), fz = Math.cos(th), sx2 = Math.cos(th), sz2 = -Math.sin(th);
    S.fin = { k: 0, x0: S.x, z0: S.z, x1: chest.position.x + sx2 * 1.05 + fx * 0.55, z1: chest.position.z + sz2 * 1.05 + fz * 0.55,
      cam: new T.Vector3(chest.position.x + fx * 2.9 + sx2 * 0.5, 1.75, chest.position.z + fz * 2.9 + sz2 * 0.5),
      look: new T.Vector3(chest.position.x + sx2 * 0.45, 0.45, chest.position.z + sz2 * 0.45), face: th + 0.45 };
    const top = new T.Vector3(); chest.localToWorld(top.set(0, 0.8, 0));
    for (let i = 0; i < 28; i++) {
      const m = new T.Mesh(coinGeo, coinMat); m.castShadow = true; m.position.copy(top); scene.add(m);
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
      coins.push({ m, v: new T.Vector3(Math.cos(a) * sp, 4 + Math.random() * 3.5, Math.sin(a) * sp), spin: 8 + Math.random() * 12, wait: 0.35 + i * 0.012 });
      m.visible = false;
    }
    tone([523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.07);
  }
  function stepChest(dt) {
    const o = chest.userData.open;
    if (!o) return;
    const k = Math.min(1, o + dt / 0.7); chest.userData.open = k;
    const e = 1 - Math.pow(1 - k, 3);
    lidPivot.rotation.x = -e * 1.95; chestGold.intensity = e * 4;
    for (const c of coins) {
      if (c.rest) continue;
      if (c.wait > 0) { c.wait -= dt; continue; }
      c.m.visible = true;
      c.v.y -= 9.5 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.spin * dt; c.m.rotation.z += c.spin * 0.6 * dt;
      if (c.m.position.y < 0.03 && c.v.y < 0) {
        if (Math.abs(c.v.y) > 1.2) { c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; if (Math.random() < 0.3) tone([2093 + Math.random() * 600], 0.03, 'sine', 0.02); }
        else { c.rest = true; c.m.position.y = 0.035; c.m.rotation.set(0, Math.random() * 6, 0); }
      }
    }
  }

  /* ---------- Schmetterlinge ---------- */
  const wingMats = ['#f97316', '#38bdf8', '#e879f9', '#facc15'].map((c1) => keep(new T.MeshBasicMaterial({ side: T.DoubleSide, transparent: true, depthWrite: false, map: ctex(cnv(64, 64, (g) => {
    const wing = (x, y, rx, ry, a) => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill(); g.stroke(); };
    g.lineWidth = 4; g.strokeStyle = '#1f2937'; g.fillStyle = c1;
    wing(34, 22, 24, 17, -0.5); wing(30, 47, 16, 12, 0.4);
    g.fillStyle = '#fff'; for (const [x, y] of [[44, 14], [50, 24], [36, 48]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  })) })));
  const wingG = keep(new T.PlaneGeometry(0.2, 0.2)); wingG.translate(0.1, 0, 0);
  const flies = Array.from({ length: 7 }, (_, i) => {
    const g = new T.Group(), mat = wingMats[i % wingMats.length];
    const l = new T.Mesh(wingG, mat), r = new T.Mesh(wingG, mat); r.scale.x = -1; g.add(l, r);
    const body = new T.Mesh(boxGeo, keep(new T.MeshBasicMaterial({ color: 0x1f2937 }))); body.scale.set(0.025, 0.025, 0.14); g.add(body);
    scene.add(g);
    return { g, l, r, ph: i * 0.9, rad: 2.5 + Math.random() * 4, h: 1.0 + Math.random() * 1.6 };
  });

  /* ---------- Avatar (kleiner, damit man mehr vom Labyrinth sieht) ---------- */
  const look = typeof a3Mine === 'function' ? a3Mine() : null;
  const fig = vxFigure(T, look || {});
  const wrap = new T.Group(); wrap.add(fig.root); fig.root.scale.setScalar(0.5);
  fig.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(wrap);
  fig.setAnim('idle');
  const firstDir = MZ3_DIRS.findIndex(([dx, dz]) => X(P[0]) + dx === X(P[1]) && Z(P[0]) + dz === Z(P[1]));
  const yaw0 = Math.atan2(-MZ3_DIRS[firstDir][0], -MZ3_DIRS[firstDir][1]);
  const S = { x: cx(P[0]) - MZ3_DIRS[firstDir][0] * 0.8, z: cz(P[0]) - MZ3_DIRS[firstDir][1] * 0.8, yaw: yaw0, camYaw: yaw0, camDist: 3, v: 0, gi: 0, push: null, done: false, last: performance.now(), t: 0, tt: 0, started: false, inv: 0, fall: null, boost: 0, safe: null, noTraps: false };
  S.safe = { x: S.x, z: S.z };
  const keys = { f: 0, b: 0, l: 0, r: 0 };
  const joy = { x: 0, y: 0 };
  const flash = (cls) => { const f = $('#mz3flash'); if (!f) return; f.className = `mz3-flash ${cls}`; void f.offsetWidth; f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 260); };
  const pop = (txt, cls = '') => { const p = $('#mz3pop'); if (!p) return; p.className = `mz3-pop ${cls}`; p.textContent = txt; void p.offsetWidth; p.classList.add('on'); };
  const cellOf = (x, z) => { const gx = Math.round(x / C), gz = Math.round(z / C); return gx >= 0 && gz >= 0 && gx < N && gz < N ? idx(gx, gz) : -1; };

  /* ---------- Karte ---------- */
  const seenCell = new Uint8Array(N * N);
  const mapCv = $('#mz3map'), mg = mapCv.getContext('2d');
  function see(c) {
    if (c < 0 || seenCell[c]) return;
    seenCell[c] = 1;
    for (const [dx, dz] of MZ3_DIRS) {
      let a = c;
      for (let s = 0; s < 4; s++) {
        const x = X(a) + dx, z = Z(a) + dz;
        if (x < 0 || z < 0 || x >= N || z >= N) break;
        const b = idx(x, z);
        if (!open(a, b) || exitAt.has(pk(a, b))) break;
        seenCell[b] = 1; a = b;
      }
    }
  }
  function drawMap() {
    const W = mapCv.width, VIEW = 9, s = W / VIEW;
    const px = S.x / C, pz = S.z / C;
    const sx = (gx) => W / 2 + (gx - px) * s, sz = (gz) => W / 2 + (gz - pz) * s;
    mg.clearRect(0, 0, W, W);
    mg.fillStyle = 'rgba(20,50,25,.72)'; mg.fillRect(0, 0, W, W);
    mg.fillStyle = '#efe3c2';
    const r = Math.ceil(VIEW / 2) + 1, cx0 = Math.round(px), cz0 = Math.round(pz);
    for (let gz = cz0 - r; gz <= cz0 + r; gz++) for (let gx = cx0 - r; gx <= cx0 + r; gx++) {
      if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
      const c = idx(gx, gz);
      if (!seenCell[c]) continue;
      const x = sx(gx), z = sz(gz);
      mg.fillStyle = '#efe3c2';
      mg.fillRect(x - s * 0.32, z - s * 0.32, s * 0.64, s * 0.64);
      if (gx + 1 < N && seenCell[c + 1] && open(c, c + 1)) mg.fillRect(x, z - s * 0.32, s, s * 0.64);
      if (gz + 1 < N && seenCell[c + N] && open(c, c + N)) mg.fillRect(x - s * 0.32, z, s * 0.64, s);
      if (trapAt.has(c)) { mg.fillStyle = '#ef4444'; mg.font = `${s * 0.5}px sans-serif`; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('⚠', x, z); }
    }
    for (const e of exits) {
      if (!seenCell[e.g.c]) continue;
      mg.fillStyle = e.state === 'open' ? '#22c55e' : e.state === 'closed' ? '#ef4444' : '#a78bfa';
      mg.beginPath(); mg.arc(sx(e.p.x / C), sz(e.p.z / C), s * 0.2, 0, 7); mg.fill();
    }
    mg.font = `${s * 0.6}px sans-serif`; mg.textAlign = 'center'; mg.textBaseline = 'middle';
    for (const p of picks) if (!p.taken && seenCell[p.c]) mg.fillText({ heart: '❤️', bolt: '⚡', hourglass: '⏳' }[p.kind], sx(X(p.c)), sz(Z(p.c)));
    if (seenCell[goal]) { mg.font = `${s * 0.8}px sans-serif`; mg.fillText('💎', sx(X(goal)), sz(Z(goal))); }
    mg.save(); mg.translate(W / 2, W / 2); mg.rotate(-S.yaw);
    mg.fillStyle = '#f97316'; mg.strokeStyle = '#fff'; mg.lineWidth = s * 0.1;
    mg.beginPath(); mg.moveTo(0, -s * 0.45); mg.lineTo(s * 0.32, s * 0.32); mg.lineTo(0, s * 0.15); mg.lineTo(-s * 0.32, s * 0.32); mg.closePath(); mg.stroke(); mg.fill();
    mg.restore();
  }

  /* ---------- Rechnung an der Kreuzung (mit Zeitbalken für sichere Rechner) ---------- */
  const clockBar = () => $('#mz3clock i');
  function ask(g) {
    if (!g || g.q || !runOn()) return;
    const t = game.picker.next();
    const vals = choicesFor(t, 3);
    const others = vals.filter((v) => v !== t.answer);
    g.q = { t, at: performance.now(), deadline: GATE_MS ? performance.now() + GATE_MS : 0 };
    g.exits.forEach((e) => { if (e.state === 'closed') return; e.v = e.ok ? t.answer : others.shift(); e.state = 'active'; const tex = keep(mz3Bubble(T, e.v)); e.bub.material.map = tex; e.bub.material.color.set(0xffffff); e.bub.material.needsUpdate = true; });
    // falls ein falsches Tor schon zu ist: der übrig gebliebene Wert wird nicht gebraucht
    $('#mz3q').innerHTML = taskHTML(t, '<span class="slot">?</span>');
    $('#mz3n').textContent = mode === 'survive' || mode === 'speed' ? `Tor ${g.k + 1} von ${GN}` : `Tor ${g.k + 1}`;
    const a = $('#mz3ask'); a.hidden = false; a.className = 'mz3-ask'; void a.offsetWidth; a.classList.add('pop');
    if (GATE_MS) { const b = clockBar(); b.getAnimations().forEach((x) => x.cancel()); b.animate([{ transform: 'scaleX(1)', background: '#22c55e' }, { transform: 'scaleX(.4)', background: '#facc15', offset: 0.6 }, { transform: 'scaleX(0)', background: '#ef4444' }], { duration: GATE_MS, fill: 'forwards' }); }
    tone([660, 880], 0.06, 'triangle', 0.05);
  }
  const stopClock = () => clockBar()?.getAnimations().forEach((x) => x.pause());
  const timeGain = (ms) => { if (game.run) { game.run.penalty -= ms; runHud(); } };
  function lose(kind, t) {
    // kind: 'gate' (falsches Tor), 'slow' (Zeit an der Rechnung abgelaufen), sonst Falle
    const r = game.run;
    if (!r || !runOn()) return true;
    if (kind === 'gate' || kind === 'slow') {
      if (mode === 'speed') { r.penalty += MZ3.PENALTY; pop(kind === 'slow' ? 'Zu langsam! +3 s' : '+3 s', 'bad'); }
      if (mode === 'countdown') { r.penalty += 5000; pop(kind === 'slow' ? 'Zu langsam! −5 s' : '−5 s', 'bad'); }
      if (mode === 'survive') pop(kind === 'slow' ? 'Zu langsam! −1 ❤️' : '−1 ❤️', 'bad');
      return runWrong(t);
    }
    const name = { pit: 'Ins Loch gefallen!', door: 'Falltür!' }[kind] || 'Autsch!';
    if (mode === 'survive') {
      r.lives--;
      $$('[data-run="lives"]').forEach((el) => { const h = el.children[r.lives]; if (h) { h.classList.toggle('lost', false); void h.getBoundingClientRect(); h.classList.add('lost'); } });
      runHud(); pop(`${name} −1 ❤️`, 'bad');
      if (r.lives <= 0) { S.done = true; runFinish('lives'); return true; }
    } else if (mode === 'speed') { r.penalty += MZ3.TRAP_SPEED; runHud(); pop(`${name} +2 s`, 'bad'); }
    else { r.penalty += MZ3.TRAP_TIME; runHud(); pop(`${name} −4 s`, 'bad'); }
    return false;
  }
  function passDoor(e) {
    const g = e.g, t = g.q.t;
    recordAnswer(t, e.v, Math.min(5000, performance.now() - g.q.at)); // Gehzeit zum Tor ist keine Rechenzeit
    stopClock();
    if (e.ok) {
      g.solved = true; S.gi = g.k + 1;
      sfx.good(); flash('good');
      e.state = 'open'; e.veil.visible = false; e.bub.material.color.set(0xbbf7d0);
      g.exits.forEach((x) => { if (!x.ok && x.state !== 'closed') { x.state = 'idle'; x.bub.visible = false; } });
      $('#mz3ask').className = 'mz3-ask ok';
      $('#mz3q').innerHTML = `<span class="rn-res ok">✓</span>${esc(taskText(t, true))}`;
      if (mode === 'countdown') { timeGain(MZ3.TIME_GATE); pop('+8 s ⏳', 'good'); }
      // nach dem letzten Tor zählt die Runde erst beim Schatz
      if (g.k === GN - 1) { const rr = game.run; rr.ok++; rr.streak++; rr.best = Math.max(rr.best, rr.streak); runHud(); }
      else if (runRight()) { S.done = true; return; }
      setTimeout(() => { if (runOn() && !GS[S.gi]?.q) $('#mz3ask').hidden = true; }, 900);
    } else {
      sfx.bad(); flash('bad');
      e.state = 'closed';
      e.veil.material.color.set(0xff6b6b);
      e.bub.material.color.set(0x9ca3af);
      const blk = new T.Mesh(boxGeo, hedgeMat);
      blk.scale.set(e.dx ? TK : MZ3.DOOR + 0.1, 0.01, e.dx ? MZ3.DOOR + 0.1 : TK);
      blk.position.set(e.p.x, 0, e.p.z); blk.castShadow = true; scene.add(blk); e.block = blk;
      S.x = e.p.x - e.dx * (0.15 + MZ3.R + 0.15); S.z = e.p.z - e.dz * (0.15 + MZ3.R + 0.15);
      S.push = { x: -e.dx * 6, z: -e.dz * 6, t: 0.25 };
      $('#mz3ask').className = 'mz3-ask bad';
      fig.setAnim('oops'); setTimeout(() => { if (!S.done) fig.setAnim(S.v ? 'run' : 'idle'); }, 500);
      if (!lose('gate', t)) setTimeout(() => { const a = $('#mz3ask'); if (a && runOn()) a.className = 'mz3-ask'; if (GATE_MS && runOn() && !g.solved) { g.q = null; ask(g); } }, 800);
    }
  }
  function gateTimeout(g) {
    const t = g.q.t;
    recordAnswer(t, '', GATE_MS);
    sfx.bad(); flash('bad');
    $('#mz3ask').className = 'mz3-ask bad';
    g.q = null;
    if (!lose('slow', t)) setTimeout(() => { if (runOn() && !g.solved) ask(g); }, 700);
  }

  /* ---------- Loch im Boden: Rechnung lösen, dann kommen Bretter ---------- */
  function pitAsk(tr) {
    const t = game.picker.next();
    const vals = choicesFor(t, 3);
    S.pit = { tr, t, vals, at: performance.now() };
    $('#mz3pq').innerHTML = taskHTML(t, '<span class="slot">?</span>');
    $('#mz3pans').innerHTML = vals.map((v, i) => `<button type="button" class="mz3-pa" data-action="mz-pit" data-v="${v}"><small>${i + 1}</small>${v}</button>`).join('');
    const c = $('#mz3pit'); c.hidden = false; c.className = 'mz3-pit'; void c.offsetWidth; c.classList.add('pop');
    tone([520, 660], 0.06, 'triangle', 0.05);
  }
  function pitHide() { S.pit = null; const c = $('#mz3pit'); if (c) c.hidden = true; }
  function pitAnswer(v) {
    const q = S.pit;
    if (!q || !runOn()) return;
    const ok = Number(v) === q.t.answer;
    recordAnswer(q.t, v, performance.now() - q.at);
    if (ok) {
      q.tr.solved = true; q.tr.solveT = 0; if (q.tr.qs) q.tr.qs.visible = false;
      sfx.good(); flash('good'); pop('Der Boden ist wieder da!', 'good');
      pitHide();
    } else {
      sfx.bad();
      const c = $('#mz3pit'); c.classList.remove('bad'); void c.offsetWidth; c.classList.add('bad');
      if (lose('gate', q.t)) return;
      setTimeout(() => { if (runOn() && S.pit === q) pitAsk(q.tr); }, 700);
    }
  }
  game.mzPit = (v) => pitAnswer(v);

  /* ---------- Steuerung ---------- */
  const keyMap = { ArrowUp: 'f', w: 'f', W: 'f', ArrowDown: 'b', s: 'b', S: 'b', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
  setGameKeys((e) => { if (S.pit && /^[1-3]$/.test(e.key)) { e.preventDefault(); pitAnswer(S.pit.vals[+e.key - 1]); return; } const k = keyMap[e.key]; if (!k) return; e.preventDefault(); keys[k] = 1; begin(); });
  const keyUp = (e) => { const k = keyMap[e.key]; if (k) keys[k] = 0; };
  document.addEventListener('keyup', keyUp);
  const jo = g2Joystick($('#mz3joy'), (x, y) => { joy.x = x; joy.y = y; if (x || y) begin(); });
  function begin() {
    if (S.started) return;
    S.started = true; runPause(false);
    $('#mz3help')?.classList.add('out');
  }

  /* ---------- Bewegung, Fallen, Belohnungen ---------- */
  const R = MZ3.R;
  const hitBox = (w, x, z, m = R) => x > w.x0 - m && x < w.x1 + m && z > w.z0 - m && z < w.z1 + m;
  function blocked(x, z) {
    for (const w of walls) if (hitBox(w, x, z)) return true;
    if (!S.noTraps) for (const w of solids) if (hitBox(w, x, z)) return true;
    for (const e of exits) if (e.state !== 'open' && e.state !== 'active' && hitBox(e.box, x, z)) return true;
    return false;
  }
  function doorHit(nx, nz) {
    const g = GS[S.gi];
    if (!g || !g.q || g.solved) return null;
    for (const e of g.exits) {
      if (e.state !== 'active') continue;
      const along = e.dx ? Math.abs(nz - e.p.z) : Math.abs(nx - e.p.x);
      const before = e.dx ? (S.x - e.p.x) * e.dx : (S.z - e.p.z) * e.dz, after = e.dx ? (nx - e.p.x) * e.dx : (nz - e.p.z) * e.dz;
      if (along < MZ3.DOOR / 2 && before < -0.05 && after >= -0.05) return e;
    }
    return null;
  }
  /** Position relativ zur Falle: a = entlang des Gangs, l = quer */
  const local = (tr) => (tr.ax === 'x' ? { a: S.x - tr.x, l: S.z - tr.z } : { a: S.z - tr.z, l: S.x - tr.x });
  function knock(tr, strength = 6) {
    const { a } = local(tr), sgn = a >= 0 ? 1 : -1;
    const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw);
    const dirA = Math.abs(a) > 0.15 ? sgn : -(tr.ax === 'x' ? Math.sign(fx) || 1 : Math.sign(fz) || 1);
    S.push = tr.ax === 'x' ? { x: dirA * strength, z: 0, t: 0.28 } : { x: 0, z: dirA * strength, t: 0.28 };
  }
  function hurt(tr) {
    if (S.inv > 0 || S.done || S.noTraps) return;
    S.inv = 1.6;
    sfx.bad(); flash('bad');
    fig.setAnim('oops'); setTimeout(() => { if (!S.done) fig.setAnim(S.v ? 'run' : 'idle'); }, 500);
    if (tr.kind === 'door' || tr.kind === 'pit') { S.fall = { t: 0 }; tone([400, 300, 200, 120], 0.09, 'sine', 0.06); }
    else knock(tr);
    lose(tr.kind);
  }
  function step(dt) {
    if (!runOn() || S.done) { S.v = 0; return; }
    S.tt += dt;
    if (S.inv > 0) S.inv -= dt;
    if (S.boost > 0) S.boost -= dt;
    if (S.fall) { // durch die Falltür gefallen: kurz unten, dann zurück an den letzten sicheren Ort
      S.fall.t += dt; S.v = 0;
      if (S.fall.t > 0.75) { S.x = S.safe.x; S.z = S.safe.z; S.fall = null; S.inv = 1.6; }
      return;
    }
    const fwd = Math.max(-1, Math.min(1, keys.f - keys.b + (joy.y < -0.2 ? -joy.y : joy.y > 0.35 ? -joy.y * 0.7 : 0)));
    const trn = Math.max(-1, Math.min(1, keys.r - keys.l + (Math.abs(joy.x) > 0.15 ? joy.x : 0)));
    S.yaw -= trn * MZ3.TURN * dt;
    const sp = MZ3.SPEED * (S.boost > 0 ? 1.45 : 1);
    let vx = -Math.sin(S.yaw) * fwd * sp, vz = -Math.cos(S.yaw) * fwd * sp;
    if (fwd < 0) { vx *= 0.6; vz *= 0.6; }
    if (S.push) { vx = S.push.x; vz = S.push.z; S.push.t -= dt; if (S.push.t <= 0) S.push = null; }
    S.v = Math.hypot(vx, vz);
    const nx = S.x + vx * dt, nz = S.z + vz * dt;
    const e = !S.push && doorHit(nx, nz);
    if (e) { passDoor(e); if (!e.ok) return; }
    if (!blocked(nx, S.z)) S.x = nx;
    if (!blocked(S.x, nz)) S.z = nz;
    const c = cellOf(S.x, S.z);
    see(c);
    // Fallen
    const tr = trapAt.get(c);
    if (!tr) { if (c >= 0 && Math.hypot(S.x - cx(c), S.z - cz(c)) < 1.2) S.safe = { x: cx(c), z: cz(c) }; }
    else if (!S.noTraps && S.inv <= 0) {
      const { a, l } = local(tr);
      if (tr.kind === 'pit' && !tr.solved && Math.abs(a) < DOOR_L / 2 - 0.15) hurt(tr);
      else if (tr.kind === 'door' && Math.abs(a) < DOOR_L / 2 - 0.1 && doorOpen(tr, S.tt) > 0.6) hurt(tr);
    }
    // Loch in der Nähe? Rechnung zeigen; weit weg: wieder ausblenden
    if (S.pit && (S.pit.tr.solved || Math.hypot(S.x - S.pit.tr.x, S.z - S.pit.tr.z) > 5.5)) pitHide();
    if (!S.pit && !S.fall) for (const p2 of traps) { if (p2.kind !== 'pit' || p2.solved) continue; const lc = local(p2); if (Math.abs(lc.a) < 3.8 && Math.abs(lc.l) < WIN / 2) { pitAsk(p2); break; } }
    // Belohnungen
    for (const p of picks) {
      if (p.taken || Math.hypot(S.x - p.x, S.z - p.z) > 0.95) continue;
      if (p.kind === 'heart') { if (game.run.lives >= game.run.maxLives) continue; runGainLife(); pop('+1 ❤️', 'good'); }
      else if (p.kind === 'hourglass') { timeGain(MZ3.TIME_PICK); pop('+5 s ⏳', 'good'); }
      else { S.boost = 4; pop('Turbo! ⚡', 'good'); }
      p.taken = true; p.takeT = 0;
      tone([784, 988, 1319], 0.07, 'triangle', 0.07);
    }
    // Rechnung an der Kreuzung; Zeitbalken
    const g = GS[S.gi];
    if (g && !g.q && (c === g.c || c === P[g.i - 1])) ask(g);
    if (g && g.q && GATE_MS && !g.solved && performance.now() > g.q.deadline) gateTimeout(g);
    // Schatz
    if (S.gi >= GN && Math.hypot(S.x - cx(goal), S.z - cz(goal)) < 1.4) {
      S.done = true; fig.setAnim('cheer'); openChest();
      setTimeout(() => { sfx.win(); confetti(); }, 450);
      const coin = typeof isKid === 'function' && isKid() && typeof avatarEarnCoins === 'function';
      $('#mz3q').innerHTML = '💎 Schatz gefunden!'; const a2 = $('#mz3ask'); a2.hidden = false; a2.className = 'mz3-ask ok pop fin';
      $('#mz3clock') && ($('#mz3clock').hidden = true);
      if (coin) game.run.coinWon = 1;
      { const h = $('#mz3hint'); if (h) h.textContent = coin ? 'Geschafft! +1 🪙 für deinen Avatar' : 'Geschafft!'; const hp = $('#mz3help'); if (hp) hp.style.display = 'none'; const jy = $('#mz3joy'); if (jy) jy.style.visibility = 'hidden'; }
      S.fin.coin = coin; // Münze und Ergebnis folgen im Schlussblick (nach Spielzeit, auch auf langsamen Geräten)
    }
  }

  /* ---------- Kamera ---------- */
  function camRoom(px, pz, qx, qz) {
    const dx = qx - px, dz = qz - pz, e = 0.2;
    let tMin = 1;
    const lo = (a, b) => Math.min(a, b) - 1, hi = (a, b) => Math.max(a, b) + 1;
    for (const w of walls) {
      if (w.x1 < lo(px, qx) || w.x0 > hi(px, qx) || w.z1 < lo(pz, qz) || w.z0 > hi(pz, qz)) continue;
      let t0 = 0, t1 = tMin, ok = true;
      for (const [p, d, a, b] of [[px, dx, w.x0 - e, w.x1 + e], [pz, dz, w.z0 - e, w.z1 + e]]) {
        if (Math.abs(d) < 1e-6) { if (p < a || p > b) { ok = false; break; } continue; }
        let ta = (a - p) / d, tb = (b - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < tMin) tMin = t0;
    }
    return tMin;
  }
  let raf = 0;
  const camLook = new T.Vector3();
  function frame(now) {
    if (!$('#mz3')) return;
    raf = requestAnimationFrame(frame);
    game.raf = raf;
    const dt = Math.max(0, Math.min(0.05, (now - S.last) / 1000)); S.last = now; S.t += dt;
    if (!S.hold) step(dt);
    const fallY = S.fall ? -Math.min(1.6, S.fall.t * S.fall.t * 6) : 0;
    wrap.position.set(S.x, fallY, S.z);
    wrap.rotation.y = S.yaw + Math.PI;
    if (!S.done && fig.anim !== 'oops') fig.setAnim(S.v > 0.3 ? 'run' : 'idle');
    fig.setRate?.(Math.max(0.6, S.v / 4));
    fig.update(dt);
    // Kamera: knapp hinter und über der (kleineren) Figur, unter der Heckenkante
    S.camYaw += ((S.yaw - S.camYaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 7);
    const want = camera.aspect < 0.8 ? 4.5 : 4.1, sx = Math.sin(S.camYaw), sz = Math.cos(S.camYaw);
    const room = camRoom(S.x, S.z, S.x + sx * want, S.z + sz * want) * want - 0.1;
    const target = Math.max(0.25, Math.min(want, room));
    S.camDist = target < S.camDist ? target : S.camDist + (target - S.camDist) * Math.min(1, dt * 5);
    const nearK = want - S.camDist;
    camera.position.set(S.x + sx * S.camDist, 2.45 + nearK * 0.17, S.z + sz * S.camDist);
    camLook.set(S.x - sx * 6, 0.8 - nearK * 0.1, S.z - sz * 6);
    camera.lookAt(camLook);
    wrap.visible = S.camDist > 1.0 && !(S.inv > 0 && Math.sin(S.t * 30) > 0.3 && !S.fall);
    if (S.fin) { // Schlussblick: Kamera vor die offene Kiste, die Figur steht daneben und jubelt
      const f = S.fin; f.k = Math.min(1, f.k + dt / 0.9); f.t = (f.t || 0) + dt;
      if (f.coin && !f.paid && f.t > 0.9) { f.paid = true; try { avatarEarnCoins(1, $('#mz3'), false); } catch (e) { console.warn('Münze', e); } }
      if (!f.over && f.t > 3) { f.over = true; runFinish('done'); }
      const e = f.k * f.k * (3 - 2 * f.k);
      S.x = f.x0 + (f.x1 - f.x0) * e; S.z = f.z0 + (f.z1 - f.z0) * e;
      wrap.position.set(S.x, 0, S.z); wrap.rotation.y = f.face; wrap.visible = true;
      camera.position.lerp(f.cam, e); camLook.lerp(f.look, e); camera.lookAt(camLook);
    }
    sun.position.set(S.x - 10, 20, S.z + 8); sun.target.position.set(S.x, 0, S.z);
    skyDome.position.set(S.x, 0, S.z);
    // Tore, Blasen, zuwachsende Hecken
    for (const e of exits) {
      if (e.veil.visible) e.veil.material.opacity = 0.86 + Math.sin(S.t * 3 + e.d) * 0.06;
      if (e.bub.visible) e.bub.position.y = e.by + Math.sin(S.t * 2 + e.d) * 0.04;
      if (e.block && e.block.scale.y < H) { e.block.scale.y = Math.min(H, e.block.scale.y + dt * 6); e.block.position.y = e.block.scale.y / 2; }
    }
    // Fallen bewegen (nur in der Nähe)
    for (const tr of traps) {
      if (Math.abs(tr.x - S.x) + Math.abs(tr.z - S.z) > 30) continue;
      if (tr.kind === 'pit') { if (tr.qs) tr.qs.position.y = 1.6 + Math.sin(S.t * 2) * 0.08; if (tr.solveT != null && tr.solveT < 1) { tr.solveT = Math.min(1, tr.solveT + dt * 2.5); tr.planks.visible = true; tr.planks.children.forEach((pl, i) => { const k = Math.max(0, Math.min(1, tr.solveT * 2.2 - i * 0.2)); pl.position.y = 0.08 - (1 - k) * 0.6; pl.scale.y = 0.09 * Math.max(0.05, k); }); } }
      else if (tr.kind === 'door') { const o = doorOpen(tr, S.tt), w = doorWarn(tr, S.tt); tr.flaps.forEach((h) => { h.rotation.x = h.userData.s * (o * 1.3 + w); }); }
      else tr.bushes.forEach((b, i) => { b.rotation.y = Math.sin(S.t * 1.3 + i) * 0.05; });
    }
    // Belohnungen drehen sich und schweben; aufgesammelt: gross und weg
    for (const p of picks) {
      if (!p.g.visible) continue;
      p.item.rotation.y += dt * 2.2; p.item.position.y = 1.0 + Math.sin(S.t * 2.5 + p.x) * 0.12;
      p.ring.material.opacity = 0.4 + Math.sin(S.t * 4) * 0.15;
      if (p.taken) { p.takeT += dt; p.item.scale.setScalar(1 + p.takeT * 3); p.item.position.y += p.takeT * 2; if (p.takeT > 0.35) p.g.visible = false; }
    }
    // Schmetterlinge um die Figur
    for (const f of flies) {
      const a = S.t * 0.35 + f.ph;
      f.g.position.set(S.x + Math.cos(a) * f.rad, f.h + Math.sin(S.t * 1.7 + f.ph) * 0.3, S.z + Math.sin(a * 1.3) * f.rad);
      f.g.rotation.y = -a;
      const flap = Math.sin(S.t * 16 + f.ph) * 1.0; f.l.rotation.y = flap; f.r.rotation.y = -flap; f.g.rotation.x = -1.2;
    }
    stepChest(dt);
    chest.userData.beam.material.opacity = S.fin ? Math.max(0, chest.userData.beam.material.opacity - dt * 0.8) : 0.26 + Math.sin(S.t * 2) * 0.06;
    drawMap();
    renderer.render(scene, camera);
  }
  see(cellOf(S.x, S.z));
  raf = requestAnimationFrame(frame);
  // für Tests
  game.mz3dbg = { S, gates: GS, P, N, C, traps, picks, cell: (i) => ({ x: cx(i), z: cz(i) }), step, keys, begin, render: () => renderer.render(scene, camera), GATE_MS };
  game.stage3d = {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('keyup', keyUp);
      jo?.dispose();
      own.forEach((x) => { try { x.dispose?.(); } catch { /* */ } });
      fig.dispose?.();
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  void run;
}
