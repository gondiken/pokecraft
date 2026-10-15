// Accounts and online saves: the sign-in box on the title screen and the upload/download of the
// save. Moved out of main.js without changes to its logic.
import * as cloud from './cloud.js';
import { el } from './util.js';

// deps: loadSave() reads the save on this device, saveKey is its localStorage key, showTitle() and
// pause() are the game's screens.
export function createAccounts(game, { loadSave, saveKey, showTitle, pause }) {
  let pendingCloud = null; // newest save not yet uploaded
  let cloudBusy = false;
  const cloudState = { text: '', error: false };

  async function pushCloud() {
    if (!game.user || !pendingCloud || cloudBusy) return;
    const data = pendingCloud;
    pendingCloud = null;
    cloudBusy = true;
    try {
      await cloud.saveCloud(data);
      const t = new Date();
      setCloudState(`Saved online at ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
    } catch (e) {
      pendingCloud ??= data; // retry with the next cloud save
      setCloudState(`Couldn't save online: ${e.message} Progress is still saved on this device.`, true);
    }
    cloudBusy = false;
  }

  function setCloudState(text, error = false) {
    cloudState.text = text;
    cloudState.error = error;
    renderCloudStatus();
  }

  function renderCloudStatus() {
    const box = document.getElementById('cloud-status');
    const text = game.user ? (cloudState.text || `Signed in as ${game.user.email}`)
      : 'Not signed in: progress is only saved on this device.';
    box.textContent = text;
    box.classList.toggle('error', game.user && cloudState.error);
  }

  // After signing in: use whichever save is newer, the one online or the one on this device.
  async function syncFromCloud() {
    try {
      const online = await cloud.loadCloud();
      const local = loadSave();
      if (online && (!local || (online.savedAt || 0) > (local.savedAt || 0))) {
        try { localStorage.setItem(saveKey, JSON.stringify(online)); } catch { /* storage unavailable */ }
        if (!game.started) showTitle();
        setCloudState('Loaded your online save.');
      } else if (local && local.seed !== undefined) {
        await cloud.saveCloud(local);
        setCloudState('Your progress is saved online.');
      }
    } catch (e) {
      setCloudState(`Couldn't reach your online save: ${e.message}`, true);
    }
  }

  let typedEmail = ''; // kept across re-renders so a typo doesn't mean retyping everything

  function renderAccount(mode = 'idle', message = '', isError = false) {
    const box = document.getElementById('account');
    const msg = message && el('div', { class: `acct-msg${isError ? ' error' : ''}` }, message);
    if (game.user) {
      box.replaceChildren(
        el('div', {}, '☁ Signed in as ', el('b', {}, game.user.email), ' · your game saves online'),
        el('button', { class: 'small', onclick: async () => {
          await cloud.signOut();
          game.user = null;
          renderAccount('idle', 'Signed out. Progress is still saved on this device.');
          renderCloudStatus();
        } }, 'Sign out'),
        msg);
      return;
    }
    if (mode !== 'form') {
      box.replaceChildren(
        el('div', {}, 'Want to play on another device too?'),
        el('button', { class: 'small', onclick: () => renderAccount('form') }, 'Sign in / Create account'),
        msg);
      return;
    }
    if (mode === 'newPassword') {
      const pw = el('input', { type: 'password', placeholder: 'New password (6+ characters)', autocomplete: 'new-password' });
      const setIt = async () => {
        if (pw.value.length < 6) { renderAccount('newPassword', 'The password needs at least 6 characters.', true); return; }
        box.querySelectorAll('button,input').forEach(b => { b.disabled = true; });
        const res = await cloud.setNewPassword(pw.value);
        if (res.error) { renderAccount('newPassword', res.error, true); return; }
        game.user = res.user;
        renderAccount('idle', 'Password changed! You are signed in.');
        await syncFromCloud();
      };
      box.replaceChildren(
        el('div', {}, 'Choose a new password'),
        el('form', { class: 'acct-form', onsubmit: e => { e.preventDefault(); setIt(); } },
          pw, el('div', { class: 'acct-btns' }, el('button', { class: 'small primary', type: 'submit' }, 'Save password'))),
        msg);
      pw.focus();
      return;
    }
    const email = el('input', { type: 'email', placeholder: 'Email', autocomplete: 'email', value: typedEmail });
    email.addEventListener('input', () => { typedEmail = email.value; });
    const password = el('input', { type: 'password', placeholder: 'Password (6+ characters)', autocomplete: 'current-password' });
    const go = async create => {
      if (!email.value || !password.value) { renderAccount('form', 'Enter an email and a password.', true); return; }
      box.querySelectorAll('button,input').forEach(b => { b.disabled = true; });
      const res = create ? await cloud.signUp(email.value.trim(), password.value) : await cloud.signIn(email.value.trim(), password.value);
      if (res.error) { renderAccount('form', res.error, true); return; }
      if (res.needsConfirm) {
        renderAccount('idle', `Almost done! We sent an email to ${email.value.trim()}. Click the link in it, then sign in here.`);
        return;
      }
      game.user = res.user;
      renderAccount('idle', 'Signed in! Syncing your save...');
      await syncFromCloud();
      renderAccount('idle', cloudState.text, cloudState.error);
    };
    const forgot = async () => {
      const address = email.value.trim();
      if (!address) { renderAccount('form', 'Type your email first, then press "Forgot password?".', true); return; }
      const res = await cloud.sendPasswordReset(address);
      renderAccount('form', res.error || `We sent a link to ${address}. Open it on this device to choose a new password.`, !!res.error);
    };
    box.replaceChildren(
      el('form', { class: 'acct-form', onsubmit: e => { e.preventDefault(); go(false); } },
        email, password,
        el('div', { class: 'acct-btns' },
          el('button', { class: 'small primary', type: 'submit' }, 'Sign in'),
          el('button', { class: 'small', type: 'button', onclick: () => go(true) }, 'Create account'),
          el('button', { class: 'small', type: 'button', onclick: () => renderAccount('idle') }, 'Cancel')),
        el('div', { class: 'acct-btns' },
          el('button', { class: 'small link', type: 'button', onclick: forgot }, 'Forgot password?'))),
      msg);
    (typedEmail ? password : email).focus();
  }

  async function initAccount() {
    // Opened from a "reset password" email: ask for the new password straight away.
    let recovering = false;
    cloud.onAuthChange((event, user) => {
      if (event !== 'PASSWORD_RECOVERY') return;
      recovering = true;
      game.user = user;
      if (game.started) pause();
      document.getElementById('title').classList.remove('hidden');
      renderAccount('newPassword');
    });
    game.user = await cloud.currentUser();
    if (recovering) return; // the new-password form is showing; don't replace it
    renderAccount();
    renderCloudStatus();
    if (game.user) {
      await syncFromCloud();
      renderAccount('idle', cloudState.error ? cloudState.text : '', cloudState.error);
    }
  }

  return {
    // Remember the newest save so the next pushCloud() uploads it.
    queue(data) { pendingCloud = data; },
    pushCloud, renderAccount, renderCloudStatus, initAccount,
  };
}
