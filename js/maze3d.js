/* Teilmal – Rechen-Labyrinth in 3D (wird erst beim Spielen geladen)
 *
 * Ein grosser Heckengarten auf einem Raster (Speed 13 × 13, Survive 19 × 19 Felder). Der Weg zum Schatz windet sich
 * hindurch; an Kreuzungen stehen drei magische Tore, über jedem eine Antwort-Blase. Hinter JEDEM Tor geht ein echter
 * Gang weiter (der ganze Garten ist voller Gänge) – nur das richtige Tor führt zum Schatz. Ein falsches Tor leuchtet
 * rot, wirft einen zurück und wächst zu. Dazwischen gibt es auch Sackgassen, in die man sich verlaufen kann.
 * Kamera auf Augenhöhe knapp hinter dem eigenen Avatar; die Hecken sind höher als die Kamera, man sieht nicht darüber.
 * Oben rechts eine kleine Karte mit allem, was man schon gesehen hat.
 * Steuerung: Pfeiltasten/WASD (vor, zurück, drehen) oder Joystick (hoch = gehen, seitlich = drehen).
 */
'use strict';

const MZ3 = {
  C: 3.2, T: 0.5, H: 2.9, DOOR: 1.7, DH: 2.15, SPEED: 4.0, TURN: 2.5, R: 0.34, PENALTY: 3000, GAP: 5.5,
  speed: { N: 15, G: 10 }, survive: { N: 21, G: 24 },
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
  const mode = gameModeOf('maze');
  const cfg = MZ3[mode === 'speed' ? 'speed' : 'survive'];
  const M = mz3Maze(cfg.N, cfg.G);
  if (!M) throw new Error('Labyrinth konnte nicht gebaut werden');
  const { N, P, gates: GS, links, idx, X, Z } = M;
  const GN = GS.length, C = MZ3.C, TK = MZ3.T, H = MZ3.H;
  Object.assign(game, { picker: gamePicker(), over: false });
  const run = runStart('maze', { goal: GN });
  runPause(true);
  $('#view').innerHTML = gameShell('maze', `
    <div class="mz3" id="mz3">
      <div class="mz3-top">${runHudHTML('rn-hud')}</div>
      <canvas class="mz3-map" id="mz3map" width="240" height="240" aria-hidden="true"></canvas>
      <div class="mz3-ask" id="mz3ask" hidden><small id="mz3hint">Geh durch das Tor mit dem richtigen Ergebnis</small><div class="mz3-q" id="mz3q"></div><span class="mz3-n" id="mz3n"></span></div>
      <div class="mz3-flash" id="mz3flash"></div>
      <div class="g2-joy" id="mz3joy" aria-label="Joystick"><i></i></div>
      <div class="mz3-help" id="mz3help"><span><b>↑</b> gehen</span><span><b>← →</b> drehen</span><span><b>↓</b> zurück</span><small>Pfeiltasten oder Joystick</small></div>
    </div>
    <p class="mode-hint">Lauf mit deinem Avatar durch den Heckengarten. An jeder Kreuzung: durch das Tor mit dem richtigen Ergebnis! ${mode === 'speed' ? `${GN} Tore bis zum Schatz – ein falsches Tor kostet 3 Sekunden.` : `${GN} Tore bis zum Schatz – ein falsches Tor kostet ein Leben.`}</p>`);
  const host = $('#mz3');
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'mz3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const sky = new T.Color('#bfe3ff');
  scene.background = sky; scene.fog = new T.Fog(sky, 7, 27);
  const camera = new T.PerspectiveCamera(70, 1, 0.08, 120);
  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.fov = camera.aspect < 0.8 ? 82 : 70; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  scene.add(new T.HemisphereLight(0xffffff, 0x5b8c3a, 1.35));
  const sun = new T.DirectionalLight(0xfff1d6, 2.0);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const own = [];

  /* ---------- Materialien ---------- */
  const hedgeTex = mz3CanvasTex(T, 256, 256, (g, w, h) => {
    g.fillStyle = '#2f6b2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { g.fillStyle = ['#3f8a35', '#28591f', '#4c9a3c', '#356f2b', '#5aa845'][i % 5]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 2 + Math.random() * 4, Math.random() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 26; i++) { g.fillStyle = ['#fde047', '#f9a8d4', '#ffffff'][i % 3]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.2, 0, 7); g.fill(); }
  }, [2, 1.4]);
  const pathTex = mz3CanvasTex(T, 256, 256, (g, w, h) => {
    g.fillStyle = '#cdbb94'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const sh = 196 + Math.floor(Math.random() * 34); g.fillStyle = `rgb(${sh},${sh - 14},${sh - 42})`; g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); }
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(90,70,40,.18)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [N * 2, N * 2]);
  const grassTex = mz3CanvasTex(T, 256, 256, (g, w, h) => { g.fillStyle = '#6fb24a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2200; i++) { g.fillStyle = ['#5fa03c', '#7cc057', '#68ab44'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } }, [60, 60]);
  const hedgeMat = new T.MeshStandardMaterial({ map: hedgeTex, roughness: 0.95 });
  const topMat = new T.MeshStandardMaterial({ color: 0x4f9a3e, roughness: 1 });
  const pathMat = new T.MeshStandardMaterial({ map: pathTex, roughness: 0.9 });
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);
  const floor = new T.Mesh(new T.PlaneGeometry(N * C, N * C), pathMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set((N - 1) / 2 * C, 0.01, (N - 1) / 2 * C); floor.receiveShadow = true; scene.add(floor);
  own.push(hedgeTex, pathTex, grassTex, hedgeMat, topMat, pathMat, ground.geometry, ground.material, floor.geometry);
  const veilTex = mz3CanvasTex(T, 128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(167,139,250,.97)'); gr.addColorStop(0.5, 'rgba(56,189,248,.94)'); gr.addColorStop(1, 'rgba(167,139,250,.97)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.45})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, 7); g.fill(); }
  }, [1, 1]);
  own.push(veilTex);
  const boxGeo = new T.BoxGeometry(1, 1, 1); own.push(boxGeo);
  const qTex = mz3Bubble(T, '?'); own.push(qTex);

  /* ---------- Hecken bauen (alle als eine Instanz-Gruppe) ---------- */
  const cx = (i) => X(i) * C, cz = (i) => Z(i) * C;
  const pk = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const open = (a, b) => links.has(pk(a, b));
  const exitAt = new Map(); // Paar → Tor-Ausgang
  const exits = [];
  GS.forEach((g, k) => {
    g.k = k;
    g.exits = [{ d: g.fwD, j: P[g.i + 1], ok: true }, ...g.sides.map((o) => ({ d: o.d, j: o.j, ok: false }))];
    g.exits.forEach((e) => { e.g = g; exitAt.set(pk(g.c, e.j), e); exits.push(e); });
  });
  const boxes = [], walls = [];
  const box = (x, z, w, d, h = H, y = h / 2, solid = true) => { boxes.push({ x, y, z, w, h, d }); if (solid) walls.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); };
  // Wand zwischen zwei Feldern (horizontal: zwischen z und z+1; vertikal: zwischen x und x+1), evtl. mit Tor
  function wall(x, z, horiz, door) {
    const L = C + TK;
    if (!door) { if (horiz) box(x, z, L, TK); else box(x, z, TK, L); return; }
    const side = (L - MZ3.DOOR) / 2, off = MZ3.DOOR / 2 + side / 2;
    if (horiz) { box(x - off, z, side, TK); box(x + off, z, side, TK); box(x, z, MZ3.DOOR, TK, H - MZ3.DH, MZ3.DH + (H - MZ3.DH) / 2, false); }
    else { box(x, z - off, TK, side); box(x, z + off, TK, side); box(x, z, TK, MZ3.DOOR, H - MZ3.DH, MZ3.DH + (H - MZ3.DH) / 2, false); }
  }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const c = idx(x, z);
    if (z === 0) wall(x * C, -0.5 * C, true, false);
    if (x === 0) wall(-0.5 * C, z * C, false, false);
    if (x === N - 1 || !open(c, idx(x + 1, z))) wall((x + 0.5) * C, z * C, false, false);
    else if (exitAt.has(pk(c, idx(x + 1, z)))) wall((x + 0.5) * C, z * C, false, true);
    if (z === N - 1 || !open(c, idx(x, z + 1))) wall(x * C, (z + 0.5) * C, true, false);
    else if (exitAt.has(pk(c, idx(x, z + 1)))) wall(x * C, (z + 0.5) * C, true, true);
  }
  const hedges = new T.InstancedMesh(boxGeo, hedgeMat, boxes.length);
  const tops = new T.InstancedMesh(boxGeo, topMat, boxes.length);
  const mtx = new T.Matrix4(), qI = new T.Quaternion(), v1 = new T.Vector3(), v2 = new T.Vector3();
  boxes.forEach((b, i) => {
    hedges.setMatrixAt(i, mtx.compose(v1.set(b.x, b.y, b.z), qI, v2.set(b.w, b.h, b.d)));
    // leicht abgerundete, hellere Oberkante (sieht aus wie geschnittene Hecke)
    tops.setMatrixAt(i, mtx.compose(v1.set(b.x, b.y + b.h / 2 + 0.04, b.z), qI, v2.set(b.w + 0.08, 0.1, b.d + 0.08)));
  });
  hedges.castShadow = true; hedges.receiveShadow = true; tops.receiveShadow = true;
  scene.add(hedges, tops);

  /* ---------- Tore ---------- */
  exits.forEach((e) => {
    const g = e.g, [dx, dz] = MZ3_DIRS[e.d];
    e.p = new T.Vector3(cx(g.c) + dx * C / 2, 0, cz(g.c) + dz * C / 2);
    e.dx = dx; e.dz = dz;
    const yaw = Math.atan2(-dx, -dz);
    const veilMat = new T.MeshBasicMaterial({ map: veilTex, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false });
    e.veil = new T.Mesh(new T.PlaneGeometry(MZ3.DOOR, MZ3.DH), veilMat);
    e.veil.position.set(e.p.x, MZ3.DH / 2, e.p.z); e.veil.rotation.y = yaw; scene.add(e.veil);
    const bubMat = new T.MeshBasicMaterial({ map: qTex, transparent: true, depthWrite: false });
    e.bub = new T.Mesh(new T.PlaneGeometry(1.5, 0.64), bubMat);
    e.by = MZ3.DH + (H - MZ3.DH) / 2 + 0.05;
    e.bub.position.set(e.p.x - dx * (TK / 2 + 0.06), e.by, e.p.z - dz * (TK / 2 + 0.06)); e.bub.rotation.y = yaw; e.bub.renderOrder = 5; scene.add(e.bub);
    e.state = 'idle';
    own.push(e.veil.geometry, veilMat, e.bub.geometry, bubMat);
  });
  const doorBox = (e) => (e.dx ? { x0: e.p.x - 0.15, x1: e.p.x + 0.15, z0: e.p.z - MZ3.DOOR / 2, z1: e.p.z + MZ3.DOOR / 2 } : { x0: e.p.x - MZ3.DOOR / 2, x1: e.p.x + MZ3.DOOR / 2, z0: e.p.z - 0.15, z1: e.p.z + 0.15 });
  exits.forEach((e) => { e.box = doorBox(e); });

  /* ---------- Schatz am Ende ---------- */
  const goal = P[P.length - 1];
  const chest = new T.Group();
  {
    const wood = new T.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 }), gold = new T.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.3, emissive: 0x6b4f00, emissiveIntensity: 0.5 });
    own.push(wood, gold);
    const body = new T.Mesh(boxGeo, wood); body.scale.set(1.3, 0.75, 0.85); body.position.y = 0.38; chest.add(body);
    const lid = new T.Mesh(boxGeo, gold); lid.scale.set(1.36, 0.2, 0.9); lid.position.y = 0.85; chest.add(lid);
    const glow = new T.PointLight(0xfde68a, 7, 7); glow.position.y = 1.6; chest.add(glow);
    chest.position.set(cx(goal), 0, cz(goal)); chest.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(chest);
  }

  /* ---------- Avatar ---------- */
  const look = typeof a3Mine === 'function' ? a3Mine() : null;
  const fig = vxFigure(T, look || {});
  const wrap = new T.Group(); wrap.add(fig.root); fig.root.scale.setScalar(0.72);
  fig.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(wrap);
  fig.setAnim('idle');
  const firstDir = MZ3_DIRS.findIndex(([dx, dz]) => X(P[0]) + dx === X(P[1]) && Z(P[0]) + dz === Z(P[1]));
  const yaw0 = Math.atan2(-MZ3_DIRS[firstDir][0], -MZ3_DIRS[firstDir][1]);
  const S = { x: cx(P[0]) - MZ3_DIRS[firstDir][0] * 0.6, z: cz(P[0]) - MZ3_DIRS[firstDir][1] * 0.6, yaw: yaw0, camYaw: yaw0, camDist: 2.4, v: 0, gi: 0, push: null, done: false, last: performance.now(), t: 0, started: false };
  const keys = { f: 0, b: 0, l: 0, r: 0 };
  const joy = { x: 0, y: 0 };
  const flash = (cls) => { const f = $('#mz3flash'); if (!f) return; f.className = `mz3-flash ${cls}`; void f.offsetWidth; f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 260); };
  const cellOf = (x, z) => { const gx = Math.round(x / C), gz = Math.round(z / C); return gx >= 0 && gz >= 0 && gx < N && gz < N ? idx(gx, gz) : -1; };

  /* ---------- Karte (nur was man schon gesehen hat) ---------- */
  const seenCell = new Uint8Array(N * N);
  const mapCv = $('#mz3map'), mg = mapCv.getContext('2d');
  function see(c) {
    if (c < 0 || seenCell[c]) return;
    seenCell[c] = 1;
    // was man von hier aus geradeaus durch offene Gänge sieht
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
      mg.fillRect(x - s * 0.32, z - s * 0.32, s * 0.64, s * 0.64);
      if (gx + 1 < N && seenCell[c + 1] && open(c, c + 1)) mg.fillRect(x, z - s * 0.32, s, s * 0.64);
      if (gz + 1 < N && seenCell[c + N] && open(c, c + N)) mg.fillRect(x - s * 0.32, z, s * 0.64, s);
    }
    for (const e of exits) {
      if (!seenCell[e.g.c]) continue;
      mg.fillStyle = e.state === 'open' ? '#22c55e' : e.state === 'closed' ? '#ef4444' : '#a78bfa';
      mg.beginPath(); mg.arc(sx(e.p.x / C), sz(e.p.z / C), s * 0.2, 0, 7); mg.fill();
    }
    if (seenCell[goal]) { mg.font = `${s * 0.8}px sans-serif`; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('💎', sx(X(goal)), sz(Z(goal))); }
    // Avatar als Pfeil in der Mitte
    mg.save(); mg.translate(W / 2, W / 2); mg.rotate(-S.yaw);
    mg.fillStyle = '#f97316'; mg.strokeStyle = '#fff'; mg.lineWidth = s * 0.1;
    mg.beginPath(); mg.moveTo(0, -s * 0.45); mg.lineTo(s * 0.32, s * 0.32); mg.lineTo(0, s * 0.15); mg.lineTo(-s * 0.32, s * 0.32); mg.closePath(); mg.stroke(); mg.fill();
    mg.restore();
  }

  /* ---------- Rechnung an der Kreuzung ---------- */
  function ask(g) {
    if (!g || g.q || !runOn()) return;
    const t = game.picker.next();
    const vals = choicesFor(t, 3);
    const others = vals.filter((v) => v !== t.answer);
    g.q = { t, at: performance.now() };
    // das richtige Ergebnis kommt an das Tor auf dem Weg zum Schatz – von aussen sieht man nicht, welches das ist
    g.exits.forEach((e) => { e.v = e.ok ? t.answer : others.shift(); e.state = 'active'; const tex = mz3Bubble(T, e.v); e.bub.material.map = tex; e.bub.material.needsUpdate = true; own.push(tex); });
    $('#mz3q').innerHTML = taskHTML(t, '<span class="slot">?</span>');
    $('#mz3n').textContent = `Tor ${g.k + 1} von ${GN}`;
    const a = $('#mz3ask'); a.hidden = false; a.className = 'mz3-ask'; void a.offsetWidth; a.classList.add('pop');
    tone([660, 880], 0.06, 'triangle', 0.05);
  }
  function passDoor(e) {
    const g = e.g, t = g.q.t;
    recordAnswer(t, e.v, performance.now() - g.q.at);
    if (e.ok) {
      g.solved = true; S.gi = g.k + 1;
      sfx.good(); flash('good');
      e.state = 'open'; e.veil.visible = false; e.bub.material.color.set(0xbbf7d0);
      g.exits.forEach((x) => { if (!x.ok && x.state !== 'closed') { x.state = 'idle'; x.bub.visible = false; } });
      $('#mz3ask').className = 'mz3-ask ok';
      $('#mz3q').innerHTML = `<span class="rn-res ok">✓</span>${esc(taskText(t, true))}`;
      // Speed: nach dem letzten Tor zählt die Runde erst beim Schatz
      if (mode === 'speed' && g.k === GN - 1) { const rr = game.run; rr.ok++; rr.streak++; rr.best = Math.max(rr.best, rr.streak); runHud(); }
      else if (runRight()) { S.done = true; return; }
      setTimeout(() => { if (runOn() && !GS[S.gi]?.q) $('#mz3ask').hidden = true; }, 900);
    } else {
      sfx.bad(); flash('bad');
      e.state = 'closed';
      e.veil.material.color.set(0xff6b6b);
      e.bub.material.color.set(0x9ca3af);
      // Tor wächst zu
      const blk = new T.Mesh(boxGeo, hedgeMat);
      blk.scale.set(e.dx ? TK : MZ3.DOOR + 0.1, 0.01, e.dx ? MZ3.DOOR + 0.1 : TK);
      blk.position.set(e.p.x, 0, e.p.z); blk.castShadow = true; scene.add(blk); e.block = blk;
      // zurückwerfen: zuerst vor das Tor (sonst stünde man in der zuwachsenden Hecke)
      S.x = e.p.x - e.dx * (0.15 + MZ3.R + 0.15); S.z = e.p.z - e.dz * (0.15 + MZ3.R + 0.15);
      S.push = { x: -e.dx * 6, z: -e.dz * 6, t: 0.25 };
      $('#mz3ask').className = 'mz3-ask bad';
      if (mode === 'speed' && game.run) game.run.penalty += MZ3.PENALTY;
      fig.setAnim('oops'); setTimeout(() => { if (!S.done) fig.setAnim(S.v ? 'run' : 'idle'); }, 500);
      if (!runWrong(t)) setTimeout(() => { const a = $('#mz3ask'); if (a && runOn()) a.className = 'mz3-ask'; }, 700);
    }
  }

  /* ---------- Steuerung ---------- */
  const keyMap = { ArrowUp: 'f', w: 'f', W: 'f', ArrowDown: 'b', s: 'b', S: 'b', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
  setGameKeys((e) => { const k = keyMap[e.key]; if (!k) return; e.preventDefault(); keys[k] = 1; begin(); });
  const keyUp = (e) => { const k = keyMap[e.key]; if (k) keys[k] = 0; };
  document.addEventListener('keyup', keyUp);
  const jo = g2Joystick($('#mz3joy'), (x, y) => { joy.x = x; joy.y = y; if (x || y) begin(); });
  function begin() {
    if (S.started) return;
    S.started = true; runPause(false);
    $('#mz3help')?.classList.add('out');
  }

  /* ---------- Bewegung mit Hecken und Toren ---------- */
  const R = MZ3.R;
  const hitBox = (w, x, z) => x > w.x0 - R && x < w.x1 + R && z > w.z0 - R && z < w.z1 + R;
  function blocked(x, z) {
    for (const w of walls) if (hitBox(w, x, z)) return true;
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
  function step(dt) {
    if (!runOn() || S.done) { S.v = 0; return; }
    const fwd = Math.max(-1, Math.min(1, keys.f - keys.b + (joy.y < -0.2 ? -joy.y : joy.y > 0.35 ? -joy.y * 0.7 : 0)));
    const trn = Math.max(-1, Math.min(1, keys.r - keys.l + (Math.abs(joy.x) > 0.15 ? joy.x : 0)));
    S.yaw -= trn * MZ3.TURN * dt;
    let vx = -Math.sin(S.yaw) * fwd * MZ3.SPEED, vz = -Math.cos(S.yaw) * fwd * MZ3.SPEED;
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
    // an der Kreuzung (oder kurz davor) kommt die Rechnung
    const g = GS[S.gi];
    if (g && !g.q && (c === g.c || c === P[g.i - 1])) ask(g);
    // Schatz
    if (S.gi >= GN && Math.hypot(S.x - cx(goal), S.z - cz(goal)) < 1.3) {
      S.done = true; fig.setAnim('cheer'); sfx.win(); confetti();
      $('#mz3q').innerHTML = '💎 Schatz gefunden!'; const a = $('#mz3ask'); a.hidden = false; a.className = 'mz3-ask ok pop';
      setTimeout(() => runFinish('done'), 900);
    }
  }

  /* ---------- Kamera: Augenhöhe, knapp hinter der Figur, nie in der Hecke ---------- */
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
    wrap.position.set(S.x, 0, S.z);
    wrap.rotation.y = S.yaw + Math.PI;
    if (!S.done && fig.anim !== 'oops') fig.setAnim(S.v > 0.3 ? 'run' : 'idle');
    fig.setRate?.(Math.max(0.6, S.v / 4));
    fig.update(dt);
    // Kamera folgt der Blickrichtung weich
    S.camYaw += ((S.yaw - S.camYaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 7);
    const want = camera.aspect < 0.8 ? 2.9 : 2.6, sx = Math.sin(S.camYaw), sz = Math.cos(S.camYaw);
    const room = camRoom(S.x, S.z, S.x + sx * want, S.z + sz * want) * want - 0.1;
    const target = Math.max(0.25, Math.min(want, room));
    S.camDist = target < S.camDist ? target : S.camDist + (target - S.camDist) * Math.min(1, dt * 5);
    // knapp über dem Kopf der Figur (unter der Heckenkante); muss die Kamera näher heran, geht sie etwas höher
    const near = want - S.camDist;
    camera.position.set(S.x + sx * S.camDist, 1.95 + near * 0.28, S.z + sz * S.camDist);
    camLook.set(S.x - sx * 5, 0.95 - near * 0.12, S.z - sz * 5);
    camera.lookAt(camLook);
    wrap.visible = S.camDist > 1.25; // ganz nah: wie aus den eigenen Augen
    sun.position.set(S.x - 8, 18, S.z + 6); sun.target.position.set(S.x, 0, S.z);
    // Tore schimmern, Blasen schweben, Hecken wachsen zu
    for (const e of exits) {
      if (e.veil.visible) e.veil.material.opacity = 0.86 + Math.sin(S.t * 3 + e.d) * 0.06;
      if (e.bub.visible) e.bub.position.y = e.by + Math.sin(S.t * 2 + e.d) * 0.04;
      if (e.block && e.block.scale.y < H) { e.block.scale.y = Math.min(H, e.block.scale.y + dt * 6); e.block.position.y = e.block.scale.y / 2; }
    }
    chest.rotation.y += dt * 0.6;
    drawMap();
    renderer.render(scene, camera);
  }
  see(cellOf(S.x, S.z));
  raf = requestAnimationFrame(frame);
  // für Tests
  game.mz3dbg = { S, gates: GS, P, N, C, cell: (i) => ({ x: cx(i), z: cz(i) }), step, keys, begin, render: () => renderer.render(scene, camera) };
  game.stage3d = {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('keyup', keyUp);
      jo?.dispose();
      hedges.dispose?.(); tops.dispose?.();
      own.forEach((x) => { try { x.dispose?.(); } catch { /* */ } });
      fig.dispose?.();
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  void run;
}
