/* Teilmal – Anmeldung der Lehrperson (Supabase, E-Mail und Passwort)
 *
 * Läuft im selben Supabase-Projekt wie Vokaboom: Wer dort ein Konto hat, meldet sich hier mit
 * derselben E-Mail-Adresse und demselben Passwort an. Klassen und Kinder sind getrennt (eigene Tabellen).
 * Tabellen und Zugriffsregeln: supabase/einmaleins.sql, Einrichtung: supabase/ANLEITUNG.md.
 * Ohne Eintrag in js/config.js läuft Teilmal nur im Browser (alles ausser Klassen geht trotzdem).
 */
'use strict';

const CLOUD_CFG = { supabaseUrl: '', supabaseKey: '', ...(window.EINMALEINS_CONFIG || {}) };
const SB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
const SB_SRI = 'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok';
const AUTH_KEY = 'einmaleins-auth';

const cloud = { client: null, loading: null, uid: '', user: '' };
const cloudUrl = () => String(CLOUD_CFG.supabaseUrl || '').trim().replace(/\/+$/, '');
const cloudConfigured = () => /^https:\/\/[^/\s]+$/.test(cloudUrl()) && !!String(CLOUD_CFG.supabaseKey || '').trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const emailProblem = (e) => (!e ? 'Gib deine E-Mail-Adresse ein.' : !EMAIL_RE.test(e) ? 'Das sieht nicht wie eine E-Mail-Adresse aus.' : '');
const shortName = (email) => String(email || '').split('@')[0];
const siteUrl = () => location.origin + location.pathname;
const isTeacher = () => !!cloud.uid;

function loadSupabase() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (cloud.loading) return cloud.loading;
  cloud.loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SB_URL; s.integrity = SB_SRI; s.crossOrigin = 'anonymous';
    s.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('load')));
    s.onerror = () => { cloud.loading = null; s.remove(); reject(new Error('load')); };
    document.head.appendChild(s);
  });
  return cloud.loading;
}
async function cloudClient() {
  if (cloud.client) return cloud.client;
  const sb = await loadSupabase();
  cloud.client = sb.createClient(cloudUrl(), String(CLOUD_CFG.supabaseKey).trim(), {
    // Gemeinsames Anmelden mit Vokaboom: Sitzung im Cookie von fabulousteaching.ch (siehe js/sso.js)
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY, storage: SSO.authStorage(AUTH_KEY) },
  });
  cloud.client.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_OUT' && cloud.uid) setTimeout(() => { forgetCloudUser(); toast('Du wurdest abgemeldet.'); }, 0);
    if (ev === 'PASSWORD_RECOVERY' && session?.user) setTimeout(() => { setCloudUser(session.user); renderAccountSlot(); openNewPassword(); }, 0);
    if (ev === 'USER_UPDATED' && session?.user && cloud.uid) setTimeout(() => { cloud.user = session.user.email || cloud.user; renderAccountSlot(); }, 0);
  });
  return cloud.client;
}
function setCloudUser(user) { cloud.uid = user.id; cloud.user = user.email || ''; setTimeout(toolSeen, 0); }
function forgetCloudUser() {
  cloud.uid = ''; cloud.user = '';
  if (typeof klass === 'object') Object.assign(klass, { list: [], students: {}, progress: {}, loaded: false, error: '' });
  if (['classes', 'class'].includes(ui.view)) { ui.view = 'home'; }
  renderAccountSlot();
  render();
}

async function cloudInit() {
  if (!cloudConfigured()) return;
  const hp = new URLSearchParams(location.hash.slice(1));
  const fromMail = hp.has('access_token') ? (hp.get('type') || 'link') : '';
  if (hp.has('error') || hp.has('error_code') || hp.has('error_description')) {
    const code = hp.get('error_code') || hp.get('error') || '';
    try { history.replaceState(null, '', siteUrl() + location.search); } catch { /* */ }
    toast(/expired|invalid/i.test(code + (hp.get('error_description') || ''))
      ? 'Dieser Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.'
      : `Der Link aus der E-Mail hat nicht geklappt (${code}).`, 'bad');
  }
  const stored = SSO.teacherSignedIn(AUTH_KEY);
  if (!stored && !fromMail) return; // nicht angemeldet (auch nicht in Vokaboom): Supabase gar nicht erst laden
  try {
    const c = await cloudClient();
    const { data } = await c.auth.getSession();
    if (fromMail) { try { history.replaceState(null, '', siteUrl() + location.search); } catch { /* */ } }
    if (data?.session?.user) {
      setCloudUser(data.session.user);
      renderAccountSlot();
      if (fromMail === 'signup') toast('Deine E-Mail-Adresse ist bestätigt. Willkommen bei Teilmal!');
      if (ui.view === 'home') render();
    }
  } catch { /* offline: läuft ohne Konto weiter */ }
  renderAccountSlot();
}

async function cloudLogin(email, password, create) {
  const c = await cloudClient();
  const res = create
    ? await c.auth.signUp({ email, password, options: { emailRedirectTo: siteUrl() } })
    : await c.auth.signInWithPassword({ email, password });
  if (res.error) throw res.error;
  if (!res.data?.session?.user) {
    if (create && res.data?.user && Array.isArray(res.data.user.identities) && !res.data.user.identities.length) throw Object.assign(new Error('exists'), { code: 'user_already_exists' });
    if (create) return 'confirm';
    throw Object.assign(new Error('confirm'), { code: 'email_not_confirmed' });
  }
  setCloudUser(res.data.session.user);
  renderAccountSlot();
  return 'ok';
}
async function cloudLogout() {
  forgetCloudUser();
  try { await cloud.client?.auth.signOut({ scope: 'local' }); } catch { /* */ }
}
async function cloudResetPassword(email) {
  const c = await cloudClient();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
  if (error) throw error;
}
async function cloudChangeEmail(newEmail, password) {
  const c = await cloudClient();
  // Zur Sicherheit: aktuelles Passwort prüfen (z. B. an einem offenen Schulcomputer)
  const check = await c.auth.signInWithPassword({ email: cloud.user, password });
  if (check.error) {
    if (check.error.code === 'invalid_credentials' || /invalid login/i.test(check.error.message)) throw Object.assign(new Error('pw'), { code: 'wrong_password' });
    throw check.error;
  }
  const { data, error } = await c.auth.updateUser({ email: newEmail }, { emailRedirectTo: siteUrl() });
  if (error) throw error;
  if (data?.user?.email && normEmail(data.user.email) === newEmail) {
    setCloudUser(data.user);
    renderAccountSlot();
    return 'done';
  }
  return 'confirm';
}
async function cloudChangePassword(password) {
  const c = await cloudClient();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
}

function cloudErrorText(e) {
  const code = String(e?.code || ''), msg = String(e?.message || e || '');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse: Klicke auf den Link in der E-Mail, die du beim Erstellen des Kontos bekommen hast.';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'E-Mail-Adresse oder Passwort stimmt nicht.';
  if (code === 'user_already_exists' || code === 'email_exists' || /already (registered|exists)/i.test(msg)) return 'Mit dieser E-Mail-Adresse gibt es schon ein Konto (zum Beispiel von Vokaboom). Melde dich einfach an.';
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg)) return 'Es wurden gerade zu viele E-Mails verschickt. Versuch es in einer Stunde nochmal.';
  if (/error sending|sending (recovery|confirmation)|smtp/i.test(msg)) return 'Die E-Mail konnte nicht verschickt werden. Dafür muss in Supabase ein E-Mail-Versand (SMTP) eingerichtet sein – siehe supabase/ANLEITUNG.md.';
  if (code === 'weak_password' || /password.*(least|short|weak|characters)/i.test(msg)) return 'Das Passwort ist zu schwach. Nimm mindestens 8 Zeichen.';
  if (code === 'same_password') return 'Das ist schon dein Passwort.';
  if (code === 'wrong_password') return 'Das aktuelle Passwort stimmt nicht.';
  if (code === 'signup_disabled' || /signups? not allowed/i.test(msg)) return 'Neue Konten sind gerade ausgeschaltet.';
  if (code === 'over_request_rate_limit' || e?.status === 429) return 'Zu viele Versuche. Warte einen Moment und versuch es nochmal.';
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /relation .* does not exist|could not find the (table|function)/i.test(msg)) return 'In Supabase fehlen die Tabellen für Teilmal: Bitte supabase/einmaleins.sql im SQL Editor ausführen.';
  if (code === '42501' || /permission denied|row-level security/i.test(msg)) return 'Keine Berechtigung: Bitte supabase/einmaleins.sql in Supabase nochmals ganz ausführen.';
  if (msg === 'load') return 'Die Anmeldung konnte nicht geladen werden. Bist du online?';
  if (e instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) return 'Keine Verbindung zum Server. Bist du online? (Gratis-Projekte bei Supabase pausieren nach einer Woche ohne Nutzung.)';
  return msg || 'Unbekannter Fehler.';
}

/** Gemeinsames Anmelden: Hat sich im anderen Tool (Vokaboom) etwas geändert? */
let ssoBusy = false;
async function ssoCheck() {
  if (ssoBusy || !SSO.DOMAIN || !cloudConfigured()) return;
  ssoBusy = true;
  try {
    const signed = SSO.teacherSignedIn(AUTH_KEY);
    if (cloud.uid && !signed) { forgetCloudUser(); toast('Abgemeldet.'); return; }
    if (!cloud.uid && signed && !isKid()) {
      await cloudInit();
      if (cloud.uid) { toast(`Angemeldet als ${cloud.user}.`); render(); }
      return;
    }
    await kidSsoCheck();
  } finally { ssoBusy = false; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ssoCheck(); });
window.addEventListener('focus', () => ssoCheck());

/* ---------- Oberfläche ---------- */
function accountButtonHTML() {
  return toolSwitchHTML() + accountButtonCore();
}
function accountButtonCore() {
  if (!isKid() && typeof menuButtonHTML === 'function') return menuButtonHTML(); // ein Knopf „Menü“ mit Konto drin
  if (isKid()) return kidAccountButtonHTML();
  if (cloud.user) {
    return `<button class="account-btn in" data-action="account" title="Konto: ${esc(cloud.user)}" aria-label="Konto ${esc(cloud.user)}">${icon('user')}<span class="account-name">${esc(shortName(cloud.user))}</span></button>`;
  }
  return `<button class="account-btn" data-action="login-choose" title="Anmelden">${icon('user')}<span>Anmelden</span></button>`;
}
function renderAccountSlot() {
  const slot = document.getElementById('account-slot');
  if (slot) slot.innerHTML = accountButtonHTML();
  if (typeof updateCoinUI === 'function') updateCoinUI();
}

function openLoginChooser() {
  if (!cloudConfigured()) { openLogin(); return; }
  openModal(`${modalHead('Anmelden')}
    <div class="role-pick">
      <button type="button" class="role-tile kid" data-action="kid-login">
        <span class="role-art" aria-hidden="true">${[0, 5, 8].map((i) => kidPwImg(i)).join('')}</span>
        <strong>Ich bin ein Kind</strong><small>mit meinem Kärtchen</small>
      </button>
      <button type="button" class="role-tile teacher" data-action="login" data-mode="login">
        <span class="role-art" aria-hidden="true"><span class="role-icon">${icon('user')}</span></span>
        <strong>Ich bin Lehrperson</strong><small>mit E-Mail und Passwort</small>
      </button>
    </div>
    <p class="small center role-foot">Noch kein Konto? <button type="button" class="link-btn" data-action="login" data-mode="create">Als Lehrperson registrieren</button></p>`, { label: 'Anmelden', cls: 'auth-modal role-modal' });
}

function openLogin(mode = 'login') {
  if (!cloudConfigured()) {
    openModal(`${modalHead('Anmelden')}
      <p>Mit einem Konto legst du Klassen an, druckst Login-Kärtchen und siehst, welche Rechnungen den Kindern Mühe machen.</p>
      <p class="muted">Die Anmeldung ist noch nicht eingerichtet. Wie das geht, steht in <code>supabase/ANLEITUNG.md</code>.</p>
      <footer class="modal-foot"><button type="button" class="btn primary" data-action="close-modal">OK</button></footer>`, { label: 'Anmelden' });
    return;
  }
  const create = mode === 'create';
  const prevEmail = $('#auth-email')?.value || '';
  openModal(`${modalHead(create ? 'Konto erstellen' : 'Anmelden')}
    <form class="auth-form" id="auth-form" autocomplete="on" novalidate>
      <label class="field" for="auth-email"><span class="label">E-Mail-Adresse</span>
        <input id="auth-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200" required autofocus placeholder="name@schule.ch" value="${esc(prevEmail)}"></label>
      <label class="field" for="auth-pass"><span class="label">Passwort</span>
        <input id="auth-pass" name="password" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" minlength="8" required></label>
      ${create ? `<label class="field" for="auth-pass2"><span class="label">Passwort wiederholen</span>
        <input id="auth-pass2" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="muted small">Mindestens 8 Zeichen.</p>` : ''}
      <p class="form-error" id="auth-error" role="alert"></p>
      <p class="form-info" id="auth-info" role="status"></p>
      <button class="btn primary big" type="submit" id="auth-submit">${create ? 'Konto erstellen' : 'Anmelden'}</button>
      ${create ? '' : '<button type="button" class="link-btn" data-action="pw-forgot">Passwort vergessen?</button>'}
    </form>
    <p class="small center role-foot">${create
      ? 'Schon ein Konto? <button type="button" class="link-btn" data-action="login" data-mode="login">Anmelden</button>'
      : 'Noch kein Konto? <button type="button" class="link-btn" data-action="login" data-mode="create">Registrieren</button>'}
      · <button type="button" class="link-btn" data-action="login-choose">Zurück</button></p>
    <p class="muted small">Es ist dasselbe Konto wie bei Vokaboom (gleiche E-Mail-Adresse, gleiches Passwort). Damit legst du Klassen an, druckst Login-Kärtchen und siehst, welche Rechnungen den Kindern Mühe machen.</p>`, { label: create ? 'Konto erstellen' : 'Anmelden', cls: 'auth-modal' });
  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#auth-error'), info = $('#auth-info'), btn = $('#auth-submit');
    const email = normEmail($('#auth-email').value), pw = $('#auth-pass').value;
    const problem = emailProblem(email) || (pw.length < 8 ? 'Das Passwort braucht mindestens 8 Zeichen.' : '')
      || (create && pw !== $('#auth-pass2').value ? 'Die beiden Passwörter sind nicht gleich.' : '');
    if (problem) { err.textContent = problem; return; }
    err.textContent = ''; info.textContent = '';
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${create ? 'Konto wird erstellt …' : 'Anmelden …'}`;
    try {
      const res = await cloudLogin(email, pw, create);
      if (res === 'confirm') {
        if (!$('#auth-info')) return;
        info.textContent = `Fast geschafft! Wir haben dir eine E-Mail an ${email} geschickt. Klicke auf den Link darin, dann bist du angemeldet.`;
        btn.disabled = false;
        btn.textContent = 'Konto erstellen';
        return;
      }
      closeModal(true);
      toast(create ? 'Willkommen! Dein Konto ist bereit.' : `Angemeldet als ${email}.`);
      render();
    } catch (ex) {
      if (!$('#auth-error')) return;
      err.textContent = cloudErrorText(ex);
      btn.disabled = false;
      btn.textContent = create ? 'Konto erstellen' : 'Anmelden';
    }
  });
}
async function forgotPassword() {
  const err = $('#auth-error'), info = $('#auth-info');
  if (!err) return;
  const email = normEmail($('#auth-email').value);
  const problem = emailProblem(email);
  if (problem) { err.textContent = `${problem} Dann schicken wir dir einen Link für ein neues Passwort.`; $('#auth-email').focus(); return; }
  err.textContent = ''; info.textContent = 'E-Mail wird verschickt …';
  try {
    await cloudResetPassword(email);
    if ($('#auth-info')) info.textContent = `Wenn es ein Konto mit ${email} gibt, ist jetzt eine E-Mail unterwegs. Klicke auf den Link darin und wähle ein neues Passwort.`;
  } catch (ex) {
    if (!$('#auth-error')) return;
    info.textContent = '';
    err.textContent = cloudErrorText(ex);
  }
}
function openNewPassword() {
  openModal(`${modalHead('Neues Passwort')}
    <p class="muted">Du bist angemeldet als <strong>${esc(cloud.user)}</strong>. Wähle jetzt ein neues Passwort.</p>
    <form class="auth-form" id="newpw-form" novalidate>
      <input type="email" name="email" autocomplete="username" value="${esc(cloud.user)}" hidden>
      <label class="field" for="newpw-1"><span class="label">Neues Passwort</span><input id="newpw-1" type="password" autocomplete="new-password" minlength="8" autofocus></label>
      <label class="field" for="newpw-2"><span class="label">Passwort wiederholen</span><input id="newpw-2" type="password" autocomplete="new-password" minlength="8"></label>
      <p class="form-error" id="newpw-error" role="alert"></p>
      <button class="btn primary big" type="submit">Passwort speichern</button>
    </form>`, { label: 'Neues Passwort', cls: 'auth-modal' });
  $('#newpw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#newpw-1').value, b = $('#newpw-2').value, err = $('#newpw-error');
    if (a.length < 8) { err.textContent = 'Das Passwort braucht mindestens 8 Zeichen.'; return; }
    if (a !== b) { err.textContent = 'Die beiden Passwörter sind nicht gleich.'; return; }
    try {
      await cloudChangePassword(a);
      closeModal(true);
      toast('Neues Passwort gespeichert. Du bist angemeldet.');
    } catch (ex) { err.textContent = cloudErrorText(ex); }
  });
}
function openAccount() {
  if (typeof openMenu === 'function') { openMenu('konto'); return; }
  openModal(`${modalHead('Dein Konto')}${accountSectionHTML()}`, { label: 'Konto' });
  bindAccountForms();
}
/** Konto: Karte, Klassen, Abmelden, Passwort und E-Mail ändern (im Menü, wie in Vokaboom) */
function accountSectionHTML() {
  return `
    <div class="account-card">
      <span class="account-avatar" aria-hidden="true">${esc(cloud.user.charAt(0).toUpperCase())}</span>
      <div><strong>${esc(cloud.user)}</strong><p class="small" id="acct-status">Lehrperson · dasselbe Konto wie bei Vokaboom</p></div>
    </div>
    <p class="muted small">Deine Klassen und die Kinder-Logins sind in deinem Konto gespeichert${SSO.DOMAIN ? '. In Vokaboom bist du auf diesem Gerät auch angemeldet' : ''}. Deine eigenen Übungen auf diesem Gerät bleiben nur hier gespeichert.</p>
    <div class="row">
      <button type="button" class="btn secondary" data-action="classes">${icon('users')} Klassen & Übersicht</button>
      ${toolBoth() && CLOUD_CFG.vokaboomUrl ? '<button type="button" class="btn ghost" data-action="go-vokaboom"><span class="ot-tag">ABC</span> Zu Vokaboom</button>' : ''}
      <button type="button" class="btn ghost" data-action="logout">Abmelden</button>
    </div>
    <details class="pw-change"><summary>Passwort ändern</summary>
      <form id="pw-form" class="auth-form" novalidate>
        <input type="email" name="email" autocomplete="username" value="${esc(cloud.user)}" hidden>
        <label class="field" for="pw-new"><span class="label">Neues Passwort</span><input id="pw-new" type="password" autocomplete="new-password" minlength="8"></label>
        <p class="form-error" id="pw-error" role="alert"></p>
        <button type="submit" class="btn small primary">Speichern</button>
      </form>
    </details>
    <details class="pw-change"><summary>E-Mail-Adresse ändern</summary>
      <form id="mail-form" class="auth-form" novalidate>
        <label class="field" for="mail-new"><span class="label">Neue E-Mail-Adresse</span>
          <input id="mail-new" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200" placeholder="name@schule.ch"></label>
        <label class="field" for="mail-pw"><span class="label">Aktuelles Passwort</span><input id="mail-pw" type="password" autocomplete="current-password"></label>
        <p class="form-error" id="mail-error" role="alert"></p>
        <p class="form-info" id="mail-info" role="status"></p>
        <button type="submit" class="btn small primary" id="mail-submit">E-Mail-Adresse ändern</button>
      </form>
    </details>`;
}
function bindAccountForms() {
  $('#mail-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#mail-error'), info = $('#mail-info'), btn = $('#mail-submit');
    const email = normEmail($('#mail-new').value), pw = $('#mail-pw').value;
    const problem = emailProblem(email) || (email === normEmail(cloud.user) ? 'Das ist schon deine E-Mail-Adresse.' : '') || (!pw ? 'Gib zur Sicherheit dein aktuelles Passwort ein.' : '');
    if (problem) { err.textContent = problem; info.textContent = ''; return; }
    err.textContent = ''; info.textContent = '';
    btn.disabled = true;
    try {
      const res = await cloudChangeEmail(email, pw);
      if (res === 'done') {
        if (typeof openMenu === 'function') openMenu('konto'); else openAccount();
        toast(`Deine E-Mail-Adresse ist jetzt ${email}. Melde dich ab jetzt damit an.`);
        return;
      }
      if (!$('#mail-info')) return;
      $('#mail-pw').value = '';
      info.textContent = `Fast geschafft! Wir haben eine E-Mail an ${email} geschickt (eventuell auch eine an deine bisherige Adresse). Klicke auf den Link darin – erst dann gilt die neue Adresse. Bis dahin meldest du dich weiter mit ${cloud.user} an.`;
    } catch (ex) {
      if (!$('#mail-error')) return;
      err.textContent = ['email_exists', 'user_already_exists'].includes(ex?.code) || /already (registered|exists)/i.test(ex?.message || '')
        ? 'Diese E-Mail-Adresse gehört schon zu einem anderen Konto.'
        : cloudErrorText(ex);
    } finally {
      if ($('#mail-submit')) btn.disabled = false;
    }
  });
  $('#pw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#pw-new').value, err = $('#pw-error');
    if (pw.length < 8) { err.textContent = 'Das Passwort braucht mindestens 8 Zeichen.'; return; }
    try { await cloudChangePassword(pw); err.textContent = ''; $('#pw-new').value = ''; toast('Passwort geändert.'); } catch (ex) { err.textContent = cloudErrorText(ex); }
  });
}

/* ---------- Wechsel zwischen Vokaboom und Teilmal ----------
 * Den Knopf gibt es erst, wenn die Lehrperson in BEIDEN Tools mindestens einmal angemeldet war
 * (fab_teacher_seen in supabase/avatar.sql). Dann wechseln Lehrperson und Kinder in beide Richtungen.
 * Kinder: das Tool fragt die Datenbank (kid.vb), ob ihre Lehrperson beide Tools nutzt. */
const TOOL_ME = 'teilmal';
const toolBothKey = (uid) => `fab.tools.both.${uid}`;
function toolBoth() {
  if (isKid()) return !!kid.vb;
  if (!cloud.uid) return false;
  if (cloud.both === undefined) { try { cloud.both = localStorage.getItem(toolBothKey(cloud.uid)) === '1'; } catch { cloud.both = false; } }
  return !!cloud.both;
}
/** Lehrperson angemeldet: dem Server melden „ich war in diesem Tool“; er sagt, ob sie in beiden Tools war */
function toolSeen() {
  const uid = cloud.uid;
  if (!uid || cloud.toolSeenUid === uid) return;
  cloud.toolSeenUid = uid; cloud.both = undefined;
  cloudClient().then((c) => c.rpc('fab_teacher_seen', { p_tool: TOOL_ME })).then(({ data, error }) => {
    if (error || cloud.uid !== uid) return;
    const both = data === true;
    try { localStorage.setItem(toolBothKey(uid), both ? '1' : '0'); } catch { /* egal */ }
    if (both !== cloud.both) { cloud.both = both; renderAccountSlot(); }
  }).catch(() => { cloud.toolSeenUid = ''; });
}
function toolSwitchHTML() {
  if (!CLOUD_CFG.vokaboomUrl || !toolBoth()) return '';
  return `<button class="btn small ghost tool-switch" data-action="go-vokaboom" title="Zu Vokaboom wechseln (Vokabeln üben)"><span class="ot-tag">ABC</span><span class="ts-name">Vokaboom</span></button>`;
}
