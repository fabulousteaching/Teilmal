/* Teilmal – Menü (gleich aufgebaut wie in Vokaboom)
 * Links die Bereiche, rechts die Einstellungen des gewählten Bereichs:
 * Konto · Klassenübersicht · Login-Kärtchen · Avatar & Münzen (wie in Vokaboom, gelten in beiden Tools)
 * Rechnen · Ton & Darstellung (nur Teilmal)
 * Kinder mit Login sehen statt des Menüs ihr Konto-Fenster und die Einstellungen (Zahnrad).
 */
'use strict';

const MENU = { sec: 'konto', avCfg: null, avLoading: false, bonus: { cls: '', kid: '', n: 10 } };
const MENU_SECTIONS = [
  ['konto', 'user', 'Konto'],
  ['uebersicht', 'users', 'Klassenübersicht'],
  ['klassen', 'image', 'Login-Kärtchen'],
  ['avatar', 'sparkle', 'Avatar & Münzen'],
  ['spiele', 'grid', 'Spieleinstellungen'],
  ['rechnen', 'keypad', 'Rechnen'],
  ['anzeige', 'speaker', 'Ton & Darstellung'],
];

/** Knopf oben rechts: ein einziger „Menü“-Knopf mit Konto-Status (wie in Vokaboom) */
function menuButtonHTML() {
  const who = cloud.user ? `<span class="menu-who" aria-hidden="true">${esc(cloud.user.charAt(0).toUpperCase())}</span>` : '';
  return `<button class="menu-btn ${cloud.user ? 'in' : ''}" data-action="menu" aria-label="Menü${cloud.user ? `, angemeldet als ${esc(cloud.user)}` : ''}" title="Menü – Konto und Einstellungen">
    ${who}${icon('sliders')}<span>Menü</span>${cloud.user ? '<i class="sync-dot ok" aria-hidden="true"></i>' : ''}</button>`;
}

function openMenu(sec) {
  if (isKid()) { openSettings(); return; }
  if (sec) MENU.sec = sec;
  const html = `<div class="menu">
    <nav class="menu-nav" aria-label="Bereiche">
      <p class="menu-title">Menü</p>
      ${MENU_SECTIONS.map(([id, ic, name]) => `<button type="button" class="menu-tab ${MENU.sec === id ? 'on' : ''}" data-action="menu-sec" data-sec="${id}" aria-current="${MENU.sec === id}">
        ${icon(ic)}<span>${name}</span>${id === 'konto' && cloud.user ? '<i class="menu-dot" aria-hidden="true"></i>' : ''}</button>`).join('')}
    </nav>
    <div class="menu-main">
      <header class="modal-head"><h2 id="menu-h">${esc(MENU_SECTIONS.find((x) => x[0] === MENU.sec)?.[2] || '')}</h2><span class="menu-saved" id="menu-saved" role="status" aria-live="polite"></span><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schliessen">${icon('x')}</button></header>
      <div class="menu-body" id="menu-body">${menuSectionHTML(MENU.sec)}</div>
    </div>
  </div>`;
  if (ui.modal?.el?.querySelector('.menu')) {
    ui.modal.el.querySelector('.modal').innerHTML = html;
  } else {
    MENU.cardsChanged = false;
    openModal(html, { label: 'Menü', cls: 'menu-modal', onClose: () => { if (MENU.cardsChanged && ui.view === 'class') render(); } });
    menuBindOnce(ui.modal.el);
  }
  menuAfterRender();
}
const menuRerender = (sec) => { if (MENU.sec === sec && $('#menu-body')) $('#menu-body').innerHTML = menuSectionHTML(sec); };
function menuAfterRender() {
  if (MENU.sec === 'konto' && cloud.user) bindAccountForms();
  if (MENU.sec === 'avatar' && cloud.uid && !MENU.avCfg && !MENU.avLoading) menuLoadAvatarCfg();
  if (MENU.sec === 'klassen' && cloud.uid) loadCardCfg().then((changed) => { if (changed || CARD_SYNC.missing) menuRerender('klassen'); });
  const sec = MENU.sec;
  if (['avatar', 'klassen', 'uebersicht'].includes(sec) && cloud.uid && !klass.loaded) loadClasses().then(() => menuRerender(sec));
}
function menuBindOnce(m) {
  const s = db.settings;
  m.addEventListener('input', (e) => {
    if (e.target.id === 'av-percoin') { $('#av-percoin-val').textContent = e.target.value; $('#av-percoin-hint').textContent = menuCoinHint(+e.target.value); }
    if (e.target.id === 'av-daymax') $('#av-daymax-val').textContent = e.target.value;
  });
  m.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.card) {
      s.cards = { ...cardCfg(), [t.dataset.card]: t.type === 'checkbox' ? t.checked : t.value }; MENU.cardsChanged = true; menuSaved(); saveCardCfg();
      if (t.dataset.card === 'secret') { saveDB(); menuRerender('klassen'); return; }
    }
    if (t.dataset.classPw) { saveClassPw(t.dataset.classPw, t.value).then((ok) => { if (ok) { MENU.cardsChanged = true; menuSaved(); } }); return; }
    if (t.dataset.av) {
      const v = t.type === 'checkbox' ? t.checked : +t.value;
      MENU.avCfg = { ...(MENU.avCfg || {}), [t.dataset.av]: v };
      menuSaveAvatarCfg();
    }
    if (t.id === 'bonus-cls') { MENU.bonus.cls = t.value; MENU.bonus.kid = ''; menuRerender('avatar'); }
    if (t.id === 'bonus-kid') MENU.bonus.kid = t.value;
    if (t.id === 'set-auto') { s.autoCheck = t.checked; menuSaved(); }
    if (t.id === 'set-sound') { s.sound = t.checked; menuSaved(); }
    saveDB();
  });
}

/** Beispiel zum Tempo: wie viele Münzen eine Runde mit 50 richtigen Antworten bringt */
const menuCoinHint = (pc) => `1 richtige Antwort = 1 Punkt. Eine Runde mit 50 richtigen Antworten gibt ${Math.floor(50 / pc)} ${Math.floor(50 / pc) === 1 ? 'Münze' : 'Münzen'}.`;
const classReihenText = (c) => `${c.settings.big ? 'Grosses' : 'Kleines'} Einmaleins · ${c.settings.reihen.length === reihenFor(c.settings.big).length ? 'alle Reihen' : `${c.settings.reihen.length === 1 ? 'Reihe' : 'Reihen'} ${c.settings.reihen.join(', ')}`}`;

/* ---------- Inhalte der Bereiche ---------- */
function menuSectionHTML(sec) {
  const s = db.settings;
  const needLogin = (what) => `<div class="menu-empty">${icon('user')}<p>${what} gibt es mit einem Konto für Lehrpersonen.</p>
    <button type="button" class="btn primary" data-action="login" data-mode="login">Als Lehrperson anmelden</button></div>`;
  const seg = (action, attr, val, items) => `<div class="seg" role="group">${items.map(([v, t]) => `<button type="button" class="seg-btn" data-action="${action}" data-${attr}="${v}" aria-pressed="${String(val) === String(v)}">${t}</button>`).join('')}</div>`;
  const setSeg = (key, items) => `<div class="seg" role="radiogroup">${items.map(([v, t]) => `<button type="button" class="seg-btn" data-action="set-setting" data-key="${key}" data-val="${v}" aria-pressed="${String(s[key]) === String(v)}">${t}</button>`).join('')}</div>`;
  switch (sec) {
    case 'konto':
      if (!cloud.user) {
        return `<p class="muted">Du bist nicht angemeldet. Alle Übungen und Spiele gehen auch so – dein Übungsstand wird dann nur in diesem Browser gespeichert.</p>
          <div class="menu-cards">
            <button type="button" class="menu-card" data-action="login" data-mode="login">${icon('user')}<strong>Als Lehrperson anmelden</strong><small>Klassen und Kinder-Logins, Login-Kärtchen, Übersicht und persönliche Übungsblätter. Noch kein Konto? Im nächsten Fenster registrieren.</small></button>
            <button type="button" class="menu-card" data-action="kid-login">${icon('image')}<strong>Kinder-Login</strong><small>Mit Benutzername und Bilder-Passwort vom Kärtchen.</small></button>
          </div>`;
      }
      return accountSectionHTML();
    case 'uebersicht': {
      if (!cloud.user) return needLogin('Klassen, Kinder-Logins und Auswertungen');
      if (!klass.loaded) return '<p class="muted"><span class="spinner"></span> Klassen werden geladen …</p>';
      const list = klass.list || [];
      return `${list.length ? `<div class="cls-list">${list.map((c) => {
          const nKids = studentsOf(c.id).length;
          return `<article class="cls-card">
            <header><h3>${esc(c.name)}</h3><small>${nKids} ${nKids === 1 ? 'Kind' : 'Kinder'} · ${esc(classReihenText(c))}${c.vokaboom_class && vbClassById(c.vokaboom_class) ? ` · mit Vokaboom verbunden` : ''}</small></header>
            <div class="cls-links">${CLASS_TABS.map(([tab, ic, name]) => `<button type="button" class="cls-link" data-action="menu-class" data-id="${c.id}" data-tab="${tab}">${icon(ic)}<span>${name}</span></button>`).join('')}</div>
            <div class="cls-review"><span class="small">🔢 Rechnen:</span>
              <div class="seg small" role="group" aria-label="Einmaleins in ${esc(c.name)}">
                <button type="button" class="seg-btn" data-action="menu-class-size" data-id="${c.id}" data-big="false" aria-pressed="${!c.settings.big}">Kleines 1×1</button>
                <button type="button" class="seg-btn" data-action="menu-class-size" data-id="${c.id}" data-big="true" aria-pressed="${!!c.settings.big}">Grosses 1×1</button>
              </div></div>
          </article>`;
        }).join('')}</div>` : '<p class="empty">Du hast noch keine Klasse.</p>'}
        <div class="row"><button type="button" class="btn secondary" data-action="classes">${icon('plus')} ${list.length ? 'Klasse hinzufügen oder löschen' : 'Erste Klasse anlegen'}</button></div>
        <p class="small muted">🔢 Kleines 1×1 = Reihen 1 bis 10, Grosses 1×1 = Reihen 1 bis 20. Welche Reihen und Aufgabenarten genau, stellst du in der Klasse unter „Reihen“ ein.</p>`;
    }
    case 'klassen': {
      if (!cloud.user) return needLogin('Login-Kärtchen für Kinder');
      const c = cardCfg();
      return `<section class="menu-group">
          <h3>Login-Kärtchen</h3>
          <p class="small muted">Gilt für die Kärtchen, die du ab jetzt druckst (Klasse → Kärtchen) – in Teilmal und in Vokaboom gleich. Das Passwort bleibt gleich – nur die Darstellung ändert sich.</p>
          ${CARD_SYNC.missing ? '<p class="banner bad small">Damit diese Einstellung auch in Vokaboom gilt, <code>supabase/avatar.sql</code> in Supabase nochmals ganz ausführen. Bis dahin gilt sie nur in diesem Browser.</p>' : ''}
          <div class="field"><span class="label">Passwort auf dem Kärtchen</span>
            <label class="radio"><input type="radio" name="card-secret" data-card="secret" value="pics" ${c.secret === 'pics' ? 'checked' : ''}><span><b>Bilder</b> – die Kinder tippen 3 Bilder an (ideal für Unterstufe)</span></label>
            <label class="radio"><input type="radio" name="card-secret" data-card="secret" value="password" ${c.secret === 'password' ? 'checked' : ''}><span><b>Passwort pro Kind</b> – Teilmal erzeugt für jedes Kind ein eigenes einfaches Passwort aus einem Wort und einer Zahl, z. B. „Teich23“</span></label>
            <label class="radio"><input type="radio" name="card-secret" data-card="secret" value="class" ${c.secret === 'class' ? 'checked' : ''}><span><b>Klassenpasswort</b> – du legst ein Passwort für die ganze Klasse fest (einfach zu merken; dafür könnten sich Kinder gegenseitig anmelden)</span></label>
          </div>
          <div class="field"><span class="label">Name auf dem Kärtchen</span>
            <label class="radio"><input type="radio" name="card-names" data-card="names" value="full" ${c.names === 'full' ? 'checked' : ''}><span>Vorname und Anfangsbuchstabe („Lena M.“)</span></label>
            <label class="radio"><input type="radio" name="card-names" data-card="names" value="initials" ${c.names === 'initials' ? 'checked' : ''}><span>Nur Initialen mit den ersten zwei Buchstaben („Le. M.“) – datensparsam, z. B. für Kärtchen, die herumliegen</span></label>
          </div>
          ${c.secret === 'class' ? `<div class="field class-pw-list"><span class="label">Klassenpasswörter</span>
            ${(klass.list || []).length ? klass.list.map((k) => `<label class="class-pw-row"><span>${esc(k.name)}${k.vokaboom_class && vbClassById(k.vokaboom_class) ? ' <small class="muted">gilt auch in Vokaboom</small>' : ''}</span>
              <input type="text" data-class-pw="${k.id}" value="${esc(classPwOfClass(k))}" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="z. B. Sommer2026"></label>`).join('')
              : '<p class="small muted">Noch keine Klassen.</p>'}
            <small class="muted">Klassen ohne Klassenpasswort bekommen Kärtchen mit Bildern. Die Bilder und das eigene Passwort jedes Kindes funktionieren weiterhin.</small></div>` : ''}
          ${c.secret !== 'pics' && klass.noPw ? '<p class="banner bad small">Für Passwörter zuerst <code>supabase/einmaleins.sql</code> in Supabase nochmals ausführen.</p>' : ''}
          <label class="switch"><input type="checkbox" data-card="qr" ${c.qr ? 'checked' : ''}><span>QR-Code aufs Kärtchen (Anmelden ohne Tippen)</span></label>
          <label class="switch"><input type="checkbox" data-card="cls" ${c.cls ? 'checked' : ''}><span>Klassenname oben aufs Kärtchen</span></label>
        </section>`;
    }
    case 'avatar': {
      if (!cloud.user) return needLogin('Einstellungen für Avatar und Münzen');
      const a = { on: true, coins: true, shop: true, games: true, perCoin: 10, dayMax: 40, ...(MENU.avCfg || {}) };
      if (!MENU.avCfg) return '<p class="muted"><span class="spinner"></span> Wird geladen …</p>';
      const kids = MENU.bonus.cls ? (studentsOf(MENU.bonus.cls) || []) : [];
      return `<p class="small muted">Gilt für alle deine Klassen – in Teilmal und in Vokaboom. Die Datenbank hält sich daran (Kinder können es nicht umgehen).</p>
        <section class="menu-group">
          <label class="switch big"><input type="checkbox" data-av="on" ${a.on ? 'checked' : ''}><span><b>„Mein Avatar“ für die Kinder</b><small>Ausgeschaltet sehen die Kinder weder Avatar noch Münzen.</small></span></label>
        </section>
        <fieldset class="menu-group" ${a.on ? '' : 'disabled'}>
          <h3>Münzen</h3>
          <label class="switch"><input type="checkbox" data-av="coins" ${a.coins ? 'checked' : ''}><span>Kinder sammeln Münzen beim Üben</span></label>
          <label class="field" for="av-percoin"><span class="label">Tempo: <b id="av-percoin-val">${a.perCoin}</b> Punkte pro Münze</span>
            <input type="range" id="av-percoin" data-av="perCoin" min="3" max="30" step="1" value="${a.perCoin}">
            <span class="range-ends"><span>schnell, viele Münzen</span><span>sparsam</span></span>
            <small class="muted" id="av-percoin-hint">${menuCoinHint(a.perCoin)}</small></label>
          <label class="field" for="av-daymax"><span class="label">Höchstens <b id="av-daymax-val">${a.dayMax}</b> Münzen pro Tag</span>
            <input type="range" id="av-daymax" data-av="dayMax" min="5" max="100" step="5" value="${a.dayMax}">
            <span class="range-ends"><span>5</span><span>100</span></span></label>
          <label class="switch"><input type="checkbox" data-av="games" ${a.games ? 'checked' : ''}><span>Auch Spiele geben Punkte (1 Punkt pro fertigem Spiel)</span></label>
          <h3>Shop</h3>
          <label class="switch"><input type="checkbox" data-av="shop" ${a.shop ? 'checked' : ''}><span>Kinder dürfen mit Münzen besondere Teile kaufen<small>Ausgeschaltet: nur das Basic-Set (gekaufte Teile bleiben).</small></span></label>
        </fieldset>
        <section class="menu-group">
          <h3>Bonus-Münzen verteilen</h3>
          <p class="small muted">Für eine besondere Leistung, als Belohnung oder zum Start. Höchstens 50 auf einmal.</p>
          <div class="bonus-row">
            <select id="bonus-cls" aria-label="Klasse"><option value="">Klasse wählen …</option>${(klass.list || []).map((c) => `<option value="${c.id}" ${MENU.bonus.cls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            <select id="bonus-kid" aria-label="Kind" ${kids.length ? '' : 'disabled'}><option value="">Kind wählen …</option><option value="*" ${MENU.bonus.kid === '*' ? 'selected' : ''}>Ganze Klasse</option>${kids.map((k) => `<option value="${k.id}" ${MENU.bonus.kid === k.id ? 'selected' : ''}>${esc(kidName(k))}</option>`).join('')}</select>
            ${seg('bonus-n', 'n', MENU.bonus.n, [[5, '+5'], [10, '+10'], [20, '+20']])}
            <button type="button" class="btn primary" data-action="bonus-give">Verteilen</button>
          </div>
        </section>`;
    }
    case 'spiele': return menuGamesHTML(needLogin);
    case 'rechnen':
      return `<div class="field"><span class="label">Malzeichen</span>${setSeg('sign', [['·', '7 · 8 (Malpunkt)'], ['×', '7 × 8 (Kreuz)']])}
          <p class="small muted">Der Malpunkt ist wie im Schweizer Zahlenbuch. Gilt für alle Übungen, Spiele und Übungsblätter.</p></div>
        <label class="switch"><input type="checkbox" id="set-auto" ${s.autoCheck ? 'checked' : ''}><span>Automatisch prüfen, sobald genug Ziffern getippt sind<small>Aus: jede Antwort mit OK bestätigen.</small></span></label>
        ${cloud.user ? '<p class="small muted">Welche Reihen und Aufgabenarten deine Klassen üben, stellst du in der Klasse unter „Reihen“ ein (siehe Klassenübersicht).</p>' : ''}`;
    case 'anzeige':
      return `<label class="switch"><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}><span>Töne<small>Klänge bei richtig und falsch, in den Spielen auch Jubel.</small></span></label>
        <div class="field"><span class="label">Darstellung</span>${setSeg('theme', [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']])}</div>
        <hr>
        <p class="muted small">${cloud.user ? `Angemeldet als <strong>${esc(cloud.user)}</strong>: Klassen und Kinder-Logins sind in deinem Konto gespeichert. Deine eigenen Übungen bleiben in diesem Browser.` : 'Dein Übungsstand wird in diesem Browser gespeichert.'}</p>
        <details class="pw-change"><summary>Übungsstand auf diesem Gerät löschen</summary>
          <p class="small muted">Alle gemerkten Rechnungen, Bestleistungen und die Einmaleins-Tafel werden gelöscht.</p>
          <button type="button" class="btn small danger" data-action="reset-prog">Alles löschen</button></details>`;
    default: return '';
  }
}

/** kleines „✓ Gespeichert“ neben dem Titel statt vieler Meldungen */
let menuSavedTimer = null;
function menuSaved(msg = 'Gespeichert') {
  const el = $('#menu-saved');
  if (!el) return;
  el.innerHTML = `${icon('check')} ${esc(msg)}`; el.classList.add('on');
  clearTimeout(menuSavedTimer); menuSavedTimer = setTimeout(() => el.classList.remove('on'), 1800);
}

/* ---------- Avatar & Münzen: Einstellungen der Lehrperson (gleiche Tabelle wie Vokaboom) ---------- */
async function menuLoadAvatarCfg() {
  MENU.avLoading = true;
  try {
    const c = await cloudClient();
    const { data, error } = await c.from('fab_teacher_settings').select('avatar').eq('teacher_id', cloud.uid).maybeSingle();
    if (error) throw error;
    MENU.avCfg = { ...(data?.avatar || {}) };
  } catch (e) {
    MENU.avCfg = null;
    const b = $('#menu-body');
    if (b && MENU.sec === 'avatar') b.innerHTML = `<p class="banner bad">${icon('x')} Die Avatar-Einstellungen konnten nicht geladen werden. Wurde <code>supabase/avatar.sql</code> in Supabase ausgeführt?</p>`;
    MENU.avLoading = false;
    return;
  }
  MENU.avLoading = false;
  menuRerender('avatar');
}
let menuAvTimer = null;
function menuSaveAvatarCfg() {
  clearTimeout(menuAvTimer);
  menuRerender('avatar');
  menuAvTimer = setTimeout(async () => {
    try {
      const c = await cloudClient();
      const { error } = await c.from('fab_teacher_settings').upsert({ teacher_id: cloud.uid, avatar: MENU.avCfg, updated_at: new Date().toISOString() }, { onConflict: 'teacher_id' });
      if (error) throw error;
      menuSaved();
    } catch (e) { toast('Speichern hat nicht geklappt. Bist du online?', 'bad'); }
  }, 400);
}
async function menuGiveBonus() {
  const { cls, kid: k, n } = MENU.bonus;
  if (!cls || !k) { toast('Wähle zuerst Klasse und Kind.'); return; }
  const ids = k === '*' ? studentsOf(cls).map((x) => x.id) : [k];
  try {
    const c = await cloudClient();
    for (const id of ids) {
      const { error } = await c.rpc('fab_teacher_bonus', { p_student: id, p_n: n });
      if (error) throw error;
    }
    if (typeof confetti === 'function') confetti();
    toast(ids.length > 1 ? `${ids.length} Kinder bekommen je ${n} Münzen. 🪙` : `${n} Münzen verschenkt. 🪙`);
  } catch (e) { toast('Das hat nicht geklappt. Wurde supabase/avatar.sql in Supabase nochmals ausgeführt?', 'bad'); }
}

const menuActions = {
  menu: () => openMenu(),
  'menu-sec': (el) => {
    openMenu(el.dataset.sec);
    $(`.menu-tab[data-sec="${el.dataset.sec}"]`)?.focus({ preventScroll: true });
  },
  'bonus-n': (el) => { MENU.bonus.n = +el.dataset.n; $$('[data-action="bonus-n"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); },
  'bonus-give': () => menuGiveBonus(),
  'menu-class': (el) => { closeModal(true); openClass(el.dataset.id, el.dataset.tab); },
  'menu-class-size': (el) => {
    const c = klass.list.find((x) => x.id === el.dataset.id);
    const big = el.dataset.big === 'true';
    if (!c || !!c.settings.big === big) return;
    c.settings.big = big;
    c.settings.reihen = big ? [...REIHEN_GROSS] : (c.settings.reihen.filter((r) => r <= 10).length ? c.settings.reihen.filter((r) => r <= 10) : [...REIHEN_KLEIN]);
    saveClassSettingsSoon(c, true);
    menuSaved();
    menuRerender('uebersicht');
  },
};

/* ---------- Spieleinstellungen: Spiele sperren (ganze Klasse oder einzelne Kinder, alle oder einzelne Spiele) ---------- */
function menuGamesHTML(needLogin) {
  if (!cloud.user) return needLogin('Spieleinstellungen für deine Klassen');
  if (!klass.loaded) { loadClasses().then(() => { const mb = document.getElementById('menu-body'); if (mb && MENU.sec === 'spiele') mb.innerHTML = menuSectionHTML('spiele'); }); return '<p class="muted"><span class="spinner"></span> Klassen werden geladen …</p>'; }
  const list = klass.list || [];
  if (!list.length) return '<p class="empty">Du hast noch keine Klasse.</p>';
  if (!list.some((c) => c.id === MENU.glCls)) MENU.glCls = list[0].id;
  const c = list.find((x) => x.id === MENU.glCls);
  const lockTxt = (k) => { const st = k.settings || {}; const m = typeof lockMode === 'function' ? lockMode(st.lock) : 'none'; return m === 'all' ? ' 🔒' : m === 'some' || Object.keys(st.kidLock || {}).length ? ' ◐' : ''; };
  return `<p class="small muted">Jede Spielrunde kostet die Kinder 1 Münze (auch „Nochmal“). Üben geht immer weiter, auch wenn Spiele gesperrt sind. Die Sperre kommt an, sobald ein Kind die Seite neu lädt.</p>
    <div class="field"><span class="label">Klasse</span><div class="seg wrap" role="group" aria-label="Klasse">${list.map((k) => `<button type="button" class="seg-btn" data-action="menu-gl-cls" data-cls="${k.id}" aria-pressed="${k.id === c.id}">${esc(k.name)}${lockTxt(k)}</button>`).join('')}</div></div>
    ${classLockHTML(c, { inMenu: true })}
    `;
}
const menuGamesActions = { 'menu-gl-cls': (el) => { MENU.glCls = el.dataset.cls; const mb = document.getElementById('menu-body'); if (mb) mb.innerHTML = menuSectionHTML('spiele'); } };
