// Wave 17 trading between friends playing together (plans/wave17-gifts-trading.md): the `swap` messages, the questions and
// the waiting. There is ONE way (owner 2026-10-29): a trade, where either side may give nothing; giving nothing back makes it a
// present (and offering nothing asks for one). The save changes themselves are in swapcore.js. Nothing here knows a world or a realm:
// only the team, the Box, the save and the play-together channel, so it works the same in every place.
import { SWAP, PARCELS, isId, cleanItems, creatureItem, canGive, loadSwaps, newLedger, commitOut, receive, settle } from './swapcore.js';
import { sound } from './sound.js';

const newId = () => Math.random().toString(36).slice(2, 10);
const say = items => items.map(i => PARCELS[i.kind].label(i)).join(', ');
const nameOf = items => items.map(i => PARCELS[i.kind].name(i)).join(', ');

// The words for what one side gets: 'Sparky' or '' (nothing).
export function tradeWords(give, get, friend) {
  if (give.length && get.length) return { big: `🔁 ${nameOf(get)} is yours!`, small: `You swapped ${nameOf(give)} with ${friend}.` };
  if (get.length) return { big: `🎁 ${nameOf(get)}!`, small: `A present from ${friend}.` };
  return { toast: `🎁 ${friend} got ${nameOf(give)}! What a nice present.` };
}

// deps: save(important) saves the game now.
export function createSwaps(game, { save }) {
  let led = newLedger();
  let mine = null;      // my offer before my commit: { sid, to, pid, name, give, get, stage: 'pick' | 'decide', timer }
  let theirs = null;    // an offer to me: { sid, from, pid, name, give, get, stage: 'ask' | 'pick' | 'wait', timer }
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
      if (e.to === pid) send(a.id, { type: 'give', sid, give: e.give, get: e.get, pid: game.playerId, name: mp().name });
    }
  }

  // ---- my offer ----
  // Start a trade with an avatar: give = what I offer ([] = nothing: I ask for a present).
  function offer(avatar, give) {
    if (mine || theirs) { toast('Finish the trade you started first!'); return false; }
    if (!avatar?.swapPid || !mp()?.others.has(avatar.id)) { toast('Your friend is not here any more.'); return false; }
    const why = canGive(game, give);
    if (why) { toast(why === 'last' ? 'Keep one friend in your team!' : 'That one is not here any more.'); return false; }
    const sid = newId();
    mine = { sid, to: avatar.id, pid: avatar.swapPid, name: avatar.name, give, get: [], stage: 'pick' };
    mine.timer = setTimeout(() => stopMine(`${avatar.name} didn't answer. Try again later!`), SWAP.pick * 1000);
    send(avatar.id, { type: 'offer', sid, give, name: mp().name });
    view = { mode: 'wait', friend: avatar.name, note: `Waiting for ${avatar.name} to pick...` };
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
    if (game.inBattle || !commitOut(game, led, { sid: m.sid, to: m.pid, name: m.name, kind: 'trade', give: m.give, get: m.get })) {
      send(m.to, { type: 'cancel', sid: m.sid });
      view = { mode: 'note', note: 'That one is not here any more.' };
      refresh();
      return;
    }
    if (game.riding?.on && !game.party.includes(game.riding.creature)) game.riding.stop('quiet'); // it was the one I ride
    commit();
    resend(m.pid);
    view = { mode: 'wait', note: `Trading with ${m.name}...` };
    game.ui.renderHud?.();
    refresh();
  }

  // ---- an offer to me ----
  function busy() {
    const g = game;
    return !g.started || g.inBattle || g.ui.asking || g.ui.panelOpen || g.hideSeek?.active || mine || theirs;
  }

  function onOffer(p) {
    const a = mp().others.get(p.from), give = cleanItems(p.give, { min: 0 });
    if (!a || !give || busy()) { send(p.from, { type: 'no', sid: p.sid, busy: true }); return; }
    const t = theirs = { sid: p.sid, from: p.from, pid: a.swapPid, name: a.name, give, get: [], stage: 'ask' };
    t.timer = setTimeout(() => stopTheirs(true), SWAP.answer * 1000);
    game.ui.ask({ kind: 'incoming', yes: 'Pick!', no: 'Not now',
      text: give.length ? `🔁 ${a.name} wants to trade! They offer ${say(give)}.` : `🔁 ${a.name} wants to trade! They would love a present from you.`,
      onYes: () => { if (theirs !== t) return; t.stage = 'pick'; restart(t); view = { mode: 'pick', friend: a.name }; game.openSwap?.(); },
      onNo: () => stopTheirs(true) });
    t.box = game.ui.asked;
    sound.play('ask');
  }

  const restart = t => { clearTimeout(t.timer); t.timer = setTimeout(() => stopTheirs(true), SWAP.pick * 1000); };

  // I picked mine for their trade: tell them, then wait for their last yes.
  function pickBack(get) {
    const t = theirs;
    if (!t || t.stage !== 'pick' || !(t.give.length + get.length)) return;
    if (!t.give.length && canGive(game, get) === 'last') { toast('Keep one friend in your team!'); return; }
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
    const give = cleanItems(p.give || [], { min: 0 }), get = cleanItems(p.get || [], { min: 0 });
    const res = receive(game, led, { sid: p.sid, give, get }, deals.get(p.sid));
    if (res.fresh) {
      commit();
      deals.delete(p.sid);
      if (theirs?.sid === p.sid) { clearTimeout(theirs.timer); theirs = null; if (res.answer === 'no') view = { mode: 'note', note: "The swap didn't happen. Try again!" }; }
      if (res.answer === 'got') {
        const w = tradeWords(get, give, p.name || 'your friend'); // I gave `get`, I got `give`
        view = { mode: 'note', note: w.big ? `${nameOf(give)} joined you!` : w.toast };
        if (w.big) { game.ui.celebrate(w.big, w.small, 4000); sound.play('caught'); } else toast(w.toast);
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
      const w = tradeWords(e.give, e.get, e.name || 'your friend');
      if (w.big) { game.ui.celebrate(w.big, w.small, 4000); sound.play('caught'); } else toast(w.toast);
      view = { mode: 'note', note: w.big ? `${nameOf(e.get)} joined you!` : w.toast };
    } else {
      const note = e.give.length ? `${nameOf(e.give)} came back to you. The trade didn't happen.` : "The trade didn't happen. Try again!";
      toast(note);
      view = { mode: 'note', note };
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
      case 'pick': {
        if (mine?.sid !== p.sid || mine.stage !== 'pick') return;
        const get = cleanItems(p.get, { min: 0 });
        if (!get || !(get.length + mine.give.length)) { stopMine(`${mine.name}'s game could not send that one.`); return; }
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
          stopMine(p.old ? `${n} needs to reload the game to trade (it was updated).` : p.busy ? `${n} is busy right now. Try again soon!` : `${n} said not now.`, false);
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
  // The pause screen's "Trade with ..." button: open the panel to pick what I offer.
  function start(avatar) {
    if (mine || theirs) { view = view || { mode: 'note', note: 'Finish the trade you started first!' }; game.openSwap?.(); return; }
    view = { mode: 'offer', friend: avatar.name, avatarId: avatar.id };
    game.openSwap?.();
  }

  // The panel's big yes for my creature c, or null = nothing.
  function choose(c) {
    if (!view) return;
    const item = c && creatureItem(c);
    if (c && !item) return;
    const give = item ? [item] : [];
    if (view.mode === 'pick') { pickBack(give); return; }
    offer(mp()?.others.get(view.avatarId), give);
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
    yes: () => goMine(),                       // the asker's last yes
    no: () => stopMine('You said no thanks.'), // ... or not
    load(saved) {
      led = loadSwaps(saved);
      mine = theirs = view = null;
      deals.clear(); queue.length = 0; greeted.clear();
      const out = Object.values(led.out).filter(e => e.give.length);
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
