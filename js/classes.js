/* Teilmal – Klassen (für Lehrpersonen) und Kinder-Login
 *
 * Lehrperson (mit Konto): Klassen anlegen, Kinder eintragen (Vorname + erster Buchstabe des Nachnamens),
 * Reihen festlegen, Login-Kärtchen als PDF, Übersicht pro Kind und Rechnung, persönliche Übungsblätter.
 * Kind: meldet sich mit Benutzername (z. B. Maus67) und drei Bildern an – oder scannt den QR-Code auf dem
 * Kärtchen. Sein Übungsstand wird ins Konto der Lehrperson gemeldet.
 * Datenbank: supabase/einmaleins.sql
 */
'use strict';

/* =========================================================
   Kinder-Login
   ========================================================= */
const KID_KEY = 'einmaleins.kid';
const KID_DB_KEY = 'einmaleins.kiddb';
const kid = { token: '', first: '', initial: '', username: '', cls: '', settings: null, sent: '', busy: false, again: false, status: 'ok', sso: false, vb: false };
const isKid = () => !!kid.token;
const kidClassSettings = () => (isKid() ? kid.settings || cleanClassSettings({}) : null);
const kidName = (k = kid) => `${k.first || k.first_name || ''}${(k.initial ?? k.last_initial) ? ` ${k.initial ?? k.last_initial}.` : ''}`;
const displayUser = (u) => String(u || '').charAt(0).toUpperCase() + String(u || '').slice(1);
const kidSvgURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const kidWordOf = (username) => (String(username || '').match(/^[a-z]+/) || [''])[0];
const kidWordImg = (username, cls = '') => {
  const s = typeof KID_WORDS === 'object' && KID_WORDS[kidWordOf(username)];
  return s ? `<img class="${cls}" src="${kidSvgURL(s)}" alt="" draggable="false">` : '';
};
const kidPwImg = (i, cls = '') => `<img class="${cls}" src="${kidSvgURL(KID_PW[i].svg)}" alt="${esc(KID_PW[i].de)}" draggable="false">`;
const picsList = (pics) => String(pics || '').split(',').map(Number).filter((n) => n >= 0 && n < 12);
const kidLoginUrl = (st) => `${siteUrl()}#k=${st.username}.${picsList(st.pics).join('-')}`;
// Kurzform fürs Kärtchen: die ersten zwei Buchstaben des Vornamens und der Anfangsbuchstabe („Le. M.“) –
// so sind Kinder mit gleichen Initialen trotzdem auseinanderzuhalten
const kidInitials = (k) => {
  const f = Array.from(String(k.first || k.first_name || '?').trim());
  const li = String((k.initial ?? k.last_initial) || '');
  return `${(f[0] || '?').toUpperCase()}${(f[1] || '').toLowerCase()}.${li ? ` ${li.charAt(0).toUpperCase()}.` : ''}`;
};
// Passwort wie in Vokaboom: ein Wort und eine Zahl („Teich23“), gleiche Wörter wie dort
const KID_PW_WORDS = ['teich', 'wiese', 'wald', 'bach', 'see', 'hafen', 'garten', 'turm', 'strand', 'stein', 'regen', 'schnee', 'nebel', 'wind', 'blatt', 'nest', 'feder', 'kerze', 'lampe', 'tisch', 'stuhl', 'fenster', 'dach', 'zelt', 'kiste', 'korb', 'glocke', 'ring', 'perle', 'mantel', 'schal', 'socke', 'kappe', 'brille', 'pinsel', 'farbe', 'papier', 'karte', 'nudel', 'suppe', 'honig', 'butter', 'zucker', 'kakao', 'tomate', 'gurke', 'karotte', 'mais', 'nuss', 'beere', 'traube', 'zitrone', 'orange', 'flocke', 'welle', 'sonnenhut', 'kugel', 'besen', 'leiter', 'koffer'];
const rndInt = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const newKidPw = () => `${KID_PW_WORDS[rndInt(KID_PW_WORDS.length)]}${10 + rndInt(90)}`;
/** Anzeige wie beim Benutzernamen: gross geschrieben („Teich23“); beim Eintippen spielt gross/klein keine Rolle */
const showPw = (pw) => (pw ? pw.charAt(0).toUpperCase() + pw.slice(1) : '');
function progHash(p) {
  const str = JSON.stringify(p);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + str.length.toString(36);
}

function kidLoadSession() {
  try {
    const d = JSON.parse(localStorage.getItem(KID_KEY) || 'null');
    if (d && typeof d.token === 'string' && d.token) Object.assign(kid, d);
  } catch { /* */ }
  if (isKid()) STORE_KEY = KID_DB_KEY;
}
function kidSaveSession() {
  const { token, first, initial, username, cls, settings, sent, sso, vb } = kid;
  try { localStorage.setItem(KID_KEY, JSON.stringify({ token, first, initial, username, cls, settings, sent, sso, vb })); } catch { /* */ }
}
function kidErrorText(e) {
  const msg = String(e?.message || e || '');
  if (/too_many_attempts/.test(msg)) return 'Zu viele falsche Versuche. Warte 5 Minuten und probier es dann nochmal.';
  if (/session_invalid/.test(msg)) return 'Du wurdest abgemeldet. Melde dich mit deinem Kärtchen neu an.';
  if (/einmaleins_student|could not find the function|PGRST202/i.test(msg)) return 'Die Klassen sind in Supabase noch nicht eingerichtet: supabase/einmaleins.sql ausführen.';
  return cloudErrorText(e);
}

/** Zwei Übungsstände zusammenführen (z. B. Schul-iPad und Computer zu Hause): pro Rechnung gilt der mit mehr Versuchen */
const LOWER_BETTER = new Set(['ex:blitz', 'game:memory']);
function mergeProg(a, b) {
  const A = cleanProg(a), B = cleanProg(b), out = cleanProg(b);
  out.q = Math.max(A.q, B.q);
  out.time = Math.max(A.time, B.time);
  out.at = Math.max(A.at, B.at);
  Object.entries(A.f).forEach(([k, s]) => { const r = B.f[k]; if (!r || s.n > r.n || (s.n === r.n && s.t > r.t)) out.f[k] = s; });
  Object.entries(A.days).forEach(([d, n]) => { out.days[d] = Math.max(n, B.days[d] || 0); });
  const lower = (k) => LOWER_BETTER.has(k) || /^b:[a-z]+:speed:/.test(k); // Speed-Zeiten: weniger ist besser
  Object.entries(A.best).forEach(([k, v]) => { const o = B.best[k]; out.best[k] = o == null ? v : lower(k) ? Math.min(v, o) : Math.max(v, o); });
  // Münzen: es gilt der Stand mit mehr Aktivität (verdient + ausgegeben), damit nichts verloren geht
  const act = (c) => (c ? c.earned + c.spent + c.p / 100 : -1);
  if (act(A.coins) > act(B.coins)) out.coins = { ...A.coins };
  if ((A.lock?.at || 0) > (B.lock?.at || 0)) out.lock = { ...A.lock };
  return out;
}

async function kidLogin(username, pics) {
  const c = await cloudClient();
  const user = String(username || '').trim().toLowerCase();
  const { data, error } = await c.rpc('einmaleins_student_login', { p_username: user, p_pics: Array.isArray(pics) ? pics.join(',') : String(pics || '').trim().slice(0, 80) });
  if (error) throw error;
  if (!data || !data.token) return false;
  await kidStart(data.token, user);
  return isKid();
}
/** Mit einem Anmelde-Schlüssel als Kind anmelden. fromCookie: kam über das gemeinsame Anmelden aus Vokaboom. */
async function kidStart(token, user, { fromCookie = false } = {}) {
  if (isKid()) kidForget(false); else saveDB.flush();
  Object.assign(kid, { token, username: user, first: '', initial: '', cls: '', settings: null, sent: '', status: 'ok', sso: fromCookie, vb: false });
  STORE_KEY = KID_DB_KEY;
  db = { settings: { ...db.settings }, prog: emptyProg() };
  kidSaveSession();
  await kidRefresh();
  if (isKid() && !fromCookie) { kid.sso = SSO.kid.set({ u: kid.username, tool: 'e', t: kid.token }); kidSaveSession(); }
}
async function kidRefresh() {
  if (!isKid()) return;
  const c = await cloudClient();
  const { data, error } = await c.rpc('einmaleins_student_data', { p_token: kid.token });
  if (error) {
    if (/session_invalid/.test(error.message || '')) { kidForget(); toast(kidErrorText(error), 'bad'); return; }
    throw error;
  }
  kid.first = data.student?.first || ''; kid.initial = data.student?.initial || ''; kid.cls = data.class?.name || '';
  kid.username = data.student?.username || kid.username;
  if (kid.vb !== !!data.student?.vokaboom) { kid.vb = !!data.student?.vokaboom; setTimeout(renderAccountSlot, 0); }
  kid.settings = cleanClassSettings(data.class?.settings);
  const local = db.prog;
  const localDirty = kid.sent !== progHash(local) && local.q > 0;
  db.prog = localDirty ? mergeProg(local, data.progress || {}) : cleanProg(data.progress || {});
  if (!localDirty) kid.sent = progHash(db.prog);
  kid.status = 'ok';
  kidSaveSession();
  saveNow();
  renderShell();
  render();
  if (typeof avatarLoad === 'function') avatarLoad(true).then(() => { if (ui.view === 'home' && isKid()) render(); });
}
async function kidPushNow() {
  if (!isKid()) return;
  if (kid.busy) { kid.again = true; return; }
  const h = progHash(db.prog);
  if (h === kid.sent) return;
  kid.busy = true;
  try {
    const c = await cloudClient();
    const { error } = await c.rpc('einmaleins_student_save', { p_token: kid.token, p_data: db.prog });
    if (error) throw error;
    kid.sent = h; kid.status = 'ok';
    kidSaveSession();
  } catch (e) {
    kid.status = 'error';
    if (/session_invalid/.test(e?.message || '')) { kid.busy = false; kidForget(); toast(kidErrorText(e), 'bad'); return; }
  } finally {
    kid.busy = false;
    renderAccountSlot();
  }
  if (kid.again) { kid.again = false; kidPushNow(); }
}
const kidPushSoon = debounce(kidPushNow, 2500);
function onDbSaved() { if (isKid()) kidPushSoon(); }

async function kidLogout() {
  try { await kidPushNow(); } catch { /* */ }
  try { const c = await cloudClient(); await c.rpc('einmaleins_student_logout', { p_token: kid.token }); } catch { /* */ }
  if (SSO.kid.get()?.u === kid.username) SSO.kid.clear(); // gemeinsames Anmelden: auch in Vokaboom abmelden
  kidForget();
  toast('Abgemeldet. Tschüss!');
}
function kidForget(rerender = true) {
  try { localStorage.removeItem(KID_KEY); localStorage.removeItem(KID_DB_KEY); } catch { /* */ }
  Object.assign(kid, { token: '', first: '', initial: '', username: '', cls: '', settings: null, sent: '', status: 'ok', sso: false, vb: false });
  if (typeof AV === 'object') { AV.state = null; AV.draft = null; }
  STORE_KEY = MAIN_STORE_KEY;
  db = { settings: structuredClone(DEFAULT_SETTINGS), prog: emptyProg() };
  loadDB();
  if (!rerender) return;
  closeModal(true);
  stopAll();
  ui.view = 'home';
  renderShell(); render();
}

/** Gemeinsames Anmelden mit Vokaboom (Cookie auf fabulousteaching.ch): Kind übernehmen oder abmelden */
const ssoTried = new Set();
async function kidSsoCheck() {
  if (!SSO.DOMAIN || !cloudConfigured() || cloud.uid || SSO.teacherSignedIn(AUTH_KEY)) return;
  const c = SSO.kid.get();
  if (!c) { if (isKid() && kid.sso) { kidForget(); toast('Abgemeldet.'); } return; }
  if (isKid() && kid.username === c.u) { SSO.kid.set(c); if (!kid.sso) { kid.sso = true; kidSaveSession(); } return; } // Cookie erneuern
  const key = c.tool + c.t;
  if (ssoTried.has(key)) return;
  ssoTried.add(key);
  try {
    let tok = c.tool === 'e' ? c.t : '', user = c.u;
    if (c.tool === 'v') {
      const cl = await cloudClient();
      const { data } = await cl.rpc('einmaleins_kid_bridge', { p_from: 'vokaboom', p_token: c.t });
      if (data?.token) { tok = data.token; user = data.username || c.u; }
    }
    if (!tok) { if (isKid() && kid.sso) { kidForget(); toast('Abgemeldet.'); } return; } // anderes Kind ohne Einmaleins
    await kidStart(tok, user, { fromCookie: true });
    if (isKid()) toast(`Hallo ${kid.first}! Du bist angemeldet.`);
  } catch { /* offline: später nochmals */ ssoTried.delete(key); }
}
/** Knopf „Vokabeln üben“: mit derselben Anmeldung nach Vokaboom */
function goVokaboom() {
  const base = String(CLOUD_CFG.vokaboomUrl || '').trim();
  if (!base) return;
  saveDB.flush();
  kidPushNow().finally(() => { location.href = isKid() ? `${base}#sso=e.${kid.token}` : base; });
}

/** Login über den QR-Code auf dem Kärtchen (…#k=maus67.11-0-2) oder über den Knopf in Vokaboom (…#sso=v.<Schlüssel>) */
async function kidLoginFromHash() {
  const sso = location.hash.match(/^#sso=([ve])\.([0-9a-f-]{36})$/i);
  if (sso) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
    render();
    if (cloud.uid || SSO.teacherSignedIn(AUTH_KEY)) return true;
    try {
      let tok = sso[2], user = '';
      if (sso[1] === 'v') {
        const cl = await cloudClient();
        const { data } = await cl.rpc('einmaleins_kid_bridge', { p_from: 'vokaboom', p_token: sso[2] });
        tok = data?.token || ''; user = data?.username || '';
      }
      if (!tok) { toast('Für dich gibt es in Teilmal noch keine Klasse. Frag deine Lehrperson.', 'bad'); return true; }
      if (isKid() && kid.token === tok) return true;
      await kidStart(tok, user);
      if (isKid()) toast(`Hallo ${kid.first}! Du bist angemeldet.`);
    } catch (e) { toast(kidErrorText(e), 'bad'); }
    return true;
  }
  // QR-Code eines Kärtchens: #k= meldet direkt an, #w= (Kind in beiden Tools) fragt zuerst, wo
  const m = location.hash.match(/^#([kw])=([a-z]+[0-9]{2,4})\.(\d{1,2})-(\d{1,2})-(\d{1,2})$/i);
  if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
  const user = m[2].toLowerCase(), pics = [m[3], m[4], m[5]].map(Number);
  render();
  if (m[1].toLowerCase() === 'w' && !(cloud.uid || SSO.teacherSignedIn(AUTH_KEY))) { openToolChooser(user, pics.join('-')); return true; }
  await kidLoginFromCard(user, pics);
  return true;
}
/* ---------- Ein QR-Code für beide Tools (gleich in Vokaboom und Teilmal) ----------
 * Kinder mit demselben Login in Vokaboom und Teilmal haben auf dem Kärtchen nur einen QR-Code (…#w=baum34.1-2-3).
 * Er fragt „Wo willst du dich anmelden?“: „bei Vokaboom“ oder „bei Teilmal“. Kinder, die nur ein Tool haben,
 * kommen mit ihrem QR-Code (…#k=…) direkt dorthin. */
const TOOL_HERE = 'teilmal';
const TOOL_LOGOS = {
  vokaboom: '<svg viewBox="0 -6 80 78" aria-hidden="true"><defs><linearGradient id="tool-vk-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><rect x="6" y="22" width="36" height="42" rx="10" fill="#FFB703" transform="rotate(-12 24 43)"/><rect x="14" y="20" width="38" height="46" rx="11" fill="url(#tool-vk-g)"/><path d="M23 34l10 18 10-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><g stroke-linecap="round"><path d="M54 13.1L52 2.3" stroke="#EC4899" stroke-width="4"/><path d="M57.8 13.2L63.3 1.9" stroke="#FFB703" stroke-width="4.4"/><path d="M60.3 16.2L70 11" stroke="#EC4899" stroke-width="4"/><path d="M61.5 19.7L68.9 20.5" stroke="#FFB703" stroke-width="3.6"/><path d="M50.2 14.7L45.7 10.6" stroke="#FFB703" stroke-width="3.6"/></g><circle cx="57.9" cy="-1.8" r="2" fill="#EC4899"/><circle cx="75.1" cy="14.7" r="1.9" fill="#FFB703"/><circle cx="71" cy="2.5" r="1.5" fill="#EC4899"/><circle cx="46.5" cy="3.1" r="1.5" fill="#EC4899"/></svg>',
  teilmal: '<svg viewBox="3 11 69 69" aria-hidden="true"><defs><linearGradient id="tool-tm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F766E"/><stop offset="1" stop-color="#0E7490"/></linearGradient></defs><path d="M27 12H56a15 15 0 0 1 15 15V42a15 15 0 0 1-15 15H39L22 70l3-13H27a15 15 0 0 1-15-15V27a15 15 0 0 1 15-15z" fill="#FF6B4A" transform="translate(-5 5) rotate(-7 41 40)"/><path d="M27 12H56a15 15 0 0 1 15 15V42a15 15 0 0 1-15 15H39L22 70l3-13H27a15 15 0 0 1-15-15V27a15 15 0 0 1 15-15z" fill="url(#tool-tm-g)"/><path d="M23 27l15 15M38 27 23 42" stroke="#fff" stroke-width="6.8" stroke-linecap="round"/><g fill="#FF6B4A"><circle cx="54" cy="27.5" r="4.3"/><circle cx="54" cy="41.5" r="4.3"/></g></svg>',
};
/** Adresse fürs Kärtchen: ein QR-Code; bei Kindern in beiden Tools zuerst die Frage, wo sie sich anmelden */
const cardQrUrl = (st, both) => `${siteUrl()}#${both ? 'w' : 'k'}=${st.username}.${picsList(st.pics).join('-')}`;
function openToolChooser(user, pics) {
  const other = String(CLOUD_CFG.vokaboomUrl || '').trim();
  const tile = (tool, name, sub) => {
    const inner = `<span class="tool-logo" aria-hidden="true">${TOOL_LOGOS[tool]}</span><strong>bei ${name}</strong><small>${sub}</small>`;
    return tool === TOOL_HERE || !other
      ? `<button type="button" class="role-tile tool-tile ${tool}" data-action="tool-here" data-u="${esc(user)}" data-p="${esc(pics)}">${inner}</button>`
      : `<a class="role-tile tool-tile ${tool}" href="${esc(other)}#k=${esc(user)}.${esc(pics)}">${inner}</a>`;
  };
  openModal(`
    <header class="modal-head"><h2>Wo willst du dich anmelden?</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schliessen">${icon('x')}</button></header>
    <div class="role-pick tool-pick">
      ${tile('vokaboom', 'Vokaboom', 'ABC Vokabeln üben')}
      ${tile('teilmal', 'Teilmal', '1×1 Rechnen üben')}
    </div>
    <p class="small center muted">Wechseln kannst du später jederzeit mit dem Knopf auf deiner Startseite.</p>`, { label: 'Wo willst du dich anmelden?', cls: 'auth-modal role-modal tool-modal' });
}
/** Login mit dem QR-Code des Kärtchens (Benutzername und Bilder) */
async function kidLoginFromCard(user, pics) {
  if (isKid() && kid.username === user) { render(); return; }
  if (cloud.uid || SSO.teacherSignedIn(AUTH_KEY)) { openTeacherBlocks(); return; }
  toast('Anmelden …');
  try {
    if (await kidLogin(user, pics)) toast(`Hallo ${kid.first}! Du bist angemeldet.`);
    else toast('Dieses Kärtchen gilt nicht mehr. Frag deine Lehrperson nach einem neuen.', 'bad');
  } catch (e) { toast(kidErrorText(e), 'bad'); }
}
function openTeacherBlocks() {
  openModal(`${modalHead('Kinder-Login')}
    <p>Auf diesem Gerät ist gerade eine Lehrperson angemeldet${cloud.user ? ` (<strong>${esc(cloud.user)}</strong>)` : ''}.</p>
    <p class="muted">Damit sich ein Kind anmelden kann, zuerst abmelden. Die Klassen der Lehrperson bleiben in ihrem Konto.</p>
    <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Abbrechen</button><button type="button" class="btn primary" data-action="logout">Lehrperson abmelden</button></footer>`, { label: 'Kinder-Login' });
}

const kidForm = { picks: [] };
function openKidLogin() {
  if (!cloudConfigured()) { openLogin(); return; }
  if (cloud.uid) { openTeacherBlocks(); return; }
  kidForm.picks = [];
  openModal(`${modalHead('Kinder-Login')}
    <form id="kid-form" class="auth-form kid-form" autocomplete="off" novalidate>
      <label class="field" for="kid-user"><span class="label">Dein Benutzername</span>
        <input id="kid-user" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" placeholder="z. B. Baum34" enterkeyhint="next"></label>
      <div class="seg kid-mode" role="group" aria-label="Wie meldest du dich an?">
        <button type="button" class="seg-btn" data-action="kid-pw-mode" data-mode="pics" aria-pressed="true">${icon('image')} Mit Bildern</button>
        <button type="button" class="seg-btn" data-action="kid-pw-mode" data-mode="password" aria-pressed="false">${icon('edit')} Mit Passwort</button>
      </div>
      <div class="kid-pw-pics" id="kid-pw-pics">
        <p class="label">Tippe deine 3 Bilder der Reihe nach an</p>
        <div class="kid-slots" id="kid-slots" aria-live="polite"></div>
        <div class="kid-grid">${KID_PW.map((p, i) => `<button type="button" class="kid-pic" data-action="kid-pick" data-i="${i}" aria-label="${esc(p.de)}">${kidPwImg(i)}</button>`).join('')}</div>
      </div>
      <label class="field kid-pw-words" for="kid-pw" hidden><span class="label">Dein Passwort</span>
        <input id="kid-pw" type="text" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" maxlength="60" placeholder="steht auf deinem Kärtchen" enterkeyhint="go"></label>
      <p class="form-error" id="kid-error" role="alert"></p>
      <button class="btn primary big" type="submit" id="kid-submit">Los geht's ${icon('right')}</button>
    </form>
    <p class="muted small">${icon('image')} Oder scanne den QR-Code auf deinem Kärtchen mit der Kamera.</p>
    <p class="small"><button type="button" class="link-btn" data-action="login-choose">Zurück</button></p>`, { label: 'Kinder-Login', cls: 'auth-modal kid-modal' });
  renderKidSlots();
  let mode = 'pics'; try { mode = localStorage.getItem(KID_MODE_KEY) || 'pics'; } catch { /* */ }
  setKidLoginMode(mode === 'password' ? 'password' : 'pics', false);
  setTimeout(() => $('#kid-user')?.focus(), 60);
  $('#kid-form').addEventListener('submit', (e) => { e.preventDefault(); submitKidLogin(); });
}
const KID_MODE_KEY = 'vokaboom.kidLoginMode'; // gleich wie in Vokaboom
function setKidLoginMode(mode, focus = true) {
  const w = $('.kid-pw-words'), p = $('#kid-pw-pics');
  if (!w) return;
  w.hidden = mode !== 'password'; p.hidden = mode === 'password';
  $$('.kid-mode .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  try { localStorage.setItem(KID_MODE_KEY, mode); } catch { /* */ }
  kidForm.picks = []; renderKidSlots();
  const e = $('#kid-error'); if (e) e.textContent = '';
  if (focus) (!$('#kid-user')?.value.trim() ? $('#kid-user') : mode === 'password' ? $('#kid-pw') : null)?.focus();
}
function renderKidSlots() {
  const box = $('#kid-slots');
  if (!box) return;
  box.innerHTML = [0, 1, 2].map((k) => `<span class="kid-slot ${kidForm.picks[k] != null ? 'full' : ''}"><b>${k + 1}</b>${kidForm.picks[k] != null ? kidPwImg(kidForm.picks[k]) : ''}</span>`).join('')
    + `<button type="button" class="icon-btn subtle" data-action="kid-unpick" aria-label="Letztes Bild wegnehmen" title="Zurück" ${kidForm.picks.length ? '' : 'disabled'}>${icon('left')}</button>`;
}
function kidPick(i) {
  if (kidForm.picks.length >= 3) return;
  kidForm.picks.push(i);
  sfx.flip();
  renderKidSlots();
  if (kidForm.picks.length === 3 && $('#kid-user')?.value.trim()) submitKidLogin();
}
async function submitKidLogin() {
  const err = $('#kid-error'), btn = $('#kid-submit'), input = $('#kid-user');
  if (!err) return;
  const user = input.value.trim().replace(/\s+/g, '');
  if (!user) { err.textContent = 'Schreib zuerst deinen Benutzernamen (er steht auf deinem Kärtchen).'; input.focus(); return; }
  const typed = !$('.kid-pw-words')?.hidden;
  const pwText = ($('#kid-pw')?.value || '').trim();
  if (typed && pwText.replace(/[^a-z0-9äöü]/gi, '').length < 4) { err.textContent = 'Schreib dein Passwort vom Kärtchen.'; $('#kid-pw')?.focus(); return; }
  if (!typed && kidForm.picks.length < 3) { err.textContent = 'Tippe deine 3 Bilder an.'; return; }
  err.textContent = '';
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Anmelden …';
  try {
    const ok = await kidLogin(user, typed ? pwText : kidForm.picks);
    if (!ok) {
      if (!$('#kid-error')) return;
      err.textContent = typed ? 'Benutzername oder Passwort stimmt leider nicht. Schau genau auf dein Kärtchen und probier es nochmal.' : 'Das stimmt leider nicht. Schau genau auf dein Kärtchen und probier es nochmal.';
      sfx.bad();
      kidForm.picks = []; renderKidSlots();
      if (typed) $('#kid-pw')?.select();
      btn.disabled = false; btn.innerHTML = `Los geht's ${icon('right')}`;
      return;
    }
    closeModal(true);
    toast(`Hallo ${kid.first}! Du bist angemeldet.`);
  } catch (e) {
    if (!$('#kid-error')) return;
    err.textContent = kidErrorText(e);
    btn.disabled = false; btn.innerHTML = `Los geht's ${icon('right')}`;
  }
}
function kidAccountButtonHTML() {
  return `<button class="account-btn in kid" data-action="kid-account" title="${esc(kidName())} (${esc(displayUser(kid.username))})" aria-label="Angemeldet als ${esc(kidName())}">
    ${kidWordImg(kid.username, 'kid-av') || icon('user')}<span class="account-name">${esc(kid.first || displayUser(kid.username))}</span><i class="sync-dot ${kid.status === 'error' ? 'error' : kid.busy ? 'syncing' : 'ok'}" aria-hidden="true"></i></button>`;
}
function openKidAccount() {
  openModal(`${modalHead(`Hallo ${esc(kid.first)}!`)}
    <div class="account-card">
      <span class="account-avatar kid-avatar" aria-hidden="true">${kidWordImg(kid.username)}</span>
      <div><strong>${esc(kidName())}</strong><p class="small muted">${esc(kid.cls)} · Benutzername ${esc(displayUser(kid.username))}</p></div>
    </div>
    <p class="muted small">${kid.status === 'error' ? 'Dein Übungsstand konnte gerade nicht gemeldet werden. Er wird gespeichert, sobald es wieder Internet hat.' : 'Was du übst, sieht deine Lehrperson automatisch.'}</p>
    <div class="row">
      <button type="button" class="btn secondary" data-action="kid-refresh">${icon('flip')} Aktualisieren</button>
      <button type="button" class="btn ghost" data-action="kid-logout">Abmelden</button>
    </div>`, { label: 'Mein Login' });
}
function kidHelloHTML() {
  return `<div class="kid-hello">
    <span class="kid-hello-pic" aria-hidden="true">${kidWordImg(kid.username)}</span>
    <div><p class="eyebrow">${esc(kid.cls)}</p><h1>Hallo ${esc(kid.first)}!</h1><p class="lead">Such dir eine Übung oder ein Spiel aus.</p>
      ${kid.vb && CLOUD_CFG.vokaboomUrl ? `<button class="btn small secondary other-tool" data-action="go-vokaboom"><span class="ot-tag">ABC</span> Vokabeln üben</button>` : ''}</div>
  </div>
  ${typeof w3HomeCardsHTML === 'function' && avatarOn() && webglOK() ? (setTimeout(w3HomeSnaps), w3HomeCardsHTML()) : typeof avatarSVG === 'function' && avatarOn() ? `<button class="av-home-card" data-action="avatar-open">
      <span class="av-home-fig">${AV.state ? avatarSVG(AV.state.avatar, { idle: true, label: 'Mein Avatar' }) : ''}</span>
      <span><strong>Mein Avatar${AV.state?.fresh ? '<span class="av-new">Neu</span>' : ''}</strong>
        <span class="muted">${AV.state?.fresh ? 'Gestalte deine eigene Figur!' : 'Frisur, Kleider, Haustier …'}</span><br>
        ${AV_COIN_SVG} <b class="av-coin-n">${AV.state?.coins ?? '…'}</b> Avatar-Münzen – verdiene mehr beim Üben</span>
    </button>` : ''}`;
}

/* =========================================================
   Klassen der Lehrperson
   ========================================================= */
const klass = { list: [], students: {}, progress: {}, locks: {}, loaded: false, loading: null, error: '', tab: 'overview', kidDetail: '', confirm: '', busy: false };
const classById = (id) => klass.list.find((c) => c.id === id);
const currentClass = () => classById(ui.classId);
const studentsOf = (cid) => klass.students[cid] || [];
function cleanClassSettings(s) {
  const o = s && typeof s === 'object' ? s : {};
  const big = !!o.big; // grosses Einmaleins (Reihen bis 20)
  const reihen = Array.isArray(o.reihen) ? o.reihen.map(Number).filter((r) => reihenFor(big).includes(r)) : [];
  const ops = o.ops && typeof o.ops === 'object' ? { mul: o.ops.mul !== false, div: !!o.ops.div, gap: !!o.ops.gap } : { mul: true, div: true, gap: true };
  const roundLen = [10, 15, 20, 30].includes(+o.roundLen) ? +o.roundLen : 20; // Rechnungen pro Runde
  // vbSkip: Kinder aus der verbundenen Vokaboom-Klasse, die nur in Einmaleins gelöscht wurden (nicht wieder holen)
  const vbSkip = Array.isArray(o.vbSkip) ? o.vbSkip.filter((x) => typeof x === 'string').slice(0, 200) : [];
  // Spielsperre: lock = { m: 'all' | 'some', g: [Spiel-IDs] } (ganze Klasse), kidLock = { Benutzername: { m, g } }
  const cleanLock = (l) => (l && l.m === 'all' ? { m: 'all' } : l && l.m === 'some' ? { m: 'some', g: (Array.isArray(l.g) ? l.g : []).filter((x) => typeof x === 'string').slice(0, 40) } : null);
  const lock = cleanLock(o.lock);
  const kidLock = {};
  if (o.kidLock && typeof o.kidLock === 'object') Object.entries(o.kidLock).slice(0, 200).forEach(([u, l]) => { const v = cleanLock(l); if (v && /^[a-z]+[0-9]{2,4}$/.test(u)) kidLock[u] = v; });
  return { big, reihen: reihen.length ? reihen : [...reihenFor(big)], ops, choose: o.choose !== false, roundLen, ...(vbSkip.length ? { vbSkip } : {}), ...(lock ? { lock } : {}), ...(Object.keys(kidLock).length ? { kidLock } : {}) };
}

async function loadClasses() {
  if (klass.loading) return klass.loading;
  klass.loading = (async () => {
    try {
      const c = await cloudClient();
      // lvl 2: mit Verknüpfung zu Vokaboom und Passwörtern, 1: ohne Passwörter, 0: ohne beides (älteres SQL-Skript)
      const get = (lvl) => Promise.all([
        c.from('einmaleins_classes').select(`id,name,settings,created_at${lvl ? ',vokaboom_class' : ''}${lvl > 1 ? ',class_pw' : ''}`).order('created_at'),
        c.from('einmaleins_students').select(`id,class_id,first_name,last_initial,username,pics,created_at${lvl ? ',vokaboom_id' : ''}${lvl > 1 ? ',pw' : ''}`).order('first_name'),
      ]);
      const cfgDone = loadCardCfg(); // Kärtchen-Einstellungen (gleich wie in Vokaboom)
      let [cl, st] = await get(2);
      await cfgDone;
      klass.noLink = false; klass.noPw = false;
      const missing = (re) => [cl.error, st.error].some((e) => e && re.test(e.message || ''));
      if (missing(/class_pw|\.pw\b|"pw"|column pw/)) { klass.noPw = true; [cl, st] = await get(1); }
      if (missing(/vokaboom_(class|id)/)) {
        // Datenbank noch ohne Verknüpfung zu Vokaboom (SQL-Skript nicht neu ausgeführt)
        klass.noLink = true; klass.noPw = true;
        [cl, st] = await get(0);
      }
      if (cl.error) throw cl.error;
      if (st.error) throw st.error;
      klass.list = (cl.data || []).map((x) => ({ ...x, settings: cleanClassSettings(x.settings) }));
      klass.students = {};
      (st.data || []).forEach((s) => { (klass.students[s.class_id] = klass.students[s.class_id] || []).push(s); });
      await loadVokaboom();
      klass.loaded = true; klass.error = '';
    } catch (e) { klass.error = cloudErrorText(e); } finally { klass.loading = null; }
  })();
  return klass.loading;
}
/** Verbundene Klassen: Kinder, die inzwischen in Vokaboom dazugekommen sind, automatisch holen */
async function autoSyncVokaboom() {
  if (klass.noLink || !klass.vb) return;
  const todo = klass.list.filter((c) => c.vokaboom_class && vbPending(c).length);
  if (!todo.length) return;
  let added = 0;
  for (const c of todo) {
    const r = await syncVokaboom(c.id, c.vokaboom_class, false, { reload: false });
    added += (r?.added || 0) + (r?.matched || 0);
  }
  await loadClasses();
  if (added) toast(`${added} ${added === 1 ? 'neues Kind' : 'neue Kinder'} aus Vokaboom übernommen.`);
  if (['classes', 'class'].includes(ui.view)) render();
}
/* ---------- Vokaboom: Klassen und Kinder desselben Kontos (nur lesen) ---------- */
async function loadVokaboom() {
  klass.vb = null;
  try {
    const c = await cloudClient();
    const [a, b] = await Promise.all([
      c.from('vokaboom_classes').select('*').order('created_at'), // mit Klassenpasswort (class_pw)
      c.from('vokaboom_students').select('*').order('first_name'), // mit Passwort (pw) fürs Kärtchen
    ]);
    if (a.error || b.error) return;
    const students = b.data || [];
    klass.vb = { classes: a.data || [], students, byId: new Map(students.map((s) => [s.id, s])) };
    // Übernommene Kinder: immer die aktuellen Bilder und Namen aus Vokaboom anzeigen (dort gelten sie fürs Login)
    Object.values(klass.students).flat().forEach((s) => {
      const v = s.vokaboom_id && klass.vb.byId.get(s.vokaboom_id);
      if (v) Object.assign(s, { pics: v.pics, first_name: v.first_name, last_initial: v.last_initial });
    });
  } catch { /* kein Vokaboom in diesem Projekt */ }
}
const vbClassById = (id) => klass.vb?.classes.find((x) => x.id === id);
const linkedVbIds = () => new Set(Object.values(klass.students).flat().map((s) => s.vokaboom_id).filter(Boolean));
const vbHasKids = (vid) => (klass.vb?.students || []).some((s) => s.class_id === vid);
/** Kinder einer Vokaboom-Klasse, die es in Einmaleins noch nicht gibt (ohne die, die hier gelöscht wurden) */
const vbPending = (c) => {
  const vid = typeof c === 'string' ? c : c.vokaboom_class;
  const skip = new Set(typeof c === 'string' ? [] : c.settings?.vbSkip || []);
  const have = linkedVbIds();
  return (klass.vb?.students || []).filter((s) => s.class_id === vid && !have.has(s.id) && !skip.has(s.id));
};
/** Klasse mit Vokaboom verbinden und abgleichen (beide Richtungen, gleiche Logins) */
async function syncVokaboom(cid, vid, force = false, { reload = true } = {}) {
  try {
    const c = await cloudClient();
    let { data, error } = await c.rpc('einmaleins_sync_vokaboom', { p_class: cid, p_vclass: vid, p_force: force });
    if (error && /einmaleins_sync_vokaboom|PGRST202/.test(error.message + error.code)) {
      ({ data, error } = await c.rpc('einmaleins_import_vokaboom', { p_class: cid, p_vclass: vid })); // ältere Datenbank
    }
    if (error) throw error;
    if (reload) await loadClasses();
    return data || {};
  } catch (e) { toast(classErrorText(e), 'bad'); return null; }
}
function importSummary(r, vName) {
  if (!r) return '';
  const parts = [];
  if (r.added) parts.push(`${r.added} ${r.added === 1 ? 'Kind' : 'Kinder'} aus „${vName}“ übernommen${r.same === r.added ? ', mit demselben Kärtchen' : ''}`);
  if (r.pushed) parts.push(`${r.pushed} ${r.pushed === 1 ? 'Kind' : 'Kinder'} in Vokaboom angelegt`);
  if (r.matched) parts.push(`${r.matched} gleichnamige ${r.matched === 1 ? 'Kind' : 'Kinder'} verbunden (es gilt das Vokaboom-Kärtchen)`);
  if (r.newlogin) parts.push(`${r.newlogin} mit neuem Benutzernamen (schon vergeben)`);
  if (r.conflicts) parts.push(`${r.conflicts} nicht in Vokaboom angelegt (Benutzername dort vergeben)`);
  if (r.updated) parts.push(`${r.updated} Namen oder Bilder nachgeführt`);
  if (r.skipped || r.full_v) parts.push(`${(r.skipped || 0) + (r.full_v || 0)} nicht übernommen (höchstens 60 Kinder pro Klasse)`);
  return parts.length ? parts.join(', ') + '.' : 'Alles ist abgeglichen.';
}
async function importVokaboomClass(vid) {
  const v = vbClassById(vid);
  if (!v) return;
  const existing = klass.list.find((x) => x.vokaboom_class === vid);
  if (existing) { openClass(existing.id, 'kids'); return; }
  try {
    const c = await cloudClient();
    const settings = cleanClassSettings({});
    const { data, error } = await c.from('einmaleins_classes').insert({ name: v.name.slice(0, 60), settings }).select('id').single();
    if (error) throw error;
    const r = await syncVokaboom(data.id, vid, true);
    openClass(data.id, 'kids');
    if (r) toast(importSummary(r, v.name));
  } catch (e) { toast(classErrorText(e), 'bad'); }
}
function vbClassesPanelHTML() {
  if (!klass.vb?.classes.some((v) => vbHasKids(v.id))) return '';
  if (klass.noLink) return `<div class="panel vb-panel"><h2>Aus Vokaboom übernehmen</h2><p class="hint">Damit Klassen mit denselben Kinder-Logins übernommen werden können, bitte <code>supabase/einmaleins.sql</code> in Supabase nochmals ganz ausführen.</p></div>`;
  return `<div class="panel vb-panel">
    <h2>Aus Vokaboom übernehmen</h2>
    <p class="hint">Die Kinder behalten ihren Benutzernamen und ihre 3 Bilder: ein Kärtchen für beide Tools. Die Klassen bleiben verbunden – neue Kinder kommen automatisch auf beide Seiten.</p>
    <ul class="class-list">${klass.vb.classes.filter((v) => vbHasKids(v.id) || klass.list.some((x) => x.vokaboom_class === v.id)).map((v) => {
      const n = klass.vb.students.filter((s) => s.class_id === v.id).length;
      const ex = klass.list.find((x) => x.vokaboom_class === v.id);
      return `<li class="lib-item"><span class="lib-open static"><span class="class-badge vb" aria-hidden="true">${esc(v.name.slice(0, 3))}</span>
        <span class="lib-text"><strong>${esc(v.name)}</strong><small>${n} ${n === 1 ? 'Kind' : 'Kinder'}${ex ? ` · verbunden mit „${esc(ex.name)}“` : ''}</small></span></span>
        ${ex ? `<button class="btn small ghost" data-action="class-open" data-id="${ex.id}">Öffnen</button>` : `<button class="btn small secondary" data-action="vb-class-import" data-id="${v.id}">${icon('plus')} Übernehmen</button>`}</li>`;
    }).join('')}</ul>
  </div>`;
}

async function loadClassProgress(cid) {
  const ids = studentsOf(cid).map((s) => s.id);
  const map = {};
  if (ids.length) {
    const c = await cloudClient();
    const { data, error } = await c.from('einmaleins_progress').select('student_id,data,updated_at').in('student_id', ids);
    if (error) throw error;
    (data || []).forEach((r) => { map[r.student_id] = { prog: cleanProg(r.data), at: Date.parse(r.updated_at) || 0 }; });
  }
  klass.progress[cid] = map;
  await loadCoinLocks(cid, ids);
}
/** Münzensperren der Lehrperson (supabase/avatar.sql). Fehlt die Funktion noch, geht die Übersicht trotzdem. */
async function loadCoinLocks(cid, ids = studentsOf(cid).map((s) => s.id)) {
  try {
    if (!ids.length) { klass.locks[cid] = { map: {} }; return; }
    const c = await cloudClient();
    const { data, error } = await c.rpc('fab_teacher_coin_locks', { p_students: ids });
    if (error) throw error;
    klass.locks[cid] = { map: data || {} };
  } catch (e) {
    const missing = /PGRST202|Could not find the function|fab_teacher_coin_locks/i.test(`${e?.code || ''} ${e?.message || ''}`);
    klass.locks[cid] = { map: {}, missing, error: missing ? '' : cloudErrorText(e) };
  }
}
/** Ende der Sperre: 'day' = heute, Zahl = so viele Tage (bis zum Abend), '0' = bis die Lehrperson sie aufhebt */
function coinLockUntil(dur) {
  if (String(dur) === '0') return null;
  const d = new Date();
  if (dur !== 'day') d.setDate(d.getDate() + Math.max(1, Math.min(60, parseInt(dur, 10) || 7)));
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}
async function setCoinLock(sid, on, dur = '7') {
  const cid = ui.classId, st = studentsOf(cid).find((x) => x.id === sid);
  if (!st) { toast('Bitte zuerst ein Kind auswählen.'); return; }
  try {
    const c = await cloudClient();
    const until = on ? coinLockUntil(dur) : null;
    const { data, error } = await c.rpc('fab_teacher_coin_lock', { p_student: sid, p_on: !!on, p_until: until, p_note: '' });
    if (error) throw error;
    const L = klass.locks[cid] || (klass.locks[cid] = { map: {} });
    if (on && data) L.map[sid] = data; else delete L.map[sid];
    toast(on ? `🔒 ${kidName(st)} bekommt ${coinLockUntilText(data?.until ?? until)} keine Münzen.` : `🔓 Die Münzen von ${kidName(st)} sind wieder frei.`);
  } catch (e) {
    const missing = /PGRST202|Could not find the function|fab_teacher_coin_lock/i.test(`${e?.code || ''} ${e?.message || ''}`);
    toast(missing ? 'Für Münzensperren bitte supabase/avatar.sql in Supabase noch einmal ausführen.' : classErrorText(e), 'bad');
  }
  if (ui.view === 'class') render();
}
const coinLockUntilText = (until) => {
  if (!until) return 'bis du die Sperre aufhebst';
  const d = new Date(until);
  return d.toDateString() === new Date().toDateString() ? 'für heute' : `bis ${d.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric' })}`;
};
function classErrorText(e) {
  const msg = String(e?.message || e || '');
  if (/class_full/.test(msg)) return 'In einer Klasse haben höchstens 60 Kinder Platz.';
  if (/no_vokaboom/.test(msg)) return 'In diesem Supabase-Projekt gibt es keine Vokaboom-Klassen.';
  if (/einmaleins_import_vokaboom/.test(msg)) return 'Für die Übernahme aus Vokaboom bitte supabase/einmaleins.sql in Supabase nochmals ganz ausführen.';
  return cloudErrorText(e);
}

function openClasses() {
  if (!cloud.uid) { toast('Für Klassen brauchst du ein Konto. Melde dich zuerst an.'); openLogin(); return; }
  closeModal(true);
  klass.confirm = '';
  go('classes');
  loadClasses().then(() => { if (ui.view === 'classes') render(); autoSyncVokaboom(); });
}
function openClass(id, tab) {
  const kids = studentsOf(id);
  klass.tab = tab || (kids.length ? 'overview' : 'kids'); klass.confirm = ''; klass.kidDetail = '';
  go('class', { classId: id });
  if (klass.tab === 'overview') refreshStats();
}
function classesCrumbs() {
  const c = currentClass();
  return `<span class="crumb-sep" aria-hidden="true">/</span>${ui.view === 'class' ? '<button class="crumb" data-action="classes"><span>Klassen</span></button>' : '<span class="crumb current">Klassen</span>'}`
    + (ui.view === 'class' && c ? `<span class="crumb-sep sep-current" aria-hidden="true">/</span><span class="crumb current">${esc(c.name)}</span>` : '');
}

function renderClasses() {
  const v = $('#view');
  if (!cloud.uid) { ui.view = 'home'; render(); return; }
  const body = klass.error ? `<p class="banner bad">${icon('x')} ${esc(klass.error)}</p>`
    : !klass.loaded ? '<p class="muted"><span class="spinner"></span> Klassen werden geladen …</p>'
      : klass.list.length ? `<ul class="class-list">${klass.list.map((c) => {
        if (klass.confirm === c.id) {
          return `<li class="lib-item confirm"><span class="lib-text"><strong>Klasse „${esc(c.name)}“ löschen?</strong><small>Alle Logins und der Übungsstand dieser Klasse werden gelöscht.</small></span>
            <span class="lib-confirm"><button class="btn small danger" data-action="class-delete-yes" data-id="${c.id}">Löschen</button><button class="btn small ghost" data-action="class-delete-no">Behalten</button></span></li>`;
        }
        const n = studentsOf(c.id).length;
        const r = `${c.settings.big ? 'Grosses' : 'Kleines'} Einmaleins · ${c.settings.reihen.length === reihenFor(c.settings.big).length ? 'alle Reihen' : `${c.settings.reihen.length === 1 ? 'Reihe' : 'Reihen'} ${c.settings.reihen.join(', ')}`}`;
        return `<li class="lib-item"><button class="lib-open" data-action="class-open" data-id="${c.id}">
            <span class="class-badge" aria-hidden="true">${esc(c.name.slice(0, 3))}</span>
            <span class="lib-text"><strong>${esc(c.name)}</strong><small>${n} ${n === 1 ? 'Kind' : 'Kinder'} · ${esc(r)}${c.vokaboom_class && vbClassById(c.vokaboom_class) ? ' <span class="vb-tag">mit Vokaboom verbunden</span>' : ''}</small></span></button>
          <button class="icon-btn subtle" data-action="class-delete" data-id="${c.id}" aria-label="Klasse „${esc(c.name)}“ löschen" title="Löschen">${icon('trash')}</button></li>`;
      }).join('')}</ul>` : '<p class="empty">Noch keine Klasse. Lege links deine erste Klasse an.</p>';
  v.innerHTML = `<section class="classes-view">
    <div class="mode-bar"><h1 class="mode-title">Meine Klassen</h1></div>
    <div class="classes-grid">
      <div class="side-col"><form class="panel" id="new-class-form" autocomplete="off">
        <h2>Neue Klasse</h2>
        <label class="field" for="new-class"><span class="label">Name der Klasse</span><input id="new-class" type="text" maxlength="60" placeholder="z. B. 3a Mathe"></label>
        <button class="btn primary" type="submit">${icon('plus')} Klasse anlegen</button>
        <p class="hint">Danach trägst du die Kinder ein, wählst die Reihen aus und druckst die Login-Kärtchen.</p>
      </form>${klass.loaded ? vbClassesPanelHTML() : ''}</div>
      <div class="panel"><h2>Klassen</h2>${body}</div>
    </div>
    <p class="muted small privacy-note">${icon('check')} Gespeichert werden nur der Vorname und der erste Buchstabe des Nachnamens – keine E-Mail-Adressen der Kinder.</p>
  </section>`;
  $('#new-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#new-class').value.trim();
    if (!name) { $('#new-class').focus(); return; }
    try {
      const c = await cloudClient();
      const settings = cleanClassSettings({});
      const { data, error } = await c.from('einmaleins_classes').insert({ name, settings }).select('id,name,settings,created_at').single();
      if (error) throw error;
      klass.list.push({ ...data, settings: cleanClassSettings(data.settings) });
      openClass(data.id, 'kids');
      toast(`Klasse „${name}“ angelegt. Trag jetzt die Kinder ein.`);
    } catch (ex) { toast(classErrorText(ex), 'bad'); }
  });
}
async function deleteClass(id) {
  try {
    const c = await cloudClient();
    const { error } = await c.from('einmaleins_classes').delete().eq('id', id);
    if (error) throw error;
    klass.list = klass.list.filter((x) => x.id !== id);
    delete klass.students[id];
    klass.confirm = '';
    render();
    toast('Klasse gelöscht.');
  } catch (e) { toast(classErrorText(e), 'bad'); }
}

/* ---------- Eine Klasse ---------- */
const CLASS_TABS = [['overview', 'chart', 'Übersicht'], ['kids', 'users', 'Kinder'], ['settings', 'sliders', 'Reihen'], ['cards', 'image', 'Kärtchen']];
function renderClass() {
  const v = $('#view');
  const c = currentClass();
  if (!klass.loaded) { v.innerHTML = '<p class="muted"><span class="spinner"></span> Wird geladen …</p>'; loadClasses().then(() => { if (ui.view === 'class') render(); autoSyncVokaboom(); }); return; }
  if (!c) { ui.view = 'classes'; render(); return; }
  const kids = studentsOf(c.id);
  const body = klass.tab === 'kids' ? classKidsHTML(c, kids) : klass.tab === 'settings' ? classSettingsHTML(c) + classLockNoteHTML(c) : klass.tab === 'cards' ? classCardsHTML(c, kids) : classOverviewHTML(c, kids);
  v.innerHTML = `<section class="class-view">
    <div class="mode-bar class-bar">
      <h1 class="mode-title">${esc(c.name)}</h1>
      <button class="btn ghost small" data-action="class-rename">${icon('edit')} Umbenennen</button>
    </div>
    <div class="seg class-tabs" role="tablist" aria-label="Bereiche der Klasse">
      ${CLASS_TABS.map(([k, ic, t]) => `<button class="seg-btn" role="tab" data-action="class-tab" data-tab="${k}" aria-selected="${klass.tab === k}" aria-pressed="${klass.tab === k}">${icon(ic)}<span>${t}</span></button>`).join('')}
    </div>
    <div class="class-body">${body}</div>
  </section>`;
  if (klass.tab === 'kids') bindClassKids(c);
  if (klass.tab === 'cards') renderCardPreviews(c, kids);
  if (klass.tab === 'overview') bindOverview(c);
}

/* ---------- Kinder ---------- */
function classKidsHTML(c, kids) {
  const rows = kids.map((s) => {
    if (klass.confirm === s.id) {
      const linked = s.vokaboom_id && klass.vb?.byId.get(s.vokaboom_id);
      return linked
        ? `<li class="kid-row confirm"><span><strong>${esc(kidName(s))} löschen?</strong> <small class="muted">Das Kind ist auch in Vokaboom. Der Übungsstand in Teilmal wird gelöscht.</small></span>
          <span class="lib-confirm"><button class="btn small danger" data-action="kid-delete-yes" data-id="${s.id}" data-where="here">Nur in Teilmal</button><button class="btn small danger" data-action="kid-delete-yes" data-id="${s.id}" data-where="both">Auch in Vokaboom</button><button class="btn small ghost" data-action="kid-delete-no">Behalten</button></span></li>`
        : `<li class="kid-row confirm"><span><strong>${esc(kidName(s))} löschen?</strong> <small class="muted">Das Login und der Übungsstand werden gelöscht.</small></span>
          <span class="lib-confirm"><button class="btn small danger" data-action="kid-delete-yes" data-id="${s.id}">Löschen</button><button class="btn small ghost" data-action="kid-delete-no">Behalten</button></span></li>`;
    }
    return `<li class="kid-row">
      <span class="kid-av-big" aria-hidden="true">${kidWordImg(s.username)}</span>
      <span class="kid-who"><strong>${esc(kidName(s))}</strong><small>${esc(displayUser(s.username))}${s.vokaboom_id && klass.vb?.byId.get(s.vokaboom_id) ? ' <span class="vb-tag" title="Gleiches Kärtchen wie in Vokaboom">auch in Vokaboom</span>' : ''}</small></span>
      ${kidSecretOf(s) === 'password' ? `<span class="kid-pw-text" aria-label="Passwort">${esc(showPw(kidPwOf(s)))}</span>`
        : kidSecretOf(s) === 'class' ? '<span class="kid-pw-text muted" title="Klassenpasswort">Klassenpasswort</span>'
          : `<span class="kid-pw" aria-label="Bilder-Passwort">${picsList(s.pics).map((i) => `<span>${kidPwImg(i)}</span>`).join('')}</span>`}
      <span class="kid-actions">
        <button class="icon-btn subtle" data-action="kid-newpics" data-id="${s.id}" title="Neues Passwort (neue Bilder)" aria-label="Neues Passwort für ${esc(kidName(s))}">${icon('shuffle')}</button>
        <button class="icon-btn subtle" data-action="kid-delete" data-id="${s.id}" title="Löschen" aria-label="${esc(kidName(s))} löschen">${icon('trash')}</button>
      </span>
    </li>`;
  }).join('');
  return `<div class="class-grid">
    <div class="panel">
      <h2>Kind hinzufügen</h2>
      <form id="add-kid-form" class="add-kid" autocomplete="off">
        <label class="field" for="kid-first"><span class="label">Vorname</span><input id="kid-first" type="text" maxlength="40" autocomplete="off" placeholder="Lena"></label>
        <label class="field initial-field" for="kid-initial"><span class="label">Nachname</span><input id="kid-initial" class="initial-box" type="text" maxlength="1" autocomplete="off" placeholder="M" aria-describedby="initial-hint"></label>
        <button class="btn primary" type="submit">${icon('plus')} Hinzufügen</button>
      </form>
      <p class="hint" id="initial-hint">Vom Nachnamen nur den ersten Buchstaben.</p>
      <details class="kid-import">
        <summary>Mehrere Kinder auf einmal (Liste einfügen)</summary>
        <textarea id="kid-import" rows="7" spellcheck="false" placeholder="Lena Meier&#10;Tim Keller&#10;Noah"></textarea>
        <p class="hint">Eine Zeile pro Kind: Vorname und Nachname. Gespeichert wird nur der erste Buchstabe des Nachnamens. Eine Liste aus Excel kannst du direkt einfügen.</p>
        <div id="kid-import-preview" class="muted small"></div>
        <button class="btn secondary" type="button" data-action="kid-import">${icon('plus')} Alle hinzufügen</button>
      </details>
      ${vbKidsBoxHTML(c)}
    </div>
    <div class="panel">
      <h2>${kids.length} ${kids.length === 1 ? 'Kind' : 'Kinder'}</h2>
      ${kids.length ? `<ul class="kid-list">${rows}</ul>
        <div class="row"><button class="btn primary" data-action="class-tab" data-tab="cards">${icon('image')} Login-Kärtchen ansehen</button></div>`
        : '<p class="empty">Noch keine Kinder. Trag links die Namen ein.</p>'}
    </div>
  </div>`;
}
function parseKidLine(line) {
  const l = line.replace(/\s+/g, ' ').trim();
  if (!l) return null;
  let first = '', last = '';
  const parts = l.split(/\t|;/).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) { first = parts[0]; last = parts[1]; }
  else if (l.includes(',')) { const [a, b] = l.split(',').map((x) => x.trim()); first = b || a; last = b ? a : ''; }
  else { const t = l.split(' '); first = t.slice(0, Math.max(1, t.length - 1)).join(' '); last = t.length > 1 ? t[t.length - 1] : ''; }
  first = first.slice(0, 40);
  const initial = (last.match(/\p{L}/u) || [''])[0].toUpperCase();
  return first ? { first, initial } : null;
}
function bindClassKids(c) {
  const ini = $('#kid-initial');
  ini?.addEventListener('input', () => { ini.value = (ini.value.match(/\p{L}/u) || [''])[0].toUpperCase(); });
  $('#add-kid-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = $('#kid-first').value.trim();
    if (!first) { $('#kid-first').focus(); return; }
    await addKids(c, [{ first, initial: ini.value.trim() }]);
    setTimeout(() => $('#kid-first')?.focus(), 30);
  });
  const ta = $('#kid-import');
  ta?.addEventListener('input', () => {
    const list = ta.value.split(/\r?\n/).map(parseKidLine).filter(Boolean);
    $('#kid-import-preview').textContent = list.length ? `${list.length} erkannt: ${list.slice(0, 8).map((k) => `${k.first}${k.initial ? ` ${k.initial}.` : ''}`).join(', ')}${list.length > 8 ? ' …' : ''}` : '';
  });
}
async function addKids(c, list) {
  if (!list.length || klass.busy) return;
  klass.busy = true;
  try {
    const cl = await cloudClient();
    const { data, error } = await cl.rpc('einmaleins_add_students', { p_class: c.id, p_students: list });
    if (error) throw error;
    const arr = klass.students[c.id] = klass.students[c.id] || [];
    (data || []).forEach((s) => arr.push(s));
    arr.sort((a, b) => a.first_name.localeCompare(b.first_name, 'de'));
    const inVb = c.vokaboom_class && (data || []).some((x) => x.vokaboom_id);
    if (inVb) await loadVokaboom();
    render();
    toast((list.length === 1 ? `${list[0].first} ist dabei.` : `${(data || []).length} Kinder hinzugefügt.`) + (inVb ? ' Auch in Vokaboom, mit demselben Kärtchen.' : ''));
  } catch (e) { toast(classErrorText(e), 'bad'); } finally { klass.busy = false; }
}
function vbKidsBoxHTML(c) {
  if (!klass.vb) return '';
  if (klass.noLink) return '<div class="vb-import"><p class="hint">Mit Vokaboom verbinden (gleiche Kärtchen): bitte zuerst <code>supabase/einmaleins.sql</code> in Supabase nochmals ganz ausführen.</p></div>';
  const v = c.vokaboom_class && vbClassById(c.vokaboom_class);
  if (v) {
    const n = vbPending(c).length, skipped = (c.settings.vbSkip || []).filter((id) => klass.vb.byId.has(id)).length;
    return `<div class="vb-import"><p class="small"><span class="vb-tag">Vokaboom</span> Verbunden mit „${esc(v.name)}“: Jedes Kind hat in beiden Tools dasselbe Kärtchen. Neue Kinder kommen automatisch auf beide Seiten.</p>
      <div class="row"><button class="btn ${n ? 'secondary' : 'ghost'} small" type="button" data-action="vb-sync">${icon('flip')} ${n ? `${n === 1 ? '1 neues Kind' : `${n} neue Kinder`} aus Vokaboom holen` : 'Jetzt abgleichen'}</button>
      ${skipped ? `<button class="btn ghost small" type="button" data-action="vb-sync-force">${skipped} hier gelöschte wieder holen</button>` : ''}</div></div>`;
  }
  return `<div class="vb-import"><button class="btn ghost small" type="button" data-action="vokaboom-import">${icon('users')} Mit Vokaboom verbinden (gleiche Kärtchen)</button></div>`;
}
/** Diese Klasse mit einer Vokaboom-Klasse verbinden – bestehende wählen oder neu anlegen */
function openVokaboomImport() {
  const c = currentClass();
  if (!c) return;
  const taken = new Set(klass.list.filter((x) => x.vokaboom_class && x.id !== c.id).map((x) => x.vokaboom_class));
  const list = (klass.vb?.classes || []).filter((x) => !taken.has(x.id));
  openModal(`${modalHead('Mit Vokaboom verbinden')}
    <p class="muted small">Danach hat jedes Kind in beiden Tools denselben Benutzernamen und dieselben 3 Bilder – ein Kärtchen. Kinder aus Vokaboom kommen nach Teilmal, Kinder aus Teilmal nach Vokaboom. Gleichnamige Kinder werden nicht doppelt angelegt, sondern verbunden (dann gilt das Vokaboom-Kärtchen).</p>
    ${list.length ? `<p class="label">Bestehende Vokaboom-Klasse</p><ul class="class-list">${list.map((x) => {
      const n = klass.vb.students.filter((s) => s.class_id === x.id).length;
      return `<li class="lib-item"><button class="lib-open" data-action="vokaboom-take" data-id="${x.id}"><span class="class-badge vb" aria-hidden="true">${esc(x.name.slice(0, 3))}</span><span class="lib-text"><strong>${esc(x.name)}</strong><small>${n} ${n === 1 ? 'Kind' : 'Kinder'}</small></span></button></li>`;
    }).join('')}</ul>` : ''}
    <p class="label">Oder neu</p>
    <button class="btn secondary" data-action="vokaboom-new">${icon('plus')} Klasse „${esc(c.name)}“ in Vokaboom anlegen</button>`, { label: 'Mit Vokaboom verbinden' });
}
async function vokaboomTake(vid) {
  const c = currentClass();
  closeModal(true);
  if (!c) return;
  const r = await syncVokaboom(c.id, vid, true);
  render();
  if (r) toast(importSummary(r, vbClassById(vid)?.name || 'Vokaboom'));
}
/** Neue Vokaboom-Klasse mit demselben Namen anlegen und verbinden: Alle Kinder bekommen dort dasselbe Login */
async function vokaboomNew() {
  const c = currentClass();
  closeModal(true);
  if (!c) return;
  try {
    const cl = await cloudClient();
    const { data, error } = await cl.from('vokaboom_classes').insert({ name: c.name.slice(0, 60) }).select('id').single();
    if (error) throw error;
    const r = await syncVokaboom(c.id, data.id, true);
    render();
    if (r) toast(`Klasse „${c.name}“ in Vokaboom angelegt. ${importSummary(r, c.name)}`);
  } catch (e) { toast(classErrorText(e), 'bad'); }
}
async function vokaboomSync(force = false) {
  const c = currentClass();
  if (!c?.vokaboom_class) return;
  const r = await syncVokaboom(c.id, c.vokaboom_class, force);
  render();
  if (r) toast(importSummary(r, vbClassById(c.vokaboom_class)?.name || 'Vokaboom'));
}
function randomPics() {
  const all = [...Array(12).keys()];
  for (let i = all.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 3).join(',');
}
async function kidNewPics(id) {
  const c = currentClass();
  const s = studentsOf(c?.id).find((x) => x.id === id);
  if (!s) return;
  let pics = randomPics();
  while (pics === s.pics) pics = randomPics();
  try {
    const cl = await cloudClient();
    const v = s.vokaboom_id ? klass.vb?.byId.get(s.vokaboom_id) : null;
    const pw = newKidPw();
    if (s.vokaboom_id) {
      // wie in Vokaboom: neue Bilder und neues Passwort, das alte Kärtchen gilt nicht mehr
      const r = await cl.from('vokaboom_students').update(v?.pw ? { pics, pw, ...('pw_prev' in v ? { pw_prev: null } : {}) } : { pics }).eq('id', s.vokaboom_id);
      if (r.error) throw r.error;
      if (v) { v.pics = pics; if (v.pw) v.pw = pw; if ('pw_prev' in v) v.pw_prev = null; }
    }
    const { error } = await cl.from('einmaleins_students').update('pw' in s ? { pics, pw } : { pics }).eq('id', id);
    if (error) throw error;
    s.pics = pics; if ('pw' in s) s.pw = pw;
    render();
    toast(s.vokaboom_id
      ? `${kidName(s)} hat ein neues Passwort und neue Bilder – in Teilmal und Vokaboom. Das alte Kärtchen gilt nicht mehr, druck ein neues aus.`
      : `${kidName(s)} hat ${'pw' in s ? 'ein neues Passwort und neue Bilder' : 'neue Bilder'}. Das alte Kärtchen gilt nicht mehr – druck ein neues aus.`);
  } catch (e) { toast(classErrorText(e), 'bad'); }
}
async function kidDelete(id, where = '') {
  const c = currentClass();
  const s = studentsOf(c?.id).find((x) => x.id === id);
  try {
    const cl = await cloudClient();
    if (s?.vokaboom_id && where === 'both') {
      const r = await cl.from('vokaboom_students').delete().eq('id', s.vokaboom_id);
      if (r.error) throw r.error;
    } else if (s?.vokaboom_id && where === 'here') {
      // merken, damit der automatische Abgleich das Kind nicht wieder aus Vokaboom holt
      const settings = { ...c.settings, vbSkip: [...new Set([...(c.settings.vbSkip || []), s.vokaboom_id])] };
      const r = await cl.from('einmaleins_classes').update({ settings }).eq('id', c.id);
      if (r.error) throw r.error;
      c.settings = settings;
    }
    const { error } = await cl.from('einmaleins_students').delete().eq('id', id);
    if (error) throw error;
    klass.students[c.id] = studentsOf(c.id).filter((x) => x.id !== id);
    klass.confirm = '';
    if (where === 'both') await loadVokaboom();
    render();
  } catch (e) { toast(classErrorText(e), 'bad'); }
}
async function renameClass() {
  const c = currentClass();
  if (!c) return;
  const name = (prompt('Neuer Name der Klasse:', c.name) || '').trim().slice(0, 60);
  if (!name || name === c.name) return;
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('einmaleins_classes').update({ name }).eq('id', c.id);
    if (error) throw error;
    c.name = name; render();
  } catch (e) { toast(classErrorText(e), 'bad'); }
}

/* ---------- Spiele sperren: ganze Klasse oder einzelne Kinder, alle Spiele oder einzelne (wie in Vokaboom) ---------- */
function lockMode(l) { return l && (l.m === 'all' || l.m === 'some') ? l.m : 'none'; }
function lockGamesHTML(l, attrs) {
  const off = new Set(l?.g || []);
  return `<div class="gl-games">${GAMES.map((g) => `<button type="button" class="gl-game ${off.has(g.id) ? 'on' : ''}" ${attrs} data-game="${g.id}" aria-pressed="${off.has(g.id)}" title="${off.has(g.id) ? 'Gesperrt – antippen zum Freigeben' : 'Frei – antippen zum Sperren'}"><span aria-hidden="true">${g.art}</span>${esc(g.name)}${off.has(g.id) ? ' 🔒' : ''}</button>`).join('')}</div>`;
}
function classLockHTML(c, { inMenu = false } = {}) {
  const st = c.settings || {}, cl = st.lock, cm = lockMode(cl), kids = studentsOf(c.id), kl = st.kidLock || {};
  const seg = (attrs, mode) => `<div class="seg small" role="group">${[['none', 'Frei'], ['all', '🔒 Alle Spiele'], ['some', 'Einzelne Spiele']].map(([v, t]) => `<button type="button" class="seg-btn" ${attrs} data-v="${v}" aria-pressed="${mode === v}">${t}</button>`).join('')}</div>`;
  const nKids = kids.filter((k) => lockMode(kl[k.username]) !== 'none').length;
  const classTxt = cm === 'all' ? 'Alle Spiele sind für die ganze Klasse gesperrt. Üben geht weiter.' : cm === 'some' ? `${(cl.g || []).length} ${(cl.g || []).length === 1 ? 'Spiel ist' : 'Spiele sind'} für die ganze Klasse gesperrt.` : 'Alle Spiele sind frei.';
  return `<div class="${inMenu ? 'menu-group' : 'panel'} gl-panel">
    <h${inMenu ? 3 : 2}>🎮 Spiele sperren${inMenu ? '' : ''}</h${inMenu ? 3 : 2}>
    <p class="hint">Gilt sofort beim nächsten Laden der Kinder. Üben geht immer weiter.</p>
    <div class="field"><span class="label">Ganze Klasse</span>${seg(`data-action="glock-class" data-cls="${c.id}"`, cm)}
      <small class="muted">${classTxt}</small>
      ${cm === 'some' ? lockGamesHTML(cl, `data-action="glock-class-game" data-cls="${c.id}"`) : ''}</div>
    ${kids.length ? `<details class="gl-kids" ${klass.glOpen || nKids ? 'open' : ''}><summary>Einzelne Kinder <small class="muted">(${nKids ? `${nKids} mit eigener Sperre` : 'keine eigene Sperre'})</small></summary>
      ${cm === 'all' ? '<p class="small muted">Gerade sind für die ganze Klasse alle Spiele gesperrt – das gilt für alle Kinder.</p>' : ''}
      <ul class="gl-kid-list">${kids.map((k) => {
        const l = kl[k.username], m = lockMode(l);
        return `<li class="gl-kid ${m !== 'none' ? 'locked' : ''}"><span class="gl-kid-name">${esc(kidName(k))}</span>
          ${seg(`data-action="glock-kid" data-cls="${c.id}" data-kid="${esc(k.username)}"`, m)}
          ${m === 'some' ? lockGamesHTML(l, `data-action="glock-kid-game" data-cls="${c.id}" data-kid="${esc(k.username)}"`) : ''}</li>`;
      }).join('')}</ul>
      <p class="small muted">Die Sperre eines Kindes kommt zur Klassen-Sperre dazu.</p></details>` : ''}
  </div>`;
}
/** In der Klasse: kurzer Stand und Knopf zu Menü → Spieleinstellungen */
function classLockNoteHTML(c) {
  const st = c.settings || {}, cm = lockMode(st.lock), n = Object.keys(st.kidLock || {}).length;
  const txt = cm === 'all' ? '🔒 Alle Spiele sind gesperrt' : cm === 'some' ? `🔒 ${(st.lock.g || []).length} ${(st.lock.g || []).length === 1 ? 'Spiel' : 'Spiele'} gesperrt` : 'Alle Spiele frei';
  return `<div class="panel gl-note"><div><h2>🎮 Spiele</h2><p class="small muted">${txt}${n ? ` · ${n} ${n === 1 ? 'Kind' : 'Kinder'} mit eigener Sperre` : ''}</p></div>
    <button type="button" class="btn secondary" data-action="glock-menu" data-cls="${c.id}">${icon('sliders')} Spieleinstellungen</button></div>`;
}
function lockSet(l, mode) { return mode === 'none' ? undefined : mode === 'all' ? { m: 'all' } : { m: 'some', g: l?.g || [] }; }
function lockToggle(l, game) { const g = new Set(l?.g || []); if (g.has(game)) g.delete(game); else g.add(game); return { m: 'some', g: [...g] }; }
/** Nach dem Ändern: Menü (Spieleinstellungen) oder Klassen-Ansicht neu zeichnen */
function glockRefresh() {
  const mb = document.getElementById('menu-body');
  if (mb && typeof MENU === 'object' && MENU.sec === 'spiele') mb.innerHTML = menuSectionHTML('spiele'); else render();
}
const glockClassOf = (cid) => (cid && (klass.list || []).find((x) => x.id === cid)) || currentClass();
function glockClass(mode, game, cid) {
  const c = glockClassOf(cid); if (!c) return;
  const v = game ? lockToggle(c.settings.lock, game) : lockSet(c.settings.lock, mode);
  if (v) c.settings.lock = v; else delete c.settings.lock;
  saveClassSettingsSoon(c, true);
  if (!game) toast(mode === 'all' ? 'Alle Spiele für die Klasse gesperrt.' : mode === 'none' ? 'Spiele für die Klasse wieder frei.' : 'Tippe die Spiele an, die gesperrt sein sollen.');
  glockRefresh();
}
function glockKid(user, mode, game, cid) {
  const c = glockClassOf(cid); if (!c || !user) return;
  const kl = c.settings.kidLock = c.settings.kidLock || {};
  const v = game ? lockToggle(kl[user], game) : lockSet(kl[user], mode);
  if (v) kl[user] = v; else delete kl[user];
  if (!Object.keys(kl).length) delete c.settings.kidLock;
  klass.glOpen = true;
  saveClassSettingsSoon(c, true);
  glockRefresh();
}

/* ---------- Reihen und Aufgabenarten der Klasse ---------- */
function classSettingsHTML(c) {
  const s = c.settings;
  const op = (k, sym, t) => `<button type="button" class="op-btn" data-action="cls-op" data-op="${k}" role="checkbox" aria-checked="${!!s.ops[k]}"><span class="op-sym" aria-hidden="true">${sym}</span><span>${t}</span></button>`;
  return `<div class="panel cls-settings">
    <h2>Was übt die Klasse?</h2>
    <div class="size-pick" role="radiogroup" aria-label="Welches Einmaleins?">
      ${[[false, 'Kleines Einmaleins', 'Reihen 1 bis 10'], [true, 'Grosses Einmaleins', 'Reihen 1 bis 20 (mit dem kleinen)']].map(([big, t, sub]) => `<button type="button" class="size-btn ${big ? 'big' : ''}" data-action="cls-size" data-big="${big}" role="radio" aria-checked="${s.big === big}"><b>${t}</b><small>${sub}</small></button>`).join('')}
    </div>
    <h3>Reihen</h3>
    <p class="hint">Die Kinder bekommen in allen Übungen und Spielen nur Rechnungen aus diesen Reihen.</p>
    <div class="reihen ${s.big ? 'big' : ''}">${reihenFor(s.big).map((r) => `<button type="button" class="reihe r${((r - 1) % 10) + 1} ${r > 10 ? 'gross' : ''}" data-action="cls-reihe" data-r="${r}" aria-pressed="${s.reihen.includes(r)}"><b>${r}</b><small>er</small></button>`).join('')}</div>
    <div class="quick-pick"><button class="chip" data-action="cls-quick" data-q="all">Alle</button>${s.big ? '<button class="chip" data-action="cls-quick" data-q="gross">Nur 11–20</button>' : '<button class="chip" data-action="cls-quick" data-q="core">Kernaufgaben 1 2 5 10</button>'}</div>
    <h3>Aufgabenarten</h3>
    <div class="op-pick">${op('mul', SIGN(), 'Mal')}${op('div', ':', 'Geteilt')}${op('gap', '▢', 'Lücken')}</div>
    <p class="hint">Sind mehrere erlaubt, können die Kinder auch „Gemischt“ wählen. Tauschaufgaben (3 ${SIGN()} 7 und 7 ${SIGN()} 3) sind immer dabei.</p>
    <h3>Rechnungen pro Runde</h3>
    <div class="seg" role="radiogroup" aria-label="Rechnungen pro Runde">${[10, 15, 20, 30].map((n) => `<button type="button" class="seg-btn" data-action="cls-round" data-n="${n}" aria-pressed="${s.roundLen === n}">${n}</button>`).join('')}</div>
    <p class="hint">Gilt für Trainer und Auswählen. Der Blitztest hat immer 20 Rechnungen.</p>
    <label class="switch"><input type="checkbox" id="cls-choose" ${s.choose ? 'checked' : ''}><span>Kinder dürfen innerhalb dieser Auswahl selbst Reihen und Aufgabenarten wählen<br><small class="muted">Aus: Die Kinder üben immer genau diese Reihen und alle erlaubten Aufgabenarten gemischt.</small></span></label>
  </div>`;
}
let clsSaveT = null;
function saveClassSettingsSoon(c, quiet = false) {
  clearTimeout(clsSaveT);
  clsSaveT = setTimeout(async () => {
    try {
      const cl = await cloudClient();
      const { error } = await cl.from('einmaleins_classes').update({ settings: c.settings }).eq('id', c.id);
      if (error) throw error;
      if (!quiet) toast('Gespeichert.');
    } catch (e) { toast(classErrorText(e), 'bad'); }
  }, 500);
}
function classSettingAction(kind, el) {
  const c = currentClass();
  if (!c) return;
  const s = c.settings;
  if (kind === 'reihe') {
    const r = +el.dataset.r;
    const set = new Set(s.reihen);
    if (set.has(r)) { if (set.size > 1) set.delete(r); } else set.add(r);
    s.reihen = [...set].sort((a, b) => a - b);
  } else if (kind === 'quick') {
    s.reihen = el.dataset.q === 'core' ? [1, 2, 5, 10] : el.dataset.q === 'gross' ? REIHEN_GROSS.filter((r) => r > 10) : [...reihenFor(s.big)];
  } else if (kind === 'size') {
    s.big = el.dataset.big === 'true';
    s.reihen = s.big ? [...REIHEN_GROSS] : (s.reihen.filter((r) => r <= 10).length ? s.reihen.filter((r) => r <= 10) : [...REIHEN_KLEIN]);
  } else if (kind === 'round') {
    s.roundLen = +el.dataset.n;
  } else if (kind === 'op') {
    const k = el.dataset.op;
    s.ops[k] = !s.ops[k];
    if (!s.ops.mul && !s.ops.div && !s.ops.gap) s.ops.mul = true;
  }
  saveClassSettingsSoon(c);
  render();
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'cls-choose') { const c = currentClass(); if (c) { c.settings.choose = e.target.checked; saveClassSettingsSoon(c); } }
});

/* ---------- Login-Kärtchen ---------- */
function classCardsHTML(c, kids) {
  if (!kids.length) return '<div class="panel"><p class="empty">Noch keine Kinder in dieser Klasse.</p></div>';
  return `<div class="panel">
    <div class="cards-head">
      <div><h2>Login-Kärtchen</h2>
        <p class="hint">Ausdrucken, ausschneiden und verteilen. Anmelden: QR-Code scannen – oder Benutzername eintippen und die 3 Bilder der Reihe nach antippen – oder mit Passwort, wenn du das im Menü so eingestellt hast.</p>
        <p class="hint">Die Kärtchen sind neutral, ohne Logo. ${kids.some((x) => vbLoginOf(x)) ? 'Kinder, die auch in Vokaboom sind, haben einen QR-Code für beide Tools: Beim Scannen wählen sie <strong>bei Vokaboom</strong> oder <strong>bei Teilmal</strong>. Kinder, die nur in Teilmal sind, kommen direkt dorthin.' : 'Der QR-Code <strong>1×1 Rechnen</strong> öffnet Teilmal.'}</p></div>
      <span class="row"><button class="btn secondary" data-action="menu-sec" data-sec="klassen">${icon('sliders')} Kärtchen anpassen</button>
      <button class="btn primary" data-action="cards-pdf" id="cards-pdf">${icon('down')} PDF herunterladen</button></span>
    </div>
    <div class="card-previews">${kids.map((s) => `<figure class="card-prev" data-sid="${s.id}"><span class="spinner"></span></figure>`).join('')}</div>
  </div>`;
}
/** Klassenpasswort (eines für alle Kinder der Klasse); leer = keines. Ist die Klasse mit Vokaboom verbunden,
 *  gilt es dort gleich mit (ein Kärtchen für beide Tools). */
async function saveClassPw(cid, raw) {
  const c = klass.list.find((x) => x.id === cid);
  if (!c) return false;
  const v = String(raw || '').trim().slice(0, 40);
  if (v && v.replace(/[^a-z0-9äöü]/gi, '').length < 4) { toast('Das Klassenpasswort braucht mindestens 4 Buchstaben oder Zahlen.', 'bad'); return false; }
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('einmaleins_classes').update({ class_pw: v || null }).eq('id', cid);
    if (error) throw error;
    c.class_pw = v || null;
    const vc = c.vokaboom_class && vbClassById(c.vokaboom_class);
    if (vc) {
      const r = await cl.from('vokaboom_classes').update({ class_pw: v || null }).eq('id', vc.id);
      if (!r.error) vc.class_pw = v || null;
    }
    return true;
  } catch (e) {
    toast(/class_pw/.test(e?.message || '') ? 'Dafür zuerst supabase/einmaleins.sql in Supabase nochmals ausführen.' : classErrorText(e), 'bad');
    return false;
  }
}
/* ---------- Kärtchen-Einstellungen: gleich wie in Vokaboom ----------
 * Gespeichert bei der Lehrperson in fab_teacher_settings.cards (supabase/avatar.sql), dazu in diesem Browser. */
const CARD_DEFAULTS = { secret: 'pics', names: 'full', qr: true, cls: true };
const cardCfg = () => {
  const c = { ...CARD_DEFAULTS, ...(db.settings.cards || {}) };
  if (!['pics', 'password', 'class'].includes(c.secret)) c.secret = 'pics';
  if (!['full', 'initials'].includes(c.names)) c.names = 'full';
  return c;
};
const CARD_SYNC = { uid: '', at: 0, missing: false };
async function loadCardCfg(force = false) {
  if (!cloud.uid || isKid()) return false;
  if (!force && CARD_SYNC.uid === cloud.uid && Date.now() - CARD_SYNC.at < 20000) return false;
  try {
    const c = await cloudClient();
    const { data, error } = await c.from('fab_teacher_settings').select('cards').eq('teacher_id', cloud.uid).maybeSingle();
    if (error) throw error;
    CARD_SYNC.uid = cloud.uid; CARD_SYNC.at = Date.now(); CARD_SYNC.missing = false;
    const remote = data?.cards && typeof data.cards === 'object' ? data.cards : {};
    if (Object.keys(remote).length) {
      const before = JSON.stringify(cardCfg());
      db.settings.cards = { ...CARD_DEFAULTS, ...remote };
      if (JSON.stringify(cardCfg()) !== before) { saveDB(); return true; }
    } else if (db.settings.cards && Object.keys(db.settings.cards).length) saveCardCfg();
  } catch (e) { CARD_SYNC.missing = /cards|column|schema cache|fab_teacher_settings/i.test(e?.message || ''); }
  return false;
}
let cardSaveTimer = null;
function saveCardCfg() {
  clearTimeout(cardSaveTimer);
  cardSaveTimer = setTimeout(async () => {
    if (!cloud.uid) return;
    try {
      const c = await cloudClient();
      const { error } = await c.from('fab_teacher_settings').upsert({ teacher_id: cloud.uid, cards: cardCfg(), updated_at: new Date().toISOString() }, { onConflict: 'teacher_id' });
      if (error) throw error;
      CARD_SYNC.missing = false; CARD_SYNC.uid = cloud.uid; CARD_SYNC.at = Date.now();
    } catch (e) {
      CARD_SYNC.missing = /cards|column|schema cache|fab_teacher_settings/i.test(e?.message || '');
      if (CARD_SYNC.missing) { if (ui.view === 'class' && klass.tab === 'cards') render(); } else toast('Die Kärtchen-Einstellung konnte nicht gespeichert werden. Bist du online?', 'bad');
    }
  }, 300);
}
/** Das Vokaboom-Kind mit demselben Login (Benutzername und Bilder kommen von dort) */
function vbOf(st) {
  const v = st?.vokaboom_id && klass.vb?.byId.get(st.vokaboom_id);
  return v && v.username === st.username ? v : null;
}
/** Was auf dem Kärtchen steht: 'pics' (3 Bilder), 'password' (eigenes Passwort pro Kind) oder 'class'
 *  (Klassenpasswort). Fehlt das Passwort, gelten die Bilder – wie in Vokaboom. */
function kidSecretOf(st) {
  const m = cardCfg().secret;
  if (m === 'password' && kidPwOf(st)) return 'password';
  if (m === 'class' && classPwOf(st)) return 'class';
  return 'pics';
}
/** Passwort des Kindes: bei verbundenen Kindern das vom Vokaboom-Kärtchen (gilt in beiden Tools), sonst das eigene */
const kidPwOf = (st) => vbOf(st)?.pw || st?.pw || '';
/** Klassenpasswort einer Klasse: verbunden das der Vokaboom-Klasse (falls gesetzt), sonst das eigene */
const classPwOfClass = (c) => (c?.vokaboom_class && vbClassById(c.vokaboom_class)?.class_pw) || c?.class_pw || '';
const classPwOf = (st) => {
  const v = vbOf(st);
  return (v && vbClassById(v.class_id)?.class_pw) || klass.list.find((c) => c.id === st?.class_id)?.class_pw || '';
};
const CARD_W = 85, CARD_H = 54;
// Gleiche Farben wie in Vokaboom: Ein Kind bekommt in beiden Tools genau dasselbe Kärtchen
const CARD_COLORS = [['#4F46E5', '#EEF0FF'], ['#DB2777', '#FDE7F1'], ['#D97706', '#FFF2D9'], ['#0891B2', '#DDF6FB'], ['#059669', '#DCF7EC'], ['#7C3AED', '#F1EAFF'], ['#E8730C', '#FFEDD8'], ['#0E7490', '#DFF5F9'], ['#BE185D', '#FCE7F3'], ['#4D7C0F', '#ECFCCB']];
function cardColor(username) {
  let h = 0;
  for (const ch of String(username)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_COLORS[h % CARD_COLORS.length];
}
const cardImgCache = new Map();
function svgImage(svg) {
  if (cardImgCache.has(svg)) return cardImgCache.get(svg);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = kidSvgURL(svg);
  });
  cardImgCache.set(svg, p);
  return p;
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fitText(ctx, text, maxW, font, size) {
  let s = size;
  ctx.font = font(s);
  while (s > size * 0.55 && ctx.measureText(text).width > maxW) { s *= 0.94; ctx.font = font(s); }
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
/** Für den zweiten QR-Code: Ist das Kind mit Vokaboom verknüpft und hat dort dasselbe Login? */
function vbLoginOf(st) {
  const v = vbOf(st);
  const base = String(CLOUD_CFG.vokaboomUrl || '').trim();
  if (!v || !base) return '';
  return `${base}#k=${v.username}.${picsList(v.pics).join('-')}`;
}
function drawQR(ctx, url, qx, qy, qs, X, Y, L) {
  ctx.fillStyle = '#fff'; ctx.fillRect(X(qx), Y(qy), L(qs), L(qs));
  try {
    const q = qrcode(0, 'M'); q.addData(url, 'Byte'); q.make();
    const n = q.getModuleCount(), m = 1, cell = qs / (n + m * 2);
    ctx.fillStyle = '#1E293B';
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) {
      if (q.isDark(r, cc)) ctx.fillRect(Math.floor(X(qx + (cc + m) * cell)), Math.floor(Y(qy + (r + m) * cell)), Math.ceil(L(cell)), Math.ceil(L(cell)));
    }
  } catch { /* */ }
}
/**
 * Zeichnet ein Login-Kärtchen (x, y in mm; s = Pixel pro mm). Ohne Logo und ohne Namen eines Tools:
 * Es gilt für alle Tools, in denen das Kind dasselbe Login hat. Ein QR-Code: bei Kindern in beiden Tools mit der Frage
 * „bei Vokaboom“ oder „bei Teilmal“ (#w=…), sonst direkt ins Tool (#k=…). Gleiches Kärtchen in Vokaboom und Teilmal.
 * Aufbau: oben „Login-Kärtchen“ (und Klasse), rechts der Name bzw. die Initialen; links Benutzername und Passwort
 * untereinander, rechts unten der QR-Code.
 */
async function drawKidCard(ctx, x, y, s, st, className) {
  const [accent, wash] = cardColor(st.username);
  const X = (mm) => (x + mm) * s, Y = (mm) => (y + mm) * s, L = (mm) => mm * s;
  const disp = "'Bricolage Grotesque', Lexend, system-ui, sans-serif", body = 'Lexend, system-ui, sans-serif';
  const cc = { ...cardCfg(), secret: kidSecretOf(st) };
  const both = cc.qr && !!vbLoginOf(st);
  const colW = cc.qr ? 48 : CARD_W - 8; // Breite der linken Spalte (Benutzername, Passwort)
  ctx.save();
  // Karte: weiss, runde Ecken, feiner Rand, zwei weiche Farbflächen
  rrect(ctx, X(0), Y(0), L(CARD_W), L(CARD_H), L(4));
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = wash;
  ctx.beginPath(); ctx.arc(X(CARD_W + 4), Y(-6), L(27), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(X(-7), Y(CARD_H + 9), L(17), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  rrect(ctx, X(0), Y(0), L(CARD_W), L(CARD_H), L(4));
  ctx.lineWidth = L(0.25); ctx.strokeStyle = '#E2E8F0'; ctx.stroke();
  // Kopf: „Login-Kärtchen“ als Pille (daneben die Klasse), rechts der Name bzw. die Initialen
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `800 ${L(2.6)}px ${disp}`;
  const pillW = ctx.measureText('Login-Kärtchen').width + L(4.4);
  rrect(ctx, X(4), Y(4), pillW, L(5.4), L(2.7)); ctx.fillStyle = accent; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('Login-Kärtchen', X(4) + L(2.2), Y(7.65));
  ctx.font = `800 ${L(4)}px ${disp}`;
  const who = fitText(ctx, cc.names === 'initials' ? kidInitials(st) : kidName(st), L(32), (z) => `800 ${z}px ${disp}`, L(4));
  const whoW = ctx.measureText(who).width;
  ctx.textAlign = 'right'; ctx.fillStyle = '#1E293B'; ctx.fillText(who, X(CARD_W - 4.5), Y(8.2));
  if (cc.cls) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#64748B';
    const room = X(CARD_W - 4.5) - whoW - L(3) - (X(4) + pillW + L(2));
    if (room > L(6)) ctx.fillText(fitText(ctx, className, room, (z) => `600 ${z}px ${body}`, L(2.5)), X(4) + pillW + L(2), Y(7.6));
  }
  ctx.textAlign = 'left';
  // Links: Benutzername und Passwort untereinander
  const label = (t, yy) => { ctx.fillStyle = '#94A3B8'; ctx.font = `600 ${L(2.2)}px ${body}`; ctx.fillText(t, X(4), Y(yy)); };
  label('Benutzername', 17);
  ctx.fillStyle = accent;
  ctx.fillText(fitText(ctx, displayUser(st.username), L(colW), (z) => `800 ${z}px ${disp}`, L(6.6)), X(4), Y(24.6));
  const pics = picsList(st.pics);
  if (cc.secret === 'password' || cc.secret === 'class') {
    const pwTxt = cc.secret === 'class' ? classPwOf(st) : showPw(kidPwOf(st));
    label(cc.secret === 'class' ? 'Passwort (für die ganze Klasse)' : 'Passwort', 32.2);
    const t = fitText(ctx, pwTxt, L(colW - 6), (z) => `700 ${z}px ui-monospace, Menlo, Consolas, monospace`, L(5));
    const tw = ctx.measureText(t).width;
    rrect(ctx, X(4), Y(34.4), tw + L(6), L(10.4), L(3.2));
    ctx.fillStyle = wash; ctx.fill(); ctx.lineWidth = L(0.35); ctx.strokeStyle = accent; ctx.stroke();
    ctx.fillStyle = '#1E293B'; ctx.fillText(t, X(7), Y(41.4));
  } else {
    label('Passwort: diese 3 Bilder antippen', 32.2);
    for (let k = 0; k < 3; k++) {
      const bx = 4 + k * 13, by = 34.4;
      rrect(ctx, X(bx), Y(by), L(11), L(11), L(3));
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = L(0.4); ctx.strokeStyle = accent; ctx.stroke();
      const im = pics[k] != null ? await svgImage(KID_PW[pics[k]].svg) : null;
      if (im) ctx.drawImage(im, X(bx + 1.7), Y(by + 1.7), L(7.6), L(7.6));
      ctx.beginPath(); ctx.arc(X(bx + 0.6), Y(by + 0.6), L(1.9), 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${L(2.4)}px ${body}`; ctx.textAlign = 'center';
      ctx.fillText(String(k + 1), X(bx + 0.6), Y(by + 1.45)); ctx.textAlign = 'left';
    }
  }
  ctx.restore();
  if (cc.qr) drawCardQR(ctx, st, both, X, Y, L);
}
/** Ein grosser QR-Code rechts unten in einem weissen Rahmen, ohne Text darunter */
function drawCardQR(ctx, st, both, X, Y, L) {
  ctx.save();
  rrect(ctx, X(55), Y(23.5), L(26.5), L(26.5), L(3.4));
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = L(0.3); ctx.strokeStyle = '#E2E8F0'; ctx.stroke();
  drawQR(ctx, cardQrUrl(st, both), 55.75, 24.25, 25, X, Y, L);
  ctx.restore();
}
async function cardFontsReady() {
  try { await Promise.all(["800 20px 'Bricolage Grotesque'", '600 20px Lexend', '500 20px Lexend'].map((f) => document.fonts.load(f))); } catch { /* */ }
}
async function renderCardPreviews(c, kids) {
  await cardFontsReady();
  for (const st of kids) {
    const fig = $(`.card-prev[data-sid="${st.id}"]`);
    if (!fig || ui.view !== 'class' || klass.tab !== 'cards') return;
    const s = 8;
    const cv = document.createElement('canvas');
    cv.width = Math.round(CARD_W * s); cv.height = Math.round(CARD_H * s);
    await drawKidCard(cv.getContext('2d'), 0, 0, s, st, c.name);
    fig.innerHTML = `<img src="${cv.toDataURL('image/png')}" alt="Login-Kärtchen für ${esc(kidName(st))}">`;
  }
}
/** PDF mit 10 Kärtchen pro A4-Seite (Bilder der Seiten) */
async function downloadCardsPDF() {
  const c = currentClass();
  const kids = studentsOf(c?.id);
  if (!kids.length) return;
  const btn = $('#cards-pdf');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> PDF wird erstellt …'; }
  try {
    await cardFontsReady();
    const s = 11.81;
    const cols = 2, rows = 5, gx = 6, gy = 3;
    const x0 = (PW - cols * CARD_W - (cols - 1) * gx) / 2, y0 = (PH - rows * CARD_H - (rows - 1) * gy) / 2;
    const pages = [];
    for (let i = 0; i < kids.length; i += cols * rows) {
      const cv = document.createElement('canvas');
      cv.width = Math.round(PW * s); cv.height = Math.round(PH * s);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      const batch = kids.slice(i, i + cols * rows);
      for (let k = 0; k < batch.length; k++) {
        await drawKidCard(ctx, x0 + (k % cols) * (CARD_W + gx), y0 + Math.floor(k / cols) * (CARD_H + gy), s, batch[k], c.name);
      }
      const bin = atob(cv.toDataURL('image/jpeg', 0.9).split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      pages.push({ jpeg: bytes, w: cv.width, h: cv.height });
    }
    downloadBlob(imagePagesPDF(pages), `Logins-${fileSafe(c.name)}.pdf`);
    toast('PDF heruntergeladen.');
  } catch { toast('Das PDF konnte nicht erstellt werden.', 'bad'); } finally {
    const b = $('#cards-pdf');
    if (b) { b.disabled = false; b.innerHTML = `${icon('down')} PDF herunterladen`; }
  }
}
function imagePagesPDF(pages) {
  const enc = new TextEncoder();
  const chunks = [], offs = [];
  let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const W = 595.28, H = 841.89;
  const obj = (id, fill) => { offs[id] = len; push(`${id} 0 obj\n`); fill(); push('\nendobj\n'); };
  push('%PDF-1.4\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${pages.length} >>`));
  pages.forEach((p, i) => {
    const id = 3 + 3 * i;
    obj(id, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(id + 1, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(id + 2, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`); push(p.jpeg); push('\nendstream'); });
  });
  const xref = len, count = 3 + 3 * pages.length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offs[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

/* =========================================================
   Übersicht für die Lehrperson
   ========================================================= */
async function refreshStats() {
  const c = currentClass();
  if (!c) return;
  klass.statsError = '';
  try { await loadClassProgress(c.id); } catch (e) { klass.statsError = classErrorText(e); }
  if (ui.view === 'class' && klass.tab === 'overview') render();
}
function fmtDay(t) {
  if (!t) return '–';
  const d = new Date(t), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  return days === 0 ? 'heute' : days === 1 ? 'gestern' : days < 7 ? `vor ${days} Tagen` : d.toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric' });
}
const pctTxt = (x) => (x == null ? '–' : `${Math.round(x * 100)} %`);
const accClass = (x) => (x == null ? '' : x >= 0.9 ? 'good' : x >= 0.75 ? 'mid' : 'low');
/** Alle Malrechnungen, die zu den Reihen der Klasse gehören (mit Tauschaufgaben) */
function classMulKeys(c) {
  const keys = new Set();
  c.settings.reihen.forEach((b) => { for (let a = 1; a <= 10; a++) { keys.add(`${a}x${b}`); keys.add(`${b}x${a}`); } });
  return keys;
}

/* ---------- Münzensperren (automatisch: nur leichte Reihen geübt; von Hand: durch die Lehrperson) ---------- */
const LOCK_RECENT = 7 * 864e5;
const autoLockOf = (p) => (p?.lock && Date.now() - p.lock.at < LOCK_RECENT ? p.lock : null);
const teacherLockOf = (cid, sid) => { const l = klass.locks[cid]?.map?.[sid]; return l && (l.until == null || Date.parse(l.until) > Date.now()) ? l : null; };
const lockRowsTxt = (rows) => (rows?.length ? rows.map((r) => `${r}er`).join(', ') : 'leichte Reihen');
function autoLockTxt(a) {
  const t = new Date(a.at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  return `nur ${lockRowsTxt(a.rows)} geübt · ${fmtDay(a.at)} ${t} · ${a.n} ${a.n === 1 ? 'Antwort' : 'Antworten'} ohne Münzen${a.cnt > 1 ? ` · schon an ${a.cnt} Tagen` : ''}`;
}
function lockChipHTML(cid, r) {
  const t = teacherLockOf(cid, r.st.id), a = autoLockOf(r.p);
  return (t ? `<span class="lock-chip man" title="Von dir gesperrt – ${esc(coinLockUntilText(t.until))}">🔒 gesperrt</span>` : '')
    + (a ? `<span class="lock-chip auto" title="Automatische Münzensperre: ${esc(autoLockTxt(a))}">🔒 ${fmtDay(a.at)}</span>` : '');
}
const LOCK_DURS = [['day', 'Heute'], ['3', '3 Tage'], ['7', '1 Woche'], ['0', 'Bis ich sie aufhebe']];
function lockMenuHTML(sid, label = 'Münzen sperren') {
  return `<details class="lock-menu"><summary class="btn small secondary">🔒 ${label}</summary><div class="lock-menu-pop"><span class="small muted">Wie lange?</span>
    ${LOCK_DURS.map(([d, t]) => `<button class="btn small ghost" data-action="coin-lock" data-id="${sid}" data-dur="${d}">${t}</button>`).join('')}</div></details>`;
}
/** Steuerung für ein Kind: Sperre aufheben oder setzen */
function lockCtlHTML(cid, sid) {
  if (klass.locks[cid]?.missing) return '';
  const t = teacherLockOf(cid, sid);
  return t ? `<span class="lock-state">Münzen gesperrt ${esc(coinLockUntilText(t.until))}</span><button class="btn small secondary" data-action="coin-unlock" data-id="${sid}">🔓 Sperre aufheben</button>`
    : lockMenuHTML(sid);
}
function coinLockPanelHTML(c, rows) {
  const L = klass.locks[c.id] || {};
  const auto = rows.filter((r) => autoLockOf(r.p)).sort((x, y) => y.p.lock.at - x.p.lock.at);
  const man = rows.filter((r) => teacherLockOf(c.id, r.st.id));
  const name = (r) => `<button class="link-btn kid-link" data-action="stats-kid" data-id="${r.st.id}">${kidWordImg(r.st.username, 'kid-mini')}${esc(kidName(r.st))}</button>`;
  return `<div class="panel lock-panel" id="lock-panel">
    <div class="stats-head"><h2>🔒 Münzensperren</h2>${auto.length || man.length ? `<span class="pill ${auto.length ? 'mid' : ''}">${auto.length + man.length}</span>` : ''}</div>
    <p class="hint">Kinder, die nur Reihen üben, die sie schon sicher können (1er, 2er und 10er zählen immer dazu), üben automatisch ohne Münzen weiter.
      Du kannst einem Kind die Münzen auch selbst sperren: Üben und Spielen geht weiter, es gibt nur keine neuen Münzen.</p>
    <div class="lock-cols">
      <div><h3>Automatisch gesperrt <small class="muted">(letzte 7 Tage)</small></h3>
        ${auto.length ? `<ul class="lock-list">${auto.map((r) => `<li><span class="lock-who">${name(r)}<span class="lock-chip auto">auto</span></span>
          <small class="lock-why">${esc(autoLockTxt(r.p.lock))}</small>${teacherLockOf(c.id, r.st.id) || L.missing ? '' : `<span class="lock-act" title="Alle Münzen sperren, nicht nur für leichte Reihen">${lockMenuHTML(r.st.id, 'Ganz sperren')}</span>`}</li>`).join('')}</ul>`
          : '<p class="empty small">Niemand – gut so!</p>'}</div>
      <div><h3>Von dir gesperrt</h3>
        ${L.missing ? '<p class="banner">Für eigene Münzensperren bitte <b>supabase/avatar.sql</b> in Supabase noch einmal ausführen.</p>'
          : L.error ? `<p class="banner bad">${esc(L.error)}</p>`
          : `${man.length ? `<ul class="lock-list">${man.map((r) => { const t = teacherLockOf(c.id, r.st.id); return `<li><span class="lock-who">${name(r)}<span class="lock-chip man">gesperrt</span></span>
              <small class="lock-why">${esc(coinLockUntilText(t.until))}${t.at ? ` · seit ${fmtDay(Date.parse(t.at))}` : ''}</small>
              <span class="lock-act"><button class="btn small secondary" data-action="coin-unlock" data-id="${r.st.id}">🔓 Aufheben</button></span></li>`; }).join('')}</ul>` : '<p class="empty small">Keine.</p>'}
          <div class="lock-form">
            <label class="cb-field"><span>Kind</span><select id="lock-kid"><option value="">– auswählen –</option>${rows.filter((r) => !teacherLockOf(c.id, r.st.id)).map((r) => `<option value="${r.st.id}">${esc(kidName(r.st))}</option>`).join('')}</select></label>
            <label class="cb-field"><span>Wie lange?</span><select id="lock-dur">${LOCK_DURS.map(([d, t]) => `<option value="${d}" ${d === '7' ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <button class="btn primary" data-action="coin-lock" data-form="1">🔒 Münzen sperren</button>
          </div>`}
      </div>
    </div>
  </div>`;
}

function classOverviewHTML(c, kids) {
  const prog = klass.progress[c.id];
  const head = `<div class="stats-head"><h2>Übersicht</h2><div class="row"><button class="btn small ghost" data-action="stats-refresh">${icon('flip')} Aktualisieren</button></div></div>`;
  if (klass.statsError) return `<div class="panel">${head}<p class="banner bad">${icon('x')} ${esc(klass.statsError)}</p></div>`;
  if (!kids.length) return `<div class="panel">${head}<p class="empty">Noch keine Kinder in dieser Klasse. <button class="link-btn" data-action="class-tab" data-tab="kids">Kinder eintragen</button></p></div>`;
  if (!prog) return `<div class="panel">${head}<p class="muted"><span class="spinner"></span> Wird geladen …</p></div>`;
  const keys = classMulKeys(c);
  const total = keys.size;
  const rows = kids.map((st) => {
    const p = prog[st.id]?.prog;
    const sum = p ? progSummary(p, keys) : null;
    const all = p ? progSummary(p) : null;
    const hard = p ? hardestKeys(p, 3) : [];
    const week = p ? Object.entries(p.days).filter(([d]) => Date.now() - Date.parse(d) < 7 * 864e5).reduce((s, [, n]) => s + n, 0) : 0;
    return { st, p, sum, all, hard, week, at: prog[st.id]?.at || 0 };
  });
  const active = rows.filter((r) => r.week > 0).length;
  const sumN = rows.reduce((s, r) => s + (r.all?.n || 0), 0), sumW = rows.reduce((s, r) => s + (r.all?.w || 0), 0);
  const table = `<div class="stat-scroll"><table class="ov-table">
    <thead><tr><th scope="col">Kind</th><th scope="col">Gelöst</th><th scope="col">Richtig</th><th scope="col">Zeit</th><th scope="col">Sitzen</th><th scope="col">Macht am meisten Mühe</th><th scope="col">Zuletzt</th><th scope="col"><span class="sr-only">Blatt</span></th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${klass.kidDetail === r.st.id ? 'sel' : ''}">
      <th scope="row"><button class="link-btn kid-link" data-action="stats-kid" data-id="${r.st.id}">${kidWordImg(r.st.username, 'kid-mini')}${esc(kidName(r.st))}</button>${lockChipHTML(c.id, r)}</th>
      ${r.all?.n ? `<td class="num">${r.all.n}${r.week ? `<small>${r.week} diese Woche</small>` : ''}</td>
        <td><span class="pill ${accClass(r.all.acc)}">${pctTxt(r.all.acc)}</span></td>
        <td class="num">${r.all.ms ? (r.all.ms / 1000).toFixed(1).replace('.', ',') + ' s' : '–'}</td>
        <td><span class="mini-bar" title="${r.sum.sure} von ${total} Rechnungen sitzen gut"><i style="width:${(r.sum.sure / total) * 100}%"></i></span><small>${r.sum.sure}/${total}</small></td>
        <td class="hard-chips">${r.hard.length ? r.hard.map((h) => `<span class="hchip" title="${h.s.w}× falsch${typicalErrors(h.s).length ? ', oft ' + typicalErrors(h.s).join(', ') : ''}">${esc(keyLabel(h.key))}</span>`).join('') : '<small class="muted">–</small>'}</td>`
        : '<td colspan="5" class="muted small">Noch nicht geübt</td>'}
      <td class="small">${fmtDay(r.at)}</td>
      <td><button class="btn small secondary" data-action="sheet-kid" data-id="${r.st.id}" title="Übungsblatt für ${esc(kidName(r.st))}">${icon('print')}<span class="hide-sm">Blatt</span></button></td>
    </tr>`).join('')}</tbody></table></div>`;

  let detail = '';
  const sel = rows.find((r) => r.st.id === klass.kidDetail);
  if (sel) {
    const p = sel.p || emptyProg();
    detail = `<div class="panel kid-detail" id="kid-detail">
      <div class="stats-head"><h2>${kidWordImg(sel.st.username, 'kid-mini')} ${esc(kidName(sel.st))}</h2>
        <div class="row"><button class="btn small primary" data-action="sheet-kid" data-id="${sel.st.id}">${icon('print')} Übungsblatt</button><button class="icon-btn subtle" data-action="stats-kid" data-id="" aria-label="Schliessen">${icon('x')}</button></div></div>
      ${sel.all?.n ? statTilesHTML(sel.sum, total) : '<p class="empty">Noch nicht geübt.</p>'}
      ${p.coins?.earned ? `<p class="small kd-coins">${COIN_SVG}<span><b>${p.coins.c}</b> ${p.coins.c === 1 ? 'Münze' : 'Münzen'} · ${p.coins.earned} verdient · ${p.coins.spent} für Spiele ausgegeben</span></p>` : ''}
      <div class="kd-lock">${autoLockOf(p) ? `<p class="small"><span class="lock-chip auto">🔒 auto</span> Automatische Münzensperre: ${esc(autoLockTxt(p.lock))}</p>` : ''}
        <div class="row">${lockCtlHTML(c.id, sel.st.id)}</div></div>
      <div class="kd-grid">
        <div><h3>Einmaleins-Tafel</h3>${tafelHTML(p, { mode: 'mul', id: 'kid', big: c.settings.big })}${legendHTML()}</div>
        <div><h3>Die Reihen</h3>${reihenBarsHTML(p, c.settings.big)}<h3>Häufigste Fehler</h3>${focusListHTML(p)}
          ${Object.keys(p.f).some((k) => k.includes(':')) ? `<h3>Geteilt</h3>${tafelHTML(p, { mode: 'div', compact: true, id: 'kid', big: c.settings.big })}` : ''}</div>
      </div>
    </div>`;
  }

  // Klasse: welche Rechnungen machen wie vielen Kindern Mühe?
  const cell = {};
  rows.forEach((r) => {
    if (!r.p) return;
    Object.entries(r.p.f).forEach(([k, s]) => {
      if (!s.n || k.includes(':')) return;
      const lv = levelOf(s);
      const o = cell[k] || (cell[k] = { kids: 0, weak: 0, shaky: 0, d: 0, errs: {} });
      o.kids++; o.d += difficulty(s);
      if (lv === 'weak') o.weak++;
      if (lv === 'shaky') o.shaky++;
      (s.e || []).forEach((x) => { o.errs[x] = (o.errs[x] || 0) + 1; });
    });
  });
  // Zeilen = Reihen, Spalten = mal 1–10; ein Feld fasst Rechnung und Tauschaufgabe zusammen
  const heat = `<div class="tafel-wrap ${c.settings.big ? 'big' : ''}"><table class="tafel heat" aria-label="Einmaleins-Tafel der Klasse"><thead><tr><th class="corner">${SIGN()}</th>${REIHEN_KLEIN.map((a) => `<th scope="col">${a}</th>`).join('')}</tr></thead><tbody>${reihenFor(c.settings.big).map((b) => `<tr><th scope="row">${b}</th>${REIHEN_KLEIN.map((a) => {
    const os = [...new Set([`${a}x${b}`, `${b}x${a}`])].map((k) => cell[k]).filter(Boolean);
    const kidsN = Math.max(0, ...os.map((o) => o.kids));
    const d = os.length ? os.reduce((x, o) => x + o.d, 0) / os.reduce((x, o) => x + o.kids, 0) : null;
    const weak = Math.max(0, ...os.map((o) => o.weak)), hard = Math.max(0, ...os.map((o) => o.weak + o.shaky));
    const lv = d == null ? 'none' : d >= 0.45 ? 'weak' : d >= 0.28 ? 'shaky' : d >= 0.14 ? 'ok' : 'top';
    return `<td><span class="tf lv-${lv}" title="${a} ${SIGN()} ${b} = ${a * b}${os.length ? `: ${hard} von ${kidsN} Kindern haben Mühe` : ': noch nicht geübt'}"><span>${a * b}</span>${weak ? `<em>${weak}</em>` : ''}</span></td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>`;
  const hardest = Object.entries(cell).filter(([, o]) => o.weak + o.shaky > 0).sort((x, y) => (y[1].weak * 2 + y[1].shaky) - (x[1].weak * 2 + x[1].shaky) || y[1].d / y[1].kids - x[1].d / x[1].kids).slice(0, 12);

  const o = sheetOpts();
  return `<div class="ov-sum">
      <div class="stat-tile"><b>${kids.length}</b><small>Kinder</small></div>
      <div class="stat-tile"><b>${active}</b><small>diese Woche aktiv</small></div>
      <div class="stat-tile"><b>${sumN}</b><small>Rechnungen gelöst</small></div>
      <div class="stat-tile"><b>${sumN ? Math.round(((sumN - sumW) / sumN) * 100) + ' %' : '–'}</b><small>richtig</small></div>
    </div>
    <div class="panel">${head}${table}<p class="muted small">Gelöst = alle Rechnungen in Übungen und Spielen. Sitzen = Malrechnungen aus den Reihen der Klasse, die mehrmals schnell und richtig gelöst wurden. Tippe auf ein Kind für Details.</p></div>
    ${detail}
    ${coinLockPanelHTML(c, rows)}
    <div class="ov-grid">
      <div class="panel"><h2>Die Klasse auf einen Blick</h2><p class="hint">Je röter, desto mehr Mühe hat die Klasse. Die kleine Zahl = so viele Kinder haben mit dieser Rechnung gerade viel Mühe.</p>${heat}${legendHTML()}</div>
      <div class="panel"><h2>Schwierigste Rechnungen der Klasse</h2>
        ${hardest.length ? `<ol class="diff-list">${hardest.map(([k, x]) => {
          const errs = Object.entries(x.errs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v);
          const kk = taskKeyParts(k);
          return `<li class="diff-row"><span class="diff-word"><strong>${esc(keyLabel(k))} = ${kk.a * kk.b}</strong>${errs.length ? ` <small class="muted">oft: ${errs.join(', ')}</small>` : ''}</span>
            <span class="diff-bar" aria-hidden="true"><i style="width:${((x.weak + x.shaky) / Math.max(1, kids.length)) * 100}%"></i></span>
            <span class="diff-num"><b>${x.weak + x.shaky}</b> von ${x.kids} ${x.kids === 1 ? 'Kind' : 'Kindern'}</span></li>`;
        }).join('')}</ol>` : '<p class="empty">Noch keine Übungsdaten.</p>'}
      </div>
    </div>
    ${classBoardPanelHTML()}
    <div class="panel sheets-panel">
      <div class="stats-head"><h2>${icon('sheet')} Übungsblätter</h2></div>
      <p class="hint">Jedes Kind bekommt ein eigenes Blatt: Seine schwierigsten Rechnungen kommen mehrmals und in verschiedenen Formen vor (auch als Tauschaufgabe, Lücke und Geteilt), dazu Rechnungen, die noch wackeln, und die Reihe, die am meisten Mühe macht. Jedes Mal neu gemischt.</p>
      <div class="sheet-dialog">
        <div class="sheet-form">
          ${sheetOptsHTML(o)}
          <div class="row"><button class="btn primary" data-action="sheets-all" id="sheets-all">${icon('down')} Alle ${kids.length} Blätter als ein PDF</button></div>
        </div>
        <div class="sheet-prev" id="sheet-prev"><p class="muted small">Vorschau: Tippe bei einem Kind auf „Blatt“.</p></div>
      </div>
    </div>`;
}
/* ---------- Bestenlisten der Spiele (Top 10 der Klasse) ---------- */
function classBoardPanelHTML() {
  const b = klass.board || (klass.board = { game: 'elfmeter', mode: 'countdown', op: 'mul' });
  const games = GAMES.filter((g) => g.modes.length);
  const modes = GAME_BY_ID[b.game].modes;
  if (!modes.includes(b.mode)) b.mode = modes[0];
  const sel = (id, label, cur, list) => `<label class="cb-field"><span>${label}</span><select id="${id}">${list.map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  return `<div class="panel class-board" id="class-board">
    <div class="stats-head"><h2>${icon('trophy')} Bestenlisten der Spiele</h2></div>
    <p class="hint">Top 10 der Klasse – jedes Kind erscheint nur mit seinem besten Ergebnis. Die Kinder sehen diese Liste nach jedem Spiel, dazu ihren eigenen Rang.</p>
    <div class="cb-pick">${sel('cb-game', 'Spiel', b.game, games.map((g) => [g.id, g.name]))}${sel('cb-mode', 'Modus', b.mode, modes.map((m) => [m, GAME_MODES[m].name]))}${sel('cb-op', 'Aufgabenart', b.op, ['mul', 'div', 'gap', 'mix'].map((o) => [o, OP_INFO[o][0]]))}</div>
    <div id="cboard" class="cboard"><p class="muted">wird geladen …</p></div>
  </div>`;
}
function bindClassBoard(c) {
  const panel = $('#class-board');
  if (!panel) return;
  ['cb-game', 'cb-mode', 'cb-op'].forEach((id) => $(`#${id}`)?.addEventListener('change', (e) => {
    klass.board[{ 'cb-game': 'game', 'cb-mode': 'mode', 'cb-op': 'op' }[id]] = e.target.value;
    $('#class-board').outerHTML = classBoardPanelHTML();
    bindClassBoard(c);
  }));
  loadClassBoard(c);
}
async function loadClassBoard(c) {
  const el = $('#cboard');
  if (!el) return;
  const b = klass.board;
  try {
    const cl = await cloudClient();
    const { data, error } = await cl.rpc('einmaleins_class_board', { p_class: c.id, p_board: boardKey(b.game, b.mode, b.op) });
    if (error) throw error;
    if ($('#cboard') === el) el.innerHTML = boardListHTML(data);
  } catch (e) {
    const old = /PGRST202|Could not find the function/.test(`${e.code || ''} ${e.message || ''}`);
    if ($('#cboard') === el) el.innerHTML = `<p class="muted">${old ? 'Für die Bestenlisten muss das SQL-Skript (supabase/einmaleins.sql) in Supabase noch einmal ausgeführt werden.' : 'Die Bestenliste ist gerade nicht erreichbar.'}</p>`;
  }
}
function bindOverview(c) {
  bindClassBoard(c);
  bindSheetOpts(() => { if (klass.sheetKid) previewKidSheet(klass.sheetKid, false); });
  const sel = klass.kidDetail;
  if (sel) bindTafel(klass.progress[c.id]?.[sel]?.prog || emptyProg());
  if (klass.sheetKid) previewKidSheet(klass.sheetKid, false);
}
function kidSheetData(c, st) {
  return { who: { name: kidName(st), cls: c.name }, prog: klass.progress[c.id]?.[st.id]?.prog || emptyProg() };
}
let kidSheetDoc = null;
function previewKidSheet(id, scroll = true) {
  const c = currentClass();
  const st = studentsOf(c?.id).find((x) => x.id === id);
  if (!st) return;
  klass.sheetKid = id;
  const { who, prog } = kidSheetData(c, st);
  kidSheetDoc = new SheetDoc();
  addSheetFor(kidSheetDoc, who, prog, c.settings.reihen, sheetOpts(), true);
  const box = $('#sheet-prev');
  if (!box) return;
  box.innerHTML = `${pageToSVG(kidSheetDoc.pages[0])}
    <div class="row center"><button class="btn primary" data-action="sheet-kid-pdf" data-id="${id}">${icon('down')} PDF für ${esc(kidName(st))}</button><button class="btn ghost" data-action="sheet-kid" data-id="${id}">${icon('shuffle')} Neu mischen</button></div>`;
  if (scroll) $('.sheets-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function downloadKidSheet(id) {
  const c = currentClass();
  const st = studentsOf(c?.id).find((x) => x.id === id);
  if (!st) return;
  if (!kidSheetDoc || klass.sheetKid !== id) previewKidSheet(id, false);
  downloadBlob(docToPDF(kidSheetDoc), `Teilmal-${fileSafe(kidName(st))}.pdf`);
  toast('PDF heruntergeladen.');
}
function downloadAllSheets() {
  const c = currentClass();
  const kids = studentsOf(c?.id);
  if (!kids.length) return;
  const doc = new SheetDoc();
  kids.forEach((st, i) => { const { who, prog } = kidSheetData(c, st); addSheetFor(doc, who, prog, c.settings.reihen, sheetOpts(), i === 0); });
  downloadBlob(docToPDF(doc), `Teilmal-Blaetter-${fileSafe(c.name)}.pdf`);
  toast(`${kids.length} Blätter heruntergeladen.`);
}

/* ---------- Aktionen (werden in main.js eingehängt) ---------- */
const classActions = {
  classes: () => openClasses(),
  'class-open': (el) => openClass(el.dataset.id),
  'class-tab': (el) => { klass.tab = el.dataset.tab; klass.confirm = ''; render(); if (klass.tab === 'overview') refreshStats(); },
  'class-delete': (el) => { klass.confirm = el.dataset.id; render(); },
  'class-delete-no': () => { klass.confirm = ''; render(); },
  'class-delete-yes': (el) => deleteClass(el.dataset.id),
  'class-rename': () => renameClass(),
  'cls-reihe': (el) => classSettingAction('reihe', el),
  'cls-quick': (el) => classSettingAction('quick', el),
  'cls-op': (el) => classSettingAction('op', el),
  'cls-size': (el) => classSettingAction('size', el),
  'cls-round': (el) => classSettingAction('round', el),
  'glock-class': (el) => glockClass(el.dataset.v, null, el.dataset.cls),
  'glock-class-game': (el) => glockClass('some', el.dataset.game, el.dataset.cls),
  'glock-kid': (el) => glockKid(el.dataset.kid, el.dataset.v, null, el.dataset.cls),
  'glock-kid-game': (el) => glockKid(el.dataset.kid, 'some', el.dataset.game, el.dataset.cls),
  'glock-menu': (el) => { if (typeof openMenu === 'function') { MENU.glCls = el.dataset.cls || MENU.glCls; openMenu('spiele'); } },
  'kid-import': () => {
    const c = currentClass(), ta = $('#kid-import');
    const list = (ta?.value || '').split(/\r?\n/).map(parseKidLine).filter(Boolean);
    if (!list.length) { toast('Füge zuerst die Namen ein – ein Kind pro Zeile.', 'bad'); ta?.focus(); return; }
    addKids(c, list);
  },
  'vokaboom-import': () => openVokaboomImport(),
  'vokaboom-take': (el) => vokaboomTake(el.dataset.id),
  'vb-sync': () => vokaboomSync(false),
  'vb-sync-force': () => vokaboomSync(true),
  'vokaboom-new': () => vokaboomNew(),
  'go-vokaboom': () => goVokaboom(),
  'vb-class-import': (el) => importVokaboomClass(el.dataset.id),
  'kid-newpics': (el) => kidNewPics(el.dataset.id),
  'kid-delete': (el) => { klass.confirm = el.dataset.id; render(); },
  'kid-delete-no': () => { klass.confirm = ''; render(); },
  'kid-delete-yes': (el) => kidDelete(el.dataset.id, el.dataset.where || ''),
  'cards-pdf': () => downloadCardsPDF(),
  'stats-refresh': () => { klass.progress[ui.classId] = null; render(); refreshStats(); },
  'coin-lock': (el) => setCoinLock(el.dataset.form ? $('#lock-kid')?.value : el.dataset.id, true, el.dataset.form ? $('#lock-dur')?.value : el.dataset.dur),
  'coin-unlock': (el) => setCoinLock(el.dataset.id, false),
  'stats-kid': (el) => { klass.kidDetail = klass.kidDetail === el.dataset.id ? '' : el.dataset.id; render(); if (klass.kidDetail) $('#kid-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  'sheet-kid': (el) => previewKidSheet(el.dataset.id),
  'sheet-kid-pdf': (el) => downloadKidSheet(el.dataset.id),
  'sheets-all': () => downloadAllSheets(),
  'kid-login': () => openKidLogin(),
  'kid-pick': (el) => kidPick(+el.dataset.i),
  'kid-pw-mode': (el) => setKidLoginMode(el.dataset.mode),
  'tool-here': (el) => { closeModal(true); kidLoginFromCard(el.dataset.u, el.dataset.p.split('-').map(Number)); },
  'kid-unpick': () => { kidForm.picks.pop(); renderKidSlots(); },
  'kid-account': () => openKidAccount(),
  'kid-logout': () => kidLogout(),
  'kid-refresh': async () => { closeModal(true); try { await kidPushNow(); await kidRefresh(); toast('Auf dem neuesten Stand.'); } catch (e) { toast(kidErrorText(e), 'bad'); } },
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && isKid()) { saveDB.flush(); kidPushNow(); } });
window.addEventListener('online', () => { if (isKid()) kidPushNow(); });
