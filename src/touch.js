// On-screen controls for tablets and phones: joystick, drag-to-look, tap-to-interact and buttons.

const JOY_RADIUS = 55;
const LOOK_SPEED = 2.4; // multiplier on Player.look's mouse sensitivity
const TAP_MOVE = 12;

// Owner 2026-11-08: a round button's word must fit inside its circle ("Missions!", "Camera", an ask's yes word).
// Each label gets the biggest font size (up to the button's own) whose lines, wrapped at spaces, fit in the circle.
const FIT = { max: { 'btn-act': 19, 'btn-jump': 17 }, base: 15, min: 7, line: 1.1 };
let measureCtx = null;
function textWidth(text, px) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = `${px}px 'Press Start 2P', ui-monospace, monospace`;
  return measureCtx.measureText(text).width;
}
function wrapLines(words, px, w) {
  const lines = [];
  for (const word of words) {
    const last = lines.length && `${lines[lines.length - 1]} ${word}`;
    if (last && textWidth(last, px) <= w) lines[lines.length - 1] = last; else lines.push(word);
  }
  return lines;
}
// -> { px, w }: the font size and the text box width that make `text` fit a circle of diameter d.
export function fitLabel(text, d, maxPx) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || !(d > 0)) return { px: maxPx, w: d * 0.86 };
  for (let px = maxPx; px >= FIT.min; px -= 0.5) {
    for (const w of [d * 0.86, d * 0.7]) { // one line may use the circle's wide middle; more lines stay in its inner square
      const lines = wrapLines(words, px, w);
      if (lines.length > 1 && w > d * 0.7) continue;
      const h = lines.length * px * FIT.line;
      if (h <= d * 0.7 && lines.every(l => textWidth(l, px) <= w)) return { px, w };
    }
  }
  return { px: FIT.min, w: d * 0.7 };
}

function capture(el, id) {
  try { el.setPointerCapture(id); } catch { /* pointer already gone */ }
}

export class TouchControls {
  // actions: { canPlay(), jump(down), breakBlock(), place(), interact(), team(), blocks(), book(), pause(), tapAt(x, y), tapDown(x, y) }
  constructor(game, canvas, actions) {
    this.game = game;
    this.actions = actions;
    this.joy = { x: 0, y: 0 };
    this.lookId = null;
    this.joyId = null;
    this.held = [];

    this.setupJoystick();
    this.setupLook(canvas);
    this.hold('btn-jump', down => actions.jump(down));
    this.hold('btn-down', down => actions.down(down));
    this.tap('btn-ride', () => actions.ride());
    this.press('btn-place', () => actions.place());
    // Buttons that open something react on the finished tap, so the tap can't also land on what opened.
    this.actButton(actions);
    this.tap('btn-book', () => actions.book());
    this.tap('btn-pause', () => actions.pause());
    this.tap('party-mini', () => actions.team()); // T39c: the creature card opens Team
    this.actBtn = document.getElementById('btn-act');
    this.state = { act: '', actDim: true, placeDim: true, placeWhy: '', have: false, rideDim: false, rideWhy: '', on: false, sky: false, swim: false, jump: null };
    this.rideView = { hidden: true, text: 'Ride', dim: false };
    for (const id of ['btn-act', 'btn-place', 'btn-ride', 'btn-down', 'btn-jump']) this.fit(document.getElementById(id));
    const refit = () => ['btn-act', 'btn-place', 'btn-ride', 'btn-down', 'btn-jump'].forEach(id => this.fit(document.getElementById(id), true));
    document.fonts?.ready?.then(refit); // the pixel font is wider than the fallback: measure again once it is in
    document.fonts?.addEventListener?.('loadingdone', refit);
  }

  // Shrinks a round button's word until it fits inside the circle (only when the word changes).
  fit(el, again = false) {
    if (!el || (!again && el.dataset.fitted === el.textContent)) return;
    el.dataset.fitted = el.textContent;
    const d = parseFloat(getComputedStyle(el).width) - 6; // inside the 3 px border
    const { px, w } = fitLabel(el.textContent, d, FIT.max[el.id] ?? FIT.base);
    el.style.setProperty('font-size', `${px}px`, 'important');
    el.style.setProperty('padding', `0 ${Math.max(0, (d - w) / 2).toFixed(1)}px`, 'important');
  }

  // T39c: every button has one fixed place; they dim (never hide) when they can't act. DOM written only on change.
  // s = { act: { label, dim }, place: { dim, why }, ride: { have, dim, why, on }, sky }
  setButtons(s) {
    const o = this.state, n = {
      act: s.act?.label ?? o.act, actDim: !!s.act?.dim,
      placeDim: !!s.place?.dim, placeWhy: s.place?.why ?? '', placeLabel: s.place?.label || '', // (chapter 3's lands: 'Swap')
      have: !!s.ride?.have, rideDim: !!s.ride?.dim, rideWhy: s.ride?.why ?? '', on: !!s.ride?.on, rideLabel: s.ride?.label || '', sky: !!s.sky, swim: !!s.swim, jump: s.jump || null, // T49: a ride may name the Jump button ('Shield', 'Off'); Cube Planets: a world may give the Ride slot another word ('Camera')
    };
    const $ = id => document.getElementById(id);
    if (n.act !== o.act) { this.actBtn.textContent = n.act; this.fit(this.actBtn); }
    if (n.actDim !== o.actDim) this.actBtn.classList.toggle('dim', n.actDim);
    if (n.placeDim !== o.placeDim) $('btn-place').classList.toggle('dim', n.placeDim);
    if (n.placeLabel !== (o.placeLabel ?? '')) { $('btn-place').textContent = n.placeLabel || 'Place'; this.fit($('btn-place')); }
    const rv = { hidden: !n.have, text: n.rideLabel || (n.on ? (n.sky ? 'Land' : 'Get off') : 'Ride'), dim: n.rideDim }, ov = this.rideView, rb = $('btn-ride');
    if (rv.hidden !== ov.hidden) rb.classList.toggle('hidden', rv.hidden);
    if (rv.text !== ov.text) { rb.textContent = rv.text; this.fit(rb); }
    if (rv.dim !== ov.dim) rb.classList.toggle('dim', rv.dim);
    this.rideView = rv;
    if (n.sky !== o.sky) $('touch').classList.toggle('sky', n.sky);
    if (n.sky !== o.sky || n.swim !== o.swim || n.jump !== o.jump) { $('btn-jump').textContent = n.sky ? 'Up' : n.jump || (n.swim ? 'Swim' : 'Jump'); this.fit($('btn-jump')); } // T41: Swim in the Sunken City; T49: a ride's word
    this.state = n;
  }

  // Old callers: the action word, and the Ride state.
  setAction(label, dim = !label) { this.setButtons({ ...this.cur(), act: { label: label || this.state.act, dim } }); }
  setRide(s) { const o = this.state; this.setButtons({ ...this.cur(), ride: o.rideLabel ? this.cur().ride : { have: s.show, on: s.on, dim: o.rideDim, why: o.rideWhy }, sky: s.sky }); }
  cur() {
    const o = this.state;
    return { act: { label: o.act, dim: o.actDim }, place: { dim: o.placeDim, why: o.placeWhy, label: o.placeLabel }, ride: { have: o.have, dim: o.rideDim, why: o.rideWhy, on: o.on, label: o.rideLabel }, sky: o.sky, swim: o.swim, jump: o.jump };
  }

  // Fires on touch-down for snappy buttons; stops the touch turning into a look-drag or a click.
  press(id, fn) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  }

  tap(id, fn) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  }

  // The big button: a tap, except for a hold-and-let-go action (Kick!, Shoot!: owner 2026-10-26), which starts on the finger down
  // and flies on the finger up; the click that follows is then skipped.
  actButton(actions) {
    const el = document.getElementById('btn-act');
    let held = false, skip = false;
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      held = skip = !!actions.actPress?.();
      if (held) { e.preventDefault(); capture(el, e.pointerId); el.classList.add('down'); }
    });
    const up = () => { if (!held) return; held = false; el.classList.remove('down'); actions.actRelease?.(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (skip) { skip = false; return; } actions.interact(); });
  }

  hold(id, fn) {
    const el = document.getElementById(id);
    this.held.push(el);
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      capture(el, e.pointerId);
      el.classList.add('down');
      fn(true);
    });
    const up = () => { el.classList.remove('down'); fn(false); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  setupJoystick() {
    const base = document.getElementById('joystick');
    const knob = document.getElementById('joy-knob');
    let cx = 0, cy = 0;
    const set = (x, y) => {
      this.joy.x = x; this.joy.y = y;
      knob.style.transform = `translate(${x * JOY_RADIUS}px, ${y * JOY_RADIUS}px)`;
    };
    const move = e => {
      let dx = (e.clientX - cx) / JOY_RADIUS, dy = (e.clientY - cy) / JOY_RADIUS;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      set(dx, dy);
    };
    base.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (this.joyId !== null) return;
      this.joyId = e.pointerId;
      capture(base, e.pointerId);
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === this.joyId) move(e); });
    const end = e => { if (e.pointerId === this.joyId) { this.joyId = null; set(0, 0); } };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    base.addEventListener('lostpointercapture', end);
  }

  setupLook(canvas) {
    let lastX = 0, lastY = 0, startX = 0, startY = 0, moved = 0, done = false;
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || this.lookId !== null || !this.actions.canPlay()) return;
      this.lookId = e.pointerId;
      capture(canvas, e.pointerId);
      lastX = startX = e.clientX; lastY = startY = e.clientY; moved = 0;
      // owner 2026-11-08: some taps act the moment the finger touches (a whack game, main.js tapDown); the finger still turns the view after
      done = !!this.actions.tapDown?.(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== this.lookId) return;
      this.game.player.look((e.clientX - lastX) * LOOK_SPEED, (e.clientY - lastY) * LOOK_SPEED);
      moved = Math.max(moved, Math.hypot(e.clientX - startX, e.clientY - startY));
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = e => {
      if (e.pointerId !== this.lookId) return;
      this.lookId = null;
      // A touch that barely moved is a tap (kids often press and hold), anything else was a look-drag.
      if (e.type === 'pointerup' && moved < TAP_MOVE && !done) this.actions.tapAt(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // Forget every finger (a battle or menu started while the joystick or Jump was held).
  reset() {
    this.joy.x = this.joy.y = 0;
    document.getElementById('joy-knob').style.transform = '';
    this.lookId = null;
    this.joyId = null;
    for (const el of this.held) el.classList.remove('down');
  }
}
