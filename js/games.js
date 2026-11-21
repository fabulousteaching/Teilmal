/* Teilmal – Spiele. Alle holen ihre Rechnungen aus demselben Gedächtnis wie die Übungen:
   Schwierige Rechnungen kommen auch hier in Abständen wieder, und die Antworten zählen mit.

   Spielmodi (Elfmeter, Meteoriten, Frosch, Zielscheibe, Stimmt das?; Memory nur Speed):
   - Countdown: in 60 Sekunden möglichst viele richtige Antworten
   - Survive:   3 Leben, so lange wie möglich durchhalten
   - Speed:     20 richtige so schnell wie möglich; jede falsche verlangt eine Rechnung mehr
   Am Ende: Ergebnis und Bestenliste der Klasse (Top 10, bestes Ergebnis pro Kind, eigener Rang). */
'use strict';

const GAMES = [
  { id: 'elfmeter', name: 'Elfmeter', desc: 'Schiess den Ball durch die richtige Zahl ins Tor!', color: 'green', art: '<span class="emo">⚽</span>', three: true, modes: ['countdown', 'survive', 'speed'],
    howto: 'Im Tor schweben Zahlen. Tippe auf das richtige Ergebnis – der Ball fliegt durch die Zahl ins Netz, die Zahl zerbricht. Bei einer falschen Zahl geht der Schuss daneben.' },
  { id: 'meteor', name: 'Meteoriten', desc: 'Im Cockpit: Schiess den richtigen Meteoriten ab.', color: 'night', art: '<span class="emo">☄️</span>', three: true, modes: ['countdown', 'survive', 'speed'],
    howto: 'Du sitzt im Cockpit deiner Rakete. Meteoriten mit Zahlen rasen auf dich zu. Tippe den mit dem richtigen Ergebnis an, bevor er dich trifft.' },
  { id: 'frog', name: 'Frosch-Hüpfen', desc: 'Hüpf über den Teich – hin und zurück.', color: 'lime', art: '<span class="emo">🐸</span>', three: true, modes: ['countdown', 'survive', 'speed'],
    howto: 'Der Frosch hüpft über den Teich. Tippe auf die Seerose mit dem richtigen Ergebnis – und hopp! Am Ufer springt er auf einen Stein und kehrt um. Falsche Seerosen versinken.' },
  { id: 'target', name: 'Zielscheibe', desc: 'Spann die Armbrust und triff das richtige Feld.', color: 'wood', art: '<span class="emo">🎯</span>', modes: ['countdown', 'survive', 'speed'],
    howto: 'Auf der Zielscheibe stehen vier Zahlen. Lege den Finger irgendwo aufs Bild – die Armbrust wird gespannt. Dann ziele durch Ziehen und lass los – der Pfeil fliegt. Triff das Feld mit dem richtigen Ergebnis!' },
  { id: 'truefalse', name: 'Stimmt das?', desc: 'Richtig oder falsch? Wisch dich durch.', color: 'sun', art: '<span class="emo">✅</span>', modes: ['countdown', 'survive', 'speed'],
    howto: 'Stimmt die Rechnung oder nicht? Wische nach rechts (stimmt) oder links (stimmt nicht). Ist eine Rechnung falsch, siehst du danach immer die richtige.' },
  { id: 'kart', name: 'Turbo-Rennen', desc: 'Kart-Rennen: Fahr durchs richtige Ergebnis – Turbo!', color: 'blue', art: '<span class="emo">🏎️</span>', three: true, modes: ['speed'],
    howto: 'Drei Runden gegen fünf Computer-Fahrer. Wo sich die Strecke teilt, fährst du durch einen ?-Würfel – dann erscheint eine Rechnung. Etwas weiter vorne kommen drei Tore mit Ergebnissen: Fahr durchs richtige! Jede richtige Antwort füllt ein Feld, bei der 4. gibt es Turbo. Ein falsches Tor bremst dich kurz. Tipps: Innen durch die Kurve lädt einen Kurven-Turbo auf, und wer genau bei «LOS!» tippt, hat einen Raketenstart.' },
  { id: 'runner', name: 'Welten-Lauf', desc: 'Renn mit deinem Avatar durch fünf Welten!', color: 'teal', art: '<span class="emo">🏃</span>', three: true, modes: ['survive', 'sudden'],
    howto: 'Du rennst mit deinem Avatar auf drei Spuren. Wisch nach links oder rechts (oder Pfeiltasten), um die Spur zu wechseln, und nach oben zum Springen. Spring über Hürden, auf Blöcke und über Abgründe – wer hineinfällt, verliert ein Leben. Immer wieder kommt eine Rechnung, und über den Spuren schweben Blasen mit Ergebnissen: Lauf unter der richtigen durch! Jede richtige Antwort macht dich ein bisschen schneller. Mit der Zeit kommt Neues dazu: Löcher, hohe Wände (zweimal nach oben wischen = Doppelsprung), rollende Fässer, eine schmale Strasse und Kurven (rechtzeitig nach links oder rechts wischen). Auf nur einer Spur schweben die Ergebnisse übereinander: oben = springen, Mitte = weiterlaufen, unten = nach unten wischen (rutschen). Wie früh die schwierigeren Hindernisse kommen, hängt davon ab, wie sicher du im Training rechnest.' },
  { id: 'maze', name: 'Rechen-Labyrinth', desc: 'Lauf mit deinem Avatar durch den riesigen Heckengarten – durchs richtige Tor!', color: 'purple', art: '<span class="emo">🧭</span>', three: true, modes: ['speed', 'countdown', 'survive'],
    howto: 'Du läufst mit deinem Avatar durch einen riesigen Heckengarten. An jeder Kreuzung erscheint eine Rechnung, und drei magische Tore warten, über jedem ein Ergebnis. Hinter jedem Tor geht ein Gang weiter, aber nur das richtige führt zum Schatz – die Lichtsäule über den Hecken zeigt, wo er ungefähr liegt. Achtung Fallen: Stachelplatten fahren hoch, Falltüren klappen auf, Dornenranken stechen – pass den richtigen Moment ab! In Sackgassen findest du Belohnungen. Die Karte oben rechts zeigt, wo du schon warst. Steuern: Pfeiltasten (↑ gehen, ← → drehen) oder der Joystick.' },
  { id: 'snake', name: 'Zahlen-Schlange', desc: 'Friss das richtige Ergebnis und werde immer länger!', color: 'lime', art: '<span class="emo">🐍</span>', modes: ['sudden'],
    howto: 'Oben steht eine Rechnung, auf dem Feld leuchten drei Zahlen. Lenk die Schlange zur richtigen – sie frisst sie und wird länger. Falsche Zahlen machen sie kürzer. Beisst sie sich mit dem Kopf in den eigenen Körper, ist das Spiel vorbei – je länger sie wird, desto kniffliger! Lenken: Pfeiltasten ↑ ↓ ← → (auch schräg) – die Schlange schwimmt weich in diese Richtung. Auf dem Tablet mit dem Joystick oder Finger aufs Feld halten.' },
  { id: 'puzzle', name: '1×1-Tafel-Puzzle', desc: 'Reihe mal Spalte: Rechne aus, welches Ergebnis in welches Feld gehört!', color: 'purple', art: '<span class="emo">🧩</span>', modes: ['speed'],
    howto: 'Eine leere Einmaleins-Tafel: Nur die Reihen- und Spaltenzahlen stehen da. Einige Felder sind markiert, unten liegen ihre Ergebnisse. Weil keine anderen Ergebnisse in der Tafel stehen, musst du rechnen: Tippe ein markiertes Feld an – Reihe und Spalte leuchten auf – und wähle das passende Ergebnis (oder zieh es hinein). Ein falscher Platz kostet 3 Sekunden.' },
  { id: 'castle', name: 'Burg verteidigen', desc: 'Monster greifen an – tipp ihr Ergebnis, und die Kanone feuert!', color: 'night', art: '<span class="emo">🏰</span>', three: true, modes: ['survive', 'countdown'],
    howto: 'Du stehst oben auf der Burgmauer. Auf vier Wegen laufen Monster auf die Burg zu – über jedem steht eine Rechnung. Tippe das Ergebnis eines Monsters ein (Zahlentasten unten oder Tastatur): Sobald die Zahl stimmt, dreht sich eine Kanone und schiesst es weg. Welches Monster du zuerst abwehrst, entscheidest du. Je mehr du schaffst, desto mehr und schnellere Monster kommen.' },
  { id: 'ships', name: 'Schiffe versenken', desc: 'Rechne das Feld aus – dann darfst du schiessen!', color: 'blue', art: '<span class="emo">🚢</span>', three: true, modes: [], mulOnly: true,
    howto: 'Du und der Computer habt je fünf Schiffe auf einer Einmaleins-Tafel versteckt. Tippe ein Feld auf der gegnerischen Tafel an und rechne es aus (Spalte mal Reihe). Nur wenn du richtig rechnest, wird geschossen: Treffer 💥 – du darfst nochmals. Wasser 💧 – der Computer ist dran. Wer zuerst alle Schiffe versenkt, gewinnt.' },
  { id: 'dice', name: 'Würfel-Duell', desc: 'Zwei Würfel, eine Zielzahl: Wer kommt näher – du oder Robo?', color: 'coral', art: '<span class="emo">🎲</span>', modes: [], mulOnly: true,
    howto: '1. Oben steht die Zielzahl.\n2. Würfle mit zwei Würfeln: einem Zahlen-Würfel (1–10) und einem Reihen-Würfel (deine Reihen).\n3. Gefällt dir ein Würfel nicht? Tippe ihn an – er wird einmal neu geworfen. Sonst tippe «Behalten».\n4. Rechne die beiden Zahlen mal – nur ein richtiges Ergebnis zählt.\n5. Robo 🤖 würfelt auch. Wer näher an der Zielzahl ist, gewinnt die Runde. Wer zuerst 3 Runden hat, gewinnt!' },
  { id: 'memory', name: 'Memory', desc: 'Finde so schnell wie möglich alle Paare.', color: 'pink', art: '<span class="emo">🃏</span>', modes: ['speed'],
    howto: 'Alle Karten liegen offen. Tippe eine Rechnung und dann ihr Ergebnis an – so schnell wie möglich. Ein falsches Paar kostet 3 Sekunden.' },
  { id: 'duel', name: 'Duell zu zweit', desc: 'Zwei Kinder, ein Tablet: Wer ist schneller?', color: 'coral', art: '<span class="emo">⚔️</span>', modes: [],
    howto: 'Legt das Tablet zwischen euch. Wer zuerst das richtige Ergebnis antippt, bekommt den Punkt. Falsch getippt = kurz gesperrt.' },
];
const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

const game = { id: null, timers: [], raf: 0, picker: null, keyHandler: null };
const gLater = (fn, ms) => { const t = setTimeout(fn, ms); game.timers.push(t); return t; };
function stopGame() {
  game.timers.forEach(clearTimeout); game.timers = [];
  cancelAnimationFrame(game.raf); game.raf = 0;
  clearInterval(game.tick); game.tick = null;
  clearInterval(game.runTimer); game.runTimer = null;
  if (game.keyHandler) { document.removeEventListener('keydown', game.keyHandler); game.keyHandler = null; }
  (game.cleanups || []).forEach((f) => { try { f(); } catch { /* */ } }); game.cleanups = [];
  if (game.stage3d) { game.stage3d.dispose(); game.stage3d = null; }
  game.kart = null;
  game.pick = null; game.pickVal = null; game.over = true; game.run = null;
}
function openGame(id) { if (GAME_BY_ID[id]) go('game', { game: id }); }
function gamePicker(kinds = null) {
  const ps = practiceSettings();
  return createPicker(buildPool(ps, kinds));
}
function setGameKeys(fn) {
  if (game.keyHandler) document.removeEventListener('keydown', game.keyHandler);
  game.keyHandler = (e) => { if (ui.view === 'game' && !ui.modal && !e.metaKey && !e.ctrlKey) fn(e); };
  document.addEventListener('keydown', game.keyHandler);
}
function gameResultHTML({ st, title, line, extra = '', again = 'game-again' }) {
  return `<div class="result">${stars(st)}<h2>${title}</h2><p class="result-line">${line}</p>${extra}
    <div class="row center"><button class="btn primary big" data-action="${again}">${icon('flip')} Nochmals</button><button class="btn ghost big" data-action="home">Anderes Spiel</button></div></div>`;
}
/** Funken um ein Element (z. B. gefundenes Memory-Paar) */
function sparkle(el, n = 10) {
  if (reduceMotion() || !el) return;
  const r = el.getBoundingClientRect();
  const cols = ['#FFC233', '#FF6B4A', '#22C55E', '#38BDF8', '#F472B6'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    s.style.background = cols[i % cols.length];
    document.body.appendChild(s);
    const a = (i / n) * Math.PI * 2, d = 40 + Math.random() * 40;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    s.animate([{ transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 }, { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d}px) scale(.2)`, opacity: 0 }], { duration: 600, easing: 'ease-out' }).finished.then(() => s.remove());
  }
}
function gameShell(id, inner, controls = '') {
  const g = GAME_BY_ID[id];
  return `<section class="mode game game-${id} c-${g.color}">
    <div class="mode-bar"><h1 class="mode-title">${esc(g.name)}</h1><div class="mode-controls">${controls}</div></div>
    ${inner}
  </section>`;
}

/* =========================================================
   Spielmodi: gemeinsame Runde (Zeit, Leben, Fortschritt)
   ========================================================= */
const RUN = { ms: 60000, goal: 20, lives: 3 };
const HEART_SVG = '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2 10.6 20C5.4 15.3 2 12.2 2 8.4 2 5.3 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.3 22 8.4c0 3.8-3.4 6.9-8.6 11.6z"/></svg>';
const GAME_MODES = {
  countdown: { name: 'Countdown', icon: () => icon('clock'), short: '60 Sekunden',
    desc: (id) => ({ runner: 'Lauf 60 Sekunden lang durch möglichst viele richtige Bögen. Hindernisse bremsen dich, kosten aber kein Leben.', maze: 'Sanduhr: Du startest mit 60 Sekunden. Jedes richtige Tor +8 s, Sanduhren ⏳ in Sackgassen +5 s; falsches Tor −5 s, Falle −4 s. Wie weit kommst du – schaffst du es bis zum Schatz?', tower: 'Bau in 60 Sekunden einen möglichst hohen Turm.', snake: 'Friss in 60 Sekunden möglichst viele richtige Zahlen.', castle: 'Wehre in 60 Sekunden möglichst viele Monster ab. Ein Monster, das die Burg erreicht, kostet nichts – bringt aber auch keinen Punkt.' }[id] || 'Möglichst viele richtige Antworten in 60 Sekunden. Extrazeit gibt es nicht.') },
  sudden: { name: 'Ein Leben', icon: () => HEART_SVG, short: 'bis zum 1. Fehler',
    desc: (id) => (id === 'snake' ? 'Werde so lang wie möglich! Jede richtige Zahl macht dich länger, falsche Zahlen kürzer. Beisst du dich selbst, ist das Spiel vorbei. Alle 5 richtigen wirst du schneller.'
      : 'Nur ein Leben: Lauf so weit du kannst. Beim ersten Hindernis, Absturz oder falscher Antwort ist es vorbei.') },
  survive: { name: 'Survive', icon: () => HEART_SVG, short: '3 Leben',
    desc: (id) => id === 'runner' ? '3 Leben – lauf so weit wie möglich. Eine falsche Antwort, ein Hindernis oder ein Sturz in einen Abgrund kostet ein Leben. Jede richtige Antwort macht dich ein bisschen schneller.'
      : id === 'maze' ? 'Fallen-Labyrinth: 3 Leben, 24 Tore bis zum Schatz. Stacheln, Falltüren, Dornen und falsche Tore kosten je ein Leben. Herzen ❤️ in Sackgassen geben eines zurück.'
        : id === 'tower' ? '3 Leben – eine falsche Antwort oder ein Block, der danebenfällt, kostet eines. Je höher der Turm, desto schneller schwingt der Kran.'
          : id === 'castle' ? '3 Leben – jedes Monster, das die Burg erreicht, kostet eines. Alle 5 abgewehrten Monster kommen mehr und schnellere.'
          : id === 'snake' ? '3 Leben – eine falsche Zahl oder ein Biss in den eigenen Schwanz kostet eines. Alle 5 richtigen wird die Schlange schneller.' : `3 Leben – halte so lange wie möglich durch. Jede falsche Antwort kostet ein Leben. Alle 5 richtigen kommt ein neues Level, und du hast 10 % weniger Zeit pro Rechnung.${id === 'meteor' ? ' Beim letzten Leben fliegt ab und zu ein Ufo vorbei: Triffst du es, gibt es ein Extraleben.' : ''}` },
  speed: { name: 'Speed', icon: () => icon('bolt'), short: '20 richtige',
    desc: (id) => (id === 'memory' ? 'Finde alle Paare so schnell wie möglich. Ein falsches Paar kostet 3 Sekunden.'
      : id === 'puzzle' ? 'Leg alle Teile so schnell wie möglich an den richtigen Platz. Ein falscher Platz kostet 3 Sekunden.'
      : id === 'maze' ? 'Schnell zum Schatz: 10 Tore, die Zeit zählt. Falsches Tor +3 s, Falle +2 s. Blitze ⚡ in Sackgassen geben Turbo.'
      : id === 'kart' ? 'Drei Runden, so schnell wie möglich. Jede 4. richtige Antwort = Turbo, falsch = kurz langsamer. Deine Zeit kommt in die Bestenliste.'
        : '20 richtige Antworten – so schnell wie möglich. Jede falsche verlangt eine Rechnung mehr.') },
};
const modesOf = (id) => GAME_BY_ID[id]?.modes || [];
function gameModeOf(id) {
  const list = modesOf(id), m = db.settings.gm?.[id];
  return list.includes(m) ? m : list[0];
}
// Turbo-Rennen: seit den neuen Strecken und dem Windschatten eine neue Bestenliste («rennen»)
// Zahlen-Schlange: seit der freien Schlange nur noch «Beiss dich nicht» – eigene Bestenliste («schlange»)
const boardKey = (id, mode, op) => (id === 'runner' && mode === 'sudden' ? `laufeins:survive:${op}` : id === 'snake' ? `schlange:survive:${op}` : `${id === 'kart' ? 'rennen' : id}:${mode}:${op}`);
const boardOf = (id, mode) => boardKey(id, mode, practiceSettings().op);
/** Modi mit Leben: Survive (3) und Ein Leben (1) */
const livesMode = (m) => m === 'survive' || m === 'sudden';
const fmtSec = (ms, d = 1) => (ms / 1000).toFixed(d).replace('.', ',');
const fmtScore = (v, lower) => (lower ? `${fmtSec(v)} s` : String(v));
const runOn = () => !!(game.run && !game.run.done);

function runStart(id, { goal = RUN.goal, onEnd = null } = {}) {
  clearInterval(game.runTimer);
  const mode = gameModeOf(id);
  const lives = mode === 'sudden' ? 1 : RUN.lives;
  game.run = { id, mode, goal, ok: 0, wrong: 0, lives, maxLives: lives, t0: performance.now(), end: 0, pausedAt: 0, done: false, penalty: 0, streak: 0, best: 0, wrongs: [], onEnd };
  game.runTimer = setInterval(runTick, 100);
  return game.run;
}
function runElapsed() {
  const r = game.run;
  if (!r) return 0;
  const now = r.end || r.pausedAt || performance.now();
  return now - r.t0 + r.penalty;
}
const runLeft = () => Math.max(0, RUN.ms - runElapsed());
/** Uhr kurz anhalten (z. B. während die richtige Lösung gezeigt wird) */
function runPause(on) {
  const r = game.run;
  if (!r || r.done) return;
  if (on && !r.pausedAt) r.pausedAt = performance.now();
  else if (!on && r.pausedAt) { r.t0 += performance.now() - r.pausedAt; r.pausedAt = 0; }
}
function runTick() {
  if (!runOn()) return;
  if (game.run.mode === 'countdown' && runLeft() <= 0) { runFinish('time'); return; }
  runHud();
}
/** Anzeige: Leben (Survive), Zeit (Countdown/Speed) und richtige Antworten */
function runHudHTML(cls = '') {
  const r = game.run;
  if (!r) return '';
  const m = r.mode;
  return `<div class="run-hud ${cls} m-${m}">
    ${livesMode(m) ? `<span class="run-lives" data-run="lives" aria-label="Leben">${HEART_SVG.repeat(r.maxLives)}</span>` : ''}
    ${livesMode(m) || r.id === 'meteor' ? '<span class="run-level" data-run="levelbox">Level <b data-run="level">1</b><em class="run-levelup" data-run="levelup">schneller!</em></span>' : ''}
    ${m === 'countdown' ? `<span class="run-clock"><span class="run-bar"><i data-run="bar"></i></span><b data-run="time">${RUN.ms / 1000}</b><small>s</small></span>` : ''}
    ${m === 'speed' ? `<span class="run-clock">${icon('clock')}<b data-run="time">0,0</b><small>s</small></span>` : ''}
    <span class="run-ok" data-run="okbox">${icon('check')}<b data-run="ok">0</b>${m === 'speed' ? `<small>/${r.goal}</small>` : ''}</span>
  </div>`;
}
function runHud() {
  const r = game.run;
  if (!r) return;
  $$('[data-run="ok"]').forEach((el) => { el.textContent = r.ok; });
  if (r.mode === 'countdown') {
    const left = runLeft();
    $$('[data-run="time"]').forEach((el) => { el.textContent = Math.ceil(left / 1000); });
    $$('[data-run="bar"]').forEach((el) => { el.style.transform = `scaleX(${Math.min(1, left / RUN.ms)})`; el.parentNode.classList.toggle('low', left < 10000); });
  } else if (r.mode === 'speed') $$('[data-run="time"]').forEach((el) => { el.textContent = fmtSec(runElapsed()); });
  $$('[data-run="lives"]').forEach((el) => [...el.children].forEach((h, i) => h.classList.toggle('off', i >= r.lives)));
  $$('[data-run="level"]').forEach((el) => { el.textContent = surviveLevel(); });
  game.onRunHud?.(r);
}
const runPop = (sel, cls) => $$(sel).forEach((el) => { el.classList.toggle(cls, false); void el.offsetWidth; el.classList.add(cls); });
/** Richtige Antwort (auf Anhieb). Liefert true, wenn die Runde damit fertig ist (Speed: Ziel erreicht). */
function runRight() {
  const r = game.run;
  if (!runOn()) return true;
  r.ok++; r.streak++; r.best = Math.max(r.best, r.streak);
  runHud();
  runPop('[data-run="okbox"]', 'pop');
  if (r.mode === 'speed' && r.ok >= r.goal) { runFinish('done'); return true; }
  // Survive: alle 5 richtigen ein neues Level – ab jetzt bleibt etwas weniger Zeit
  // (Meteoriten werden in allen Modi pro Level schneller)
  if ((livesMode(r.mode) || r.id === 'meteor') && r.ok % SURVIVE.step === 0) {
    runPop('[data-run="levelbox"]', 'up');
    tone([660, 880, 1175], 0.07, 'triangle', 0.07);
  }
  return false;
}
/** Falsche Antwort oder zu spät. Survive: kostet ein Leben. Liefert true, wenn die Runde damit fertig ist. */
function runWrong(t = null) {
  const r = game.run;
  if (!runOn()) return true;
  r.wrong++; r.streak = 0;
  if (t) r.wrongs.push(t);
  if (livesMode(r.mode)) {
    r.lives--;
    $$('[data-run="lives"]').forEach((el) => { const h = el.children[r.lives]; if (h) { h.classList.toggle('lost', false); void h.getBoundingClientRect(); h.classList.add('lost'); } });
    runHud();
    if (r.lives <= 0) { runFinish('lives'); return true; }
  } else {
    runHud();
    runPop('[data-run="okbox"]', 'miss');
  }
  return false;
}
function runGainLife() {
  const r = game.run;
  if (!runOn()) return;
  r.lives = Math.min(r.maxLives, r.lives + 1);
  runHud();
  $$('[data-run="lives"]').forEach((el) => { const h = el.children[r.lives - 1]; if (h) { h.classList.toggle('gain', false); void h.getBoundingClientRect(); h.classList.add('gain'); } });
}
/* Survive: Alle 5 richtigen Antworten kommt ein neues Level, und die Zeit pro Rechnung wird 10 % kürzer.
   Es gibt keine feste Untergrenze ausser der Zeit, die man mindestens zum Lesen und Tippen braucht –
   so geht auch eine sehr gute Runde nach ein paar Minuten zu Ende. */
const SURVIVE = { step: 5, factor: 0.9 };
const surviveLevel = () => Math.floor((game.run?.ok || 0) / SURVIVE.step) + 1;
/** Zeit für eine Rechnung im aktuellen Level (start: Level 1, min: kürzest mögliche Zeit) */
const surviveMs = (start, min) => Math.max(min, start * SURVIVE.factor ** (surviveLevel() - 1));
function taskClock(el, ms, onTimeout) {
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, fill: 'forwards' });
  clearTimeout(game.taskT);
  game.taskT = gLater(onTimeout, ms);
}
function taskClockStop(el) {
  clearTimeout(game.taskT);
  el?.getAnimations().forEach((a) => a.pause());
}
function runFinish(why) {
  const r = game.run;
  if (!runOn()) return;
  runPause(false);
  r.done = true; r.end = performance.now(); r.why = why;
  clearInterval(game.runTimer);
  game.over = true;
  try { r.onEnd?.(why); } catch (e) { console.warn(e); }
  if (why === 'time') { sfx.bad(); tone([880, 660, 440], 0.12, 'triangle', 0.08); }
  setTimeout(() => { if (game.run === r && ui.view === 'game') showRunResult(r); }, why === 'time' ? 500 : 1000);
}

/* ---------------- Ergebnis und Bestenliste ---------------- */
// Sterne: [1, 2, 3 Sterne]; Speed in Sekunden (weniger ist besser)
const STAR_LIMITS = {
  countdown: { elfmeter: [6, 11, 16], meteor: [6, 11, 16], frog: [6, 11, 16], target: [6, 11, 16], truefalse: [12, 22, 32], runner: [4, 7, 10], maze: [6, 11, 16], tower: [4, 8, 12], snake: [5, 9, 14], castle: [8, 14, 20] },
  survive: { elfmeter: [6, 12, 20], meteor: [6, 12, 20], frog: [6, 12, 20], target: [6, 12, 20], truefalse: [10, 20, 35], runner: [5, 10, 18], maze: [5, 10, 18], tower: [5, 10, 18], snake: [5, 10, 18], castle: [8, 16, 26] },
  sudden: { runner: [3, 7, 12], snake: [5, 10, 18] },
  speed: { elfmeter: [140, 100, 75], meteor: [140, 100, 70], frog: [150, 110, 80], target: [150, 105, 80], truefalse: [90, 60, 40], memory: [80, 50, 32], puzzle: [150, 100, 65], maze: [230, 165, 120] },
};
function runStars(r, score) {
  const l = STAR_LIMITS[r.mode]?.[r.id];
  if (!l) return 1;
  if (r.mode === 'speed') { const s = score / 1000; return s <= l[2] ? 3 : s <= l[1] ? 2 : s <= l[0] ? 1 : 0; }
  return score >= l[2] ? 3 : score >= l[1] ? 2 : score >= l[0] ? 1 : 0;
}
const localBestKey = (board) => `b:${board}`;
/** Persönlicher Rekord für die Kachel und die Startkarte (aktuelle Aufgabenart, gewählter Modus) */
function gameBestText(id) {
  const mode = gameModeOf(id);
  if (!mode) return null;
  const v = db.prog.best[localBestKey(boardOf(id, mode))];
  if (v == null) return null;
  return `${id === 'kart' ? 'Bestzeit' : GAME_MODES[mode].name}: ${mode === 'speed' ? `${fmtSec(v)} s` : `${v} richtig`}`;
}
function showRunResult(r) {
  stopGame();
  const lower = r.mode === 'speed';
  const score = lower ? Math.round(r.end - r.t0 + r.penalty) : r.ok;
  const board = boardOf(r.id, r.mode);
  const key = localBestKey(board), old = db.prog.best[key];
  const valid = lower ? r.ok >= r.goal : score > 0;
  const rec = valid && (old == null || (lower ? score < old : score > old));
  if (rec) { db.prog.best[key] = score; saveDB(); }
  const st = runStars(r, score);
  if (st >= 2 || rec) { sfx.win(); confetti(); }
  const title = { time: 'Zeit ist um!', lives: r.id === 'snake' ? 'Autsch – in dich selbst gebissen!' : 'Keine Leben mehr!', done: r.id === 'memory' ? 'Alle Paare gefunden!' : r.id === 'puzzle' ? 'Puzzle fertig!' : r.id === 'maze' ? 'Schatz gefunden! 💎' : 'Geschafft!' }[r.why] || 'Fertig!';
  const line = lower
    ? `${r.id === 'memory' ? `${r.goal} Paare` : r.id === 'puzzle' ? `${r.goal} Teile` : `${r.goal} richtige`} in <b>${fmtSec(score)} s</b>${r.wrong ? ` · ${r.wrong} falsch` : ' · ohne Fehler'}`
    : `<b>${r.ok}</b> ${(typeof g2Noun === 'function' && g2Noun(r.id, r.ok)) || (r.ok === 1 ? 'richtige Antwort' : 'richtige Antworten')}${r.mode === 'countdown' ? (r.id === 'maze' ? (r.why === 'done' ? ' – Schatz erreicht!' : ', bevor die Sanduhr ablief') : ' in 60 Sekunden') : ''}${livesMode(r.mode) ? ` · <b>Level ${Math.floor(r.ok / SURVIVE.step) + 1}</b> erreicht` : ''}${r.wrong ? ` · ${r.wrong} falsch` : ''}`;
  const wrongs = [...new Map(r.wrongs.map((t) => [t.key + t.op, t])).values()].slice(0, 8);
  $('#view').innerHTML = gameShell(r.id, `<div class="run-result">
      <div class="result">
        <p class="run-mode-tag">${GAME_MODES[r.mode].icon()} ${GAME_MODES[r.mode].name} · ${esc(OP_INFO[practiceSettings().op][0])}</p>
        ${stars(st)}<h2>${title}</h2><p class="result-line">${line}</p>
        ${rec && old != null ? '<p class="pill good">Neuer persönlicher Rekord!</p>' : old != null ? `<p class="muted small">Dein Rekord: ${fmtScore(old, lower)}</p>` : ''}
        ${r.best >= 5 ? `<p class="muted small">Längste Serie: ${r.best} richtige hintereinander</p>` : ''}
        ${wrongs.length ? `<div class="mistakes"><p class="label">Merk dir</p><ul>${wrongs.map((t) => `<li><span class="m-task">${esc(taskText(t, true))}</span></li>`).join('')}</ul></div>` : ''}
        <div class="row center"><button class="btn primary big" data-action="game-again">${icon('flip')} Nochmals</button><button class="btn ghost big" data-action="home">Anderes Spiel</button></div>
      </div>
      <div class="board-card" id="board"><div class="board-head"><h3>${icon('trophy')} Bestenliste</h3></div><p class="muted"><span class="spinner"></span> wird geladen …</p></div>
    </div>`);
  fillBoard(r, board, valid ? score : null);
}
function boardHeadHTML(id, mode, op) {
  return `<div class="board-head"><h3>${icon('trophy')} Bestenliste</h3><span class="muted small">${esc(GAME_BY_ID[id].name)} · ${GAME_MODES[mode].name} · ${esc(OP_INFO[op][0])}</span></div>`;
}
async function fillBoard(r, board, score) {
  const el = $('#board');
  if (!el) return;
  const head = boardHeadHTML(r.id, r.mode, practiceSettings().op);
  if (!isKid() || !kid.token) {
    el.innerHTML = `${head}<p class="muted">${cloud.uid ? 'Die Bestenliste ist für die Kinder deiner Klassen. Du findest sie in der Klassenübersicht.' : 'Mit dem Login deiner Klasse siehst du hier die Bestenliste deiner Klasse.'}</p>`;
    return;
  }
  try {
    const c = await cloudClient();
    const { data, error } = await c.rpc('einmaleins_score', { p_token: kid.token, p_board: board, p_score: score });
    if (error) throw error;
    if ($('#board') === el) el.innerHTML = head + boardListHTML(data, { kid: true });
  } catch (e) {
    console.warn('Bestenliste', e);
    if ($('#board') === el) el.innerHTML = `${head}<p class="muted">Die Bestenliste ist gerade nicht erreichbar.</p>`;
  }
}
/** Top 10 der Klasse (bestes Ergebnis pro Kind); dazu der eigene Rang, auch wenn man nicht unter den ersten 10 ist */
function boardListHTML(data, { kid: forKid = false } = {}) {
  const lower = !!data?.lower;
  const top = data?.top || [];
  if (!top.length) return `<p class="muted">${forKid ? 'Noch keine Einträge – sei die oder der Erste!' : 'Noch keine Einträge.'}</p>`;
  const medal = (n) => (n <= 3 ? `<span class="b-medal m${n}">${n}</span>` : `<span class="b-rank">${n}</span>`);
  const rows = top.map((x) => `<li class="${x.me ? 'me' : ''}">${medal(x.rank)}<span class="b-name">${esc(x.name)}${x.me ? ' <em>(du)</em>' : ''}</span><span class="b-score">${fmtScore(x.score, lower)}</span></li>`).join('');
  const me = data.me;
  const meRow = forKid && me && me.rank > 10 ? `<li class="me sep"><span class="b-rank">${me.rank}</span><span class="b-name">Du</span><span class="b-score">${fmtScore(me.score, lower)}</span></li>` : '';
  const meLine = forKid ? (me ? `<p class="board-me">Dein Rang: <b>${me.rank}</b> von ${data.total}</p>` : '<p class="board-me muted">Du bist noch nicht auf der Liste.</p>') : '';
  return `<ol class="board-list">${rows}${meRow}</ol>${meLine}<p class="muted small">${esc(data.class || '')} · ${data.total} ${data.total === 1 ? 'Kind' : 'Kinder'} mit Ergebnis</p>`;
}

/* ---------------- Startkarte: Modus, Aufgabenart und Münze ---------------- */
function gateOptionsHTML(id) {
  const seg = (action, cur, list) => `<div class="seg">${list.map(([v, t]) => `<button class="seg-btn" data-action="${action}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join('')}</div>`;
  if (id === 'maze') { let st = 1; try { st = runnerSkill().stage; } catch { /* */ } return `<p class="gate-type ${st >= 3 ? 'on' : ''}">${st >= 3 ? `⏱️ Du rechnest im Training schon sicher – darum läuft an den Toren ein Zeitbalken (${[0, 0, 0, 12, 10, 8.5][st]} s). Zu langsam zählt wie ein falsches Tor.` : '🧘 An den Toren hast du so viel Zeit, wie du brauchst. Wer im Training sehr sicher rechnet, bekommt einen Zeitbalken.'}</p>`; }
  if ((id === 'ships' || id === 'dice') && typeof g2Typing === 'function') return `<p class="gate-type ${g2Typing() ? 'on' : ''}">${g2Typing() ? '⌨️ Du rechnest im Training schon sehr sicher – darum tippst du die Ergebnisse hier <b>selbst ein</b>.' : '👆 Du wählst aus 4 Ergebnissen. Wer im Training sehr sicher rechnet, tippt die Ergebnisse selbst ein.'}</p>`;
  if (id === 'duel') return seg('duel-goal', db.settings.duelGoal || 10, [[5, 'bis 5'], [10, 'bis 10'], [15, 'bis 15']]);
  if (id === 'puzzle' && typeof pzBig === 'function') return `<p class="label">Tafel</p>${seg('pz-big', pzBig() ? 1 : 0, [[0, 'Kleines 1×1 (10 × 10)'], [1, 'Grosses 1×1 (20 × 10)']])}`;
  if (id === 'runner' && typeof w3RunWorldsHTML === 'function') {
    const sk = runnerSkill();
    const pct = (x) => `${Math.round(x * 100)} %`;
    const why = sk.n < RUN_SKILL_MIN ? 'Je sicherer du im Training rechnest, desto anspruchsvoller startet der Lauf.'
      : `Im Training rechnest du ${pct(sk.quote)} richtig, ${pct(sk.sure)} deiner Rechnungen sitzen sicher. ${sk.stage > 1 ? 'Darum kommen schon früh schwierigere Hindernisse.' : 'Der Lauf startet gemütlich – so kannst du dich aufs Rechnen konzentrieren.'}`;
    return `<p class="label">Welt</p>${w3RunWorldsHTML(runWorldId())}${typeof w3RunStartHTML === 'function' ? w3RunStartHTML(sk.stage, why) + w3RunRulesHTML('Ergebnis') : ''}`;
  }
  if (id === 'kart' && typeof KART_TRACKS === 'object') {
    const cur = kartTrackId();
    return `<p class="label kart-track-label">Strecke</p><div class="kart-tracks" role="radiogroup" aria-label="Strecke">${KART_TRACKS.map((t) => `<button type="button" class="kart-track t-${t.id}" data-action="kart-track" data-v="${t.id}" role="radio" aria-checked="${t.id === cur}"><span aria-hidden="true">${t.emo}</span><b>${esc(t.name)}</b></button>`).join('')}</div>`;
  }
  return '';
}
function gateModesHTML(id) {
  const list = modesOf(id);
  if (!list.length) return '';
  const cur = gameModeOf(id);
  const best = gameBestText(id);
  const pick = list.length > 1 ? `<div class="mode-pick" role="radiogroup" aria-label="Spielmodus">${list.map((m) => `<button type="button" class="mode-btn m-${m}" data-action="game-mode" data-mode="${m}" role="radio" aria-checked="${m === cur}"><span class="mode-ic" aria-hidden="true">${GAME_MODES[m].icon()}</span><b>${GAME_MODES[m].name}</b><small>${GAME_MODES[m].short}</small></button>`).join('')}</div>`
    : `<p class="mode-one"><span class="mode-ic" aria-hidden="true">${GAME_MODES[cur].icon()}</span><b>${GAME_MODES[cur].name}</b></p>`;
  return `${pick}<p class="mode-desc">${esc(GAME_MODES[cur].desc(id))}${best ? ` <span class="mode-best">${icon('trophy')} Dein Rekord: ${esc(best.split(': ')[1])}</span>` : ''}</p>`;
}
/** Was gerechnet wird: Reihen in Kurzform */
function gateReihenText() {
  const ps = practiceSettings();
  const all = reihenFor(ps.big);
  const r = ps.reihen;
  const list = r.length === all.length ? `alle Reihen (1–${ps.big ? 20 : 10})` : r.length === 1 ? `${r[0]}er-Reihe` : `Reihen ${r.join(', ')}`;
  return `${ps.big ? 'Grosses' : 'Kleines'} Einmaleins · ${list}`;
}
function renderGame() {
  stopGame();
  game.id = ui.game;
  game.over = false;
  const g = GAME_BY_ID[ui.game];
  if (!g) return;
  const have = playCoins();
  const free = gamesFree(), can = canPlay();
  const opts = gateOptionsHTML(g.id);
  $('#view').innerHTML = `<section class="mode game gate c-${g.color}">
    <div class="gate-card">
      <span class="gate-art" aria-hidden="true">${g.art}</span>
      <h1>${esc(g.name)}</h1>
      <p class="gate-how">${esc(g.howto)}</p>
      ${gateModesHTML(g.id)}
      ${g.mulOnly ? '<p class="gate-reihen-text muted small">Hier wird immer mal gerechnet (Spalte · Reihe).</p>' : opPickHTML('game-op', 'gate-ops')}
      <p class="gate-reihen-text muted small">${esc(gateReihenText())}</p>
      ${opts ? `<div class="gate-opts">${opts}</div>` : ''}
      ${(g.id === 'kart' || g.id === 'runner') && !webglOK() ? '<div class="gate-need"><p><b>Dieses Spiel braucht 3D-Grafik.</b><br>Auf diesem Gerät geht das leider nicht. Probier ein anderes Spiel!</p></div>'
    : can ? `<button class="btn primary big gate-go" data-action="game-start">${icon('play')} ${free ? 'Spielen' : `Spielen für ${COIN_SVG} ${GAME_COST} Münze`}</button>
        <p class="muted small">${free ? 'Für Lehrpersonen gratis zum Ausprobieren.' : `Du hast ${have} ${have === 1 ? 'Münze' : 'Münzen'}.`}</p>`
    : `<div class="gate-need">${COIN_SVG}<p><b>Dir fehlt noch eine Münze.</b><br>Münzen verdienst du beim Üben: für jede richtige Antwort gibt es Punkte. ${coinThreshold()} Punkte = 1 Münze.</p></div>
        <button class="btn primary big" data-action="open-ex" data-id="trainer">${icon('keypad')} Zum Trainer</button>`}
      ${g.id === 'kart' && webglOK() && typeof renderWorld3D === 'function' ? '<button class="btn secondary" data-action="garage-open">🔧 Garage: dein Kart gestalten</button>' : ''}
      ${g.id === 'runner' && webglOK() && typeof renderWorld3D === 'function' && isKid() ? '<button class="btn secondary" data-action="avatar-open">🧍 Deinen Avatar gestalten</button>' : ''}
      <button class="btn ghost" data-action="home">Zurück</button>
    </div>
  </section>`;
}
const START_2D = { castle: () => startCastle(), ships: () => startShips(), dice: () => startDice(), maze: () => startMaze(), tower: () => startTower(), snake: () => startSnake(), puzzle: () => startPuzzle(), elfmeter: () => startElfmeter(), meteor: () => startMeteor(), frog: () => startFrog(), target: () => startTarget(), memory: () => startMemory(), truefalse: () => startTrueFalse(), duel: () => startDuel(),
  kart: () => { toast('Das Rennen konnte nicht starten. Probier es nochmals.', 'bad'); renderGame(); },
  runner: () => { toast('Der Welten-Lauf konnte nicht starten. Probier es nochmals.', 'bad'); renderGame(); } };
const START_3D = { ships: async () => { const T = await w3Three(); if (typeof sh3Mount !== 'function') await w3Script('js/ships3d.js'); return startShips({ three: T }); }, castle: async () => { if (typeof startCastle3D !== 'function') await w3Script('js/castle3d.js'); return startCastle3D(); }, maze: async () => { if (typeof startMaze3D !== 'function') await w3Script('js/maze3d.js'); return startMaze3D(); }, tower: async () => { if (typeof startTower3D !== 'function') await w3Script('js/tower3d.js'); return startTower3D(); }, elfmeter: () => startElfmeter3D(), meteor: () => startMeteor3D(), frog: () => startFrog3D(), kart: () => startKart3D(), runner: () => startRunner3D() };

/* =========================================================
   🏃 Welten-Lauf (3D, mit dem eigenen Avatar; Spiel in js/runner3d.js, Welten in js/runworlds.js)
   Survive: 3 Leben – falsche Antwort, Hindernis oder Sturz kostet eines; alle 5 richtigen schneller.
   Countdown: 60 Sekunden; Hindernisse bremsen nur.
   ========================================================= */
const runWorldId = () => ((typeof RUN_WORLD_INFO === 'object' && RUN_WORLD_INFO.some((w) => w.id === db.settings.runWorld)) ? db.settings.runWorld : 'jungle');
/**
 * Start-Stufe aus dem Trainingsstand der gerade gewählten Rechnungen: Quote (je Rechnung die letzten 10 Antworten)
 * und Anteil sicherer Rechnungen. Stufe 1 = Start wie gewohnt, höhere Stufen bringen die neuen Hindernisse früher.
 * Nie leichter als Stufe 1; unter RUN_SKILL_MIN Antworten immer Stufe 1.
 */
const RUN_SKILL_MIN = 30;
function runnerSkill(prog = db.prog) {
  let n = 0, ok = 0, sure = 0;
  try {
    const keys = new Set(buildPool(practiceSettings()).map((x) => makeTask(x.a, x.b, x.op).key));
    keys.forEach((k) => { const h = prog.f[k]?.h || ''; n += h.length; ok += h.replace(/0/g, '').length; });
    sure = masteryNow(prog);
  } catch (e) { console.warn('Start-Stufe', e); }
  const quote = n ? ok / n : 0;
  let stage = 1;
  if (n >= RUN_SKILL_MIN) {
    if (quote >= 0.95 && sure >= 0.85) stage = 5;
    else if (quote >= 0.9 && sure >= 0.65) stage = 4;
    else if (quote >= 0.85 && sure >= 0.45) stage = 3;
    else if (quote >= 0.75 && sure >= 0.25) stage = 2;
  }
  return { stage, quote, sure, n, start: (typeof W3_RUN_START === 'object' ? W3_RUN_START : [0, 4, 8, 12, 16])[stage - 1] };
}
async function startRunner3D() {
  await w3LoadRunner();
  Object.assign(game, { picker: gamePicker(), over: false, cleanups: game.cleanups || [] });
  let run = null;
  const r = runStart('runner', { onEnd: () => { try { run?.stop(); } catch { /* */ } } });
  runPause(true); // die Uhr läuft erst nach dem Countdown
  $('#view').innerHTML = gameShell('runner', `<div id="rnwrap"></div>
    <p class="mode-hint">Wischen oder Pfeiltasten: ← → Spur wechseln (auf einer Spur: abbiegen), ↑ springen, in der Luft nochmals ↑ = Doppelsprung, ↓ rutschen. Kurz tippen geht auch: links/rechts aussen = Spur, Mitte = springen.</p>`);
  const host = $('#rnwrap');
  game.stage3d = { dispose: () => { try { run?.dispose(); } catch (e) { console.warn(e); } } };
  const lose = () => { // Hindernis oder Sturz: Survive kostet ein Leben (zählt nicht als falsche Antwort)
    if (!runOn() || !livesMode(r.mode)) return false;
    r.lives--;
    $$('[data-run="lives"]').forEach((el) => { const h = el.children[r.lives]; if (h) { h.classList.toggle('lost', false); void h.getBoundingClientRect(); h.classList.add('lost'); } });
    runHud();
    if (r.lives <= 0) { runFinish('lives'); return true; }
    return false;
  };
  run = await runnerStart(host, {
    world: runWorldId(),
    look: typeof a3Mine === 'function' ? a3Mine() : null,
    hudHTML: runHudHTML('rn-hud'),
    sound: !!db.settings.sound,
    gateEvery: 76,
    startLevel: runnerSkill().start, // wer im Training sicher rechnet, bekommt früher schwierigere Hindernisse
    speed: (n) => Math.min(14.5, 8.8 + n * 0.18), // jede richtige Antwort ein bisschen schneller
    ask: () => {
      const t = game.picker.next();
      const vals = choicesFor(t, 3);
      return { html: taskHTML(t, '<span class="slot">?</span>'), answers: vals.map(String), correct: vals.indexOf(t.answer), solved: esc(taskText(t, true)), t, vals };
    },
    onAnswer: (ok, q, lane) => {
      if (!runOn()) return { over: true };
      recordAnswer(q.t, q.vals[lane], 3000);
      if (ok) return { over: runRight() };
      return { over: runWrong(q.t) };
    },
    onHit: () => ({ over: lose() }),
    onStart: () => runPause(false),
  });
  // inzwischen weggegangen (z. B. Zurück gedrückt)? Dann gleich wieder aufräumen
  if (game.run !== r || ui.view !== 'game') run.dispose();
}
async function startGameNow() {
  if (game.paying) return;
  if (!gamesFree() && kidWallet() && typeof w3PayGame === 'function') {
    // ein Konto: mit den Münzen aus der Datenbank bezahlen (offline: mit denen auf dem Gerät)
    game.paying = true;
    let r;
    try { r = await w3PayGame(GAME_COST, `spiel ${ui.game}`); } finally { game.paying = false; }
    if (r === 'poor') { toast('Dir fehlt noch eine Münze. Üben bringt Münzen!'); renderGame(); return; }
    if (r === 'local' && !payForGame()) { renderGame(); return; }
    if (r === 'ok') { const c = coinsOf(); if (c.c >= GAME_COST) { c.c -= GAME_COST; c.spent += GAME_COST; saveDB(); } updateCoinUI(); }
  } else if (!payForGame()) { renderGame(); return; }
  const id = ui.game;
  game.over = false;
  game.onRunHud = null;
  if (START_3D[id] && webglOK()) {
    $('#view').innerHTML = `<section class="mode game gate"><div class="gate-card"><span class="spinner big"></span><p>Die 3D-Welt wird geladen …</p></div></section>`;
    try { await START_3D[id](); return; } catch (e) { console.warn('3D nicht möglich, 2D-Version', e); stopGame(); game.over = false; }
  }
  START_2D[id]?.();
}

/* =========================================================
   ⚽ Elfmeter (2D-Version, wenn kein WebGL da ist)
   ========================================================= */
const BALL_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#1F2937" stroke-width="2"/><path d="M20 12l7 5-2.7 8h-8.6L13 17z" fill="#1F2937"/><path d="M20 12V3.5M27 17l8-3M24.3 25l5 7M15.7 25l-5 7M13 17l-8-3" stroke="#1F2937" stroke-width="2"/></svg>`;
function startElfmeter() {
  Object.assign(game, { picker: gamePicker(), locked: false });
  if (db.settings.sound && typeof loadCheer === 'function') loadCheer(); // Torjubel vorladen
  const r = runStart('elfmeter');
  $('#view').innerHTML = gameShell('elfmeter', `
    ${runHudHTML('bar-hud')}
    <div class="pitch" id="pitch">
      <div class="task-board" id="eboard"></div>
      <div class="goal" id="goal"><div class="net"></div><div class="targets" id="targets"></div></div>
      <div class="spot"></div>
      <div class="ball" id="ball">${BALL_SVG}</div>
      ${r.mode === 'survive' ? '<div class="shot-clock" id="sclock"><i></i></div>' : ''}
      <div class="pitch-msg" id="pmsg"></div>
    </div>
    <p class="mode-hint">Tippe auf das Tor-Eck mit dem richtigen Ergebnis.</p>`,
  '');
  setGameKeys((e) => { if (/^[1-3]$/.test(e.key)) { const b = $$('.target')[+e.key - 1]; if (b) elfShoot(b); } });
  elfNext();
}
function elfNext() {
  if (!runOn()) return;
  const t = game.picker.next();
  game.task = t; game.locked = false;
  t.shownAt = performance.now();
  $('#eboard').innerHTML = `<span class="task small">${taskHTML(t)}</span>`;
  $('#targets').innerHTML = choicesFor(t, 3).map((o, i) => `<button class="target z${i}" data-action="elf-shoot" data-v="${o}" data-z="${i}">${o}</button>`).join('');
  const ball = $('#ball');
  ball.getAnimations().forEach((a) => a.cancel());
  ball.className = 'ball';
  $('#goal').classList.remove('shake');
  $('#pmsg').className = 'pitch-msg';
  if (game.run.mode === 'survive') taskClock($('#sclock i'), surviveMs(7000, 1800), () => elfShoot(null));
}
function elfShoot(btn) {
  if (game.locked || !runOn()) return;
  game.locked = true;
  taskClockStop($('#sclock i'));
  const t = game.task;
  const v = btn ? btn.dataset.v : '';
  const ok = recordAnswer(t, v, performance.now() - t.shownAt);
  const targets = $$('.target');
  const right = targets.find((b) => Number(b.dataset.v) === t.answer);
  const ball = $('#ball'), goal = $('#goal');
  const aim = btn || targets[rand(targets.length)];
  const br = ball.getBoundingClientRect(), ar = aim.getBoundingClientRect(), gr = goal.getBoundingClientRect();
  let dx = ar.left + ar.width / 2 - (br.left + br.width / 2), dy = ar.top + ar.height / 2 - (br.top + br.height / 2);
  // Falsch: Mitte → an die Latte, links/rechts → an den Pfosten
  const zone = +(aim.dataset.z ?? 1);
  const miss = ok ? null : zone === 1 ? 'bar' : 'post';
  if (miss === 'bar') dy = gr.top - (br.top + br.height / 2) + 4;
  if (miss === 'post') dx = (zone === 0 ? gr.left + 4 : gr.right - 4) - (br.left + br.width / 2);
  sfx.kick();
  const anim = !reduceMotion();
  const fly = ball.animate([{ transform: 'translate(-50%, 0) scale(1) rotate(0)' }, { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.5) rotate(540deg)` }], { duration: anim ? 560 : 1, easing: 'cubic-bezier(.2,.75,.35,1)', fill: 'forwards' });
  if (miss && anim) fly.finished.then(() => { // Abpraller zurück ins Feld
    ball.animate([{ transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.5) rotate(540deg)` }, { transform: `translate(calc(-50% + ${dx * (miss === 'post' ? 1.35 : 0.6)}px), ${dy * 0.35}px) scale(.8) rotate(760deg)` }], { duration: 520, easing: 'ease-out', fill: 'forwards' });
    tone([1568, 2093, 1760], 0.09, 'triangle', 0.09);
  }).catch(() => {});
  gLater(() => {
    const msg = $('#pmsg');
    let ended;
    if (ok) {
      if (typeof crowdCheer === 'function') crowdCheer(); else sfx.win(); // Tor: das Publikum jubelt
      $('#goal').classList.add('shake');
      msg.innerHTML = 'TOR!';
      msg.className = 'pitch-msg show good';
      ended = runRight();
    } else {
      sfx.bad();
      msg.innerHTML = `${!btn ? 'Zu spät!' : miss === 'bar' ? 'Latte!' : 'Pfosten!'}<small>${esc(taskText(t, true))}</small>`;
      msg.className = 'pitch-msg show bad';
      right?.classList.add('right');
      ended = runWrong(t);
    }
    btn?.classList.add(ok ? 'right' : 'wrong');
    if (!ended) gLater(elfNext, ok ? 650 : 1300);
  }, anim ? 560 : 50);
}

/* =========================================================
   ☄️ Meteoriten (2D-Version)
   ========================================================= */
const ROCKET_SVG = `<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M32 4c12 10 16 26 14 44H18C16 30 20 14 32 4z" fill="#E5E7EB"/><path d="M32 4c6 5 10 12 12 20H20c2-8 6-15 12-20z" fill="#FF6B4A"/><circle cx="32" cy="34" r="6" fill="#38BDF8" stroke="#0E7490" stroke-width="2.5"/><path d="M18 40 6 56l12-2zM46 40l12 16-12-2z" fill="#FF6B4A"/><path d="M22 48h20l-3 8H25z" fill="#9CA3AF"/><path class="flame" d="M26 56h12l-6 18z" fill="#FFC233"/></svg>`;
function startMeteor() {
  Object.assign(game, { picker: gamePicker(), wave: [], task: null, over: false, recorded: false, last: 0, alienT: 0 });
  runStart('meteor');
  $('#view').innerHTML = gameShell('meteor', `
    <div class="space" id="space">
      <div class="stars-bg"></div>
      <div class="hud">${runHudHTML('dark')}</div>
      <div class="ship-wrap"><div class="ship-task" id="mtask"></div><div class="ship" id="ship">${ROCKET_SVG}</div></div>
      <div class="ground"></div>
    </div>
    <p class="mode-hint">Tippe den Meteoriten mit dem richtigen Ergebnis an, bevor er auf dem Boden landet.</p>`);
  gLater(meteorWave, 500);
  game.last = performance.now();
  game.raf = requestAnimationFrame(meteorLoop);
}
function meteorWave() {
  if (!runOn()) return;
  const space = $('#space');
  if (!space) return;
  game.wave.forEach((m) => m.el.remove());
  const t = game.picker.next();
  game.task = t; game.recorded = false;
  $('#mtask').innerHTML = `<span class="task small">${taskHTML(t)}</span>`;
  const n = game.run.ok >= 12 ? 4 : 3;
  const opts = choicesFor(t, n);
  const W = space.clientWidth, H = space.clientHeight;
  const lane = W / n;
  const dur = surviveMs(9000, 2000) / 1000; // Sekunden bis zum Boden: alle 5 richtigen 10 % schneller (in allen Modi)
  game.wave = opts.map((v, i) => {
    const el = document.createElement('button');
    el.className = 'meteor';
    el.dataset.action = 'meteor-hit';
    el.dataset.v = v;
    el.innerHTML = `<span>${v}</span>`;
    el.style.setProperty('--rot', `${rand(360)}deg`);
    space.appendChild(el);
    const size = 78;
    const x = lane * i + (lane - size) / 2 + (Math.random() - 0.5) * Math.max(0, lane - size - 10);
    return { el, x, y: -size * 0.4 - rand(70), v: (H * 0.8) / dur * (0.9 + Math.random() * 0.25), val: v, correct: v === t.answer, dead: false, size };
  });
  game.wave.forEach((m) => { m.el.style.transform = `translate(${m.x}px, ${m.y}px)`; });
  game.task.shownAt = performance.now();
}
function meteorLoop(now) {
  const dt = Math.max(0, Math.min(0.05, (now - game.last) / 1000));
  game.last = now;
  const space = $('#space');
  if (!space || !runOn()) return;
  const groundY = space.clientHeight - 150;
  for (const m of game.wave) {
    if (m.dead) continue;
    m.y += m.v * dt;
    m.el.style.transform = `translate(${m.x}px, ${m.y}px)`;
    if (m.y > groundY && m.correct) { meteorLand(m); break; }
    if (m.y > groundY + 40) { m.dead = true; m.el.classList.add('gone'); }
  }
  game.raf = requestAnimationFrame(meteorLoop);
}
function meteorHit(el) {
  if (!runOn()) return;
  const m = game.wave.find((x) => x.el === el);
  if (!m || m.dead) return;
  const t = game.task;
  if (!game.recorded) { recordAnswer(t, m.correct ? m.val : m.val, performance.now() - t.shownAt); game.recorded = true; }
  laser(m);
  if (m.correct) {
    m.dead = true;
    sfx.zap();
    el.classList.add('boom');
    game.wave.forEach((x) => { if (x !== m) { x.dead = true; x.el.classList.add('gone'); } });
    if (!runRight()) gLater(meteorWave, 650);
  } else {
    el.classList.add('wrong');
    game.wave.find((x) => x.correct)?.el.classList.add('hint');
    meteorMiss(m, false);
  }
}
function laser(m) {
  const space = $('#space'), ship = $('#ship');
  if (!space || !ship) return;
  const sr = space.getBoundingClientRect(), pr = ship.getBoundingClientRect();
  const x1 = pr.left + pr.width / 2 - sr.left, y1 = pr.top - sr.top;
  const x2 = m.x + m.size / 2, y2 = m.y + m.size / 2;
  const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const l = document.createElement('i');
  l.className = 'laser';
  l.style.cssText = `left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${ang}deg)`;
  space.appendChild(l);
  setTimeout(() => l.remove(), 260);
  ship.style.setProperty('--tilt', `${clamp((x2 - x1) / 12, -20, 20)}deg`);
}
function meteorLand(m) {
  const t = game.task;
  if (!game.recorded) { recordAnswer(t, '', performance.now() - t.shownAt); game.recorded = true; }
  m.el.classList.add('landed');
  meteorMiss(m, true);
}
/** Meteorit gelandet (crash) oder falschen angetippt: zählt als falsch (Survive: ein Leben weniger) */
function meteorMiss(m, crash) {
  const t = game.task;
  m.dead = true;
  if (crash) sfx.boom(); else sfx.bad();
  game.wave.forEach((x) => { if (!x.dead) { x.dead = true; if (crash || !x.correct) x.el.classList.add('gone'); } });
  const space = $('#space');
  space.classList.add('hit');
  const note = document.createElement('div');
  note.className = 'meteor-note';
  note.textContent = taskText(t, true);
  space.appendChild(note);
  setTimeout(() => { space.classList.remove('hit'); note.remove(); }, 1600);
  if (runWrong(t)) return;
  if (game.run.mode === 'survive' && game.run.lives === 1) meteorAlienSchedule(2600 + Math.random() * 1500);
  gLater(meteorWave, crash ? 1500 : 1700);
}
/* Ufo (nur Survive): kommt beim letzten Leben und ist schwer zu treffen; Treffer = Extraleben */
function meteorAlienSchedule(ms) {
  clearTimeout(game.alienT);
  game.alienT = gLater(() => {
    if (!runOn() || game.run.lives !== 1) return;
    meteorAlien();
    meteorAlienSchedule(7000 + Math.random() * 4000);
  }, ms);
}
function meteorAlien() {
  const space = $('#space');
  if (!space || space.querySelector('.alien')) return;
  const el = document.createElement('button');
  el.className = 'alien';
  el.dataset.action = 'meteor-alien';
  el.setAttribute('aria-label', 'Ufo');
  el.textContent = '🛸';
  space.appendChild(el);
  const W = space.clientWidth, H = space.clientHeight;
  const ltr = Math.random() < 0.5;
  const y0 = 30 + Math.random() * H * 0.4;
  const frames = Array.from({ length: 9 }, (_, i) => {
    const u = i / 8;
    const x = ltr ? -50 + (W + 100) * u : W + 50 - (W + 100) * u;
    return { transform: `translate(${x}px, ${y0 + Math.sin(u * Math.PI * 4) * 40}px) rotate(${Math.sin(u * Math.PI * 4) * 14}deg)` };
  });
  el.animate(frames, { duration: 2300 + Math.random() * 700, easing: 'linear', fill: 'forwards' }).finished.then(() => { if (!el.classList.contains('boom')) el.remove(); }).catch(() => {});
  tone([520, 780, 520, 780, 1040], 0.07, 'sine', 0.05);
}
function meteorAlienHit(el) {
  if (!runOn() || el.classList.contains('boom')) return;
  el.getAnimations().forEach((a) => a.pause());
  el.classList.add('boom');
  setTimeout(() => el.remove(), 520);
  runGainLife();
  clearTimeout(game.alienT);
  sfx.win();
  tone([660, 880, 1175, 1568], 0.09, 'triangle', 0.08);
  const note = document.createElement('div');
  note.className = 'meteor-note good';
  note.textContent = '+1 Leben – Extraleben!';
  $('#space')?.appendChild(note);
  setTimeout(() => note.remove(), 1400);
}

/* =========================================================
   🐸 Frosch-Hüpfen (2D-Version)
   ========================================================= */
function startFrog() {
  Object.assign(game, { picker: gamePicker(), tries: 0, locked: false });
  const r = runStart('frog');
  $('#view').innerHTML = gameShell('frog', `
    <div class="frog-top"><div class="frog-task" id="ftask"></div>${runHudHTML()}</div>
    ${r.mode === 'survive' ? '<div class="shot-clock frog-clock" id="fclock"><i></i></div>' : ''}
    <div class="pond" id="pond">
      <div class="ripples" id="ripples"></div>
      <div class="pads" id="pads"></div>
      <div class="home-pad" id="homepad"><span class="frog" id="frog">🐸</span></div>
    </div>
    <p class="mode-hint">Tippe auf die Seerose mit dem richtigen Ergebnis – der Frosch hüpft hinüber.</p>`,
  '');
  frogStep();
}
function frogStep() {
  if (!runOn()) return;
  const t = game.picker.next();
  game.task = { ...t, shownAt: performance.now() };
  game.tries = 0;
  game.locked = false;
  $('#ftask').innerHTML = `<span class="task small">${taskHTML(t)}</span>`;
  $('#pads').innerHTML = choicesFor(t, 3).map((v, i) => `<button class="lily p${i} grow" style="--d:${i * 70}ms" data-action="frog-jump" data-v="${v}"><span>${v}</span></button>`).join('');
  if (game.run.mode === 'survive') taskClock($('#fclock i'), surviveMs(8000, 2200), () => frogTimeout());
}
function frogTimeout() {
  if (!runOn() || game.locked) return;
  game.locked = true;
  const t = game.task;
  if (game.tries === 0) recordAnswer(t, '', performance.now() - t.shownAt);
  sfx.splash();
  $$('#pads .lily').forEach((b) => { b.disabled = true; b.classList.add(Number(b.dataset.v) === t.answer ? 'right' : 'sink'); });
  if (!runWrong(t)) gLater(frogStep, 1200);
}
function frogJump(btn) {
  if (game.locked || btn.disabled || !runOn()) return;
  const t = game.task;
  const v = Number(btn.dataset.v);
  const first = game.tries === 0;
  game.tries++;
  if (first) recordAnswer(t, v, performance.now() - t.shownAt);
  if (v !== t.answer) {
    sfx.splash();
    btn.classList.add('sink');
    btn.disabled = true;
    if (first) runWrong(t);
    else if (game.run.mode === 'survive') runWrong(t);
    return;
  }
  taskClockStop($('#fclock i'));
  game.locked = true;
  sfx.jump();
  const frog = $('#frog'), home = $('#homepad');
  const fr = frog.getBoundingClientRect(), br = btn.getBoundingClientRect(), hr = home.getBoundingClientRect();
  const dx = br.left + br.width / 2 - (fr.left + fr.width / 2), dy = br.top + br.height / 2 - (fr.top + fr.height / 2);
  btn.classList.add('right');
  $$('#pads .lily').forEach((b) => { if (b !== btn) { b.disabled = true; b.classList.add('sink'); } });
  const fast = reduceMotion();
  frog.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx / 2}px, ${dy / 2 - 70}px) scale(1.35)` }, { transform: `translate(${dx}px, ${dy}px) scale(1)` }], { duration: fast ? 1 : 520, easing: 'ease-in-out', fill: 'forwards' });
  const ended = first ? runRight() : false;
  if (ended) return;
  // Nachrutschen: Die neue Seerose wird zum neuen Platz des Froschs, davor tauchen neue Seerosen auf
  gLater(() => {
    const mx = hr.left + hr.width / 2 - (br.left + br.width / 2), my = hr.top + hr.height / 2 - (br.top + br.height / 2);
    const opt = { duration: fast ? 1 : 480, easing: 'ease-in-out', fill: 'forwards' };
    btn.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${mx}px, ${my}px)` }], opt);
    frog.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: `translate(${dx + mx}px, ${dy + my}px)` }], opt);
    home.animate([{ transform: 'translateX(-50%)', opacity: 1 }, { transform: `translate(-50%, ${hr.height}px)`, opacity: 0 }], opt);
    $('#ripples')?.animate([{ backgroundPosition: '0 0' }, { backgroundPosition: `0 ${-my}px` }], opt);
    gLater(() => {
      [frog, home].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
      frogStep();
    }, fast ? 20 : 500);
  }, fast ? 20 : 560);
}

/* =========================================================
   🎯 Zielscheibe: Armbrust spannen, zielen, das richtige Feld treffen
   Finger aufs Bild legen, durch Ziehen zielen, loslassen = Schuss. Vier Felder mit Zahlen.
   ========================================================= */
const TG_QUADS = ['tl', 'tr', 'bl', 'br'];
// Mitte jedes Viertels (Schwerpunkt des Viertelkreises mit Radius 88: 4·88/(3π) ≈ 37,4 vom Mittelpunkt)
const TG_POS = { tl: [62.6, 62.6], tr: [137.4, 62.6], bl: [62.6, 137.4], br: [137.4, 137.4] };
const TG_TARGET_SVG = `<svg viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="tgStraw" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#F0C873"/><stop offset=".75" stop-color="#C98B3F"/><stop offset="1" stop-color="#9A6428"/></radialGradient>
    <pattern id="tgStrawLines" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 3h6" stroke="#8A5A22" stroke-width="1" opacity=".35"/></pattern>
  </defs>
  <circle cx="100" cy="100" r="98" fill="url(#tgStraw)"/>
  <circle cx="100" cy="100" r="98" fill="url(#tgStrawLines)"/>
  <circle cx="100" cy="100" r="98" fill="none" stroke="#6B4320" stroke-width="4"/>
  ${TG_QUADS.map((q) => {
    const d = { tl: 'M100,100 L12,100 A88,88 0 0 1 100,12 Z', tr: 'M100,100 L100,12 A88,88 0 0 1 188,100 Z', bl: 'M100,100 L100,188 A88,88 0 0 1 12,100 Z', br: 'M100,100 L188,100 A88,88 0 0 1 100,188 Z' }[q];
    const [x, y] = TG_POS[q];
    return `<g class="tg-q q-${q}" data-q="${q}"><path class="fill" d="${d}"/><circle class="badge" cx="${x}" cy="${y}" r="26"/><text class="tg-num" id="tgn-${q}" x="${x}" y="${y + 1}" text-anchor="middle">?</text></g>`;
  }).join('')}
  <line x1="100" y1="12" x2="100" y2="188" stroke="#4A2E17" stroke-width="3"/>
  <line x1="12" y1="100" x2="188" y2="100" stroke="#4A2E17" stroke-width="3"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="#4A2E17" stroke-width="3"/>
  <circle cx="100" cy="100" r="9" fill="#E8553A" stroke="#4A2E17" stroke-width="2.5"/>
</svg>`;
const TG_STAND_SVG = `<svg viewBox="0 0 120 80" aria-hidden="true"><ellipse cx="60" cy="72" rx="50" ry="7" fill="rgba(0,0,0,.22)"/><path d="M34 6 16 70M86 6l18 64M44 6l-4 64M76 6l4 64" stroke="#5B3A22" stroke-width="7" stroke-linecap="round"/><path d="M18 60h84" stroke="#6B4320" stroke-width="6" stroke-linecap="round"/></svg>`;
const TG_BOW_SVG = `<svg viewBox="0 0 400 300" aria-hidden="true">
  <defs><linearGradient id="tgWood" x1="0" x2="1"><stop offset="0" stop-color="#6B4320"/><stop offset=".5" stop-color="#A86F3A"/><stop offset="1" stop-color="#6B4320"/></linearGradient>
    <linearGradient id="tgSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D5DCE3"/><stop offset="1" stop-color="#7C8794"/></linearGradient></defs>
  <path d="M168 118 182 300h36l14-182Z" fill="url(#tgWood)" stroke="#4A2E17" stroke-width="5"/>
  <path d="M186 222q14 26 28 0" fill="none" stroke="#4A2E17" stroke-width="7" stroke-linecap="round"/>
  <rect x="196" y="202" width="8" height="18" rx="2" fill="#4A2E17"/>
  <path class="tg-limb" d="M40 82C90 20 150 55 200 60c50-5 110-40 160 22" fill="none" stroke="#3E4A57" stroke-width="16" stroke-linecap="round"/>
  <path class="tg-limb" d="M40 82C90 20 150 55 200 60c50-5 110-40 160 22" fill="none" stroke="url(#tgSteel)" stroke-width="8" stroke-linecap="round"/>
  <rect x="148" y="50" width="104" height="16" rx="5" fill="#4A2E17"/><rect x="148" y="50" width="104" height="6" rx="3" fill="#C99A5B"/>
  <polyline id="tgString" points="40,82 200,82 360,82" fill="none" stroke="#F3E9D6" stroke-width="3.4"/>
  <g id="tgBolt"><line x1="200" y1="82" x2="200" y2="-30" stroke="#4A3117" stroke-width="5" stroke-linecap="round"/><path d="M200-40l-10 24h20Z" fill="#9AA3AD"/><path d="M200 78l-11 15 11-4 11 4z" fill="#E8553A"/></g>
</svg>`;
const TG_ARROW_SVG = `<svg viewBox="0 0 20 140" aria-hidden="true"><line x1="10" y1="140" x2="10" y2="12" stroke="#4A3117" stroke-width="5" stroke-linecap="round"/><path d="M10 0 2 26h16Z" fill="#9AA3AD"/><path d="M10 136l-9 12 9-3 9 3z" fill="#E8553A"/></svg>`;
const TG_STUCK_SVG = `<svg viewBox="0 0 60 60" aria-hidden="true"><line x1="6" y1="6" x2="40" y2="44" stroke="#4A3117" stroke-width="4.5" stroke-linecap="round"/><path d="M40 44l2 14 6-10 10-2z" fill="#E8553A"/><circle cx="6" cy="6" r="3.5" fill="#3B2415"/></svg>`;
const TG_CLOUD = (style) => `<svg class="tg-cloud" style="${style}" viewBox="0 0 100 40" aria-hidden="true"><path d="M10 32a12 12 0 0 1 4-23 15 15 0 0 1 28-4 13 13 0 0 1 20 10 10 10 0 0 1-2 17z" fill="#fff"/></svg>`;

function startTarget() {
  Object.assign(game, { picker: gamePicker(), locked: true, tries: 0, tg: { vals: {}, aim: null } });
  const r = runStart('target', { onEnd: () => { game.locked = true; } });
  $('#view').innerHTML = gameShell('target', `
    <div class="tg-stage" id="tgstage">
      <div class="tg-sky"><span class="tg-sun"></span>${TG_CLOUD('left:6%;top:12%;width:16%;--d:70s')}${TG_CLOUD('left:62%;top:20%;width:20%;--d:95s')}${TG_CLOUD('left:34%;top:6%;width:11%;--d:120s')}</div>
      <svg class="tg-hills" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40C40 18 80 22 120 32s70 2 110-10 90-4 120 14 40 6 50 0V60H0z" fill="#8CC56B"/><path d="M0 50c50-14 100-8 150 0s110 6 170-6 70 2 80 4V60H0z" fill="#6FAF4F"/></svg>
      <div class="tg-meadow"><span class="tg-fence"></span></div>
      <div class="tg-hud">${runHudHTML('wood')}</div>
      <div class="tg-sign" id="tgsign"><span class="task" id="tgtask"></span></div>
      ${r.mode === 'survive' ? '<div class="tg-clock" id="tgclock"><i></i></div>' : ''}
      <div class="tg-stand">${TG_STAND_SVG}</div>
      <div class="tg-target" id="tgtarget">${TG_TARGET_SVG}</div>
      <div class="tg-arrows" id="tgarrows"></div>
      <div class="tg-reticle" id="tgret"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><circle cx="50" cy="50" r="34" fill="none" stroke="#E8553A" stroke-width="2.4"/><path d="M50 4v20M50 76v20M4 50h20M76 50h20" stroke="#fff" stroke-width="4"/><circle cx="50" cy="50" r="3" fill="#E8553A"/></svg></div>
      <div class="tg-bow" id="tgbow">${TG_BOW_SVG}</div>
      <div class="tg-flight" id="tgflight">${TG_ARROW_SVG}</div>
      <div class="tg-toast" id="tgtoast"></div>
      <p class="tg-help" id="tghelp">Finger aufs Bild = spannen · ziehen = zielen · loslassen = schiessen</p>
    </div>
    <p class="mode-hint">Lege den Finger irgendwo auf das Bild – die Armbrust wird gespannt. Dann ziele durch Ziehen und lass los, um zu schiessen. Tasten 1–4 gehen auch.</p>`);
  tgBind();
  setGameKeys((e) => { if (/^[1-4]$/.test(e.key)) tgShootQuad(['tl', 'tr', 'bl', 'br'][+e.key - 1]); });
  game.pickVal = (v) => { const q = TG_QUADS.find((k) => game.tg.vals[k] === Number(v)); if (q) tgShootQuad(q); };
  tgNext();
}
function tgNext() {
  if (!runOn()) return;
  const t = game.picker.next();
  game.task = { ...t, shownAt: performance.now() };
  game.tries = 0;
  const vals = choicesFor(t, 4);
  TG_QUADS.forEach((q, i) => {
    game.tg.vals[q] = vals[i];
    const n = $(`#tgn-${q}`);
    if (n) { n.textContent = vals[i]; n.setAttribute('font-size', String(vals[i]).length > 2 ? 22 : 27); }
  });
  $$('.tg-q').forEach((g) => g.classList.remove('correct', 'wrong'));
  $$('#tgarrows .tg-stuck').forEach((a) => { a.classList.add('gone'); setTimeout(() => a.remove(), 400); });
  $('#tgtask').innerHTML = taskHTML(t, '<span class="slot">?</span>');
  const sign = $('#tgsign');
  sign.classList.remove('drop'); void sign.offsetWidth; sign.classList.add('drop');
  game.locked = false;
  if (game.run.mode === 'survive') taskClock($('#tgclock i'), surviveMs(8000, 2200), tgTimeout);
}
function tgTimeout() {
  if (game.locked || !runOn()) return;
  game.locked = true;
  const t = game.task;
  if (game.tries === 0) recordAnswer(t, '', performance.now() - t.shownAt);
  sfx.bad();
  tgToast(`Zu spät! ${taskText(t, true)}`, 'bad');
  const q = TG_QUADS.find((k) => game.tg.vals[k] === t.answer);
  $(`.tg-q.q-${q}`)?.classList.add('correct');
  if (!runWrong(t)) gLater(tgNext, 1300);
}
function tgToast(text, cls) {
  const el = $('#tgtoast');
  if (!el) return;
  el.textContent = text;
  el.className = `tg-toast show ${cls}`;
  clearTimeout(game.tgToastT);
  game.tgToastT = gLater(() => el.classList.remove('show'), 1000);
}
/* Ablauf eines Schusses (wie beim Original):
   1. Finger aufs Bild → die Armbrust wird gespannt: Sehne und Pfeil gleiten sichtbar nach hinten.
   2. Erst wenn sie gespannt ist, erscheint das Fadenkreuz – jetzt durch Ziehen zielen
      (die Bewegung des Fingers verschiebt das Fadenkreuz doppelt so weit).
   3. Loslassen → die Sehne schnellt nach vorn, der Pfeil fliegt.
   Wer loslässt, bevor die Armbrust gespannt ist, schiesst nicht: Die Sehne gleitet einfach zurück. */
const TG_DRAW_MS = 380;
function tgBind() {
  const stage = $('#tgstage');
  const SENS = 2;
  const g = game.tg;
  const center = () => { const r = $('#tgtarget').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; };
  stage.addEventListener('pointerdown', (e) => {
    if (game.locked || !runOn() || e.button > 0 || g.aim) return;
    if (e.target.closest('button')) return;
    const c = center();
    g.aim = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cx: c.x, cy: c.y, maxR: c.w * 0.62, dx: 0, dy: 0, ready: false };
    try { stage.setPointerCapture(e.pointerId); } catch { /* */ }
    $('#tghelp')?.classList.add('hide');
    const a = g.aim;
    tgDraw(1, TG_DRAW_MS).then((done) => {
      if (!done || g.aim !== a) return;
      a.ready = true;
      $('#tgbow')?.classList.add('drawn');
      tgReticle(a.cx + a.dx, a.cy + a.dy, true);
    });
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    const a = g.aim;
    if (!a || e.pointerId !== a.id) return;
    let dx = (e.clientX - a.x0) * SENS, dy = (e.clientY - a.y0) * SENS;
    const d = Math.hypot(dx, dy);
    if (d > a.maxR) { dx *= a.maxR / d; dy *= a.maxR / d; }
    a.dx = dx; a.dy = dy;
    g.nx = dx / a.maxR; g.ny = dy / a.maxR;
    tgBow();
    if (a.ready) tgReticle(a.cx + dx, a.cy + dy, true);
  });
  const up = (e) => {
    const a = g.aim;
    if (!a || e.pointerId !== a.id) return;
    g.aim = null;
    tgReticle(0, 0, false);
    $('#tgbow')?.classList.remove('drawn');
    if (!a.ready || game.locked || !runOn()) { // zu früh losgelassen: entspannen, kein Schuss
      g.nx = 0; g.ny = 0;
      tgDraw(0, 220);
      return;
    }
    tgRelease();
    tgFire(a.cx + a.dx, a.cy + a.dy);
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', (e) => { if (g.aim && e.pointerId === g.aim.id) { g.aim = null; tgReticle(0, 0, false); $('#tgbow')?.classList.remove('drawn'); g.nx = 0; g.ny = 0; tgDraw(0, 220); } });
}
/** Sehne spannen (to = 1) oder entspannen (to = 0). Liefert true, wenn die Bewegung ganz durchgelaufen ist. */
function tgDraw(to, ms) {
  const g = game.tg;
  cancelAnimationFrame(g.drawRaf);
  const from = g.pull || 0;
  const t0 = performance.now(), dur = reduceMotion() ? 1 : ms * Math.abs(to - from);
  return new Promise((resolve) => {
    const step = (now) => {
      if (!$('#tgbow')) { resolve(false); return; }
      const u = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = to > from ? 1 - (1 - u) ** 3 : u * u; // spannen: zuerst schnell, dann zäh
      g.pull = from + (to - from) * e;
      tgBow();
      if (u < 1) g.drawRaf = requestAnimationFrame(step); else resolve(true);
    };
    g.drawRaf = requestAnimationFrame(step);
  });
}
/** Abdrücken: Die Sehne schnellt nach vorn, die Armbrust ruckt kurz */
function tgRelease() {
  const g = game.tg;
  cancelAnimationFrame(g.drawRaf);
  g.pull = 0; g.nx = 0; g.ny = 0;
  tgBow();
  const rig = $('#tgbow');
  rig?.classList.remove('kick'); void rig?.offsetWidth; rig?.classList.add('kick');
}
function tgLocal(x, y) { const r = $('#tgstage').getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }
function tgReticle(x, y, on) {
  const el = $('#tgret');
  if (!el) return;
  el.classList.toggle('on', on);
  if (on) { const p = tgLocal(x, y); el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; }
}
function tgBow() {
  const rig = $('#tgbow');
  if (!rig) return;
  const g = game.tg;
  const nx = clamp(g.nx || 0, -1, 1), ny = clamp(g.ny || 0, -1, 1), pull = clamp(g.pull || 0, 0, 1);
  rig.style.transform = `translateX(-50%) perspective(900px) translate(${nx * 14}px, ${ny * 12}px) rotateZ(${nx * 8}deg) rotateX(${-ny * 7}deg)`;
  // Beim Spannen biegen sich die Bogenarme nach hinten, die Sehne zieht den Pfeil mit
  const tx = 40 + pull * 16, ty = 82 + pull * 16;
  const limb = `M${tx} ${ty}C${90 + pull * 6} ${20 + pull * 14} 150 55 200 60c50-5 ${110 - pull * 6} ${-40 + pull * 14} ${160 - pull * 16} ${22 + pull * 16}`;
  $$('#tgbow .tg-limb').forEach((el) => el.setAttribute('d', limb));
  $('#tgString')?.setAttribute('points', `${tx},${ty} 200,${82 + pull * 110} ${400 - tx},${ty}`);
  $('#tgBolt')?.setAttribute('transform', `translate(0,${pull * 110})`);
}
/** Schuss per Taste: spannen, dann genau in die Mitte des Feldes */
function tgShootQuad(q) {
  if (game.locked || !runOn() || game.tg.aim) return;
  game.locked = true;
  tgDraw(1, TG_DRAW_MS * 0.7).then((done) => {
    if (!done || !runOn()) return;
    const r = $('#tgtarget').getBoundingClientRect();
    const [x, y] = TG_POS[q];
    tgRelease();
    tgFire(r.left + (x / 200) * r.width, r.top + (y / 200) * r.height);
  });
}
function tgFire(x, y) {
  game.locked = true;
  const stage = $('#tgstage'), fl = $('#tgflight'), bow = $('#tgbow').getBoundingClientRect();
  const from = tgLocal(bow.left + bow.width / 2, bow.top + bow.height * 0.27), to = tgLocal(x, y);
  const ang = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  const fast = reduceMotion();
  fl.style.opacity = '1';
  fl.animate([
    { left: `${from.x}px`, top: `${from.y}px`, transform: 'translate(-50%, 0) scale(1.25) rotate(0deg)' },
    { left: `${to.x}px`, top: `${to.y}px`, transform: `translate(-50%, 0) scale(.5) rotate(${ang}deg)` },
  ], { duration: fast ? 1 : 300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  void stage;
  gLater(() => { fl.style.opacity = '0'; fl.getAnimations().forEach((a) => a.cancel()); tgHit(x, y); }, fast ? 20 : 310);
}
function tgHit(x, y) {
  if (!runOn()) return;
  const r = $('#tgtarget').getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const dx = x - cx, dy = y - cy;
  const p = tgLocal(x, y);
  // Pfeil bleibt stecken (auch daneben im Stroh) und zittert kurz
  const stuck = document.createElement('span');
  stuck.className = 'tg-stuck';
  stuck.style.left = `${p.x}px`; stuck.style.top = `${p.y}px`;
  stuck.innerHTML = TG_STUCK_SVG;
  $('#tgarrows')?.appendChild(stuck);
  if (Math.hypot(dx, dy) > r.width * 0.44) { // daneben
    tgToast('Daneben – nochmal!', 'bad');
    stuck.classList.add('miss');
    game.locked = false;
    return;
  }
  const q = (dy < 0 ? 't' : 'b') + (dx < 0 ? 'l' : 'r');
  const t = game.task, v = game.tg.vals[q];
  const first = game.tries === 0;
  game.tries++;
  if (first) recordAnswer(t, v, performance.now() - t.shownAt);
  const g = $(`.tg-q.q-${q}`);
  if (v === t.answer) {
    taskClockStop($('#tgclock i'));
    g?.classList.add('correct');
    sfx.good();
    tgToast('Treffer! ✓', 'good');
    if (first && runRight()) return;
    gLater(tgNext, 650);
  } else {
    g?.classList.add('wrong');
    sfx.bad();
    tgToast('Falsches Feld – nochmal!', 'bad');
    // falsch: zählt (Survive: jedes Mal ein Leben, sonst nur der erste Versuch)
    if ((first || game.run.mode === 'survive') && runWrong(t)) return;
    gLater(() => { g?.classList.remove('wrong'); if (runOn()) game.locked = false; }, 650);
  }
}

/* =========================================================
   🃏 Memory (nur Speed: alle Karten offen, so schnell wie möglich)
   ========================================================= */
const MEM_PAIRS = 8, MEM_PENALTY = 3000;
function startMemory() {
  const picker = gamePicker();
  const pairs = [], answers = new Set(), facts = new Set();
  for (let i = 0; i < 160 && pairs.length < MEM_PAIRS; i++) {
    const t = picker.next();
    if (answers.has(t.answer) || facts.has(t.fact)) continue;
    answers.add(t.answer); facts.add(t.fact); pairs.push(t);
  }
  const cards = shuffle(pairs.flatMap((t, i) => [{ id: i, kind: 'task', t }, { id: i, kind: 'res', t }]));
  Object.assign(game, { pairs, cards, sel: null, combo: 0, locked: false, lastFound: performance.now() });
  runStart('memory', { goal: pairs.length });
  $('#view').innerHTML = gameShell('memory', `
    <div class="mem-bar">${runHudHTML()}<span class="mem-combo" id="memcombo"></span><span class="mem-pen" id="mempen"></span></div>
    <div class="mem-grid open n${cards.length}" id="memgrid">${cards.map((c, i) => `<button class="mem-card ${c.kind} deal" style="--d:${i * 35}ms" data-action="mem-flip" data-i="${i}" aria-label="${c.kind === 'task' ? taskText(c.t) : c.t.answer}"><span class="mc-in"><span class="mc-back" aria-hidden="true">${BRAND_SVG('mcb' + i)}</span><span class="mc-face ${c.kind === 'task' && c.t.op.startsWith('gap') ? 'long' : ''}">${c.kind === 'task' ? memTaskFace(c.t) : c.t.answer}</span></span></button>`).join('')}</div>
    <p class="mode-hint">Tippe eine Rechnung und dann ihr Ergebnis an. Ein falsches Paar kostet 3 Sekunden.</p>`,
  '');
}
/** Vorderseite einer Rechnungs-Karte: 7 · 8, 56 : 8 oder ▢ · 8 = 56 */
function memTaskFace(t) {
  const S = `<em>${SIGN()}</em>`, gap = '<i class="mc-gap">▢</i>';
  if (t.op === 'div') return `${t.p}<em>:</em>${t.b}`;
  if (t.op === 'gapA') return `${gap}${S}${t.b}<em>=</em>${t.p}`;
  if (t.op === 'gapB') return `${t.a}${S}${gap}<em>=</em>${t.p}`;
  return `${t.a}${S}${t.b}`;
}
function memFlip(btn) {
  if (game.locked || !runOn()) return;
  const i = +btn.dataset.i, c = game.cards[i];
  if (c.done) return;
  if (game.sel === i) { btn.classList.remove('sel'); game.sel = null; return; }
  sfx.flip();
  btn.classList.add('sel');
  if (game.sel == null) { game.sel = i; return; }
  const j = game.sel, d = game.cards[j], other = $(`.mem-card[data-i="${j}"]`);
  game.sel = null;
  if (d.kind === c.kind) { other.classList.remove('sel'); game.sel = i; return; } // zwei Rechnungen: neue Wahl
  const match = c.id === d.id;
  const task = c.kind === 'task' ? c.t : d.t, val = c.kind === 'res' ? c.t.answer : d.t.answer;
  recordAnswer(task, val, performance.now() - game.lastFound);
  if (match) {
    c.done = d.done = true;
    game.combo++;
    game.lastFound = performance.now();
    sfx.good();
    [btn, other].forEach((b) => { b.classList.remove('sel'); b.classList.add('done'); sparkle(b); });
    const cb = $('#memcombo');
    if (cb && game.combo >= 2) { cb.textContent = `${game.combo}er-Kombo!`; cb.classList.remove('show'); void cb.offsetWidth; cb.classList.add('show'); tone([660 + game.combo * 80], 0.08, 'triangle', 0.08); }
    runRight();
  } else {
    game.combo = 0;
    sfx.bad();
    game.locked = true;
    game.run.penalty += MEM_PENALTY;
    const pen = $('#mempen');
    if (pen) { pen.textContent = '+3 s'; pen.classList.remove('show'); void pen.offsetWidth; pen.classList.add('show'); }
    runWrong(task);
    [btn, other].forEach((b) => b.classList.add('nope'));
    gLater(() => { [btn, other].forEach((b) => b.classList.remove('nope', 'sel')); game.locked = false; }, 550);
  }
}

/* =========================================================
   ✅ Stimmt das?
   ========================================================= */
function startTrueFalse() {
  Object.assign(game, { picker: gamePicker(), stmt: null, over: false });
  const r = runStart('truefalse');
  $('#view').innerHTML = gameShell('truefalse', `
    ${runHudHTML('bar-hud')}
    ${r.mode === 'survive' ? '<div class="shot-clock tf-clock" id="tfclock"><i></i></div>' : ''}
    <div class="tf-deck" id="tfdeck"></div>
    <div class="tf-btns">
      <button class="tf-btn no" data-action="tf-answer" data-v="0">${icon('x')}<span>Stimmt nicht</span></button>
      <button class="tf-btn yes" data-action="tf-answer" data-v="1">${icon('check')}<span>Stimmt</span></button>
    </div>
    <p class="mode-hint">Wische die Karte nach rechts (stimmt) oder links (stimmt nicht) – oder tippe auf die Knöpfe. Pfeiltasten gehen auch.</p>`);
  setGameKeys((e) => { if (e.key === 'ArrowLeft') tfAnswer(false); if (e.key === 'ArrowRight') tfAnswer(true); });
  tfNext();
}
function tfNext() {
  if (!runOn()) return;
  const t = game.picker.next();
  const truth = Math.random() < 0.5;
  const shown = truth ? t.answer : distractors(t, 1)[0];
  game.stmt = { t, shown, truth: shown === t.answer };
  game.locked = false;
  t.shownAt = performance.now();
  const deck = $('#tfdeck');
  if (!deck) return;
  const card = document.createElement('div');
  card.className = 'tf-card task-card in';
  card.innerHTML = `<div class="task">${taskHTML(t, `<span class="num shown">${shown}</span>`)}</div><div class="tf-note"></div>`;
  deck.appendChild(card);
  game.card = card;
  // Wischen: Karte ziehen, beim Loslassen entscheidet die Richtung
  let x0 = null, dx = 0;
  card.addEventListener('pointerdown', (e) => { if (game.locked) return; x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.classList.add('drag'); });
  card.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    card.classList.toggle('lean-yes', dx > 40);
    card.classList.toggle('lean-no', dx < -40);
  });
  const up = () => {
    if (x0 == null) return;
    x0 = null;
    card.classList.remove('drag', 'lean-yes', 'lean-no');
    if (Math.abs(dx) > 70) tfAnswer(dx > 0);
    else card.style.transform = '';
  };
  card.addEventListener('pointerup', up);
  card.addEventListener('pointercancel', up);
  if (game.run.mode === 'survive') taskClock($('#tfclock i'), surviveMs(6000, 1300), () => tfAnswer(null));
}
function tfFloat(text, cls) {
  const deck = $('#tfdeck');
  if (!deck) return;
  const f = document.createElement('span');
  f.className = `tf-float ${cls}`;
  f.textContent = text;
  deck.appendChild(f);
  setTimeout(() => f.remove(), 900);
}
/** says: true (stimmt), false (stimmt nicht) oder null (zu spät, nur Survive) */
function tfAnswer(says) {
  if (game.locked || !runOn() || !game.stmt) return;
  game.locked = true;
  taskClockStop($('#tfclock i'));
  const { t, shown, truth } = game.stmt;
  const ok = says === truth;
  // fürs Gedächtnis: richtig erkannt = gewusst; „stimmt“ bei falschem Ergebnis = diese Verwechslung
  recordAnswer(t, ok ? t.answer : (says ? shown : ''), performance.now() - t.shownAt);
  const card = game.card;
  const leave = (delay) => gLater(() => {
    card.classList.add(says === false ? 'out-no' : 'out-yes');
    card.style.transform = '';
    setTimeout(() => card.remove(), 450);
    runPause(false);
    tfNext();
  }, delay);
  let ended;
  if (ok) {
    sfx.good();
    card.classList.add('good');
    tfFloat('+1', 'good');
    ended = runRight();
  } else {
    sfx.bad();
    card.classList.add('bad');
    if (says === null) tfFloat('Zu spät!', 'bad');
    ended = runWrong(t);
  }
  if (ended) return;
  // Ist die Rechnung falsch, zeigen wir immer die richtige – auch wenn das Kind es richtig erkannt hat.
  // Solange die Lösung steht, ist die Uhr angehalten.
  if (!truth || !ok) {
    runPause(true);
    const note = card.querySelector('.tf-note');
    note.innerHTML = truth
      ? `<span class="tf-sol">Stimmt doch: <b>${esc(taskText(t, true))}</b></span>`
      : `<span class="tf-sol">${ok ? 'Gut erkannt!' : 'Leider falsch.'} Richtig ist <b>${esc(taskText(t, true))}</b></span>`;
    card.querySelector('.num.shown')?.classList.add(truth ? 'is-true' : 'strike');
    leave(ok ? 1150 : 1800);
  } else leave(170);
}

/* =========================================================
   ⚔️ Duell zu zweit
   ========================================================= */
function startDuel() {
  const goal = db.settings.duelGoal || 10;
  Object.assign(game, { picker: gamePicker(), pts: [0, 0], goal, lock: [0, 0], task: null, over: false, roundDone: false });
  const half = (p) => `<div class="duel-half p${p}" id="dh${p}">
      <div class="dh-head"><span class="dh-name">${p === 0 ? 'Spieler Rot' : 'Spieler Blau'}</span><span class="dh-pts"><b id="dp${p}">0</b>/${goal}</span></div>
      <div class="dh-task" id="dt${p}"></div>
      <div class="dh-opts" id="do${p}"></div>
    </div>`;
  $('#view').innerHTML = gameShell('duel', `
    <div class="duel" id="duel">${half(0)}<div class="duel-mid"><span class="rope" aria-hidden="true"><i id="ropeknot"></i></span><span class="vs">VS</span></div>${half(1)}
      <div class="duel-count" id="duelcount"></div></div>
    <p class="mode-hint">Legt das Tablet zwischen euch. Wer zuerst richtig tippt, bekommt den Punkt. Falsch getippt = kurz gesperrt.</p>`,
  '');
  // Countdown 3 – 2 – 1 – Los!
  game.roundDone = true;
  const cd = $('#duelcount');
  ['3', '2', '1', 'Los!'].forEach((x, i) => gLater(() => {
    cd.textContent = x; cd.classList.remove('show'); void cd.offsetWidth; cd.classList.add('show');
    tone([i < 3 ? 520 : 880], 0.12, 'triangle', 0.1);
    if (i === 3) { gLater(() => { cd.textContent = ''; }, 500); duelNext(); }
  }, i * 650));
}
/** Seilziehen: Der Knoten wandert zum Kind, das vorne liegt */
function duelRope() {
  const k = $('#ropeknot');
  if (!k) return;
  const diff = (game.pts[1] - game.pts[0]) / game.goal;
  k.style.setProperty('--pos', `${50 + clamp(diff, -1, 1) * 45}%`);
}
function duelNext() {
  const t = game.picker.next();
  game.task = t; game.roundDone = false;
  const opts = choicesFor(t, 4);
  [0, 1].forEach((p) => {
    $(`#dt${p}`).innerHTML = `<span class="task small">${taskHTML(t)}</span>`;
    $(`#do${p}`).innerHTML = shuffle(opts).map((o) => `<button class="choice" data-action="duel-tap" data-p="${p}" data-v="${o}">${o}</button>`).join('');
    $(`#dh${p}`).classList.remove('win', 'locked');
  });
}
function duelTap(btn) {
  const p = +btn.dataset.p, v = Number(btn.dataset.v);
  if (game.over || game.roundDone || game.lock[p] > performance.now()) return;
  const t = game.task;
  if (v === t.answer) {
    game.roundDone = true;
    game.pts[p]++;
    sfx.good();
    btn.classList.add('right');
    $(`#dh${p}`).classList.add('win');
    $(`#dp${p}`).textContent = game.pts[p];
    $(`#dp${p}`).classList.remove('pop'); void $(`#dp${p}`).offsetWidth; $(`#dp${p}`).classList.add('pop');
    sparkle(btn, 12);
    duelRope();
    $$(`#do${1 - p} .choice`).forEach((b) => { if (Number(b.dataset.v) === t.answer) b.classList.add('right'); });
    if (game.pts[p] >= game.goal) { game.over = true; gLater(() => duelEnd(p), 900); return; }
    gLater(duelNext, 1000);
  } else {
    sfx.bad();
    btn.classList.add('wrong');
    game.lock[p] = performance.now() + 1500;
    const h = $(`#dh${p}`);
    h.classList.add('locked');
    gLater(() => h.classList.remove('locked'), 1500);
  }
}
function duelEnd(p) {
  sfx.win(); confetti();
  $('#view .game').innerHTML = gameResultHTML({
    st: 3, title: `${p === 0 ? 'Rot' : 'Blau'} gewinnt!`,
    line: `${game.pts[0]} : ${game.pts[1]}`,
  });
}
