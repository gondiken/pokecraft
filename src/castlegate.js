// T49 (owner 2026-10-28): the Castle's drawbridge and portcullis are physical: when ANY player in a play-together world lowers the
// drawbridge (or raises the portcullis), it is down / up for everyone there. Over the play-together channel (`castle` message): the host
// owns the state, like realm edits: a guest sends what it opened (`up`), the host merges it and sends the state to everyone (`gate`); a
// guest that joins asks (`ask`) and gets the current state. Your own saved keys still record only what YOU won (castleland.js
// castleState); this is only what is drawn. Nothing here is saved; a new play-together session starts closed.
export const CASTLE_GATE_VERSION = 1;
export function createCastleGates(game) {
  let state = { bridge: false, port: false }, session = null;
  const mp = () => game.mp;
  const fresh = () => { const code = mp()?.active ? mp().code : null; if (code !== session) { session = code; state = { bridge: false, port: false }; } };
  const send = data => { const m = mp(); if (m?.active) m.sendCastle({ v: CASTLE_GATE_VERSION, ...data }); };
  const clean = p => ({ bridge: p?.bridge === true, port: p?.port === true });
  const api = {
    // What friends opened in this session (nothing when you play alone).
    shared() { fresh(); return mp()?.active ? { ...state } : { bridge: false, port: false }; },
    // You opened something (or you came in with it already won): tell the others.
    open(what) {
      fresh();
      if (!mp()?.active || (what !== 'bridge' && what !== 'port')) return;
      const before = state[what];
      state[what] = true;
      if (mp().role === 'host') { if (!before) send({ type: 'gate', ...state }); }
      else send({ type: 'up', ...clean({ [what]: true }) });
    },
    // A message from a friend.
    onMessage(p) {
      fresh();
      if (!p || p.v !== CASTLE_GATE_VERSION) return;
      const m = mp(), got = clean(p);
      if (m?.role === 'host') {
        if (p.type === 'ask') { send({ type: 'gate', ...state }); return; }
        if (p.type === 'up') { const was = { ...state }; state = { bridge: state.bridge || got.bridge, port: state.port || got.port }; if (was.bridge !== state.bridge || was.port !== state.port) send({ type: 'gate', ...state }); return; }
      } else if (p.type === 'gate') {
        state = { bridge: state.bridge || got.bridge, port: state.port || got.port };
      }
    },
    // A guest just joined: ask the host for the gates.
    joined() { fresh(); state = { bridge: false, port: false }; if (mp()?.role === 'guest') send({ type: 'ask' }); }, // (a new visit starts closed: the host's answer opens what is open)
    // For tests.
    get state() { return { ...state }; },
  };
  game.castleGates = api;
  return api;
}
