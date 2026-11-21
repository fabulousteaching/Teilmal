/* Teilmal – Turbo-Rennen (3D-Kartrennen, three.js)
 *
 * Drei Runden gegen fünf Computer-Fahrer. An mehreren Stellen teilt sich die Strecke in drei Spuren:
 * Auf jeder Spur schwebt ein ?-Würfel – wer durchfährt, trifft immer einen, und eine Rechnung erscheint.
 * Etwas weiter vorne teilt sich die Strecke wieder in drei Tore mit Ergebnissen: richtiges Tor = Turbo,
 * falsches Tor = kurz langsamer.
 *
 * Strecken mit Steigungen und Gefällen, überhöhten Kurven, Brücken (auch über die eigene Strecke) und
 * Tunneln bzw. Höhlen. Fahrkönnen zählt: Wer innen um die Kurve fährt, hat den kürzeren Weg. An den Banden
 * wird man langsamer. Die Computer-Fahrer fahren verschieden gute Linien, machen Fehler und bleiben in der
 * Nähe (sanftes Gummiband), damit das Rennen spannend bleibt. Alle Strecken sind gleich lang (faire Bestenliste).
 * Können lohnt sich wie bei richtigen Kart-Spielen über selbst verdiente Turbos:
 *  - Kurven-Turbo: Wer eine Kurve innen durchfährt (ohne die Bande zu berühren), lädt Funken auf (blau → orange → lila);
 *    am Kurvenende gibt es Schub – je länger und enger, desto stärker.
 *  - Rechen-Turbo: Jede richtige Antwort füllt eine Anzeige mit 4 Feldern; bei der 4. gibt es Turbo (4 hintereinander
 *    richtig = Mega-Turbo). Eine falsche Antwort nimmt ein Feld weg und bremst kurz. Für die Computer-Fahrer gilt dasselbe.
 *  - Start-Turbo: Genau bei «LOS!» tippen gibt einen Raketenstart; zu früh tippen = kurzer Fehlstart.
 * Eigene Grafik und eigene Figuren (keine Vorlage aus anderen Spielen).
 */
'use strict';

const KART = {
  LAP: 1200, LAPS: 3, W: 21, BASE: 31,
  TURBO: 1.5, SLOW: 0.55, FX_MS: 1800,
  STATIONS: [0.15, 0.47, 0.79], ASK: 200, ZONE: 12,
  WALL: 1.6,     // Bande: so weit ausserhalb der Fahrbahn
  // Abgestimmt mit einer Renn-Simulation: starke Kinder gewinnen oft (etwa 6 von 10), aber nicht immer
  MT: [1.2, 2.4, 3.8], MT_MUL: [1, 1.08, 1.12, 1.16], MT_MS: [0, 450, 700, 950],   // Kurven-Turbo: Ladung (s) je Stufe, Schub, Dauer
  MATH_EVERY: 4, MATH_MUL: 1.35, MATH_MS: 2000, MEGA_MUL: 1.4, MEGA_MS: 2500,       // Rechen-Turbo bei jeder 4. richtigen Antwort
  START_MUL: 1.2, START_MS: 1000,                                                   // Start-Turbo
  GAIN: [0.9, 1.1],                                                                 // Innen-/Aussenbahn: höchstens 10 % kürzer bzw. länger
};
const KART_TRACKS = [
  { id: 'circuit', name: 'Rennstrecke', emo: '🏁' },
  { id: 'beach', name: 'Strand', emo: '🏖️' },
  { id: 'forest', name: 'Wald', emo: '🌲' },
  { id: 'mars', name: 'Mars', emo: '🪐' },
  { id: 'snow', name: 'Schneeland', emo: '❄️' },
  { id: 'city', name: 'Neon-Stadt', emo: '🌃' },
  { id: 'candy', name: 'Zuckerland', emo: '🍭' },
];
const kartTrackId = () => (KART_TRACKS.some((t) => t.id === db.settings.kartTrack) ? db.settings.kartTrack : 'circuit');

/** Strecke aus Eckpunkten [x, z, Höhe]: weiche, geschlossene Kurve hindurch (zentripetaler Catmull-Rom-Spline).
 *  Liefert f(t) für t = 0 … 2π (ein Abschnitt je Eckpunkt). */
function kartSpline(P) {
  const n = P.length;
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-3, 0.5);
  const lin = (a, b, ta, tb, x) => a.map((v, k) => ((tb - x) / (tb - ta)) * v + ((x - ta) / (tb - ta)) * b[k]);
  return (t) => {
    const u = ((((t / (2 * Math.PI)) % 1) + 1) % 1) * n;
    const i = Math.floor(u), f = u - i;
    const p0 = P[(i - 1 + n) % n], p1 = P[i % n], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), tt = t1 + (t2 - t1) * f;
    const A1 = lin(p0, p1, 0, t1, tt), A2 = lin(p1, p2, t1, t2, tt), A3 = lin(p2, p3, t2, t3, tt);
    return lin(lin(A1, A2, 0, t2, tt), lin(A2, A3, t1, t3, tt), t1, t2, tt);
  };
}
/** Streckenform aus Eckpunkten; tunnel: [von, bis] als Eckpunkt-Nummern (auch mit Komma) */
const kartPts = (pts, { tunnel = null, bridgeY = 99, minR = 19 } = {}) => ({ phi: 0, pts, f: kartSpline(pts), tunnelPts: tunnel, bridgeY, minR });

/** Ecken [x, z, Höhe, Radius?] → zwei Punkte vor und nach jeder Ecke (für Stadtkurse mit runden Ecken) */
function kartCorners(list, r) {
  const out = [], n = list.length;
  for (let i = 0; i < n; i++) {
    const a = list[(i - 1 + n) % n], b = list[i], c = list[(i + 1) % n], rr = b[3] || r;
    const d1 = Math.hypot(a[0] - b[0], a[1] - b[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k1 = Math.min(rr, d1 * 0.45) / d1, k2 = Math.min(rr, d2 * 0.45) / d2;
    out.push([b[0] + (a[0] - b[0]) * k1, b[1] + (a[1] - b[1]) * k1, b[2] + (a[2] - b[2]) * k1]);
    out.push([b[0] + (c[0] - b[0]) * k2, b[1] + (c[1] - b[1]) * k2, b[2] + (c[2] - b[2]) * k2]);
  }
  return out;
}

/* Streckenformen aus Eckpunkten [x, z, Höhe] (wie eine Skizze von oben). Die Strecke wird auf die Rundenlänge
 * skaliert und zu enge Kurven werden geweitet (mindestens 19 m Radius). Wo sich die Strecke kreuzt, wird die
 * höhere Stelle zur Brücke. tunnel: [von, bis] als Eckpunkt-Nummern. */
const KART_SHAPES = {
  circuit: kartPts([[-60, -100, 2], [40, -100, 2], [110, -98, 3], [150, -75, 4], [160, -30, 6], [135, 0, 8], [95, -10, 8], [70, -40, 7], [40, -45, 6], [20, -15, 6], [35, 20, 8], [80, 30, 10], [130, 45, 12], [160, 80, 12], [135, 110, 10], [85, 100, 8], [50, 75, 7], [10, 80, 6], [-25, 105, 6], [-75, 108, 5], [-110, 85, 5], [-95, 50, 6], [-55, 35, 7], [-50, 0, 6], [-85, -20, 5], [-130, -5, 4], [-170, -30, 3], [-165, -80, 2], [-130, -100, 2]], { tunnel: [17.5, 19.6] }),
  beach: kartPts([[-80, -100, 1], [0, -100, 1], [120, -100, 1], [160, -80, 2], [165, -40, 3], [140, -15, 4], [110, -30, 4], [85, -55, 4], [55, -50, 4], [45, -15, 5], [60, 25, 6], [55, 60, 7], [25, 75, 7], [0, 50, 6], [-5, 10, 5], [-25, -30, 4], [-55, -45, 4], [-80, -25, 5], [-75, 15, 6], [-60, 55, 8], [-85, 85, 8], [-125, 80, 6], [-140, 45, 5], [-160, 10, 4], [-180, -40, 3], [-170, -85, 2], [-140, -100, 1]], { tunnel: [10.6, 12.6] }),
  forest: kartPts([[20, -30, 1], [70, -80, 1], [120, -95, 1], [160, -70, 2], [150, -35, 3], [185, -5, 4], [170, 45, 6], [120, 70, 9], [60, 60, 12], [0, 0, 14], [-60, -60, 12], [-120, -70, 9], [-170, -45, 6], [-185, 5, 4], [-150, 35, 3], [-160, 70, 2], [-120, 95, 1], [-70, 80, 1], [-25, 35, 0]], { tunnel: [12.4, 14.4] }),
  mars: kartPts([[-120, -90, 2], [-20, -95, 2], [120, -90, 3], [175, -60, 4], [180, -10, 6], [150, 20, 8], [100, 10, 9], [60, -25, 9], [25, -40, 8], [0, -10, 8], [15, 35, 9], [60, 65, 10], [110, 80, 10], [150, 105, 9], [120, 135, 8], [40, 125, 7], [-20, 100, 6], [-50, 60, 5], [-80, 20, 5], [-110, 40, 6], [-120, 85, 7], [-150, 110, 6], [-190, 85, 4], [-195, 30, 3], [-185, -50, 2]], { tunnel: [16.4, 18.6] }),
  snow: kartPts([[-80, -110, 1], [0, -110, 1], [110, -105, 2], [160, -80, 3], [150, -45, 5], [90, -40, 7], [40, -45, 8], [-10, -50, 9], [-60, -40, 10], [-90, -15, 11], [-70, 15, 12], [-20, 10, 13], [40, 15, 14], [100, 5, 15], [140, 25, 15], [130, 60, 16], [80, 55, 17], [20, 60, 17], [-40, 65, 16], [-100, 60, 14], [-140, 85, 12], [-175, 60, 9], [-185, 10, 6], [-180, -50, 3], [-150, -100, 1]], { tunnel: [16.5, 18.6] }),
  city: kartPts(kartCorners([[-150, -100, 0], [150, -100, 0], [150, -10, 4], [70, -10, 8], [70, 50, 10], [150, 50, 12], [150, 120, 12], [10, 120, 10], [10, 30, 8], [-60, 30, 6], [-60, 100, 4], [-150, 100, 2]], 24), { tunnel: [21.3, 22.8] }),
  candy: kartPts([[-80, -92, 1], [-20, -95, 1], [100, -90, 2], [160, -60, 3], [170, -5, 5], [130, 40, 7], [95, 10, 8], [60, 45, 9], [25, 10, 9], [-10, 45, 8], [-45, 10, 7], [-80, 45, 6], [-120, 30, 5], [-150, 60, 4], [-185, 10, 3], [-180, -55, 2], [-140, -90, 1]], { tunnel: [13, 14.6] }),
};

/* Themen: Himmel, Licht, Boden, Strasse, Randsteine, Banden, Tunnel, Kulisse */
const KART_THEMES = {
  circuit: { sky: ['#2b67bd', '#86bff0', '#e6f1fb'], fog: 0xbfd8ef, fogNear: 180, fogFar: 1000, hemi: [0xdbeeff, 0x4f6b3a, 1.05], sun: 0xfff1d6, sunI: 2.6,
    ground: 'grass', road: 'asphalt', curb: ['#E53935', '#FFFFFF'], wall: 'barrier', tunnel: 'concrete', island: ['#FACC15', '#1F2937'], board: '#1E293B', mountains: 0x5f8a5a,
    props: ['stands', 'tires', 'trees', 'billboards', 'bushes', 'flowers', 'balloons'], bunting: ['#ef4444', '#facc15', '#3b82f6', '#22c55e', '#ffffff'], clouds: true },
  beach: { sky: ['#2f7cc7', '#94d0f6', '#ffe9c4'], fog: 0xd9ebf3, fogNear: 180, fogFar: 1000, hemi: [0xe6f4ff, 0x9a8156, 1.1], sun: 0xffe7c2, sunI: 2.7,
    ground: 'sand', road: 'asphaltLight', curb: ['#0EA5E9', '#FFFFFF'], wall: 'wood', tunnel: 'rock', island: ['#F97316', '#FFFFFF'], board: '#0E7490', mountains: 0xc9a26b,
    props: ['palms', 'umbrellas', 'huts', 'rocks', 'sea', 'lighthouse', 'surf'], bunting: ['#f97316', '#0ea5e9', '#facc15', '#ffffff'], clouds: true },
  forest: { sky: ['#3d76ab', '#a7c9df', '#e1ecdf'], fog: 0xa9c4a8, fogNear: 90, fogFar: 620, hemi: [0xd6ecd9, 0x2e4426, 1.05], sun: 0xfff0d0, sunI: 2.2,
    ground: 'forest', road: 'asphalt', curb: ['#FACC15', '#1F2937'], wall: 'logs', tunnel: 'rock', island: ['#84CC16', '#365314'], board: '#365314', mountains: 0x3e6b45,
    props: ['pines', 'oaks', 'mushrooms', 'rocks', 'bushes', 'flowers', 'cabins'], bunting: ['#facc15', '#f97316', '#84cc16'], lanterns: true, clouds: true },
  mars: { sky: ['#2a1410', '#a14a28', '#e8a26b'], fog: 0xc7764a, fogNear: 140, fogFar: 860, hemi: [0xffd2b0, 0x5a2414, 1.0], sun: 0xffd2a8, sunI: 2.3,
    ground: 'mars', road: 'marsRoad', curb: ['#F97316', '#F5F5F4'], wall: 'metal', tunnel: 'glass', island: ['#F5F5F4', '#9A3412'], board: '#7C2D12', mountains: 0x8a3b1e,
    props: ['marsRocks', 'craters', 'domes', 'antennas', 'rocket'], moons: true },
  snow: { sky: ['#3f7cc0', '#a9cbec', '#eef4fb'], fog: 0xdfe9f4, fogNear: 170, fogFar: 900, hemi: [0xeef6ff, 0x8fa6bf, 1.15], sun: 0xffffff, sunI: 2.3,
    ground: 'snow', road: 'ice', curb: ['#2563EB', '#FFFFFF'], wall: 'snow', tunnel: 'icecave', island: ['#2563EB', '#FFFFFF'], board: '#1E3A8A', mountains: 0xe8f0f8,
    props: ['snowPines', 'snowmen', 'rocks', 'igloos', 'crystals'], snowfall: true, clouds: true, bunting: ['#2563eb', '#ffffff', '#ef4444'] },
  city: { night: true, sky: ['#04050d', '#171035', '#3a1d5a'], fog: 0x1a1236, fogNear: 140, fogFar: 860, hemi: [0x9d8fff, 0x2a2348, 1.5], sun: 0xc9c2ff, sunI: 1.3,
    ground: 'city', road: 'nightRoad', curb: ['#22D3EE', '#F0ABFC'], wall: 'neon', tunnel: 'neon', island: ['#F0ABFC', '#312E81'], board: '#312E81', mountains: 0x1e1b4b,
    props: ['towers', 'lamps', 'beams', 'neonArches'], stars: true },
  candy: { sky: ['#f472b6', '#fbcfe8', '#fff1e6'], fog: 0xfbd5e6, fogNear: 220, fogFar: 1100, hemi: [0xfff0f6, 0xd9a273, 1.15], sun: 0xfff3e0, sunI: 2.3,
    ground: 'candy', road: 'choco', curb: ['#FFFFFF', '#F472B6'], wall: 'cake', tunnel: 'candy', island: ['#F472B6', '#FFFFFF'], board: '#9D174D', mountains: 0xf5b38a,
    props: ['lollipops', 'canes', 'cupcakes', 'donuts', 'gumdrops'], bunting: ['#f472b6', '#a78bfa', '#facc15', '#5eead4', '#ffffff'], clouds: true },
};

const KART_RACERS = [
  { name: 'Du', color: 0xff5a36, helmet: 0xffffff, num: 1 },
  { name: 'Blitz', color: 0x2f7bf5, helmet: 0xfacc15, num: 7 },
  { name: 'Komet', color: 0xf5c518, helmet: 0x1f2937, num: 3 },
  { name: 'Rakete', color: 0x16a34a, helmet: 0xffffff, num: 9 },
  { name: 'Wirbel', color: 0x8b5cf6, helmet: 0xf472b6, num: 5 },
  { name: 'Flitzer', color: 0x14b8a6, helmet: 0xf97316, num: 8 },
];
const kartHex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/* ---------------- Texturen ---------------- */
function kartNoise(g, w, h, n, colors, size = [1, 3]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = size[0] + Math.random() * (size[1] - size[0]);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
function kartGroundTex(kind, repeat = 260) {
  return canvasTex(256, 256, (g, w, h) => {
    const base = { grass: '#4c9a46', sand: '#e6cf9c', forest: '#3d6b34', mars: '#b4552f', snow: '#eef3f8', city: '#191a24', candy: '#a7e3c3' }[kind];
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (kind === 'grass') kartNoise(g, w, h, 5000, ['rgba(40,110,40,.5)', 'rgba(110,170,70,.4)', 'rgba(30,80,30,.35)'], [1, 3]);
    if (kind === 'sand') kartNoise(g, w, h, 6000, ['rgba(200,170,110,.5)', 'rgba(255,240,210,.5)', 'rgba(170,140,90,.3)'], [1, 2]);
    if (kind === 'forest') kartNoise(g, w, h, 4000, ['rgba(30,60,25,.6)', 'rgba(90,120,50,.45)', 'rgba(100,70,40,.4)'], [1, 4]);
    if (kind === 'mars') kartNoise(g, w, h, 6000, ['rgba(130,50,25,.55)', 'rgba(220,120,70,.45)', 'rgba(90,30,15,.4)'], [1, 3]);
    if (kind === 'snow') kartNoise(g, w, h, 3000, ['rgba(200,215,235,.6)', 'rgba(255,255,255,.8)', 'rgba(180,200,225,.4)'], [1, 3]);
    if (kind === 'candy') { kartNoise(g, w, h, 2500, ['rgba(255,255,255,.5)', 'rgba(120,200,160,.4)'], [1, 3]); for (let i = 0; i < 70; i++) { g.fillStyle = ['#f472b6', '#facc15', '#60a5fa', '#ffffff', '#a78bfa'][i % 5]; g.fillRect(Math.random() * w, Math.random() * h, 5, 2); } }
    if (kind === 'city') {
      g.strokeStyle = 'rgba(120,110,200,.18)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); }
      kartNoise(g, w, h, 1500, ['rgba(255,255,255,.04)', 'rgba(0,0,0,.25)'], [1, 3]);
    }
  }, { repeat: [repeat, repeat] });
}
function kartRoadTex(kind) {
  return canvasTex(256, 512, (g, w, h) => {
    const base = { asphalt: '#3b3e44', asphaltLight: '#5a5d63', marsRoad: '#7a3a22', ice: '#86a7c4', nightRoad: '#15151f', choco: '#5b3420' }[kind];
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const spots = kind === 'ice' ? ['rgba(255,255,255,.35)', 'rgba(120,150,180,.3)'] : kind === 'marsRoad' ? ['rgba(160,80,45,.4)', 'rgba(60,20,10,.35)'] : kind === 'choco' ? ['rgba(120,70,40,.5)', 'rgba(40,20,10,.35)'] : ['rgba(255,255,255,.05)', 'rgba(0,0,0,.18)', 'rgba(120,120,130,.12)'];
    kartNoise(g, w, h, 9000, spots, [1, 2]);
    if (kind === 'choco') { for (let i = 0; i < 160; i++) { g.fillStyle = ['#f472b6', '#facc15', '#60a5fa', '#ffffff', '#a78bfa', '#4ade80'][i % 6]; g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * 3); g.fillRect(-4, -1.5, 8, 3); g.restore(); } }
    // Reifenspuren in den drei Spuren
    if (kind !== 'choco' && kind !== 'ice') { g.fillStyle = 'rgba(0,0,0,.08)'; for (const u of [1 / 6, 1 / 2, 5 / 6]) { g.fillRect(w * u - 18, 0, 9, h); g.fillRect(w * u + 9, 0, 9, h); } }
    const line = kind === 'nightRoad' ? '#5eead4' : kind === 'ice' || kind === 'choco' ? '#ffffff' : 'rgba(255,255,255,.9)';
    g.fillStyle = line;
    g.fillRect(w * 0.02, 0, w * 0.014, h); g.fillRect(w * 0.966, 0, w * 0.014, h);
    g.fillStyle = kind === 'nightRoad' ? '#f0abfc' : 'rgba(255,255,255,.75)';
    for (const u of [1 / 3, 2 / 3]) for (let y = 0; y < h; y += 128) g.fillRect(w * u - 3, y, 6, 64);
  }, { repeat: [1, 1] });
}
function kartStripeTex(a, b, n = 2) {
  return canvasTex(16, 64, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(0, (i * h) / n, w, h / n); } });
}
function kartCubeTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#22d3ee'); gr.addColorStop(0.5, '#a78bfa'); gr.addColorStop(1, '#f472b6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 16; g.strokeRect(10, 10, w - 20, h - 20);
    g.font = NUM_FONT(170); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14; g.strokeStyle = 'rgba(30,20,70,.75)'; g.strokeText('?', w / 2, h / 2 + 8);
    g.fillStyle = '#ffffff'; g.fillText('?', w / 2, h / 2 + 8);
  });
}
function kartBoardTex(text, col) {
  return canvasTex(320, 180, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = col; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    let fs = 118; g.font = NUM_FONT(fs);
    const tw = g.measureText(text).width; if (tw > w - 40) { fs = Math.floor((fs * (w - 40)) / tw); g.font = NUM_FONT(fs); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#10282C'; g.fillText(text, w / 2, h / 2 + fs * 0.05);
  });
}
function kartCheckerTex(nx = 8, ny = 2) {
  return canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect((x * w) / nx, (y * h) / ny, w / nx, h / ny); } });
}
function kartSignTex(text, bg, fg = '#fff', w = 512, h = 128) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let fs = Math.round(h * 0.55); g.font = NUM_FONT(fs);
    const tw = g.measureText(text).width; if (tw > w - 30) { fs = Math.floor((fs * (w - 30)) / tw); g.font = NUM_FONT(fs); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}
/** Banden-Textur je Thema (u: entlang der Strecke, v: Höhe) */
function kartWallTex(kind) {
  return canvasTex(256, 64, (g, w, h) => {
    if (kind === 'barrier') { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e11d48'; g.fillRect((i * w) / 8, 0, w / 8, h); } g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, h - 8, w, 8); }
    if (kind === 'wood' || kind === 'logs') { g.fillStyle = kind === 'logs' ? '#7c4a26' : '#c08a52'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 3); for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h); }
    if (kind === 'metal') { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e5e7eb'); gr.addColorStop(1, '#6b7280'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#f97316'; g.fillRect(0, 6, w, 5); }
    if (kind === 'snow') { g.fillStyle = '#f8fbff'; g.fillRect(0, 0, w, h); kartNoise(g, w, h, 400, ['rgba(180,200,230,.5)', 'rgba(255,255,255,1)'], [2, 6]); }
    if (kind === 'neon') { g.fillStyle = '#0b0b18'; g.fillRect(0, 0, w, h); g.fillStyle = '#22d3ee'; g.fillRect(0, 8, w, 6); g.fillStyle = '#f0abfc'; g.fillRect(0, h - 18, w, 6); }
    if (kind === 'cake') { const cs = ['#fde68a', '#fbcfe8', '#fef3c7', '#f9a8d4']; for (let i = 0; i < 4; i++) { g.fillStyle = cs[i]; g.fillRect(0, (i * h) / 4, w, h / 4); } g.fillStyle = '#7c2d12'; g.fillRect(0, 0, w, 7); }
    if (kind === 'concrete') { g.fillStyle = '#cbd5e1'; g.fillRect(0, 0, w, h); kartNoise(g, w, h, 500, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.3)']); g.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 3, h); }
  }, { repeat: [1, 1] });
}
function kartChevronTex(dir) {
  return canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#facc15'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111827';
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 70;
      g.beginPath();
      if (dir > 0) { g.moveTo(x, 12); g.lineTo(x + 34, h / 2); g.lineTo(x, h - 12); g.lineTo(x + 18, h - 12); g.lineTo(x + 52, h / 2); g.lineTo(x + 18, 12); }
      else { g.moveTo(x + 52, 12); g.lineTo(x + 18, h / 2); g.lineTo(x + 52, h - 12); g.lineTo(x + 34, h - 12); g.lineTo(x, h / 2); g.lineTo(x + 34, 12); }
      g.closePath(); g.fill();
    }
  });
}

/* ---------------- Strecke ---------------- */
/** Zu enge Kurven weiten (Fahrbahn 21 m breit: unter ~18 m Radius würde sich der innere Rand überlappen).
 *  pts: geschlossener Linienzug [x, y, z]; liefert einen neuen mit Punkten alle 1 m, wieder auf die Rundenlänge skaliert. */
function kartRelax(pts, minR) {
  const res = (P, step) => {
    const n = P.length, cum = [0];
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
    const L = cum[n], m = Math.max(16, Math.round(L / step)), out = [];
    let j = 0;
    for (let i = 0; i < m; i++) {
      const s = (i / m) * L;
      while (cum[j + 1] < s) j++;
      const f = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]), a = P[j % n], b = P[(j + 1) % n];
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
    }
    return out;
  };
  let P = res(pts, 1);
  const n = P.length, idx = (i) => ((i % n) + n) % n;
  const radius = (i) => {
    const a = P[idx(i - 5)], b = P[i], c = P[idx(i + 5)];
    const A = Math.hypot(b[0] - c[0], b[2] - c[2]), Bd = Math.hypot(a[0] - c[0], a[2] - c[2]), C = Math.hypot(a[0] - b[0], a[2] - b[2]);
    const area = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / 2;
    return area > 1e-6 ? (A * Bd * C) / (4 * area) : 1e9;
  };
  for (let it = 0; it < 600; it++) {
    const tight = [];
    for (let i = 0; i < n; i++) if (radius(i) < minR) tight.push(i);
    if (!tight.length) break;
    const mark = new Float32Array(n);
    for (const i of tight) for (let d = -8; d <= 8; d++) mark[idx(i + d)] = Math.max(mark[idx(i + d)], 1 - Math.abs(d) / 9);
    const nxt = P.map((p) => p.slice());
    for (let i = 0; i < n; i++) {
      if (!mark[i]) continue;
      const a = P[idx(i - 1)], b = P[idx(i + 1)], k = 0.5 * mark[i];
      nxt[i][0] += ((a[0] + b[0]) / 2 - P[i][0]) * k; nxt[i][2] += ((a[2] + b[2]) / 2 - P[i][2]) * k;
    }
    P = nxt;
  }
  // wieder auf die Rundenlänge bringen (um die Mitte skalieren)
  let plan = 0, cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { const a = P[i], b = P[idx(i + 1)]; plan += Math.hypot(b[0] - a[0], b[2] - a[2]); cx += a[0] / n; cz += a[2] / n; }
  const k = KART.LAP / plan;
  return res(P.map(([x, y, z]) => [cx + (x - cx) * k, y, cz + (z - cz) * k]), 0.25);
}
function kartBuildTrack(shape, W) {
  const HW = W / 2, WL = HW + KART.WALL;
  // 1. fein abtasten, waagrecht auf die Rundenlänge skalieren
  const raw = [];
  for (let i = 0; i < 8000; i++) raw.push(shape.f((i / 8000) * 2 * Math.PI + shape.phi));
  let plan = 0;
  for (let i = 0; i < raw.length; i++) { const a = raw[i], b = raw[(i + 1) % raw.length]; plan += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const k = KART.LAP / plan;
  let pts = raw.map(([x, z, y]) => [x * k, y, z * k]);
  if (shape.tunnelPts) {   // Tunnel: Eckpunkt-Nummern → Anteil der Runde (vor dem Weiten der Kurven)
    const c0 = [0]; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; c0.push(c0[i] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
    const n = shape.pts.length; shape.tunnel = shape.tunnelPts.map((t) => c0[Math.round((t / n) * pts.length) % pts.length] / c0[pts.length]);
  }
  if (shape.minR) pts = kartRelax(pts, shape.minR);
  const M = pts.length;
  shape.scale = k;
  const cum = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) { const a = pts[i], b = pts[(i + 1) % M]; cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
  const len = cum[M];
  // 2. gleichmässig alle 0,5 m
  const N = Math.round(len * 2), ds = len / N;
  const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * ds;
    while (cum[j + 1] < s) j++;
    const f = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    const a = pts[j % M], b = pts[(j + 1) % M];
    X[i] = a[0] + (b[0] - a[0]) * f; Y[i] = a[1] + (b[1] - a[1]) * f; Z[i] = a[2] + (b[2] - a[2]) * f;
  }
  const idx = (i) => ((i % N) + N) % N;
  // 3. Richtung, Krümmung (rechts positiv), Steigung
  const FX = new Float32Array(N), FZ = new Float32Array(N), K = new Float32Array(N), SL = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = idx(i - 2), b = idx(i + 2);
    const fx = X[b] - X[a], fz = Z[b] - Z[a]; const l = Math.hypot(fx, fz) || 1;
    FX[i] = fx / l; FZ[i] = fz / l;
    SL[i] = (Y[b] - Y[a]) / (4 * ds);
  }
  for (let i = 0; i < N; i++) {
    const a = idx(i - 6), b = idx(i + 6);
    K[i] = (FX[a] * FZ[b] - FZ[a] * FX[b]) / (12 * ds);
  }
  // geglättete Krümmung → Überhöhung der Kurven
  const KS2 = new Float32Array(N), B = new Float32Array(N);
  const win = 30;
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -win; d <= win; d++) s += K[idx(i + d)]; KS2[i] = s / (2 * win + 1); }
  // 4. Abschnitte: 0 normal, 1 Brücke, 2 Tunnel
  const TY = new Uint8Array(N);
  const [t0, t1] = shape.tunnel || [2, 2];
  for (let i = 0; i < N; i++) { const u = i / N; if (u >= t0 && u <= t1) TY[i] = 2; }
  for (let i = 0; i < N; i++) if (!TY[i] && Y[i] > shape.bridgeY) TY[i] = 1;
  // Kreuzung: der obere Teil ist eine Brücke
  for (let i = 0; i < N; i += 4) for (let q = 0; q < N; q += 4) {
    const dIdx = Math.min(Math.abs(i - q), N - Math.abs(i - q));
    if (dIdx * ds < 90) continue;
    if (Math.hypot(X[i] - X[q], Z[i] - Z[q]) < W + 8 && Y[i] > Y[q] + 5) {
      for (let d = -100; d <= 100; d++) if (TY[idx(i + d)] !== 2) TY[idx(i + d)] = 1;
    }
  }
  // zu kurze Brücken weglassen (Damm statt Brücke)
  for (let i = 0; i < N; i++) {
    if (TY[i] !== 1 || TY[idx(i - 1)] === 1) continue;
    let n = 0; while (TY[idx(i + n)] === 1 && n < N) n++;
    if (n * ds < 30) for (let d = 0; d < n; d++) TY[idx(i + d)] = 0;
  }
  // Überhöhung (nicht im Tunnel; nahe am Boden nur so viel, dass der innere Rand nicht im Boden steckt)
  for (let i = 0; i < N; i++) {
    const b = TY[i] === 2 ? 0 : clamp(KS2[i] * 5, -0.15, 0.15);
    const maxB = Math.max(0, (Y[i] + 0.15) / (WL + 0.5));
    B[i] = clamp(b, -maxB, maxB);
  }
  // Überhöhung glätten (sonst Knicke)
  const B2 = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -10; d <= 10; d++) s += B[idx(i + d)]; B2[i] = s / 21; }
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < N; i++) { minX = Math.min(minX, X[i]); maxX = Math.max(maxX, X[i]); minZ = Math.min(minZ, Z[i]); maxZ = Math.max(maxZ, Z[i]); }
  const tr = { N, ds, len, X, Y, Z, FX, FZ, K: KS2, SL, B: B2, TY, HW, W, box: { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 } };
  tr.coarse = [];
  for (let i = 0; i < N; i += 12) tr.coarse.push(X[i], Z[i], Y[i], i);
  return tr;
}
/** Punkt auf der Strecke bei Strecke s (beliebig, wird auf eine Runde umgerechnet) */
function kartAt(tr, s, out = {}) {
  const L = tr.len;
  const u = ((((s % L) + L) % L) / L) * tr.N;
  const i0 = Math.floor(u) % tr.N, i1 = (i0 + 1) % tr.N, f = u - Math.floor(u);
  const mix = (A) => A[i0] * (1 - f) + A[i1] * f;
  out.x = mix(tr.X); out.y = mix(tr.Y); out.z = mix(tr.Z);
  let fx = mix(tr.FX), fz = mix(tr.FZ);
  const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
  out.fx = fx; out.fz = fz; out.rx = -fz; out.rz = fx; // r: rechts in Fahrtrichtung
  out.k = mix(tr.K); out.b = mix(tr.B); out.sl = mix(tr.SL); out.ty = tr.TY[i0];
  return out;
}
/** Höhe der Fahrbahn bei seitlich lat (überhöhte Kurven: innen tiefer) */
const kartH = (q, lat) => q.y - lat * q.b;
/** waagrechter Abstand zur Strecke und deren Höhe dort */
function kartNear(tr, x, z) {
  let best = 1e18, y = 0, idx = 0;
  const c = tr.coarse;
  for (let i = 0; i < c.length; i += 4) { const dx = c[i] - x, dz = c[i + 1] - z; const d = dx * dx + dz * dz; if (d < best) { best = d; y = c[i + 2]; idx = c[i + 3]; } }
  return { d: Math.sqrt(best), y, idx };
}
/** Gitter entlang der Strecke: pro Zeile (Strecke s) Spalten aus fn(q, spalte, s) → [x, y, z, u, v]. Nur Abschnitte mit keep(i). */
function kartGrid(T, tr, cols, fn, { keep = null, step = 4, vScale = 8, shade = null } = {}) {
  const pos = [], uv = [], ind = [], col = [];
  const q = {};
  let prevKept = false;
  const N = tr.N;
  for (let i = 0; i <= N; i += step) {
    const ii = i % N;
    if (keep && !keep(ii)) { prevKept = false; continue; }
    kartAt(tr, i * tr.ds, q);
    const base = pos.length / 3;
    for (let c = 0; c < cols; c++) {
      const p = fn(q, c, i * tr.ds);
      pos.push(p[0], p[1], p[2]);
      uv.push(p[3] ?? c / (cols - 1), p[4] ?? (i * tr.ds) / vScale);
      if (shade) { const k = shade(ii); col.push(k, k, k); }
    }
    if (prevKept) {
      const a0 = base - cols;
      for (let c = 0; c < cols - 1; c++) { const A = a0 + c, Bv = a0 + c + 1, Cv = base + c, D = base + c + 1; ind.push(A, Bv, Cv, Bv, D, Cv); }
    }
    prevKept = true;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  if (shade) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(ind);
  g.computeVertexNormals();
  return g;
}

/* ---------------- Kart ---------------- */
/* ---------------- Garage-Optik ----------------
   Nur das Aussehen: Lack, Lackart, Muster, Felgen, Spoiler, Auspuff, Turbo-Flammen, Unterboden-Licht, Helm.
   Alle Karts fahren gleich schnell – die Fahrphysik schaut sich diese Werte nie an. */
const KART_LOOK0 = { paint: 0xff5a36, paint2: 0xffffff, finish: 'gloss', pattern: 'none', rims: 'classic', wing: 'standard', exhaust: 'chrome', flames: 'classic', glow: 'none', topper: 'none', helmet: 0xffffff, visor: 'dark', num: 1 };
const KART_FLAMES = {
  classic: ['rgba(255,240,180,1)', 'rgba(255,90,20,0)', 0xffffff],
  blue: ['rgba(220,250,255,1)', 'rgba(30,120,255,0)', 0xbfe9ff],
  green: ['rgba(235,255,200,1)', 'rgba(40,220,90,0)', 0xd9ffb0],
  violet: ['rgba(255,225,255,1)', 'rgba(160,60,255,0)', 0xf0c8ff],
  plasma: ['rgba(255,255,255,1)', 'rgba(255,60,190,0)', 0xffd6f3],
  rainbow: ['rgba(255,255,255,1)', 'rgba(255,255,255,0)', 0xff4040],
  gold: ['rgba(255,250,220,1)', 'rgba(255,190,0,0)', 0xffe08a],
  sun: ['rgba(255,255,255,1)', 'rgba(255,230,120,0)', 0xfff7d6],
  ice: ['rgba(240,255,255,1)', 'rgba(120,220,255,0)', 0xd9f7ff],
  shadow: ['rgba(200,160,255,1)', 'rgba(40,0,80,0)', 0x8b5cf6],
};
const KART_GLOWS = { cyan: 0x22d3ee, pink: 0xf472b6, green: 0x4ade80, gold: 0xfacc15, violet: 0xa78bfa, rainbow: 0xff4040, red: 0xef4444, orange: 0xfb923c, white: 0xf8fafc };
const kartLookOf = (look) => ({ ...KART_LOOK0, ...(look || {}) });

function kartRimTex(style = 'classic') {
  return canvasTex(128, 128, (g, w) => {
    const r = w / 2, P2 = Math.PI * 2;
    g.fillStyle = '#17181c'; g.fillRect(0, 0, w, w);
    const disc = (c0, c1) => { const gr = g.createRadialGradient(r, r, 4, r, r, r * 0.62); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.arc(r, r, r * 0.62, 0, P2); g.fill(); };
    const hub = (c) => { g.fillStyle = c; g.beginPath(); g.arc(r, r, r * 0.12, 0, P2); g.fill(); };
    if (style === 'star' || style === 'gold') {
      disc(style === 'gold' ? '#fff3b0' : '#f1f5f9', style === 'gold' ? '#c98a00' : '#94a3b8');
      g.fillStyle = style === 'gold' ? '#7a5200' : '#334155';
      for (let i = 0; i < 5; i++) {                                         // Löcher zwischen den Sternspeichen
        const a = (i / 5) * P2 + Math.PI / 5;
        g.beginPath(); g.moveTo(r + Math.cos(a - 0.42) * r * 0.2, r + Math.sin(a - 0.42) * r * 0.2);
        g.lineTo(r + Math.cos(a - 0.3) * r * 0.55, r + Math.sin(a - 0.3) * r * 0.55); g.lineTo(r + Math.cos(a + 0.3) * r * 0.55, r + Math.sin(a + 0.3) * r * 0.55);
        g.lineTo(r + Math.cos(a + 0.42) * r * 0.2, r + Math.sin(a + 0.42) * r * 0.2); g.closePath(); g.fill();
      }
      hub(style === 'gold' ? '#fff3b0' : '#e2e8f0');
    } else if (style === 'turbine') {
      disc('#e5e7eb', '#6b7280');
      g.strokeStyle = '#1f2937'; g.lineWidth = 4;
      for (let i = 0; i < 14; i++) { const a = (i / 14) * P2; g.beginPath(); g.moveTo(r + Math.cos(a) * r * 0.16, r + Math.sin(a) * r * 0.16); g.quadraticCurveTo(r + Math.cos(a + 0.5) * r * 0.42, r + Math.sin(a + 0.5) * r * 0.42, r + Math.cos(a + 0.75) * r * 0.6, r + Math.sin(a + 0.75) * r * 0.6); g.stroke(); }
      hub('#f97316');
    } else if (style === 'spoke') {
      disc('#f8fafc', '#cbd5e1');
      g.strokeStyle = '#475569'; g.lineWidth = 2;
      for (let i = 0; i < 24; i++) { const a = (i / 24) * P2; g.beginPath(); g.moveTo(r + Math.cos(a) * r * 0.12, r + Math.sin(a) * r * 0.12); g.lineTo(r + Math.cos(a + 0.35) * r * 0.6, r + Math.sin(a + 0.35) * r * 0.6); g.stroke(); }
      g.lineWidth = 5; g.strokeStyle = '#e2e8f0'; g.beginPath(); g.arc(r, r, r * 0.6, 0, P2); g.stroke();
      hub('#94a3b8');
    } else if (style === 'black') {
      disc('#4b5563', '#111827');
      g.fillStyle = '#030712';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * P2; g.beginPath(); g.ellipse(r + Math.cos(a) * r * 0.36, r + Math.sin(a) * r * 0.36, r * 0.14, r * 0.08, a, 0, P2); g.fill(); }
      hub('#ef4444');
    } else if (style === 'neon') {
      g.fillStyle = '#0b1020'; g.beginPath(); g.arc(r, r, r * 0.62, 0, P2); g.fill();
      g.strokeStyle = '#22d3ee'; g.lineWidth = 7; g.beginPath(); g.arc(r, r, r * 0.55, 0, P2); g.stroke();
      g.lineWidth = 4; g.strokeStyle = '#f472b6';
      for (let i = 0; i < 3; i++) { const a = (i / 3) * P2; g.beginPath(); g.moveTo(r, r); g.lineTo(r + Math.cos(a) * r * 0.5, r + Math.sin(a) * r * 0.5); g.stroke(); }
      hub('#a5f3fc');
    } else {
      disc('#f1f5f9', '#94a3b8');
      g.fillStyle = '#334155';
      for (let i = 0; i < 5; i++) { const a = (i / 5) * P2 + 0.3; g.beginPath(); g.ellipse(r + Math.cos(a) * r * 0.34, r + Math.sin(a) * r * 0.34, r * 0.13, r * 0.07, a, 0, P2); g.fill(); }
      hub('#e2e8f0');
    }
  });
}

/** Wanne: UV-Koordinaten als Atlas – oben im Bild die Ansicht von oben, unten die Seitenansicht.
    Beide Bereiche haben gleich viele Bildpunkte pro Meter, so bleiben Sterne und Punkte rund. */
function kartBodyUV(T, geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox, p = geo.attributes.position, n = p.count;
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
  const ht = sx / (sx + sy);                                      // Anteil der Draufsicht an der Bildhöhe
  const uv = new Float32Array(n * 2);
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e = new T.Vector3(), nn = new T.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nn.subVectors(c, b).cross(e.subVectors(a, b)).normalize();
    const side = Math.abs(nn.x) > 0.62;
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      uv[(i + k) * 2] = (v.z - bb.min.z) / sz;
      uv[(i + k) * 2 + 1] = side ? (1 - ht) * (v.y - bb.min.y) / sy : 1 - ht * (v.x - bb.min.x) / sx;
    }
  }
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geo.userData.dims = { sx, sy, sz };
  return geo;
}
/** Lack mit Muster als Bild (Grundfarbe + zweite Farbe). a: 0 hinten … 1 vorne; c: quer; h: Höhe */
function kartPaintTex(L, dims) {
  const c1 = kartHex(L.paint), c2 = kartHex(L.paint2);
  const W = 1024, H = Math.round((W * (dims.sx + dims.sy)) / dims.sz), Ht = Math.round((H * dims.sx) / (dims.sx + dims.sy)), Hs = H - Ht;
  return canvasTex(W, H, (g) => {
    g.fillStyle = c1; g.fillRect(0, 0, W, H);
    const TP = (a, c) => [a * W, c * Ht];                          // Draufsicht
    const SP = (a, h) => [a * W, Ht + (1 - h) * Hs];               // Seite
    const poly = (pts) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); };
    const band = (P, a0, a1, b0, b1) => poly([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)]);
    const star = ([x, y], s, rot = 0) => { g.beginPath(); for (let i = 0; i < 10; i++) { const an = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } g.closePath(); g.fill(); };
    const dot = ([x, y], s) => { g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); };
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = c2; g.strokeStyle = c2; g.lineJoin = 'round'; g.lineCap = 'round';
    switch (L.pattern) {
      case 'racing':
        band(TP, 0, 1, 0.34, 0.44); band(TP, 0, 1, 0.56, 0.66);
        band(SP, 0, 1, 0.46, 0.56); band(SP, 0, 1, 0.6, 0.64);
        break;
      case 'center':
        band(TP, 0, 1, 0.38, 0.62); g.fillStyle = c1; band(TP, 0, 1, 0.41, 0.59); g.fillStyle = c2; band(TP, 0, 1, 0.45, 0.55);
        band(SP, 0.05, 1, 0.62, 0.66);
        break;
      case 'duo':
        poly([TP(0.62, 0), TP(1, 0), TP(1, 1), TP(0.62, 1), TP(0.54, 0.5)]);
        poly([SP(0.66, 0), SP(1, 0), SP(1, 1), SP(0.54, 1)]);
        break;
      case 'checker': {
        const s = Ht / 7;
        for (let i = 0; i * s < W * 0.4; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2) g.fillRect(W - (i + 1) * s, j * s, s, s);
        for (let i = 0; i * s < W * 0.4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) g.fillRect(W - (i + 1) * s, Ht + Hs * 0.3 + j * s, s, s);
        break;
      }
      case 'stars':
        for (let i = 0; i < 34; i++) star(TP(rnd(), 0.06 + rnd() * 0.88), 14 + rnd() * 18, rnd());
        for (let i = 0; i < 30; i++) star(SP(rnd(), 0.2 + rnd() * 0.7), 12 + rnd() * 16, rnd());
        break;
      case 'dots':
        for (let y = 0; y < 6; y++) for (let x = 0; x < 15; x++) dot(TP((x + (y % 2) * 0.5 + 0.3) / 15, (y + 0.5) / 6), 15);
        for (let y = 0; y < 5; y++) for (let x = 0; x < 15; x++) dot(SP((x + (y % 2) * 0.5 + 0.3) / 15, 0.12 + y * 0.19), 13);
        break;
      case 'lightning': {
        const bolt = (pts, w) => { g.lineWidth = w; g.lineJoin = 'miter'; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); };
        bolt([TP(0, 0.5), TP(0.2, 0.34), TP(0.38, 0.66), TP(0.58, 0.34), TP(0.78, 0.66), TP(1, 0.5)], 30);
        bolt([SP(0, 0.5), SP(0.18, 0.7), SP(0.36, 0.34), SP(0.56, 0.7), SP(0.76, 0.34), SP(1, 0.55)], 22);
        break;
      }
      case 'flames': {
        // Flammenzungen von der Nase nach hinten
        const tongue = (P, c0, w, len, wav) => {
          g.beginPath(); g.moveTo(...P(1, c0 - w));
          g.bezierCurveTo(...P(1 - len * 0.4, c0 - w * 1.3), ...P(1 - len * 0.75, c0 + wav), ...P(1 - len, c0 + wav * 0.6));
          g.bezierCurveTo(...P(1 - len * 0.7, c0 + w * 0.2 + wav * 0.5), ...P(1 - len * 0.35, c0 + w * 1.2), ...P(1, c0 + w)); g.fill();
        };
        const lens = [0.42, 0.62, 0.78, 0.84, 0.66, 0.46];
        const all = (col, f) => { g.fillStyle = col; for (let i = 0; i < 6; i++) tongue(TP, 0.09 + i * 0.165, 0.09 * f, lens[i] * f, (i % 2 ? 0.05 : -0.05)); for (let i = 0; i < 4; i++) tongue(SP, 0.25 + i * 0.17, 0.1 * f, (0.5 + (i % 2) * 0.18) * f, 0.06); };
        all(c2, 1);
        g.globalAlpha = 0.9; all('#ffd34d', 0.55); g.globalAlpha = 1;
        break;
      }
      default: break;
    }
  });
}
function kartPaintMat(T, L, map) {
  const o = { color: map ? 0xffffff : L.paint, map: map || null };
  switch (L.finish) {
    case 'matte': return new T.MeshPhysicalMaterial({ ...o, metalness: 0, roughness: 0.82 });
    case 'metal': return new T.MeshPhysicalMaterial({ ...o, metalness: 0.85, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
    case 'pearl': return new T.MeshPhysicalMaterial({ ...o, metalness: 0.25, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620] });
    case 'chrome': return new T.MeshPhysicalMaterial({ ...o, metalness: 1, roughness: 0.07, clearcoat: 1 });
    case 'glow': return new T.MeshPhysicalMaterial({ ...o, metalness: 0.2, roughness: 0.35, clearcoat: 1, emissive: L.paint, emissiveIntensity: 0.45, emissiveMap: map || null });
    default: return new T.MeshPhysicalMaterial({ ...o, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  }
}

function kartTireTex() {
  return canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#17181c'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2c33'; for (let y = 0; y < h; y += 16) { g.fillRect(0, y, w / 2 - 3, 7); g.fillRect(w / 2 + 3, y + 8, w / 2 - 3, 7); } });
}
function kartNumTex(n, color) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = kartHex(color); g.stroke();
    g.font = NUM_FONT(78); g.fillStyle = '#111827'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, h / 2 + 4);
  });
}
const KART_SHARED = {};
/** Ein Kart. look: Garage-Optik (sonst Standard mit color/num); driver: Avatar-Bauplan der Person am Steuer.
    Im Stil der Avatare (js/kartvox.js), wenn geladen; sonst das einfache Kart mit Helm-Fahrer. */
function kartModel(T, color, helmetColor, num, look = null, driver = null, opts = {}) {
  if (typeof kartVoxModel === 'function') {
    try { return kartVoxModel(T, look || { paint: color, num }, driver, opts); } catch (e) { console.warn('Kart im Avatar-Stil', e); }
  }
  return kartModelClassic(T, color, helmetColor, num, look);
}
function kartModelClassic(T, color, helmetColor, num, look = null) {
  const S = KART_SHARED;
  if (!S.tire || S.T !== T) {
    S.T = T;
    S.rims = {};
    S.treadMat = new T.MeshStandardMaterial({ map: kartTireTex(), roughness: 0.85 });
    S.tire = new T.CylinderGeometry(0.42, 0.42, 0.38, 26, 1);
    S.dark = new T.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.3, roughness: 0.6 });
    S.carbon = new T.MeshStandardMaterial({ color: 0x2b2f38, metalness: 0.5, roughness: 0.35 });
    S.chrome = new T.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 1, roughness: 0.15 });
    S.gold = new T.MeshStandardMaterial({ color: 0xf5b400, metalness: 1, roughness: 0.2 });
    S.blackPipe = new T.MeshStandardMaterial({ color: 0x111827, metalness: 0.6, roughness: 0.4 });
    S.glove = new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
    S.visor = new T.MeshPhysicalMaterial({ color: 0x0f172a, metalness: 0.5, roughness: 0.05, clearcoat: 1 });
    S.visorGold = new T.MeshPhysicalMaterial({ color: 0xf5b400, metalness: 1, roughness: 0.08, clearcoat: 1 });
    S.visorMirror = new T.MeshPhysicalMaterial({ color: 0x60a5fa, metalness: 1, roughness: 0.05, clearcoat: 1 });
    S.visorRainbow = new T.MeshPhysicalMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.08, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 900] });
    S.light = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4cc, emissiveIntensity: 1.6 });
    S.tail = new T.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 1.2 });
    // Wanne: Seitenprofil (vorne = +x im Profil), in der Breite ausgezogen, mit runden Kanten
    const sh = new T.Shape();
    sh.moveTo(-1.32, 0.2); sh.lineTo(1.2, 0.2); sh.quadraticCurveTo(1.62, 0.22, 1.62, 0.36); sh.lineTo(1.05, 0.5);
    sh.lineTo(0.42, 0.6); sh.quadraticCurveTo(0.2, 0.66, 0.06, 0.58); sh.lineTo(-0.5, 0.58); sh.quadraticCurveTo(-0.8, 0.98, -1.18, 0.98);
    sh.lineTo(-1.32, 0.82); sh.closePath();
    const bg = new T.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, curveSegments: 10 });
    bg.rotateY(-Math.PI / 2); bg.translate(0.45, 0, 0);
    S.body = kartBodyUV(T, bg);
    S.pod = new T.CapsuleGeometry(0.2, 0.6, 6, 12); S.pod.rotateX(Math.PI / 2);
    S.bumper = new T.CapsuleGeometry(0.12, 1.4, 4, 10); S.bumper.rotateZ(Math.PI / 2);
    S.glowTex = glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  }
  const L = kartLookOf(look || { paint: color, helmet: helmetColor, num });
  if (!S.rims[L.rims]) {
    const tex = kartRimTex(L.rims);
    S.rims[L.rims] = L.rims === 'neon' ? new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.4 })
      : new T.MeshStandardMaterial({ map: tex, roughness: L.rims === 'gold' ? 0.2 : 0.35, metalness: L.rims === 'black' ? 0.4 : 0.7 });
  }
  const tireMat = [S.treadMat, S.rims[L.rims], S.rims[L.rims]];
  const g = new T.Group();
  const own = [];                                                 // eigene Materialien und Bilder (zum Aufräumen)
  const mat = (m) => { own.push(m); return m; };
  const paintTex = L.pattern !== 'none' ? kartPaintTex(L, S.body.userData.dims) : null;
  if (paintTex) own.push(paintTex);
  const paintBody = mat(kartPaintMat(T, L, paintTex));
  const paint = paintTex ? mat(kartPaintMat(T, L, null)) : paintBody;
  const paint2 = mat(kartPaintMat(T, { ...L, paint: L.paint2 }, null));
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = g) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; parent.add(o); return o; };
  const body = new T.Group(); g.add(body);
  add(S.body, paintBody, 0, 0.02, 0, 0, 0, 0, body);                                        // Wanne
  for (const sx of [1, -1]) {
    add(S.pod, L.pattern === 'duo' ? paint2 : paint, sx * 0.82, 0.42, 0, 0, 0, 0, body);      // Seitenkästen
    add(new T.BoxGeometry(0.3, 0.24, 0.06), S.dark, sx * 0.82, 0.42, 0.52, 0, 0, 0, body);   // Lufteinlass
  }
  add(S.bumper, S.carbon, 0, 0.28, 1.84, 0, 0, 0, body);                                     // Stossstange
  add(new T.BoxGeometry(2.05, 0.06, 0.4), S.carbon, 0, 0.24, 1.7, 0, 0, 0, body);            // Frontflügel
  for (const x of [1.02, -1.02]) add(new T.BoxGeometry(0.05, 0.26, 0.46), S.carbon, x, 0.32, 1.7, 0, 0, 0, body);
  // Heckflügel: Standard, gross, doppelt, mit Haifischflosse oder als kurzer Entenbürzel
  if (L.wing === 'big') {
    add(new T.BoxGeometry(2.15, 0.08, 0.62), paint2, 0, 1.52, -1.34, -0.12, 0, 0, body);
    for (const x of [1.08, -1.08]) add(new T.BoxGeometry(0.06, 0.62, 0.74), paint, x, 1.38, -1.34, 0, 0, 0, body);
    for (const x of [0.38, -0.38]) add(new T.BoxGeometry(0.07, 0.86, 0.14), S.carbon, x, 1.05, -1.24, 0, 0, 0, body);
  } else if (L.wing === 'double') {
    add(new T.BoxGeometry(1.9, 0.07, 0.48), paint, 0, 1.16, -1.3, -0.06, 0, 0, body);
    add(new T.BoxGeometry(1.9, 0.07, 0.4), paint2, 0, 1.42, -1.38, -0.16, 0, 0, body);
    for (const x of [0.96, -0.96]) add(new T.BoxGeometry(0.05, 0.62, 0.66), S.carbon, x, 1.22, -1.32, 0, 0, 0, body);
    for (const x of [0.4, -0.4]) add(new T.BoxGeometry(0.06, 0.5, 0.14), S.carbon, x, 0.9, -1.22, 0, 0, 0, body);
  } else if (L.wing === 'duck') {
    add(new T.BoxGeometry(1.5, 0.1, 0.42), paint, 0, 1.0, -1.36, -0.32, 0, 0, body);
    add(new T.BoxGeometry(1.5, 0.05, 0.12), paint2, 0, 1.08, -1.56, -0.32, 0, 0, body);
  } else {
    add(new T.BoxGeometry(1.85, 0.07, 0.5), paint, 0, 1.2, -1.3, -0.08, 0, 0, body);
    for (const x of [0.93, -0.93]) add(new T.BoxGeometry(0.05, 0.42, 0.62), S.carbon, x, 1.1, -1.3, 0, 0, 0, body);
    for (const x of [0.4, -0.4]) add(new T.BoxGeometry(0.06, 0.5, 0.14), S.carbon, x, 0.9, -1.22, 0, 0, 0, body);
    if (L.wing === 'fin') {
      // Haifischflosse: auf der Motorhaube, hinten am höchsten
      const fin = new T.Shape(); fin.moveTo(0, 0); fin.lineTo(0.78, 0); fin.lineTo(0.76, 0.62); fin.quadraticCurveTo(0.42, 0.16, 0, 0);
      const fg = new T.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }); fg.translate(0, 0, -0.025); fg.rotateY(Math.PI / 2);
      add(fg, paint2, 0, 0.9, -0.62, 0, 0, 0, body);
    }
  }
  add(new T.BoxGeometry(0.86, 0.42, 0.6), S.dark, 0, 0.7, -0.98, 0, 0, 0, body);              // Motor
  const pipeMat = L.exhaust === 'gold' ? S.gold : L.exhaust === 'black' ? S.blackPipe : S.chrome;
  add(new T.CylinderGeometry(0.24, 0.24, 0.5, 14), pipeMat, 0, 0.98, -0.95, 0, 0, Math.PI / 2, body);
  const pipe = new T.CylinderGeometry(0.08, 0.1, 0.62, 12);
  const pipes = L.exhaust === 'quad' ? [0.38, 0.16, -0.16, -0.38] : [0.26, -0.26];
  for (const x of pipes) add(pipe, pipeMat, x, 0.72, -1.42, Math.PI / 2 - 0.35, 0, 0, body);   // Auspuff
  for (const x of [0.3, -0.3]) add(new T.CircleGeometry(0.08, 16), S.light, x, 0.3, 1.745, 0, 0, 0, body);           // Scheinwerfer
  for (const x of [0.55, -0.55]) add(new T.BoxGeometry(0.2, 0.08, 0.04), S.tail, x, 0.62, -1.47, 0, 0, 0, body);      // Rücklichter
  // Startnummer vorne und an den Seitenkästen
  const numTex = kartNumTex(L.num, L.paint); own.push(numTex);
  const numMat = mat(new T.MeshStandardMaterial({ map: numTex, roughness: 0.4, transparent: true }));
  add(new T.CircleGeometry(0.22, 24), numMat, 0, 0.6, 1.07, -1.15, 0, 0, body);
  add(new T.CircleGeometry(0.17, 24), numMat, 1.025, 0.43, 0, 0, Math.PI / 2, 0, body);
  add(new T.CircleGeometry(0.17, 24), numMat, -1.025, 0.43, 0, 0, -Math.PI / 2, 0, body);
  add(new T.BoxGeometry(0.72, 0.5, 0.12), S.dark, 0, 0.85, -0.5, -0.25, 0, 0, body);           // Sitz
  add(new T.TorusGeometry(0.21, 0.035, 8, 24), S.dark, 0, 0.97, 0.36, -1.05, 0, 0, body);      // Lenkrad
  add(new T.CylinderGeometry(0.04, 0.04, 0.4, 8), S.dark, 0, 0.85, 0.5, -1.05, 0, 0, body);
  // Fahrerin/Fahrer: Anzug, Arme, Handschuhe, Helm mit Visier und Streifen
  const suit = mat(new T.MeshStandardMaterial({ color: new T.Color(L.paint).multiplyScalar(0.55), roughness: 0.6 }));
  add(new T.CapsuleGeometry(0.28, 0.34, 6, 14), suit, 0, 1.02, -0.28, -0.18, 0, 0, body);
  for (const sx of [1, -1]) {
    add(new T.CapsuleGeometry(0.08, 0.42, 4, 8), suit, sx * 0.26, 1.03, 0.04, -1.1, 0, sx * 0.35, body);
    add(new T.SphereGeometry(0.085, 10, 8), S.glove, sx * 0.17, 1.0, 0.33, 0, 0, 0, body);
  }
  const helmet = mat(new T.MeshPhysicalMaterial({ color: L.helmet, metalness: 0.2, roughness: 0.25, clearcoat: 1 }));
  add(new T.SphereGeometry(0.31, 24, 18), helmet, 0, 1.46, -0.18, 0, 0, 0, body);
  const visor = { gold: S.visorGold, mirror: S.visorMirror, rainbow: S.visorRainbow }[L.visor] || S.visor;
  add(new T.SphereGeometry(0.315, 24, 12, Math.PI / 2 - 1.15, 2.3, 1.05, 0.75), visor, 0, 1.46, -0.18, 0, 0, 0, body);
  add(new T.TorusGeometry(0.31, 0.03, 8, 30, Math.PI), paint, 0, 1.46, -0.18, 0, Math.PI / 2, 0, body);
  // Räder (vorne lenkbar) mit Profil und Felgen
  const wheels = [];
  for (const [x, z, front, r] of [[0.95, 1.05, 1, 0.92], [-0.95, 1.05, 1, 0.92], [1.0, -0.95, 0, 1], [-1.0, -0.95, 0, 1]]) {
    const steer = new T.Group(); steer.position.set(x, 0.42 * r, z); g.add(steer);
    const spin = new T.Group(); steer.add(spin);
    const w = add(S.tire, tireMat, 0, 0, 0, 0, 0, Math.PI / 2, spin); w.scale.set(r, front ? 0.85 : 1, r);
    wheels.push({ steer, spin, front, r: 0.42 * r });
  }
  // Turbo-Flammen (Farbe aus der Garage)
  const F = KART_FLAMES[L.flames] || KART_FLAMES.classic;
  const flameTex = glowTex(F[0], F[1]); own.push(flameTex);
  const flameMat = mat(new T.SpriteMaterial({ map: flameTex, color: F[2], transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  const flames = pipes.filter((x, i) => pipes.length === 2 || i === 0 || i === 3).map((x) => { const s = new T.Sprite(flameMat); s.position.set(x * (pipes.length === 4 ? 0.85 : 1), 0.82, -1.8); s.scale.set(0.01, 0.01, 1); g.add(s); return s; });
  // Unterboden-Licht
  let glow = null;
  if (KART_GLOWS[L.glow]) {
    const gm = mat(new T.MeshBasicMaterial({ map: S.glowTex, color: KART_GLOWS[L.glow], transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }));
    glow = new T.Mesh(new T.PlaneGeometry(2.8, 4.4), gm); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.04; glow.renderOrder = 2;
    g.add(glow);
  }
  const rainbow = L.flames === 'rainbow', glowRainbow = L.glow === 'rainbow';
  /** pro Bild: Regenbogen-Farben und Leuchten pulsieren lassen */
  const tick = (t) => {
    if (rainbow) flameMat.color.setHSL((t * 0.6) % 1, 1, 0.6);
    if (glow) { glow.material.opacity = 0.7 + Math.sin(t * 3) * 0.15; if (glowRainbow) glow.material.color.setHSL((t * 0.25) % 1, 1, 0.55); }
  };
  const dispose = () => { own.forEach((o) => o.dispose?.()); };
  return { g, body, wheels, flames, glow, tick, look: L, dispose };
}

/* ---------------- Spiel ---------------- */
async function startKart3D() {
  const T = await loadThree();
  await loadNumFont();
  // Karts, Figuren und Kulisse im Stil der Avatare (js/avatar3d.js + js/kartvox.js, erst jetzt geladen)
  if (typeof w3LoadEngine === 'function') await w3LoadEngine().catch((e) => console.warn('Avatar-Baukasten', e));
  const tid = kartTrackId(), TH = KART_THEMES[tid], SH = KART_SHAPES[tid];
  Object.assign(game, { picker: gamePicker(), over: false, cleanups: game.cleanups || [] });
  $('#view').innerHTML = gameShell('kart', `
    <div class="g3 g3-kart theme-${tid}" id="g3">
      <div class="kart-hud tl"><div class="kart-pos"><b id="kplace">–</b><small>/6</small></div><span class="kart-lap" id="klap">Runde 1/${KART.LAPS}</span><span class="kart-math" id="kmath" title="Richtige Antworten bis zum Turbo"><b>⚡</b><i></i><i></i><i></i><i></i></span><ol class="kart-rank" id="krank"></ol></div>
      <canvas class="kart-map" id="kmap" width="300" height="300" aria-hidden="true"></canvas>
      <div class="kart-time" id="ktime">0,0 s</div>
      <div class="kart-ask" id="kask" hidden><small id="kaskhint">Fahr durch das richtige Ergebnis</small><b id="ktask"></b><div class="kart-ans" id="kans"></div></div>
      <div class="kart-lines" id="klines"></div>
      <div class="kart-mt" id="kmt" aria-hidden="true"><b>🔥</b><span id="kmttxt">Kurven-Turbo</span><i><i id="kmtbar"></i><u></u><u></u></i></div>
      <div class="kart-start-hint" id="kstarthint" hidden>Tippe genau bei <b>LOS!</b> – Raketenstart!</div>
      <div class="kart-pad l" id="kpl" aria-hidden="true">◀</div><div class="kart-pad r" id="kpr" aria-hidden="true">▶</div>
      <div class="g2-joy kart-joy" id="kjoy" aria-label="Joystick zum Lenken"><i></i></div>
      <div class="kart-lights" id="klights" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="kart-count" id="kcount"></div>
    </div>
    <p class="mode-hint">Lenken: Pfeiltasten ← → (oder A/D), Joystick unten links oder links/rechts aufs Bild tippen und halten. Tipps: Innen durch die Kurve lädt den Kurven-Turbo (Bande nicht berühren!). Jede 4. richtige Antwort gibt Turbo. Genau bei LOS! tippen = Raketenstart.</p>`);
  const host = $('#g3');
  const st = createStage(host, { fov: 62, near: 0.9, far: 3600, shadows: true, clear: TH.fog });
  game.stage3d = st;
  const { scene, camera, renderer } = st;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if (typeof kvProp === 'function') { renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.0; }   // Farben wie in der 3D-Welt
  scene.fog = new T.Fog(TH.fog, TH.fogNear, TH.fogFar);
  const W = KART.W, HW = W / 2, LANE = W / 3, WL = HW + KART.WALL;
  const tr = kartBuildTrack(SH, W);
  const L = tr.len;
  const q = {}, q2 = {};
  const rnd = (a, b) => a + Math.random() * (b - a);
  const yawAt = (o) => Math.atan2(o.fx, o.fz);
  const pt = (o, lat, up = 0) => new T.Vector3(o.x + o.rx * lat, kartH(o, lat) + up, o.z + o.rz * lat);
  const cdist = (a, b) => Math.abs((((a - b) % L) + L + L / 2) % L - L / 2); // Abstand entlang der Runde

  /* Licht und Himmel */
  scene.add(new T.HemisphereLight(TH.hemi[0], TH.hemi[1], TH.hemi[2]));
  const sun = new T.DirectionalLight(TH.sun, TH.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const nightLight = TH.night ? new T.PointLight(0xfff1e0, 300, 44, 1.6) : null;
  if (nightLight) scene.add(nightLight);
  const sunDir = new T.Vector3(-0.45, 0.8, 0.35).normalize();
  const skyTex = canvasTex(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, TH.sky[0]); gr.addColorStop(0.42, TH.sky[1]); gr.addColorStop(0.5, TH.sky[2]); gr.addColorStop(1, TH.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.add(new T.Mesh(new T.SphereGeometry(3200, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false })));
  try {
    const envScene = new T.Scene();
    envScene.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide })));
    const sunBall = new T.Mesh(new T.SphereGeometry(1.2, 16, 8), new T.MeshBasicMaterial({ color: TH.night ? 0x8a7dff : 0xffffff }));
    sunBall.position.copy(sunDir).multiplyScalar(8); envScene.add(sunBall);
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = TH.night ? 0.55 : 0.9;
    pmrem.dispose();
  } catch { /* ohne Spiegelungen */ }
  if (!TH.night) {
    const sunSprite = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,250,230,1)', 'rgba(255,230,180,0)'), fog: false, depthWrite: false, transparent: true }));
    sunSprite.position.copy(sunDir).multiplyScalar(2700); sunSprite.scale.set(600, 600, 1); scene.add(sunSprite);
  }
  if (TH.stars || TH.moons) {
    const n = 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 1.3; p.set([Math.cos(a) * Math.cos(e) * 3000, Math.sin(e) * 3000, Math.sin(a) * Math.cos(e) * 3000], i * 3); }
    const gs = new T.BufferGeometry(); gs.setAttribute('position', new T.BufferAttribute(p, 3));
    scene.add(new T.Points(gs, new T.PointsMaterial({ color: 0xffffff, size: TH.moons ? 3 : 5, sizeAttenuation: false, fog: false, transparent: true, opacity: TH.moons ? 0.5 : 0.9 })));
  }
  if (TH.moons) {
    for (const [x, y, z, r, c] of [[-900, 700, -1900, 130, 0xd9c2a8], [1400, 420, -1700, 64, 0xbfa58c]]) {
      const m = new T.Mesh(new T.SphereGeometry(r, 24, 16), new T.MeshBasicMaterial({ color: c, fog: false }));
      m.position.set(x + tr.box.cx, y, z + tr.box.cz); scene.add(m);
    }
  }
  if (TH.clouds) {
    const cloudTex = canvasTex(256, 128, (g, w) => {
      for (let i = 0; i < 14; i++) {
        const x = 40 + Math.random() * (w - 80), y = 50 + Math.random() * 40, r = 22 + Math.random() * 30;
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    });
    const cm = new T.SpriteMaterial({ map: cloudTex, fog: false, transparent: true, depthWrite: false, opacity: 0.9 });
    for (let i = 0; i < 26; i++) {
      const s = new T.Sprite(cm); const a = Math.random() * Math.PI * 2, d = 1000 + Math.random() * 1400;
      s.position.set(tr.box.cx + Math.cos(a) * d, 260 + Math.random() * 400, tr.box.cz + Math.sin(a) * d);
      const sc = 420 + Math.random() * 460; s.scale.set(sc, sc / 2, 1); scene.add(s);
    }
  }

  /* Boden und Berge rundherum */
  const groundMat = new T.MeshStandardMaterial({ map: kartGroundTex(TH.ground), roughness: 0.95, metalness: 0 });
  const ground = new T.Mesh(new T.PlaneGeometry(6000, 6000), groundMat);
  // Boden etwas tiefer als die Fahrbahn: sonst flimmern die beiden auf Geräten mit ungenauem Tiefenpuffer
  ground.rotation.x = -Math.PI / 2; ground.position.set(tr.box.cx, -0.25, tr.box.cz); ground.receiveShadow = true;
  scene.add(ground);
  {
    const mm = new T.MeshStandardMaterial({ color: TH.mountains, roughness: 1, flatShading: true });
    const snowCap = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const rad = Math.max(tr.box.maxX - tr.box.minX, tr.box.maxZ - tr.box.minZ) * 0.5 + 520;
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + rnd(-0.08, 0.08), d = rad + rnd(0, 380);
      const h = TH.night ? rnd(40, 90) : rnd(90, 230), r = h * rnd(0.9, 1.5);
      const m = new T.Mesh(new T.ConeGeometry(r, h, 7, 2), mm);
      m.position.set(tr.box.cx + Math.cos(a) * d, h / 2 - 2, tr.box.cz + Math.sin(a) * d); m.rotation.y = rnd(0, 3); scene.add(m);
      if (!TH.night && ['snow', 'grass', 'forest'].includes(TH.ground) && h > 150) { const c = new T.Mesh(new T.ConeGeometry(r * 0.32, h * 0.32, 7, 1), snowCap); c.position.set(m.position.x, h - h * 0.16 - 2, m.position.z); c.rotation.y = m.rotation.y; scene.add(c); }
    }
  }

  /* Fahrbahn, Randsteine, Banden, Dämme, Brücken, Tunnel */
  // Im Tunnel ist die Fahrbahn dunkler (fest eingefärbt, mit weichem Übergang an den Einfahrten). Der Tunnel wirft
  // keinen Schatten mehr: Schatten reichen nur 45 m weit, sonst wandert vor einem eine helle Kante mit.
  const tunShade = new Float32Array(tr.N).fill(1);
  {
    const into = new Float32Array(tr.N).fill(0);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < tr.N * 2; i++) { const ii = i % tr.N, prev = (ii - 1 + tr.N) % tr.N; into[ii] = tr.TY[ii] === 2 ? Math.max(into[ii], into[prev] + tr.ds) : 0; }
    const out = new Float32Array(tr.N).fill(0);
    for (let pass = 0; pass < 2; pass++) for (let i = tr.N * 2; i >= 0; i--) { const ii = i % tr.N, nx = (ii + 1) % tr.N; out[ii] = tr.TY[ii] === 2 ? Math.max(out[ii], out[nx] + tr.ds) : 0; }
    for (let i = 0; i < tr.N; i++) if (tr.TY[i] === 2) tunShade[i] = 1 - 0.42 * clamp(Math.min(into[i], out[i]) / 26, 0, 1);
  }
  const tunnelShade = tr.TY.some((t) => t === 2) && TH.tunnel !== 'glass' ? (i) => tunShade[i] : null;
  const roadTex = kartRoadTex(TH.road); roadTex.wrapS = T.ClampToEdgeWrapping;
  const roadMat = new T.MeshStandardMaterial({ map: roadTex, roughness: TH.road === 'ice' ? 0.25 : 0.8, metalness: TH.road === 'ice' ? 0.15 : 0.02, side: T.DoubleSide, vertexColors: !!tunnelShade });
  if (TH.road === 'nightRoad') { roadMat.emissive = new T.Color(0xffffff); roadMat.emissiveMap = roadTex; roadMat.emissiveIntensity = 0.35; }
  const road = new T.Mesh(kartGrid(T, tr, 2, (o, c) => { const p = pt(o, c ? HW : -HW, 0.04); return [p.x, p.y, p.z, c, undefined]; }, { step: 4, vScale: 16, shade: tunnelShade }), roadMat);
  road.receiveShadow = true; scene.add(road);
  const curbTex = kartStripeTex(TH.curb[0], TH.curb[1]); curbTex.wrapS = curbTex.wrapT = T.RepeatWrapping;
  const curbMat = new T.MeshStandardMaterial({ map: curbTex, roughness: 0.6, side: T.DoubleSide, vertexColors: !!tunnelShade });
  if (TH.night) { curbMat.emissive = new T.Color(0xffffff); curbMat.emissiveMap = curbTex; curbMat.emissiveIntensity = 0.8; }
  for (const [a, b] of [[HW, WL], [-WL, -HW]]) {
    const c = new T.Mesh(kartGrid(T, tr, 2, (o, j) => { const p = pt(o, j ? b : a, 0.08); return [p.x, p.y, p.z]; }, { step: 4, vScale: 4, shade: tunnelShade }), curbMat);
    c.receiveShadow = true; scene.add(c);
  }
  // Banden (nicht im Tunnel); auf Brücken Betonbrüstung
  const wallTex = kartWallTex(TH.wall);
  const wallMat = new T.MeshStandardMaterial({ map: wallTex, roughness: 0.6, side: T.DoubleSide });
  if (TH.wall === 'neon') { wallMat.emissive = new T.Color(0xffffff); wallMat.emissiveMap = wallTex; wallMat.emissiveIntensity = 1; }
  const concrete = new T.MeshStandardMaterial({ map: kartWallTex('concrete'), roughness: 0.85, side: T.DoubleSide });
  const wallH = TH.wall === 'snow' ? 1.4 : 1.0;
  const wallTop = (o) => (o.ty === 1 ? 1.2 : wallH);
  const capMat = new T.MeshStandardMaterial({ color: TH.night ? 0x22d3ee : 0xe5e7eb, roughness: 0.4, emissive: TH.night ? 0x22d3ee : 0x000000, emissiveIntensity: TH.night ? 1 : 0, side: T.DoubleSide });
  for (const side of [-1, 1]) {
    const mk = (keep, mat, h) => {
      const m = new T.Mesh(kartGrid(T, tr, 2, (o, j, s) => { const p = pt(o, side * WL, j ? h : -0.05); return [p.x, p.y, p.z, s / 8, j]; }, { keep, step: 4 }), mat);
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
    };
    mk((i) => tr.TY[i] === 0, wallMat, wallH);
    mk((i) => tr.TY[i] === 1, concrete, 1.2);
    if (TH.wall !== 'snow') {
      scene.add(new T.Mesh(kartGrid(T, tr, 2, (o, j) => { const p = pt(o, side * (WL + (j ? 0.25 : -0.25)), wallTop(o) + 0.02); return [p.x, p.y, p.z]; }, { keep: (i) => tr.TY[i] !== 2, step: 4 }), capMat));
    }
  }
  // Dämme: wo die Strecke höher liegt (nicht auf Brücken und nicht im Berg-Tunnel) – Böschung bis zum Boden
  const tunnelStyle = TH.tunnel, glassy = tunnelStyle === 'glass';
  const bankTex = kartGroundTex(TH.ground, 1);
  const bankMat = new T.MeshStandardMaterial({ map: bankTex, roughness: 0.95, side: T.DoubleSide });
  for (const side of [-1, 1]) {
    const m = new T.Mesh(kartGrid(T, tr, 2, (o, j, s) => {
      const eh = kartH(o, side * WL);
      if (!j) { const p = pt(o, side * (WL + 0.2), -0.04); return [p.x, p.y, p.z, s / 10, 0]; }
      const out = WL + 0.2 + Math.max(0.5, eh + 0.3) * 1.7;
      return [o.x + o.rx * side * out, -0.3, o.z + o.rz * side * out, s / 10, (out - WL) / 10];
    }, { keep: (i) => tr.TY[i] !== 1 && (tr.TY[i] !== 2 || glassy) && tr.Y[i] > 0.35, step: 4 }), bankMat);
    m.receiveShadow = true; scene.add(m);
  }
  // Brücken: Unterseite, Seiten, Pfeiler (nicht auf die untere Strecke)
  if (tr.TY.some((t) => t === 1)) {
    const bridgeMat = new T.MeshStandardMaterial({ color: TH.night ? 0x312e81 : TH.wall === 'logs' ? 0x8b5a2b : TH.wall === 'cake' ? 0xfbcfe8 : 0xb8c0cc, roughness: 0.7, side: T.DoubleSide });
    const keep = (i) => tr.TY[i] === 1;
    scene.add(new T.Mesh(kartGrid(T, tr, 2, (o, j) => { const p = pt(o, j ? WL + 0.3 : -WL - 0.3, -1.4); return [p.x, p.y, p.z]; }, { keep }), bridgeMat));
    for (const side of [-1, 1]) {
      const m = new T.Mesh(kartGrid(T, tr, 2, (o, j) => { const p = pt(o, side * (WL + 0.3), j ? 0.0 : -1.4); return [p.x, p.y, p.z]; }, { keep }), bridgeMat);
      m.castShadow = true; scene.add(m);
    }
    const pil = [];
    for (let i = 0; i < tr.N; i += 26) {
      if (tr.TY[i] !== 1) continue;
      kartAt(tr, i * tr.ds, q);
      for (const side of [-1, 1]) {
        const lat = side * (HW - 1.5), x = q.x + q.rx * lat, z = q.z + q.rz * lat, top = kartH(q, lat) - 1.4;
        // nicht auf eine tiefere Fahrbahn stellen
        let blocked = false;
        for (let c = 0; c < tr.coarse.length; c += 4) {
          if (tr.coarse[c + 2] < top - 3 && Math.hypot(tr.coarse[c] - x, tr.coarse[c + 1] - z) < WL + 3) { blocked = true; break; }
        }
        if (!blocked && top > 0.5) pil.push({ x, z, h: top + 0.3 });
      }
    }
    if (pil.length) {
      const m = new T.InstancedMesh(new T.CylinderGeometry(0.9, 1.1, 1, 12), bridgeMat, pil.length);
      const o = new T.Object3D();
      pil.forEach((p, i) => { o.position.set(p.x, p.h / 2 - 0.3, p.z); o.scale.set(1, p.h, 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
    }
  }
  // Tunnel bzw. Höhle: Röhre über der Strecke; aussen ein Berg bis zum Boden (auf dem Mars eine Glasröhre)
  if (tr.TY.some((t) => t === 2)) {
    const keep = (i) => tr.TY[i] === 2;
    const RW = WL + 1.2, RH = 9.5, cols = 15;
    const inTex = canvasTex(256, 256, (g, w, h) => {
      const base = { concrete: '#9ca3af', rock: '#6b5b4b', glass: '#9ad7ff', icecave: '#a5d8f5', neon: '#14112b', candy: '#ffffff' }[tunnelStyle];
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      kartNoise(g, w, h, 1800, ['rgba(0,0,0,.18)', 'rgba(255,255,255,.12)'], [2, 7]);
      if (tunnelStyle === 'concrete' || tunnelStyle === 'neon') { g.fillStyle = tunnelStyle === 'neon' ? '#f0abfc' : '#fde68a'; g.fillRect(w / 2 - 10, 0, 20, h); g.fillStyle = tunnelStyle === 'neon' ? '#22d3ee' : 'rgba(0,0,0,.2)'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 4); }
      if (tunnelStyle === 'candy') { g.fillStyle = '#f472b6'; for (let y = -w; y < h + w; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + w / 2); g.lineTo(w, y + w / 2 + 28); g.lineTo(0, y + 28); g.fill(); } }
      if (tunnelStyle === 'icecave') kartNoise(g, w, h, 300, ['rgba(255,255,255,.6)', 'rgba(56,189,248,.35)'], [4, 14]);
    }, { repeat: [1, 1] });
    const inMat = new T.MeshStandardMaterial({ map: inTex, side: T.DoubleSide, roughness: glassy ? 0.1 : tunnelStyle === 'icecave' ? 0.3 : 0.85, metalness: glassy ? 0.2 : 0, transparent: glassy, opacity: glassy ? 0.38 : 1, depthWrite: !glassy });
    if (tunnelStyle !== 'rock') { inMat.emissive = new T.Color(0xffffff); inMat.emissiveMap = inTex; inMat.emissiveIntensity = tunnelStyle === 'neon' ? 0.9 : 0.3; }
    const tube = new T.Mesh(kartGrid(T, tr, cols, (o, c, s) => {
      const a = (c / (cols - 1)) * Math.PI, lat = -Math.cos(a) * RW, up = Math.sin(a) * RH;
      return [o.x + o.rx * lat, o.y + up - 0.05, o.z + o.rz * lat, (c / (cols - 1)) * 3, s / 12];
    }, { keep, step: 4 }), inMat);
    tube.castShadow = false; tube.receiveShadow = false; scene.add(tube);
    // Gehweg zwischen Randstein und Tunnelwand (sonst sieht man dort ins Leere)
    const walkMat = new T.MeshStandardMaterial({ color: { concrete: 0x9ca3af, rock: 0x6b5b4b, glass: 0xd6d3d1, icecave: 0xc7e3f5, neon: 0x312e81, candy: 0xfbcfe8 }[tunnelStyle] || 0x9ca3af, roughness: 0.9, side: T.DoubleSide, vertexColors: !!tunnelShade });
    for (const sg of [-1, 1]) {
      const walk = new T.Mesh(kartGrid(T, tr, 3, (o, c) => { const lat = sg * [WL - 0.02, RW - 0.6, RW + 0.4][c], p = pt(o, lat, c === 2 ? -0.2 : 0.1); return [p.x, p.y, p.z]; }, { keep, step: 4, shade: tunnelShade }), walkMat);
      scene.add(walk);
    }
    if (glassy) {
      // Rippen aus Metall
      const ribs = [];
      for (let i = 0; i < tr.N; i += 16) if (tr.TY[i] === 2) { kartAt(tr, i * tr.ds, q); ribs.push({ x: q.x, y: q.y, z: q.z, yaw: yawAt(q) }); }
      const rm = new T.InstancedMesh(new T.TorusGeometry(RW, 0.18, 6, 28, Math.PI), new T.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.3 }), ribs.length);
      const o = new T.Object3D();
      ribs.forEach((r, i) => { o.position.set(r.x, r.y - 0.05, r.z); o.rotation.set(0, r.yaw, 0); o.scale.set(1, RH / RW, 1); o.updateMatrix(); rm.setMatrixAt(i, o.matrix); });
      scene.add(rm);
    } else {
      // Berg aussen, unregelmässig, mit Fuss bis zum Boden
      const rockCol = { concrete: 0x6b8f5e, rock: 0x7a6a58, icecave: 0xc9d9ea, neon: 0x23204a, candy: 0x7b4a2e }[tunnelStyle] || 0x7a6a58;
      const rockMat = new T.MeshStandardMaterial({ color: rockCol, roughness: 1, flatShading: true, side: T.DoubleSide });
      const RW2 = RW + 10, RH2 = RH + 9, arc = 13;
      const shell = new T.Mesh(kartGrid(T, tr, arc + 2, (o, c, s) => {
        const foot = Math.max(0, o.y) * 1.6 + 8;
        if (c === 0 || c === arc + 1) { const lat = (c ? 1 : -1) * (RW2 + foot); return [o.x + o.rx * lat, -0.3, o.z + o.rz * lat]; }
        const cc = c - 1;
        const a = (cc / (arc - 1)) * Math.PI, n = 1 + 0.12 * Math.sin(s * 0.21 + cc * 1.7) + 0.08 * Math.sin(s * 0.53 - cc * 2.3);
        const lat = -Math.cos(a) * RW2 * n, up = Math.sin(a) * RH2 * n;
        return [o.x + o.rx * lat, o.y + up - 0.4, o.z + o.rz * lat];
      }, { keep, step: 8 }), rockMat);
      shell.castShadow = false; shell.receiveShadow = false; scene.add(shell);
      // Portale: Wand zwischen Röhre und Berg an beiden Enden
      for (let i = 0; i < tr.N; i++) {
        const isStart = tr.TY[i] === 2 && tr.TY[(i - 1 + tr.N) % tr.N] !== 2, isEnd = tr.TY[i] === 2 && tr.TY[(i + 1) % tr.N] !== 2;
        if (!isStart && !isEnd) continue;
        kartAt(tr, i * tr.ds, q);
        const foot = Math.max(0, q.y) * 1.6 + 8;
        const shp = new T.Shape();
        shp.moveTo(-(RW2 + foot), -q.y + 0.1);
        for (let c = 0; c <= 16; c++) { const a = (c / 16) * Math.PI; shp.lineTo(-Math.cos(a) * RW2 * 1.06, Math.sin(a) * RH2 * 1.06 - 0.4); }
        shp.lineTo(RW2 + foot, -q.y + 0.1); shp.closePath();
        const hole = new T.Path();
        hole.moveTo(-RW, -0.2);
        for (let c = 0; c <= 16; c++) { const a = (c / 16) * Math.PI; hole.lineTo(-Math.cos(a) * RW, Math.sin(a) * RH); }
        hole.lineTo(RW, -0.2); hole.closePath();
        shp.holes.push(hole);
        const pm = new T.Mesh(new T.ExtrudeGeometry(shp, { depth: 1.2, bevelEnabled: false }), rockMat);
        pm.position.set(q.x, q.y, q.z); pm.rotation.y = yawAt(q); pm.translateZ(isStart ? -1.2 : 0);
        pm.castShadow = false; scene.add(pm);
        // Rahmen um die Einfahrt
        const frame = new T.Mesh(new T.TorusGeometry(1, 0.08, 8, 32, Math.PI), new T.MeshStandardMaterial({ color: TH.night ? 0xf0abfc : 0xfacc15, emissive: TH.night ? 0xf0abfc : 0x000000, emissiveIntensity: TH.night ? 1.5 : 0, roughness: 0.4 }));
        frame.scale.set(RW, RH, 6); frame.position.set(q.x, q.y, q.z); frame.rotation.y = yawAt(q); scene.add(frame);
      }
      // Lampen an der Decke
      const lamps = [];
      for (let i = 0; i < tr.N; i += 20) if (tr.TY[i] === 2) { kartAt(tr, i * tr.ds, q); lamps.push({ x: q.x, y: q.y + RH - 0.6, z: q.z, yaw: yawAt(q) }); }
      const lm = new T.InstancedMesh(new T.BoxGeometry(1.4, 0.2, 0.6), new T.MeshStandardMaterial({ color: 0xffffff, emissive: tunnelStyle === 'neon' ? 0xf0abfc : tunnelStyle === 'icecave' ? 0xbae6fd : 0xfff3c4, emissiveIntensity: 2 }), lamps.length);
      const o = new T.Object3D();
      lamps.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.yaw + Math.PI / 2, 0); o.updateMatrix(); lm.setMatrixAt(i, o.matrix); });
      scene.add(lm);
    }
  }
  // Startlinie und Torbogen
  kartAt(tr, 0, q);
  {
    const sl = new T.Mesh(new T.PlaneGeometry(W, 2.4), new T.MeshStandardMaterial({ map: kartCheckerTex(16, 2), roughness: 0.7 }));
    sl.rotation.set(-Math.PI / 2, 0, yawAt(q) + Math.PI, 'YXZ'); sl.rotation.set(-Math.PI / 2, 0, 0); sl.rotateOnWorldAxis(new T.Vector3(0, 1, 0), yawAt(q));
    sl.position.set(q.x, q.y + 0.12, q.z); scene.add(sl);
  }
  /* Start und Ziel: schwebendes Schild hoch über der Linie (kein Torbogen). Es zeigt, was beim nächsten Durchfahren
     kommt (START, RUNDE 2, LETZTE RUNDE, ZIEL), schwebt leicht und dreht sich beim Durchfahren einmal mit Konfetti. */
  const startSign = (() => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 360;
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
    const g = cv.getContext('2d');
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    function draw(title, sub, accent) {
      const w = cv.width, h = cv.height;
      g.clearRect(0, 0, w, h);
      g.save(); g.shadowColor = accent; g.shadowBlur = 40; g.fillStyle = 'rgba(15, 23, 42, .92)'; rr(26, 26, w - 52, h - 52, 70); g.fill(); g.restore();
      const gr = g.createLinearGradient(0, 26, 0, h - 26); gr.addColorStop(0, 'rgba(76, 64, 196, .97)'); gr.addColorStop(1, 'rgba(15, 23, 42, .96)');
      g.fillStyle = gr; rr(26, 26, w - 52, h - 52, 70); g.fill();
      // Zielflaggen-Muster als Band oben
      g.save(); rr(26, 26, w - 52, h - 52, 70); g.clip();
      for (let i = 0; i < 40; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? 'rgba(255,255,255,.9)' : 'rgba(17,24,39,.9)'; g.fillRect(26 + i * 25, 26 + j * 25, 25, 25); }
      const hl = g.createLinearGradient(0, 76, 0, h * 0.55); hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(26, 76, w - 52, h * 0.3);
      g.restore();
      g.lineWidth = 9; g.strokeStyle = accent; rr(30, 30, w - 60, h - 60, 66); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
      let fs = 150; g.font = NUM_FONT(fs);
      while (g.measureText(title).width > w - 140 && fs > 60) { fs -= 6; g.font = NUM_FONT(fs); }
      g.fillText(title, w / 2, sub ? h * 0.53 : h * 0.58);
      if (sub) { g.font = NUM_FONT(52); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(sub, w / 2, h * 0.8); }
      g.shadowColor = 'transparent';
      tex.needsUpdate = true;
    }
    const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const geo = new T.PlaneGeometry(13, 4.55);
    const grp = new T.Group(), spin = new T.Group();
    const f1 = new T.Mesh(geo, mat), f2 = new T.Mesh(geo, mat); f2.rotation.y = Math.PI; f1.renderOrder = f2.renderOrder = 5;
    spin.add(f1, f2); grp.add(spin);
    const base = new T.Vector3(q.x, q.y + 8.4, q.z);
    grp.position.copy(base); grp.rotation.y = yawAt(q); scene.add(grp);
    let state = '', spinT = -1, pending = null;
    const show = (n) => {
      if (n <= 0) draw('START', `${KART.LAPS} Runden`, '#facc15');
      else if (n < KART.LAPS - 1) draw(`RUNDE ${n + 1}`, `von ${KART.LAPS}`, '#22d3ee');
      else if (n === KART.LAPS - 1) draw('LETZTE RUNDE', '', '#f472b6');
      else draw('🏁 ZIEL', '', '#22c55e');
    };
    return {
      /** n = wie oft die Linie schon überquert wurde – kurz vor der Linie gezählt, damit man die Drehung noch sieht */
      set(n) {
        const key = String(n);
        if (key === state) return;
        if (state === '') show(n);
        else { spinT = 0; pending = n; burst(st, base, { n: 90, colors: [0xfacc15, 0x22d3ee, 0xf472b6, 0xffffff], speed: 8, life: 1.1, size: 0.45, gravity: -5 }); }
        state = key;
      },
      update(dt, t) {
        grp.position.y = base.y + Math.sin(t * 1.6) * 0.18;
        if (spinT >= 0) {
          spinT += dt;
          const a = Math.min(1, spinT / 0.9), e = 1 - (1 - a) ** 3;
          spin.rotation.y = e * Math.PI * 2;
          if (pending != null && e > 0.25) { show(pending); pending = null; } // neuer Text, wenn das Schild gerade von der Seite zu sehen ist
          spin.scale.setScalar(1 + Math.sin(a * Math.PI) * 0.18);
          if (a >= 1) { spinT = -1; spin.rotation.y = 0; spin.scale.setScalar(1); }
        }
      },
    };
  })();
  startSign.set(0);

  /* Weggabelungen: Stationen nicht im Tunnel und nicht am Start */
  const freeAt = (s) => { if (s < 60 || s > L - 30) return false; for (let d = -KART.ZONE - 6; d <= KART.ZONE + 6; d += 2) { kartAt(tr, s + d, q); if (q.ty === 2) return false; } return true; };
  const stationS = KART.STATIONS.map((u) => {
    for (let n = 0; n < 60; n++) { const s0 = u * L + n * 8; if (freeAt(s0) && freeAt(s0 + KART.ASK)) return s0; }
    for (let n = 1; n < 60; n++) { const s0 = u * L - n * 8; if (freeAt(s0) && freeAt(s0 + KART.ASK)) return s0; }
    return u * L;
  });
  const islandTex = kartStripeTex(TH.island[0], TH.island[1], 2); islandTex.wrapS = islandTex.wrapT = T.RepeatWrapping; islandTex.repeat.set(1, 3);
  const islandMat = new T.MeshStandardMaterial({ map: islandTex, roughness: 0.55 });
  const islandCap = new T.MeshStandardMaterial({ color: TH.island[0], roughness: 0.5 });
  function buildIslands(sc) {
    for (const lat of [-LANE / 2, LANE / 2]) {
      const seg = 6, from = sc - KART.ZONE, len = (2 * KART.ZONE) / seg;
      for (let i = 0; i < seg; i++) {
        kartAt(tr, from + (i + 0.5) * len, q);
        const m = new T.Mesh(new T.BoxGeometry(0.9, 0.7, len + 0.08), islandMat);
        m.position.copy(pt(q, lat, 0.35)); m.rotation.set(-Math.atan(q.sl), yawAt(q), Math.atan(q.b), 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      }
      for (const e of [from, sc + KART.ZONE]) {
        kartAt(tr, e, q);
        const c = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 0.7, 16), islandCap);
        c.position.copy(pt(q, lat, 0.35)); c.castShadow = true; scene.add(c);
      }
    }
  }
  const cubeMat = new T.MeshStandardMaterial({ map: kartCubeTex(), emissive: 0x6d28d9, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.92 });
  const cubeGeo = new T.BoxGeometry(1.8, 1.8, 1.8);
  const glowMat = new T.SpriteMaterial({ map: glowTex('rgba(200,180,255,.9)', 'rgba(120,80,255,0)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const stations = stationS.map((s0, k) => {
    buildIslands(s0); buildIslands(s0 + KART.ASK);
    const cubes = [-1, 0, 1].map((lane) => {
      kartAt(tr, s0, q);
      const grp = new T.Group(); grp.position.copy(pt(q, lane * LANE, 1.7));
      const m = new T.Mesh(cubeGeo, cubeMat); m.castShadow = true; grp.add(m);
      const gl = new T.Sprite(glowMat); gl.scale.set(4, 4, 1); grp.add(gl);
      scene.add(grp);
      return { grp, m, phase: Math.random() * 6, hiddenUntil: 0, shotAt: -1e9, base: grp.position.y, s: s0, lane };
    });
    const s1 = s0 + KART.ASK;
    kartAt(tr, s1, q);
    const gate = new T.Group(); gate.position.set(q.x, q.y, q.z); gate.rotation.y = yawAt(q); scene.add(gate);
    const postMat = new T.MeshStandardMaterial({ color: TH.night ? 0x4338ca : 0xf1f5f9, metalness: 0.6, roughness: 0.3 });
    for (const x of [-WL, -LANE / 2, LANE / 2, WL]) { const p = new T.Mesh(new T.CylinderGeometry(0.25, 0.3, 7.6, 12), postMat); p.position.set(-x, 3.8 - x * q.b, 0); p.castShadow = true; gate.add(p); }
    const bar = new T.Mesh(new T.BoxGeometry(2 * WL + 1.2, 0.5, 0.5), postMat); bar.position.set(0, 7.5, 0); bar.castShadow = true; gate.add(bar);
    const boards = [-1, 0, 1].map((lane) => {
      const mat = new T.MeshStandardMaterial({ map: kartBoardTex('?', TH.board), roughness: 0.5, side: T.DoubleSide });
      if (TH.night) { mat.emissive = new T.Color(0xffffff); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.6; }
      const b = new T.Mesh(new T.PlaneGeometry(5.6, 3.0), mat);
      b.position.set(-lane * LANE, 5.7, -0.32); b.rotation.y = Math.PI; gate.add(b);
      const frame = new T.Mesh(new T.BoxGeometry(5.9, 3.3, 0.14), new T.MeshStandardMaterial({ color: new T.Color(TH.board), roughness: 0.5 }));
      frame.position.set(-lane * LANE, 5.7, -0.22); gate.add(frame);
      return { mat, b, lane };
    });
    return { k, s0, s1, cubes, gate, boards, vals: null, correct: -1, label: [] };
  });
  const nearStation = (s, r = 30) => stations.some((x) => cdist(s, x.s0) < r || cdist(s, x.s1) < r);

  /* Kulisse */
  function scatter(n, minD, maxD, avoid = 6) {
    const out = [];
    kartAt(tr, 0, q2);
    const sx = q2.x, sz = q2.z;
    for (let tries = 0; out.length < n && tries < n * 10; tries++) {
      const s = Math.random() * L, side = Math.random() < 0.5 ? -1 : 1, d = rnd(minD, maxD);
      kartAt(tr, s, q);
      const x = q.x + q.rx * side * (WL + d), z = q.z + q.rz * side * (WL + d);
      const nr = kartNear(tr, x, z);
      if (nr.d < WL + avoid + Math.max(0, nr.y) * 1.8) continue;
      if (tr.TY[nr.idx] === 2 && nr.d < WL + 32 + Math.max(0, nr.y) * 1.6) continue;   // nicht im Tunnelberg
      if (Math.hypot(x - sx, z - sz) < 30) continue;
      out.push({ x, z, s, side, rot: Math.random() * Math.PI * 2, sc: 1 });
    }
    return out;
  }
  const dummy = new T.Object3D();
  const VP = typeof kvProp === 'function';   // Kulisse im Stil der Avatare (js/kartvox.js)
  function inst(geo, mat, list, f, { cast = !VP, color = null } = {}) {
    if (!list.length) return null;
    const m = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => { dummy.position.set(p.x, -0.25, p.z); dummy.rotation.set(0, p.rot, 0); dummy.scale.setScalar(p.sc); f?.(dummy, p, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (color) m.setColorAt(i, new T.Color(color(p, i))); });
    m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
  }
  const P = TH.props;
  const trunkMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  // Kulisse im Stil der Avatare (js/kartvox.js): nahe an der Strecke weich gerundete Voxel-Modelle,
  // weit weg die einfachen Formen (sieht man dort kaum, spart viel Rechenarbeit)
  const propMats = VP ? kvPropMats(T) : null;
  // weiche runde Schatten unter den Voxel-Dingen (billig, und auf Tablets ohne Flimmern)
  const blobMat = VP ? new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }) : null;
  const blobGeo = VP ? (() => { const g2 = new T.CircleGeometry(1, 20); g2.rotateX(-Math.PI / 2); return g2; })() : null;
  const tintSoft = (p, i) => [0xffffff, 0xf1f7ec, 0xfaf6ee, 0xe9f2ea][i % 4];
  function voxSplit(kind, list, { near = 40, scale = 1, variants = [0], cast = true, tint = tintSoft, max = Infinity, lod = 0 } = {}) {
    if (!VP) return list;
    const isNear = (p) => near === Infinity || kartNear(tr, p.x, p.z).d < WL + near;
    const nearAll = list.filter(isNear), nearL = nearAll.slice(0, max), farL = list.filter((p) => !isNear(p)).concat(nearAll.slice(max));
    variants.forEach((v, vi) => {
      const sub = nearL.filter((p, i) => i % variants.length === vi);
      const geo = kvProp(T, kind, v, lod);
      inst(geo, propMats, sub, (o, p) => { o.position.y = -0.25; o.scale.setScalar(p.sc * scale); }, { cast: false, color: tint });
      if (cast) {
        geo.computeBoundingBox();
        const bb = geo.boundingBox, rad = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.42;
        const bm = inst(blobGeo, blobMat, sub, (o, p) => { o.position.y = -0.2; o.scale.setScalar(p.sc * scale * rad); }, { cast: false });
        if (bm) { bm.receiveShadow = false; bm.renderOrder = 1; }
      }
    });
    return farL;
  }
  if (P.includes('trees') || P.includes('pines') || P.includes('snowPines')) {
    const snowy = P.includes('snowPines');
    let list = scatter(P.includes('pines') || snowy ? 620 : 300, 6, 180).map((p) => ({ ...p, sc: rnd(0.8, 1.7) }));
    list = voxSplit('pine', list, { near: 30, max: 100, scale: 1.45, variants: [snowy ? 1 : 0] });
    inst(new T.CylinderGeometry(0.35, 0.5, 3, 8), trunkMat, list, (o) => { o.position.y = 1.5 * o.scale.y - 0.25; });
    const pineMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: !VP });
    const tint = (p, i) => (snowy ? [0x2f5a46, 0x335f4a, 0x2a5240][i % 3] : [0x24552f, 0x2c6b38, 0x1f4a29, 0x356f2f][i % 4]);
    for (const [h, r, y] of [[4.2, 2.6, 4.2], [3.4, 2.0, 6.2], [2.6, 1.3, 7.9]]) {
      inst(new T.ConeGeometry(r, h, 9), pineMat, list, (o) => { o.position.y = y * o.scale.y - 0.25; }, { color: tint });
      if (snowy) inst(new T.ConeGeometry(r * 0.62, h * 0.42, 9), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), list, (o) => { o.position.y = (y + h * 0.3) * o.scale.y - 0.25; }, { cast: false });
    }
  }
  if (P.includes('oaks')) {
    let list = scatter(240, 8, 170).map((p) => ({ ...p, sc: rnd(0.9, 1.6) }));
    list = voxSplit('oak', list, { near: 32, max: 36, scale: 1.3, variants: [0, 0, 1] });
    inst(new T.CylinderGeometry(0.4, 0.6, 4, 8), trunkMat, list, (o) => { o.position.y = 2 * o.scale.y - 0.25; });
    inst(new T.IcosahedronGeometry(3.2, 1), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: !VP }), list, (o) => { o.position.y = 5.6 * o.scale.y - 0.25; }, { color: (p, i) => [0x3f7d2c, 0x4d8a33, 0x6a9a2f, 0xb45309][i % 9 === 0 ? 3 : i % 3] });
  }
  if (P.includes('bushes')) {
    let list = scatter(260, 3, 60, 3).map((p) => ({ ...p, sc: rnd(0.6, 1.4) }));
    list = voxSplit('bush', list, { near: 30, lod: 1, cast: false, max: 170 });
    inst(new T.IcosahedronGeometry(1.1, 0), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: !VP }), list, (o) => { o.position.y = 0.5 * o.scale.y - 0.25; o.scale.y *= 0.75; }, { color: (p, i) => [0x3f8f3a, 0x4b9c3d, 0x2f7a33][i % 3] });
  }
  if (P.includes('flowers')) {
    const list = scatter(700, 2.5, 50, 2.5).map((p) => ({ ...p, sc: rnd(0.7, 1.3) }));
    inst(new T.SphereGeometry(0.22, 6, 4), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), list, (o) => { o.position.y = 0.2; }, { cast: false, color: (p, i) => ['#f472b6', '#facc15', '#ffffff', '#a78bfa', '#fb7185'][i % 5] });
  }
  if (P.includes('mushrooms')) {
    let list = scatter(90, 3, 34, 3).map((p) => ({ ...p, sc: rnd(0.6, 1.5) }));
    list = voxSplit('mushroom', list, { near: Infinity, scale: 1.15, cast: false, max: 40 });
    inst(new T.CylinderGeometry(0.25, 0.32, 0.9, 10), new T.MeshStandardMaterial({ color: 0xf5efe0 }), list, (o) => { o.position.y = 0.45 * o.scale.y - 0.25; });
    const capTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#d7263d'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h * 0.8, 3 + Math.random() * 5, 0, Math.PI * 2); g.fill(); } });
    inst(new T.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ map: capTex, roughness: 0.5 }), list, (o) => { o.position.y = 0.85 * o.scale.y - 0.25; });
  }
  if (P.includes('cabins')) {
    let list = scatter(10, 20, 70, 14).map((p) => ({ ...p, sc: rnd(0.9, 1.2) }));
    list = voxSplit('cabin', list, { near: Infinity });
    inst(new T.BoxGeometry(6, 3.4, 5), new T.MeshStandardMaterial({ map: kartWallTex('logs'), roughness: 0.9 }), list, (o) => { o.position.y = 1.7 * o.scale.y - 0.25; });
    inst(new T.ConeGeometry(5, 2.8, 4), new T.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8, flatShading: !VP }), list, (o) => { o.position.y = 4.8 * o.scale.y - 0.25; o.rotation.y += Math.PI / 4; });
  }
  if (P.includes('rocks') || P.includes('marsRocks')) {
    const mars = P.includes('marsRocks');
    let list = scatter(mars ? 460 : 150, 3, 200, 3).map((p) => ({ ...p, sc: rnd(0.5, mars ? 3.6 : 2.4) }));
    list = voxSplit('rock', list, { near: 42, lod: 1, variants: [mars ? 1 : 0], tint: (p, i) => [0xffffff, 0xeeeeee, 0xf7f2ea][i % 3] });
    inst(new T.DodecahedronGeometry(1.2, 0), new T.MeshStandardMaterial({ color: mars ? 0x7c3a20 : TH.ground === 'snow' ? 0x7d8794 : 0x7b7f86, roughness: 0.95, flatShading: !VP }), list, (o) => { o.position.y = 0.2 * o.scale.y; o.rotation.x = Math.random(); o.scale.y *= 0.65; });
  }
  if (P.includes('craters')) {
    const list = scatter(40, 18, 220, 14).map((p) => ({ ...p, sc: rnd(2, 6) }));
    inst(new T.CircleGeometry(2.2, 24), new T.MeshStandardMaterial({ color: 0x6b2a14, roughness: 1 }), list, (o) => { o.position.y = -0.2; o.rotation.set(-Math.PI / 2, 0, 0); }, { cast: false });
    inst(new T.TorusGeometry(2.3, 0.35, 6, 24), new T.MeshStandardMaterial({ color: 0x9a4220, roughness: 1, flatShading: !VP }), list, (o) => { o.position.y = -0.2; o.rotation.set(-Math.PI / 2, 0, 0); o.scale.z = 0.4; });
  }
  if (P.includes('domes')) {
    const list = scatter(14, 26, 120, 20).map((p) => ({ ...p, sc: rnd(1, 1.9) }));
    inst(new T.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xf5f5f4, metalness: 0.3, roughness: 0.25, clearcoat: 1 }), list);
    inst(new T.TorusGeometry(6, 0.25, 6, 32), new T.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.2 }), list, (o) => { o.position.y = 1.2 * o.scale.y; o.rotation.set(-Math.PI / 2, 0, 0); });
  }
  if (P.includes('antennas')) {
    const list = scatter(18, 12, 90, 10);
    inst(new T.CylinderGeometry(0.15, 0.2, 10, 6), new T.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.7 }), list, (o) => { o.position.y = 4.8; });
    inst(new T.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), new T.MeshStandardMaterial({ color: 0xf5f5f4, metalness: 0.4, side: T.DoubleSide }), list, (o) => { o.position.y = 9.6; o.rotation.set(-0.9, 0, 0); });
  }
  if (P.includes('rocket')) {
    const [p] = scatter(1, 40, 80, 30);
    if (p) {
      const g = new T.Group(); g.position.set(p.x, -0.25, p.z); scene.add(g);
      const white = new T.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.3 }), red = new T.MeshStandardMaterial({ color: 0xdc2626 });
      const body = new T.Mesh(new T.CylinderGeometry(2.4, 2.6, 26, 24), white); body.position.y = 15; body.castShadow = true; g.add(body);
      const nose = new T.Mesh(new T.ConeGeometry(2.4, 7, 24), red); nose.position.y = 31.5; g.add(nose);
      for (let i = 0; i < 4; i++) { const f = new T.Mesh(new T.BoxGeometry(0.3, 6, 4), red); f.position.set(Math.cos((i * Math.PI) / 2) * 3, 4, Math.sin((i * Math.PI) / 2) * 3); f.rotation.y = (-i * Math.PI) / 2; g.add(f); }
      const tower = new T.Mesh(new T.BoxGeometry(2, 30, 2), new T.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7 })); tower.position.set(5, 15, 0); g.add(tower);
    }
  }
  if (P.includes('palms')) {
    let list = scatter(190, 6, 130).map((p) => ({ ...p, sc: rnd(0.9, 1.4), lean: rnd(-0.25, 0.25) }));
    list = voxSplit('palm', list, { near: 40, max: 50 });
    inst(new T.CylinderGeometry(0.28, 0.45, 9, 8), new T.MeshStandardMaterial({ color: 0x8b6b45, roughness: 0.95 }), list, (o, p) => { o.position.y = 4.5 * o.scale.y - 0.25; o.rotation.z = p.lean; });
    const leafMat = new T.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.75, side: T.DoubleSide, flatShading: !VP });
    const leafG = new T.ConeGeometry(0.7, 5.2, 4); leafG.rotateZ(-Math.PI / 2); leafG.translate(2.5, 0, 0); leafG.scale(1, 0.25, 1);
    for (let a = 0; a < 7; a++) {
      inst(leafG, leafMat, list, (o, p) => {
        // Krone oben auf dem schiefen Stamm
        const top = 9 * o.scale.y, lean = p.lean;
        o.position.x += -Math.sin(lean) * top * Math.cos(p.rot); o.position.z += Math.sin(lean) * top * Math.sin(p.rot);
        o.position.y = Math.cos(lean) * top - 0.25; o.rotation.set(0, p.rot + (a / 7) * Math.PI * 2, -0.35);
      });
    }
  }
  if (P.includes('umbrellas')) {
    let list = scatter(70, 4, 40, 3);
    list = voxSplit('umbrella', list, { near: Infinity, max: 24, tint: null });
    inst(new T.CylinderGeometry(0.06, 0.06, 2.6, 6), new T.MeshStandardMaterial({ color: 0xf5f5f5 }), list, (o) => { o.position.y = 1.05; });
    const umTex = canvasTex(256, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : ['#ef4444', '#0ea5e9', '#f59e0b'][i % 3]; g.fillRect((i * w) / 8, 0, w / 8, h); } });
    inst(new T.ConeGeometry(1.6, 0.7, 16, 1, true), new T.MeshStandardMaterial({ map: umTex, side: T.DoubleSide }), list, (o) => { o.position.y = 2.5; });
  }
  if (P.includes('surf')) {
    let list = scatter(40, 4, 30, 3);
    list = voxSplit('surf', list, { near: Infinity, scale: 1.1, variants: [0, 1, 2, 3], cast: false, tint: null });
    inst(new T.CapsuleGeometry(0.35, 2.2, 4, 10), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), list, (o) => { o.position.y = 1.1; o.rotation.z = 0.25; o.scale.z = 0.25; }, { color: (p, i) => ['#f97316', '#22d3ee', '#facc15', '#ec4899'][i % 4] });
  }
  if (P.includes('huts')) {
    let list = scatter(16, 16, 80, 14).map((p) => ({ ...p, sc: rnd(0.9, 1.3) }));
    list = voxSplit('hut', list, { near: Infinity, tint: null });
    inst(new T.BoxGeometry(5, 3, 4), new T.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.9 }), list, (o) => { o.position.y = 1.5 * o.scale.y - 0.25; });
    inst(new T.ConeGeometry(4.2, 2.4, 4), new T.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8, flatShading: !VP }), list, (o) => { o.position.y = 4.2 * o.scale.y - 0.25; o.rotation.y += Math.PI / 4; });
  }
  if (P.includes('sea')) {
    const seaTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1e88b8'; g.fillRect(0, 0, w, h); kartNoise(g, w, h, 2500, ['rgba(255,255,255,.18)', 'rgba(20,90,140,.35)', 'rgba(120,220,240,.25)'], [1, 5]); }, { repeat: [60, 60] });
    const sea = new T.Mesh(new T.PlaneGeometry(5000, 1800), new T.MeshStandardMaterial({ map: seaTex, roughness: 0.15, metalness: 0.3 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(tr.box.cx, -0.1, tr.box.maxZ + 90 + 900); scene.add(sea);
    st.onFrame((dt) => { seaTex.offset.x += dt * 0.01; seaTex.offset.y += dt * 0.006; });
  }
  if (P.includes('lighthouse')) {
    const g = new T.Group(); g.position.set(tr.box.cx + 120, -0.25, tr.box.maxZ + 70); scene.add(g);
    const lt = canvasTex(32, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#dc2626'; c.fillRect(0, (i * h) / 8, w, h / 8); } });
    const tw = new T.Mesh(new T.CylinderGeometry(2.2, 3.4, 26, 20), new T.MeshStandardMaterial({ map: lt })); tw.position.y = 13; tw.castShadow = true; g.add(tw);
    const lamp = new T.Mesh(new T.CylinderGeometry(2.4, 2.4, 3, 16), new T.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfde047, emissiveIntensity: 1 })); lamp.position.y = 27.5; g.add(lamp);
    const roof = new T.Mesh(new T.ConeGeometry(3, 3, 16), new T.MeshStandardMaterial({ color: 0x1f2937 })); roof.position.y = 30.5; g.add(roof);
  }
  if (P.includes('snowmen')) {
    let list = scatter(36, 4, 36, 3);
    list = voxSplit('snowman', list, { near: Infinity, max: 12, tint: null });
    const snowMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    for (const [r, y] of [[1.1, 0.8], [0.8, 2.4], [0.55, 3.55]]) inst(new T.SphereGeometry(r, 16, 12), snowMat, list, (o) => { o.position.y = y; });
    inst(new T.ConeGeometry(0.12, 0.6, 8), new T.MeshStandardMaterial({ color: 0xf97316 }), list, (o, p) => { o.rotation.set(Math.PI / 2, p.rot, 0, 'YXZ'); o.position.y = 3.55; o.position.x += Math.sin(p.rot) * 0.6; o.position.z += Math.cos(p.rot) * 0.6; });
    inst(new T.CylinderGeometry(0.4, 0.45, 0.6, 12), new T.MeshStandardMaterial({ color: 0x111827 }), list, (o) => { o.position.y = 4.2; });
  }
  if (P.includes('igloos')) {
    let list = scatter(14, 14, 70, 12).map((p) => ({ ...p, sc: rnd(0.9, 1.4) }));
    list = voxSplit('igloo', list, { near: Infinity, scale: 1.1, tint: null });
    const iTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#f8fbff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c7d7ea'; g.lineWidth = 2; for (let y = 0; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 12) % 2 ? 0 : 10; x < w; x += 20) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); } } });
    inst(new T.SphereGeometry(4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ map: iTex, roughness: 0.8 }), list);
  }
  if (P.includes('crystals')) {
    let list = scatter(120, 3, 60, 3).map((p) => ({ ...p, sc: rnd(0.5, 1.6) }));
    list = voxSplit('crystal', list, { near: Infinity, lod: 1, max: 50, cast: false, tint: null });
    inst(new T.OctahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }), list, (o) => { o.position.y = 1 * o.scale.y; o.scale.y *= 2.2; });
  }
  if (P.includes('stands')) {
    const seatTex = canvasTex(256, 256, (g, w, h) => { for (let r = 0; r < 16; r++) { g.fillStyle = r % 2 ? '#334155' : '#475569'; g.fillRect(0, (r * h) / 16, w, h / 16); for (let i = 0; i < 40; i++) { g.fillStyle = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#ffffff', '#f97316'][(Math.random() * 6) | 0]; g.fillRect(Math.random() * w, (r * h) / 16 + 3, 4, 7); } } });
    for (const sStand of [L - 60, 46]) {
      kartAt(tr, sStand, q);
      for (const side of [-1, 1]) {
        const cx = q.x + q.rx * side * (WL + 14), cz = q.z + q.rz * side * (WL + 14);
        if ([0, 31, -31].some((d) => kartNear(tr, cx + q.fx * d, cz + q.fz * d).d < WL + 9)) continue;
        const g = new T.Group(); g.position.set(cx, q.y - 0.25, cz); g.rotation.y = yawAt(q) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        // Stufen mit Zuschauern
        for (let r = 0; r < 5; r++) {
          const s = new T.Mesh(new T.BoxGeometry(60, 1.8, 2.2), [0, 0, 1, 0, 1, 0].map((x) => (x ? new T.MeshStandardMaterial({ map: seatTex }) : new T.MeshStandardMaterial({ color: 0x64748b }))));
          s.position.set(0, 0.9 + r * 1.8, -r * 2.2); s.castShadow = true; s.receiveShadow = true; g.add(s);
        }
        const roof = new T.Mesh(new T.BoxGeometry(62, 0.5, 13), new T.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4 })); roof.position.set(0, 13, -4.5); roof.castShadow = true; g.add(roof);
        for (const x of [-30, 0, 30]) { const p = new T.Mesh(new T.BoxGeometry(0.6, 13, 0.6), new T.MeshStandardMaterial({ color: 0x94a3b8 })); p.position.set(x, 6.5, -10); g.add(p); }
        scene.add(g);
      }
    }
  }
  if (P.includes('tires')) {
    const list = [];
    for (let s = 0; s < L; s += 12) {
      kartAt(tr, s, q);
      if (Math.abs(q.k) < 0.012 || q.ty !== 0 || q.y > 1.2) continue;
      const side = q.k > 0 ? -1 : 1; // aussen
      for (let h = 0; h < 3; h++) { const x = q.x + q.rx * side * (WL + 2.2), z = q.z + q.rz * side * (WL + 2.2); list.push({ x, z, y: -0.25, rot: 0, sc: 1, h }); }
    }
    inst(new T.TorusGeometry(0.55, 0.28, 8, 16), new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 }), list, (o, p) => { o.position.y = p.y + 0.3 + p.h * 0.52; o.rotation.set(Math.PI / 2, 0, 0); });
  }
  if (P.includes('billboards')) {
    const ads = [['TEILMAL', '#FF6B4A'], ['1×1 TURBO', '#0F766E'], ['MAL & GETEILT', '#2563EB'], ['RECHNEN MACHT SCHNELL', '#7C3AED']];
    for (let i = 0; i < 12; i++) {
      kartAt(tr, (i + 0.5) * (L / 12), q);
      if (q.ty !== 0 || q.y > 1.5) continue;
      const side = i % 2 ? 1 : -1;
      const [txt, col] = ads[i % ads.length];
      const b = new T.Mesh(new T.BoxGeometry(14, 3.4, 0.3), [0, 0, 0, 0, 1, 1].map((x) => (x ? new T.MeshStandardMaterial({ map: kartSignTex(txt, col) }) : new T.MeshStandardMaterial({ color: 0x334155 }))));
      b.position.copy(pt(q, side * (WL + 6), 4)); b.rotation.y = yawAt(q) + Math.PI + side * 0.6;
      b.castShadow = true; scene.add(b);
      for (const dx of [-5, 5]) { const p = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 3, 6), new T.MeshStandardMaterial({ color: 0x94a3b8 })); p.position.set(dx, -3, 0); b.add(p); }
    }
  }
  if (P.includes('balloons')) {
    for (let i = 0; i < 6; i++) {
      const a = rnd(0, Math.PI * 2), d = rnd(250, 520);
      const g = new T.Group(); g.position.set(tr.box.cx + Math.cos(a) * d, rnd(60, 130), tr.box.cz + Math.sin(a) * d); scene.add(g);
      const bt = canvasTex(64, 128, (c, w, h) => { const cs = [['#ef4444', '#facc15'], ['#3b82f6', '#ffffff'], ['#22c55e', '#f97316']][i % 3]; for (let k2 = 0; k2 < 8; k2++) { c.fillStyle = cs[k2 % 2]; c.fillRect((k2 * w) / 8, 0, w / 8, h); } });
      const ball = new T.Mesh(new T.SphereGeometry(9, 20, 16), new T.MeshStandardMaterial({ map: bt })); ball.scale.y = 1.2; g.add(ball);
      const basket = new T.Mesh(new T.BoxGeometry(2.5, 2, 2.5), new T.MeshStandardMaterial({ color: 0x8b5a2b })); basket.position.y = -14; g.add(basket);
      st.onFrame((dt, t) => { g.position.y += Math.sin(t * 0.3 + i) * dt * 0.8; });
    }
  }
  if (P.includes('towers')) {
    const winTex = canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#0b0b18'; g.fillRect(0, 0, w, h);
      for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 14) { if (Math.random() < 0.55) { g.fillStyle = ['#fde68a', '#a5f3fc', '#f0abfc', '#ffffff'][(Math.random() * 4) | 0]; g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 7, 8); } }
      g.globalAlpha = 1;
    }, { repeat: [2, 3] });
    const list = scatter(300, 14, 280, 16).map((p) => ({ ...p, sc: 1, hgt: rnd(18, 130), wd: rnd(8, 18) }));
    inst(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9, roughness: 0.6 }), list, (o, p) => { o.scale.set(p.wd, p.hgt, p.wd); o.position.y = p.hgt / 2 - 0.25; });
    // Leuchtkanten oben auf den Häusern
    inst(new T.BoxGeometry(1, 0.6, 1), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4 }), list, (o, p) => { o.scale.set(p.wd + 0.4, 0.6, p.wd + 0.4); o.position.y = p.hgt; }, { cast: false, color: (p, i) => ['#22d3ee', '#f0abfc', '#a78bfa', '#facc15'][i % 4] });
  }
  if (P.includes('lamps')) {
    const list = [];
    for (let s = 0; s < L; s += 30) for (const side of [-1, 1]) { kartAt(tr, s + (side > 0 ? 15 : 0), q); if (q.ty === 2) continue; const p = pt(q, side * (WL + 0.25), q.ty === 1 ? 1.2 : wallH); list.push({ x: p.x, z: p.z, y: p.y, rot: 0, sc: 1 }); }
    inst(new T.CylinderGeometry(0.12, 0.16, 7, 6), new T.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 }), list, (o, p) => { o.position.y = p.y + 3.5; });
    const gm = new T.SpriteMaterial({ map: glowTex('rgba(240,171,252,1)', 'rgba(124,58,237,0)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    list.forEach((p) => { const s = new T.Sprite(gm); s.position.set(p.x, p.y + 7.2, p.z); s.scale.set(3, 3, 1); scene.add(s); });
  }
  if (P.includes('beams')) {
    const bm = new T.MeshBasicMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const a = rnd(0, Math.PI * 2), d = rnd(150, 400);
      const b = new T.Mesh(new T.ConeGeometry(14, 600, 16, 1, true), bm); b.position.set(tr.box.cx + Math.cos(a) * d, 300, tr.box.cz + Math.sin(a) * d); b.rotation.set(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)); scene.add(b);
      st.onFrame((dt, t) => { b.rotation.z = Math.sin(t * 0.25 + i) * 0.35; });
    }
  }
  if (P.includes('neonArches')) {
    for (let i = 0; i < 9; i++) {
      const s = (i + 0.3) * (L / 9);
      kartAt(tr, s, q);
      if (q.ty === 2 || nearStation(s)) continue;
      const a = new T.Mesh(new T.TorusGeometry(WL + 1, 0.35, 8, 40, Math.PI), new T.MeshStandardMaterial({ color: 0xffffff, emissive: [0x22d3ee, 0xf0abfc, 0xa78bfa][i % 3], emissiveIntensity: 2 }));
      a.position.set(q.x, q.y, q.z); a.rotation.y = yawAt(q); scene.add(a);
    }
  }
  if (P.includes('lollipops')) {
    let list = scatter(60, 5, 110, 4).map((p) => ({ ...p, sc: rnd(0.8, 2) }));
    list = voxSplit('lollipop', list, { near: 60, max: 20, variants: [1, 0], scale: 0.85, tint: null });
    inst(new T.CylinderGeometry(0.18, 0.18, 7, 8), new T.MeshStandardMaterial({ color: 0xffffff }), list, (o) => { o.position.y = 3.5 * o.scale.y - 0.25; });
    const lt = canvasTex(128, 128, (g) => { for (let r = 64; r > 0; r -= 8) { g.fillStyle = (r / 8) % 2 ? '#f472b6' : '#ffffff'; g.beginPath(); g.arc(64, 64, r, 0, Math.PI * 2); g.fill(); } });
    inst(new T.CylinderGeometry(2.2, 2.2, 0.6, 28), new T.MeshStandardMaterial({ map: lt, roughness: 0.3 }), list, (o) => { o.position.y = 7.6 * o.scale.y; o.rotation.x = Math.PI / 2; }, { color: (p, i) => ['#ffffff', '#fde68a', '#bae6fd', '#ddd6fe'][i % 4] });
  }
  if (P.includes('canes')) {
    let list = scatter(70, 3, 50, 3).map((p) => ({ ...p, sc: rnd(0.8, 1.5) }));
    list = voxSplit('cane', list, { near: Infinity, max: 24, tint: null });
    const ct = canvasTex(32, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ef4444'; for (let y = -w; y < h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + w); g.lineTo(w, y + w + 8); g.lineTo(0, y + 8); g.fill(); } }, { repeat: [1, 3] });
    const cm2 = new T.MeshStandardMaterial({ map: ct, roughness: 0.3 });
    inst(new T.CylinderGeometry(0.35, 0.35, 6, 12), cm2, list, (o) => { o.position.y = 3 * o.scale.y - 0.25; });
    inst(new T.TorusGeometry(0.9, 0.35, 10, 20, Math.PI), cm2, list, (o) => { o.position.y = 6 * o.scale.y - 0.25; o.position.x += 0.9 * o.scale.x * Math.cos(o.rotation.y); o.position.z -= 0.9 * o.scale.x * Math.sin(o.rotation.y); });
  }
  if (P.includes('cupcakes')) {
    let list = scatter(26, 18, 120, 14).map((p) => ({ ...p, sc: rnd(2, 4) }));
    list = voxSplit('cupcake', list, { near: 70, max: 12, variants: [0, 1, 2, 3], scale: 1.3, tint: null });
    inst(new T.CylinderGeometry(2.2, 1.7, 2.4, 20), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), list, (o) => { o.position.y = 1.2 * o.scale.y - 0.25; }, { color: (p, i) => ['#f472b6', '#60a5fa', '#a78bfa', '#facc15'][i % 4] });
    inst(new T.SphereGeometry(2.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), list, (o) => { o.position.y = 2.4 * o.scale.y - 0.25; }, { color: (p, i) => ['#fef3c7', '#fbcfe8', '#ffffff', '#7c2d12'][i % 4] });
    inst(new T.SphereGeometry(0.5, 12, 8), new T.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }), list, (o) => { o.position.y = 4.8 * o.scale.y - 0.25; });
  }
  if (P.includes('donuts')) {
    let list = scatter(30, 10, 100, 10).map((p) => ({ ...p, sc: rnd(1.5, 3.5) }));
    list = voxSplit('donut', list, { near: 60, max: 10, variants: [0, 1, 2, 3], scale: 1.1, tint: null });
    inst(new T.TorusGeometry(1.4, 0.7, 14, 28), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), list, (o) => { o.position.y = 2.1 * o.scale.y - 0.25; }, { color: (p, i) => ['#f9a8d4', '#fde68a', '#c4b5fd', '#92400e'][i % 4] });
  }
  if (P.includes('gumdrops')) {
    let list = scatter(260, 2.5, 60, 2.5).map((p) => ({ ...p, sc: rnd(0.5, 1.2) }));
    list = voxSplit('gumdrop', list, { near: Infinity, lod: 1, max: 120, variants: [0, 1, 2, 3, 4], cast: false, tint: null });
    inst(new T.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }), list, (o) => { o.position.y = -0.2; }, { color: (p, i) => ['#ef4444', '#22c55e', '#facc15', '#a855f7', '#f97316', '#38bdf8'][i % 6] });
  }
  // Kurvenschilder (Pfeile aussen auf der Bande)
  {
    const cl = [], cr = [];
    for (let s = 20; s < L; s += 24) {
      kartAt(tr, s, q);
      if (Math.abs(q.k) < 0.016 || q.ty === 2 || nearStation(s)) continue;
      const side = q.k > 0 ? -1 : 1;
      const p = pt(q, side * (WL + 0.2), wallTop(q) + 0.75);
      (q.k > 0 ? cr : cl).push({ x: p.x, z: p.z, y: p.y, rot: yawAt(q) + Math.PI, sc: 1 });
    }
    const chev = (list, dir) => inst(new T.BoxGeometry(3.2, 1.2, 0.1), [0, 0, 0, 0, 1, 1].map((x) => (x ? new T.MeshStandardMaterial({ map: kartChevronTex(dir), emissive: TH.night ? 0xffffff : 0x000000, emissiveMap: TH.night ? kartChevronTex(dir) : null, emissiveIntensity: TH.night ? 0.5 : 0 }) : new T.MeshStandardMaterial({ color: 0x111827 }))), list, (o, p) => { o.position.y = p.y; });
    if (cr.length) chev(cr, 1);
    if (cl.length) chev(cl, -1);
  }
  // Fähnchen- bzw. Laternen-Girlanden über der Strecke
  if (TH.bunting) {
    const flags = [], poles = [];
    for (let s = 70; s < L - 40; s += 95) {
      kartAt(tr, s, q);
      if (q.ty !== 0 || nearStation(s)) continue;
      const A = pt(q, -WL - 0.6, 9), Bp = pt(q, WL + 0.6, 9);
      poles.push({ x: A.x, z: A.z, y: A.y - 9, rot: 0, sc: 1 }, { x: Bp.x, z: Bp.z, y: Bp.y - 9, rot: 0, sc: 1 });
      const n = 18;
      for (let i = 1; i < n; i++) {
        const t = i / n, sag = Math.sin(t * Math.PI) * 2.2;
        flags.push({ x: A.x + (Bp.x - A.x) * t, z: A.z + (Bp.z - A.z) * t, y: A.y + (Bp.y - A.y) * t - sag, rot: yawAt(q) + Math.PI / 2, sc: 1, ci: i });
      }
    }
    inst(new T.CylinderGeometry(0.12, 0.14, 9.4, 6), new T.MeshStandardMaterial({ color: 0x8b5a2b }), poles, (o, p) => { o.position.y = p.y + 4.7; });
    const fg = TH.lanterns ? new T.SphereGeometry(0.32, 10, 8) : new T.ConeGeometry(0.42, 0.9, 3);
    inst(fg, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: T.DoubleSide, emissive: TH.lanterns ? 0xffb347 : 0x000000, emissiveIntensity: TH.lanterns ? 0.6 : 0 }), flags, (o, p) => { o.position.y = p.y - 0.45; o.rotation.set(TH.lanterns ? 0 : Math.PI, p.rot, 0); }, { cast: false, color: (p) => TH.bunting[p.ci % TH.bunting.length] });
  }
  if (TH.snowfall) {
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([rnd(-60, 60), rnd(0, 40), rnd(-60, 60)], i * 3);
    const gs = new T.BufferGeometry(); gs.setAttribute('position', new T.BufferAttribute(p, 3));
    const flakes = new T.Points(gs, new T.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false }));
    scene.add(flakes);
    st.onFrame((dt, t) => {
      const a = gs.attributes.position.array;
      for (let i = 0; i < n; i++) { a[i * 3 + 1] -= dt * (3 + (i % 5)); a[i * 3] += Math.sin(t + i) * dt * 0.6; if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 40; }
      gs.attributes.position.needsUpdate = true;
      flakes.position.set(camera.position.x, camera.position.y - 20, camera.position.z);
    });
  }

  /* Fahrerinnen und Fahrer */
  // Karts im Stil der Avatare: die eigene Figur fährt mit dem Kart aus der Garage (alle fahren gleich schnell)
  if (typeof w3LoadEngine === 'function') await w3LoadEngine().catch((e) => console.warn('Avatar-Baukasten', e));
  const myLook = typeof garageLook === 'function' ? garageLook() : null;
  let myDriver = null;
  try { if (typeof vxFigure === 'function' && typeof a3Mine === 'function') myDriver = a3Mine(); } catch (e) { console.warn('eigene Figur', e); }
  const BOT_BODIES = ['kart', 'buggy', 'formula', 'bubble', 'kart'];
  const racers = KART_RACERS.map((r, i) => {
    const look = i === 0 ? (myLook || { paint: r.color, num: r.num }) : { body: BOT_BODIES[(i - 1) % BOT_BODIES.length], paint: r.color, paint2: r.helmet, num: r.num };
    const driver = typeof kvBotLook === 'function' ? (i === 0 ? myDriver || kvBotLook(9) : kvBotLook(i)) : null;
    const m = kartModel(T, r.color, r.helmet, r.num, look, driver, { lite: i > 0 });
    scene.add(m.g);
    return {
      i, name: r.name, color: i === 0 && myLook ? m.look.paint : r.color, bot: i > 0, m,
      p: 0, lat: 0, latV: 0, v: 0, fx: null, fxUntil: 0, zoneLane: null, wantLane: null, phase: rnd(0, 6),
      skill: i > 0 ? rnd(0.97, 1.03) : 1, acc: i > 0 ? rnd(0.7, 0.9) : 1, line: i > 0 ? rnd(0.45, 0.95) : 0, mathN: 0, mathRow: 0, finished: 0, seen: new Set(), wallT: 0, boostUntil: 0, boostMul: 1, drift: 0, fxMul: 0,
    };
  });
  // Funken für den Kurven-Turbo an deinen Hinterrädern
  const sparkMat = new T.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const sparks = racers[0].m.wheels.filter((w) => !w.front).map((w) => { const sp = new T.Sprite(sparkMat); sp.position.set(w.steer.position.x, 0.12, w.steer.position.z - 0.15); sp.visible = false; racers[0].m.g.add(sp); return sp; });
  // Startaufstellung: Du startest von Platz 4
  const me = racers[0];
  const grid = [[-7, -0.55], [-7, 0.55], [-15, -0.55], [-15, 0.55], [-23, -0.55], [-23, 0.55]];
  [1, 2, 3, 0, 4, 5].forEach((ri, gi) => { racers[ri].p = grid[gi][0]; racers[ri].lat = grid[gi][1] * LANE; });

  /* Steuerung: Tasten und Tippen/Halten links oder rechts */
  const input = { left: false, right: false, ptr: new Map() };
  const steerOf = () => {
    let s = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joy;
    for (const x of input.ptr.values()) s += x;
    return clamp(s, -1, 1);
  };
  // Joystick (stufenlos lenken, vor allem auf Handy und Tablet)
  input.joy = 0;
  const joyCtl = typeof g2Joystick === 'function' ? g2Joystick($('#kjoy'), (x) => { input.joy = Math.abs(x) < 0.12 ? 0 : x * 1.15; if (x) startTap(); }) : null;
  const onKey = (e, down) => {
    const k = e.key;
    if (['ArrowLeft', 'a', 'A'].includes(k)) { input.left = down; e.preventDefault(); }
    if (['ArrowRight', 'd', 'D'].includes(k)) { input.right = down; e.preventDefault(); }
  };
  const kd = (e) => { if (ui.view === 'game' && !ui.modal) { onKey(e, true); if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'A', 'D'].includes(e.key)) startTap(); } };
  const ku = (e) => onKey(e, false);
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  const ptrSide = (e) => { const r = host.getBoundingClientRect(); return e.clientX - r.left < r.width / 2 ? -1 : 1; };
  const pd = (e) => { input.ptr.set(e.pointerId, ptrSide(e)); host.setPointerCapture?.(e.pointerId); e.preventDefault(); startTap(); };
  const pmv = (e) => { if (input.ptr.has(e.pointerId)) input.ptr.set(e.pointerId, ptrSide(e)); };
  const pu = (e) => { input.ptr.delete(e.pointerId); };
  host.addEventListener('pointerdown', pd); host.addEventListener('pointermove', pmv);
  host.addEventListener('pointerup', pu); host.addEventListener('pointercancel', pu); host.addEventListener('pointerleave', pu);
  let engine = null;
  function startEngine() {
    if (!db.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0.0001;
      o.connect(f); o2.connect(f); f.connect(g).connect(audioCtx.destination);
      o.start(); o2.start();
      g.gain.exponentialRampToValueAtTime(0.022, audioCtx.currentTime + 0.4);
      engine = { o, o2, g, f };
    } catch { engine = null; }
  }
  function stopEngine() {
    if (!engine) return;
    try { engine.g.gain.cancelScheduledValues(audioCtx.currentTime); engine.g.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.08); const e = engine; setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch { /* */ } }, 400); } catch { /* */ }
    engine = null;
  }
  game.cleanups.push(() => { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); stopEngine(); joyCtl?.dispose(); });

  /* Anzeige */
  const elPlace = $('#kplace'), elLap = $('#klap'), elRank = $('#krank'), elTime = $('#ktime'), elAsk = $('#kask'), elTask = $('#ktask'), elAns = $('#kans'), elHint = $('#kaskhint'), elLines = $('#klines'), elCount = $('#kcount'), elLights = $('#klights');
  const elMt = $('#kmt'), elMtBar = $('#kmtbar'), elMtTxt = $('#kmttxt'), elMath = $('#kmath'), elStartHint = $('#kstarthint');
  const map = $('#kmap'), mg = map.getContext('2d');
  const mapImg = document.createElement('canvas'); mapImg.width = map.width; mapImg.height = map.height;
  const mb = tr.box, msc = Math.min((map.width - 30) / (mb.maxX - mb.minX), (map.height - 30) / (mb.maxZ - mb.minZ));
  const mx = (x) => map.width / 2 + (x - mb.cx) * msc, my = (z) => map.height / 2 + (z - mb.cz) * msc;
  {
    const g = mapImg.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    // zuerst der untere Teil, dann Brücken obendrauf; Tunnel gestrichelt
    for (const pass of [0, 1]) for (const [w, c] of [[12, 'rgba(0,0,0,.35)'], [7, 'rgba(255,255,255,.92)']]) {
      g.strokeStyle = c; g.lineWidth = w;
      let open = false;
      for (let s = 0; s <= L; s += 5) {
        kartAt(tr, s, q);
        const on = pass === 0 ? q.ty !== 1 : q.ty === 1;
        if (on) { if (!open) { g.beginPath(); g.moveTo(mx(q.x), my(q.z)); open = true; } else g.lineTo(mx(q.x), my(q.z)); } else if (open) { g.stroke(); open = false; }
      }
      if (open) g.stroke();
    }
    g.strokeStyle = 'rgba(80,80,90,.7)'; g.lineWidth = 7; g.setLineDash([6, 5]);
    let open = false;
    for (let s = 0; s <= L; s += 5) { kartAt(tr, s, q); if (q.ty === 2) { if (!open) { g.beginPath(); g.moveTo(mx(q.x), my(q.z)); open = true; } else g.lineTo(mx(q.x), my(q.z)); } else if (open) { g.stroke(); open = false; } }
    if (open) g.stroke();
    g.setLineDash([]);
    kartAt(tr, 0, q); g.fillStyle = '#111'; g.fillRect(mx(q.x) - 5, my(q.z) - 5, 10, 10);
  }
  const trail = [];
  let mapT = 0;
  /** Karte: jedes Bild neu – Gegner als Punkte, du als Pfeil mit Puls und Spur, Krone für die Spitze, ?-Würfel als Punkte */
  function drawMap(dt = 0) {
    mapT += dt;
    mg.clearRect(0, 0, map.width, map.height); mg.drawImage(mapImg, 0, 0);
    for (const stn of stations) {
      kartAt(tr, stn.s0, q);
      const on = stn.cubes.some((c) => c.grp.visible);
      mg.fillStyle = on ? '#a78bfa' : 'rgba(167,139,250,.35)'; mg.beginPath(); mg.arc(mx(q.x), my(q.z), 4 + (on ? Math.sin(mapT * 5) * 0.8 : 0), 0, Math.PI * 2); mg.fill();
      kartAt(tr, stn.s1, q); mg.fillStyle = '#22c55e'; mg.fillRect(mx(q.x) - 3, my(q.z) - 3, 6, 6);
    }
    kartAt(tr, me.p, q);
    const px = mx(q.x + q.rx * me.lat), py = my(q.z + q.rz * me.lat);
    if (!trail.length || Math.hypot(trail[trail.length - 1][0] - px, trail[trail.length - 1][1] - py) > 2) { trail.push([px, py]); if (trail.length > 26) trail.shift(); }
    for (let i = 1; i < trail.length; i++) {
      mg.strokeStyle = `rgba(255,224,138,${(i / trail.length) * 0.8})`; mg.lineWidth = 2 + (i / trail.length) * 3; mg.lineCap = 'round';
      mg.beginPath(); mg.moveTo(trail[i - 1][0], trail[i - 1][1]); mg.lineTo(trail[i][0], trail[i][1]); mg.stroke();
    }
    const leader = racers.reduce((a, r) => (placeOf(r) === 1 ? r : a), racers[0]);
    for (const r of [...racers].reverse()) {
      if (r === me) continue;
      kartAt(tr, r.p, q);
      const x = mx(q.x + q.rx * r.lat), y = my(q.z + q.rz * r.lat);
      mg.fillStyle = kartHex(r.color); mg.strokeStyle = '#fff'; mg.lineWidth = 2;
      mg.beginPath(); mg.arc(x, y, 6, 0, Math.PI * 2); mg.fill(); mg.stroke();
      if (r.fx === 'turbo') { mg.strokeStyle = 'rgba(255,170,60,.9)'; mg.lineWidth = 2; mg.beginPath(); mg.arc(x, y, 9 + Math.sin(mapT * 20), 0, Math.PI * 2); mg.stroke(); }
      if (r === leader) { mg.fillStyle = '#FFD84D'; mg.font = '13px system-ui'; mg.textAlign = 'center'; mg.fillText('👑', x, y - 9); }
    }
    // du: Pfeil in Fahrtrichtung, pulsierender Ring
    kartAt(tr, me.p, q);
    const ang = Math.atan2(q.fz * msc, q.fx * msc), pulse = (mapT * 1.6) % 1;
    mg.strokeStyle = `rgba(255,224,138,${1 - pulse})`; mg.lineWidth = 3; mg.beginPath(); mg.arc(px, py, 9 + pulse * 12, 0, Math.PI * 2); mg.stroke();
    if (st.time < me.boostUntil || me.fx === 'turbo') { mg.fillStyle = me.fx === 'turbo' ? 'rgba(255,150,40,.45)' : 'rgba(192,132,252,.5)'; mg.beginPath(); mg.arc(px, py, 15, 0, Math.PI * 2); mg.fill(); }
    mg.save(); mg.translate(px, py); mg.rotate(ang);
    mg.fillStyle = kartHex(me.color); mg.strokeStyle = '#fff'; mg.lineWidth = 3; mg.lineJoin = 'round';
    mg.beginPath(); mg.moveTo(12, 0); mg.lineTo(-8, -8); mg.lineTo(-4, 0); mg.lineTo(-8, 8); mg.closePath(); mg.fill(); mg.stroke();
    mg.restore();
    if (me === leader) { mg.font = '14px system-ui'; mg.textAlign = 'center'; mg.fillText('👑', px, py - 12); }
  }
  const total = KART.LAPS * L;
  const placeOf = (r) => 1 + racers.filter((o) => o !== r && (o.finished ? (!r.finished || o.finished < r.finished) : !r.finished && o.p > r.p)).length;
  const rankLis = racers.map((r) => { const li = document.createElement('li'); if (!r.bot) li.className = 'me'; li.innerHTML = `<i style="background:${kartHex(r.color)}"></i>${esc(r.name)}`; return li; });
  let rankOrder = '', lastPlace = 0;
  function hud() {
    const place = placeOf(me);
    elPlace.textContent = `${place}.`;
    elLap.textContent = `Runde ${clamp(Math.floor(Math.max(0, me.p) / L) + 1, 1, KART.LAPS)}/${KART.LAPS}`;
    // Rangliste: Einträge gleiten an ihren neuen Platz
    const order = [...racers].sort((a, b) => placeOf(a) - placeOf(b));
    const key = order.map((r) => r.i).join(',');
    if (key !== rankOrder) {
      const before = new Map(rankLis.map((li) => [li, li.isConnected ? li.getBoundingClientRect().top : null]));
      order.forEach((r) => elRank.appendChild(rankLis[r.i]));
      if (rankOrder && !reduceMotion()) rankLis.forEach((li) => {
        const t0 = before.get(li);
        if (t0 == null) return;
        const dy = t0 - li.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.25)' });
      });
      rankOrder = key;
    }
    // grosse Zahl: hüpft grün nach oben bzw. wackelt rot, dazu «▲ 1» / «▼ 1»
    if (lastPlace && place !== lastPlace && S.phase === 'race') {
      const up = place < lastPlace, n = Math.abs(place - lastPlace);
      const box = elPlace.parentElement;
      box.classList.remove('up', 'down'); void box.offsetWidth; box.classList.add(up ? 'up' : 'down');
      const tag = document.createElement('span'); tag.className = `kart-delta ${up ? 'up' : 'down'}`; tag.textContent = `${up ? '▲' : '▼'} ${n}`;
      box.appendChild(tag); setTimeout(() => tag.remove(), 1300);
      rankLis[me.i].classList.remove('flash'); void rankLis[me.i].offsetWidth; rankLis[me.i].classList.add('flash');
      if (up) tone([880, 1320], 0.08, 'triangle', 0.06); else tone([330, 247], 0.1, 'sine', 0.05);
    }
    lastPlace = place;
  }
  /** Schub für dich (Kurven-Turbo oder Start-Turbo) */
  function boost(mul, ms) { me.boostMul = mul; me.boostUntil = st.time + ms; }
  /** Kurven-Turbo auslösen: Stufe aus der Ladung */
  const MT_COL = ['#ffffff', '#60a5fa', '#fb923c', '#c084fc'], MT_HEX = [0xffffff, 0x60a5fa, 0xfb923c, 0xc084fc];
  const mtTier = (c) => (c >= KART.MT[2] ? 3 : c >= KART.MT[1] ? 2 : c >= KART.MT[0] ? 1 : 0);
  function releaseMini() {
    const tier = mtTier(S.mt);
    S.mt = 0;
    if (!tier) return;
    boost(KART.MT_MUL[tier], KART.MT_MS[tier]);
    S.mtFlash = { tier, until: st.time + 900 };
    noise(0.25 + tier * 0.08, { freq: 700 + tier * 300, gain: 0.05 });
    tone([392, 523, 659, 784].slice(0, tier + 1), 0.06, 'triangle', 0.05);
    kartAt(tr, me.p, q); burst(st, pt(q, me.lat, 0.4), { n: 18 + tier * 10, colors: [MT_HEX[tier], 0xffffff], speed: 4, life: 0.4, size: 0.22, gravity: -4 });
  }
  /** Start-Turbo: Tippen kurz vor bzw. genau bei «LOS!» */
  function startTap() {
    try {
      if (!S || S.tapped) return;
      const t = performance.now();
      if (S.phase === 'count') { if (S.goAt - t > 900) return; S.tapped = t; }       // frühere Tipper zählen nicht
      else if (S.phase === 'race' && t - S.goReal < 220) { S.tapped = t; startResult(); }
    } catch { /* Rennen noch nicht bereit */ }
  }
  function startResult() {
    if (!S.tapped) return;
    const d = S.goAt - S.tapped;                                  // > 0: vor «LOS!»
    if (d <= 380) {
      const good = d >= -120;
      boost(good ? KART.START_MUL : 1.1, good ? KART.START_MS : 600);
      bigWord(host, good ? 'RAKETENSTART!' : 'Guter Start!', 'good kart-word');
      tone([660, 990, 1320], 0.07, 'triangle', 0.06);
    } else {
      S.stallUntil = st.time + 650;
      bigWord(host, 'Zu früh!', 'bad kart-word');
      tone([196, 147], 0.12, 'sine', 0.05);
    }
  }

  /* Ablauf */
  const S = { phase: 'intro', t0: 0, raceT0: 0, ask: null, ok: 0, wrong: 0, wrongs: [], mt: 0, mtOff: 0, tapped: 0, goAt: 0, goReal: 0, stallUntil: 0 };
  game.kart = S;
  S.dbg = { racers, stations, tr, me: () => me }; // für Tests
  const look = new T.Vector3();
  S.camLat = me.lat; S.camBack = 7.6; S.camY = 3.5;
  /** Kamera hinter dir, entlang der Strecke (in Kurven und an Steigungen schaut sie mit) */
  function camTarget(out, outLook) {
    kartAt(tr, me.p - S.camBack, q);
    const cl = S.camLat * 0.8;
    out.set(q.x + q.rx * cl, kartH(q, cl) + S.camY, q.z + q.rz * cl);
    kartAt(tr, me.p + 12, q2);
    const ll = S.camLat * 0.5;
    outLook.set(q2.x + q2.rx * ll, kartH(q2, ll) + 1.4, q2.z + q2.rz * ll);
  }
  const cDes = new T.Vector3(), lDes = new T.Vector3();
  camTarget(cDes, lDes);
  camera.position.set(cDes.x + 70, cDes.y + 80, cDes.z + 50); look.copy(lDes);
  camera.lookAt(look);

  function placeKart(r, dt) {
    kartAt(tr, r.p, q);
    r.m.g.position.copy(pt(q, r.lat));
    const yaw = Math.atan2(q.fx, q.fz) - Math.atan2(r.latV, Math.max(6, r.v)) * 0.85 - (r.drift || 0);
    r.m.g.rotation.set(-Math.atan(q.sl), yaw, Math.atan(q.b), 'YXZ');
    const spin = r.v * dt;
    for (const w of r.m.wheels) { w.spin.rotation.x += spin / w.r; if (w.front) w.steer.rotation.y = clamp(-r.latV * 0.045, -0.4, 0.4); }
    r.m.body.rotation.z = clamp(r.latV * 0.01, -0.07, 0.07);
    r.m.body.position.y = r.fx === 'slow' ? Math.abs(Math.sin(st.time / 70)) * 0.06 : 0;
    const fs = r.fx === 'turbo' || st.time < r.boostUntil ? 0.9 + Math.random() * 0.5 : 0.01;
    r.m.flames.forEach((f) => { const k = f.userData.k || 1; f.scale.set(fs * k, fs * k, 1); });
    r.m.setSteer?.(clamp(r.latV * 0.12, -1, 1));
    r.m.setMood?.(r.finished ? 'win' : r.fx === 'turbo' || st.time < r.boostUntil ? 'turbo' : r.fx === 'slow' ? 'oops' : '');
    r.m.tick?.(st.time / 1000, dt);
  }
  racers.forEach((r) => placeKart(r, 0));
  hud(); drawMap();

  const laneOf = (lat) => (lat < -LANE / 2 ? 0 : lat > LANE / 2 ? 2 : 1);
  const lapS = (p) => ((p % L) + L) % L;
  function zoneAt(p) {
    const s = lapS(p);
    for (const stn of stations) for (const c of [stn.s0, stn.s1]) if (Math.abs(s - c) <= KART.ZONE + 0.5) return c;
    return null;
  }
  function setFx(r, kind, ms = KART.FX_MS, mul = 0) { r.fx = kind; r.fxUntil = st.time + ms; r.fxMul = mul; }
  /** Antwort zählen (für alle gleich): bei der 4. richtigen Turbo, 4 hintereinander = Mega-Turbo; falsch nimmt ein Feld weg.
      Liefert 'turbo', 'mega', 'ok' oder 'bad'. */
  function mathCount(r, ok) {
    if (!ok) { r.mathN = Math.max(0, r.mathN - 1); r.mathRow = 0; setFx(r, 'slow'); return 'bad'; }
    r.mathN++; r.mathRow++;
    if (r.mathN < KART.MATH_EVERY) return 'ok';
    const mega = r.mathRow >= KART.MATH_EVERY;
    setFx(r, 'turbo', mega ? KART.MEGA_MS : KART.MATH_MS, mega ? KART.MEGA_MUL : KART.MATH_MUL);
    r.mathN = 0; r.mathRow = 0;
    return mega ? 'mega' : 'turbo';
  }
  function mathHud(pop) {
    [...elMath.querySelectorAll('i')].forEach((el, i) => el.classList.toggle('on', i < me.mathN));
    if (pop) { elMath.classList.remove('pop', 'lost', 'full'); void elMath.offsetWidth; elMath.classList.add(pop); }
  }
  function smoke(r) {
    kartAt(tr, r.p - 1.4, q);
    burst(st, pt(q, r.lat, 0.8), { n: 18, colors: [0x9ca3af, 0xd1d5db, 0x6b7280], speed: 1.6, life: 0.9, size: 0.9, gravity: 1.2 });
  }
  /** Würfel zerspringt; er taucht wieder auf, sobald das nächste Kart kommt (sonst nach kurzer Zeit) */
  function shatterCube(c, { near = true } = {}) {
    const pos = c.grp.getWorldPosition(new T.Vector3());
    c.hiddenUntil = st.time + 2600; c.shotAt = st.time; c.grp.visible = false;
    if (!near) return;
    burst(st, pos, { n: 70, colors: [0x22d3ee, 0xa78bfa, 0xf472b6, 0xffffff], speed: 7, life: 0.8, size: 0.35, gravity: -6 });
    const shards = [];
    for (let i = 0; i < 14; i++) {
      const s = new T.Mesh(new T.BoxGeometry(rnd(0.15, 0.5), rnd(0.15, 0.5), 0.06), cubeMat);
      s.position.copy(pos); s.userData.v = new T.Vector3(rnd(-6, 6), rnd(2, 8), rnd(-6, 6)); s.userData.r = new T.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
      scene.add(s); shards.push(s);
    }
    let age = 0;
    const off = st.onFrame((dt) => {
      age += dt;
      shards.forEach((s) => { s.userData.v.y -= 16 * dt; s.position.addScaledVector(s.userData.v, dt); s.rotation.x += s.userData.r.x * dt; s.rotation.y += s.userData.r.y * dt; });
      if (age > 1) { off(); shards.forEach((s) => { scene.remove(s); s.geometry.dispose(); }); }
    });
    tone([1760, 2349, 3136], 0.06, 'triangle', 0.06); noise(0.2, { freq: 4200, gain: 0.05 });
  }
  function showAsk(stn) {
    const t = game.picker.next();
    const vals = choicesFor(t, 3);
    stn.vals = vals; stn.correct = vals.indexOf(t.answer); stn.task = t;
    S.ask = { stn, t, at: performance.now() };
    stn.boards.forEach((b, i) => { b.mat.map?.dispose(); b.mat.map = kartBoardTex(String(vals[i]), TH.board); if (b.mat.emissiveMap) b.mat.emissiveMap = b.mat.map; b.mat.needsUpdate = true; });
    elTask.innerHTML = taskHTML(t, '<span class="slot">?</span>');
    elAns.innerHTML = vals.map((v, i) => `<span class="ka" data-i="${i}"><small>${['◀', '▲', '▶'][i]}</small>${v}</span>`).join('');
    elHint.textContent = 'Fahr durch das richtige Ergebnis';
    elAsk.hidden = false; elAsk.className = 'kart-ask'; void elAsk.offsetWidth; elAsk.classList.add('pop');
    stn.label.forEach((l) => st.removeLabel(l));
    stn.label = vals.map((v, i) => {
      const el = document.createElement('div'); el.className = 'kart-num'; el.textContent = v;
      const pos = new T.Vector3();
      return st.addLabel(el, () => {
        const d = lapS(stn.s1 - me.p);
        if (!S.ask || S.ask.stn !== stn || d > 80) return null;
        kartAt(tr, stn.s1, q2);
        return pos.copy(pt(q2, (i - 1) * LANE, 5.7));
      }, { base: 1, min: 0.55, max: 1.5, dist: 26 });
    });
  }
  function answer(stn, lane) {
    const a = S.ask; if (!a || a.stn !== stn) return;
    S.ask = null;
    const val = stn.vals[lane];
    const ok = recordAnswer(a.t, val, 3000);
    $$('#kans .ka').forEach((el, i) => el.classList.add(i === stn.correct ? 'right' : i === lane ? 'wrong' : 'fade'));
    stn.label.forEach((l, i) => l.el.classList.add(i === stn.correct ? 'right' : i === lane ? 'wrong' : 'fade'));
    if (ok) {
      S.ok++;
      const res = mathCount(me, true);
      sfx.good();
      elAsk.classList.add('ok');
      elTask.innerHTML = esc(taskText(a.t, true));
      kartAt(tr, me.p + 2, q);
      if (res === 'ok') {
        const left = KART.MATH_EVERY - me.mathN;
        elHint.textContent = `Richtig! Noch ${left} bis zum Turbo`;
        tone([523, 784], 0.07, 'triangle', 0.05); mathHud('pop');
        burst(st, pt(q, me.lat, 1.5), { n: 24, colors: [0x22c55e, 0xbbf7d0, 0xffffff], speed: 4, life: 0.5, size: 0.24 });
      } else {
        elHint.textContent = res === 'mega' ? '4 richtig hintereinander – Mega-Turbo!' : '4 richtig – Turbo!';
        tone([523, 784, 1047, 1568].concat(res === 'mega' ? [2093] : []), 0.07, 'sawtooth', 0.05); mathHud('full');
        bigWord(host, res === 'mega' ? 'MEGA-TURBO!' : 'TURBO!', 'good kart-word');
        burst(st, pt(q, me.lat, 1.5), { n: 60, colors: [0x22c55e, 0xbbf7d0, 0xffffff], speed: 6, life: 0.7, size: 0.3 });
      }
    } else {
      S.wrong++; S.wrongs.push(a.t); mathCount(me, false); mathHud('lost'); sfx.bad(); smoke(me); st.shake(0.25);
      elAsk.classList.add('bad'); elHint.textContent = 'Schade – das war nicht richtig';
      elTask.innerHTML = esc(taskText(a.t, true));
    }
    const keep = stn;
    gLater(() => { if (!S.ask) elAsk.hidden = true; keep.label.forEach((l) => st.removeLabel(l)); keep.label = []; }, 1700);
  }
  /** Ideallinie der Computer-Fahrer: in Kurven nach innen, je nach Können */
  function botLine(r) {
    let k = 0;
    for (let d = 6; d <= 42; d += 6) { kartAt(tr, r.p + d, q2); k += q2.k; }
    k /= 7;
    const inside = clamp(k * 70, -1, 1);
    return inside * (HW - 1.6) * r.line + Math.sin(st.time / 1700 + r.phase) * 2.2 * (1 - r.line);
  }

  /* Rennlogik pro Bild */
  const cPos = new T.Vector3();
  // Leistung: ruckelt es (ältere Tablets), zuerst die Auflösung, dann die Schatten zurücknehmen
  const perf = { n: 0, acc: 0, step: 0 };
  st.onFrame((dt) => {
    if (perf.step >= 2 || st.disposed) return;
    perf.n++; perf.acc += dt;
    if (perf.acc < 2.5) return;
    const fps = perf.n / perf.acc; perf.n = 0; perf.acc = 0;
    if (fps >= 40) { perf.step = 2; return; }
    perf.step++;
    if (perf.step === 1) { renderer.setPixelRatio(Math.min(1, renderer.getPixelRatio())); renderer.setSize(st.w, st.h, false); }
    else sun.castShadow = false;
  });
  st.onFrame((dt) => {
    if (st.disposed) return;
    const now = st.time;
    for (const stn of stations) for (const c of stn.cubes) {
      c.m.rotation.y += dt * 1.4; c.m.rotation.x = Math.sin(now / 900 + c.phase) * 0.25;
      c.grp.position.y = c.base + Math.sin(now / 500 + c.phase) * 0.2;
      if (!c.grp.visible) {
        // kommt das nächste Kart auf dieser Spur, ist der Würfel gleich wieder da
        const coming = now - c.shotAt > 250 && racers.some((r) => { const ahead = ((c.s - lapS(r.p)) % L + L) % L; return ahead > 2 && ahead < 30 && Math.abs(r.lat - c.lane * LANE) < LANE / 2 + 0.8; });
        if (now > c.hiddenUntil || coming) { c.grp.visible = true; c.grp.scale.setScalar(0.01); st.tween(coming ? 180 : 300, (u, e) => c.grp.scale.setScalar(Math.max(0.01, e))); }
      }
    }
    if (S.phase === 'intro') {
      camTarget(cDes, lDes);
      const u = clamp((now - S.t0) / 2600, 0, 1), e = ease.inOut(u);
      camera.position.lerp(cDes, 1 - Math.pow(0.0005, dt * (0.4 + e)));
      look.lerp(lDes, 1 - Math.pow(0.001, dt));
      camera.lookAt(look);
      if (u >= 1 && (camera.position.distanceTo(cDes) < 0.6 || now - S.t0 > 4200)) { S.phase = 'count'; countdown(); }
      return;
    }
    const racing = S.phase === 'race' || S.phase === 'done';
    // Vor dem Start steht alles still: kein Lenken, kein Losfahren
    const steer = S.phase === 'race' ? steerOf() : 0;
    $('#kpl')?.classList.toggle('on', steer < 0); $('#kpr')?.classList.toggle('on', steer > 0);
    for (const r of racers) {
      if (r.fx && now > r.fxUntil) r.fx = null;
      kartAt(tr, r.p, q);
      // Kurven-Turbo (nur du): innen durch die Kurve lädt Funken, am Kurvenende gibt es Schub. Bande berühren = Ladung weg.
      if (r === me && S.phase === 'race' && !r.finished) {
        const kk = Math.abs(q.k), inside = (Math.sign(q.k) * r.lat) / HW;
        if (kk > 1 / 85 && inside > 0.3 && r.zone == null) { S.mt += dt * (0.55 + inside) * clamp(kk * 40, 0.8, 1.6); S.mtOff = 0; }
        else { S.mtOff += dt; if (S.mtOff > 0.25 && S.mt > 0) releaseMini(); }
        r.drift += ((S.mt > 0.3 ? Math.sign(q.k) * Math.min(0.2, 0.06 + S.mt * 0.04) : 0) - r.drift) * Math.min(1, dt * 6);
      } else r.drift *= Math.max(0, 1 - dt * 6);
      let target = 0;
      if (racing) {
        const fxMul = r.fx === 'turbo' ? (r.fxMul || KART.TURBO) : r.fx === 'slow' ? KART.SLOW : 1;
        target = KART.BASE * r.skill * (now < r.boostUntil ? Math.max(fxMul, r.boostMul) : fxMul);
        target *= clamp(1 - q.sl * 0.9, 0.86, 1.12); // bergauf etwas langsamer, bergab schneller
        if (r.bot) {
          const d = r.p - me.p;
          target *= 1 - clamp(d / 70, -1, 1) * (d > 0 ? 0.11 : 0.08); // Gummiband: wer weit hinten ist, holt etwas auf
          if (r.finished) target *= 0.6;
        }
        if (r === me && S.phase === 'done') target *= 0.55;
        if (Math.abs(r.lat) > HW - 0.2) target *= 0.9; // auf dem Randstein
      }
      if (r === me && now < (S.stallUntil || 0)) target = Math.min(target, 4);
      r.v += (target - r.v) * Math.min(1, dt * (target > r.v ? 1.3 : 2.4));
      if (!racing) { r.v = 0; r.latV = 0; }
      // Lenken
      if (r.bot && racing) {
        const s = lapS(r.p);
        let lane = null;
        for (const stn of stations) {
          for (const [c, gate] of [[stn.s0, false], [stn.s1, true]]) {
            const ahead = c - s;
            if (ahead > -KART.ZONE && ahead < 60) {
              const key = `${stn.k}${gate}${Math.floor(r.p / L)}`;
              if (r.wantFor !== key) {
                r.wantFor = key;
                if (gate) {
                  const d = r.p - me.p;
                  const acc = clamp(r.acc - (d > 25 ? 0.1 : 0) + (d < -25 ? 0.1 : 0), 0.35, 0.95);
                  r.nextOk = Math.random() < acc;
                  const right = stn.correct >= 0 && S.ask?.stn === stn ? stn.correct : Math.floor(Math.random() * 3);
                  const wrongs = [0, 1, 2].filter((x) => x !== right);
                  r.wantLane = r.nextOk ? right : wrongs[Math.floor(Math.random() * 2)];
                  r.gateRight = right;
                } else r.wantLane = Math.floor(Math.random() * 3);
              }
              lane = r.wantLane;
            }
          }
        }
        const latGoal = lane != null ? (lane - 1) * LANE : clamp(botLine(r), -HW + 1.2, HW - 1.2);
        const want = clamp((latGoal - r.lat) * 2.2, -10, 10);
        r.latV += (want - r.latV) * Math.min(1, dt * 5);
      } else if (!r.bot) {
        r.latV += (steer * 13 - r.latV) * Math.min(1, dt * 7);
      }
      const prevP = r.p;
      // Fahrkönnen: Innen um die Kurve ist der Weg kürzer → schneller vorwärts
      const gain = clamp(1 / clamp(1 - q.k * r.lat, 0.72, 1.35), KART.GAIN[0], KART.GAIN[1]);
      r.p += r.v * dt * gain;
      r.lat += r.latV * dt;
      const z = zoneAt(r.p);
      if (z != null) {
        if (r.zone !== z) { r.zone = z; r.zoneLane = laneOf(r.lat); }
        const lo = (r.zoneLane - 1) * LANE - LANE / 2 + 1.05, hi = (r.zoneLane - 1) * LANE + LANE / 2 - 1.05;
        if (r.lat < lo) { r.lat = lo; r.latV = Math.max(0, r.latV); }
        if (r.lat > hi) { r.lat = hi; r.latV = Math.min(0, r.latV); }
      } else r.zone = null;
      // Banden: anstossen bremst
      const lim = WL - 1.0;
      if (Math.abs(r.lat) > lim) {
        r.lat = Math.sign(r.lat) * lim; r.latV *= -0.25; r.v *= 1 - Math.min(0.5, dt * 1.8);
        if (r === me && S.mt > 0.3) { S.mt = 0; S.mtOff = 0; }
        if (r === me && now - r.wallT > 250) { r.wallT = now; kartAt(tr, r.p + 1, q2); burst(st, pt(q2, Math.sign(r.lat) * WL, 0.6), { n: 14, colors: [0xffd166, 0xffffff], speed: 3, life: 0.35, size: 0.18, gravity: -6 }); tone([180, 140], 0.05, 'square', 0.03); }
      }
      if (racing && !r.finished) {
        const a = lapS(prevP), b = lapS(r.p);
        const crossed = (c) => (prevP < r.p) && ((a <= c && b > c) || (a > b && (c >= a || c < b)));
        const lapNo = Math.floor(r.p / L);
        const once = (k) => (r.seen.has(k) ? false : (r.seen.add(k), true)); // jeder Würfel und jedes Tor nur einmal pro Runde
        for (const stn of stations) {
          if (crossed(stn.s0) && once(`${lapNo}:${stn.k}:c`)) {
            const lane = laneOf(r.lat);
            if (r === me) { shatterCube(stn.cubes[lane]); showAsk(stn); }
            else { const c = stn.cubes[lane]; if (c.grp.visible) shatterCube(c, { near: Math.abs(r.p - me.p) < 140 }); }
          }
          if (crossed(stn.s1) && once(`${lapNo}:${stn.k}:g`)) {
            const lane = laneOf(r.lat);
            if (r === me) answer(stn, lane);
            else {
              const ok = r.gateRight != null ? lane === r.gateRight : r.nextOk;
              mathCount(r, ok);
              if (!ok && Math.abs(r.p - me.p) < 80) smoke(r);
            }
          }
        }
        if (r.p >= total) { r.finished = now; if (r === me) finish(); }
      }
    }
    // Rempler: Karts fahren nicht ineinander. In einer Gabelung (feste Spur) hintereinander, sonst seitlich ausweichen.
    for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
      const A = racers[i], Bk = racers[j];
      const ds = Bk.p - A.p, dl = Bk.lat - A.lat;
      if (Math.abs(ds) >= 2.6 || Math.abs(dl) >= 2.0) continue;
      if (A.zone != null || Bk.zone != null) {
        const [front, back] = ds > 0 ? [Bk, A] : [A, Bk];
        back.p = front.p - 2.6; back.v = Math.min(back.v, front.v * 0.97);
      } else {
        const push = (2.0 - Math.abs(dl)) * 0.5 * (dl >= 0 ? 1 : -1);
        Bk.lat += push; A.lat -= push; Bk.latV += push * 4; A.latV -= push * 4;
        if (ds > 0) A.v *= 0.985; else Bk.v *= 0.985;
      }
      if ((A === me || Bk === me) && racing && (!S.bumpT || now - S.bumpT > 400)) { S.bumpT = now; tone([110, 90], 0.06, 'square', 0.03); }
    }
    racers.forEach((r) => placeKart(r, dt));
    // Kamera: folgt dir genau, weich nur seitlich, in der Höhe und beim Turbo
    S.camLat += (me.lat - S.camLat) * (1 - Math.pow(0.03, dt));
    S.camBack += ((me.fx === 'turbo' ? 8.6 : 7.6) - S.camBack) * (1 - Math.pow(0.05, dt));
    S.camY += ((me.fx === 'turbo' ? 3.2 : 3.5) - S.camY) * (1 - Math.pow(0.05, dt));
    camTarget(cDes, lDes);
    camera.position.copy(cDes);
    look.lerp(lDes, 1 - Math.pow(0.00001, dt));
    camera.lookAt(look);
    const fovGoal = 62 + (me.fx === 'turbo' ? 12 : me.fx === 'slow' ? -4 : 0) + (now < me.boostUntil ? 6 : 0) + (me.v / KART.BASE) * 2;
    camera.fov += (fovGoal - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
    elLines.classList.toggle('on', me.fx === 'turbo' || now < me.boostUntil);
    elLines.classList.toggle('draft', me.fx !== 'turbo' && now < me.boostUntil);
    host.classList.toggle('slow', me.fx === 'slow');
    kartAt(tr, me.p, q);
    sun.target.position.set(q.x, q.y, q.z); sun.position.set(q.x + sunDir.x * 80, q.y + sunDir.y * 80, q.z + sunDir.z * 80);
    if (nightLight) nightLight.position.set(q.x + q.rx * me.lat + q.fx * 3, q.y + 9, q.z + q.rz * me.lat + q.fz * 3);
    if (engine) { const f = 55 + me.v * 3.2 + (me.fx === 'turbo' ? 40 : 0); engine.o.frequency.setTargetAtTime(f, audioCtx.currentTime, 0.05); engine.o2.frequency.setTargetAtTime(f * 0.5, audioCtx.currentTime, 0.05); }
    S.hudT = (S.hudT || 0) + dt;
    if (S.hudT > 0.2) { S.hudT = 0; hud(); }
    { const ahead = me.p + 16; startSign.set(ahead >= 0 ? Math.min(KART.LAPS, Math.floor(ahead / L) + 1) : 0); }
    startSign.update(dt, st.time);
    drawMap(dt);
    {   // Kurven-Turbo: Balken mit drei Stufen; Funken an den Hinterrädern
      const tier = mtTier(S.mt), flash = S.mtFlash && now < S.mtFlash.until ? S.mtFlash.tier : 0;
      const show = S.mt > 0.25 || flash;
      elMt.classList.toggle('on', !!show);
      elMt.dataset.tier = flash || tier;
      elMtBar.style.width = `${Math.round(Math.min(1, (flash ? KART.MT[2] : S.mt) / KART.MT[2]) * 100)}%`;
      const txt = flash ? ['', 'Turbo!', 'Super-Turbo!', 'Mega-Turbo!'][flash] : 'Kurven-Turbo';
      if (S.mtTxt !== txt) { S.mtTxt = txt; elMtTxt.textContent = txt; }
      const on = S.mt > 0.3;
      sparks.forEach((sp) => { sp.visible = on; if (on) { const k = 0.35 + tier * 0.18 + Math.random() * 0.25; sp.scale.set(k, k, 1); sp.material.color.setHex(MT_HEX[tier]); } });
    }
    if (S.phase === 'race') elTime.textContent = `${fmtSec(now - S.raceT0)} s`;
    if (S.ask) { const ln = laneOf(me.lat); $$('#kans .ka').forEach((el, i) => el.classList.toggle('here', i === ln)); }
  });

  function countdown() {
    elLights.classList.add('on');
    S.goAt = performance.now() + 3 * 850;
    elStartHint.hidden = false;
    const steps = ['3', '2', '1', 'LOS!'];
    steps.forEach((t, i) => gLater(() => {
      elCount.innerHTML = `<span class="${i === 3 ? 'go' : ''}">${t}</span>`;
      [...elLights.children].forEach((l, j) => { l.className = i === 3 ? 'go' : j <= i ? 'red' : ''; });
      tone(i === 3 ? [880, 1320] : [440], i === 3 ? 0.18 : 0.12, 'square', 0.05);
      if (i === 3) { S.phase = 'race'; S.raceT0 = st.time; S.goReal = performance.now(); startEngine(); startResult(); gLater(() => { elCount.innerHTML = ''; elLights.classList.remove('on'); elStartHint.hidden = true; }, 900); }
    }, i * 850));
  }
  function finish() {
    if (S.phase === 'done') return;
    S.phase = 'done';
    const place = placeOf(me);
    const ms = Math.round(st.time - S.raceT0);
    stopEngine();
    elAsk.hidden = true;
    if (place <= 3) { sfx.win?.(); confetti(); }
    bigWord(host, `${place}. Platz!`, place <= 3 ? 'good' : '');
    gLater(() => { if (ui.view === 'game' && game.kart === S) showKartResult({ place, ms, ok: S.ok, wrong: S.wrong, wrongs: S.wrongs, track: tid }); }, 2600);
  }
  S.t0 = st.time;
}

/* ---------------- Ergebnis ---------------- */
function showKartResult(r) {
  stopGame();
  const board = boardOf('kart', 'speed');
  const key = localBestKey(board), old = db.prog.best[key];
  const rec = old == null || r.ms < old;
  if (rec) { db.prog.best[key] = r.ms; saveDB(); }
  const st = r.place === 1 ? 3 : r.place <= 3 ? 2 : 1;
  if (r.place <= 3 || rec) { sfx.win?.(); confetti(); }
  const medal = ['🥇', '🥈', '🥉'][r.place - 1] || '🏁';
  const tr = KART_TRACKS.find((t) => t.id === r.track);
  const wrongs = [...new Map(r.wrongs.map((t) => [t.key + t.op, t])).values()].slice(0, 8);
  $('#view').innerHTML = gameShell('kart', `<div class="run-result">
      <div class="result">
        <p class="run-mode-tag">${tr ? `${tr.emo} ${esc(tr.name)}` : ''} · 3 Runden · ${esc(OP_INFO[practiceSettings().op][0])}</p>
        ${stars(st)}<h2>${medal} ${r.place}. Platz!</h2>
        <p class="result-line">Zeit <b>${fmtSec(r.ms)} s</b> · ${r.ok} von ${r.ok + r.wrong} richtig${r.wrong ? '' : ' – ohne Fehler!'}</p>
        ${rec && old != null ? '<p class="pill good">Neue Bestzeit!</p>' : old != null ? `<p class="muted small">Deine Bestzeit: ${fmtSec(old)} s</p>` : ''}
        ${wrongs.length ? `<div class="mistakes"><p class="label">Merk dir</p><ul>${wrongs.map((t) => `<li><span class="m-task">${esc(taskText(t, true))}</span></li>`).join('')}</ul></div>` : ''}
        <div class="row center"><button class="btn primary big" data-action="game-again">${icon('flip')} Nochmals</button><button class="btn ghost big" data-action="home">Anderes Spiel</button></div>
      </div>
      <div class="board-card" id="board"><div class="board-head"><h3>${icon('trophy')} Bestenliste</h3></div><p class="muted"><span class="spinner"></span> wird geladen …</p></div>
    </div>`);
  fillBoard({ id: 'kart', mode: 'speed' }, board, r.ms);
}
