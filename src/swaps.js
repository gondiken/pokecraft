// Wave 17 trading between friends playing together (plans/wave17-gifts-trading.md). Owner 2026-10-30: look at a friend, press E
// (or tap them), pick Trade; when they say yes you BOTH open your team screen in trade mode at the same time. Each puts one
// creature on the table (or Nothing: then it is a present), sees the other's offer live, and presses Ready. When both are ready
// with the same two offers, the trade happens. The save changes themselves are in swapcore.js (never lost or doubled).
// Nothing here knows a world or a realm: only the team, the Box, the save and the play-together channel.
import { SWAP, PARCELS, isId, cleanItems, creatureItem, canGive, loadSwaps, newLedger, commitOut, receive, settle } from './swapcore.js';
import { sound } from './sound.js';
import { SPECIES } from './species.js';

const newId = () => Math.random().toString(36).slice(2, 10);
const nameOf = items => items.map(i => PARCELS[i.kind].name(i)).join(', ');
const keys = items => items.map(i => `${i.kind}:${PARCELS[i.kind].key(i)}`).join('|');

// The words for what one side gets after a trade: give = what I gave, get = what I got.
export function tradeWords(give, get, friend) {
  if (give.length && get.length) return { big: `🔁 ${nameOf(get)} is yours!`, small: `You swapped ${nameOf(give)} with ${friend}.` };
  if (get.length) return { big: `🎁 ${nameOf(get)}!`, small: `A present from ${friend}.` };
  return { toast: `🎁 ${friend} got ${nameOf(give)}! What a nice present.` };
}

// deps: save(important) saves the game now.
export function createSwaps(game, { save }) {
  let led = newLedger();
  let asking = null;   // my invite waiting for an answer: { sid, to, name, timer }
  let incoming = null; // an invite to me: { sid, from, name, box, timer }
  let session = null;  // the trade both of us are in: { sid, with, pid, name, leader, mine, theirs, ready, theirReady, state, note, rev }
  const deals = new Map(); // session id -> { give, get }: the pair I said Ready to in this page (never saved: a reload forgets it)
  const greeted = new Set(); // avatar ids I said hi to
  const queue = [];        // give / got / no messages waiting for the end of a battle
  let retry = 0;
  const drop = new Set(); // tests: message types not sent (a browser that closes halfway)

  const mp = () => game.mp;
  const toast = text => game.ui.toast(text);
  const refresh = () => game.swapUi?.refresh();
  const send = (to, data) => { if (!drop.has(data.type)) mp()?.sendSwap?.(to, { v: SWAP.version, ...data }); };
  const avatarOf = pid => [...(mp()?.others.values() || [])].find(a => a.swapPid === pid);
  const commit = () => save(true);
  const sessionOf = id => String(id).split('-')[0]; // a commit id is '<session id>-<fresh part>' (the leader makes one per try)

  // ---- friends ----
  // Can I trade with this avatar? null = yes, else the words why not.
  function whyNot(a) {
    if (!a?.swapPid) return a?.swapOld || (a && performance.now() - (a.swapAsked ?? performance.now()) > 4000)
      ? `${a.name}'s game is older: reload it to trade.` : 'Just a moment...';
    if (a.swapPid === game.playerId) return 'That is you on another device!';
    return null;
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
    for (const [id, e] of Object.entries(led.out)) {
      if (e.to === pid) send(a.id, { type: 'give', sid: id, give: e.give, get: e.get, pid: game.playerId, name: mp().name });
    }
  }

  // ---- asking ----
  // null = free; '' = busy; a name = trading with them.
  function busyWith() {
    const g = game;
    if (session) return session.name;
    if (!g.started || g.inBattle || g.ui.asking || g.hideSeek?.active || asking || incoming) return '';
    return null;
  }

  // The friend menu's Trade: ask the avatar.
  function invite(a) {
    const why = whyNot(a);
    if (why) { toast(why); return false; }
    if (session) { toast('Finish this trade first!'); return false; }
    if (asking) { toast(`Still waiting for ${asking.name} to answer.`); return false; }
    const sid = newId();
    asking = { sid, to: a.id, name: a.name, timer: setTimeout(() => { send(a.id, { type: 'leave', sid }); asking = null; toast(`${a.name} didn't answer. Try again later!`); }, SWAP.answer * 1000) };
    send(a.id, { type: 'ask', sid, name: mp().name });
    toast(`You asked ${a.name} to trade. Waiting...`);
    return true;
  }

  function onAsk(p) {
    const a = mp().others.get(p.from);
    const busy = busyWith();
    if (!a || busy !== null) { send(p.from, { type: 'no', sid: p.sid, busy: true, with: busy || '' }); return; }
    const t = incoming = { sid: p.sid, from: p.from, name: a.name };
    t.timer = setTimeout(() => { if (incoming !== t) return; incoming = null; if (t.box && game.ui.asked === t.box) game.ui.closeAsk(); send(t.from, { type: 'no', sid: t.sid }); }, SWAP.answer * 1000);
    game.ui.ask({ kind: 'incoming', yes: 'Trade!', no: 'Not now', text: `🔁 ${a.name} wants to trade with you!`,
      onYes: () => { if (incoming !== t) return; clearTimeout(t.timer); incoming = null; send(t.from, { type: 'yes', sid: t.sid }); open(t.sid, a, false); },
      onNo: () => { if (incoming !== t) return; clearTimeout(t.timer); incoming = null; send(t.from, { type: 'no', sid: t.sid }); } });
    t.box = game.ui.asked;
    sound.play('ask');
  }

  // ---- the session ----
  function open(sid, a, leader) {
    session = { sid, with: a.id, pid: a.swapPid, name: a.name, leader, mine: [], theirs: [], ready: false, theirReady: false, state: 'pick', note: '', rev: 0 };
    game.openTrade?.();
    refresh();
  }

  function end(note, tell = true) {
    const s = session;
    if (!s) return;
    if (tell && s.state === 'pick') send(s.with, { type: 'leave', sid: s.sid });
    session = null;
    if (note) toast(note);
    game.closeTrade?.();
    refresh();
  }

  // Both sides un-ready whenever an offer changes; a new rev = a new commit id.
  function unready() {
    const s = session;
    deals.delete(s.sid);
    s.ready = false; s.theirReady = false; s.rev++;
  }

  const tellOffer = s => send(s.with, { type: 'offer', sid: s.sid, items: s.mine, rev: s.rev });

  // My offer: a creature of mine, or null = nothing.
  function put(c) {
    const s = session;
    if (!s || s.state !== 'pick') return;
    const item = c && creatureItem(c);
    if (c && !item) { if (SPECIES[c.species]?.designed) { s.note = 'Your guardian stays with you!'; refresh(); } return; } // a designed creature is one of a kind (cleanCreature refuses it)
    const mine = item ? [item] : [];
    if (mine.length && canGive(game, mine) === 'last') { s.note = 'Keep one friend in your team!'; refresh(); return; }
    s.note = '';
    if (keys(mine) === keys(s.mine)) { refresh(); return; }
    s.mine = mine;
    unready();
    tellOffer(s);
    refresh();
  }

  function setReady(on) {
    const s = session;
    if (!s || s.state !== 'pick') return;
    if (on && !(s.mine.length + s.theirs.length)) { s.note = 'Put something on the table first!'; refresh(); return; }
    if (on && s.mine.length && canGive(game, s.mine)) { s.note = 'That one is not here any more.'; s.mine = []; unready(); tellOffer(s); refresh(); return; }
    s.ready = on;
    s.note = '';
    if (on && !s.leader) deals.set(s.sid, { give: s.theirs, get: s.mine }); // the leader commits first: its offer is `give`
    else if (!on) deals.delete(s.sid);
    send(s.with, { type: 'ready', sid: s.sid, on, rev: s.rev, mine: keys(s.mine), theirs: keys(s.theirs) });
    maybeGo();
    refresh();
  }

  // The leader commits once both are ready with the same two offers.
  function maybeGo() {
    const s = session;
    if (!s || !s.leader || !s.ready || !s.theirReady || s.state !== 'pick') return;
    if (game.inBattle || !commitOut(game, led, { sid: `${s.sid}-${newId().slice(0, 6)}`, to: s.pid, name: s.name, kind: 'trade', give: s.mine, get: s.theirs })) {
      s.note = 'That one is not here any more.'; s.mine = []; unready(); tellOffer(s); refresh(); return;
    }
    if (game.riding?.on && !game.party.includes(game.riding.creature)) game.riding.stop('quiet'); // it was the one I ride
    commit();
    s.state = 'going';
    resend(s.pid);
    refresh();
  }

  const ours = sid => session && sid.startsWith(`${session.sid}-`) ? session : null;

  // ---- the commits ----
  function onGive(p) {
    const give = cleanItems(p.give || [], { min: 0 }), get = cleanItems(p.get || [], { min: 0 });
    const res = receive(game, led, { sid: p.sid, give, get }, deals.get(sessionOf(p.sid)));
    if (res.fresh) {
      commit();
      deals.delete(sessionOf(p.sid)); // one try per Ready: a new try needs a new Ready
      const s = ours(p.sid);
      if (res.answer === 'got') {
        const w = tradeWords(get, give, p.name || 'your friend'); // I gave `get`, I got `give`
        if (w.big) { game.ui.celebrate(w.big, w.small, 4000); sound.play('caught'); } else toast(w.toast);
        if (s) { s.state = 'done'; end(null, false); }
      } else if (s) { s.note = "That didn't work. Try again!"; unready(); }
      game.ui.renderHud?.();
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
    const s = ours(p.sid);
    if (res === 'done') {
      const w = tradeWords(e.give, e.get, e.name || 'your friend');
      if (w.big) { game.ui.celebrate(w.big, w.small, 4000); sound.play('caught'); } else toast(w.toast);
      if (s) { s.state = 'done'; end(null, false); }
    } else {
      toast(e.give.length ? `${nameOf(e.give)} came back to you. The trade didn't happen.` : "The trade didn't happen. Try again!");
      if (s) { s.state = 'pick'; s.note = "That didn't work. Try again!"; s.mine = s.mine.filter(i => PARCELS[i.kind].find(game, i)); unready(); tellOffer(s); }
    }
    game.ui.renderHud?.();
    refresh();
  }

  // ---- messages ----
  function onMessage(p) {
    if (!p || !isId(p.sid ?? 'x') || !isId(p.from)) return;
    const a = mp().others.get(p.from);
    if (p.v !== SWAP.version) {
      if (a) a.swapOld = true;
      if (p.type === 'ask') send(p.from, { type: 'no', sid: p.sid, old: true });
      return;
    }
    const s = session && session.sid === p.sid && session.with === p.from ? session : null;
    switch (p.type) {
      case 'hi':
        if (!a || !isId(p.pid)) return;
        a.swapPid = p.pid;
        if (!greeted.has(a.id)) greet(a);
        resend(p.pid);
        refresh();
        return;
      case 'ask': onAsk(p); return;
      case 'yes':
        if (asking?.sid !== p.sid || !a) return;
        clearTimeout(asking.timer); asking = null;
        open(p.sid, a, true);
        return;
      case 'no':
        if (asking?.sid === p.sid) {
          const n = asking.name;
          clearTimeout(asking.timer); asking = null;
          toast(p.old ? `${n} needs to reload the game to trade (it was updated).` : p.with ? `${n} is trading with ${p.with} right now. Try again soon!` : p.busy ? `${n} is busy right now. Try again soon!` : `${n} said not now.`);
          return;
        }
        if (led.out[p.sid]) queue.push(p);
        return;
      case 'leave':
        if (incoming?.sid === p.sid) { clearTimeout(incoming.timer); if (incoming.box && game.ui.asked === incoming.box) game.ui.closeAsk(); incoming = null; }
        if (s && s.state === 'pick') end(`${s.name} stopped the trade.`, false);
        return;
      case 'offer': {
        if (!s || s.state !== 'pick') return;
        const items = cleanItems(p.items || [], { min: 0 });
        if (!items) return;
        s.theirs = items;
        unready();
        s.rev = Math.max(s.rev, p.rev | 0);
        refresh();
        return;
      }
      case 'ready': {
        if (!s || s.state !== 'pick') return;
        const same = p.mine === keys(s.theirs) && p.theirs === keys(s.mine); // they are ready for the two offers I see
        s.theirReady = !!p.on && same;
        maybeGo();
        refresh();
        return;
      }
      case 'give': case 'got':
        queue.push(p);
        return;
    }
  }

  // ---- every frame ----
  function update(dt) {
    const m = mp();
    if (!m?.active) { greeted.clear(); if (session) end(null, false); return; }
    for (const a of m.others.values()) if (!greeted.has(a.id)) greet(a);
    for (const id of [...greeted]) if (!m.others.has(id)) greeted.delete(id);
    if (session && !m.others.has(session.with) && session.state === 'pick') end(`${session.name} left.`, false);
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

  return {
    get ledger() { return led; },
    get session() { return session; },
    whyNot, invite, put, setReady,
    // The trade screen closed: a trade not yet going stops (after the leader's commit it goes on by itself).
    closed() { if (session && session.state === 'pick') end(null); },
    update, onMessage,
    load(saved) {
      led = loadSwaps(saved);
      asking = incoming = session = null;
      deals.clear(); queue.length = 0; greeted.clear();
      const out = Object.values(led.out).filter(e => e.give.length);
      if (out.length) setTimeout(() => toast(`${out.map(e => nameOf(e.give)).join(', ')} ${out.length > 1 ? 'are' : 'is'} on the way to ${out[0].name || 'a friend'}. Play together again to finish!`), 1500);
    },
    toSave: () => led,
    left(id) {
      if (asking?.to === id) { clearTimeout(asking.timer); asking = null; }
      if (incoming?.from === id) { clearTimeout(incoming.timer); if (incoming.box && game.ui.asked === incoming.box) game.ui.closeAsk(); incoming = null; }
    },
    reset() { if (session) end(null); asking = incoming = null; },
    // tests
    drop,
    info: () => ({ out: Object.keys(led.out), seen: led.seen.map(s => s[1]), session: session && { state: session.state, ready: session.ready, theirReady: session.theirReady, mine: keys(session.mine), theirs: keys(session.theirs), leader: session.leader }, asking: !!asking, incoming: !!incoming, queue: queue.length }),
  };
}
