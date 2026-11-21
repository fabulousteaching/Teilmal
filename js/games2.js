/* Teilmal – weitere Spiele: Rechen-Labyrinth, Turmbau, Zahlen-Schlange, 1×1-Tafel-Puzzle
 *
 * Alle nutzen die gemeinsame Runde aus js/games.js (runStart, runRight, runWrong, Ergebnis mit Bestenliste)
 * und die gewählten Reihen und Aufgabenarten der Startseite (practiceSettings).
 */
'use strict';

/** Wie die Punkte im Ergebnis heissen (sonst «richtige Antworten») */
function g2Noun(id, n) {
  const W = { maze: ['richtiges Tor', 'richtige Tore'], tower: ['Stockwerk', 'Stockwerke'], snake: ['richtige Zahl gefressen', 'richtige Zahlen gefressen'], puzzle: ['Teil', 'Teile'], castle: ['Monster abgewehrt', 'Monster abgewehrt'] }[id];
  return W ? W[n === 1 ? 0 : 1] : null;
}
const g2Pick = (a) => a[Math.floor(Math.random() * a.length)];
/** Joystick auf dem Bildschirm (für Labyrinth und Rennen): meldet x, y zwischen -1 und 1 */
function g2Joystick(el, onChange) {
  if (!el) return null;
  const knob = el.querySelector('i');
  let id = null, cx = 0, cy = 0;
  const R = () => el.clientWidth / 2;
  const set = (x, y) => {
    const r = R(), d = Math.hypot(x, y), k = d > r ? r / d : 1;
    const px = x * k, py = y * k;
    knob.style.transform = `translate(${px}px, ${py}px)`;
    onChange(px / r, py / r);
  };
  const down = (e) => { e.stopPropagation(); id = e.pointerId; el.setPointerCapture(id); const b = el.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; el.classList.add('on'); set(e.clientX - cx, e.clientY - cy); e.preventDefault(); };
  const move = (e) => { if (e.pointerId !== id) return; set(e.clientX - cx, e.clientY - cy); };
  const up = (e) => { if (e.pointerId !== id) return; id = null; el.classList.remove('on'); knob.style.transform = ''; onChange(0, 0); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.style.touchAction = 'none';
  return { dispose() { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); } };
}

/** Sehr sicher im 1×1 (Training: hohe Quote, viele sichere Rechnungen)? Dann Ergebnisse selbst eintippen statt auswählen */
function g2Typing() {
  try { const sk = runnerSkill(); return sk.n >= RUN_SKILL_MIN && sk.quote >= 0.9 && sk.sure >= 0.6; } catch { return false; }
}
/** Eingabe zum Eintippen: Anzeige und kleines Zahlenfeld (2 Reihen); Tasten gehen an game.typeKey */
function g2TypeHTML(id) {
  const k = (v, cls = '') => `<button type="button" class="cs-key ${cls}" data-action="g2-key" data-k="${v}">${v === 'back' ? '⌫' : v === 'ok' ? '✓' : v}</button>`;
  return `<div class="g2-type"><span class="cs-typed" id="${id}"><small>Ergebnis tippen</small></span>
    <div class="g2-keys">${[1, 2, 3, 4, 5].map((v) => k(v)).join('')}${k('back', 'back')}${[6, 7, 8, 9, 0].map((v) => k(v)).join('')}${k('ok', 'ok')}</div></div>`;
}
/** Tastendruck in eine Eingabe: liefert den neuen Text; bei ✓ wird onOk(Zahl) aufgerufen */
function g2Type(cur, key, el, onOk) {
  if (key === 'ok') { if (cur) onOk(Number(cur)); return cur; }
  const next = key === 'back' ? cur.slice(0, -1) : cur.length < 3 ? cur + key : cur;
  if (el) el.innerHTML = next || '<small>Ergebnis tippen</small>';
  return next;
}

/** Reihen fürs Labyrinth und die Tafel (die 1er-Reihe wäre zu einfach: alles gehört dazu) */
function g2Rows() { const rs = practiceSettings().reihen.filter((r) => r > 1); return rs.length ? rs : [2]; }

/* =========================================================
   🧭 Rechen-Labyrinth: Weg zum Schatz – nur über Zahlen der Reihe
   ========================================================= */
const MZ = { W: 6, H: 7 };
const MZ_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function startMaze() {
  Object.assign(game, { mz: null, mzLock: false, mzOrder: shuffle(g2Rows()), mzN: 0, over: false });
  const r = runStart('maze');
  $('#view').innerHTML = gameShell('maze', `
    ${runHudHTML('bar-hud')}
    ${r.mode === 'survive' ? '<div class="shot-clock mz-clock" id="mzclock"><i></i></div>' : ''}
    <div class="mz-head" id="mzhead"></div>
    <div class="mz-wrap"><div class="mz-board" id="mzboard" style="--w:${MZ.W};--h:${MZ.H}"></div></div>
    <p class="mode-hint">Tippe auf ein Nachbarfeld (oder Pfeiltasten). Falsche Zahlen zerbrechen${r.mode === 'survive' ? ' und kosten ein Leben' : ''}.</p>`);
  const onResize = () => { if (game.mz) mzMove(...game.mz.pos, true); };
  window.addEventListener('resize', onResize);
  game.cleanups = [...(game.cleanups || []), () => window.removeEventListener('resize', onResize)];
  setGameKeys((e) => {
    const d = { ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowUp: [0, -1] }[e.key];
    if (!d || !game.mz) return;
    e.preventDefault();
    const [x, y] = game.mz.pos, nx = x + d[0], ny = y + d[1];
    if (nx >= 0 && ny >= 0 && nx < MZ.W && ny < MZ.H) mzStep(ny * MZ.W + nx);
  });
  mzNew();
}
/** Zufälliger Weg vom Start (links oben) zum Schatz (rechts unten), ohne ein Feld zweimal */
function mzWalk(W, H) {
  const key = (x, y) => y * W + x;
  const seen = new Set([0]), p = [[0, 0]];
  while (p.length < 40) {
    const [x, y] = p[p.length - 1];
    if (x === W - 1 && y === H - 1) return p.length >= 11 && p.length <= 15 ? p : null;
    const nb = MZ_DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H && !seen.has(key(a, b)));
    if (!nb.length) return null;
    // leicht Richtung Schatz, aber mit Umwegen
    const w = nb.map(([a, b]) => (a > x || b > y ? 1.6 : 1));
    let t = Math.random() * w.reduce((s, v) => s + v, 0), pick = nb[0];
    for (let i = 0; i < nb.length; i++) { t -= w[i]; if (t <= 0) { pick = nb[i]; break; } }
    seen.add(key(pick[0], pick[1])); p.push(pick);
  }
  return null;
}
function mzNew() {
  const { W, H } = MZ;
  const r = game.mzOrder[game.mzN++ % game.mzOrder.length];
  let path = null;
  for (let i = 0; i < 2000 && !path; i++) path = mzWalk(W, H);
  if (!path) path = [...Array(W).keys()].map((x) => [x, 0]).concat([...Array(H - 1).keys()].map((y) => [W - 1, y + 1]));
  const cells = Array.from({ length: W * H }, () => ({ v: null, mult: false, kind: 'num' }));
  const at = (x, y) => cells[y * W + x];
  let ks = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), ki = 0;
  const nextMult = () => { if (ki >= ks.length) { ks = shuffle(ks); ki = 0; } const k = ks[ki++]; return { v: r * k, k }; };
  path.forEach(([x, y], i) => {
    const c = at(x, y);
    if (i === 0) c.kind = 'start';
    else if (i === path.length - 1) c.kind = 'goal';
    else Object.assign(c, nextMult(), { mult: true });
  });
  // Sackgassen: ein paar Zahlen der Reihe, die nicht zum Schatz führen
  const onPath = new Set(path.map(([x, y]) => y * W + x));
  shuffle(path.slice(2, -2)).slice(0, 3).forEach(([x, y]) => {
    let cx = x, cy = y;
    for (let n = 0; n < 1 + Math.floor(Math.random() * 2); n++) {
      const nb = shuffle(MZ_DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H && !onPath.has(b * W + a) && !at(a, b).mult));
      if (!nb.length) break;
      [cx, cy] = nb[0];
      Object.assign(at(cx, cy), nextMult(), { mult: true });
    }
  });
  // übrige Felder: Zahlen, die nicht zur Reihe gehören (nahe an Vielfachen oder aus anderen Reihen)
  const max = r * 10 + 4;
  const notMult = () => {
    for (let t = 0; t < 50; t++) {
      const v = Math.random() < 0.55 ? r * (1 + Math.floor(Math.random() * 10)) + g2Pick([-3, -2, -1, 1, 2, 3]) : (2 + Math.floor(Math.random() * 9)) * (2 + Math.floor(Math.random() * 9));
      if (v > 1 && v <= Math.max(max, 30) && v % r !== 0) return v;
    }
    return r + 1;
  };
  cells.forEach((c) => { if (c.kind === 'num' && !c.mult) c.v = notMult(); });
  game.mz = { r, cells, pos: [0, 0], solved: false };
  $('#mzhead').innerHTML = `<span class="mz-badge">${r}er-Reihe</span><span>Finde den Weg zum Schatz – tritt nur auf Zahlen der <b>${r}er-Reihe</b>!</span>`;
  const board = $('#mzboard');
  board.innerHTML = cells.map((c, i) => `<button type="button" class="mz-cell ${c.kind}" data-action="mz-step" data-i="${i}" aria-label="${c.kind === 'start' ? 'Start' : c.kind === 'goal' ? 'Schatz' : c.v}">${c.kind === 'start' ? '🚩' : c.kind === 'goal' ? '💎' : c.v}</button>`).join('')
    + '<span class="mz-me" id="mzme" aria-hidden="true">🦊</span>';
  board.classList.remove('done'); board.classList.add('in');
  setTimeout(() => board.classList.remove('in'), 450);
  at(0, 0).seen = true;
  board.children[0].classList.add('visited');
  mzMove(0, 0, true);
  game.mzLock = false;
  mzClock();
}
/** Mitte eines Feldes (in Pixeln innerhalb des Spielfelds) */
function mzCenter(x, y) {
  const el = $('#mzboard')?.children[y * MZ.W + x];
  return el ? [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2] : [0, 0];
}
function mzMove(x, y, now = false) {
  const me = $('#mzme');
  if (!me) return;
  if (now) me.style.transition = 'none';
  const [px, py] = mzCenter(x, y);
  me.style.left = `${px}px`; me.style.top = `${py}px`;
  if (now) { void me.offsetWidth; me.style.transition = ''; }
}
function mzClock() {
  if (game.run?.mode !== 'survive' || !runOn()) return;
  taskClock($('#mzclock i'), surviveMs(9000, 2600), () => { if (!runOn()) return; sfx.bad(); mzFloat(game.mz.pos, 'Zu langsam!', 'bad'); if (!runWrong()) mzClock(); });
}
function mzFloat([x, y], text, cls) {
  const b = $('#mzboard');
  if (!b) return;
  const f = document.createElement('span');
  f.className = `mz-float ${cls}`; f.innerHTML = text;
  const [px, py] = mzCenter(x, y);
  f.style.left = `${px}px`; f.style.top = `${py}px`;
  b.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}
function mzStep(i) {
  const m = game.mz;
  if (!m || game.mzLock || !runOn()) return;
  const x = i % MZ.W, y = Math.floor(i / MZ.W), [cx, cy] = m.pos;
  const el = $('#mzboard')?.children[i];
  if (!el) return;
  if (Math.abs(x - cx) + Math.abs(y - cy) !== 1) {
    if (x !== cx || y !== cy) { $('#mzme')?.classList.remove('nope'); void $('#mzme')?.offsetWidth; $('#mzme')?.classList.add('nope'); }
    return;
  }
  const c = m.cells[i];
  if (c.bad) return;
  if (c.kind === 'num' && !c.mult) { // falsche Zahl: zerbricht
    c.bad = true;
    el.classList.add('bad');
    sfx.bad();
    mzFloat([x, y], `${c.v} ist nicht in der ${m.r}er-Reihe`, 'bad');
    if (!runWrong()) mzClock();
    return;
  }
  m.pos = [x, y];
  mzMove(x, y);
  el.classList.add('visited');
  if (c.kind === 'num' && !c.seen) {
    c.seen = true;
    sfx.good();
    mzFloat([x, y], `${c.k} ${SIGN()} ${m.r} = <b>${c.v}</b>`, 'good');
    if (runRight()) return;
    mzClock();
  } else tone([520], 0.05, 'sine', 0.04);
  if (c.kind === 'goal') {
    game.mzLock = true;
    taskClockStop($('#mzclock i'));
    sfx.win();
    $('#mzboard').classList.add('done');
    sparkle(el, 18);
    mzFloat([x, y], 'Schatz gefunden!', 'good big');
    gLater(() => { if (runOn()) mzNew(); }, 1100);
  }
}

/* =========================================================
   🏗️ Turmbau: richtige Antwort → Block am Kran → im richtigen Moment loslassen
   ========================================================= */
// Hausstockwerke: Fassadenfarben (Backstein, Sand, Mint, Himmelblau …)
const TW = { BH: 42, GROUND: 46, COLORS: ['#E76F51', '#E9C46A', '#2A9D8F', '#8AB17D', '#F4A261', '#6D8DB8', '#B56576', '#D4A373', '#5FA8D3', '#C9ADA7'] };
/** Stadt-Silhouette im Hintergrund (zufällige Häuser mit Fenstern) */
function twCity() {
  let x = 0, d = '', w = '';
  while (x < 600) {
    const bw = 30 + Math.random() * 50, bh = 50 + Math.random() * 120;
    d += `M${x} 200V${200 - bh}h${bw}V200z`;
    for (let yy = 200 - bh + 10; yy < 190; yy += 16) for (let xx = x + 6; xx < x + bw - 8; xx += 12) if (Math.random() < 0.45) w += `M${xx} ${yy}h5v7h-5z`;
    x += bw + 4 + Math.random() * 8;
  }
  return `<svg class="tw-city" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="rgba(30, 64, 120, .22)"/><path d="${w}" fill="rgba(255, 240, 180, .35)"/></svg>`;
}
function startTower() {
  Object.assign(game, { picker: gamePicker(), tw: { blocks: [{ x: 30, w: 40, label: '🏪 Erdgeschoss' }], phase: 'ask', hang: null, t: null, swingT: 0, shift: 0 }, over: false });
  const r = runStart('tower');
  $('#view').innerHTML = gameShell('tower', `
    ${runHudHTML('bar-hud')}
    ${r.mode === 'survive' ? '<div class="shot-clock tw-clock" id="twclock"><i></i></div>' : ''}
    <div class="tw-stage" id="twstage">
      <div class="tw-world" id="twworld">${twCity()}<div class="tw-ground"></div><div class="tw-roof" id="twroof"><i></i></div></div>
      <div class="tw-crane" aria-hidden="true"><div class="tw-beam"></div><div class="tw-trolley" id="twtrolley"><i class="tw-rope"></i></div></div>
      <div class="tw-tip" id="twtip" hidden>Tippe, um den Block loszulassen!</div>
    </div>
    <div class="tw-ask" id="twask"></div>
    <p class="mode-hint">Richtige Antwort → ein Block hängt am Kran. Tippe ins Bild (oder Leertaste), um ihn fallen zu lassen. Was übersteht, fällt ab.</p>`);
  const stage = $('#twstage');
  stage.addEventListener('pointerdown', (e) => { if (game.tw?.phase === 'drop') { e.preventDefault(); twDrop(); } });
  setGameKeys((e) => {
    if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') && game.tw?.phase === 'drop') { e.preventDefault(); twDrop(); return; }
    const n = Number(e.key);
    if (game.tw?.phase === 'ask' && n >= 1 && n <= 4) $$('#twask .tw-ans')[n - 1]?.click();
  });
  game.tw.blocks.forEach((b, i) => twBlockEl(b, i));
  twLoop();
  twAsk();
}
function twBlockEl(b, level) {
  const w = $('#twworld');
  if (!w) return null;
  const el = document.createElement('div');
  el.className = `tw-block house${level === 0 ? ' base' : ''}`;
  el.style.cssText = `left:${b.x}%;width:${b.w}%;bottom:${TW.GROUND + level * TW.BH}px;--bc:${level === 0 ? '#94a3b8' : b.c || TW.COLORS[level % TW.COLORS.length]}`;
  el.dataset.lit = b.lit ?? Math.floor(Math.random() * 3);
  el.innerHTML = `<span>${esc(b.label)}</span>`;
  w.insertBefore(el, $('#twroof'));
  twFit(el, b.w);
  b.el = el;
  twRoof();
  return el;
}
/** Dach auf dem obersten Stockwerk */
function twRoof() {
  const tw = game.tw, r = $('#twroof');
  if (!tw || !r) return;
  const top = tw.blocks[tw.blocks.length - 1];
  r.style.left = `${top.x}%`; r.style.width = `${top.w}%`;
  r.style.bottom = `${TW.GROUND + tw.blocks.length * TW.BH}px`;
  r.hidden = tw.blocks.length < 2;
}
/** Schrift passt sich der Blockbreite an */
function twFit(el, wPct) {
  const W = $('#twstage')?.clientWidth || 400;
  el.style.fontSize = `${Math.max(8, Math.min(17, (W * wPct) / 100 / 7.5))}px`;
}
function twAsk() {
  const tw = game.tw;
  if (!runOn() || !tw) return;
  tw.phase = 'ask';
  $('#twtip').hidden = true;
  const t = game.picker.next();
  t.shownAt = performance.now();
  tw.t = t;
  const vals = choicesFor(t, 4);
  $('#twask').innerHTML = `<div class="task tw-task">${taskHTML(t, '<span class="slot">?</span>')}</div>
    <div class="tw-answers">${vals.map((v, i) => `<button type="button" class="tw-ans" data-action="tw-answer" data-v="${v}"><small>${i + 1}</small>${v}</button>`).join('')}</div>`;
  if (game.run.mode === 'survive') taskClock($('#twclock i'), surviveMs(8000, 2200), () => twAnswer(null));
}
function twAnswer(v) {
  const tw = game.tw;
  if (!tw || tw.phase !== 'ask' || !runOn()) return;
  taskClockStop($('#twclock i'));
  const t = tw.t, ok = v != null && Number(v) === t.answer;
  recordAnswer(t, v == null ? '' : v, performance.now() - t.shownAt);
  $$('#twask .tw-ans').forEach((b) => { b.disabled = true; if (Number(b.dataset.v) === t.answer) b.classList.add('right'); else if (b.dataset.v === String(v)) b.classList.add('wrong'); });
  if (!ok) {
    sfx.bad();
    tw.phase = 'wait';
    if (runWrong(t)) return;
    gLater(twAsk, 1300);
    return;
  }
  sfx.good();
  if (tw.r3) { tw.r3.hang(taskText(t, true)); tw.phase = 'drop'; $('#twtip').hidden = false; return; } // 3D-Version (js/tower3d.js)
  // Block erscheint am Kran: so breit wie der oberste Block des Turms
  const top = tw.blocks[tw.blocks.length - 1];
  const el = document.createElement('div');
  const col = TW.COLORS[Math.floor(Math.random() * TW.COLORS.length)], lit = Math.floor(Math.random() * 3);
  el.className = 'tw-block house hang';
  el.style.cssText = `width:${top.w}%;--bc:${col}`; el.dataset.lit = lit;
  el.innerHTML = `<span>${esc(taskText(t, true))}</span>`;
  $('#twstage').appendChild(el);
  twFit(el, top.w);
  tw.hang = { el, w: top.w, label: taskText(t, true), c: col, lit };
  tw.phase = 'drop';
  $('#twtip').hidden = false;
}
function twLoop() {
  const tick = (now) => {
    const tw = game.tw;
    if (!tw || !$('#twstage')) return;
    game.raf = requestAnimationFrame(tick);
    const dt = Math.max(0, Math.min(0.05, (now - (tw.last || now)) / 1000)); tw.last = now;
    tw.swingT += dt * Math.min(3.3, 1.5 + (tw.blocks.length - 1) * 0.11); // je höher der Turm, desto schneller
    const w = tw.hang ? tw.hang.w : 30;
    tw.hx = 50 + Math.sin(tw.swingT) * (50 - w / 2 - 1);
    const tr = $('#twtrolley');
    if (tr) tr.style.left = `${tw.hx}%`;
    if (tw.hang && tw.phase === 'drop') { tw.hang.el.style.left = `${tw.hx - w / 2}%`; tw.hang.el.style.top = '58px'; }
  };
  game.raf = requestAnimationFrame(tick);
}
function twDrop() {
  const tw = game.tw;
  if (!tw || tw.phase !== 'drop' || !tw.hang || !runOn()) return;
  if (tw.r3) { tw.r3.drop(); return; }
  tw.phase = 'fall';
  $('#twtip').hidden = true;
  const h = tw.hang, top = tw.blocks[tw.blocks.length - 1];
  const x = tw.hx - h.w / 2;
  const level = tw.blocks.length;
  const stage = $('#twstage'), H = stage.clientHeight;
  const landTop = H - (TW.GROUND + level * TW.BH + TW.BH) + tw.shift; // Oberkante beim Aufsetzen (im Bild)
  h.el.style.left = `${x}%`;
  h.el.style.transition = 'top .32s cubic-bezier(.5, 0, 1, 1)';
  void h.el.offsetWidth;
  const ov = Math.min(x + h.w, top.x + top.w) - Math.max(x, top.x);
  if (ov <= 0.5) { // daneben: fällt am Turm vorbei
    h.el.style.transition = 'top .7s cubic-bezier(.5, 0, 1, 1), transform .7s, opacity .7s';
    h.el.style.top = `${H + 40}px`; h.el.style.transform = `rotate(${x < top.x ? -35 : 35}deg)`; h.el.style.opacity = '0.3';
    tw.hang = null;
    setTimeout(() => h.el.remove(), 800);
    gLater(() => {
      sfx.bad();
      tone([300, 200], 0.12, 'sawtooth', 0.04);
      if (runWrong()) return;
      twAsk();
    }, 450);
    return;
  }
  h.el.style.top = `${landTop}px`;
  gLater(() => {
    const perfect = Math.abs(x - top.x) < 1.3;
    const nb = perfect ? { x: top.x, w: Math.min(46, top.w + 2.5), label: h.label, c: h.c, lit: h.lit } : { x: Math.max(x, top.x), w: ov, label: h.label, c: h.c, lit: h.lit };
    // überstehendes Stück fällt ab
    if (!perfect) {
      const cutL = x < top.x, cw = h.w - ov;
      const cut = document.createElement('div');
      cut.className = 'tw-block house cut';
      cut.style.cssText = `left:${cutL ? x : top.x + top.w}%;width:${cw}%;top:${landTop}px;--bc:${h.c}`; cut.dataset.lit = h.lit;
      stage.appendChild(cut);
      requestAnimationFrame(() => { cut.style.top = `${H + 60}px`; cut.style.transform = `rotate(${cutL ? -50 : 50}deg)`; cut.style.opacity = '0'; });
      setTimeout(() => cut.remove(), 900);
    }
    h.el.remove();
    tw.hang = null;
    tw.blocks.push(nb);
    const el = twBlockEl(nb, tw.blocks.length - 1);
    el?.classList.add('land');
    if (perfect) { tone([880, 1320], 0.08, 'triangle', 0.06); twFloat('Perfekt!', el); sparkle(el, 12); } else tone([392], 0.06, 'square', 0.04);
    // Kamera: die Turmspitze bleibt im Bild
    const want = Math.max(0, TW.GROUND + tw.blocks.length * TW.BH - H * 0.55);
    if (want !== tw.shift) { tw.shift = want; $('#twworld').style.transform = `translateY(${want}px)`; }
    if (runRight()) return;
    gLater(twAsk, perfect ? 500 : 300);
  }, 330);
}
function twFloat(text, anchor) {
  const s = $('#twstage');
  if (!s || !anchor) return;
  const r = anchor.getBoundingClientRect(), R = s.getBoundingClientRect();
  const f = document.createElement('span');
  f.className = 'mz-float good big';
  f.textContent = text;
  f.style.left = `${r.left - R.left + r.width / 2}px`; f.style.top = `${r.top - R.top}px`;
  s.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

/* =========================================================
   🐍 Zahlen-Schlange: eine lange, fliessende Schlange frisst das richtige Ergebnis und wird länger.
   Sie schwimmt frei übers Feld (mit dem Finger/der Maus lenken, mit Pfeiltasten oder den Drehknöpfen drehen).
   Ende: nur, wenn sie sich selbst in den Körper beisst. Falsche Zahlen machen sie kürzer.
   ========================================================= */
const SN = { R: 13, TURN: 3.4, V0: 105, VMAX: 205, GROW: 26, SHRINK: 40, LEN0: 150, BITE_SKIP: 3.2 };
const SN_SKINS = [
  { a: '#22d3ee', b: '#6366f1', band: 'rgba(15, 23, 80, .28)', eye: '#0f172a' },
  { a: '#a3e635', b: '#0d9488', band: 'rgba(5, 46, 22, .28)', eye: '#052e16' },
  { a: '#fb923c', b: '#db2777', band: 'rgba(80, 7, 36, .26)', eye: '#3b0764' },
  { a: '#facc15', b: '#16a34a', band: 'rgba(20, 50, 10, .26)', eye: '#1c1917' },
];
function startSnake() {
  Object.assign(game, { picker: gamePicker(), sn: null, over: false });
  runStart('snake');
  $('#view').innerHTML = gameShell('snake', `
    ${runHudHTML('bar-hud')}
    <div class="sn-task" id="sntask"></div>
    <div class="sn-stage" id="snstage"><canvas id="sncv"></canvas><div class="sn-go" id="sngo">Bereit?</div></div>
    <div class="sn-pad">
      <div class="g2-joy sn-joy" id="snjoy" aria-label="Joystick"><i></i></div>
      <span class="sn-pad-hint"><span class="only-touch">Joystick – oder Finger aufs Feld</span><span class="only-kbd">Pfeiltasten ↑ ↓ ← → – oder Maus aufs Feld</span></span>
    </div>
    <p class="mode-hint">Lenke die Schlange zum richtigen Ergebnis: Pfeiltasten ↑ ↓ ← →, Joystick oder Finger/Maus aufs Feld halten. Beisst sie sich selbst, ist das Spiel vorbei.</p>`);
  const st = $('#snstage'), cv = $('#sncv');
  const W = st.clientWidth, H = st.clientHeight;
  game.sn = { W, H, x: W * 0.3, y: H * 0.55, ang: 0, aim: null, turn: 0, keys: { l: 0, r: 0, u: 0, dn: 0 }, joy: { x: 0, y: 0 }, path: [], len: SN.LEN0, travel: 0, foods: [], t: null,
    skin: g2Pick(SN_SKINS), flash: 0, parts: [], floats: [], started: false, dead: false, last: 0, open: 0, tongue: 0 };
  for (let i = 0; i < 60; i++) game.sn.path.push({ x: game.sn.x - i * 2.5, y: game.sn.y });
  snResize();
  const onResize = () => snResize();
  window.addEventListener('resize', onResize);
  game.cleanups = [...(game.cleanups || []), () => window.removeEventListener('resize', onResize)];
  // Lenken: Finger/Maus aufs Feld halten → die Schlange schwimmt dorthin
  const local = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * game.sn.W, y: ((e.clientY - r.top) / r.height) * game.sn.H }; };
  let down = false;
  cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); game.sn.aim = local(e); snGo(); });
  cv.addEventListener('pointermove', (e) => { if (down || e.pointerType === 'mouse') game.sn.aim = local(e); });
  const up = () => { down = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (!down) game.sn.aim = null; });
  cv.style.touchAction = 'none';
  // Joystick (Tablet/Handy): die Schlange dreht sich weich in die gezeigte Richtung
  const jo = g2Joystick($('#snjoy'), (x, y) => { const sn = game.sn; if (!sn) return; sn.joy = { x, y }; if (Math.hypot(x, y) > 0.3) { sn.aim = null; snGo(); } });
  if (jo) game.cleanups.push(() => jo.dispose());
  // Pfeiltasten: in die gedrückte Richtung (auch schräg, z. B. ↑ + →)
  const KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'dn', s: 'dn', S: 'dn' };
  setGameKeys((e) => {
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault(); game.sn.keys[k] = 1; game.sn.aim = null; snGo();
  });
  const keyUp = (e) => { const k = KEYS[e.key]; if (k && game.sn) game.sn.keys[k] = 0; };
  document.addEventListener('keyup', keyUp);
  game.cleanups.push(() => document.removeEventListener('keyup', keyUp));
  snTask();
  gLater(() => snGo(), 1400);
  const loop = (now) => {
    const s = game.sn;
    if (!s || !$('#sncv')) return;
    game.raf = requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min(0.05, (now - (s.last || now)) / 1000)); s.last = now;
    if (s.started && !s.dead && runOn()) snStep(dt);
    snFx(dt);
    snDraw(performance.now() / 1000);
  };
  game.raf = requestAnimationFrame(loop);
}
function snGo() {
  const s = game.sn;
  if (!s || s.started) return;
  s.started = true;
  const g = $('#sngo'); if (g) { g.textContent = 'Los!'; g.classList.add('out'); }
}
function snResize() {
  const s = game.sn, cv = $('#sncv'), st = $('#snstage');
  if (!s || !cv || !st) return;
  const W = st.clientWidth, H = st.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  // Spielfeld bleibt gleich gross (Koordinaten), nur die Darstellung passt sich an
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  s.scale = (W / s.W) * dpr; s.scaleY = (H / s.H) * dpr;
}
function snTask() {
  const s = game.sn;
  if (!s || !runOn()) return;
  const t = game.picker.next();
  t.shownAt = performance.now();
  s.t = t;
  const el = $('#sntask');
  if (el) { el.innerHTML = `<span class="task">${taskHTML(t, '<span class="slot">?</span>')}</span>`; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  // drei Zahlen aufs Feld: weg vom Kopf und nicht auf den Körper
  const vals = shuffle([t.answer, ...distractors(t, 2)]);
  const M = 34;
  s.foods = [];
  for (const v of vals) {
    let p = null;
    for (let k = 0; k < 80 && !p; k++) {
      const q = { x: M + Math.random() * (s.W - 2 * M), y: M + Math.random() * (s.H - 2 * M) };
      if (Math.hypot(q.x - s.x, q.y - s.y) < 130) continue;
      if (s.foods.some((f) => Math.hypot(f.x - q.x, f.y - q.y) < 90)) continue;
      if (s.path.some((b, i) => i % 4 === 0 && Math.hypot(b.x - q.x, b.y - q.y) < SN.R * 2.6)) continue;
      p = q;
    }
    p = p || { x: M + Math.random() * (s.W - 2 * M), y: M + Math.random() * (s.H - 2 * M) };
    s.foods.push({ ...p, v, ok: v === t.answer, born: performance.now() / 1000, ph: Math.random() * 6 });
  }
}
const snNorm = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function snStep(dt) {
  const s = game.sn, r = game.run;
  const v = Math.min(SN.VMAX, SN.V0 + (surviveLevel() - 1) * 14);
  // lenken: Pfeiltasten oder Joystick geben die Richtung vor, Finger/Maus ein Ziel – die Schlange dreht sich weich dorthin
  const kx = s.keys.r - s.keys.l, ky = s.keys.dn - s.keys.u;
  let want = null;
  if (kx || ky) want = Math.atan2(ky, kx);
  else if (Math.hypot(s.joy.x, s.joy.y) > 0.3) want = Math.atan2(s.joy.y, s.joy.x);
  else if (s.aim && Math.hypot(s.aim.x - s.x, s.aim.y - s.y) > SN.R) want = Math.atan2(s.aim.y - s.y, s.aim.x - s.x);
  if (want != null) s.ang += Math.max(-SN.TURN * dt, Math.min(SN.TURN * dt, snNorm(want - s.ang)));
  s.x += Math.cos(s.ang) * v * dt; s.y += Math.sin(s.ang) * v * dt;
  s.travel += v * dt;
  // Rand: sanft abprallen (kein Ende)
  const m = SN.R + 2;
  if (s.x < m) { s.x = m; s.ang = Math.PI - s.ang; } else if (s.x > s.W - m) { s.x = s.W - m; s.ang = Math.PI - s.ang; }
  if (s.y < m) { s.y = m; s.ang = -s.ang; } else if (s.y > s.H - m) { s.y = s.H - m; s.ang = -s.ang; }
  // Spur des Körpers
  const h = s.path[0];
  if (!h || Math.hypot(h.x - s.x, h.y - s.y) >= 2.5) s.path.unshift({ x: s.x, y: s.y });
  let acc = 0;
  for (let i = 1; i < s.path.length; i++) {
    acc += Math.hypot(s.path[i].x - s.path[i - 1].x, s.path[i].y - s.path[i - 1].y);
    if (acc > s.len) { s.path.length = i + 1; break; }
  }
  // Mund auf, wenn eine Zahl nah ist
  const near = s.foods.reduce((d, f) => Math.min(d, Math.hypot(f.x - s.x, f.y - s.y)), 999);
  s.open += ((near < 60 ? 1 : 0) - s.open) * Math.min(1, dt * 10);
  // in sich selbst gebissen? (die ersten Stücke hinter dem Kopf zählen nicht)
  acc = 0;
  for (let i = 1; i < s.path.length; i++) {
    acc += Math.hypot(s.path[i].x - s.path[i - 1].x, s.path[i].y - s.path[i - 1].y);
    if (acc < SN.R * 2 * SN.BITE_SKIP) continue;
    if (Math.hypot(s.path[i].x - s.x, s.path[i].y - s.y) < SN.R * 1.25) { snBite(); return; }
  }
  // fressen
  for (let i = 0; i < s.foods.length; i++) {
    const f = s.foods[i];
    if (Math.hypot(f.x - s.x, f.y - s.y) > SN.R + 22) continue;
    const t = s.t;
    recordAnswer(t, f.v, performance.now() - t.shownAt);
    snBurst(f.x, f.y, f.ok ? ['#fde047', '#86efac', '#ffffff', s.skin.a] : ['#fca5a5', '#f87171', '#ffffff'], f.ok ? 26 : 14);
    if (f.ok) {
      sfx.good();
      s.len += SN.GROW;
      s.floats.push({ x: f.x, y: f.y, text: taskText(t, true), good: true, t: 0 });
      if (runRight()) return;
      snTask();
    } else {
      sfx.bad();
      s.foods.splice(i, 1);
      s.len = Math.max(SN.LEN0 * 0.7, s.len - SN.SHRINK);
      s.flash = 0.45;
      s.floats.push({ x: f.x, y: f.y, text: `Nein: ${taskText(t, true)}`, good: false, t: 0 });
      // falsche Zahl: kürzer und ein Leben weg (3 Leben); nach dem dritten ist Schluss
      if (runWrong(t)) { s.dead = true; return; }
      snTask();
    }
    return;
  }
}
function snBite() {
  const s = game.sn;
  s.dead = true; s.flash = 1;
  snBurst(s.x, s.y, ['#ef4444', '#fca5a5', '#ffffff'], 30);
  s.floats.push({ x: s.x, y: s.y, text: 'Autsch – in dich selbst gebissen!', good: false, t: 0 });
  sfx.bad(); tone([330, 220, 147], 0.14, 'sawtooth', 0.06);
  // in sich selbst gebissen: sofort vorbei, egal wie viele Leben noch übrig sind
  if (game.run) game.run.bit = true;
  runFinish('lives');
}
function snBurst(x, y, cols, n) {
  const s = game.sn;
  if (reduceMotion()) return;
  for (let k = 0; k < n; k++) { const a = Math.random() * 7, sp = 40 + Math.random() * 140; s.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, t: 0, c: cols[k % cols.length], r: 2 + Math.random() * 3 }); }
}
function snFx(dt) {
  const s = game.sn;
  s.flash = Math.max(0, s.flash - dt);
  s.tongue = (s.tongue + dt) % 2.4;
  s.parts = s.parts.filter((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; return p.t < p.life; });
  s.floats = s.floats.filter((f) => { f.t += dt; return f.t < 1.5; });
}
/** Linie entlang des Körpers von Länge a bis b (vom Kopf aus gemessen) */
function snSegs(path) {
  const out = [{ ...path[0], d: 0 }];
  let acc = 0;
  for (let i = 1; i < path.length; i++) { acc += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); out.push({ ...path[i], d: acc }); }
  return out;
}
function snDraw(T) {
  const s = game.sn, cv = $('#sncv');
  if (!s || !cv) return;
  const g = cv.getContext('2d');
  g.setTransform(s.scale, 0, 0, s.scaleY, 0, 0);
  // Hintergrund: Nachtwiese mit leuchtenden Punkten
  const bg = g.createRadialGradient(s.W * 0.5, s.H * 0.45, 20, s.W * 0.5, s.H * 0.5, Math.max(s.W, s.H) * 0.75);
  bg.addColorStop(0, '#1e3a5f'); bg.addColorStop(1, '#0b1326');
  g.fillStyle = bg; g.fillRect(0, 0, s.W, s.H);
  g.fillStyle = 'rgba(148, 197, 255, .09)';
  for (let y = 14; y < s.H; y += 28) for (let x = (y / 28) % 2 ? 14 : 28; x < s.W; x += 28) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  if (s.flash > 0) { g.fillStyle = `rgba(239, 68, 68, ${s.flash * 0.35})`; g.fillRect(0, 0, s.W, s.H); }
  // Zahlen: leuchtende Kugeln
  for (const f of s.foods) {
    const age = Math.max(0, T - f.born), k = Math.min(1, age / 0.3), bob = Math.sin(T * 2.2 + f.ph) * 2.5;
    const x = f.x, y = f.y + bob, r = 23 * (0.6 + 0.4 * k);
    const glow = g.createRadialGradient(x, y, r * 0.4, x, y, r * 2.1);
    glow.addColorStop(0, 'rgba(253, 224, 71, .45)'); glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 2.1, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#fffbeb'); gr.addColorStop(0.55, '#fde68a'); gr.addColorStop(1, '#f59e0b');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = '#451a03'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(r * (String(f.v).length > 2 ? 0.78 : 0.95))}px "Bricolage Grotesque", Lexend, system-ui, sans-serif`;
    g.fillText(String(f.v), x, y + 1);
  }
  // Schlange: ein durchgehender Körper (Rand, Farbe mit Verlauf, Querstreifen, Glanz), hinten spitz
  const pts = snSegs(s.path), L = pts[pts.length - 1].d || 1, R = SN.R;
  const widthAt = (d) => R * 2 * (d / L > 0.7 ? 1 - ((d / L - 0.7) / 0.3) * 0.65 : 1);
  const N = Math.max(8, Math.ceil(L / 14));
  const chunks = [];
  for (let c = 0; c < N; c++) {
    const a = (c / N) * L, b = ((c + 1) / N) * L;
    const seg = pts.filter((p) => p.d >= a - 3 && p.d <= b + 3);
    if (seg.length > 1) chunks.push({ seg, w: widthAt((a + b) / 2), t: (a + b) / 2 / L });
  }
  const stroke = (seg, w, style, dash) => {
    g.beginPath(); g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
    g.lineWidth = w; g.strokeStyle = style;
    if (dash) { g.setLineDash(dash); g.lineDashOffset = -(s.travel - seg[0].d); g.lineCap = 'butt'; } else { g.setLineDash([]); g.lineCap = 'round'; }
    g.stroke();
  };
  g.lineJoin = 'round';
  g.save(); g.shadowColor = s.skin.a; g.shadowBlur = 16;
  for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w + 5, 'rgba(8, 15, 35, .85)');
  g.restore();
  const mix = (t) => { const A = parseInt(s.skin.a.slice(1), 16), B = parseInt(s.skin.b.slice(1), 16); const c = [16, 8, 0].map((sh) => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t)); return `rgb(${c.join(',')})`; };
  for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w, mix(chunks[i].t));
  for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w * 0.92, s.skin.band, [7, 13]);
  for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w * 0.28, 'rgba(255, 255, 255, .28)');
  // Kopf
  const hx = s.x, hy = s.y, ca = Math.cos(s.ang), sa = Math.sin(s.ang);
  g.save(); g.translate(hx, hy); g.rotate(s.ang);
  g.fillStyle = 'rgba(8, 15, 35, .85)'; g.beginPath(); g.ellipse(2, 0, R * 1.42, R * 1.22, 0, 0, 7); g.fill();
  const hg = g.createRadialGradient(-2, -4, 2, 2, 0, R * 1.4); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.25, s.skin.a); hg.addColorStop(1, mix(0.15));
  g.fillStyle = hg; g.beginPath(); g.ellipse(2, 0, R * 1.3, R * 1.1, 0, 0, 7); g.fill();
  // Maul (öffnet sich vor einer Zahl) und Zunge
  if (s.open > 0.05) { g.fillStyle = '#7f1d1d'; g.beginPath(); g.moveTo(R * 1.35, 0); g.arc(R * 0.95, 0, R * 0.55, -0.6 * s.open, 0.6 * s.open); g.closePath(); g.fill(); }
  else if (s.tongue < 0.35) { g.strokeStyle = '#ef4444'; g.lineWidth = 2; g.beginPath(); g.moveTo(R * 1.3, 0); g.lineTo(R * 2.0, 0); g.lineTo(R * 2.3, -3); g.moveTo(R * 2.0, 0); g.lineTo(R * 2.3, 3); g.stroke(); }
  for (const sd of [-1, 1]) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(R * 0.45, sd * R * 0.55, R * 0.42, 0, 7); g.fill();
    // Augen schauen zur Zahl, wenn eine nah ist
    const f = s.foods.find((x) => x.ok) || null;
    let ex = 0.12, ey = 0;
    if (f) { const la = Math.atan2(f.y - hy, f.x - hx) - s.ang; ex = Math.cos(la) * 0.14; ey = Math.sin(la) * 0.14; }
    g.fillStyle = s.skin.eye; g.beginPath(); g.arc(R * (0.45 + ex), sd * R * 0.55 + R * ey, R * 0.22, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(R * (0.45 + ex) - 1.5, sd * R * 0.55 + R * ey - 1.5, R * 0.07, 0, 7); g.fill();
  }
  g.restore();
  void ca; void sa;
  // Funken und Texte
  for (const p of s.parts) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  for (const f of s.floats) {
    const a = Math.min(1, (1.5 - f.t) / 0.4);
    g.globalAlpha = a; g.font = '800 15px "Bricolage Grotesque", Lexend, system-ui, sans-serif'; g.textAlign = 'center';
    const tw = g.measureText(f.text).width + 18, yy = f.y - 26 - f.t * 22;
    g.fillStyle = f.good ? 'rgba(220, 252, 231, .95)' : 'rgba(254, 226, 226, .95)';
    g.beginPath(); g.roundRect ? g.roundRect(f.x - tw / 2, yy - 13, tw, 26, 13) : g.rect(f.x - tw / 2, yy - 13, tw, 26); g.fill();
    g.fillStyle = f.good ? '#14532d' : '#7f1d1d'; g.textBaseline = 'middle'; g.fillText(f.text, f.x, yy + 1);
  }
  g.globalAlpha = 1;
}

/* =========================================================
   🧩 1×1-Tafel-Puzzle: eine leere Einmaleins-Tafel (klein 10 × 10 oder gross 20 × 10) – nur die Reihen- und
   Spaltenzahlen stehen da. Einzelne Zielfelder sind markiert (nie nebeneinander), unten liegen ihre Ergebnisse.
   Weil keine anderen Ergebnisse in der Tafel stehen, hilft kein Muster: man muss Reihe · Spalte ausrechnen.
   Tippt man ein Feld an (oder zieht ein Ergebnis darüber), leuchten seine Reihe und Spalte auf.
   ========================================================= */
const PZ_PENALTY = 3000;
const pzBig = () => (db.settings.pzBig ?? practiceSettings().big) === true;
function startPuzzle() {
  const big = pzBig(), R = big ? 20 : 10, n = big ? 14 : 12;
  const ps = practiceSettings();
  // Zielfelder: vor allem aus den gewählten Reihen, schwierige Rechnungen öfter, nie zwei Felder nebeneinander
  const sel = new Set(ps.reihen.filter((r) => r <= R));
  const cand = [];
  for (let r = 1; r <= R; r++) for (let c = 1; c <= 10; c++) {
    let w = sel.has(r) || sel.has(c) ? 4 : 1;
    if (r === 1 || c === 1) w *= 0.15; else if (r === 10 || c === 10) w *= 0.4;
    const lv = typeof levelOf === 'function' ? levelOf(db.prog.f[`${c}x${r}`]) : 'none';
    if (lv === 'weak' || lv === 'shaky') w *= 2;
    cand.push({ r, c, w });
  }
  const miss = [];
  while (miss.length < n && cand.length) {
    let t = Math.random() * cand.reduce((s, x) => s + x.w, 0), i = 0;
    for (; i < cand.length - 1; i++) { t -= cand[i].w; if (t <= 0) break; }
    const m = cand.splice(i, 1)[0];
    miss.push(m);
    // Nachbarn (auch schräg) und gleiche Ergebnisse fallen weg
    for (let k = cand.length - 1; k >= 0; k--) { const o = cand[k]; if ((Math.abs(o.r - m.r) <= 1 && Math.abs(o.c - m.c) <= 1) || o.r * o.c === m.r * m.c) cand.splice(k, 1); }
  }
  const gone = new Set(miss.map((m) => `${m.r}:${m.c}`));
  const tiles = shuffle(miss.map((m) => m.r * m.c));
  Object.assign(game, { pz: { R, gone, tiles, used: new Set(), sel: null, aim: null }, over: false });
  runStart('puzzle', { goal: tiles.length });
  $('#view').innerHTML = gameShell('puzzle', `
    ${runHudHTML('bar-hud')}
    <div class="pz-wrap">
      <div class="pz-table ${big ? 'big' : ''}" id="pztable">
        <div class="pz-h corner">${SIGN()}</div>${Array.from({ length: 10 }, (_, i) => `<div class="pz-h col" data-c="${i + 1}">${i + 1}</div>`).join('')}
        ${Array.from({ length: R }, (_, ri) => { const r = ri + 1; return `<div class="pz-h row ${sel.has(r) ? 'sel' : ''}" data-r="${r}">${r}</div>${Array.from({ length: 10 }, (_, ci) => { const c = ci + 1; return gone.has(`${r}:${c}`) ? `<div class="pz-cell empty" data-r="${r}" data-c="${c}"></div>` : `<div class="pz-cell blank" data-r="${r}" data-c="${c}"></div>`; }).join('')}`; }).join('')}
      </div>
    </div>
    <div class="pz-dock"><p class="pz-dock-h" id="pzhint">Tippe ein leeres Feld an und rechne: Reihe · Spalte</p><div class="pz-tray" id="pztray">${tiles.map((v, i) => `<button type="button" class="pz-tile" data-t="${i}">${v}</button>`).join('')}</div></div>
    <p class="mode-hint">In der Tafel stehen keine Ergebnisse – rechne für jedes markierte Feld Reihe · Spalte aus und setz das passende Ergebnis hinein (ziehen oder antippen). Ein falscher Platz kostet 3 Sekunden.</p>`);
  pzBind();
}
/** Reihe und Spalte eines Feldes hervorheben (Fadenkreuz) */
function pzCross(cell) {
  const tb = $('#pztable');
  if (!tb) return;
  $$('#pztable .x-on').forEach((x) => x.classList.remove('x-on'));
  if (!cell) return;
  const r = cell.dataset.r, c = cell.dataset.c;
  $$(`#pztable [data-r="${r}"], #pztable [data-c="${c}"]`).forEach((x) => { if (x.matches('.pz-h') || (x.dataset.r === r) !== (x.dataset.c === c)) x.classList.add('x-on'); });
  cell.classList.add('x-on');
}
function pzAim(cell) {
  const pz = game.pz;
  $$('#pztable .aim').forEach((x) => x.classList.remove('aim'));
  pz.aim = cell;
  if (cell) cell.classList.add('aim');
  pzCross(cell);
  const h = $('#pzhint');
  if (h) h.innerHTML = cell ? `Reihe <b>${cell.dataset.r}</b> · Spalte <b>${cell.dataset.c}</b> = ? – welches Ergebnis passt?` : 'Tippe ein leeres Feld an und rechne: Reihe · Spalte';
}
function pzBind() {
  const tray = $('#pztray');
  let drag = null;
  tray.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.pz-tile');
    if (!el || el.classList.contains('placed') || !runOn()) return;
    e.preventDefault();
    drag = { el, i: +el.dataset.t, x0: e.clientX, y0: e.clientY, moved: false, ghost: null };
    el.setPointerCapture(e.pointerId);
  });
  tray.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      const g = drag.el.cloneNode(true);
      g.classList.add('ghost');
      document.body.appendChild(g);
      drag.ghost = g;
      drag.el.classList.add('lifted');
    }
    drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
    $$('.pz-cell.hover').forEach((c) => c.classList.remove('hover'));
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pz-cell.empty:not(.filled)');
    t?.classList.add('hover');
    pzCross(t || game.pz.aim);
  });
  const up = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    $$('.pz-cell.hover').forEach((c) => c.classList.remove('hover'));
    d.el.classList.remove('lifted');
    if (d.ghost) {
      d.ghost.remove();
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pz-cell.empty:not(.filled)');
      if (t) pzPlace(d.i, t); else pzCross(game.pz.aim);
      return;
    }
    // nur getippt: Feld schon gewählt → hineinsetzen; sonst Ergebnis auswählen (nochmals tippen = abwählen)
    if (game.pz.aim) { pzPlace(d.i, game.pz.aim); return; }
    $$('.pz-tile.sel').forEach((x) => x.classList.remove('sel'));
    $('#pztable').classList.toggle('picking', game.pz.sel !== d.i);
    if (game.pz.sel === d.i) { game.pz.sel = null; return; }
    game.pz.sel = d.i; d.el.classList.add('sel');
  };
  tray.addEventListener('pointerup', up); tray.addEventListener('pointercancel', up);
  $('#pztable').addEventListener('click', (e) => {
    const t = e.target.closest('.pz-cell.empty:not(.filled)');
    if (!t || !runOn()) return;
    if (game.pz.sel != null) { pzPlace(game.pz.sel, t); return; }
    pzAim(game.pz.aim === t ? null : t);
  });
}
function pzPlace(i, cell) {
  const pz = game.pz, r = game.run;
  if (!runOn() || pz.used.has(i) || cell.classList.contains('filled')) return;
  const v = pz.tiles[i], want = +cell.dataset.r * +cell.dataset.c;
  const tile = $(`#pztray .pz-tile[data-t="${i}"]`);
  tile?.classList.remove('sel'); pz.sel = null; $('#pztable')?.classList.remove('picking');
  // Rechnung wie im Training: Spalte · Reihe (3 · 7 gehört zur 7er-Reihe)
  const task = makeTask(+cell.dataset.c, +cell.dataset.r, 'mul');
  if (v !== want) {
    sfx.bad();
    r.penalty += PZ_PENALTY;
    tile?.classList.remove('nope'); void tile?.offsetWidth; tile?.classList.add('nope');
    cell.classList.remove('miss'); void cell.offsetWidth; cell.classList.add('miss');
    setTimeout(() => cell.classList.remove('miss'), 450);
    try { recordAnswer(task, v, 6000); } catch { /* */ }
    runWrong();
    return;
  }
  pz.used.add(i);
  sfx.good();
  try { recordAnswer(task, v, 4000); } catch { /* */ }
  cell.textContent = v; cell.classList.add('filled');
  tile?.classList.add('placed');
  sparkle(cell, 8);
  pzAim(null);
  runRight();
}

/* =========================================================
   🚢 Schiffe versenken: Schüsse auf die Einmaleins-Tafel – nur wer das Feld richtig rechnet, darf schiessen
   ========================================================= */
const SH_FLEET = [4, 3, 3, 2, 2];
function shRows() {
  const ps = practiceSettings(), all = reihenFor(ps.big).filter((r) => r >= 2);
  let rows = ps.reihen.filter((r) => r >= 2);
  if (rows.length > 10) rows = shuffle(rows).slice(0, 10);
  if (rows.length < 6) rows = [...rows, ...shuffle(all.filter((r) => !rows.includes(r))).slice(0, 8 - rows.length)];
  return rows.sort((a, b) => a - b);
}
/** Flotte zufällig setzen (Schiffe berühren sich nicht) */
function shPlace(R, C) {
  for (let tries = 0; tries < 400; tries++) {
    const cells = new Map(), ships = [];
    let ok = true;
    for (const len of SH_FLEET) {
      let placed = false;
      for (let k = 0; k < 200 && !placed; k++) {
        const hor = Math.random() < 0.5, r0 = Math.floor(Math.random() * (hor ? R : R - len + 1)), c0 = Math.floor(Math.random() * (hor ? C - len + 1 : C));
        const pts = Array.from({ length: len }, (_, i) => [r0 + (hor ? 0 : i), c0 + (hor ? i : 0)]);
        if (pts.some(([r, c]) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => cells.has(`${r + dr}:${c + dc}`))))) continue;
        const ship = { pts, hits: 0, len, hor };
        pts.forEach(([r, c]) => cells.set(`${r}:${c}`, ship));
        ships.push(ship); placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return { cells, ships, shots: new Map() };
  }
  return { cells: new Map(), ships: [], shots: new Map() };
}
function startShips(opts = {}) {
  const rows = shRows(), R = rows.length, C = 10, three = opts.three;
  Object.assign(game, { sh: { rows, R, C, me: shPlace(R, C), cpu: shPlace(R, C), turn: 'me', busy: false, ask: null, shots: 0, ok: 0, wrong: 0, targets: [], typing: g2Typing(), typed: '' }, over: false });
  $('#view').innerHTML = gameShell('ships', `
    <div class="sh-play">
    <div class="sh-status" id="shstatus"></div>
    <div class="sh-wrap">
      <div class="sh-side enemy"><p class="label">Flotte des Computers 🤖 – tippe ein Feld an</p><div class="${three ? 'sh-sea big' : 'sh-board big'}" id="shcpu"></div><div class="sh-fleet" id="shcpufleet"></div></div>
      <div class="sh-side mine"><p class="label">Deine Flotte</p><div class="${three ? 'sh-sea' : 'sh-board'}" id="shme"></div><div class="sh-fleet" id="shmefleet"></div><div class="sh-ask" id="shask" hidden></div></div>
    </div>
    </div>
    <p class="mode-hint">Tippe auf ein Feld der gegnerischen Tafel und rechne es aus (Spalte · Reihe). Richtig gerechnet → Schuss! Bei einem Treffer darfst du nochmals.</p>`);
  game.sh.phase = 'choose';
  if (three) sh3Mount(three);
  shDraw();
  shStatus('Wie sollen deine Schiffe aufs Meer?');
  $('.sh-play').insertAdjacentHTML('beforeend', `<div class="sh-choose" id="shchoose"><div class="sh-choose-card"><h2>🚢 Deine Flotte</h2><p>Wie sollen deine 5 Schiffe aufs Meer?</p>
    <div class="sh-choose-btns"><button type="button" class="btn primary big" data-action="sh-choose" data-v="self">✋ Selber setzen</button><button type="button" class="btn secondary big" data-action="sh-choose" data-v="random">🎲 Zufällig</button></div></div></div>`);
  setGameKeys((e) => {
    const sh = game.sh;
    if (sh?.phase === 'place' && (e.key === 'r' || e.key === 'R' || e.key === ' ')) { e.preventDefault(); shRotate(); return; }
    if (!sh?.ask || !sh.typing || sh.busy) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); game.typeKey?.(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); game.typeKey?.('back'); }
    else if (e.key === 'Enter') { e.preventDefault(); game.typeKey?.('ok'); }
  });
}
/** Schiff als zusammenhängende Form: Richtung, Heck (b-a) und Bug (b-z) */
function shBoatCls(ship, r, c) {
  const i = ship.pts.findIndex(([pr, pc]) => pr === r && pc === c);
  return `b-${ship.hor ? 'h' : 'v'}${i === 0 ? ' b-a' : ''}${i === ship.len - 1 ? ' b-z' : ''}`;
}
function shBoardHTML(b, own) {
  const s = game.sh;
  let h = `<div class="sh-h corner">${SIGN()}</div>${Array.from({ length: s.C }, (_, c) => `<div class="sh-h">${c + 1}</div>`).join('')}`;
  for (let r = 0; r < s.R; r++) {
    h += `<div class="sh-h row">${s.rows[r]}</div>`;
    for (let c = 0; c < s.C; c++) {
      const k = `${r}:${c}`, shot = b.shots.get(k), ship = b.cells.get(k), sunk = ship && ship.hits >= ship.len;
      const cls = ['sh-cell', shot === 'hit' ? 's-hit' : shot === 'miss' ? 's-miss' : '', (own || sunk) && ship ? `s-boat${sunk ? ' s-sunk' : ''} ${shBoatCls(ship, r, c)}` : ''].join(' ');
      h += own && s.phase === 'place' ? `<button type="button" class="${cls}" data-action="sh-place" data-r="${r}" data-c="${c}" data-k="${k}"></button>` : own ? `<div class="${cls}" data-k="${k}"></div>` : `<button type="button" class="${cls}" data-action="sh-cell" data-r="${r}" data-c="${c}" ${shot ? 'disabled' : ''} aria-label="${c + 1} mal ${s.rows[r]}"></button>`;
    }
  }
  return h;
}
function shFleetHTML(b) { return b.ships.map((x) => `<span class="sh-mini ${x.hits >= x.len ? 'sunk' : ''}">${'■'.repeat(x.len)}</span>`).join(''); }
function shDraw() {
  const s = game.sh;
  if (s.r3) { s.r3.sync(); $('#shcpufleet').innerHTML = shFleetHTML(s.cpu); $('#shmefleet').innerHTML = shFleetHTML(s.me); $('#shcpu').classList.toggle('wait', s.turn !== 'me'); return; }
  $('#shcpu').innerHTML = shBoardHTML(s.cpu, false);
  $('#shme').innerHTML = shBoardHTML(s.me, true);
  $('#shcpu').style.setProperty('--r', s.R); $('#shme').style.setProperty('--r', s.R);
  $('#shcpufleet').innerHTML = shFleetHTML(s.cpu); $('#shmefleet').innerHTML = shFleetHTML(s.me);
  $('#shcpu').classList.toggle('wait', s.turn !== 'me');
}
function shStatus(t, cls = '') { const el = $('#shstatus'); if (el) { el.className = `sh-status ${cls}`; el.innerHTML = t; } }
function shCell(r, c) {
  const s = game.sh;
  if (!s || s.phase !== 'play' || s.turn !== 'me' || s.busy || s.ask || game.over) return;
  if (s.cpu.shots.has(`${r}:${c}`)) return;
  const t = makeTask(c + 1, s.rows[r], 'mul'); // Spalte · Reihe (wie im Training: 3 · 7 gehört zur 7er-Reihe)
  t.shownAt = performance.now();
  s.ask = { r, c, t };
  const vals = s.typing ? [] : choicesFor(t, 4);
  const box = $('#shask');
  box.hidden = false;
  // Handy hochkant: die Rechen-Karte liegt unten über dem Bildschirm – das gewählte Feld bleibt darüber sichtbar
  $('.game-ships')?.classList.add('asking');
  requestAnimationFrame(() => {
    const cell = $(`#shcpu .sh-cell[data-r="${r}"][data-c="${c}"]`);
    if ((!cell && !s.r3) || getComputedStyle(box).position !== 'fixed') return;
    const over = (s.r3 ? s.r3.screenY(r, c) : cell.getBoundingClientRect().bottom) - box.getBoundingClientRect().top + 14;
    if (over > 0) window.scrollBy({ top: over, behavior: reduceMotion() ? 'auto' : 'smooth' });
  });
  box.innerHTML = `<div class="sh-ask-card"><p class="small muted">Spalte ${c + 1} · Reihe ${s.rows[r]}</p><div class="task">${taskHTML(t, '<span class="slot">?</span>')}</div>
    ${s.typing ? g2TypeHTML('shtyped') : `<div class="sh-ans">${vals.map((v) => `<button type="button" class="sh-a" data-action="sh-answer" data-v="${v}">${v}</button>`).join('')}</div>`}
    <button type="button" class="link-btn" data-action="sh-cancel">anderes Feld wählen</button></div>`;
  $$('#shcpu .sh-cell').forEach((b) => b.classList.toggle('s-aim', +b.dataset.r === r && +b.dataset.c === c));
  s.r3?.aim(r, c);
  s.typed = '';
  game.typeKey = (k) => { if (game.sh?.ask && !game.sh.busy) game.sh.typed = g2Type(game.sh.typed, k, $('#shtyped'), (v) => shAnswer(v)); };
}
/* ---------- Eigene Flotte: zufällig oder selber setzen ---------- */
function shChoose(v) {
  const s = game.sh;
  if (!s || s.phase !== 'choose') return;
  $('#shchoose')?.remove();
  if (v === 'random') { shStartPlay(); return; }
  s.phase = 'place';
  s.me = { cells: new Map(), ships: [], shots: new Map() };
  s.place = { queue: [...SH_FLEET], hor: true };
  $('.game-ships')?.classList.add('placing');
  s.r3?.buildOwn();
  shDraw(); shPlaceUI();
  if (!s.r3) $('#shme')?.addEventListener('mouseover', (e) => { const b = e.target.closest('[data-action="sh-place"]'); if (b) shPlaceHover(+b.dataset.r, +b.dataset.c); });
}
function shPlaceUI() {
  const s = game.sh, q = s.place.queue;
  const done = !q.length;
  shStatus(done ? '<b>Alle Schiffe sind auf dem Meer!</b> Tippe ein Schiff an, um es nochmals zu setzen – oder los geht’s.'
    : `Setze dein Schiff mit <b>${q[0]} Feldern</b> ${'■'.repeat(q[0])} – tippe aufs Meer. Schiffe dürfen sich nicht berühren.`);
  const box = $('#shplace') || $('.sh-play').insertAdjacentElement('afterbegin', Object.assign(document.createElement('div'), { id: 'shplace', className: 'sh-place-bar' }));
  box.innerHTML = done ? `<button type="button" class="btn ghost" data-action="sh-reset">↺ Neu setzen</button><button type="button" class="btn primary big" data-action="sh-go">Los geht’s! 🚀</button>`
    : `<button type="button" class="btn secondary" data-action="sh-rotate">↻ Drehen (${s.place.hor ? 'waagrecht' : 'senkrecht'})</button><button type="button" class="btn ghost" data-action="sh-rand">🎲 Rest zufällig</button>${s.me.ships.length ? '<button type="button" class="btn ghost" data-action="sh-reset">↺ Neu</button>' : ''}`;
}
function shFits(r, c, len, hor) {
  const s = game.sh;
  for (let i = 0; i < len; i++) {
    const rr = r + (hor ? 0 : i), cc = c + (hor ? i : 0);
    if (rr < 0 || cc < 0 || rr >= s.R || cc >= s.C) return false;
    for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) if (s.me.cells.has(`${rr + dr}:${cc + dc}`)) return false;
  }
  return true;
}
function shPlaceHover(r, c) {
  const s = game.sh;
  if (s?.phase !== 'place') return;
  const len = s.place.queue[0];
  if (!len) { s.r3?.ghost(null); return; }
  const ok = shFits(r, c, len, s.place.hor);
  if (s.r3) s.r3.ghost({ r, c, len, hor: s.place.hor, ok });
  else $$('#shme .sh-cell').forEach((b) => { const br = +b.dataset.r, bc = +b.dataset.c; const on = s.place.hor ? br === r && bc >= c && bc < c + len : bc === c && br >= r && br < r + len; b.classList.toggle('s-ghost', on && ok); b.classList.toggle('s-ghostbad', on && !ok); });
  s.place.last = [r, c];
}
function shPlaceAt(r, c) {
  const s = game.sh;
  if (s?.phase !== 'place') return;
  // auf ein gesetztes Schiff getippt: wieder hochnehmen
  const hit = s.me.cells.get(`${r}:${c}`);
  if (hit) {
    s.me.ships = s.me.ships.filter((x) => x !== hit);
    hit.pts.forEach(([pr, pc]) => s.me.cells.delete(`${pr}:${pc}`));
    s.place.queue.unshift(hit.len); s.place.hor = hit.hor;
    tone([520, 390], 0.06, 'sine', 0.04);
    s.r3?.buildOwn(); shDraw(); shPlaceUI(); shPlaceHover(hit.pts[0][0], hit.pts[0][1]);
    return;
  }
  const len = s.place.queue[0];
  if (!len) return;
  if (!shFits(r, c, len, s.place.hor)) { tone([200], 0.08, 'square', 0.04); shStatus(`Da passt das Schiff nicht hin – es ragt hinaus oder berührt ein anderes. ${s.place.hor ? 'Versuch es weiter links' : 'Versuch es weiter oben'} oder drehe es.`, 'bad'); return; }
  const pts = Array.from({ length: len }, (_, i) => [r + (s.place.hor ? 0 : i), c + (s.place.hor ? i : 0)]);
  const ship = { pts, hits: 0, len, hor: s.place.hor };
  pts.forEach(([pr, pc]) => s.me.cells.set(`${pr}:${pc}`, ship));
  s.me.ships.push(ship); s.place.queue.shift();
  snd.clunk();
  s.r3?.buildOwn(); s.r3?.ghost(null);
  shDraw(); shPlaceUI();
}
function shRotate() { const s = game.sh; if (s?.phase !== 'place') return; s.place.hor = !s.place.hor; shPlaceUI(); if (s.place.last) shPlaceHover(...s.place.last); }
function shRandRest() {
  const s = game.sh;
  if (s?.phase !== 'place') return;
  for (let tries = 0; tries < 300 && s.place.queue.length; tries++) {
    const len = s.place.queue[0], hor = Math.random() < 0.5, r = Math.floor(Math.random() * s.R), c = Math.floor(Math.random() * s.C);
    if (!shFits(r, c, len, hor)) continue;
    const pts = Array.from({ length: len }, (_, i) => [r + (hor ? 0 : i), c + (hor ? i : 0)]);
    const ship = { pts, hits: 0, len, hor };
    pts.forEach(([pr, pc]) => s.me.cells.set(`${pr}:${pc}`, ship));
    s.me.ships.push(ship); s.place.queue.shift();
  }
  if (s.place.queue.length) { s.me = { cells: new Map(), ships: [], shots: new Map() }; s.place.queue = [...SH_FLEET]; shRandRest(); return; }
  s.r3?.buildOwn(); s.r3?.ghost(null); shDraw(); shPlaceUI();
}
function shResetPlace() { const s = game.sh; if (s?.phase !== 'place') return; s.me = { cells: new Map(), ships: [], shots: new Map() }; s.place.queue = [...SH_FLEET]; s.r3?.buildOwn(); shDraw(); shPlaceUI(); }
/** Meeresrauschen und ab und zu eine Möwe, solange das Spiel läuft */
function shAmbient() {
  if (game.sh?.amb) return;
  const stop = snd.sea();
  let tm = 0;
  const gull = () => { if (!game.sh || game.over || !$('#shcpu')) return; snd.gull(); tm = setTimeout(gull, 9000 + Math.random() * 9000); };
  tm = setTimeout(gull, 4000);
  game.sh.amb = () => { stop(); clearTimeout(tm); };
  game.cleanups = [...(game.cleanups || []), () => game.sh?.amb?.()];
}
function shStartPlay() {
  const s = game.sh;
  if (s.phase === 'place' && s.place.queue.length) return;
  s.phase = 'play';
  $('#shplace')?.remove(); $('#shchoose')?.remove();
  $('.game-ships')?.classList.remove('placing');
  s.r3?.ghost(null); s.r3?.buildOwn();
  shDraw();
  shStatus(s.typing ? 'Du beginnst! Tippe ein Feld an – du rechnest schon so sicher, dass du die Ergebnisse selbst eintippst.' : 'Du beginnst! Tippe ein Feld an.');
  snd.horn(); shAmbient();
}
function shClose() {
  const s = game.sh;
  if (s) s.ask = null;
  const box = $('#shask');
  if (box) box.hidden = true;
  $('.game-ships')?.classList.toggle('asking', false);
  s?.r3?.aim(null, null);
}
function shCancel() {
  const s = game.sh;
  if (!s || s.busy) return;
  shClose();
  $$('#shcpu .s-aim').forEach((b) => b.classList.toggle('s-aim', false));
}
function shAnswer(v) {
  const s = game.sh;
  if (!s?.ask || s.busy) return;
  const { r, c, t } = s.ask;
  const ok = Number(v) === t.answer;
  recordAnswer(t, v, performance.now() - t.shownAt);
  $$('#shask .sh-a').forEach((b) => { b.disabled = true; if (Number(b.dataset.v) === t.answer) b.classList.add('right'); else if (b.dataset.v === String(v)) b.classList.add('wrong'); });
  $$('#shask .cs-key').forEach((b) => { b.disabled = true; });
  const ty = $('#shtyped'); if (ty) { ty.classList.add(ok ? 'good' : 'bad'); if (!ok) ty.innerHTML = `${esc(String(v))} <small>→ ${t.answer}</small>`; }
  s.busy = true;
  if (!ok) {
    s.wrong++;
    sfx.bad();
    shStatus(`Falsch gerechnet: ${esc(taskText(t, true))} – kein Schuss. Jetzt ist der Computer dran.`, 'bad');
    gLater(() => { shClose(); s.busy = false; s.turn = 'cpu'; shDraw(); gLater(shCpu, 700); }, 1400);
    return;
  }
  s.ok++; s.shots++;
  snd.cannon(false, 0.25); snd.whistle(0.42, 0.33);
  gLater(() => {
    shClose();
    const res = shFire(s.cpu, r, c);
    if (res === 'miss') snd.splash(); else snd.blast(res === 'sunk');
    if (res === 'sunk') { snd.bubbles(0.9); }
    shDraw();
    const el = $(`#shcpu .sh-cell[data-r="${r}"][data-c="${c}"]`);
    if (res === 'miss') { shStatus(`${esc(taskText(t, true))} – Wasser! 💧 Jetzt ist der Computer dran.`); s.turn = 'cpu'; s.busy = false; shDraw(); gLater(shCpu, 900); return; }
    sparkle(el, 10);
    if (res === 'sunk') gLater(() => tone([523, 659, 784, 1047], 0.08, 'triangle', 0.05), 450);
    if (s.cpu.ships.every((x) => x.hits >= x.len)) { shEnd(true); return; }
    shStatus(`${esc(taskText(t, true))} – ${res === 'sunk' ? '<b>Versenkt!</b> 🚢💥' : '<b>Treffer!</b> 💥'} Du darfst nochmals.`, 'good');
    s.busy = false;
  }, 500);
}
function shFire(b, r, c) {
  const k = `${r}:${c}`, ship = b.cells.get(k);
  if (!ship) { b.shots.set(k, 'miss'); return 'miss'; }
  b.shots.set(k, 'hit'); ship.hits++;
  if (ship.hits >= ship.len) {
    // rund um ein versenktes Schiff kann nichts mehr sein
    ship.pts.forEach(([pr, pc]) => [-1, 0, 1].forEach((dr) => [-1, 0, 1].forEach((dc) => { const kk = `${pr + dr}:${pc + dc}`; if (pr + dr >= 0 && pc + dc >= 0 && pr + dr < game.sh.R && pc + dc < game.sh.C && !b.shots.has(kk)) b.shots.set(kk, 'miss'); })));
    return 'sunk';
  }
  return 'hit';
}
/** Computer: sucht zuerst rund um Treffer weiter, sonst zufällig im Schachbrettmuster */
function shCpu() {
  const s = game.sh;
  if (!s || game.over || s.turn !== 'cpu') return;
  const b = s.me, free = (r, c) => r >= 0 && c >= 0 && r < s.R && c < s.C && !b.shots.has(`${r}:${c}`);
  const open = [...b.shots.entries()].filter(([k, v]) => v === 'hit' && (() => { const sh = b.cells.get(k); return sh.hits < sh.len; })()).map(([k]) => k.split(':').map(Number));
  let pick = null;
  if (open.length) {
    const cand = [];
    if (open.length >= 2) { // Richtung erkannt: in der Linie weiter
      const hor = open[0][0] === open[1][0];
      open.forEach(([r, c]) => (hor ? [[r, c - 1], [r, c + 1]] : [[r - 1, c], [r + 1, c]]).forEach(([a, d]) => { if (free(a, d)) cand.push([a, d]); }));
    }
    if (!cand.length) open.forEach(([r, c]) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([a, d]) => { if (free(a, d)) cand.push([a, d]); }));
    pick = cand.length ? g2Pick(cand) : null;
  }
  if (!pick) {
    const all = [];
    for (let r = 0; r < s.R; r++) for (let c = 0; c < s.C; c++) if (free(r, c) && (r + c) % 2 === 0) all.push([r, c]);
    if (!all.length) for (let r = 0; r < s.R; r++) for (let c = 0; c < s.C; c++) if (free(r, c)) all.push([r, c]);
    pick = g2Pick(all);
  }
  if (!pick) { s.turn = 'me'; return; }
  const [r, c] = pick;
  // erst Donner und Pfeifen, dann schlägt es ein
  snd.cannon(true); snd.whistle(0.5, 0.1);
  gLater(() => shCpuHit(r, c), 650);
}
function shCpuHit(r, c) {
  const s = game.sh;
  if (!s || game.over || s.turn !== 'cpu') return;
  const b = s.me, res = shFire(b, r, c);
  if (res === 'miss') snd.splash(); else { snd.blast(res === 'sunk'); if (res === 'sunk') snd.bubbles(0.9); }
  shDraw();
  const el = $(`#shme .sh-cell[data-k="${r}:${c}"]`);
  el?.classList.add('s-flash');
  const t = `${c + 1} ${SIGN()} ${s.rows[r]} = ${s.rows[r] * (c + 1)}`;
  if (res === 'miss') { shStatus(`Der Computer schiesst auf ${t} – Wasser. <b>Du bist dran!</b>`); s.turn = 'me'; shDraw(); return; }
  if (s.me.ships.every((x) => x.hits >= x.len)) { shEnd(false); return; }
  shStatus(`Der Computer trifft bei ${t}${res === 'sunk' ? ' und versenkt ein Schiff!' : '!'} Er schiesst nochmals …`, 'bad');
  gLater(shCpu, 1000);
}
function shEnd(win) {
  const s = game.sh;
  game.over = true;
  const acc = s.ok + s.wrong ? Math.round((s.ok / (s.ok + s.wrong)) * 100) : 0;
  const st = !win ? (acc >= 90 ? 1 : 0) : acc >= 95 ? 3 : acc >= 80 ? 2 : 1;
  s.amb?.(); s.amb = null;
  if (win) { sfx.win(); confetti(); } else snd.horn(true, 0.6);
  gLater(() => {
    if (ui.view !== 'game') return;
    $('#view').innerHTML = gameShell('ships', gameResultHTML({ st, title: win ? 'Gewonnen – alle Schiffe versenkt! 🚢' : 'Der Computer war schneller 🤖',
      line: `${s.ok} richtig gerechnet, ${s.wrong} falsch (${acc} %) · ${s.shots} Schüsse` }));
  }, win ? 1200 : 1600);
}

/* =========================================================
   🎲 Würfel-Duell gegen den Rechen-Roboter: wer kommt näher an die Zielzahl?
   Zahlen-Würfel (1–10) und Reihen-Würfel (die gewählten Reihen) als echte 3D-Würfel; einmal pro Runde darf man
   einen Würfel neu werfen. Das Produkt zählt nur, wenn man es richtig ausrechnet (sehr sichere Kinder tippen es
   selbst ein). Ein Zahlenstrahl zeigt, wer näher dran ist. Wer zuerst 3 Runden gewinnt, gewinnt.
   ========================================================= */
const DC_WIN = 3;
const DC_STEPS = [
  ['🎯', 'Zielzahl ansehen', 'Oben in der Mitte steht die Zielzahl.'],
  ['🎲', 'Würfeln', 'Du würfelst mit zwei Würfeln: einem Zahlen-Würfel (1–10) und einem Reihen-Würfel.'],
  ['🔄', 'Behalten oder neu werfen', 'Gefällt dir ein Würfel nicht? Tippe ihn an – er wird einmal neu geworfen. Sonst tippe «Behalten».'],
  ['✖️', 'Ausrechnen', 'Rechne deine zwei Zahlen mal. Nur ein richtiges Ergebnis zählt!'],
  ['🏆', 'Wer ist näher?', 'Robo würfelt auch. Wessen Ergebnis näher an der Zielzahl liegt, gewinnt die Runde. Wer zuerst 3 Runden hat, gewinnt.'],
];
function dcHelpHTML() {
  return `<div class="dc-help" id="dchelp"><div class="dc-help-card"><h2>So geht das Würfel-Duell</h2>
    <ol>${DC_STEPS.map(([e, h, t], i) => `<li><span class="dc-step">${i + 1}</span><span class="dc-emo">${e}</span><div><b>${h}</b><small>${t}</small></div></li>`).join('')}</ol>
    <button type="button" class="btn primary big" data-action="dc-help-close">Los geht's!</button></div></div>`;
}
function startDice() {
  const rows = practiceSettings().reihen.slice();
  Object.assign(game, { dc: { rows, pts: [0, 0], round: 0, phase: 'roll', me: null, cpu: null, rerolled: false, target: 0, ok: 0, wrong: 0, t: null, typing: g2Typing(), typed: '' }, over: false });
  $('#view').innerHTML = gameShell('dice', `
    <div class="dc-play">
    <div class="dc-score"><span class="dc-p me">Du <b id="dcme">0</b></span><span class="dc-vs">bis ${DC_WIN}</span><span class="dc-p cpu"><b id="dccpu">0</b> Robo 🤖</span><button type="button" class="dc-q" data-action="dc-help" aria-label="So geht's">?</button></div>
    <div class="dc-target"><small>Zielzahl</small><b id="dctarget">?</b></div>
    <div class="dc-table">
      <div class="dc-side me"><p class="label">Deine Würfel</p><div class="dc-dice" id="dcmine"></div><div class="dc-res" id="dcmeres"></div></div>
      <div class="dc-side cpu"><p class="label">Robo 🤖</p><div class="dc-dice" id="dccpud"></div><div class="dc-res" id="dccpures"></div></div>
    </div>
    <div class="dc-ctrl" id="dcctrl"></div>
    </div>
    <p class="mode-hint">Würfle, dann entscheide: behalten oder einen Würfel nochmals werfen (tippe ihn an). Rechne dein Produkt richtig aus – wer näher an der Zielzahl ist, gewinnt die Runde. Der ?-Knopf zeigt die Anleitung.</p>`);
  setGameKeys((e) => {
    const d = game.dc;
    if (!d) return;
    if (d.phase === 'calc' && d.typing) {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); game.typeKey?.(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); game.typeKey?.('back'); }
      else if (e.key === 'Enter') { e.preventDefault(); game.typeKey?.('ok'); }
    } else if ((e.key === ' ' || e.key === 'Enter') && d.phase === 'roll' && !$('#dchelp')) { e.preventDefault(); dcDoRoll(); }
  });
  dcRound();
  if (!db.settings.dcHelpSeen) dcHelp(true);
}
function dcHelp(on) {
  $('#dchelp')?.remove();
  if (!on) { db.settings.dcHelpSeen = true; saveDB(); return; }
  $('.game-dice')?.insertAdjacentHTML('beforeend', dcHelpHTML());
}
/** Ein 3D-Würfel (CSS): vorne das Ergebnis, auf den anderen Seiten andere mögliche Werte */
function dcDieHTML(v, kind, opts = {}) {
  const pool = kind === 'row' ? game.dc.rows : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const other = () => (v === '?' ? '?' : g2Pick(pool));
  const faces = [v, other(), other(), other(), other(), other()].map((x, i) => `<span class="f${i + 1}">${x}</span>`).join('');
  const tag = opts.pick ? 'button type="button"' : 'div';
  return `<${tag} class="d3 ${kind} ${v === '?' ? 'idle' : ''} ${opts.pick ? 'pick' : ''}" ${opts.pick ? `data-action="dc-reroll" data-i="${opts.i}" aria-label="Würfel neu werfen"` : ''}>
    <span class="d3-cube">${faces}</span><i class="d3-shadow"></i><small>${kind === 'row' ? 'Reihe' : '1–10'}</small></${opts.pick ? 'button' : 'div'}>`;
}
/** Würfel anzeigen; roll: Liste der Würfel (Index), die gerade geworfen werden */
function dcShow(el, dice, roll = [0, 1], pick = false) {
  const host = $(el);
  if (!host) return;
  host.innerHTML = dice.map((v, i) => dcDieHTML(v, i ? 'row' : 'num', { pick, i })).join('');
  [...host.querySelectorAll('.d3')].forEach((d, i) => {
    if (!roll.includes(i) || reduceMotion()) return;
    const cube = d.querySelector('.d3-cube'), sh = d.querySelector('.d3-shadow');
    const turns = () => (2 + Math.floor(Math.random() * 2)) * 360 * (Math.random() < 0.5 ? -1 : 1);
    cube.animate([
      { transform: `translateY(-70px) rotateX(${turns() + 40}deg) rotateY(${turns() - 30}deg) rotateZ(${Math.random() * 90}deg)` },
      { transform: 'translateY(4px) rotateX(-12deg) rotateY(10deg) rotateZ(0deg)', offset: 0.72 },
      { transform: 'translateY(-10px) rotateX(5deg) rotateY(-4deg)', offset: 0.86 },
      { transform: 'translateY(0) rotateX(0) rotateY(0) rotateZ(0)' },
    ], { duration: 950 + i * 120, easing: 'cubic-bezier(.25,.8,.35,1)' });
    sh.animate([{ transform: 'scale(.4)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1, offset: 0.72 }, { transform: 'scale(.85)', offset: 0.86 }, { transform: 'scale(1)', opacity: 1 }], { duration: 950 + i * 120 });
  });
}
const dcOff = (v) => { const n = Math.abs(v - game.dc.target); return n === 0 ? 'genau getroffen! 🎯' : `${n} weg vom Ziel`; };
const dcStep = (n, text) => `<p class="dc-msg"><span class="dc-step">${n}</span>${text}</p>`;
function dcRound() {
  const d = game.dc;
  d.round++; d.phase = 'roll'; d.me = null; d.cpu = null; d.rerolled = false; d.t = null; d.myVal = null;
  // Zielzahl: ein mögliches Produkt in der Mitte des Bereichs
  const r = g2Pick(d.rows), k = 2 + Math.floor(Math.random() * 8);
  d.target = Math.max(4, r * k + g2Pick([-2, -1, 0, 1, 2, 3]));
  $('#dctarget').textContent = d.target;
  $('#dctarget').parentNode.classList.remove('pop'); void $('#dctarget').offsetWidth; $('#dctarget').parentNode.classList.add('pop');
  dcShow('#dcmine', ['?', '?'], []);
  dcShow('#dccpud', ['?', '?'], []);
  $('#dcmeres').innerHTML = ''; $('#dccpures').innerHTML = '';
  $('#dcctrl').innerHTML = `${dcStep(1, `Runde ${d.round}: Die Zielzahl ist <b>${d.target}</b>. Wer kommt näher?`)}<button type="button" class="btn primary big dc-go" data-action="dc-roll">🎲 Würfeln</button>`;
}
const dcRoll = () => [1 + Math.floor(Math.random() * 10), g2Pick(game.dc.rows)]; // [Zahlen-Würfel, Reihen-Würfel]
function dcDoRoll() {
  const d = game.dc;
  if (d.phase !== 'roll') return;
  d.me = dcRoll(); d.phase = 'decide';
  tone([440, 520, 620], 0.05, 'square', 0.03);
  dcShow('#dcmine', d.me, [0, 1], true);
  $('#dcctrl').innerHTML = `${dcStep(2, `Gefällt dir ein Würfel nicht? <b>Tippe ihn an</b> – er wird einmal neu geworfen. Sonst:`)}<button type="button" class="btn primary big" data-action="dc-keep">✓ Behalten</button>`;
}
function dcReroll(i) {
  const d = game.dc;
  if (d.phase !== 'decide' || d.rerolled) return;
  d.rerolled = true;
  d.me[i] = i === 1 ? g2Pick(d.rows) : 1 + Math.floor(Math.random() * 10);
  tone([520, 620], 0.05, 'square', 0.03);
  dcShow('#dcmine', d.me, [i], false);
  gLater(dcAsk, 900);
}
function dcAsk() {
  const d = game.dc;
  if (d.phase !== 'decide') return;
  d.phase = 'calc';
  const t = makeTask(d.me[0], d.me[1], 'mul');
  t.shownAt = performance.now(); d.t = t;
  $$('#dcmine .d3').forEach((x) => { x.classList.remove('pick'); x.removeAttribute('data-action'); });
  const vals = d.typing ? [] : choicesFor(t, 4);
  $('#dcctrl').innerHTML = `${dcStep(3, 'Rechne aus: Wie viel ist das?')}<div class="task">${taskHTML(t, '<span class="slot">?</span>')}</div>
    ${d.typing ? g2TypeHTML('dctyped') : `<div class="dc-ans">${vals.map((v) => `<button type="button" class="dc-a" data-action="dc-answer" data-v="${v}">${v}</button>`).join('')}</div>`}`;
  d.typed = '';
  game.typeKey = (k) => { const dd = game.dc; if (dd?.phase === 'calc') dd.typed = g2Type(dd.typed, k, $('#dctyped'), (v) => dcAnswer(v)); };
}
function dcAnswer(v) {
  const d = game.dc;
  if (d.phase !== 'calc') return;
  d.phase = 'cpu';
  const t = d.t, ok = Number(v) === t.answer;
  recordAnswer(t, v, performance.now() - t.shownAt);
  $$('.dc-a').forEach((b) => { b.disabled = true; if (Number(b.dataset.v) === t.answer) b.classList.add('right'); else if (b.dataset.v === String(v)) b.classList.add('wrong'); });
  $$('#dcctrl .cs-key').forEach((b) => { b.disabled = true; });
  const ty = $('#dctyped'); if (ty) { ty.classList.add(ok ? 'good' : 'bad'); if (!ok) ty.innerHTML = `${esc(String(v))} <small>→ ${t.answer}</small>`; }
  if (ok) { d.ok++; sfx.good(); } else { d.wrong++; sfx.bad(); }
  d.myVal = ok ? t.answer : null;
  $('#dcmeres').innerHTML = ok ? `<b>${t.answer}</b><small>${t.a} ${SIGN()} ${t.b}</small><small>${dcOff(t.answer)}</small>` : `<b class="bust">✗</b><small>falsch gerechnet</small><small>${esc(taskText(t, true))} – zählt nicht</small>`;
  gLater(dcCpu, 1200);
}
/** Robo: würfelt; ist er weit weg, wirft er den Würfel neu, der am meisten hilft */
function dcCpu() {
  const d = game.dc;
  let c = dcRoll();
  dcShow('#dccpud', c, [0, 1], false);
  $('#dcctrl').innerHTML = dcStep(4, 'Jetzt würfelt Robo …');
  gLater(() => {
    const dist = (a, b) => Math.abs(a * b - d.target);
    if (dist(c[0], c[1]) > 6) {
      const exp0 = Array.from({ length: 10 }, (_, i) => dist(i + 1, c[1])).reduce((s, x) => s + x, 0) / 10, exp1 = d.rows.reduce((s, r) => s + dist(c[0], r), 0) / d.rows.length;
      if (Math.min(exp0, exp1) < dist(c[0], c[1])) {
        const i = exp0 < exp1 ? 0 : 1;
        c = [...c]; c[i] = i === 1 ? g2Pick(d.rows) : 1 + Math.floor(Math.random() * 10);
        dcShow('#dccpud', c, [i], false);
        $('#dcctrl').innerHTML = dcStep(4, 'Robo wirft einen Würfel neu …');
      }
    }
    gLater(() => {
      const cv = c[0] * c[1];
      d.cpu = c; d.cpuVal = cv;
      $('#dccpures').innerHTML = `<b>${cv}</b><small>${c[0]} ${SIGN()} ${c[1]}</small><small>${dcOff(cv)}</small>`;
      dcJudge();
    }, 1150);
  }, 1250);
}
/** Zahlenstrahl (SVG): Zielzahl in der Mitte, dein Ergebnis oben, Robos Ergebnis unten; die Balken zeigen den Abstand */
function dcLineHTML() {
  const d = game.dc, vals = [d.target, d.cpuVal, ...(d.myVal != null ? [d.myVal] : [])];
  const lo = Math.max(0, Math.min(...vals) - 5), hi = Math.max(...vals) + 5, X = (v) => 30 + ((v - lo) / (hi - lo)) * 380;
  const bar = (v, y, col) => `<rect x="${Math.min(X(v), X(d.target))}" y="${y}" width="${Math.max(2, Math.abs(X(v) - X(d.target)))}" height="7" rx="3.5" fill="${col}"/>`;
  const tag = (v, y, col, lab, up) => `<g><line x1="${X(v)}" x2="${X(v)}" y1="${up ? y + 26 : 44}" y2="${up ? 44 : y}" stroke="${col}" stroke-width="2"/><rect x="${X(v) - 19}" y="${y}" width="38" height="26" rx="8" fill="#fff" stroke="${col}" stroke-width="2.5"/><text x="${X(v)}" y="${y + 18}" text-anchor="middle" font-weight="800" font-size="15" fill="${col}">${v}</text><text x="${X(v)}" y="${up ? y - 4 : y + 40}" text-anchor="middle" font-weight="800" font-size="10" fill="${col}">${lab}</text></g>`;
  const me = 'var(--c)', cpu = '#475569';
  return `<svg class="dc-line" viewBox="0 -12 440 116" aria-hidden="true">
    <rect x="20" y="41" width="400" height="6" rx="3" fill="rgba(100,116,139,.22)"/>
    ${d.myVal != null ? bar(d.myVal, 33, me) : ''}${bar(d.cpuVal, 48, cpu)}
    ${d.myVal != null ? tag(d.myVal, 6, me, 'DU', true) : ''}${tag(d.cpuVal, 64, cpu, 'ROBO', false)}
    <circle cx="${X(d.target)}" cy="44" r="15" fill="#fde68a" stroke="#b45309" stroke-width="2.5"/><text x="${X(d.target)}" y="49" text-anchor="middle" font-weight="900" font-size="13" fill="#78350f">${d.target}</text>
  </svg>`;
}
function dcJudge() {
  const d = game.dc;
  const me = d.myVal == null ? Infinity : Math.abs(d.myVal - d.target), cpu = Math.abs(d.cpuVal - d.target);
  let msg;
  if (me < cpu) { d.pts[0]++; msg = `<b>Du gewinnst die Runde!</b> 🎉 Du bist ${me === 0 ? 'genau auf dem Ziel' : `nur ${me} weg`}, Robo ${cpu}.`; tone([660, 880, 1175], 0.07, 'triangle', 0.07); }
  else if (cpu < me) { d.pts[1]++; msg = d.myVal == null ? 'Robo gewinnt die Runde – dein Ergebnis war falsch gerechnet.' : `Robo gewinnt die Runde: Robo ist ${cpu} weg, du ${me}.`; tone([330, 247], 0.1, 'sawtooth', 0.04); }
  else msg = 'Gleich nah – unentschieden!';
  $('#dcme').textContent = d.pts[0]; $('#dccpu').textContent = d.pts[1];
  const line = dcLineHTML();
  if (d.pts[0] >= DC_WIN || d.pts[1] >= DC_WIN) { $('#dcctrl').innerHTML = `${line}${dcStep(5, msg)}`; gLater(dcEnd, 2000); return; }
  $('#dcctrl').innerHTML = `${line}${dcStep(5, msg)}<button type="button" class="btn primary big" data-action="dc-next">Nächste Runde ${icon('right')}</button>`;
}
function dcEnd() {
  const d = game.dc, win = d.pts[0] > d.pts[1];
  game.over = true;
  if (win) { sfx.win(); confetti(); }
  const acc = d.ok + d.wrong ? Math.round((d.ok / (d.ok + d.wrong)) * 100) : 0;
  $('#view').innerHTML = gameShell('dice', gameResultHTML({ st: win ? (acc === 100 ? 3 : 2) : acc === 100 ? 1 : 0, title: win ? `Gewonnen ${d.pts[0]} : ${d.pts[1]}! 🎲` : `Robo gewinnt ${d.pts[1]} : ${d.pts[0]} 🤖`,
    line: `${d.ok} von ${d.ok + d.wrong} Produkten richtig gerechnet` }));
}

/* =========================================================
   🏰 Burg verteidigen: Monster mit Rechnungen laufen auf die Burg zu. Ergebnis eintippen → die Kanone trifft.
   ========================================================= */
const CS_LANE = (l) => 38 + l * 23; // Höhe der drei Wege (in % der Bühne, Füsse der Monster)
const CS_EMPTY = '<small>Ergebnis tippen</small>';
const CS_MON = ['👾', '👹', '🐲', '👻', '🦇', '🐙', '🦖', '🧌'];
function startCastle() {
  Object.assign(game, { picker: gamePicker(), cs: { mons: [], typed: '', spawnT: 0.8, last: 0, id: 0, shots: [] }, over: false });
  runStart('castle');
  $('#view').innerHTML = gameShell('castle', `
    ${runHudHTML('bar-hud')}
    <div class="cs-play">
    <div class="cs-stage" id="csstage">
      <span class="cs-moon" aria-hidden="true"></span>
      ${[0, 1, 2].map((l) => `<span class="cs-lane" style="top:${CS_LANE(l)}%"></span>`).join('')}
      <div class="cs-castle" aria-hidden="true"><div class="cs-wall"></div><div class="cs-tower"><span class="cs-flag">🚩</span></div><div class="cs-tower t2"></div><span class="cs-cannon" id="cscannon"><i></i></span></div>
    </div>
    <div class="cs-input"><span class="cs-typed" id="cstyped">${CS_EMPTY}</span>
      <div class="cs-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="cs-key" data-action="cs-key" data-k="${n}">${n}</button>`).join('')}<button type="button" class="cs-key back" data-action="cs-key" data-k="back">⌫</button><button type="button" class="cs-key" data-action="cs-key" data-k="0">0</button><button type="button" class="cs-key ok" data-action="cs-key" data-k="ok">✓</button></div></div>
    </div>
    <p class="mode-hint">Tippe das Ergebnis eines Monsters ein (Zahlentasten oder Tastatur) – die Kanone feuert, sobald es passt. Erreicht ein Monster die Burg, ${game.run.mode === 'survive' ? 'kostet das ein Leben' : 'ist es weg'}.</p>`);
  setGameKeys((e) => {
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); csKey(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); csKey('back'); }
    else if (e.key === 'Enter') { e.preventDefault(); csKey('ok'); }
  });
  const loop = (now) => {
    const c = game.cs;
    if (!c || !$('#csstage')) return;
    game.raf = requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min(0.05, (now - (c.last || now)) / 1000)); c.last = now;
    if (runOn()) csStep(dt);
  };
  game.raf = requestAnimationFrame(loop);
}
function csStep(dt) {
  const c = game.cs, lv = surviveLevel();
  c.spawnT -= dt;
  const maxOn = Math.min(5, 2 + Math.floor(lv / 2));
  if (c.spawnT <= 0 && c.mons.length < maxOn) { csSpawn(); c.spawnT = Math.max(1.4, 3.6 - lv * 0.25) * (0.8 + Math.random() * 0.4); }
  const st = $('#csstage');
  for (const m of [...c.mons]) {
    m.x -= m.v * dt;
    m.el.style.left = `${m.x}%`;
    if (m.x <= 14) { // an der Burg
      csRemove(m);
      st?.classList.remove('hit'); void st?.offsetWidth; st?.classList.add('hit');
      sfx.bad();
      recordAnswer(m.t, '', 20000);
      if (runWrong(m.t)) return;
    }
  }
}
function csSpawn() {
  const c = game.cs, st = $('#csstage');
  if (!st) return;
  // nie zwei Monster mit demselben Ergebnis gleichzeitig
  const busy = new Set(c.mons.map((m) => m.t.answer));
  const t = game.picker.pool.some((x) => !busy.has(x.answer)) ? game.picker.next((x) => !busy.has(x.answer)) : game.picker.next();
  const lane = [0, 1, 2].sort(() => Math.random() - 0.5).find((l) => !c.mons.some((m) => m.lane === l && m.x > 70)) ?? Math.floor(Math.random() * 3);
  const lv = surviveLevel();
  const m = { id: ++c.id, t, lane, x: 100, v: (5.2 + lv * 0.55) * (0.85 + Math.random() * 0.3), el: document.createElement('div') };
  m.el.className = 'cs-mon';
  m.el.style.top = `${CS_LANE(lane)}%`;
  m.el.style.zIndex = 3 + lane;
  m.el.innerHTML = `<span class="cs-sign">${taskHTML(t, '<span class="slot">?</span>')}</span><span class="cs-body">${g2Pick(CS_MON)}</span>`;
  st.appendChild(m.el);
  // ganz im Bild starten (das Schild ist breiter als das Monster)
  m.x = Math.min(100, 99 - (m.el.offsetWidth / Math.max(1, st.clientWidth)) * 50);
  m.el.style.left = `${m.x}%`;
  c.mons.push(m);
}
function csRemove(m) { const c = game.cs; c.mons = c.mons.filter((x) => x !== m); m.el.classList.add('gone'); setTimeout(() => m.el.remove(), 400); }
function csKey(k) {
  const c = game.cs;
  if (!c || !runOn()) return;
  c.r3?.key();
  if (k === 'back') c.typed = c.typed.slice(0, -1);
  else if (k === 'ok') { if (c.typed) csTry(true); return; }
  else if (c.typed.length < 3) c.typed += k;
  $('#cstyped').innerHTML = c.typed || CS_EMPTY;
  csTry(false);
}
/** Passt die Eingabe zu einem Monster? Dann feuert die Kanone sofort. */
function csTry(force) {
  const c = game.cs, v = Number(c.typed);
  if (!c.typed) return;
  const hit = c.mons.filter((m) => !m.targeted && !m.dying && m.out !== false && m.t.answer === v).sort((a, b) => a.x - b.x)[0];
  if (hit) {
    recordAnswer(hit.t, v, performance.now() - hit.t.shownAt);
    if (c.r3) c.r3.shoot(hit); else csShoot(hit); // 3D-Version: js/castle3d.js
    c.typed = ''; $('#cstyped').innerHTML = CS_EMPTY;
    if (!c.r3) sfx.good();
    runRight();
    return;
  }
  // passt zu keinem Monster (mehr)? Dann ist die Eingabe falsch – sie wird gelöscht (kostet nichts)
  if (force || !c.mons.some((m) => !m.targeted && m.out !== false && String(m.t.answer).startsWith(c.typed))) {
    const el = $('#cstyped'); el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
    if (c.r3) c.r3.nope(); else tone([200], 0.08, 'square', 0.04);
    c.typed = ''; c.miss = (c.miss || 0) + 1;
    gLater(() => { if ($('#cstyped') && !game.cs.typed) $('#cstyped').innerHTML = CS_EMPTY; }, 350);
  }
}
function csShoot(m) {
  const st = $('#csstage'), cn = $('#cscannon');
  if (!st) return;
  const ball = document.createElement('span');
  ball.className = 'cs-ball';
  const r = st.getBoundingClientRect(), mr = m.el.getBoundingClientRect(), cr = cn.getBoundingClientRect();
  const x0 = cr.left - r.left + cr.width / 2, y0 = cr.top - r.top + cr.height / 2, x1 = mr.left - r.left + mr.width / 2, y1 = mr.top - r.top + mr.height * 0.7;
  ball.style.left = `${x0}px`; ball.style.top = `${y0}px`;
  cn.style.setProperty('--aim', `${Math.atan2(y1 - y0, x1 - x0)}rad`);
  cn.classList.toggle('fire', false); void cn.offsetWidth; cn.classList.add('fire');
  st.appendChild(ball);
  ball.animate([{ transform: 'translate(-50%, -50%)' }, { transform: `translate(calc(-50% + ${(x1 - x0) / 2}px), calc(-50% + ${(y1 - y0) / 2 - 50}px))` }, { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px))` }], { duration: 260, easing: 'ease-in' }).finished.then(() => {
    ball.remove();
    m.el.classList.add('boom');
    sparkle(m.el, 12);
  });
  game.cs.mons = game.cs.mons.filter((x) => x !== m);
  m.v = 0;
  setTimeout(() => m.el.remove(), 700);
}
