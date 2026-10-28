// T48 (plans/T48-surprise-party.md): Gift Stack, a party game of Jolly Jax's Surprise Party. Pure, no imports, Node-runnable.
//
// A toy crane swings a present back and forth over a box on a small table. Press Drop! and the present falls straight down onto the
// stack: the part that hangs over the box below is cut off (it tumbles to the floor), so the next present is that much smaller. A drop
// close enough to the middle is Perfect!: the present snaps on and keeps its size. Stack N presents (5 / 7 / 9) and the round is won; a
// present that misses, or one cut thinner than STACK.min, topples the stack: the round starts again (never a loss), and after two misses
// the crane swings a tiny bit slower (the shared kind help, kindhelp.js, passed in as `slow`).
//
// Release timing on a moving crane (not aim, not power). The crane is a closed form of the round clock `t` (seconds since Play!), and a
// drop's result is pure maths on the overlap, so the same presses give the same stack at 60 and 20 frames a second.
// Sizes are blocks; x is across the player's view, z is away from the player.

export const STACK = {
  base: { w: 3, d: 3 },        // the box on the table (the table's 3 x 3 cells)
  start: 3, tiny: 2.4,         // the first present's width (the "Tiny presents!" twist starts smaller)
  min: 0.4,                    // thinner than this and it topples
  perfect: 0.25,               // a drop this close to the middle (each way) is Perfect!
  amp: 2.6,                    // how far the crane swings each way
  period: [3.2, 2.8, 2.5],     // seconds for one swing there and back, per round
  need: [5, 7, 9],             // presents to stack, per round
  reload: 0.7,                 // seconds after a drop before the next present hangs on the hook
  fall: 0.4,                   // (looks) how long a present takes to fall
  height: 0.7,                 // (looks) how tall a present is
  wobble: 0.7,                 // "Wobbly crane!": the hook also swings this far in and out, twice per swing (a figure of eight)
  wind: { amp: 1.0, period: 9 }, // "Windy!": the middle of the swing drifts this far, this slowly
  hard: { period: 0.88, perfect: 0.8, need: 1 },  // a rematch (you hold the star): quicker, a smaller Perfect!, one present more
};

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

// One try of round `round` (1..3). slow = kindHelp(misses).slow (1 = no help; 0.9 = 10 % slower, the most).
export function stackPlan(seed, round, attempt, { twist = null, hard = false, slow = 1 } = {}) {
  const r = Math.min(3, Math.max(1, round | 0)) - 1, H = hard ? STACK.hard : { period: 1, perfect: 1, need: 0 };
  return {
    seed, round: r + 1, attempt, twist, hard: !!hard,
    period: (STACK.period[r] * H.period) / Math.max(0.3, slow),
    amp: STACK.amp, perfect: STACK.perfect * H.perfect,
    need: STACK.need[r] + H.need,
    start: twist === 'tiny' ? STACK.tiny : STACK.start,
    phase: (hashStr(`stack|${seed}|${round}|${attempt}`) / 4294967296) * Math.PI * 2,  // the crane does not start in the middle
    wobble: twist === 'wobbly' ? STACK.wobble : 0,
    wind: twist === 'windy' ? STACK.wind.amp : 0,
    windPhase: (hashStr(`wind|${seed}|${round}`) / 4294967296) * Math.PI * 2,
  };
}

// Where the hook is at round time t, as an offset from the middle of the box: { x, z, vx }.
export function craneAt(plan, t) {
  const w = (2 * Math.PI) / plan.period, a = w * t + plan.phase;
  const drift = plan.wind ? plan.wind * Math.sin((2 * Math.PI * t) / STACK.wind.period + plan.windPhase) : 0;
  return { x: drift + plan.amp * Math.sin(a), z: plan.wobble * Math.sin(2 * a), vx: plan.amp * w * Math.cos(a) };
}

export function newStack(plan) {
  return { plan, top: { x: 0, z: 0, w: STACK.base.w, d: STACK.base.d }, size: { w: plan.start, d: plan.start }, pieces: [], cut: [], placed: 0, perfects: 0, ready: 0, over: null, drops: [] };
}
export const loaded = (st, t) => !st.over && t >= st.ready;

// Drop! at round time t. -> { dropped: false } while no present hangs, else { dropped: true, perfect, miss, piece, cut: [rects], won }
// A rect is { x, z, w, d } (the middle and the size). The stack changes.
export function drop(st, t) {
  if (!loaded(st, t)) return { dropped: false };
  const P = st.plan, h = craneAt(P, t), top = st.top, s = st.size;
  st.drops.push(t);
  st.ready = t + STACK.reload;
  const res = { dropped: true, at: { x: h.x, z: h.z }, perfect: false, miss: false, cut: [], won: false };
  if (Math.abs(h.x - top.x) <= P.perfect && Math.abs(h.z - top.z) <= P.perfect) { // Perfect!: it snaps on the middle and keeps its size
    const piece = { x: top.x, z: top.z, w: Math.min(s.w, top.w), d: Math.min(s.d, top.d) };
    res.perfect = true; res.piece = piece; st.perfects++;
    st.top = piece; st.size = { w: piece.w, d: piece.d };
  } else {
    const x0 = Math.max(h.x - s.w / 2, top.x - top.w / 2), x1 = Math.min(h.x + s.w / 2, top.x + top.w / 2);
    const z0 = Math.max(h.z - s.d / 2, top.z - top.d / 2), z1 = Math.min(h.z + s.d / 2, top.z + top.d / 2);
    const w = x1 - x0, d = z1 - z0;
    // the bits that hang over fall off (for the looks): left / right and front / back of the kept part
    const add = (a0, a1, b0, b1) => { if (a1 - a0 > 1e-6 && b1 - b0 > 1e-6) res.cut.push({ x: (a0 + a1) / 2, z: (b0 + b1) / 2, w: a1 - a0, d: b1 - b0 }); };
    if (w < STACK.min || d < STACK.min) { res.miss = true; res.cut.push({ x: h.x, z: h.z, w: s.w, d: s.d }); st.over = 'toppled'; st.cut.push(...res.cut); return res; }
    add(h.x - s.w / 2, x0, h.z - s.d / 2, h.z + s.d / 2); add(x1, h.x + s.w / 2, h.z - s.d / 2, h.z + s.d / 2);
    add(x0, x1, h.z - s.d / 2, z0); add(x0, x1, z1, h.z + s.d / 2);
    const piece = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w, d };
    res.piece = piece; st.top = piece; st.size = { w, d };
  }
  st.pieces.push(res.piece); st.cut.push(...res.cut);
  st.placed++;
  if (st.placed >= P.need) { st.over = 'won'; res.won = true; }
  return res;
}
