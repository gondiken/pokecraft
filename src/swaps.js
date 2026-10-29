// Wave 17 gifts and trading between friends playing together (plans/wave17-gifts-trading.md): the `swap` messages, the
// questions and the waiting. The save changes themselves are in swapcore.js. Nothing here knows a world or a realm:
// only the team, the Box, the save and the play-together channel, so it works the same in every place.
import { SWAP, PARCELS, isId, cleanItems, creatureItem, canGive, loadSwaps, newLedger, commitOut, receive, settle } from './swapcore.js';
import { sound } from './sound.js';

const newId = () => Math.random().toString(36).slice(2, 10);
const say = items => items.map(i => PARCELS[i.kind].label(i)).join(', ');
const nameOf = items => items.map(i => PARCELS[i.kind].name(i)).join(', ');

// deps: save(important) saves the game now.
export function createSwaps(game, { save }) {
  let led = newLedger();
  let mine = null;      // my offer before my commit: { sid, to, pid, name, kind, give, get, stage: 'yes' | 'pick' | 'decide', timer }
  let theirs = null;    // an offer to me: { sid, from, pid, name, kind, give, get, stage: 'ask' | 'pick' | 'wait', timer }
  const deals = new Map(); // sid -> { give, get }: what I said yes to in this page (never saved: a reload forgets it)
  const greeted = new Set(); // avatar ids I said hi to
  const queue = [];        // give / got / no messages waiting for the end of a battle
  let retry = 0;
  let view = null;      // what the Swap panel shows: { mode, friend, note }
  const drop = new Set(); // tests: message types not sent (a browser that closes halfway)

  const mp = () => game.mp;
  const toast = text => game.ui.toast(text);
  const refresh = () => game.swapUi?.refresh();
  const send = (to, data) => { if (!drop.has(data.type)) mp()?.sendSwap?.(to, { v: SWAP.version, ...data }); };
  const avatarOf = pid => [...(mp()?.others.values() || [])].find(a => a.swapPid === pid);
  const commit = () => save(true);

  // ---- friends ----
  // Friends whose game can swap (they said hi): [{ avatar, name }]; others: their game is older.
  function friends() {
    const now = performance.now();
    return [...(mp()?.others.values() || [])].map(a => ({ avatar: a, name: a.name, ok: !!a.swapPid && a.swapPid !== game.playerId,
      old: !a.swapPid && (a.swapOld || now - (a.swapAsked ?? now) > 4000) })); // no hi back: an older game (it never hears 'swap')
  }

  function greet(a) {
    greeted.add(a.id);
    a.swapAsked ??= performance.now();
    send(a.id, { type: 'hi', pid: game.playerId });
  }

  // My committed swaps with this friend go again (after a reload, a lost message, or the friend coming back).
  function resend(pid) {
    const a = avatarOf(pid);
    if (!a) return;
    for (const [sid, e] of Object.entries(led.out)) {
      if (e.to === pid) send(a.id, { type: 'give', sid, kind: e.kind, give: e.give, get: e.get, pid: game.playerId, name: mp().name });
    }
  }

  // ---- my offer ----
  // Start a gift or a trade with an avatar, from items I picked (the Swap panel).
  function offer(avatar, kind, give) {
    if (mine || theirs) { toast('Finish the swap you started first!'); return false; }
    if (!avatar?.swapPid || !mp()?.others.has(avatar.id)) { toast('Your friend is not here any more.'); return false; }
    const why = canGive(game, give);
    if (why) { toast(why === 'last' ? 'Keep one friend in your team!' : 'That one is not here any more.'); return false; }
    const sid = newId();
    mine = { sid, to: avatar.id, pid: avatar.swapPid, name: avatar.name, kind, give, get: [], stage: kind === 'gift' ? 'yes' : 'pick' };
    mine.timer = setTimeout(() => stopMine(`${avatar.name} didn't answer. Try again later!`), (kind === 'gift' ? SWAP.answer : SWAP.pick) * 1000);
    send(avatar.id, { type: 'offer', sid, kind, give, name: mp().name });
    view = { mode: 'wait', friend: avatar.name, note: kind === 'gift' ? `Waiting for ${avatar.name} to open your present...` : `Waiting for ${avatar.name} to pick one to swap...` };
    refresh();
    return true;
  }

  function stopMine(note, tell = true) {
    if (!mine) return;
    clearTimeout(mine.timer);
    if (tell) send(mine.to, { type: 'cancel', sid: mine.sid });
    mine = null;
    if (note) { view = { mode: 'note', note }; toast(note); }
    refresh();
  }

  // Commit my side (the last yes) and send it off.
  function goMine() {
    const m = mine;
    if (!m) return;
    clearTimeout(m.timer);
    mine = null;
    if (game.inBattle || !commitOut(game, led, { sid: m.sid, to: m.pid, name: m.name, kind: m.kind, give: m.give, get: m.get })) {
      send(m.to, { type: 'cancel', sid: m.sid });
      view = { mode: 'note', note: 'That one is not here any more.' };
      refresh();
      return;
    }
    if (game.riding?.on && !game.party.includes(game.riding.creature)) game.riding.stop('quiet'); // it was the one I ride
    commit();
    resend(m.pid);
    view = { mode: 'wait', note: `Sending ${nameOf(m.give)} to ${m.name}...` };
    game.ui.renderHud?.();
    refresh();
  }

  // ---- an offer to me ----
  function busy() {
    const g = game;
    return !g.started || g.inBattle || g.ui.asking || g.ui.panelOpen || g.hideSeek?.active || mine || theirs;
  }

  function onOffer(p) {
    const a = mp().others.get(p.from), give = cleanItems(p.give);
    if (!a || !give || busy()) { send(p.from, { type: 'no', sid: p.sid, busy: true }); return; }
    const t = theirs = { sid: p.sid, from: p.from, pid: a.swapPid, name: a.name, kind: p.kind === 'trade' ? 'trade' : 'gift', give, get: [], stage: 'ask' };
    t.timer = setTimeout(() => stopTheirs(true), SWAP.answer * 1000);
    if (t.kind === 'gift') {
      game.ui.ask({ kind: 'incoming', yes: 'Open!', no: 'Not now', text: `🎁 ${a.name} sent you a present! Open it?`,
        onYes: () => { if (theirs !== t) return; deals.set(t.sid, { give: t.give, get: [] }); t.stage = 'wait'; restart(t); send(t.from, { type: 'yes', sid: t.sid }); },
        onNo: () => stopTheirs(true) });
    } else {
      game.ui.ask({ kind: 'incoming', yes: 'Pick one!', no: 'Not now', text: `🔁 ${a.name} wants to trade! They offer ${say(give)}.`,
        onYes: () => { if (theirs !== t) return; t.stage = 'pick'; restart(t); view = { mode: 'pick', friend: a.name }; game.openSwap?.(); },
        onNo: () => stopTheirs(true) });
    }
    t.box = game.ui.asked;
    sound.play('ask');
  }

  const restart = t => { clearTimeout(t.timer); t.timer = setTimeout(() => stopTheirs(true), SWAP.pick * 1000); };

  // I picked mine for their trade: tell them, then wait for their last yes.
  function pickBack(get) {
    const t = theirs;
    if (!t || t.stage !== 'pick') return;
    const at = get.map(i => PARCELS[i.kind].find(game, i));
    if (at.some(x => !x)) return;
    t.get = get;
    t.stage = 'wait';
    restart(t);
    deals.set(t.sid, { give: t.give, get });
    send(t.from, { type: 'pick', sid: t.sid, get });
    view = { mode: 'wait', note: `Waiting for ${t.name} to say yes...` };
    refresh();
  }

  function stopTheirs(tell, note) {
    const t = theirs;
    if (!t) return;
    clearTimeout(t.timer);
    theirs = null;
    deals.delete(t.sid); // a give that still comes is answered 'no' (and remembered)
    if (tell) send(t.from, { type: t.stage === 'ask' ? 'no' : 'cancel', sid: t.sid });
    if (t.box && game.ui.asked === t.box) game.ui.closeAsk();
    if (note) { toast(note); view = { mode: 'note', note }; }
    else if (view?.mode === 'pick' || view?.mode === 'wait') view = null;
    refresh();
  }

  // ---- the commits ----
  function onGive(p) {
    const give = cleanItems(p.give), get = cleanItems(p.get || [], { min: 0 });
    const res = receive(game, led, { sid: p.sid, give, get }, deals.get(p.sid));
    if (res.fresh) {
      commit();
      deals.delete(p.sid);
      if (theirs?.sid === p.sid) { clearTimeout(theirs.timer); theirs = null; if (res.answer === 'no') view = { mode: 'note', note: "The swap didn't happen. Try again!" }; }
      if (res.answer === 'got') {
        const who = p.name || 'Your friend';
        view = { mode: 'note', note: `${nameOf(give)} joined you!` };
        game.ui.celebrate(get.length ? `🔁 ${nameOf(give)} is yours!` : `🎁 ${nameOf(give)}!`, get.length ? `You swapped ${nameOf(get)} with ${who}.` : `A present from ${who}.`, 4000);
        sound.play('caught');
        game.ui.renderHud?.();
        if (game.ui.partyPanel && !game.ui.partyPanel.classList.contains('hidden')) game.ui.refreshPanel();
      }
      refresh();
    }
    send(p.from, { type: res.answer, sid: p.sid });
  }

  function onAnswer(p) {
    const e = led.out[p.sid];
    if (!e) return; // already settled
    const res = settle(game, led, p.sid, p.type);
    if (!res) return;
    commit();
    if (res === 'done') {
      if (e.get.length) {
        game.ui.celebrate(`🔁 ${nameOf(e.get)} is yours!`, `You swapped ${nameOf(e.give)} with ${e.name}.`, 4000);
        sound.play('caught');
      } else toast(`🎁 ${e.name} got ${nameOf(e.give)}!`);
      view = { mode: 'note', note: e.get.length ? `${nameOf(e.get)} joined you!` : `${e.name} got ${nameOf(e.give)}!` };
    } else {
      toast(`${nameOf(e.give)} came back to you. The swap didn't happen.`);
      view = { mode: 'note', note: `${nameOf(e.give)} came back to you.` };
    }
    game.ui.renderHud?.();
    if (game.ui.partyPanel && !game.ui.partyPanel.classList.contains('hidden')) game.ui.refreshPanel();
    refresh();
  }

  // ---- messages ----
  function onMessage(p) {
    if (!p || !isId(p.sid ?? 'x') || !isId(p.from)) return;
    const a = mp().others.get(p.from);
    if (p.v !== SWAP.version) {
      if (a) a.swapOld = true;
      if (p.type === 'offer') send(p.from, { type: 'no', sid: p.sid, old: true });
      return;
    }
    switch (p.type) {
      case 'hi':
        if (!a || !isId(p.pid)) return;
        a.swapPid = p.pid;
        if (!greeted.has(a.id)) greet(a);
        resend(p.pid);
        game.swapUi?.refresh();
        return;
      case 'offer': onOffer(p); return;
      case 'yes':
        if (mine?.sid === p.sid && mine.stage === 'yes') goMine();
        return;
      case 'pick': {
        if (mine?.sid !== p.sid || mine.stage !== 'pick') return;
        const get = cleanItems(p.get);
        if (!get) { stopMine(`${mine.name}'s game could not send that one.`); return; }
        mine.get = get;
        mine.stage = 'decide';
        clearTimeout(mine.timer);
        mine.timer = setTimeout(() => stopMine('Too slow! The trade stopped. Try again.'), SWAP.pick * 1000);
        view = { mode: 'decide' };
        game.openSwap?.();
        refresh();
        return;
      }
      case 'cancel':
        if (theirs?.sid === p.sid) stopTheirs(false, `${theirs.name} stopped the swap.`);
        else if (mine?.sid === p.sid) stopMine(`${mine.name} stopped the swap.`, false);
        deals.delete(p.sid);
        return;
      case 'no':
        if (mine?.sid === p.sid) {
          const n = mine.name;
          stopMine(p.old ? `${n} needs to reload the game to swap (it was updated).` : p.busy ? `${n} is busy right now. Try again soon!` : `${n} said not now.`, false);
          return;
        }
        if (led.out[p.sid]) queue.push(p);
        return;
      case 'give': case 'got':
        queue.push(p);
        return;
    }
  }

  // ---- every frame ----
  function update(dt) {
    const m = mp();
    if (!m?.active) { greeted.clear(); return; }
    for (const a of m.others.values()) if (!greeted.has(a.id)) greet(a);
    for (const id of [...greeted]) if (!m.others.has(id)) greeted.delete(id);
    if (mine && !m.others.has(mine.to)) stopMine(`${mine.name} left.`, false);
    if (theirs && !m.others.has(theirs.from)) stopTheirs(false, `${theirs.name} left.`);
    if (!game.inBattle) {
      while (queue.length) {
        const p = queue.shift();
        if (p.type === 'give') onGive(p); else onAnswer(p);
      }
    }
    retry += dt;
    if (retry >= SWAP.retry) {
      retry = 0;
      for (const pid of new Set(Object.values(led.out).map(e => e.to))) resend(pid);
    }
  }

  // ---- the panel's calls ----
  // mode 'gift' | 'trade' with an avatar: open the panel to pick
  function start(mode, avatar) {
    if (mine || theirs) { view = view || { mode: 'note', note: 'Finish the swap you started first!' }; game.openSwap?.(); return; }
    view = { mode, friend: avatar.name, avatarId: avatar.id };
    game.openSwap?.();
  }

  function choose(c) { // the panel's big yes for the creature c of mine
    const item = creatureItem(c);
    if (!item || !view) return;
    if (view.mode === 'pick') { pickBack([item]); return; }
    const a = mp()?.others.get(view.avatarId);
    offer(a, view.mode === 'gift' ? 'gift' : 'trade', [item]);
  }

  // The panel closed: a swap not yet committed stops (after a commit it goes on by itself).
  function closed() {
    if (mine) stopMine(null);
    if (theirs && theirs.stage === 'pick') stopTheirs(true);
    if (view?.mode !== 'wait') view = null;
  }

  return {
    get ledger() { return led; },
    get view() { return view; },
    get mine() { return mine; },
    get theirs() { return theirs; },
    friends, start, choose, closed, update, onMessage,
    yes: () => goMine(),                       // the giver's last yes to a trade
    no: () => stopMine('You said no thanks.'), // ... or not
    load(saved) {
      led = loadSwaps(saved);
      mine = theirs = view = null;
      deals.clear(); queue.length = 0; greeted.clear();
      const out = Object.values(led.out);
      if (out.length) setTimeout(() => toast(`${out.map(e => nameOf(e.give)).join(', ')} ${out.length > 1 ? 'are' : 'is'} on the way to ${out[0].name || 'a friend'}. Play together again to finish!`), 1500);
    },
    toSave: () => led,
    left(id) { if (mine?.to === id) stopMine(null, false); if (theirs?.from === id) stopTheirs(false); },
    reset() { if (mine) stopMine(null); if (theirs) stopTheirs(true); view = null; },
    // tests
    drop,
    info: () => ({ out: Object.keys(led.out), seen: led.seen.map(s => s[1]), mine: mine?.stage ?? null, theirs: theirs?.stage ?? null, queue: queue.length, view: view?.mode ?? null }),
  };
}
