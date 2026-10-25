// On-screen controls for tablets and phones: joystick, drag-to-look, tap-to-interact and buttons.

const JOY_RADIUS = 55;
const LOOK_SPEED = 2.4; // multiplier on Player.look's mouse sensitivity
const TAP_MOVE = 12;

function capture(el, id) {
  try { el.setPointerCapture(id); } catch { /* pointer already gone */ }
}

export class TouchControls {
  // actions: { canPlay(), jump(down), breakBlock(), place(), interact(), team(), blocks(), book(), pause(), tapAt(x, y) }
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
    this.tap('btn-act', () => actions.interact());
    this.tap('btn-book', () => actions.book());
    this.tap('btn-pause', () => actions.pause());
    this.tap('party-mini', () => actions.team()); // T39c: the creature card opens Team
    this.actBtn = document.getElementById('btn-act');
    this.state = { act: '', actDim: true, placeDim: true, placeWhy: '', have: false, rideDim: false, rideWhy: '', on: false, sky: false };
  }

  // T39c: every button has one fixed place; they dim (never hide) when they can't act. DOM written only on change.
  // s = { act: { label, dim }, place: { dim, why }, ride: { have, dim, why, on }, sky }
  setButtons(s) {
    const o = this.state, n = {
      act: s.act?.label ?? o.act, actDim: !!s.act?.dim,
      placeDim: !!s.place?.dim, placeWhy: s.place?.why ?? '',
      have: !!s.ride?.have, rideDim: !!s.ride?.dim, rideWhy: s.ride?.why ?? '', on: !!s.ride?.on, sky: !!s.sky,
    };
    const $ = id => document.getElementById(id);
    if (n.act !== o.act) this.actBtn.textContent = n.act;
    if (n.actDim !== o.actDim) this.actBtn.classList.toggle('dim', n.actDim);
    if (n.placeDim !== o.placeDim) $('btn-place').classList.toggle('dim', n.placeDim);
    if (n.have !== o.have) $('btn-ride').classList.toggle('hidden', !n.have);
    if (n.on !== o.on) $('btn-ride').textContent = n.on ? (n.sky ? 'Land' : 'Get off') : 'Ride';
    else if (n.sky !== o.sky && n.on) $('btn-ride').textContent = n.sky ? 'Land' : 'Get off';
    if (n.rideDim !== o.rideDim) $('btn-ride').classList.toggle('dim', n.rideDim);
    if (n.sky !== o.sky) {
      $('touch').classList.toggle('sky', n.sky);
      $('btn-jump').textContent = n.sky ? 'Up' : 'Jump';
    }
    this.state = n;
  }

  // Old callers: the action word, and the Ride state.
  setAction(label, dim = !label) { this.setButtons({ ...this.cur(), act: { label: label || this.state.act, dim } }); }
  setRide(s) { this.setButtons({ ...this.cur(), ride: { have: s.show, on: s.on, dim: this.state.rideDim, why: this.state.rideWhy }, sky: s.sky }); }
  cur() {
    const o = this.state;
    return { act: { label: o.act, dim: o.actDim }, place: { dim: o.placeDim, why: o.placeWhy }, ride: { have: o.have, dim: o.rideDim, why: o.rideWhy, on: o.on }, sky: o.sky };
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
    let lastX = 0, lastY = 0, startX = 0, startY = 0, moved = 0;
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || this.lookId !== null || !this.actions.canPlay()) return;
      this.lookId = e.pointerId;
      capture(canvas, e.pointerId);
      lastX = startX = e.clientX; lastY = startY = e.clientY; moved = 0;
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
      if (e.type === 'pointerup' && moved < TAP_MOVE) this.actions.tapAt(e.clientX, e.clientY);
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
