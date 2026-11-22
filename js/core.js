/* Teilmal – Kern: Hilfsfunktionen, Speicher, Aufgaben und das „Gedächtnis“ für schwierige Rechnungen
 *
 * Jede Rechnung hat einen Stand (Kasten 0–5, wie bei einer Lernkartei):
 *  - falsch  → Kasten 0, kommt nach 3–5 anderen Aufgaben wieder (nie direkt hintereinander)
 *  - richtig → einen Kasten weiter, der Abstand bis zum nächsten Mal wächst (4, 9, 18, 35, 70, 140 Aufgaben)
 *  - richtig, aber langsam (über 6 s) → bleibt in einem tiefen Kasten und kommt bald wieder
 * Gezählt wird in gelösten Aufgaben, über alle Übungen und Spiele hinweg. Wer am nächsten Tag wieder übt,
 * bekommt die Rechnungen, die noch Mühe machen, gleich zu Beginn nochmals.
 */
'use strict';

/* ---------------- Hilfsfunktionen ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function debounce(fn, ms) {
  let t = null;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.flush = () => { clearTimeout(t); fn(); };
  return d;
}
function weightedPick(arr, weight) {
  const ws = arr.map(weight);
  const sum = ws.reduce((s, w) => s + w, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Speicher ---------------- */
const MAIN_STORE_KEY = 'einmaleins.db';
let STORE_KEY = MAIN_STORE_KEY;
// Kleines Einmaleins: Reihen 1–10. Grosses Einmaleins: Reihen 1–20 (das kleine ist inbegriffen), jeweils mal 1 bis 10.
const REIHEN_KLEIN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REIHEN_GROSS = Array.from({ length: 20 }, (_, i) => i + 1);
const ALL_REIHEN = REIHEN_GROSS;
const reihenFor = (big) => (big ? REIHEN_GROSS : REIHEN_KLEIN);
const OP_MODES = ['mul', 'div', 'gap', 'mix'];
const DEFAULT_SETTINGS = {
  big: false,            // grosses Einmaleins
  reihen: [...REIHEN_KLEIN],
  op: 'mul',             // mul, div, gap oder mix (gemischt). Tauschaufgaben sind immer dabei.
  sign: '·',             // Malzeichen: · (wie im Schweizer Zahlenbuch) oder ×
  autoCheck: true,       // prüfen, sobald genug Ziffern getippt sind
  sound: true,
  theme: 'auto',
};
const emptyProg = () => ({ v: 1, q: 0, f: {}, days: {}, best: {}, time: 0, at: 0, coins: { c: 0, p: 0, earned: 0, spent: 0 } });
let db = { settings: structuredClone(DEFAULT_SETTINGS), prog: emptyProg() };

function cleanProg(p) {
  const out = emptyProg();
  if (!p || typeof p !== 'object') return out;
  out.q = Number.isFinite(p.q) ? p.q : 0;
  out.time = Number.isFinite(p.time) ? p.time : 0;
  out.at = Number.isFinite(p.at) ? p.at : 0;
  if (p.days && typeof p.days === 'object') Object.entries(p.days).forEach(([k, v]) => { if (/^\d{4}-\d\d-\d\d$/.test(k) && Number.isFinite(v)) out.days[k] = v; });
  if (p.best && typeof p.best === 'object') Object.entries(p.best).forEach(([k, v]) => { if (Number.isFinite(v)) out.best[k] = v; });
  if (p.coins && typeof p.coins === 'object') {
    const n = (x) => (Number.isFinite(+x) && +x > 0 ? +x : 0);
    out.coins = { c: Math.floor(n(p.coins.c)), p: n(p.coins.p), earned: Math.floor(n(p.coins.earned)), spent: Math.floor(n(p.coins.spent)) };
  }
  // letzte automatische Münzensperre (leichte Reihen) – die Lehrperson sieht sie in der Übersicht
  if (p.lock && typeof p.lock === 'object' && Number.isFinite(+p.lock.at) && +p.lock.at > 0) {
    const L = p.lock;
    out.lock = {
      at: +L.at, day: typeof L.day === 'string' && /^\d{4}-\d\d-\d\d$/.test(L.day) ? L.day : '',
      n: Math.max(1, Math.floor(+L.n || 1)), cnt: Math.max(1, Math.floor(+L.cnt || 1)),
      rows: Array.isArray(L.rows) ? L.rows.map(Number).filter((r) => Number.isInteger(r) && r > 0 && r <= 20).slice(0, 20) : [],
    };
  }
  if (p.f && typeof p.f === 'object') {
    Object.entries(p.f).forEach(([k, s]) => {
      if (!/^\d{1,3}[x:]\d{1,2}$/.test(k) || !s || typeof s !== 'object') return;
      out.f[k] = {
        n: +s.n || 0, w: +s.w || 0, b: clamp(+s.b || 0, 0, 5), d: +s.d || 0, t: +s.t || 0, ms: +s.ms || 0,
        h: typeof s.h === 'string' ? s.h.replace(/[^01]/g, '').slice(-10) : '',
        ...(Array.isArray(s.e) ? { e: s.e.map(String).slice(0, 5) } : {}),
      };
    });
  }
  return out;
}
function loadDB() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (d && typeof d === 'object') {
      db.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(d.settings || {}) };
      // ältere Version: mehrere Aufgabenarten als Häkchen → eine Wahl
      if (d.settings?.ops && !d.settings.op) {
        const on = ['mul', 'div', 'gap'].filter((k) => d.settings.ops[k]);
        db.settings.op = on.length === 1 ? on[0] : on.length ? 'mix' : 'mul';
      }
      delete db.settings.ops; delete db.settings.tausch; delete db.settings.roundLen;
      db.prog = cleanProg(d.prog);
    }
  } catch { /* */ }
  if (!OP_MODES.includes(db.settings.op)) db.settings.op = 'mul';
  db.settings.big = !!db.settings.big;
  if (!Array.isArray(db.settings.reihen)) db.settings.reihen = [];
  db.settings.reihen = db.settings.reihen.filter((r) => reihenFor(db.settings.big).includes(r));
  if (!db.settings.reihen.length) db.settings.reihen = [...reihenFor(db.settings.big)];
  applyTheme();
}
function saveNow() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* voll oder privat */ }
  if (typeof onDbSaved === 'function') onDbSaved();
}
const saveDB = debounce(saveNow, 400);
window.addEventListener('pagehide', () => saveDB.flush());

function applyTheme() {
  const t = db.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

/* ---------------- Einstellungen für das Üben ---------------- */
/**
 * Was gerade geübt wird. Mit Klassen-Login gibt die Lehrperson den Rahmen vor
 * (kleines/grosses Einmaleins, erlaubte Reihen und Aufgabenarten, Anzahl Rechnungen pro Runde).
 */
function practiceSettings() {
  const s = db.settings;
  const cls = typeof kidClassSettings === 'function' ? kidClassSettings() : null;
  let big = !!s.big, reihen = [...s.reihen], op = s.op;
  let allowed = { mul: true, div: true, gap: true };
  if (cls) {
    big = !!cls.big;
    const own = (cls.reihen?.length ? cls.reihen : reihenFor(big)).filter((r) => reihenFor(big).includes(r));
    reihen = cls.choose === false ? [...own] : reihen.filter((r) => own.includes(r));
    if (!reihen.length) reihen = [...own];
    allowed = { mul: cls.ops?.mul !== false, div: !!cls.ops?.div, gap: !!cls.ops?.gap };
    if (cls.choose === false) op = 'mix';
  }
  reihen = reihen.filter((r) => reihenFor(big).includes(r));
  if (!reihen.length) reihen = [...reihenFor(big)];
  let avail = ['mul', 'div', 'gap'].filter((k) => allowed[k]);
  if (!avail.length) avail = ['mul'];
  const on = op === 'mix' ? avail : avail.includes(op) ? [op] : [avail[0]];
  const ops = { mul: on.includes('mul'), div: on.includes('div'), gap: on.includes('gap') };
  return {
    big, reihen: reihen.sort((a, b) => a - b), ops, tausch: true,
    op: on.length > 1 ? 'mix' : on[0], avail, roundLen: cls?.roundLen || 20,
  };
}

/* ---------------- Aufgaben ---------------- */
const SIGN = () => (db.settings.sign === '×' ? '×' : '·');
/**
 * Eine Aufgabe. a · b = p  (b ist die Reihe: 3 · 7 gehört zur 7er-Reihe)
 * op: mul (a · b = ?), div (p : b = ?), gapA (? · b = p), gapB (a · ? = p)
 * key: unter diesem Namen merkt sich das Programm den Stand. Lücken zählen zur Malrechnung.
 */
function makeTask(a, b, op = 'mul') {
  const p = a * b;
  const key = op === 'div' ? `${p}:${b}` : `${a}x${b}`;
  const answer = op === 'mul' ? p : op === 'div' ? a : op === 'gapA' ? a : b;
  return { a, b, p, op, key, fact: `${Math.min(a, b)}x${Math.max(a, b)}`, answer };
}
function taskKeyParts(key) {
  let m = key.match(/^(\d+)x(\d+)$/);
  if (m) return { a: +m[1], b: +m[2], op: 'mul' };
  m = key.match(/^(\d+):(\d+)$/);
  if (m) return { a: +m[1] / +m[2], b: +m[2], op: 'div' };
  return null;
}
function keyLabel(key) {
  const k = taskKeyParts(key);
  if (!k) return key;
  return k.op === 'div' ? `${k.a * k.b} : ${k.b}` : `${k.a} ${SIGN()} ${k.b}`;
}
/** Text der Aufgabe als HTML; die Lücke ist ein Kästchen mit der Eingabe */
function taskHTML(t, slot = '<span class="slot">?</span>') {
  const s = `<span class="op">${SIGN()}</span>`, eq = '<span class="op">=</span>', d = '<span class="op">:</span>';
  const n = (x) => `<span class="num">${x}</span>`;
  if (t.op === 'div') return `${n(t.p)}${d}${n(t.b)}${eq}${slot}`;
  if (t.op === 'gapA') return `${slot}${s}${n(t.b)}${eq}${n(t.p)}`;
  if (t.op === 'gapB') return `${n(t.a)}${s}${slot}${eq}${n(t.p)}`;
  return `${n(t.a)}${s}${n(t.b)}${eq}${slot}`;
}
function taskText(t, withAnswer = false) {
  const x = withAnswer ? t.answer : '?';
  if (t.op === 'div') return `${t.p} : ${t.b} = ${x}`;
  if (t.op === 'gapA') return `${x} ${SIGN()} ${t.b} = ${t.p}`;
  if (t.op === 'gapB') return `${t.a} ${SIGN()} ${x} = ${t.p}`;
  return `${t.a} ${SIGN()} ${t.b} = ${x}`;
}
const fullText = (t) => taskText({ ...t, op: t.op === 'div' ? 'div' : 'mul' }, true);

/** Alle Aufgaben, die mit den gewählten Reihen in Frage kommen. kinds: welche Arten erlaubt sind. */
function buildPool(ps = practiceSettings(), kinds = null) {
  const ops = kinds || ps.ops;
  const out = [], seen = new Set();
  const add = (a, b, op) => {
    const id = `${a}x${b}${op}`;
    if (seen.has(id)) return;
    seen.add(id); out.push({ a, b, op });
  };
  for (const b of ps.reihen) {
    for (let a = 1; a <= 10; a++) {
      if (ops.mul) { add(a, b, 'mul'); if (ps.tausch && a !== b) add(b, a, 'mul'); }
      if (ops.div) { add(a, b, 'div'); if (ps.tausch && a !== b) add(b, a, 'div'); }
      if (ops.gap) { add(a, b, 'gapA'); add(a, b, 'gapB'); }
    }
  }
  return out;
}

/* ---------------- Gedächtnis: Stand jeder Rechnung ---------------- */
const BOX_GAP = [4, 9, 18, 35, 70, 140];
const SLOW_MS = 6000;
const statOf = (key, prog = db.prog) => prog.f[key];

/** Wie viel Mühe macht eine Rechnung? 0 = keine, 1 = sehr viel */
function difficulty(s) {
  if (!s || !s.n) return 0;
  const h = s.h || '';
  const recentErr = h.length ? (h.length - h.replace(/0/g, '').length) / h.length : 0;
  const total = s.w / s.n;
  const slow = s.ms ? clamp((s.ms - 3500) / 6500, 0, 1) : 0;
  const box = (5 - s.b) / 5;
  return clamp(0.45 * recentErr + 0.2 * total + 0.15 * slow + 0.2 * box * (s.w ? 1 : 0.3), 0, 1);
}
/** Stufe für die Farben der Einmaleins-Tafel */
function levelOf(s) {
  if (!s || !s.n) return 'none';
  const h = s.h || '';
  const recentErr = h.length ? (h.length - h.replace(/0/g, '').length) / h.length : 0;
  if ((s.b === 0 && s.w) || recentErr >= 0.4) return 'weak';
  if (s.b <= 1 || difficulty(s) >= 0.3) return 'shaky';
  if (s.b >= 4 && (!s.ms || s.ms < SLOW_MS)) return 'top';
  return 'ok';
}
const LEVEL_NAMES = { none: 'noch nicht geübt', weak: 'macht noch Mühe', shaky: 'wackelt noch', ok: 'gut', top: 'sitzt sicher' };

/** Eine Antwort festhalten. Liefert true, wenn sie richtig war. */
function recordAnswer(task, given, ms, prog = db.prog) {
  const ok = Number(given) === task.answer;
  prog.q++;
  const s = prog.f[task.key] || (prog.f[task.key] = { n: 0, w: 0, b: 0, d: 0, t: 0, ms: 0, h: '' });
  const first = !s.n;
  s.n++; s.t = Date.now();
  s.h = (s.h + (ok ? '1' : '0')).slice(-10);
  const msC = clamp(ms || 0, 300, 30000);
  if (ok) {
    s.ms = s.ms ? Math.round(s.ms * 0.65 + msC * 0.35) : msC;
    const slow = msC > SLOW_MS;
    if (first && !slow) s.b = 3;                        // auf Anhieb schnell gewusst: kommt erst später wieder
    else if (!slow || s.b < 1) s.b = Math.min(5, s.b + 1);
    s.d = prog.q + BOX_GAP[s.b] + rand(Math.ceil(BOX_GAP[s.b] / 3) + 1);
  } else {
    s.w++;
    s.b = 0;
    s.d = prog.q + 3 + rand(3);                         // nach 3–5 anderen Aufgaben nochmals
    if (given !== '' && given != null && (task.op === 'mul' || task.op === 'div')) s.e = [String(given), ...(s.e || [])].slice(0, 5);
  }
  const d = today();
  prog.days[d] = (prog.days[d] || 0) + 1;
  prog.time += Math.min(msC, 20000);
  prog.at = Date.now();
  saveDB();
  return ok;
}

/** Beim Start einer Übung: Was länger her ist und noch Mühe macht, ist sofort wieder dran. */
function wakeUpDue(prog = db.prog) {
  const now = Date.now();
  Object.values(prog.f).forEach((s) => {
    const age = now - (s.t || 0);
    if ((s.b <= 2 && s.w && age > 14 * 3600e3) || (s.b >= 3 && age > 6 * 86400e3)) s.d = Math.min(s.d, prog.q);
  });
}

/**
 * Wählt die nächste Aufgabe – wie eine Lernkartei (gilt für alle Übungen und alle Spiele):
 * – Fällige Rechnungen zuerst (ihr Abstand ist erreicht); aus dem vordersten Fach zuerst, darin die schwierigsten.
 *   Falsch beantwortete liegen im vordersten Fach und sind nach 3–5 anderen Aufgaben wieder fällig.
 * – Ist nichts fällig: neue Rechnungen, die noch nie dran waren.
 * – Ist auch nichts neu: die Rechnung, die als nächste fällig wird (vordere Fächer zuerst).
 *   Gut gelernte Rechnungen in den hinteren Fächern kommen also erst wieder, wenn ihre Zeit da ist.
 * – Dieselbe Rechnung (auch als Tauschaufgabe) nie in den letzten 3–4 Aufgaben.
 */
function createPicker(pool) {
  wakeUpDue();
  const recent = [];
  const tasks = pool.map((x) => makeTask(x.a, x.b, x.op));
  return {
    pool: tasks,
    next(filter) {
      const p = db.prog;
      const st = (t) => p.f[t.key];
      const list = filter ? tasks.filter(filter) : tasks;
      const facts = new Set(list.map((t) => t.fact));
      const gap = Math.min(4, Math.max(0, facts.size - 2));
      const avoid = new Set(recent.slice(recent.length - gap));
      let cand = list.filter((t) => !avoid.has(t.fact));
      if (!cand.length) cand = list.filter((t) => t.fact !== recent[recent.length - 1]);
      if (!cand.length) cand = list;
      const due = cand.filter((t) => st(t) && st(t).d <= p.q);
      const fresh = cand.filter((t) => !st(t));
      const urgency = (t) => difficulty(st(t)) + (p.q - st(t).d) / 60;
      let t;
      if (due.length && (!fresh.length || Math.random() < 0.8)) {
        // fällig: vorderstes Fach zuerst, darin die schwierigsten und am längsten fälligen
        due.sort((x, y) => (st(x).b - st(y).b) || (urgency(y) - urgency(x)));
        const front = due.filter((x) => st(x).b === st(due[0]).b);
        t = pick(front.slice(0, Math.min(3, front.length)));
      } else if (fresh.length) {
        t = pick(fresh);
      } else {
        // nichts fällig und nichts neu: was als nächstes fällig wird
        const soon = [...cand].sort((x, y) => (st(x).d - st(y).d) || (st(x).b - st(y).b));
        t = pick(soon.slice(0, Math.min(2, soon.length)));
      }
      recent.push(t.fact);
      if (recent.length > 12) recent.shift();
      return { ...t, shownAt: performance.now() };
    },
  };
}

/* ---------------- Auswahl-Antworten (gute Ablenker) ---------------- */
function swapDigits(n) { const s = String(n); return s.length === 2 && s[0] !== s[1] && s[1] !== '0' ? +(s[1] + s[0]) : null; }
function distractors(t, count = 3) {
  const ans = t.answer;
  const s = db.prog.f[t.key];
  let near, far;
  if (t.op === 'mul') {
    near = [(t.a + 1) * t.b, (t.a - 1) * t.b, t.a * (t.b + 1), t.a * (t.b - 1), ans + 1, ans - 1, swapDigits(ans), ans + 10, ans - 10];
    far = [(t.a + 2) * t.b, t.a * (t.b + 2), (t.a - 2) * t.b, ans + 2, ans - 2, (t.a + 1) * (t.b + 1), (t.a - 1) * (t.b - 1)];
  } else {
    near = [ans + 1, ans - 1, ans + 2, ans - 2];
    far = [ans + 3, ans - 3, t.op === 'gapB' ? t.a : t.b, ans * 2, ans + 4];
  }
  const max = t.op === 'mul' ? 220 : 24;
  const ok = (x) => Number.isInteger(x) && x > 0 && x <= max && x !== ans;
  const out = new Set();
  // eigene frühere Fehler zuerst: genau die Verwechslungen, die das Kind macht
  (s?.e || []).map(Number).filter(ok).slice(0, 1).forEach((x) => out.add(x));
  shuffle(near.filter(ok)).forEach((x) => { if (out.size < count) out.add(x); });
  shuffle(far.filter(ok)).forEach((x) => { if (out.size < count) out.add(x); });
  let k = 1;
  while (out.size < count && k < 50) { const x = ans + (k % 2 ? k : -k); if (ok(x)) out.add(x); k++; }
  return [...out].slice(0, count);
}
function choicesFor(t, n = 4) { return shuffle([t.answer, ...distractors(t, n - 1)]); }

/* ---------------- Hilfen: Punktefeld und Rechenweg ---------------- */
/** Kernaufgaben-Strategie wie im Unterricht: von 1·, 2·, 5·, 10· aus ableiten */
function strategyText(t) {
  const S = SIGN();
  if (t.op === 'div') {
    return `Denk an die Malrechnung: ${t.answer} ${S} ${t.b} = ${t.p}. Also ist ${t.p} : ${t.b} = ${t.answer}.`;
  }
  const a = t.a, b = t.b, p = a * b;
  // Grosses Einmaleins: die Zahl über 10 zerlegen (13 · 7 = 10 · 7 + 3 · 7)
  if (a > 10 && b <= 10) return `${a} ${S} ${b} = 10 ${S} ${b} + ${a - 10} ${S} ${b} = ${10 * b} + ${(a - 10) * b} = ${p}.`;
  if (b > 10 && a <= 10) return `${a} ${S} ${b} = ${a} ${S} 10 + ${a} ${S} ${b - 10} = ${10 * a} + ${a * (b - 10)} = ${p}.`;
  if (a > 10 && b > 10) return `${a} ${S} ${b} = ${p}.`;
  const core = [1, 2, 5, 10];
  // Wenn die Tauschaufgabe einfacher ist, diese zeigen
  if (!core.includes(a) && core.includes(b) && a !== b) return `Tauschaufgabe: ${b} ${S} ${a} = ${p} – das ist dasselbe wie ${a} ${S} ${b}.`;
  if (a === 1) return `1 ${S} ${b} ist einfach ${b}.`;
  if (a === 10) return `10 ${S} ${b}: an die ${b} eine Null hängen → ${p}.`;
  if (a === 2) return `Verdoppeln: ${b} + ${b} = ${p}.`;
  if (a === 5) return `Die Hälfte von 10 ${S} ${b} = ${10 * b}: also ${p}.`;
  if (a === 9) return `10 ${S} ${b} − ${b} = ${10 * b} − ${b} = ${p}.`;
  if (a === 4) return `Doppelt so viel wie 2 ${S} ${b} = ${2 * b}: also ${p}.`;
  if (a === 3) return `2 ${S} ${b} + 1 ${S} ${b} = ${2 * b} + ${b} = ${p}.`;
  if (a === 6 || a === 7 || a === 8) return `5 ${S} ${b} + ${a - 5} ${S} ${b} = ${5 * b} + ${(a - 5) * b} = ${p}.`;
  return `${a} ${S} ${b} = ${p}.`;
}
/** Punktefeld a Reihen × b Punkte, nach 5 eine kleine Lücke (wie am Hunderterfeld) */
function dotFieldSVG(a, b, { size = 16, mark = 0 } = {}) {
  const gap = size * 0.5;
  const pos = (i) => i * size + Math.floor(i / 5) * gap; // nach je 5 Punkten eine kleine Lücke
  const W = pos(b - 1) + size, H = pos(a - 1) + size;
  let dots = '';
  for (let r = 0; r < a; r++) {
    for (let c = 0; c < b; c++) {
      const cls = mark && r < mark ? 'd m' : 'd';
      dots += `<circle class="${cls}" cx="${pos(c) + size / 2}" cy="${pos(r) + size / 2}" r="${size * 0.36}"/>`;
    }
  }
  return `<svg class="dot-field" viewBox="-2 -2 ${W + 4} ${H + 4}" width="${W + 4}" role="img" aria-label="${a} Reihen mit je ${b} Punkten">${dots}</svg>`;
}

/* ---------------- Töne ---------------- */
let audioCtx = null;
function tone(freqs, dur = 0.12, type = 'sine', gain = 0.12) {
  if (!db.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = f;
      const st = t0 + i * dur * 0.85;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(gain, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(st); o.stop(st + dur + 0.03);
    });
  } catch { /* kein Ton */ }
}
const sfx = {
  good: () => tone([660, 990], 0.13, 'triangle', 0.14),
  bad: () => tone([196, 165], 0.16, 'square', 0.045),
  tap: () => tone([540], 0.04, 'sine', 0.05),
  flip: () => tone([540], 0.05, 'sine', 0.05),
  win: () => tone([523, 659, 784, 1047], 0.15, 'triangle', 0.14),
  kick: () => tone([140, 90], 0.08, 'sine', 0.2),
  zap: () => tone([880, 1320, 660], 0.06, 'sawtooth', 0.04),
  boom: () => tone([120, 80, 60], 0.12, 'triangle', 0.18),
  jump: () => tone([400, 600, 800], 0.06, 'sine', 0.08),
  splash: () => tone([300, 180, 120], 0.1, 'sine', 0.08),
  tick: () => tone([1200], 0.03, 'square', 0.02),
};

/** Geräusche mit Rauschen (WebAudio, ohne Dateien): Kanone, Platschen, Explosion, Pfeifen, Horn, Möwen, Meer */
const snd = {
  ac() { if (!db.settings.sound) return null; try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx; } catch { return null; } },
  buf: null,
  noise(ac, dur, loop = false) {
    if (!this.buf || this.buf.sampleRate !== ac.sampleRate) { const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.buf = b; }
    const src = ac.createBufferSource(); src.buffer = this.buf; src.loop = loop || dur > 1.9; return src;
  },
  env(g, t0, peak, a, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); },
  /** gefiltertes Rauschen mit Hüllkurve; f0 → f1 = Filterfrequenz am Anfang/Ende */
  hiss(ac, t0, { type = 'lowpass', f0 = 1000, f1 = f0, q = 0.7, peak = 0.3, a = 0.005, d = 0.3 }) {
    const n = this.noise(ac, a + d + 0.05), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + a + d);
    this.env(g, t0, peak, a, d); n.connect(f).connect(g).connect(ac.destination); n.start(t0, Math.random()); n.stop(t0 + a + d + 0.05);
  },
  osc(ac, t0, { type = 'sine', f0 = 440, f1 = f0, peak = 0.1, a = 0.01, d = 0.2, lp = 0 }) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + a + d);
    this.env(g, t0, peak, a, d);
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f).connect(g); } else o.connect(g);
    g.connect(ac.destination); o.start(t0); o.stop(t0 + a + d + 0.05);
  },
  at(delay, fn) { const ac = this.ac(); if (ac) fn(ac, ac.currentTime + 0.005 + delay); },
  /** Kanonenschuss (far = leiser, weiter weg) */
  cannon(far = false, delay = 0) { this.at(delay, (ac, t) => { const k = far ? 0.45 : 1; this.hiss(ac, t, { f0: 1600, f1: 160, peak: 0.5 * k, d: 0.55 }); this.osc(ac, t, { f0: 130, f1: 36, peak: 0.55 * k, d: 0.4 }); }); },
  /** Pfeifen der fliegenden Kugel */
  whistle(dur = 0.45, delay = 0) { this.at(delay, (ac, t) => this.osc(ac, t, { f0: 1900, f1: 520, peak: 0.035, a: 0.06, d: dur })); },
  /** Platschen ins Wasser */
  splash(delay = 0) { this.at(delay, (ac, t) => { this.hiss(ac, t, { type: 'bandpass', f0: 2600, f1: 500, q: 0.9, peak: 0.32, a: 0.01, d: 0.55 }); this.osc(ac, t, { f0: 700, f1: 140, peak: 0.12, d: 0.18 }); this.hiss(ac, t + 0.12, { type: 'highpass', f0: 3000, peak: 0.06, d: 0.35 }); }); },
  /** Explosion / Treffer (big = versenkt) */
  blast(big = false, delay = 0) {
    this.at(delay, (ac, t) => {
      this.hiss(ac, t, { f0: big ? 2400 : 1800, f1: 90, peak: big ? 0.6 : 0.45, a: 0.004, d: big ? 1.1 : 0.6 });
      this.osc(ac, t, { f0: big ? 95 : 120, f1: 30, peak: big ? 0.6 : 0.45, d: big ? 0.8 : 0.45 });
      this.osc(ac, t + 0.02, { type: 'triangle', f0: 340, f1: 300, peak: 0.07, d: 0.25 }); // Metall
      if (big) for (let i = 0; i < 6; i++) this.hiss(ac, t + 0.15 + Math.random() * 0.6, { type: 'bandpass', f0: 1500 + Math.random() * 1500, q: 2, peak: 0.12, a: 0.002, d: 0.06 });
    });
  },
  /** Blubbern beim Sinken */
  bubbles(delay = 0) { this.at(delay, (ac, t) => { for (let i = 0; i < 7; i++) { const f = 250 + Math.random() * 300; this.osc(ac, t + i * 0.13 + Math.random() * 0.05, { f0: f, f1: f * 2.2, peak: 0.07, d: 0.09 }); } }); },
  /** Schiffshorn */
  horn(low = false, delay = 0) { this.at(delay, (ac, t) => { const f = low ? 82 : 110; [f, f * 1.5].forEach((fr) => this.osc(ac, t, { type: 'sawtooth', f0: fr, f1: fr * 0.98, peak: 0.07, a: 0.08, d: 1.0, lp: 700 })); }); },
  /** Möwe */
  gull(delay = 0) { this.at(delay, (ac, t) => { for (let i = 0; i < 3; i++) { const st = t + i * 0.2; this.osc(ac, st, { type: 'triangle', f0: 1500, f1: 2300, peak: 0.025, a: 0.03, d: 0.06 }); this.osc(ac, st + 0.08, { type: 'triangle', f0: 2200, f1: 1200, peak: 0.022, a: 0.01, d: 0.1 }); } }); },
  /** Würfel schlägt auf (k = Stärke 0–1) */
  clack(k = 1, delay = 0) { this.at(delay, (ac, t) => { this.hiss(ac, t, { type: 'bandpass', f0: 2600, q: 2.5, peak: 0.14 * k, a: 0.002, d: 0.045 }); this.osc(ac, t, { type: 'triangle', f0: 900 + Math.random() * 300, f1: 700, peak: 0.07 * k, a: 0.002, d: 0.05 }); }); },
  /** Holz-Klonk (Schiff setzen) */
  clunk(delay = 0) { this.at(delay, (ac, t) => { this.osc(ac, t, { type: 'triangle', f0: 260, f1: 180, peak: 0.16, a: 0.003, d: 0.12 }); this.hiss(ac, t, { type: 'bandpass', f0: 900, q: 3, peak: 0.08, a: 0.002, d: 0.05 }); }); },
  /** leises Meeresrauschen im Hintergrund; liefert eine Stopp-Funktion */
  sea() {
    const ac = this.ac(); if (!ac) return () => {};
    const n = this.noise(ac, 2, true), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0.028; lfo.frequency.value = 0.13; lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain); n.connect(f).connect(g).connect(ac.destination); n.start(); lfo.start();
    return () => { try { g.gain.setTargetAtTime(0, ac.currentTime, 0.2); n.stop(ac.currentTime + 0.8); lfo.stop(ac.currentTime + 0.8); } catch { /* */ } };
  },
};

/* ---------------- Auswertung des eigenen Stands ---------------- */
function progSummary(prog = db.prog, keys = null) {
  let n = 0, w = 0, facts = 0, sure = 0, weak = 0, msSum = 0, msN = 0;
  Object.entries(prog.f).forEach(([k, s]) => {
    if (keys && !keys.has(k)) return;
    if (!s.n) return;
    facts++; n += s.n; w += s.w;
    const lv = levelOf(s);
    if (lv === 'top' || lv === 'ok') sure++;
    if (lv === 'weak') weak++;
    if (s.ms) { msSum += s.ms; msN++; }
  });
  return { n, w, facts, sure, weak, acc: n ? (n - w) / n : null, ms: msN ? msSum / msN : null, days: Object.keys(prog.days || {}).length, time: prog.time || 0 };
}
/** Die Rechnungen, die am meisten Mühe machen (für Übersicht und Arbeitsblatt) */
function hardestKeys(prog = db.prog, limit = 8, allowed = null) {
  return Object.entries(prog.f)
    .filter(([k, s]) => s.n && (!allowed || allowed(k)) && (s.w || (s.ms && s.ms > SLOW_MS)))
    .map(([k, s]) => ({ key: k, s, d: difficulty(s) }))
    .filter((x) => x.d > 0.12)
    .sort((x, y) => y.d - x.d || y.s.w - x.s.w)
    .slice(0, limit);
}
/** Häufigste falsche Antworten einer Rechnung („54 statt 56“) */
function typicalErrors(s) {
  const cnt = {};
  (s?.e || []).forEach((x) => { cnt[x] = (cnt[x] || 0) + 1; });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([x]) => x).slice(0, 3);
}
