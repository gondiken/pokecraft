// Hide and seek (T30): a play-together game for two. The inviter (leader) runs the clock and the score and sends
// `round` messages; the seeker says when the hider is found. Nothing is saved; nothing in the world changes.
import { sound } from './sound.js';
import { el } from './util.js';
import { SEEK } from './glint.js';

export const HS = { hide: 60, seek: 180, brk: 6, answer: 30, radius: 40, near: 24, help: 6, beat: 2, lost: 10,
  bump: 1.0, fenceToast: 3, VERSION: 1 };
const ORDER = { hide: 0, seek: 1, brk: 2 };
export const seekPeriod = d => SEEK.period(d);
export const seekWord = d => (d > 30 ? 'Cold' : d > 15 ? 'Warm' : d > 6 ? 'Hot!' : 'Very hot!');

const newId = () => Math.random().toString(36).slice(2, 10);
const clock = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export function createHideSeek(game) {
  let s = null;          // the running game, or null
  let asking = null;     // { id, to, name, timer } I asked someone
  let incoming = null;   // { id, from, name, timer, onYes } someone asked me
  let pending = null;    // { id, from, name, timer } I said yes and wait for the first round
  let hudAt = 0, compass = { shown: false, period: 3, word: '' }, wobbleAt = 0, wobble = 0;
  const lastToast = { fence: 0, battle: 0, ride: 0 };
  const now = () => performance.now();
  const me = () => game.mp.id;
  const myName = () => game.mp.name;
  const avatarOf = id => game.mp.others.get(id);
  const nameOf = id => (id === me() ? myName() : s?.partnerName || avatarOf(id)?.name || 'Your friend');
  const role = () => (!s ? null : s.hider === me() ? 'hider' : 'seeker');
  const inGym = () => {
    const p = game.player.pos;
    return !!game.world.fenced(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  };
  const scoreLine = () => {
    const ids = s.leader ? [me(), s.partner] : [s.partner, me()];
    return ids.map(id => `${nameOf(id)} ${s.score[id] || 0}`).join(' · ');
  };
  const send = (to, data) => game.mp.sendHs(to, data);

  const busy = () => !game.started || game.inBattle || !!s || !!asking || !!incoming || !!pending
    || game.ui.asking || !!game.duels.incoming || !!game.duels.asking || !!game.duels.current || inGym();

  // The seeker must not see the hider's name tag (it shows through walls) or lead creature.
  function setHiding(a, on) {
    if (!a) return;
    a.hiding = on;
    if (a.tag) a.tag.visible = !on;
    if (a.lead) a.lead.visible = !on && !a.isDueling && !a.rideModel;
    a.unseen = on && s?.phase === 'hide'; // Avatar.update draws the model from this
    a.model.visible = !a.unseen && a.here !== false;
  }

  function flags() {
    if (s) setHiding(avatarOf(s.partner), role() === 'seeker' && s.phase !== 'brk');
  }

  function clearUi() {
    game.ui.setSeekCompass(null);
    game.ui.setHideSeek(null);
    game.ui.setDark(null);
    compass = { shown: false, period: 3, word: '' };
  }

  function end(text) {
    if (!s) return;
    const line = scoreLine();
    const a = avatarOf(s.partner);
    s = null;
    setHiding(a, false);
    clearUi();
    if (text) { game.ui.toast(text); game.ui.toast(`Final score: ${line}. Good game!`); }
  }

  function enter(phase) {
    s.phase = phase;
    s.foundSent = false;
    s.warned = false;
    s.ticked = false;
    if (game.riding?.creature) game.riding.stop('quiet');
    game.player.keys = {};
    game.touch?.reset();
    const r = role(), pn = s.partnerName;
    if (phase === 'hide') {
      if (r === 'hider') game.ui.toast(`Hide! ${pn} is counting to ${HS.hide}. Stay inside the play area.`);
      else game.ui.toast(`Close your eyes! ${pn} is hiding.`);
    } else if (phase === 'seek') {
      sound.play('ticktock');
      if (r === 'seeker') { game.ui.toast('Ready or not, here I come!'); game.ui.toast(`Find ${pn}! Tap or click them when you see them.`); }
      else game.ui.toast(`${pn} is looking for you! Keep still...`);
    } else if (s.result) {
      const { kind, seeker, hider } = s.result;
      game.ui.toast(kind === 'found' ? `${nameOf(seeker)} found ${nameOf(hider)}!` : `${nameOf(hider)} hid so well! Nobody found them.`);
      game.ui.toast(`Score: ${scoreLine()}. Next: ${nameOf(s.hider === me() ? s.partner : me())} hides!`);
      if (kind === 'found') sound.play('keyfound');
    }
    flags();
    hudAt = 0;
  }

  function sendRound() {
    if (!s || !s.leader) return;
    s.beatAt = now();
    send(s.partner, { type: 'round', id: s.id, n: s.n, hider: s.hider, phase: s.phase, left: Math.max(0, s.endsAt - now()),
      score: s.score, center: s.center, help: s.help, result: s.result });
  }

  function begin(partner, partnerName, id, leader, extra) {
    s = { id, leader, partner, partnerName, center: extra.center, n: extra.n, hider: extra.hider, phase: 'hide',
      endsAt: now() + HS.hide * 1000, score: extra.score, help: false, helpNear: undefined, heardAt: now(),
      foundSent: false, result: null, beatAt: 0 };
  }

  // Leader only: `who` gets the point (the seeker who found, or the hider when time ran out).
  function point(who, kind) {
    const seeker = s.hider === me() ? s.partner : me();
    s.score[who] = (s.score[who] || 0) + 1;
    s.result = { kind, seeker, hider: s.hider };
    s.endsAt = now() + HS.brk * 1000;
    enter('brk');
    sendRound();
  }

  function found(how) {
    if (!s || s.phase !== 'seek' || role() !== 'seeker') return;
    s.foundSent = true;
    if (s.leader) point(me(), 'found');
    else send(s.partner, { type: 'found', id: s.id, n: s.n, how });
  }

  function accept() {
    const inc = incoming;
    if (!inc) return;
    clearTimeout(inc.timer);
    incoming = null;
    if (busy()) { send(inc.from, { type: 'no', id: inc.id, busy: true }); return; }
    send(inc.from, { type: 'yes', id: inc.id, v: HS.VERSION });
    pending = { id: inc.id, from: inc.from, name: inc.name, timer: setTimeout(() => {
      pending = null;
      game.ui.toast("Couldn't start the game. Try again!");
    }, 10000) };
  }

  function decline() {
    const inc = incoming;
    if (!inc) return;
    clearTimeout(inc.timer);
    incoming = null;
    send(inc.from, { type: 'no', id: inc.id });
  }

  function closeIncomingBox() {
    if (incoming && game.ui.asked?.onYes === incoming.onYes) game.ui.closeAsk();
  }

  const self = {
    HS,
    get active() { return !!s; },
    get role() { return role(); },
    get frozen() { return !!s && s.phase === 'hide' && role() === 'seeker'; },
    ticker: null,

    // Other players close enough to play with.
    nearby() {
      const p = game.player.pos;
      return [...game.mp.others.values()].filter(a => a.here && a.pos.distanceTo(p) <= HS.near); // T31: same place only
    },

    // Buttons and lines for the Play-together box.
    menuButtons() {
      if (!game.mp.active) return [];
      if (s) return [el('button', { class: 'small', onclick: () => self.stop() }, 'Stop hide and seek')];
      const out = [];
      const near = new Set(self.nearby());
      for (const a of game.mp.others.values()) {
        if (near.has(a)) out.push(el('button', { class: 'small', onclick: () => self.invite(a) }, `Hide and seek with ${a.name}`));
        else out.push(el('div', { class: 'mp-who' }, `Walk closer to ${a.name} to play hide and seek.`));
      }
      return out;
    },

    invite(avatar) {
      if (asking) { game.ui.toast(`Still waiting for ${asking.name} to answer.`); return; }
      if (inGym()) { game.ui.toast('Walk out of the gym first, then ask.'); return; }
      if (busy()) { game.ui.toast('Finish what you are doing first, then ask.'); return; }
      const id = newId();
      asking = { id, to: avatar.id, name: avatar.name, timer: setTimeout(() => {
        send(avatar.id, { type: 'cancel', id });
        asking = null;
        game.ui.toast(`${avatar.name} didn't answer. Try again later!`);
      }, HS.answer * 1000) };
      send(avatar.id, { type: 'ask', v: HS.VERSION, id });
      game.ui.toast(`You asked ${avatar.name} to play hide and seek. Waiting...`);
    },

    onMessage(p) {
      const t = p.type;
      if (t === 'ask') {
        if (p.v !== HS.VERSION) { send(p.from, { type: 'no', id: p.id, old: true }); return; }
        if (busy()) { send(p.from, { type: 'no', id: p.id, busy: true }); return; }
        const inc = incoming = { id: p.id, from: p.from, name: p.name, onYes: () => accept(), timer: null };
        inc.timer = setTimeout(() => { closeIncomingBox(); decline(); }, HS.answer * 1000);
        game.ui.ask({ text: `${p.name} wants to play hide and seek! You hide first.`, yes: "Let's play!", no: 'Not now',
          hint: 'press Y / N', onYes: inc.onYes, onNo: () => decline() });
        sound.play('ask');
      } else if (t === 'cancel') {
        if (incoming?.id === p.id) { closeIncomingBox(); clearTimeout(incoming.timer); incoming = null; }
      } else if (t === 'no') {
        if (asking?.id !== p.id) return;
        clearTimeout(asking.timer);
        asking = null;
        game.ui.toast(p.old ? `${p.name} needs to reload the game to play (it was updated).`
          : p.busy ? `${p.name} is busy right now. Try again soon!` : `${p.name} doesn't want to play right now.`);
      } else if (t === 'yes') {
        if (asking?.id !== p.id) return;
        const a = asking;
        clearTimeout(a.timer);
        asking = null;
        const av = avatarOf(p.from);
        if (p.v !== HS.VERSION) { game.ui.toast(`${p.name} needs to reload the game to play (it was updated).`); return; }
        if (!av || game.inBattle || s) { send(p.from, { type: 'stop', id: p.id, why: 'busy' }); return; }
        const pos = game.player.pos;
        begin(p.from, p.name, p.id, true, { center: [(pos.x + av.pos.x) / 2, (pos.z + av.pos.z) / 2], n: 1, hider: p.from,
          score: { [me()]: 0, [p.from]: 0 } });
        enter('hide');
        sendRound();
      } else if (t === 'round') {
        if (!s) {
          if (!pending || pending.id !== p.id || pending.from !== p.from) return;
          clearTimeout(pending.timer);
          pending = null;
          begin(p.from, p.name, p.id, false, { center: p.center, n: p.n, hider: p.hider, score: p.score });
          s.phase = null;
          s.endsAt = now() + p.left;
          s.result = p.result || null;
          enter(p.phase);
        } else {
          if (s.id !== p.id || s.leader || p.from !== s.partner) return;
          const older = p.n < s.n || (p.n === s.n && ORDER[p.phase] < ORDER[s.phase]);
          if (older) return;
          const same = p.n === s.n && p.phase === s.phase;
          s.n = p.n; s.hider = p.hider; s.result = p.result || null; s.score = p.score || s.score;
          if (!same) { s.endsAt = now() + p.left; enter(p.phase); } else if (Math.abs(s.endsAt - (now() + p.left)) > 1500) s.endsAt = now() + p.left;
        }
        s.heardAt = now();
        s.score = p.score || s.score;
        s.center = p.center || s.center;
        if (role() === 'seeker' && s.hider === s.partner) s.help = !!p.help;
      } else if (t === 'found') {
        if (s?.leader && p.n === s.n && s.phase === 'seek' && p.from === s.partner && s.hider === me()) point(p.from, 'found');
      } else if (t === 'help') {
        if (!s || p.from !== s.partner) return;
        if (p.on && !s.help && role() === 'seeker') game.ui.toast('A Camo creature is fooling your compass!');
        s.help = !!p.on;
      } else if (t === 'stop') {
        if (s && p.from === s.partner) end(`${s.partnerName} stopped the game.`);
      }
    },

    // Twice a second: the leader's clock, the other side's watchdog.
    tick() {
      if (incoming && game.ui.asked?.onYes !== incoming.onYes) decline(); // another question replaced ours
      if (!s) return;
      const t = now();
      if (s.leader) {
        if (t >= s.endsAt) {
          if (s.phase === 'hide') { s.endsAt = t + HS.seek * 1000; enter('seek'); sendRound(); }
          else if (s.phase === 'seek') point(s.hider, 'time');
          else { s.n++; s.hider = s.hider === me() ? s.partner : me(); s.result = null; s.endsAt = t + HS.hide * 1000; enter('hide'); sendRound(); }
        } else if (t - s.beatAt >= HS.beat * 1000) sendRound();
      } else if (t - s.heardAt > HS.lost * 1000) {
        end(`Lost touch with ${s.partnerName}. Hide and seek is over.`);
        return;
      }
      if (s.foundSent && s.phase === 'seek' && !s.leader) send(s.partner, { type: 'found', id: s.id, n: s.n, how: 'tap' });
    },

    // Looking at / tapping the other player: true when hide and seek handled it (no duel).
    tag(avatar) {
      if (!s || avatar.id !== s.partner) return false;
      if (role() === 'seeker' && s.phase === 'seek') found('tap');
      return true;
    },

    update(dt) {
      if (!s) return;
      const t = now();
      const p = game.player;
      if (game.riding?.creature) {
        game.riding.stop('quiet');
        if (t - lastToast.ride > HS.fenceToast * 1000) { lastToast.ride = t; game.ui.toast('No riding in hide and seek. Run and hide!'); }
      }
      const a = avatarOf(s.partner);
      const r = role();
      if (a && a.hiding !== (r === 'seeker' && s.phase !== 'brk')) flags();
      const left = (s.endsAt - t) / 1000;
      if (s.phase === 'hide' && left <= 5 && !s.ticked) { s.ticked = true; sound.play('ticktock'); }
      if (s.phase === 'seek' && left <= 30 && !s.warned) { s.warned = true; game.ui.toast('30 seconds left!'); }
      if (r === 'seeker' && s.phase === 'seek' && a && !s.foundSent) {
        const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z;
        if (Math.hypot(dx, dz) < HS.bump && Math.abs(a.pos.y - p.pos.y) < 1.8) found('bump');
      }
      if (r === 'hider') {
        const near = game.creatures.list.some(w => w.disguise && w.pos.distanceTo(p.pos) <= HS.help);
        if (near !== s.helpNear) {
          s.helpNear = near;
          send(s.partner, { type: 'help', id: s.id, on: near });
          if (s.leader) s.help = near;
          if (near) game.ui.toast('A Camo creature is helping you hide!');
        }
      }
      hudAt -= dt;
      if (hudAt > 0) return;
      hudAt = 0.25;
      const pn = s.partnerName;
      const phaseText = s.phase === 'brk' ? `Next round in ${Math.max(0, Math.ceil(left))}`
        : s.phase === 'hide' ? (r === 'hider' ? `You hide! ${clock(left)}` : `${pn} is hiding... ${clock(left)}`)
          : r === 'hider' ? `${pn} is looking for you! ${clock(left)}` : `Find ${pn}! ${clock(left)}`;
      game.ui.setHideSeek({ score: `Hide and seek · ${scoreLine()}`, phase: phaseText });
      game.ui.setDark(self.frozen ? { who: `${pn} is hiding!`, count: String(Math.max(0, Math.ceil(left))) } : null);
      if (r === 'seeker' && s.phase === 'seek' && a) {
        if (s.help) { // a Camo creature near the hider fools the compass
          if (t - wobbleAt > 1000) { wobbleAt = t; wobble = 0.5 + Math.random() * 2.5; }
          compass = { shown: true, period: wobble || 1, word: '???', wobble: true };
        } else {
          const d = a.pos.distanceTo(p.pos);
          compass = { shown: true, period: seekPeriod(d), word: seekWord(d), wobble: false };
        }
        game.ui.setSeekCompass({ period: compass.period, word: compass.word, hot: /Hot/.test(compass.word), wobble: compass.wobble });
      } else if (compass.shown) {
        compass = { shown: false, period: 3, word: '' };
        game.ui.setSeekCompass(null);
      }
    },

    // Right after the player moved: an invisible fence round the play area and the gyms.
    fence(pos, before, vel) {
      if (!s) return;
      const c = s.center, r2 = HS.radius ** 2;
      const out = q => (q.x - c[0]) ** 2 + (q.z - c[1]) ** 2 > r2;
      const gym = q => {
        const x = Math.floor(q.x), y = Math.floor(q.y), z = Math.floor(q.z);
        return game.world.fenced(x, y, z) || game.world.fenced(x, y + 1, z);
      };
      let why = null;
      if (out(pos) && !out(before)) why = "That's the edge of the play area!";
      else if (gym(pos) && !gym(before)) why = 'No hiding in gyms!';
      if (!why) return;
      pos.copy(before);
      vel.x = vel.z = 0;
      const t = now();
      if (t - lastToast.fence > HS.fenceToast * 1000) { lastToast.fence = t; game.ui.toast(why); }
    },

    blocksBattle(opts) {
      if (!s || opts?.duel) return false;
      const t = now();
      if (t - lastToast.battle > HS.fenceToast * 1000) {
        lastToast.battle = t;
        game.ui.toast('No battles during hide and seek! Press Stop in the pause menu first.');
      }
      return true;
    },

    prompt(avatar, how) {
      if (!s || avatar.id !== s.partner) return null;
      return role() === 'seeker' && s.phase === 'seek' ? `${avatar.name} · ${how} to find them!` : `Hide and seek with ${avatar.name}`;
    },

    action(avatar) {
      if (!s || avatar.id !== s.partner) return null;
      return role() === 'seeker' && s.phase === 'seek' ? 'Found you!' : '';
    },

    stop() {
      if (!s) return;
      send(s.partner, { type: 'stop', id: s.id, why: 'stopped' });
      end('You stopped the game.');
    },

    left(id) {
      if (s && id === s.partner) end(`${s.partnerName} left, so hide and seek is over.`);
      if (asking?.to === id) { clearTimeout(asking.timer); asking = null; }
      if (incoming?.from === id) { closeIncomingBox(); clearTimeout(incoming.timer); incoming = null; }
      if (pending?.from === id) { clearTimeout(pending.timer); pending = null; }
    },

    reset() {
      for (const x of [asking, incoming, pending]) if (x) clearTimeout(x.timer);
      closeIncomingBox();
      asking = incoming = pending = null;
      const a = s && avatarOf(s.partner);
      s = null;
      setHiding(a, false);
      clearUi();
    },

    state() {
      return { active: !!s, leader: s?.leader ?? false, role: role(), phase: s?.phase ?? null, n: s?.n ?? 0, score: s?.score ?? null,
        left: s ? Math.max(0, (s.endsAt - now()) / 1000) : 0, center: s?.center ?? null, frozen: self.frozen, help: !!s?.help,
        dark: !document.getElementById('hs-dark').classList.contains('hidden'),
        compass: { shown: compass.shown, period: compass.period, word: compass.word } };
    },
  };
  self.ticker = setInterval(() => self.tick(), 500);
  return self;
}
