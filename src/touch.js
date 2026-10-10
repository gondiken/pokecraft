// On-screen controls for tablets and phones: joystick, drag-to-look, tap-to-interact and buttons.

const JOY_RADIUS = 55;
const LOOK_SPEED = 2.4; // multiplier on Player.look's mouse sensitivity
const TAP_MOVE = 12;

function capture(el, id) {
  try { el.setPointerCapture(id); } catch { /* pointer already gone */ }
}

export class TouchControls {
  // actions: { canPlay(), jump(down), breakBlock(), place(), interact(), team(), pause(), tapAt(x, y) }
  constructor(game, canvas, actions) {
    this.game = game;
    this.actions = actions;
    this.joy = { x: 0, y: 0 };
    this.lookId = null;

    this.setupJoystick();
    this.setupLook(canvas);
    this.hold('btn-jump', down => actions.jump(down));
    this.press('btn-break', () => actions.breakBlock());
    this.press('btn-place', () => actions.place());
    // Buttons that open something react on the finished tap, so the tap can't also land on what opened.
    this.tap('btn-act', () => actions.interact());
    this.tap('btn-team', () => actions.team());
    this.tap('btn-pause', () => actions.pause());
    this.actBtn = document.getElementById('btn-act');
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
    let id = null, cx = 0, cy = 0;
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
      if (id !== null) return;
      id = e.pointerId;
      capture(base, id);
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = e => { if (e.pointerId === id) { id = null; set(0, 0); } };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
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

  // Shows the context button ("Battle!", "Talk", ...) or hides it when label is empty.
  setAction(label) {
    if (this.actBtn.textContent !== label) this.actBtn.textContent = label;
    this.actBtn.classList.toggle('hidden', !label);
  }

  reset() {
    this.joy.x = this.joy.y = 0;
    document.getElementById('joy-knob').style.transform = '';
    this.lookId = null;
  }
}
