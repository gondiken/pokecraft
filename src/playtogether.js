// Play together: the share/join box in the pause screen, the visitor's loadWorld, and the glue
// between Multiplayer, Duels and the game. Moved out of main.js without changes to its logic.
import { WORLD_W, WORLD_D } from './world.js';
import { Multiplayer, cleanCode } from './multiplayer.js';
import { Duels } from './duel.js';
import { coopFor } from './coopboss.js'; // T29
import { el } from './util.js';
import { realmOf } from './realms.js'; // T31

// deps: createWorld(seed, edits, size) swaps the world, save() / pushCloud() save the game,
// startBattle(opts) begins a battle, pauseEl is the pause screen, resume() closes it (T38b).
export function createPlayTogether(game, { createWorld, save, pushCloud, startBattle, pauseEl, resume }) {
  const NAME_KEY = 'pokecraft-name';
  const mpBox = document.getElementById('mp');
  let mpMessage = { text: '', error: false };

  game.mp = new Multiplayer(game, {
    toast: text => { game.ui.toast(text); renderMp(); },
    // Joining: swap in the host's world, keeping your own team, badges and items.
    loadWorld: data => {
      const p = game.player;
      game.homeWorld = {
        seed: game.world.seed, edits: [...game.world.edits], size: [WORLD_W, WORLD_D],
        pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, pitch: p.pitch, time: game.time,
        homes: game.homes.toSave(), // T22: your own world's homes, saved while you visit
      };
      createWorld(data.seed, data.edits, data.size);
      game.homes.load(data.homes, data.owner); // the host's homes (and who owns this world)
      game.npcs.undisguise(key => game.beaten.includes(key));
      game.time = data.time;
      if (data.weather) game.weather.apply(data.weather);
      const np = game.player;
      np.pos.set(data.hostPos[0] + 1.5, data.hostPos[1], data.hostPos[2] + 1.5);
      for (let i = 0; i < 20 && np.collides(np.pos); i++) np.pos.y += 1;
      game.ui.renderHud();
      // T38b: a host who is away in a realm: realms.update asks "Dad is dreaming. Dream together?" as soon as the host's avatar is known
    },
    home: rec => (game.place && game.place !== 'main' ? game.realms.stashHome(rec) : game.homes.apply(rec)), // T31: away in a realm: keep it for later
    duel: p => game.duels.onMessage(p),
    hs: p => game.hideSeek?.onMessage(p), // T30
    realm: p => game.realms.answer(p), // T38b: a guest asks to follow me into my realm
    left: id => { game.duels.left(id); game.hideSeek?.left(id); }, // T30
    ended: reason => {
      if (reason !== 'host-left') return;
      game.hostLeft = true;
      if (game.inBattle) { game.ui.toast('The host left. You will go back to your own world after this battle.'); return; }
      game.ui.toast('The host left, so you are going back to your own world.');
      setTimeout(goHome, 2500);
    },
  });

  game.duels = new Duels(game, {
    start: duel => startBattle(duel.coop ? { duel, boss: true } : { duel }), // T29: co-op boss
    toast: text => game.ui.toast(text),
  });

  game.coopFor = coopFor; // T29

  function playerName() {
    let name = '';
    try { name = localStorage.getItem(NAME_KEY) || ''; } catch { /* ignore */ }
    return name || game.user?.email?.split('@')[0] || '';
  }

  // Leave someone else's world: save your own progress, then reload into your own world.
  async function goHome() {
    save();
    await pushCloud();
    game.mp.close();
    // Keep homeWorld set: the save that runs while the page unloads must still save your own world.
    location.reload();
  }

  function setMpMessage(text, error = false) {
    mpMessage = { text, error };
    renderMp();
  }

  // T30: the hide and seek buttons (one per player) and the Stop button. Clicking redraws the box.
  function hideSeekButtons() {
    return (game.hideSeek?.menuButtons() || []).map(b => { b.addEventListener('click', () => setTimeout(renderMp, 0)); return b; });
  }

  // T38b, host: one line for every player who is in another place.
  function awayLines() {
    const mine = game.place || 'main';
    return [...game.mp.others.values()].filter(a => a.place !== mine).map(a => {
      const r = realmOf(a.place);
      return el('div', { class: 'mp-who' }, r ? `${a.name} is in the ${r.name}.` : `${a.name} is back in your world.`);
    });
  }

  // T38b, guest: a Follow button while the host is in a realm and I am not there.
  function followButton() {
    const id = game.realms.hostPlace(), r = realmOf(id);
    if (!r || game.place === id) return [];
    const name = game.mp.hostName || 'your friend';
    return [el('button', { class: 'small primary', onclick: () => { resume(); game.realms.follow(); } }, `Follow ${name} into the ${r.name}`)];
  }

  function renderMp() {
    const mp = game.mp;
    const msg = mpMessage.text && el('div', { class: `acct-msg${mpMessage.error ? ' error' : ''}` }, mpMessage.text);
    const others = mp.players;
    const who = others.length ? `Playing with: ${others.join(', ')}` : 'Nobody else is here yet.';
    if (mp.role === 'host') {
      mpBox.replaceChildren(
        el('h3', {}, 'Play together'),
        el('div', {}, 'Your world code is'),
        el('div', { class: 'mp-code' }, mp.code),
        el('div', {}, 'The other player picks "Join a world" and types this code.'),
        el('div', { class: 'mp-who' }, who),
        ...hideSeekButtons(), // T30
        ...awayLines(), // T38b
        el('button', { class: 'small', onclick: () => { mp.close(); setMpMessage('You stopped sharing your world.'); } }, 'Stop sharing'),
        msg);
      return;
    }
    if (mp.role === 'guest') {
      mpBox.replaceChildren(
        el('h3', {}, 'Play together'),
        el('div', {}, `You are visiting ${mp.hostName || 'a friend'}'s world.`),
        el('div', { class: 'mp-who' }, who),
        ...hideSeekButtons(), // T30
        ...followButton(), // T38b
        el('div', {}, 'Your team, badges and items are still yours and keep saving.'),
        el('button', { class: 'small', onclick: goHome }, 'Go back to my world'),
        msg);
      return;
    }
    if (mp.role === 'joining') {
      mpBox.replaceChildren(el('h3', {}, 'Play together'), el('div', {}, 'Joining...'));
      return;
    }
    const name = el('input', { type: 'text', placeholder: 'Your name', maxlength: 16, value: playerName() });
    const code = el('input', { type: 'text', placeholder: 'World code', maxlength: 5, class: 'mp-code-input' });
    code.addEventListener('input', () => { code.value = cleanCode(code.value); });
    const checkName = () => {
      const n = name.value.trim();
      if (!n) { setMpMessage('Type your name first, so the other player knows who you are.', true); return null; }
      try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ }
      return n;
    };
    const host = async () => {
      const n = checkName(); if (!n) return;
      setMpMessage('Connecting...');
      const res = await mp.host(n);
      setMpMessage(res.error || '', !!res.error);
    };
    const join = async () => {
      const n = checkName(); if (!n) return;
      if (code.value.length !== 5) { setMpMessage('Type the 5-letter world code first.', true); return; }
      if (game.place && game.place !== 'main') await game.realms.leave('quiet'); // T31: wake up before visiting
      save();
      mpMessage = { text: '', error: false };
      const pending = mp.join(code.value, n);
      renderMp();
      const res = await pending;
      if (res.error) { setMpMessage(res.error, true); return; }
      setMpMessage(`Welcome to ${res.hostName}'s world! Tap or click outside this box to play.`);
    };
    mpBox.replaceChildren(
      el('h3', {}, 'Play together'),
      el('div', { class: 'acct-form' },
        name,
        el('div', { class: 'acct-btns' }, el('button', { class: 'small primary', onclick: host }, 'Share my world')),
        el('div', { class: 'mp-or' }, 'or join someone else'),
        code,
        el('div', { class: 'acct-btns' }, el('button', { class: 'small', onclick: join }, 'Join a world'))),
      msg);
  }

  // Clicks inside the box shouldn't count as "click anywhere to resume".
  mpBox.addEventListener('click', e => e.stopPropagation());
  mpBox.addEventListener('pointerdown', e => e.stopPropagation());
  // T30: players walk closer / further while the box is open, so the hide and seek buttons follow.
  setInterval(() => { if (!pauseEl.classList.contains('hidden') && game.mp.active) renderMp(); }, 1000);
  new MutationObserver(() => { if (!pauseEl.classList.contains('hidden')) renderMp(); })
    .observe(pauseEl, { attributes: true, attributeFilter: ['class'] });

  return { goHome };
}
