/* Teilmal – Burg verteidigen in 3D (wird erst beim Spielen geladen)
 *
 * Man steht oben auf der Burgmauer (Zinnen vorne im Bild, links und rechts je eine Kanone). Auf vier Wegen laufen
 * Monster auf die Burg zu – eigene Figuren aus Klötzchen: Goblin, Zyklop, Schleim, Gespenst, Feuerteufelchen.
 * Über jedem Monster ein Schild mit der Rechnung. Ergebnis eintippen (Zahlenfeld oder Tastatur) → die nähere
 * Kanone dreht sich, schiesst, das Monster zerplatzt. Erreicht eines die Mauer, wackelt die Burg (Survive: ein Leben).
 * Spielregeln, Tasten und Eingabe wie in der 2D-Version (js/games2.js: csKey/csTry).
 */
'use strict';

const CS3 = { LANES: [-3.9, -1.3, 1.3, 3.9], Z0: -40, Z1: -8.6, GATE: -47, SPAWN: -50.5, PAL_H: 3.6 };

/** Gegner im Stil der eigenen Avatare (gleicher Baukasten), aber feindlich: böse Brauen, Reisszähne, Hüte, Farben */
const CS3_FOES = [
  { name: 'Goblin', h: 1.85, look: { skin: 0x7cc45a, eyeC: 0xfacc15, brows: 'angry', mouth: 'fang', hair: 'mohawk', hairC: 0x1f2937, top: 'tank', topC: 0x7c4a1e, topT: 0x3f2a1d, bottom: 'shorts', bottomC: 0x4b5563, shoes: 'boots', shoesC: 0x3f2a1d, shoesC2: 0x1f2937 } },
  { name: 'Gnom', h: 1.55, look: { skin: 0xf0b48c, eyeC: 0x1e3a8a, brows: 'angry', mouth: 'smirk', hair: 'buzz', hairC: 0xe5e7eb, hat: 'wizard', hatC: 0xdc2626, hatC2: 0xfacc15, top: 'overalls', topC: 0x2563eb, topT: 0xfacc15, bottom: 'jeans', bottomC: 0x1e3a8a, shoes: 'boots', shoesC: 0x7c2d12, shoesC2: 0x3f2a1d } },
  { name: 'Troll', h: 2.25, look: { skin: 0x8aa0b8, eyeC: 0xef4444, brows: 'angry', mouth: 'fang', hair: 'buzz', hairC: 0x374151, hat: 'viking', hatC: 0x9ca3af, hatC2: 0xfef3c7, top: 'puffer', topC: 0x3f3f46, topT: 0x71717a, bottom: 'cargo', bottomC: 0x57534e, shoes: 'boots', shoesC: 0x292524, shoesC2: 0x1c1917 } },
  { name: 'Hexe', h: 1.95, look: { skin: 0xb48ad8, eyeC: 0x22c55e, brows: 'angry', mouth: 'smirk', hair: 'long', hairC: 0x111827, hat: 'wizard', hatC: 0x1f2937, hatC2: 0x8b5cf6, top: 'robe', topC: 0x6d28d9, topT: 0xfacc15, bottom: 'leggings', bottomC: 0x111827, shoes: 'boots', shoesC: 0x111827, shoesC2: 0x4c1d95 } },
  { name: 'Teufelchen', h: 1.75, look: { skin: 0xe0574a, eyeC: 0xfacc15, brows: 'angry', mouth: 'fang', hair: 'spiky', hairC: 0x111827, top: 'hoodie', topC: 0x7f1d1d, topT: 0x111827, bottom: 'joggers', bottomC: 0x111827, shoes: 'sneakers', shoesC: 0x111827, shoesC2: 0xef4444, back: 'dragon', backC: 0x991b1b, backC2: 0xfacc15 } },
];

/** Geräusche für die Burg (nur WebAudio, keine Dateien): Rauschen + tiefe Töne */
const CS3_SND = {
  ctx() { if (!db.settings.sound) return null; try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx; } catch { return null; } },
  noise(ac, dur) { const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const src = ac.createBufferSource(); src.buffer = b; return src; },
  env(ac, g, t0, peak, a, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); },
  /** Kanonendonner: dumpfer Knall mit Rauschen */
  cannon() {
    const ac = this.ctx(); if (!ac) return; const t0 = ac.currentTime + 0.005;
    const n = this.noise(ac, 0.6), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t0); f.frequency.exponentialRampToValueAtTime(180, t0 + 0.5);
    this.env(ac, g, t0, 0.55, 0.005, 0.5); n.connect(f).connect(g).connect(ac.destination); n.start(t0); n.stop(t0 + 0.6);
    const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.35);
    this.env(ac, og, t0, 0.6, 0.005, 0.38); o.connect(og).connect(ac.destination); o.start(t0); o.stop(t0 + 0.42);
  },
  /** Treffer: Puff mit hellem Pling */
  hit() {
    const ac = this.ctx(); if (!ac) return; const t0 = ac.currentTime + 0.005;
    const n = this.noise(ac, 0.35), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
    this.env(ac, g, t0, 0.35, 0.004, 0.3); n.connect(f).connect(g).connect(ac.destination); n.start(t0); n.stop(t0 + 0.35);
    [880, 1320, 1760].forEach((fr, i) => { const o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle'; o.frequency.value = fr; const st = t0 + 0.06 + i * 0.06; this.env(ac, og, st, 0.09, 0.01, 0.16); o.connect(og).connect(ac.destination); o.start(st); o.stop(st + 0.2); });
  },
  /** Taste auf der Steintafel: kurzer, trockener Klick */
  key() { const ac = this.ctx(); if (!ac) return; const t0 = ac.currentTime + 0.002; const n = this.noise(ac, 0.04), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 2000; this.env(ac, g, t0, 0.12, 0.002, 0.035); n.connect(f).connect(g).connect(ac.destination); n.start(t0); n.stop(t0 + 0.05); },
  /** falsche Eingabe: dumpfes «Bonk» */
  nope() { const ac = this.ctx(); if (!ac) return; const t0 = ac.currentTime + 0.005; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(110, t0 + 0.15); this.env(ac, g, t0, 0.25, 0.005, 0.18); o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.22); },
  /** Gegner an der Mauer: Rumpeln, Mauer bebt */
  wall() {
    const ac = this.ctx(); if (!ac) return; const t0 = ac.currentTime + 0.005;
    const n = this.noise(ac, 0.9), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 320;
    this.env(ac, g, t0, 0.5, 0.02, 0.8); n.connect(f).connect(g).connect(ac.destination); n.start(t0); n.stop(t0 + 0.9);
    [196, 147].forEach((fr, i) => { const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = fr; const st = t0 + i * 0.16; this.env(ac, og, st, 0.06, 0.01, 0.2); o.connect(og).connect(ac.destination); o.start(st); o.stop(st + 0.24); });
  },
  /** neuer Gegner taucht auf: tiefes Brummen */
  spawn() { const ac = this.ctx(); if (!ac) return; const t0 = ac.currentTime + 0.005; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t0); o.frequency.linearRampToValueAtTime(90, t0 + 0.3); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; this.env(ac, g, t0, 0.05, 0.05, 0.3); o.connect(f).connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.4); },
  /** Level hoch: kleine Fanfare */
  fanfare() { const ac = this.ctx(); if (!ac) return; const t0 = ac.currentTime + 0.01; [523, 659, 784, 1047].forEach((fr, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = fr; const st = t0 + i * 0.11; this.env(ac, g, st, 0.05, 0.01, i === 3 ? 0.35 : 0.12); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; o.connect(f).connect(g).connect(ac.destination); o.start(st); o.stop(st + 0.4); }); },
};

async function startCastle3D() {
  const T = await w3Three();
  await w3LoadEngine();
  Object.assign(game, { picker: gamePicker(), cs: { mons: [], typed: '', spawnT: 1.2, last: 0, id: 0 }, over: false });
  runStart('castle');
  const key = (k, cls = '') => `<button type="button" class="cs-key ${cls}" data-action="cs-key" data-k="${k}">${k === 'back' ? '⌫' : k === 'ok' ? '✓' : k}</button>`;
  $('#view').innerHTML = gameShell('castle', `
    <div class="cs3-full" id="csfull">
    <div class="cs-stage cs3" id="csstage">
      <div class="cs3-hud">${runHudHTML('rn-hud')}</div>
      <div class="cs3-signs" id="cssigns"></div><div class="cs3-flash" id="csflash"></div>
      <div class="cs3-pad"><span class="cs-typed" id="cstyped">${CS_EMPTY}</span>
        <div class="cs3-keys">${[1, 2, 3, 4, 5].map((n) => key(n)).join('')}${key('back', 'back')}${[6, 7, 8, 9, 0].map((n) => key(n)).join('')}${key('ok', 'ok')}</div></div>
    </div>
    </div>
    <p class="mode-hint">Du stehst auf der Burgmauer. Tippe das Ergebnis eines Gegners ein (Zahlentasten oder Tastatur) – die Kanone feuert, sobald es passt. Erreicht ein Gegner die Burg, ${game.run.mode === 'survive' ? 'kostet das ein Leben' : 'ist er weg'}.</p>`);
  // ganzer Bildschirm unter der Kopfzeile fürs Spiel
  const fitFull = () => { const el = $('#csfull'); if (!el) return; const top = $('.topbar')?.getBoundingClientRect().bottom || 0; el.style.height = `${Math.max(220, window.innerHeight - Math.max(0, top))}px`; };
  fitFull(); window.scrollTo(0, 0);
  window.addEventListener('resize', fitFull);
  game.cleanups = [...(game.cleanups || []), () => window.removeEventListener('resize', fitFull)];
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

  const flags = [], torches = [];
  const stone = tex(cv(256, 128, (g, w, h) => { g.fillStyle = '#9ca3af'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = -1; x < 5; x++) { const s = 140 + Math.floor(Math.random() * 40); g.fillStyle = `rgb(${s},${s + 4},${s + 12})`; g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); } }), [6, 1]);
  /* ---------- Landschaft ---------- */
  const grass = tex(cv(256, 256, (g, w, h) => { g.fillStyle = '#6fb34a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = ['#62a33f', '#7fc257', '#69ad45'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } }), [40, 40]);
  const ground = new T.Mesh(keep(new T.PlaneGeometry(240, 240)), keep(new T.MeshStandardMaterial({ map: grass, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -40; ground.receiveShadow = true; scene.add(ground);
  const dirt = tex(cv(64, 256, (g, w, h) => { g.fillStyle = '#c9a06a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = ['#b88d58', '#d6b07a', '#a87c49'][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); }), [1, 12]);
  const pathMat = keep(new T.MeshStandardMaterial({ map: dirt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  for (const x of CS3.LANES) { const p = new T.Mesh(keep(new T.PlaneGeometry(1.7, 40)), pathMat); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.03, -28); p.receiveShadow = true; scene.add(p); }
  // Vorplatz vor dem Lagertor
  const yard = new T.Mesh(keep(new T.PlaneGeometry(12.6, 5)), keep(new T.MeshStandardMaterial({ map: tex(dirt.image, [3, 1.2]), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))); yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0.025, CS3.GATE + 1.2); yard.receiveShadow = true; scene.add(yard);
  // Burggraben vor der Mauer
  const moat = new T.Mesh(keep(new T.PlaneGeometry(40, 2.4)), keep(new T.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.15, metalness: 0.2, emissive: 0x1e3a8a, emissiveIntensity: 0.25 })));
  moat.rotation.x = -Math.PI / 2; moat.position.set(0, 0.02, -7.4); scene.add(moat);
  const bridgeMat = keep(new T.MeshStandardMaterial({ color: 0x8d5a2b, roughness: 0.9 }));
  for (const x of CS3.LANES) { const b = new T.Mesh(box, bridgeMat); b.scale.set(1.6, 0.12, 2.8); b.position.set(x, 0.06, -7.4); b.receiveShadow = true; scene.add(b); }
  // Rasen zwischen Graben und Mauer
  const glacis = new T.Mesh(keep(new T.PlaneGeometry(40, 6.4)), keep(new T.MeshStandardMaterial({ color: 0x5f9e45, roughness: 1 }))); glacis.rotation.x = -Math.PI / 2; glacis.position.set(0, 0.015, -3.0); glacis.receiveShadow = true; scene.add(glacis);
  // Deko rund ums Feld (feste Zufallszahlen, damit es immer gleich aussieht)
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const m4 = new T.Matrix4(), q0 = new T.Quaternion(), q1 = new T.Quaternion(), v1 = new T.Vector3(), v2 = new T.Vector3(), eY = new T.Euler();
  const col = new T.Color();
  const blocked = [[-17.5, -10.5, -30, -21.5], [9, 17.5, -24.5, -14.5], [-11.3, -7.1, -19.6, -14.9], [8, 15.5, -38, -30], [-16.5, -8, -44, -36], [-9.5, 9.5, -62, -45]];
  const free = (x, z, pad = 0) => Math.abs(x) > 6.4 + pad && !blocked.some(([x0, x1, z0, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad);
  const spot = (minX, maxX, z0, z1, pad = 0) => { for (let k = 0; k < 40; k++) { const x = (rnd() < 0.5 ? -1 : 1) * (minX + rnd() * (maxX - minX)), z = z0 + rnd() * (z1 - z0); if (free(x, z, pad)) return [x, z]; } return null; };
  const inst = (geo, mat, n, place, shadow = false, tries = n * 3) => { const im = new T.InstancedMesh(geo, mat, n); let k = 0; for (let i = 0; i < tries && k < n; i++) { const r = place(i); if (!r) continue; im.setMatrixAt(k, r.m); if (r.c != null) im.setColorAt(k, col.set(r.c)); k++; } im.count = k; im.castShadow = shadow; im.receiveShadow = true; scene.add(im); keep(im); return im; };
  // Bäume: Tannen und runde Laubbäume
  const leaf = keep(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true })), trunk = keep(new T.MeshStandardMaterial({ color: 0x7c4a1e }));
  const crown = keep(new T.ConeGeometry(0.9, 2.2, 7)), ball = keep(new T.IcosahedronGeometry(1, 1)), stem = keep(new T.CylinderGeometry(0.14, 0.2, 0.8, 6));
  const treeAt = []; for (let i = 0; i < 44; i++) { const p = spot(7.4, 26, -10, -60, 0.6); if (p) treeAt.push([...p, 0.8 + rnd() * 0.8, rnd() < 0.55]); }
  inst(crown, leaf, treeAt.length, (k) => { const [x, z, sc, pine] = treeAt[k]; if (!pine) return null; return { m: m4.compose(v1.set(x, 0.8 + 1.1 * sc, z), q0, v2.set(sc, sc, sc)).clone(), c: [0x2f7d3b, 0x3f9b46, 0x2c6e35][k % 3] }; }, true, treeAt.length);
  inst(ball, leaf, treeAt.length, (k) => { const [x, z, sc, pine] = treeAt[k]; if (pine) return null; return { m: m4.compose(v1.set(x, 1.3 + 0.9 * sc, z), q0, v2.set(sc, sc * 0.9, sc)).clone(), c: [0x5fb346, 0x7cc45a, 0x4f9d3e, 0x9bcf53][k % 4] }; }, true, treeAt.length);
  inst(stem, trunk, treeAt.length, (k) => ({ m: m4.compose(v1.set(treeAt[k][0], 0.4, treeAt[k][1]), q0, v2.set(1, treeAt[k][3] ? 1 : 1.6, 1)).clone() }), false, treeAt.length);
  // Büsche, Steine, Blumen, Pilze
  const rockMat = keep(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));
  inst(keep(new T.IcosahedronGeometry(0.6, 0)), leaf, 34, () => { const p = spot(5.9, 24, -9.5, -56); if (!p) return null; const sc = 0.6 + rnd() * 0.7; return { m: m4.compose(v1.set(p[0], sc * 0.35, p[1]), q0, v2.set(sc * 1.3, sc, sc * 1.2)).clone(), c: [0x4d9a3c, 0x65b24a, 0x3f8a36][Math.floor(rnd() * 3)] }; });
  inst(keep(new T.DodecahedronGeometry(0.55, 0)), rockMat, 30, () => { const p = spot(6, 25, -9.5, -60); if (!p) return null; const sc = 0.35 + rnd() * 0.9; eY.set(rnd() * 3, rnd() * 3, rnd() * 3); return { m: m4.compose(v1.set(p[0], sc * 0.25, p[1]), q1.setFromEuler(eY), v2.set(sc * 1.4, sc, sc * 1.1)).clone(), c: [0x9ca3af, 0xa8a29e, 0x8b8f98][Math.floor(rnd() * 3)] }; }, true);
  const flowerAt = []; for (let i = 0; i < 18; i++) { const p = spot(6.1, 20, -9.8, -45); if (p) for (let j = 0; j < 9; j++) flowerAt.push([p[0] + (rnd() - 0.5) * 1.8, p[1] + (rnd() - 0.5) * 1.8, [0xf472b6, 0xfde047, 0xffffff, 0xa78bfa, 0xfb7185][i % 5]]); }
  const flowerG = keep(new T.IcosahedronGeometry(0.11, 0)), petalMat = keep(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  inst(flowerG, petalMat, flowerAt.length, (k) => { const [x, z, c2] = flowerAt[k]; if (Math.abs(x) < 6) return null; return { m: m4.compose(v1.set(x, 0.14, z), q0, v2.set(1, 0.7, 1)).clone(), c: c2 }; }, false, flowerAt.length);
  // Zaun links und rechts vom Feld
  const fenceMat = keep(new T.MeshStandardMaterial({ color: 0xa47148, roughness: 0.9 }));
  const posts = []; for (const sx of [-1, 1]) for (let z = -9.6; z > CS3.GATE + 1; z -= 2.1) posts.push([sx * 5.55, z]);
  inst(box, fenceMat, posts.length, (k) => ({ m: m4.compose(v1.set(posts[k][0], 0.45, posts[k][1]), q0, v2.set(0.16, 0.9, 0.16)).clone() }), true, posts.length);
  inst(box, fenceMat, posts.length * 2, (k) => { const pp = posts[k >> 1], nx = posts[(k >> 1) + 1]; if (!nx || nx[0] !== pp[0]) return null; return { m: m4.compose(v1.set(pp[0], k % 2 ? 0.66 : 0.36, pp[1] - 1.05), q0, v2.set(0.07, 0.1, 2.1)).clone() }; }, false, posts.length * 2);
  // Heuballen
  const hayMat = keep(new T.MeshStandardMaterial({ color: 0xe9c46a, roughness: 1 }));
  const hayAt = [[-7.6, -20], [-8.4, -21.2], [7.2, -27.5], [16.5, -12.5], [-19, -33], [-12.5, -46]];
  inst(keep(new T.CylinderGeometry(0.55, 0.55, 0.9, 14)), hayMat, hayAt.length, (k) => { eY.set(0, rnd() * 3, Math.PI / 2); return { m: m4.compose(v1.set(hayAt[k][0], 0.55, hayAt[k][1]), q1.setFromEuler(eY), v2.set(1, 1, 1)).clone() }; }, true);
  // Kürbisfeld
  const pumpG = keep(new T.SphereGeometry(0.32, 10, 7)), pumpMat = keep(new T.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 }));
  inst(pumpG, pumpMat, 28, (k) => ({ m: m4.compose(v1.set(-15.6 + (k % 7) * 1.15 + (rnd() - 0.5) * 0.3, 0.22, -37 - Math.floor(k / 7) * 1.6), q0, v2.set(1, 0.72, 1)).clone(), c: [0xf97316, 0xfb923c, 0xea580c][k % 3] }), true);
  inst(box, keep(new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 })), 4, (k) => ({ m: m4.compose(v1.set(-12.2, 0.02, -37 - k * 1.6), q0, v2.set(8.4, 0.04, 0.9)).clone() }));
  // Windmühle mit drehenden Flügeln
  const white = keep(new T.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 })), red = keep(new T.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 })), darkW = keep(new T.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 }));
  const mill = new T.Group(); mill.position.set(-14, 0, -26); scene.add(mill);
  const millT = new T.Mesh(keep(new T.CylinderGeometry(1.3, 2, 6, 10)), white); millT.position.y = 3; millT.castShadow = true; mill.add(millT);
  const millR = new T.Mesh(keep(new T.ConeGeometry(1.7, 2, 10)), red); millR.position.y = 7; millR.castShadow = true; mill.add(millR);
  const millD = new T.Mesh(box, darkW); millD.scale.set(0.8, 1.3, 0.1); millD.position.set(0.6, 0.65, 1.75); millD.rotation.y = 0.35; mill.add(millD);
  const blades = new T.Group(); blades.position.set(0.55, 5.6, 1.55); blades.rotation.y = 0.35; mill.add(blades);
  for (let i = 0; i < 4; i++) { const arm = new T.Group(); arm.rotation.z = i * Math.PI / 2; blades.add(arm); const sp = new T.Mesh(box, darkW); sp.scale.set(0.14, 4.4, 0.08); sp.position.y = 2.2; arm.add(sp); const sail = new T.Mesh(box, white); sail.scale.set(0.9, 3.2, 0.04); sail.position.set(0.5, 2.6, 0); sail.castShadow = true; arm.add(sail); }
  // Bauernhaus
  const house = new T.Group(); house.position.set(13, 0, -19.5); house.rotation.y = -0.5; scene.add(house);
  const hb = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0xfde7c4, roughness: 0.9 }))); hb.scale.set(4.4, 2.4, 3.2); hb.position.y = 1.2; hb.castShadow = true; hb.receiveShadow = true; house.add(hb);
  const roofG = keep(new T.CylinderGeometry(2.3, 2.3, 4.8, 3, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 2)); const hr = new T.Mesh(roofG, red); hr.scale.set(1, 0.6, 0.85); hr.position.y = 3.09; hr.castShadow = true; house.add(hr);
  const chim = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0x9a3412 }))); chim.scale.set(0.45, 1.3, 0.45); chim.position.set(1.2, 4.2, 0.4); house.add(chim);
  const winMat = keep(new T.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0xfef3c7, emissiveIntensity: 0.25, roughness: 0.3 }));
  const hd = new T.Mesh(box, darkW); hd.scale.set(0.8, 1.4, 0.06); hd.position.set(0, 0.7, 1.62); house.add(hd);
  for (const wx of [-1.4, 1.4]) { const w = new T.Mesh(box, winMat); w.scale.set(0.7, 0.6, 0.06); w.position.set(wx, 1.4, 1.62); house.add(w); }
  // Brunnen
  const well = new T.Group(); well.position.set(-9.2, 0, -17.2); scene.add(well);
  const wr = new T.Mesh(keep(new T.CylinderGeometry(0.85, 0.95, 0.8, 14, 1, true)), keep(new T.MeshStandardMaterial({ map: tex(stone.image, [3, 0.5]), roughness: 0.95, side: T.DoubleSide }))); wr.position.y = 0.4; wr.castShadow = true; well.add(wr);
  const wwat = new T.Mesh(keep(new T.CircleGeometry(0.8, 14)), keep(new T.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.2 }))); wwat.rotation.x = -Math.PI / 2; wwat.position.y = 0.5; well.add(wwat);
  for (const px of [-0.8, 0.8]) { const pp = new T.Mesh(box, darkW); pp.scale.set(0.14, 1.9, 0.14); pp.position.set(px, 0.95, 0); well.add(pp); }
  const wroof = new T.Mesh(roofG, red); wroof.scale.set(0.42, 0.3, 0.5); wroof.position.y = 2.2; well.add(wroof);
  // Teich mit Seerosen und Schilf
  const pond = new T.Mesh(keep(new T.CircleGeometry(3, 24)), keep(new T.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.1, emissive: 0x0c4a6e, emissiveIntensity: 0.2, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
  pond.rotation.x = -Math.PI / 2; pond.position.set(11.8, 0.035, -34); pond.scale.set(1.25, 0.85, 1); scene.add(pond);
  inst(keep(new T.CircleGeometry(0.3, 10)), keep(new T.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })), 6, (k) => { eY.set(-Math.PI / 2, 0, 0); return { m: m4.compose(v1.set(11.8 + Math.cos(k * 1.1) * 2.3, 0.045, -34 + Math.sin(k * 1.1) * 1.4), q1.setFromEuler(eY), v2.set(1, 1, 1)).clone() }; });
  inst(keep(new T.CylinderGeometry(0.03, 0.04, 1.1, 4)), keep(new T.MeshStandardMaterial({ color: 0x4d7c0f })), 16, (k) => ({ m: m4.compose(v1.set(8.2 + (k % 4) * 0.18 + (k > 7 ? 6.8 : 0), 0.5, -34.8 + Math.floor((k % 8) / 4) * 0.25 + (k > 7 ? 1.2 : 0)), q0, v2.set(1, 0.7 + (k % 3) * 0.2, 1)).clone() }));
  // Schafe auf der Weide (wippen ein wenig)
  const sheep = [];
  const wool = keep(new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1, flatShading: true })), blackM = keep(new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 }));
  for (const [sx, sz, ry] of [[10.5, -25.5, 0.6], [12.8, -27.2, -0.4], [15.2, -25.8, 2.2], [9.4, -28.6, -2.4], [16.4, -29.2, 1.2]]) {
    const g = new T.Group(); g.position.set(sx, 0, sz); g.rotation.y = ry; scene.add(g);
    const b = new T.Mesh(keep(new T.IcosahedronGeometry(0.5, 1)), wool); b.scale.set(1.25, 0.85, 0.9); b.position.y = 0.62; b.castShadow = true; g.add(b);
    const hd2 = new T.Mesh(box, blackM); hd2.scale.set(0.32, 0.34, 0.3); hd2.position.set(0.68, 0.72, 0); g.add(hd2);
    for (const [lx, lz] of [[-0.3, -0.2], [-0.3, 0.2], [0.3, -0.2], [0.3, 0.2]]) { const l = new T.Mesh(box, blackM); l.scale.set(0.1, 0.36, 0.1); l.position.set(lx, 0.18, lz); g.add(l); }
    sheep.push({ g, hd: hd2, ph: rnd() * 6 });
  }
  // Fässer und Kisten am Wegrand
  inst(keep(new T.CylinderGeometry(0.32, 0.36, 0.8, 10)), keep(new T.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })), 5, (k) => ({ m: m4.compose(v1.set([-6.8, -7.3, 6.9, 7.4, 7.0][k], 0.4, [-10.4, -10.9, -16.2, -15.8, -16.9][k]), q0, v2.set(1, 1, 1)).clone() }), true);
  inst(box, keep(new T.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 })), 4, (k) => ({ m: m4.compose(v1.set([-7.0, 6.8, -6.9, 7.4][k], [0.35, 0.35, 0.35, 1.0][k], [-11.8, -14.6, -30.5, -14.6][k]), q1.setFromEuler(eY.set(0, k * 0.5, 0)), v2.set(0.7, 0.7, 0.7)).clone() }), true);
  // Wolken (wandern langsam)
  const cloudMat = keep(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffe4e6, emissiveIntensity: 0.35, fog: false, flatShading: true }));
  const clouds = [];
  for (let i = 0; i < 7; i++) { const g = new T.Group(); for (let j = 0; j < 4; j++) { const p = new T.Mesh(ball, cloudMat); p.scale.set(2.6 - j * 0.3, 1.5 - j * 0.15, 1.8); p.position.set(j * 2.1 - 3, (j % 2) * 0.5, (j % 2) * 0.6); g.add(p); } g.position.set(-70 + i * 22 + rnd() * 8, 22 + rnd() * 10, -95 - rnd() * 20); g.scale.setScalar(1.4 + rnd()); scene.add(g); clouds.push(g); }

  /* ---------- Monsterlager hinten: Palisade mit Toren, Wachtürme, Zelte ---------- */
  const logMat = keep(new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95, flatShading: true }));
  const logs = [];
  for (let x = -9.4; x <= 9.41; x += 0.46) if (!CS3.LANES.some((lx) => Math.abs(x - lx) < 0.95)) logs.push(x);
  inst(keep(new T.CylinderGeometry(0.24, 0.24, CS3.PAL_H, 7)), logMat, logs.length, (k) => ({ m: m4.compose(v1.set(logs[k], CS3.PAL_H / 2 + (k % 3) * 0.06, CS3.GATE), q0, v2.set(1, 1, 1)).clone() }), true);
  inst(keep(new T.ConeGeometry(0.24, 0.55, 7)), logMat, logs.length, (k) => ({ m: m4.compose(v1.set(logs[k], CS3.PAL_H + 0.27 + (k % 3) * 0.06, CS3.GATE), q0, v2.set(1, 1, 1)).clone() }), true);
  // Tore: zwei Flügel pro Weg, gehen auf, wenn ein Gegner herauskommt
  const gateMat = keep(new T.MeshStandardMaterial({ color: 0x4a2f19, roughness: 0.9 })), bandMat = keep(new T.MeshStandardMaterial({ color: 0x374151, roughness: 0.5, metalness: 0.5 }));
  const gates = CS3.LANES.map((lx) => {
    const leaves = [-1, 1].map((sd) => {
      const hinge = new T.Group(); hinge.position.set(lx + sd * 0.86, 0, CS3.GATE); scene.add(hinge);
      const d = new T.Mesh(box, gateMat); d.scale.set(0.84, CS3.PAL_H - 0.2, 0.16); d.position.set(-sd * 0.43, (CS3.PAL_H - 0.2) / 2, 0); d.castShadow = true; hinge.add(d);
      for (const by of [0.7, CS3.PAL_H - 1]) { const b = new T.Mesh(box, bandMat); b.scale.set(0.84, 0.12, 0.2); b.position.set(-sd * 0.43, by, 0); hinge.add(b); }
      return { hinge, sd };
    });
    const top = new T.Mesh(box, darkW); top.scale.set(2.1, 0.35, 0.4); top.position.set(lx, CS3.PAL_H + 0.1, CS3.GATE); scene.add(top);
    return { leaves, open: 0 };
  });
  // Wachtürme mit lila Fahnen
  const flagE = tex(cv(64, 40, (g, w, h) => { g.fillStyle = '#6d28d9'; g.fillRect(0, 0, w, h); g.fillStyle = '#111827'; g.beginPath(); g.arc(26, 20, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#facc15'; g.fillRect(20, 16, 4, 4); g.fillRect(29, 16, 4, 4); }));
  for (const sx of [-1, 1]) {
    const tw = new T.Group(); tw.position.set(sx * 8.4, 0, CS3.GATE - 1.3); scene.add(tw);
    for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const l = new T.Mesh(keep(new T.CylinderGeometry(0.13, 0.16, 5.6, 6)), logMat); l.position.set(lx, 2.8, lz); l.castShadow = true; tw.add(l); }
    const pl = new T.Mesh(box, darkW); pl.scale.set(2.2, 0.25, 2.2); pl.position.y = 5.5; tw.add(pl);
    const rail = new T.Mesh(box, logMat); rail.scale.set(2.2, 0.7, 0.12); rail.position.set(0, 6, 1.05); tw.add(rail);
    const rf = new T.Mesh(keep(new T.ConeGeometry(1.75, 1.6, 4)), keep(new T.MeshStandardMaterial({ color: 0x3f2a1d, roughness: 0.9, flatShading: true }))); rf.position.y = 7.7; rf.rotation.y = Math.PI / 4; rf.castShadow = true; tw.add(rf);
    const pole = new T.Mesh(keep(new T.CylinderGeometry(0.04, 0.04, 1.6, 6)), bandMat); pole.position.y = 9.1; tw.add(pole);
    const fl = new T.Mesh(keep(new T.PlaneGeometry(1.1, 0.7, 8, 1)), keep(new T.MeshStandardMaterial({ map: flagE, side: T.DoubleSide }))); fl.position.set(0.55, 9.55, 0); tw.add(fl); flags.push(fl);
    // Fackel
    const tc = new T.Mesh(keep(new T.CylinderGeometry(0.05, 0.07, 0.8, 6)), darkW); tc.position.set(sx * -1.1, 4.4, 1.1); tw.add(tc);
    const fire = new T.Mesh(keep(new T.ConeGeometry(0.16, 0.42, 7)), keep(new T.MeshBasicMaterial({ color: 0xfb923c }))); fire.position.set(sx * -1.1, 4.95, 1.1); tw.add(fire); torches.push(fire);
  }
  // Zelte, die über die Palisade schauen
  const tentCols = [0x7c3aed, 0xb91c1c, 0x15803d, 0x92400e, 0x1e3a8a];
  [[-6.5, -53, 2.2, 5], [-2.3, -55.5, 2.6, 5.8], [2.6, -52.8, 2.1, 4.8], [6.6, -55, 2.5, 5.4], [0.2, -58.5, 3, 6.4]].forEach(([x, z, r, h], i) => {
    const t2 = new T.Mesh(keep(new T.ConeGeometry(r, h, 8)), keep(new T.MeshStandardMaterial({ color: tentCols[i % tentCols.length], roughness: 0.85, flatShading: true }))); t2.position.set(x, h / 2, z); t2.castShadow = true; scene.add(t2);
    const tip = new T.Mesh(keep(new T.CylinderGeometry(0.04, 0.04, 1, 5)), bandMat); tip.position.set(x, h + 0.4, z); scene.add(tip);
  });
  // Rauch aus dem Lager
  const smokeMat = keep(new T.MeshBasicMaterial({ color: 0x9ca3af, transparent: true, opacity: 0.5, depthWrite: false }));
  const smoke = Array.from({ length: 8 }, (_, i) => { const p = new T.Mesh(ball, smokeMat.clone()); keep(p.material); p.userData.k = i / 8; scene.add(p); return p; });
  const hillMat = keep(new T.MeshStandardMaterial({ color: 0x5c8f4a, roughness: 1, flatShading: true }));
  const hillG = keep(new T.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  for (let i = 0; i < 9; i++) { const h = new T.Mesh(hillG, hillMat); h.position.set(-60 + i * 15 + Math.random() * 6, 0, -74 - Math.random() * 10); h.scale.set(12 + Math.random() * 8, 5 + Math.random() * 7, 8); scene.add(h); }
  const mtnMat = keep(new T.MeshStandardMaterial({ color: 0x9a8fd0, roughness: 1, flatShading: true }));
  const mtnG = keep(new T.ConeGeometry(1, 1, 5));
  for (let i = 0; i < 7; i++) { const m = new T.Mesh(mtnG, mtnMat); m.position.set(-70 + i * 24 + Math.random() * 8, 9, -105); m.scale.set(18, 18 + Math.random() * 12, 12); scene.add(m); }

  /* ---------- Burgmauer (vorne im Bild) mit Zinnen, Türmen, Fahnen und Kanonen ---------- */
  const stoneMat = keep(new T.MeshStandardMaterial({ map: stone, roughness: 0.95 }));
  const wall = new T.Mesh(box, stoneMat); wall.scale.set(30, 4.6, 1.6); wall.position.set(0, 2.3, -0.2); wall.receiveShadow = true; wall.castShadow = true; scene.add(wall);
  const walk = new T.Mesh(box, keep(new T.MeshStandardMaterial({ color: 0x8b8f98, roughness: 1 }))); walk.scale.set(30, 0.2, 4); walk.position.set(0, 4.5, 1.6); walk.receiveShadow = true; scene.add(walk);
  // niedrige Brüstung vorne (unten im Bild)
  const lip = new T.Mesh(box, keep(new T.MeshStandardMaterial({ map: tex(stone.image, [8, 0.3]), roughness: 0.95 }))); lip.scale.set(30, 0.55, 0.6); lip.position.set(0, 4.85, -0.75); lip.castShadow = true; scene.add(lip);
  const merlonMat = keep(new T.MeshStandardMaterial({ map: tex(stone.image, [1, 0.5]), roughness: 0.95 }));
  for (const x of [3.3, 5.4, 7.5, 9.6, 11.7]) for (const sgn of [-1, 1]) { const m = new T.Mesh(box, merlonMat); m.scale.set(1.15, 1.25, 0.7); m.position.set(sgn * x, 5.2, -0.75); m.castShadow = true; scene.add(m); }
  const flagT = tex(cv(64, 40, (g, w, h) => { g.fillStyle = '#ef4444'; g.fillRect(0, 0, w, h); g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(14, 20); g.lineTo(26, 8); g.lineTo(38, 20); g.lineTo(26, 32); g.fill(); }));
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

  /* ---------- Spiel ---------- */
  const c = game.cs;
  const S = { t: 0, last: performance.now(), shake: 0 };
  const flash = () => { const f = $('#csflash'); if (!f) return; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };
  // Gegner-Figuren: pro Art ein Vorrat, der wiederverwendet wird (Bauen ist aufwendig)
  const pool = CS3_FOES.map(() => []);
  const bbox = new T.Box3(), bsize = new T.Vector3();
  function makeFoe(i) {
    const F = CS3_FOES[i];
    const fig = vxFigure(T, a3Look({ ...A3_DEFAULT, ...F.look }));
    fig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    bbox.setFromObject(fig.root); bbox.getSize(bsize);
    const sc = (F.h * 1.45) / Math.max(0.5, bsize.y);
    const wrapG = new T.Group(); wrapG.add(fig.root); fig.root.scale.setScalar(sc);
    return { fig, root: wrapG, type: i, h: F.h * 1.45 };
  }
  CS3_FOES.forEach((_, i) => pool[i].push(makeFoe(i)));
  function takeFoe(i) { const f = pool[i].pop() || makeFoe(i); f.root.scale.setScalar(1); f.root.rotation.set(0, 0, 0); f.root.position.y = 0; f.fig.setAnim('run'); f.fig.setRate?.(0.5); return f; }
  function giveFoe(f) { scene.remove(f.root); pool[f.type].push(f); }
  function spawn() {
    const busy = new Set(c.mons.map((m) => m.t.answer));
    const t = game.picker.pool.some((x) => !busy.has(x.answer)) ? game.picker.next((x) => !busy.has(x.answer)) : game.picker.next();
    const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const lane = lanes.find((l) => !c.mons.some((m) => m.lane === l && m.z < CS3.Z0 + 7)) ?? lanes[0];
    const lv = surviveLevel();
    const kind = Math.floor(Math.random() * CS3_FOES.length);
    const foe = takeFoe(kind);
    const m = { id: ++c.id, t, lane, kind, foe, fig: foe.fig, h: foe.h, z: CS3.SPAWN, x: 100, out: false, v: (5.2 + lv * 0.55) * (0.85 + Math.random() * 0.3), phase: Math.random() * 6, el: document.createElement('div') };
    foe.root.position.set(CS3.LANES[lane], 0, CS3.SPAWN); foe.root.visible = false;
    scene.add(foe.root);
    m.el.className = 'cs3-sign hide';
    m.el.innerHTML = taskHTML(t, '<span class="slot">?</span>');
    signs.appendChild(m.el);
    c.mons.push(m);
    CS3_SND.spawn();
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
      m.targeted = true; // läuft weiter, kann aber nicht nochmals anvisiert werden
      const can = cannons.reduce((a, b) => (Math.abs(b.base.position.x - CS3.LANES[m.lane]) < Math.abs(a.base.position.x - CS3.LANES[m.lane]) ? b : a));
      const from = new T.Vector3(); can.base.getWorldPosition(from); from.y += 0.4; from.z -= 0.6;
      const target = new T.Vector3(CS3.LANES[m.lane], m.h * 0.6, m.z);
      can.aim = target.clone(); can.kick = 1;
      const ball = new T.Mesh(ballG, iron); ball.position.copy(from); scene.add(ball);
      const dur = 0.32 + Math.abs(m.z) * 0.006;
      CS3_SND.cannon();
      fx.push({ kind: 'ball', o: ball, from, to: target, m, can, t: 0, dur, onHit: () => { const p = m.foe.root.position.clone(); p.y = m.h * 0.6; burst(p); CS3_SND.hit(); m.fig.setAnim('oops'); removeMon(m, 'hit'); } });
      const mz = new T.Mesh(ballG, flashMat); mz.position.copy(from); scene.add(mz); fx.push({ kind: 'flash', o: mz, t: 0, small: true });
    },
    key: () => CS3_SND.key(),
    nope: () => CS3_SND.nope(),
  };

  const m3x = (m) => CS3.LANES[m.lane] + Math.sin(S.t * 1.6 + m.phase) * 0.12;
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
        if (m.dying) continue;
        const speed = m.v * (CS3.Z1 - CS3.Z0) / 86; // gleiche Zeit wie 2D (100 % → 14 %)
        m.z += (m.z < CS3.Z0 ? Math.max(speed * 1.6, 4) : speed) * dt; m.x = 100 - ((m.z - CS3.Z0) / (CS3.Z1 - CS3.Z0)) * 86;
        m.foe.root.visible = m.z > CS3.GATE - 1.6;
        if (!m.out && m.z > CS3.GATE + 0.9) { m.out = true; m.el.classList.remove('hide'); }
        if (m.targeted && m.z > CS3.Z1 - 0.3) { m.z = CS3.Z1 - 0.3; continue; }
        if (m.z >= CS3.Z1) { // an der Mauer
          m.fig.setAnim('cheer'); CS3_SND.wall();
          removeMon(m, 'wall');
          S.shake = 0.5; flash();
          if (!db.settings.sound) sfx.bad();
          recordAnswer(m.t, '', 20000);
          if (runWrong(m.t)) break;
        }
      }
    }
    // Figuren bewegen
    const all = [...c.mons, ...fx.filter((f) => f.kind === 'die').map((f) => f.m)];
    for (const m of all) {
      const ph = S.t * 1.6 + m.phase;
      m.foe.root.position.set(CS3.LANES[m.lane] + Math.sin(ph) * 0.12, 0, m.z);
      m.foe.root.rotation.y = Math.sin(ph) * 0.08;
      if (!m.dying) m.fig.setRate?.(0.42 + m.v * 0.012);
      m.fig.update(dt);
    }
    // Effekte
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i];
      if (e.kind === 'ball') {
        e.t += dt; const k = Math.min(1, e.t / e.dur);
        if (e.m) { e.to.set(m3x(e.m), e.m.h * 0.6, e.m.z); e.can.aim = e.to.clone(); }
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
        const R0 = m.foe.root;
        if (d.how === 'hit') { R0.rotation.x = -Math.min(1.3, d.t * 5); R0.position.y = Math.sin(Math.min(1, d.t * 2) * Math.PI) * 1.2; R0.scale.setScalar(Math.max(0.01, 1 - Math.max(0, d.t - 0.25) * 3.5)); }
        else { R0.scale.setScalar(Math.max(0.01, 1 - Math.max(0, d.t - 0.35) * 4)); R0.position.y = Math.max(0, d.t - 0.35) * 2; }
        if (d.t > 0.65) { giveFoe(m.foe); fx.splice(i, 1); }
      }
    }
    // Lagertore: offen, solange jemand im Torbogen ist
    gates.forEach((g, i) => {
      const want = c.mons.some((m) => m.lane === i && m.z > CS3.SPAWN - 0.1 && m.z < CS3.GATE + 1.6) ? 1 : 0;
      g.open += (want - g.open) * Math.min(1, dt * (want ? 7 : 3));
      g.leaves.forEach((l) => { l.hinge.rotation.y = l.sd * g.open * 1.45; });
    });
    blades.rotation.z -= dt * 0.9;
    sheep.forEach((sp) => { const k = Math.sin(S.t * 1.3 + sp.ph); sp.hd.position.y = 0.6 + Math.max(0, k) * 0.12 - Math.max(0, -k) * 0.25; });
    clouds.forEach((cl, i) => { cl.position.x += dt * (0.5 + i * 0.07); if (cl.position.x > 90) cl.position.x = -90; });
    torches.forEach((f, i) => { f.scale.set(1, 0.8 + Math.sin(S.t * 13 + i * 2) * 0.15 + Math.random() * 0.12, 1); });
    smoke.forEach((p) => { const k = (S.t * 0.12 + p.userData.k) % 1; p.position.set(0.2 + Math.sin(k * 6) * 0.4 + k * 2, 6.5 + k * 7, -58.5); p.scale.setScalar(0.5 + k * 1.6); p.material.opacity = 0.45 * (1 - k); });
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
    camera.position.set((Math.random() - 0.5) * sh, (portrait ? 8.2 : 7.4) + (Math.random() - 0.5) * sh, portrait ? 4.6 : 3.6);
    camera.lookAt(0, 0.5, -14);
    renderer.render(scene, camera);
    // Schilder über den Monstern
    const W = host.clientWidth, H = host.clientHeight;
    for (const m of all) {
      proj.set(CS3.LANES[m.lane], m.h + 0.3, m.z).project(camera);
      const near = Math.max(0, (m.z - CS3.Z0) / (CS3.Z1 - CS3.Z0));
      m.el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * W}px, ${(-proj.y * 0.5 + 0.5) * H}px) translate(-50%, -100%) scale(${0.72 + near * 0.42})`;
      m.el.style.zIndex = Math.round(near * 100);
    }
  }
  raf = requestAnimationFrame(frame);
  game.stage3d = {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      own.forEach((x) => { try { x.dispose?.(); } catch { /* */ } });
      pool.flat().forEach((f) => f.fig.dispose?.()); c.mons.forEach((m) => m.fig.dispose?.());
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  game.cs3dbg = { S, scene, cannons, gates, camera };
}
