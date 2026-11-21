/* Teilmal – Aktionen und Start */
'use strict';

function refreshReihenPanel() {
  const p = $('.reihen-panel');
  if (!p) { render(); return; }
  p.outerHTML = reihenPanelHTML();
  updateCoinUI();
}

const actions = {
  home: () => go('home'),
  back: () => { const t = backTarget(); if (t) go(t.view); },
  settings: () => (isKid() || typeof openMenu !== 'function' ? openSettings() : openMenu('rechnen')),
  'close-modal': () => closeModal(),
  'set-setting': (el) => {
    db.settings[el.dataset.key] = el.dataset.val;
    $$(`[data-action="set-setting"][data-key="${el.dataset.key}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    if (el.dataset.key === 'theme') applyTheme();
    saveDB();
    if (el.dataset.key === 'sign' && ['home', 'stand'].includes(ui.view)) render();
    if (typeof menuSaved === 'function') menuSaved();
  },
  'reset-prog': () => {
    if (!confirm('Wirklich den ganzen Übungsstand auf diesem Gerät löschen?')) return;
    db.prog = emptyProg(); saveNow(); closeModal(true); go('home'); toast('Übungsstand gelöscht.');
  },
  /* Reihen und Aufgabenarten */
  'set-size': (el) => {
    const big = el.dataset.big === 'true';
    if (db.settings.big === big) return;
    db.settings.big = big;
    // grosses Einmaleins: alle Reihen 1–20 (das kleine ist inbegriffen); zurück zum kleinen: nur Reihen bis 10
    db.settings.reihen = big ? [...REIHEN_GROSS] : (db.settings.reihen.filter((r) => r <= 10).length ? db.settings.reihen.filter((r) => r <= 10) : [...REIHEN_KLEIN]);
    saveDB(); render();
  },
  'toggle-reihe': (el) => {
    const r = +el.dataset.r;
    const cur = new Set(practiceSettings().reihen);
    if (cur.has(r)) { if (cur.size > 1) cur.delete(r); else { toast('Mindestens eine Reihe muss dabei sein.'); return; } } else cur.add(r);
    db.settings.reihen = [...cur].sort((a, b) => a - b);
    saveDB(); refreshReihenPanel();
  },
  'reihen-quick': (el) => {
    const ps = practiceSettings();
    const cls = typeof kidClassSettings === 'function' ? kidClassSettings() : null;
    const allowed = cls?.reihen?.length ? cls.reihen : reihenFor(ps.big);
    db.settings.reihen = el.dataset.q === 'none' ? [allowed.find((r) => r >= 2) || allowed[0]] : [...allowed];
    saveDB(); refreshReihenPanel();
  },
  'set-op': (el) => { db.settings.op = el.dataset.op; saveDB(); refreshReihenPanel(); },
  'game-op': (el) => { db.settings.op = el.dataset.op; saveDB(); renderGame(); },
  'game-mode': (el) => { db.settings.gm = { ...(db.settings.gm || {}), [ui.game]: el.dataset.mode }; saveDB(); renderGame(); },
  'coins-info': () => openCoinsInfo(),
  /* Übungen */
  'open-ex': (el) => { closeModal(true); openExercise(el.dataset.id); },
  'open-game': (el) => openGame(el.dataset.id),
  stand: () => go('stand'),
  'stand-mode': (el) => { ui.standMode = el.dataset.mode; render(); },
  'tafel-cell': (el) => openFactInfo(el.dataset.key),
  'my-sheet': () => openMySheet(),
  'my-sheet-pdf': () => downloadMySheet(),
  'my-sheet-new': () => renderMySheetPreview(),
  pad: (el) => { padPress(el.dataset.k); },
  'ex-hint': () => showExHint(),
  'ex-skip': () => { if (ex.phase === 'fix' || ex.phase === 'done') { ex.i++; nextExTask(); } },
  'ex-choice': (el) => exChoose(el),
  'ex-again': () => (ex.mode === 'reihen' ? startReihe() : renderExercise()),
  'reihe-pick': (el) => { ex.reihe = +el.dataset.r; renderReihenStart(); },
  'reihe-go': () => startReihe(),
  /* Spiele */
  'game-again': () => renderGame(),
  'elf-shoot': (el) => elfShoot(el),
  'meteor-hit': (el) => meteorHit(el),
  'meteor-alien': (el) => meteorAlienHit(el),
  'frog-jump': (el) => frogJump(el),
  'game-start': () => startGameNow(),
  'g3-pick': (el) => game.pick?.(el),
  'mem-flip': (el) => memFlip(el),
  'tf-answer': (el) => tfAnswer(el.dataset.v === '1'),
  'mz-step': (el) => mzStep(+el.dataset.i),
  'tw-answer': (el) => twAnswer(el.dataset.v),
  'sh-cell': (el) => shCell(+el.dataset.r, +el.dataset.c),
  'sh-answer': (el) => shAnswer(el.dataset.v),
  'sh-cancel': () => shCancel(),
  'sh-choose': (el) => shChoose(el.dataset.v),
  'sh-place': (el) => shPlaceAt(+el.dataset.r, +el.dataset.c),
  'sh-rotate': () => shRotate(),
  'sh-rand': () => shRandRest(),
  'sh-reset': () => shResetPlace(),
  'sh-go': () => shStartPlay(),
  'dc-roll': () => dcDoRoll(),
  'dc-reroll': (el) => dcReroll(+el.dataset.i),
  'dc-keep': () => { if (game.dc?.phase === 'decide') dcAsk(); },
  'dc-answer': (el) => dcAnswer(el.dataset.v),
  'dc-next': () => dcRound(),
  'dc-help': () => dcHelp(true),
  'dc-help-close': () => dcHelp(false),
  'cs-key': (el) => csKey(el.dataset.k),
  'g2-key': (el) => game.typeKey?.(el.dataset.k),
  'pz-big': (el) => { db.settings.pzBig = el.dataset.v === '1'; saveDB(); renderGame(); },
  'duel-tap': (el) => duelTap(el),
  'duel-goal': (el) => { db.settings.duelGoal = +el.dataset.v; saveDB(); renderGame(); },
  'kart-track': (el) => { db.settings.kartTrack = el.dataset.v; saveDB(); renderGame(); },
  'run-world': (el) => { db.settings.runWorld = el.dataset.v; saveDB(); renderGame(); },
  /* Konto */
  'login-choose': () => openLoginChooser(),
  login: (el) => openLogin(el.dataset.mode || 'login'),
  'pw-forgot': () => forgotPassword(),
  account: () => openAccount(),
  logout: async () => { closeModal(true); await cloudLogout(); toast('Abgemeldet.'); },
  ...classActions,
  ...(typeof menuActions === 'object' ? menuActions : {}),
};
if (typeof avatarActions === 'object') Object.assign(actions, avatarActions); // Mein Avatar (js/avatar.js, gemeinsam mit Vokaboom)
if (typeof world3dActions === 'object') Object.assign(actions, world3dActions); // 3D-Welt und Garage (js/world3d.js)
if (typeof liveActions === 'object') Object.assign(actions, liveActions); // Live in der Klasse: 1×1-Bingo (js/live.js)


/* Bei schnellen Spielen zählt schon das Antippen (pointerdown), sonst der Klick */
/* Eingabe-Art: Touch-Gerät ohne Tastatur → Joysticks einblenden; sobald Pfeiltasten benutzt werden, wieder ausblenden */
(function inputMode() {
  const root = document.documentElement;
  const coarse = matchMedia('(pointer: coarse)').matches || (matchMedia('(hover: none)').matches && navigator.maxTouchPoints > 0);
  root.classList.toggle('touch', coarse);
  document.addEventListener('keydown', (e) => { if (/^Arrow/.test(e.key) || /^[wasdWASD ]$/.test(e.key)) root.classList.add('kbd'); }, true);
  document.addEventListener('touchstart', () => { root.classList.add('touch'); root.classList.remove('kbd'); }, { passive: true, capture: true });
})();
const FAST = new Set(['g2-key', 'cs-key', 'sh-cell', 'sh-answer', 'dc-answer', 'lq-answer', 'bingo-mark', 'mz-step', 'tw-answer', 'meteor-hit', 'meteor-alien', 'elf-shoot', 'duel-tap', 'frog-jump', 'tf-answer', 'mem-flip', 'pad', 'ex-choice', 'g3-pick']);
let lastFast = { el: null, t: 0 };
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || !FAST.has(el.dataset.action)) return;
  e.preventDefault();
  lastFast = { el, t: performance.now() };
  actions[el.dataset.action]?.(el, e);
});
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  if (FAST.has(a) && lastFast.el === el && performance.now() - lastFast.t < 800) return;
  if (el.tagName === 'A') e.preventDefault();
  actions[a]?.(el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.modal) { e.preventDefault(); closeModal(); }
});
window.addEventListener('hashchange', () => { if (typeof liveFromHash === 'function' && liveFromHash()) return; kidLoginFromHash(); });

function init() {
  kidLoadSession();
  loadDB();
  renderShell();
  render();
  cloudInit().finally(async () => {
    if (typeof liveFromHash === 'function' && liveFromHash()) return; // Live-Spiel über QR-Code
    const handled = await kidLoginFromHash();
    if (handled) return;
    const before = kid.token;
    await kidSsoCheck(); // gemeinsames Anmelden mit Vokaboom
    if (isKid() && kid.token === before) kidRefresh().catch(() => { /* offline: mit dem Stand auf dem Gerät weiter */ });
  });
}
// Kommt man von der alten Adresse, zuerst den mitgebrachten Übungsstand übernehmen (js/umzug.js)
if (window.TEILMAL_UMZUG) window.TEILMAL_UMZUG.finally(init); else init();
