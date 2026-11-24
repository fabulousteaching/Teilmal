/* Teilmal – Oberfläche: Rahmen, Startseite, Mein Stand, Dialoge, Einstellungen */
'use strict';

const ICONS = {
  check: '<path d="M5 12.5 10 17 19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  shuffle: '<path d="M3 7h3c4 0 6 10 10 10h5"/><path d="M3 17h3c1.5 0 2.7-1.4 3.7-3.2M14.3 10.2C15.3 8.4 16.5 7 18 7h3"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  flip: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  down: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  keypad: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h4"/>',
  list: '<rect x="3" y="4" width="18" height="4" rx="2"/><rect x="3" y="10" width="18" height="4" rx="2"/><rect x="3" y="16" width="18" height="4" rx="2"/>',
  divide: '<circle cx="12" cy="6" r="1.4"/><circle cx="12" cy="18" r="1.4"/><path d="M5 12h14"/>',
  stairs: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  sheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  back: '<path d="M10 7 5 12l5 5"/><path d="M5 12h9a5 5 0 0 1 0 10h-2"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5h.01M15.5 15.5h.01M12 12h.01M15.5 8.5h.01M8.5 15.5h.01"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const stars = (n, max = 3) => `<span class="stars" aria-label="${n} von ${max} Sternen">${Array.from({ length: max }, (_, i) => `<svg viewBox="0 0 24 24" class="star ${i < n ? 'on' : ''}" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`).join('')}</span>`;

/* Logo: Sprechblase mit × (mal) und : (geteilt). Der Doppelpunkt hat dasselbe Koralle wie «Teil» im Schriftzug. */
const BRAND_BUBBLE = 'M27 12H56a15 15 0 0 1 15 15V42a15 15 0 0 1-15 15H39L22 70l3-13H27a15 15 0 0 1-15-15V27a15 15 0 0 1 15-15z';
const BRAND_SVG = (id = 'bg') => `<svg viewBox="3 11 69 69" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F766E"/><stop offset="1" stop-color="#0E7490"/></linearGradient></defs><path class="bm-back" d="${BRAND_BUBBLE}" fill="#FF6B4A" transform="translate(-5 5) rotate(-7 41 40)"/><path d="${BRAND_BUBBLE}" fill="url(#${id})"/><path d="M23 27l15 15M38 27 23 42" stroke="#fff" stroke-width="6.8" stroke-linecap="round"/><g class="bm-colon" fill="#FF6B4A"><circle cx="54" cy="27.5" r="4.3"/><circle cx="54" cy="41.5" r="4.3"/></g></svg>`;
const BRAND_NAME = '<span class="brand-name"><span class="teil">Teil</span><span class="mal">mal</span></span>';

/* ---------------- Zustand der Oberfläche ---------------- */
const ui = { view: 'home', mode: null, game: null, modal: null, standMode: 'mul', classId: null };

/* ---------------- Rahmen ---------------- */
function renderShell() {
  document.getElementById('app').innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <button class="back-btn" id="back-btn" data-action="back" hidden aria-label="Zurück">${icon('left')}</button>
        <button class="brand" data-action="home" aria-label="Teilmal – zur Startseite">
          <span class="brand-mark" aria-hidden="true">${BRAND_SVG('brandgrad')}</span>
          ${BRAND_NAME}
        </button>
        <nav class="crumbs" id="crumbs" aria-label="Wo du gerade bist"></nav>
        <div class="topbar-actions">
          ${isKid() ? `<span id="av-coin-slot">${typeof avCoinPillHTML === 'function' ? avCoinPillHTML() : ''}</span>` : ''}
          <span id="coin-slot">${coinPillHTML()}</span>
          <span id="account-slot">${accountButtonHTML()}</span>
          ${isKid() || typeof menuButtonHTML !== 'function' ? `<button class="icon-btn" data-action="settings" aria-label="Einstellungen" title="Einstellungen">${icon('sliders')}</button>` : ''}
        </div>
      </div>
    </header>
    <main id="view" class="view" tabindex="-1"></main>
    <div id="toasts" class="toasts" role="status" aria-live="polite"></div>`;
}

function backTarget() {
  const v = ui.view;
  if (v === 'home') return null;
  if (v === 'class') return { view: 'classes', label: 'Zurück zu den Klassen' };
  return { view: 'home', label: 'Zurück zur Startseite' };
}
function updateBackBtn() {
  const b = $('#back-btn');
  if (!b) return;
  const t = backTarget();
  b.hidden = !t;
  $('.topbar')?.classList.toggle('has-back', !!t);
  if (t) { b.setAttribute('aria-label', t.label); b.title = t.label; }
}
function renderCrumbs() {
  updateBackBtn();
  const el = $('#crumbs');
  if (!el) return;
  const sep = '<span class="crumb-sep" aria-hidden="true">/</span>';
  let html = '';
  if (ui.view === 'ex') html = `${sep}<span class="crumb current">${esc(EXERCISE_BY_ID[ui.mode]?.name || '')}</span>`;
  else if (ui.view === 'game') html = `${sep}<span class="crumb current">${esc(GAME_BY_ID[ui.game]?.name || '')}</span>`;
  else if (ui.view === 'stand') html = `${sep}<span class="crumb current">Mein Stand</span>`;
  else if (ui.view === 'avatar') html = `${sep}<span class="crumb current">Mein Avatar</span>`;
  else if (ui.view === 'garage') html = `${sep}<span class="crumb current">Garage</span>`;
  else if (ui.view === 'live') html = `${sep}<span class="crumb current">Live-Spiel</span>`;
  else if (ui.view === 'classes' || ui.view === 'class') html = classesCrumbs();
  el.innerHTML = html;
}

function render() {
  const v = $('#view');
  if (isKid() && ['classes', 'class'].includes(ui.view)) ui.view = 'home';
  const w3 = typeof renderWorld3D === 'function' && webglOK(); // 3D-Welt (js/world3d.js), sonst der 2D-Avatar
  if (ui.view === 'avatar' && !isKid() && !w3) ui.view = 'home';
  if (ui.view === 'garage' && !w3) ui.view = 'home';
  if (ui.view !== 'home') stopHeroFlip();
  renderCrumbs();
  switch (ui.view) {
    case 'ex': renderExercise(); break;
    case 'game': renderGame(); break;
    case 'stand': renderStand(); break;
    case 'classes': renderClasses(); break;
    case 'class': renderClass(); break;
    case 'avatar': if (w3 && !(isKid() && !avatarOn())) renderWorld3D('avatar'); else renderAvatar(); break;
    case 'garage': renderWorld3D('garage'); break;
    case 'live': if (typeof renderLive === 'function') renderLive(); break;
    default: v.innerHTML = viewHome(); bindHome();
  }
}
function go(view, extra = {}) {
  if (ui.view === 'live' && view !== 'live' && typeof liveStop === 'function') liveStop(); // Live-Spiel verlassen
  stopAll();
  Object.assign(ui, extra);
  ui.view = view;
  if (typeof avatarFresh === 'function') avatarFresh(); // z. B. neue Münzensperre der Lehrperson
  render();
  window.scrollTo({ top: 0 });
  $('#view')?.focus({ preventScroll: true });
}
function stopAll() {
  if (typeof stopExercise === 'function') stopExercise();
  if (typeof stopGame === 'function') stopGame();
  if (typeof stopWorld3D === 'function') stopWorld3D();
  stopHeroFlip();
}

/* ---------------- Meldungen ---------------- */
function toast(msg, kind = '') {
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, kind === 'bad' ? 6000 : 3200);
}

/* ---------------- Dialoge ---------------- */
function openModal(html, { cls = '', onClose, label = 'Dialog' } = {}) {
  closeModal(true);
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
  document.body.classList.add('has-modal');
  ui.modal = { el: wrap, onClose, returnFocus: document.activeElement };
  setTimeout(() => (wrap.querySelector('[autofocus]') || wrap.querySelector('input, button'))?.focus(), 40);
  return wrap;
}
function closeModal(silent = false) {
  const m = ui.modal;
  if (!m) return;
  ui.modal = null;
  m.el.remove();
  document.body.classList.remove('has-modal');
  if (!silent) m.onClose?.();
  m.returnFocus?.focus?.({ preventScroll: true });
}
const modalHead = (title) => `<header class="modal-head"><h2>${title}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schliessen">${icon('x')}</button></header>`;

/* ---------------- Konfetti ---------------- */
function confetti() {
  if (reduceMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#FFC233', '#0F766E', '#FF6B4A', '#22C55E', '#38BDF8', '#A855F7', '#F472B6'];
  const parts = Array.from({ length: 150 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.38,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5,
    s: Math.random() * 7 + 5, c: pick(colors), r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, rect: Math.random() < 0.6,
  }));
  let frame = 0;
  (function tick() {
    frame++;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.rect) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (frame < 170) requestAnimationFrame(tick); else c.remove();
  })();
}

/* ---------------- Startseite ---------------- */
let heroTimer = null;
const HERO_FACTS = [[7, 8], [6, 9], [3, 7], [8, 8], [4, 6], [9, 7], [6, 7], [8, 4], [7, 7], [9, 6]];
function heroHTML() {
  const tiles = [[`7${SIGN()}8`, 56], ['54 : 9', 6], [`4${SIGN()}7`, 28]].map(([front, back], i) => `<div class="flip-tile t${i}" data-i="${i}"><div class="flip-in"><span class="ft-front">${front}</span><span class="ft-back">${back}</span></div></div>`).join('');
  return `<div class="hero-art" aria-hidden="true">${tiles}<span class="hero-dots">${'<i></i>'.repeat(12)}</span></div>`;
}
function startHeroFlip() {
  stopHeroFlip();
  if (reduceMotion()) return;
  let k = 0;
  heroTimer = setInterval(() => {
    const tiles = $$('.flip-tile');
    if (!tiles.length) { stopHeroFlip(); return; }
    const t = tiles[k % tiles.length];
    if (t.classList.contains('show')) {
      const [a, b] = pick(HERO_FACTS);
      t.classList.remove('show');
      setTimeout(() => { t.querySelector('.ft-front').textContent = `${a}${SIGN()}${b}`; t.querySelector('.ft-back').textContent = a * b; }, 350);
    } else t.classList.add('show');
    k++;
  }, 1300);
}
function stopHeroFlip() { clearInterval(heroTimer); heroTimer = null; }

const OP_INFO = { mul: ['Mal', () => SIGN()], div: ['Geteilt', () => ':'], gap: ['Lücken', () => '▢'], mix: ['Gemischt', () => '⤨'] };
function reihenPanelHTML() {
  const ps = practiceSettings();
  const cls = typeof kidClassSettings === 'function' ? kidClassSettings() : null;
  const allowed = cls ? (cls.reihen?.length ? cls.reihen : reihenFor(ps.big)) : reihenFor(ps.big);
  const locked = cls && cls.choose === false;
  const modes = ps.avail.length > 1 ? [...ps.avail, 'mix'] : ps.avail;
  const all = allowed.every((r) => ps.reihen.includes(r));
  return `<div class="panel reihen-panel">
    ${cls ? '' : `<div class="size-pick" role="radiogroup" aria-label="Welches Einmaleins?">
      ${[[false, 'Kleines Einmaleins', 'Reihen 1 bis 10'], [true, 'Grosses Einmaleins', 'Reihen 1 bis 20']].map(([big, t, sub]) => `<button type="button" class="size-btn ${big ? 'big' : ''}" data-action="set-size" data-big="${big}" role="radio" aria-checked="${ps.big === big}"><b>${t}</b><small>${sub}</small></button>`).join('')}
    </div>`}
    <div class="rp-head">
      <h2>${cls ? `${ps.big ? 'Grosses' : 'Kleines'} Einmaleins – deine Reihen` : 'Welche Reihen?'}</h2>
      ${locked ? '<p class="hint">Deine Lehrperson hat die Reihen ausgewählt.</p>' : `<button type="button" class="chip" data-action="reihen-quick" data-q="${all ? 'none' : 'all'}">${all ? 'Nur eine' : 'Alle'}</button>`}
    </div>
    <div class="reihen ${ps.big ? 'big' : ''}" role="group" aria-label="Reihen">
      ${reihenFor(ps.big).map((r) => {
        const ok = allowed.includes(r);
        return `<button type="button" class="reihe r${((r - 1) % 10) + 1} ${r > 10 ? 'gross' : ''}" data-action="toggle-reihe" data-r="${r}" aria-pressed="${ps.reihen.includes(r)}" ${!ok || locked ? 'disabled' : ''} aria-label="${r}er-Reihe"><b>${r}</b><small>er</small></button>`;
      }).join('')}
    </div>
    ${modes.length > 1 ? opPickHTML('set-op') : ''}
    ${(() => { if (typeof coinLock !== 'function') return ''; const L = coinLock(ps.reihen, false); return L.locked ? `<p class="coin-lock-note">🔒 ${esc(coinLockText(L))}</p>` : ''; })()}
  </div>`;
}
/** Knöpfe Mal · Geteilt · Lücken · Gemischt (nur die erlaubten). action: set-op (Startseite) oder game-op (Spiel) */
function opPickHTML(action, cls = '') {
  const ps = practiceSettings();
  const kc = typeof kidClassSettings === 'function' ? kidClassSettings() : null;
  const locked = kc && kc.choose === false;
  const modes = ps.avail.length > 1 ? [...ps.avail, 'mix'] : ps.avail;
  if (modes.length < 2) return '';
  return `<div class="op-pick ${cls}" role="radiogroup" aria-label="Was rechnest du?">
      ${modes.map((k) => `<button type="button" class="op-btn op-${k}" data-action="${action}" data-op="${k}" role="radio" aria-checked="${ps.op === k}" ${locked ? 'disabled' : ''}><span class="op-sym" aria-hidden="true">${k === 'mix' ? icon('shuffle') : OP_INFO[k][1]()}</span><span>${OP_INFO[k][0]}</span></button>`).join('')}
    </div>`;
}

function tileHTML(item, kind) {
  const game = kind === 'game';
  const best = game ? (typeof gameBestText === 'function' ? gameBestText(item.id) : null) : db.prog.best[`${kind}:${item.id}`];
  const locked = game && !canPlay();
  return `<button class="tile c-${item.color} ${locked ? 'locked' : ''}" data-action="${game ? 'open-game' : 'open-ex'}" data-id="${item.id}">
    <span class="tile-art" aria-hidden="true">${item.art}</span>
    <span class="tile-text"><strong>${esc(item.name)}</strong><small>${esc(item.desc)}</small></span>
    ${best != null || game ? `<span class="tile-foot">${best != null ? `<span class="tile-best" title="Bestleistung">${icon('trophy')} ${esc(!game && item.bestText ? item.bestText(best) : best)}</span>` : '<span></span>'}
      ${game && !gamesFree() ? `<span class="tile-cost" title="Kostet ${GAME_COST} Münze">${COIN_SVG}${GAME_COST}</span>` : ''}</span>` : ''}
  </button>`;
}
function viewHome() {
  const kidHead = isKid() ? kidHelloHTML() : '';
  const sum = progSummary();
  return `<section class="home">
    ${kidHead || `<div class="hero">
      <div class="hero-text">
        <div class="home-brand"><span class="home-brand-mark" aria-hidden="true">${BRAND_SVG('herograd')}</span><span class="home-brand-text">${BRAND_NAME}<span class="brand-claim">Mal &amp; Geteilt üben</span></span></div>
        <h1>Üben, spielen und <mark>sicher rechnen</mark> – bis das Einmaleins im Schlaf sitzt.</h1>
        <p class="lead">Teilmal merkt sich, welche Rechnungen dir noch Mühe machen, und bringt sie in klugen Abständen wieder – nie stur hintereinander.</p>
        ${cloud.uid ? `<div class="row"><button class="btn primary" data-action="classes">${icon('users')} Meine Klassen & Übersicht</button></div>` : ''}
      </div>
      ${heroHTML()}
    </div>`}
    ${reihenPanelHTML()}
    <div class="section-head"><h2>Üben</h2><p class="hint">Diese Übungen passen sich dir an.</p></div>
    <div class="tiles">${EXERCISES.map((x) => tileHTML(x, 'ex')).join('')}</div>
    <div class="section-head"><h2>Spielen</h2><p class="hint">${gamesFree() ? 'Für Lehrpersonen gratis zum Ausprobieren.' : `Jedes Spiel kostet ${GAME_COST} Münze. Münzen verdienst du beim Üben.`}</p></div>
    ${gamesAllLocked() ? '<p class="empty games-locked">🔒 Deine Lehrperson hat die Spiele gerade gesperrt. Üben geht weiter!</p>' : `<div class="tiles games">${gamesVisible().map((x) => tileHTML(x, 'game')).join('')}</div>`}
    ${typeof liveActions === 'object' ? `<div class="live-strip panel">
      <div><h2>📺 Live in der Klasse</h2><p class="hint">${isKid() ? 'Deine Lehrperson startet ein Live-Spiel am Beamer. Du machst mit dem Code oder QR-Code mit.' : 'Am Beamer starten, die Kinder machen auf ihren Geräten mit (Code oder QR-Code). Gratis, ohne Münzen.'}</p></div>
      <div class="row">${isKid() ? '' : '<button class="btn primary" data-action="live-host" data-kind="bingo">🔢 1×1-Bingo</button><button class="btn primary" data-action="live-host" data-kind="race">🏁 Avatar-Wettrennen</button><button class="btn primary" data-action="live-host" data-kind="build">🏰 Klassen-Bauprojekt</button>'}<button class="btn secondary" data-action="live-join">📲 Live-Spiel beitreten</button></div>
    </div>` : ''}
    <div class="home-grid">
      <div class="panel stand-panel">
        <div class="stats-head"><h2>Mein Stand</h2><button class="btn small secondary" data-action="stand">${icon('chart')} Alles ansehen</button></div>
        ${sum.n ? statTilesHTML(sum) : '<p class="empty">Noch nichts geübt. Leg los – hier siehst du danach, welche Rechnungen schon sitzen.</p>'}
        ${tafelHTML(db.prog, { mode: 'mul', compact: true, big: practiceSettings().big })}
        ${legendHTML()}
      </div>
      <div class="panel focus-panel">
        <h2>Das üben wir noch</h2>
        ${focusListHTML(db.prog)}
        <div class="row"><button class="btn secondary" data-action="my-sheet">${icon('print')} Mein Übungsblatt (PDF)</button></div>
        <p class="hint">Das Blatt enthält vor allem deine schwierigen Rechnungen. Ausdrucken und auf Papier üben.</p>
        ${!cloud.uid && !isKid() ? `<hr><p class="small muted">${icon('users')} Lehrpersonen melden sich oben rechts an: Klassen anlegen, Login-Kärtchen drucken, Übersicht über alle Kinder und persönliche Übungsblätter.</p>` : ''}
      </div>
    </div>
  </section>`;
}
function bindHome() {
  startHeroFlip();
  bindTafel();
}

function statTilesHTML(sum, total = practiceSettings().big ? 300 : 100) {
  const secs = sum.ms ? (sum.ms / 1000).toFixed(1).replace('.', ',') : '–';
  return `<div class="stat-tiles">
    <div class="stat-tile"><b>${sum.n}</b><small>Rechnungen gelöst</small></div>
    <div class="stat-tile"><b>${sum.acc == null ? '–' : Math.round(sum.acc * 100) + ' %'}</b><small>richtig</small></div>
    <div class="stat-tile"><b>${sum.sure}<span class="of">/${total}</span></b><small>sitzen gut</small></div>
    <div class="stat-tile"><b>${secs}<span class="of"> s</span></b><small>pro Rechnung</small></div>
  </div>`;
}
function legendHTML() {
  return `<p class="legend">${['weak', 'shaky', 'ok', 'top', 'none'].map((l) => `<span><i class="lv-${l}"></i>${LEVEL_NAMES[l]}</span>`).join('')}</p>`;
}
function focusListHTML(prog) {
  const hard = hardestKeys(prog, 8);
  if (!hard.length) return `<p class="empty">${prog.q ? 'Super – im Moment macht dir keine Rechnung grosse Mühe.' : 'Sobald du übst, stehen hier die Rechnungen, die noch Mühe machen.'}</p>`;
  return `<ul class="focus-list">${hard.map(({ key, s }) => {
    const k = taskKeyParts(key);
    const ans = k.op === 'div' ? k.a : k.a * k.b;
    const errs = typicalErrors(s);
    return `<li><span class="fl-task">${esc(keyLabel(key))} = <b>${ans}</b></span><span class="fl-info">${s.w}× falsch${errs.length ? ` · oft: ${errs.join(', ')}` : ''}</span></li>`;
  }).join('')}</ul>`;
}

/* ---------------- Einmaleins-Tafel ----------------
   Zeilen = Reihen (1–10 bzw. 1–20), Spalten = mal 1 bis 10. Ein Feld fasst die Rechnung und ihre
   Tauschaufgabe zusammen (3 · 7 und 7 · 3) und zeigt den schwächeren der beiden Stände. */
const LV_ORDER = ['weak', 'shaky', 'ok', 'top'];
function cellKeys(a, b, mode) {
  return mode === 'div' ? [`${a * b}:${b}`, `${a * b}:${a}`] : [`${a}x${b}`, `${b}x${a}`];
}
function mergedLevel(prog, keys) {
  const lvs = [...new Set(keys)].map((k) => levelOf(prog.f[k])).filter((l) => l !== 'none');
  if (!lvs.length) return 'none';
  return LV_ORDER.find((l) => lvs.includes(l));
}
function tafelHTML(prog, { mode = 'mul', compact = false, id = '', big = false } = {}) {
  const rows = reihenFor(big).map((b) => `<tr><th scope="row">${b}</th>${REIHEN_KLEIN.map((a) => {
    const keys = cellKeys(a, b, mode);
    const lv = mergedLevel(prog, keys);
    const label = mode === 'div' ? `${a * b} : ${b} = ${a}` : `${a} ${SIGN()} ${b} = ${a * b}`;
    return `<td><button class="tf lv-${lv}" data-action="tafel-cell" data-key="${keys.join(',')}" ${id ? `data-tafel="${id}"` : ''} title="${label}: ${LEVEL_NAMES[lv]}" aria-label="${label}, ${LEVEL_NAMES[lv]}">${compact ? '' : `<span>${mode === 'div' ? a : a * b}</span>`}</button></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="tafel-wrap ${compact ? 'compact' : ''} ${big ? 'big' : ''}"><table class="tafel" aria-label="Einmaleins-Tafel">
    <thead><tr><th class="corner">${mode === 'div' ? ':' : SIGN()}</th>${REIHEN_KLEIN.map((a) => `<th scope="col">${a}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
let tafelProg = null; // für Klick auf ein Feld (eigener Stand oder der eines Kindes)
function bindTafel(prog = db.prog) { tafelProg = prog; }
function openFactInfo(keyList, prog = tafelProg || db.prog) {
  const keys = [...new Set(String(keyList).split(','))];
  const k = taskKeyParts(keys[0]);
  if (!k) return;
  const stats = keys.map((x) => prog.f[x]).filter((x) => x?.n);
  const n = stats.reduce((x, y) => x + y.n, 0), w = stats.reduce((x, y) => x + y.w, 0);
  const msS = stats.filter((x) => x.ms);
  const ms = msS.length ? msS.reduce((x, y) => x + y.ms, 0) / msS.length : 0;
  const errs = typicalErrors({ e: stats.flatMap((x) => x.e || []) });
  const hist = stats.map((x) => x.h || '').join('').slice(-12);
  const t = makeTask(k.a, k.b, k.op);
  const lv = mergedLevel(prog, keys);
  const title = keys.length > 1 ? `${fullText(t)}` : fullText(t);
  const swap = keys.length > 1 ? (k.op === 'div' ? `${t.p} : ${t.answer} = ${t.b}` : `${t.b} ${SIGN()} ${t.a} = ${t.p}`) : '';
  openModal(`${modalHead(esc(title))}
    ${swap ? `<p class="muted">und die Tauschaufgabe ${esc(swap)}</p>` : ''}
    <p class="fact-level lv-${lv}"><i></i>${LEVEL_NAMES[lv]}</p>
    ${n ? `<div class="stat-tiles small">
      <div class="stat-tile"><b>${n}</b><small>mal geübt</small></div>
      <div class="stat-tile"><b>${w}</b><small>mal falsch</small></div>
      <div class="stat-tile"><b>${ms ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : '–'}</b><small>Zeit</small></div>
    </div>
    ${errs.length ? `<p>Häufige falsche Antworten: <strong>${errs.join(', ')}</strong></p>` : ''}
    ${hist ? `<p class="hist" aria-label="Letzte Versuche">${[...hist].map((x) => `<i class="${x === '1' ? 'ok' : 'bad'}"></i>`).join('')}</p>` : ''}` : '<p class="muted">Noch nicht geübt.</p>'}
    <div class="help-box">${dotFieldSVG(k.a, k.b, { size: k.a > 10 || k.b > 10 ? 10 : 14 })}<p>${esc(strategyText(t))}</p></div>`, { label: title });
}

/* ---------------- Mein Stand (ganze Seite) ---------------- */
function reihenBarsHTML(prog, big = practiceSettings().big) {
  return `<ul class="reihen-bars">${reihenFor(big).map((b) => {
    let sure = 0, weak = 0;
    for (let a = 1; a <= 10; a++) {
      const lv = mergedLevel(prog, cellKeys(a, b, 'mul'));
      if (lv === 'ok' || lv === 'top') sure++;
      if (lv === 'weak') weak++;
    }
    return `<li><span class="rb-name">${b}er</span><span class="rb-bar" aria-hidden="true"><i class="ok" style="width:${sure * 10}%"></i><i class="weak" style="width:${weak * 10}%"></i></span><span class="rb-num">${sure}/10${weak ? ` <small class="warn-text">· ${weak} schwierig</small>` : ''}</span></li>`;
  }).join('')}</ul>`;
}
function renderStand() {
  const v = $('#view');
  const prog = db.prog;
  const sum = progSummary(prog);
  const days = Object.entries(prog.days).sort().slice(-14);
  const maxDay = Math.max(1, ...days.map(([, n]) => n));
  v.innerHTML = `<section class="stand-view">
    <div class="mode-bar"><h1 class="mode-title">Mein Stand</h1>
      <div class="row"><button class="btn secondary" data-action="my-sheet">${icon('print')} Mein Übungsblatt (PDF)</button></div></div>
    ${sum.n ? statTilesHTML(sum) : '<p class="empty">Noch nichts geübt.</p>'}
    <div class="home-grid">
      <div class="panel">
        <div class="stats-head"><h2>Einmaleins-Tafel</h2>
          <div class="seg small" role="tablist">${[['mul', `Mal ${SIGN()}`], ['div', 'Geteilt :']].map(([k, t]) => `<button class="seg-btn" data-action="stand-mode" data-mode="${k}" aria-pressed="${ui.standMode === k}">${t}</button>`).join('')}</div></div>
        <p class="hint">${ui.standMode === 'div' ? 'Zeile = geteilt durch, Spalte = Ergebnis.' : 'Zeile = Reihe, Spalte = mal 1 bis 10 (mit Tauschaufgabe).'} Tippe auf ein Feld für Details und eine Rechenhilfe.</p>
        ${tafelHTML(prog, { mode: ui.standMode, big: practiceSettings().big })}
        ${legendHTML()}
      </div>
      <div class="side-col">
        <div class="panel"><h2>Die Reihen</h2>${reihenBarsHTML(prog)}<p class="hint">Grün = sitzt gut, rot = macht noch Mühe.</p></div>
        <div class="panel"><h2>Das üben wir noch</h2>${focusListHTML(prog)}</div>
        ${days.length ? `<div class="panel"><h2>Geübt</h2><div class="day-bars">${days.map(([d, n]) => `<span class="db" title="${d}: ${n} Rechnungen"><i style="height:${Math.max(6, (n / maxDay) * 100)}%"></i><small>${+d.slice(8)}.${+d.slice(5, 7)}.</small></span>`).join('')}</div><p class="hint">${sum.days} ${sum.days === 1 ? 'Tag' : 'Tage'} geübt · ${Math.round(sum.time / 60000)} Minuten</p></div>` : ''}
      </div>
    </div>
  </section>`;
  bindTafel(prog);
}

/* ---------------- Einstellungen ---------------- */
function openSettings() {
  const s = db.settings;
  const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" class="seg-btn" data-action="set-setting" data-key="${key}" data-val="${v}" aria-pressed="${String(s[key]) === String(v)}">${t}</button>`).join('')}</div>`;
  openModal(`${modalHead('Einstellungen')}
    <div class="settings">
      <div class="field"><span class="label">Malzeichen</span>${seg('sign', [['·', '7 · 8 (Malpunkt)'], ['×', '7 × 8 (Kreuz)']])}</div>
      <label class="switch"><input type="checkbox" id="set-auto" ${s.autoCheck ? 'checked' : ''}><span>Automatisch prüfen, sobald genug Ziffern getippt sind<br><small class="muted">Aus: jede Antwort mit OK bestätigen.</small></span></label>
      <label class="switch"><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}><span>Töne</span></label>
      <div class="field"><span class="label">Darstellung</span>${seg('theme', [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']])}</div>
      ${isKid() ? '' : `<hr><details class="pw-change"><summary>Übungsstand auf diesem Gerät löschen</summary>
        <p class="small muted">Alle gemerkten Rechnungen, Bestleistungen und die Einmaleins-Tafel werden gelöscht.</p>
        <button type="button" class="btn small danger" data-action="reset-prog">Alles löschen</button></details>`}
    </div>`, { label: 'Einstellungen' });
  $('#set-auto').addEventListener('change', (e) => { db.settings.autoCheck = e.target.checked; saveDB(); });
  $('#set-sound').addEventListener('change', (e) => { db.settings.sound = e.target.checked; saveDB(); });
}
