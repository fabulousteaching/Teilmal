/* Teilmal – Rechen-Labyrinth in 3D (wird erst beim Spielen geladen)
 *
 * Der eigene Avatar läuft durch einen Heckengarten aus Räumen und Gängen. In jedem Raum steht oben eine Rechnung,
 * und es gibt drei magische Tore; über jedem schwebt eine Antwort-Blase. Das richtige Tor lässt einen durch, ein
 * falsches leuchtet rot, wirft einen zurück und schliesst sich. Speed: 10 Tore bis zur Schatzkammer (falsch = +3 s).
 * Survive: endlos weiter, ein falsches Tor kostet ein Leben.
 * Steuerung: Pfeiltasten/WASD (vor, zurück, drehen) oder Joystick auf dem Bildschirm (hoch = gehen, seitlich = drehen).
 */
'use strict';

const MZ3 = { C: 10, ROOM: 6.4, DOOR: 1.9, HEDGE: 2.4, THICK: 0.6, CORR: 2.4, SPEED: 4.2, TURN: 2.6, R: 0.35, ROOMS: 10, PENALTY: 3000 };
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

async function startMaze3D() {
  const T = await w3Three();
  await w3LoadEngine();
  const mode = gameModeOf('maze');
  Object.assign(game, { picker: gamePicker(), over: false });
  const run = runStart('maze', { goal: MZ3.ROOMS });
  runPause(true);
  $('#view').innerHTML = gameShell('maze', `
    <div class="mz3" id="mz3">
      <div class="mz3-top">${runHudHTML('rn-hud')}</div>
      <div class="mz3-ask" id="mz3ask" hidden><small id="mz3hint">Geh durch das Tor mit dem richtigen Ergebnis</small><div class="mz3-q" id="mz3q"></div><span class="mz3-n" id="mz3n"></span></div>
      <div class="mz3-flash" id="mz3flash"></div>
      <div class="g2-joy" id="mz3joy" aria-label="Joystick"><i></i></div>
      <div class="mz3-help" id="mz3help"><span><b>↑</b> gehen</span><span><b>← →</b> drehen</span><span><b>↓</b> zurück</span><small>Pfeiltasten oder Joystick</small></div>
    </div>
    <p class="mode-hint">Lauf mit deinem Avatar durch das Tor mit dem richtigen Ergebnis. ${mode === 'speed' ? `${MZ3.ROOMS} Tore bis zum Schatz – ein falsches Tor kostet 3 Sekunden.` : 'Ein falsches Tor kostet ein Leben.'}</p>`);
  const host = $('#mz3');
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'mz3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const sky = new T.Color('#bfe3ff');
  scene.background = sky; scene.fog = new T.Fog(sky, 18, 46);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 200);
  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.fov = camera.aspect < 0.8 ? 72 : 60; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  scene.add(new T.HemisphereLight(0xffffff, 0x5b8c3a, 1.25));
  const sun = new T.DirectionalLight(0xfff1d6, 2.1);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const own = [];
  // Materialien
  const hedgeTex = mz3CanvasTex(T, 256, 256, (g, w, h) => {
    g.fillStyle = '#2f6b2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = ['#3f8a35', '#28591f', '#4c9a3c', '#356f2b', '#5aa845'][i % 5]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 2 + Math.random() * 4, Math.random() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 30; i++) { g.fillStyle = ['#fde047', '#f9a8d4', '#ffffff'][i % 3]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.2, 0, 7); g.fill(); }
  }, [1, 1]);
  const pathTex = mz3CanvasTex(T, 256, 256, (g, w, h) => {
    g.fillStyle = '#d8c7a3'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const sh = 200 + Math.floor(Math.random() * 30); g.fillStyle = `rgb(${sh},${sh - 14},${sh - 40})`; g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); }
  }, [1, 1]);
  const grassTex = mz3CanvasTex(T, 256, 256, (g, w, h) => { g.fillStyle = '#6fb24a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2200; i++) { g.fillStyle = ['#5fa03c', '#7cc057', '#68ab44'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } }, [60, 60]);
  const hedgeMat = new T.MeshStandardMaterial({ map: hedgeTex, roughness: 0.95 });
  const pathMat = new T.MeshStandardMaterial({ map: pathTex, roughness: 0.9 });
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  own.push(hedgeTex, pathTex, grassTex, hedgeMat, pathMat, ground.geometry, ground.material);
  const veilTex = mz3CanvasTex(T, 128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(167,139,250,.95)'); gr.addColorStop(0.5, 'rgba(56,189,248,.9)'); gr.addColorStop(1, 'rgba(167,139,250,.95)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.4})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, 7); g.fill(); }
  }, [1, 1]);
  own.push(veilTex);
  const boxGeo = new T.BoxGeometry(1, 1, 1); own.push(boxGeo);
  const qTex = mz3Bubble(T, '?'); own.push(qTex);

  /* ---------- Labyrinth: Kette von Räumen auf einem Raster ---------- */
  const rooms = [], walls = [], used = new Set();
  const key = (x, z) => `${x},${z}`;
  const center = (gx, gz) => new T.Vector3(gx * MZ3.C, 0, gz * MZ3.C);
  function addBox(parent, x, z, w, d, h = MZ3.HEDGE, mat = hedgeMat, solid = true) {
    const m = new T.Mesh(boxGeo, mat);
    m.scale.set(w, h, d); m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    if (solid) walls.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, m });
    return m;
  }
  /** Wand mit Durchgang in der Mitte (an der Seite dir des Raumes) */
  function wallSide(g, c, dir, door) {
    const H = MZ3.ROOM / 2, t = MZ3.THICK, dw = door ? MZ3.DOOR : 0;
    const seg = (MZ3.ROOM + t - dw) / 2;
    const [dx, dz] = MZ3_DIRS[dir];
    if (dx === 0) { // Nord/Süd: Wand entlang x
      const z = c.z + dz * H;
      if (door) { addBox(g, c.x - dw / 2 - seg / 2, z, seg, t); addBox(g, c.x + dw / 2 + seg / 2, z, seg, t); addBox(g, c.x, z, dw + 0.2, t, 0.5, hedgeMat, false).position.y = MZ3.HEDGE - 0.25; }
      else addBox(g, c.x, z, MZ3.ROOM + t, t);
    } else {
      const x = c.x + dx * H;
      if (door) { addBox(g, x, c.z - dw / 2 - seg / 2, t, seg); addBox(g, x, c.z + dw / 2 + seg / 2, t, seg); addBox(g, x, c.z, t, dw + 0.2, 0.5, hedgeMat, false).position.y = MZ3.HEDGE - 0.25; }
      else addBox(g, x, c.z, t, MZ3.ROOM + t);
    }
  }
  function nextDir(r) {
    // freie Nachbarzelle wählen, die selbst noch Platz zum Weitergehen hat
    const opts = [0, 1, 2, 3].filter((d) => d !== (r.inDir + 2) % 4).map((d) => ({ d, gx: r.gx + MZ3_DIRS[d][0], gz: r.gz + MZ3_DIRS[d][1] })).filter((o) => !used.has(key(o.gx, o.gz)));
    if (!opts.length) return [0, 1, 2, 3].find((d) => d !== (r.inDir + 2) % 4);
    opts.forEach((o) => { o.free = MZ3_DIRS.filter(([dx, dz]) => !used.has(key(o.gx + dx, o.gz + dz))).length + Math.random(); });
    opts.sort((a, b) => b.free - a.free);
    return opts[0].d;
  }
  /** Raum k bauen. inDir: Richtung, aus der man hereinkommt (die Wand dort hat den Eingang) */
  function buildRoom(k, gx, gz, inDir) {
    const c = center(gx, gz), g = new T.Group();
    used.add(key(gx, gz));
    const r = { k, gx, gz, c, g, inDir, doors: [], solved: false, treasure: mode === 'speed' && k === MZ3.ROOMS + 1 };
    // Boden
    const fl = new T.Mesh(new T.PlaneGeometry(MZ3.ROOM, MZ3.ROOM), pathMat); fl.rotation.x = -Math.PI / 2; fl.position.set(c.x, 0.02, c.z); fl.receiveShadow = true; g.add(fl); own.push(fl.geometry);
    const entr = (inDir + 2) % 4; // Wandseite des Eingangs
    if (r.treasure) {
      for (let d = 0; d < 4; d++) wallSide(g, c, d, d === entr);
      // Schatztruhe
      const chest = new T.Group();
      const wood = new T.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 }), gold = new T.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.3, emissive: 0x6b4f00, emissiveIntensity: 0.5 });
      own.push(wood, gold);
      const body = new T.Mesh(boxGeo, wood); body.scale.set(1.4, 0.8, 0.9); body.position.y = 0.4; chest.add(body);
      const lid = new T.Mesh(boxGeo, gold); lid.scale.set(1.46, 0.22, 0.96); lid.position.y = 0.9; chest.add(lid);
      const glow = new T.PointLight(0xfde68a, 6, 6); glow.position.y = 1.6; chest.add(glow);
      chest.position.set(c.x, 0, c.z); chest.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(chest); r.chest = chest;
    } else {
      const outDir = nextDir(r);
      r.outDir = outDir;
      for (let d = 0; d < 4; d++) wallSide(g, c, d, true);
      // drei Tore (alle Seiten ausser dem Eingang), eines richtig
      for (let d = 0; d < 4; d++) {
        if (d === entr) continue;
        const [dx, dz] = MZ3_DIRS[d];
        const p = new T.Vector3(c.x + dx * MZ3.ROOM / 2, 0, c.z + dz * MZ3.ROOM / 2);
        const yaw = Math.atan2(-dx, -dz);
        const veilMat = new T.MeshBasicMaterial({ map: veilTex, transparent: true, opacity: 0.88, side: T.DoubleSide, depthWrite: false });
        const veil = new T.Mesh(new T.PlaneGeometry(MZ3.DOOR, MZ3.HEDGE - 0.5), veilMat);
        veil.position.set(p.x, (MZ3.HEDGE - 0.5) / 2, p.z); veil.rotation.y = yaw; g.add(veil);
        const bubMat = new T.MeshBasicMaterial({ map: qTex, transparent: true, depthWrite: false, fog: false });
        const bub = new T.Mesh(new T.PlaneGeometry(1.9, 0.82), bubMat);
        bub.position.set(p.x - dx * 0.5, MZ3.HEDGE + 0.75, p.z - dz * 0.5); bub.rotation.y = yaw; bub.renderOrder = 5; g.add(bub);
        own.push(veil.geometry, veilMat, bub.geometry, bubMat);
        // hinter falschen Toren: kurze Sackgasse; hinter dem richtigen der Gang zum nächsten Raum
        r.doors.push({ d, p, veil, bub, ok: d === outDir, closed: false, block: null });
      }
      // Gang zum nächsten Raum
      const [dx, dz] = MZ3_DIRS[outDir];
      const len = MZ3.C - MZ3.ROOM, mx = c.x + dx * (MZ3.ROOM / 2 + len / 2), mz = c.z + dz * (MZ3.ROOM / 2 + len / 2);
      const cf = new T.Mesh(new T.PlaneGeometry(dx ? len : MZ3.CORR, dx ? MZ3.CORR : len), pathMat); cf.rotation.x = -Math.PI / 2; cf.position.set(mx, 0.021, mz); cf.receiveShadow = true; g.add(cf); own.push(cf.geometry);
      if (dx) { addBox(g, mx, mz - MZ3.CORR / 2 - MZ3.THICK / 2, len, MZ3.THICK); addBox(g, mx, mz + MZ3.CORR / 2 + MZ3.THICK / 2, len, MZ3.THICK); }
      else { addBox(g, mx - MZ3.CORR / 2 - MZ3.THICK / 2, mz, MZ3.THICK, len); addBox(g, mx + MZ3.CORR / 2 + MZ3.THICK / 2, mz, MZ3.THICK, len); }
      // Sackgassen hinter den falschen Toren
      r.doors.filter((x) => !x.ok).forEach((x) => {
        const [ex, ez] = MZ3_DIRS[x.d], back = MZ3.ROOM / 2 + 1.3;
        if (ex) addBox(g, c.x + ex * back, c.z, MZ3.THICK, MZ3.CORR + MZ3.THICK * 2); else addBox(g, c.x, c.z + ez * back, MZ3.CORR + MZ3.THICK * 2, MZ3.THICK);
        if (ex) { addBox(g, c.x + ex * (MZ3.ROOM / 2 + 0.65), c.z - MZ3.CORR / 2 - MZ3.THICK / 2, 1.3, MZ3.THICK); addBox(g, c.x + ex * (MZ3.ROOM / 2 + 0.65), c.z + MZ3.CORR / 2 + MZ3.THICK / 2, 1.3, MZ3.THICK); }
        else { addBox(g, c.x - MZ3.CORR / 2 - MZ3.THICK / 2, c.z + ez * (MZ3.ROOM / 2 + 0.65), MZ3.THICK, 1.3); addBox(g, c.x + MZ3.CORR / 2 + MZ3.THICK / 2, c.z + ez * (MZ3.ROOM / 2 + 0.65), MZ3.THICK, 1.3); }
      });
    }
    scene.add(g);
    rooms.push(r);
    return r;
  }
  function ensureRooms(upTo) {
    while (rooms.length <= upTo) {
      const last = rooms[rooms.length - 1];
      if (last.treasure) return;
      const [dx, dz] = MZ3_DIRS[last.outDir];
      buildRoom(last.k + 1, last.gx + dx, last.gz + dz, last.outDir);
    }
  }
  function dropOld(keepFrom) {
    while (rooms.length && rooms[0].k < keepFrom) {
      const r = rooms.shift();
      scene.remove(r.g);
      for (let i = walls.length - 1; i >= 0; i--) if (r.g.children.includes(walls[i].m)) walls.splice(i, 1);
      r.g.traverse((o) => { if (o.isMesh && o.geometry !== boxGeo && o.geometry.parameters) { /* geteilte Geometrien bleiben */ } });
    }
  }
  // Startraum: ohne Tore-Rechnung? Nein – gleich die erste Rechnung im ersten Raum. Eingang kommt von Süden.
  const startArea = new T.Group();
  buildRoom(1, 0, 0, 0);
  // kleiner Vorplatz vor dem ersten Raum
  const pre = new T.Mesh(new T.PlaneGeometry(MZ3.CORR, 4), pathMat); pre.rotation.x = -Math.PI / 2; pre.position.set(0, 0.021, MZ3.ROOM / 2 + 2); startArea.add(pre); own.push(pre.geometry);
  addBox(startArea, -MZ3.CORR / 2 - MZ3.THICK / 2, MZ3.ROOM / 2 + 2, MZ3.THICK, 4); addBox(startArea, MZ3.CORR / 2 + MZ3.THICK / 2, MZ3.ROOM / 2 + 2, MZ3.THICK, 4);
  addBox(startArea, 0, MZ3.ROOM / 2 + 4.3, MZ3.CORR + MZ3.THICK * 2, MZ3.THICK);
  scene.add(startArea);
  ensureRooms(3);

  /* ---------- Avatar ---------- */
  const look = typeof a3Mine === 'function' ? a3Mine() : null;
  const fig = vxFigure(T, look || {});
  const wrap = new T.Group(); wrap.add(fig.root); fig.root.scale.setScalar(0.72);
  fig.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(wrap);
  fig.setAnim('idle');
  const S = { x: 0, z: MZ3.ROOM / 2 + 2.6, yaw: 0, v: 0, turn: 0, room: 1, asked: 0, push: null, done: false, camYaw: 0, last: performance.now(), t: 0, started: false };
  const keys = { f: 0, b: 0, l: 0, r: 0 };
  const joy = { x: 0, y: 0 };
  const flash = (cls) => { const f = $('#mz3flash'); if (!f) return; f.className = `mz3-flash ${cls}`; void f.offsetWidth; f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 260); };

  /* ---------- Rechnung im Raum ---------- */
  function ask(r) {
    if (!r || r.treasure || r.q || !runOn()) return;
    const t = game.picker.next();
    const vals = choicesFor(t, 3);
    r.q = { t, vals, at: performance.now() };
    const okI = vals.indexOf(t.answer);
    // das richtige Ergebnis kommt ans richtige Tor, die anderen an die übrigen
    const others = vals.filter((v) => v !== t.answer);
    r.doors.forEach((d) => { d.v = d.ok ? t.answer : others.shift(); const tex = mz3Bubble(T, d.v); d.bub.material.map = tex; d.bub.material.needsUpdate = true; own.push(tex); });
    void okI;
    $('#mz3q').innerHTML = taskHTML(t, '<span class="slot">?</span>');
    $('#mz3n').textContent = mode === 'speed' ? `Tor ${r.k} von ${MZ3.ROOMS}` : `Raum ${r.k}`;
    const a = $('#mz3ask'); a.hidden = false; a.className = 'mz3-ask'; void a.offsetWidth; a.classList.add('pop');
    tone([660, 880], 0.06, 'triangle', 0.05);
  }
  function passDoor(r, d) {
    const t = r.q.t, ms = performance.now() - r.q.at;
    recordAnswer(t, d.v, ms);
    if (d.ok) {
      r.solved = true;
      sfx.good(); flash('good');
      d.veil.visible = false;
      d.bub.material.color.set(0xbbf7d0);
      r.doors.forEach((x) => { if (!x.ok) x.bub.visible = false; });
      $('#mz3ask').className = 'mz3-ask ok';
      $('#mz3q').innerHTML = `<span class="rn-res ok">✓</span>${esc(taskText(t, true))}`;
      // Speed: nach dem letzten Tor zählt die Runde erst, wenn man in der Schatzkammer ankommt
      if (mode === 'speed' && r.k === MZ3.ROOMS) { const rr = game.run; rr.ok++; rr.streak++; rr.best = Math.max(rr.best, rr.streak); runHud(); }
      else if (runRight()) { S.done = true; return; }
      ensureRooms(r.k + 3);
      setTimeout(() => { if (runOn()) $('#mz3ask').hidden = true; }, 900);
    } else {
      sfx.bad(); flash('bad');
      d.closed = true;
      d.veil.material.color.set(0xff6b6b);
      d.bub.material.color.set(0x9ca3af);
      // Tor schliesst sich: Hecke wächst zu
      const [dx, dz] = MZ3_DIRS[d.d];
      const blk = addBox(r.g, d.p.x, d.p.z, dx ? MZ3.THICK : MZ3.DOOR + 0.2, dx ? MZ3.DOOR + 0.2 : MZ3.THICK);
      blk.scale.y = 0.01; d.block = blk;
      // zurückwerfen: zuerst vor das Tor in den Raum (sonst stünde man in der zuwachsenden Hecke)
      S.x = d.p.x - dx * (MZ3.THICK / 2 + MZ3.R + 0.15); S.z = d.p.z - dz * (MZ3.THICK / 2 + MZ3.R + 0.15);
      S.push = { x: -dx * 6, z: -dz * 6, t: 0.3 };
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

  /* ---------- Bewegung mit Wänden ---------- */
  const R = MZ3.R;
  function blocked(x, z) {
    for (const w of walls) if (x > w.x0 - R && x < w.x1 + R && z > w.z0 - R && z < w.z1 + R) return true;
    return false;
  }
  function doorHit(nx, nz) {
    // durch welches Tor geht der Avatar gerade? (Mitte der Türöffnung überquert)
    const r = rooms.find((x) => x.k === S.room);
    if (!r || r.treasure || r.solved || !r.q) return null;
    for (const d of r.doors) {
      if (d.closed) continue;
      const [dx, dz] = MZ3_DIRS[d.d];
      const along = dx ? Math.abs(nz - d.p.z) : Math.abs(nx - d.p.x);
      const before = dx ? (S.x - d.p.x) * dx : (S.z - d.p.z) * dz, after = dx ? (nx - d.p.x) * dx : (nz - d.p.z) * dz;
      if (along < MZ3.DOOR / 2 && before < -0.05 && after >= -0.05) return d;
    }
    return null;
  }
  function step(dt) {
    if (!runOn() || S.done) { S.v = 0; return; }
    const fwd = Math.max(-1, Math.min(1, keys.f - keys.b + (joy.y < -0.2 ? -joy.y : joy.y > 0.35 ? -joy.y * 0.7 : 0)));
    const trn = Math.max(-1, Math.min(1, keys.r - keys.l + (Math.abs(joy.x) > 0.15 ? joy.x : 0)));
    S.yaw -= trn * MZ3.TURN * dt;
    let vx = -Math.sin(S.yaw) * fwd * MZ3.SPEED, vz = -Math.cos(S.yaw) * fwd * MZ3.SPEED;
    if (S.push) { vx = S.push.x; vz = S.push.z; S.push.t -= dt; if (S.push.t <= 0) S.push = null; }
    S.v = Math.hypot(vx, vz);
    let nx = S.x + vx * dt, nz = S.z + vz * dt;
    const d = !S.push && doorHit(nx, nz);
    if (d) {
      const r = rooms.find((x) => x.k === S.room);
      passDoor(r, d);
      if (!d.ok) return;
    }
    if (!blocked(nx, S.z)) S.x = nx;
    if (!blocked(S.x, nz)) S.z = nz;
    // in welchem Raum? (Mitte des Raumes in der Nähe)
    for (const r of rooms) {
      if (Math.abs(S.x - r.c.x) < MZ3.ROOM / 2 - 0.4 && Math.abs(S.z - r.c.z) < MZ3.ROOM / 2 - 0.4 && r.k !== S.room && r.k === S.room + 1 && rooms.find((x) => x.k === S.room)?.solved) {
        S.room = r.k;
        dropOld(r.k - 2);
        if (r.treasure) {
          S.done = true; fig.setAnim('cheer'); sfx.win(); confetti();
          $('#mz3q').innerHTML = '💎 Schatz gefunden!'; const a = $('#mz3ask'); a.hidden = false; a.className = 'mz3-ask ok pop';
          setTimeout(() => runFinish('done'), 900);
        } else ask(r);
      }
    }
    if (S.room === 1 && !rooms[0].q && Math.abs(S.z - rooms[0].c.z) < MZ3.ROOM / 2 - 0.4) ask(rooms.find((x) => x.k === 1));
  }
  /* ---------- Bild ---------- */
  let raf = 0;
  const camPos = new T.Vector3(), camLook = new T.Vector3();
  function frame(now) {
    if (!$('#mz3')) return;
    raf = requestAnimationFrame(frame);
    game.raf = raf;
    const dt = Math.max(0, Math.min(0.05, (now - S.last) / 1000)); S.last = now; S.t += dt;
    if (!S.hold) step(dt);
    // Figur
    wrap.position.set(S.x, 0, S.z);
    wrap.rotation.y = S.yaw + Math.PI;
    const moving = S.v > 0.3;
    if (!S.done && fig.anim !== 'oops') fig.setAnim(moving ? 'run' : 'idle');
    fig.setRate?.(Math.max(0.6, S.v / 4));
    fig.update(dt);
    // Kamera: schräg hinter der Figur, über den Hecken
    S.camYaw += ((S.yaw - S.camYaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 4);
    const back = camera.aspect < 0.8 ? 5.0 : 4.4, up = camera.aspect < 0.8 ? 7.0 : 6.2;
    camPos.set(S.x + Math.sin(S.camYaw) * back, up, S.z + Math.cos(S.camYaw) * back);
    camera.position.lerp(camPos, camera.position.lengthSq() ? Math.min(1, dt * 8) : 1);
    camLook.set(S.x - Math.sin(S.camYaw) * 2.4, 0.4, S.z - Math.cos(S.camYaw) * 2.4);
    camera.lookAt(camLook);
    sun.position.set(S.x - 8, 18, S.z + 6); sun.target.position.set(S.x, 0, S.z);
    // Tore schimmern, Blasen schweben, Hecken wachsen zu
    for (const r of rooms) for (const d of r.doors || []) {
      if (d.veil.visible) d.veil.material.opacity = 0.78 + Math.sin(S.t * 3 + d.d) * 0.1;
      if (d.bub.visible) d.bub.position.y = MZ3.HEDGE + 0.75 + Math.sin(S.t * 2 + d.d) * 0.06;
      if (d.block && d.block.scale.y < MZ3.HEDGE) { d.block.scale.y = Math.min(MZ3.HEDGE, d.block.scale.y + dt * 6); d.block.position.y = d.block.scale.y / 2; }
    }
    const tr = rooms.find((x) => x.treasure);
    if (tr?.chest) tr.chest.rotation.y += dt * 0.6;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  game.mz3dbg = { S, rooms, step, keys, begin, render: () => renderer.render(scene, camera) }; // für Tests
  game.stage3d = {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('keyup', keyUp);
      jo?.dispose();
      rooms.forEach((r) => scene.remove(r.g));
      own.forEach((x) => { try { x.dispose?.(); } catch { /* */ } });
      fig.dispose?.();
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  void run;
}
