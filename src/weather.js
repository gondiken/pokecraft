// Weather: one shared phase (clear / rain / storm / rainbow) that changes every few minutes,
// shown differently depending on where you stand (rain, snow, sandstorm, fog...), with
// falling particles, a rainbow arc, lightning, quiet sounds and spawn boosts for creatures.
// Weather is not saved. In play-together, visitors copy the host's phase (see apply/state).
import * as THREE from 'three';
import { B, isSolid } from './blocks.js';
import { sound } from './sound.js';

export const KINDS = ['clear', 'rain', 'storm', 'snow', 'sandstorm', 'fog', 'stars', 'rainbow'];

// kind -> creature type -> spawn weight multiplier (missing = 1; always above 0).
export const BOOSTS = {
  rain: { water: 3, grass: 1.5, fire: 0.5 },
  storm: { electric: 4, water: 2, fire: 0.5 },
  snow: { ice: 3 },
  sandstorm: { rock: 2.5, fire: 1.5, bone: 1.5 },
  fog: { ghost: 3, toxic: 2, bone: 2.5 },
  stars: { cosmic: 2, alien: 1.5 },
  rainbow: { rainbow: 10 },
};

const COLD = new Set(['taiga', 'snow', 'peak']);
const ICONS = { clear: '', rain: ' ☔', storm: ' ⛈', snow: ' ❄', rainbow: ' 🌈', sandstorm: ' 💨', fog: ' 🌫', stars: ' ✨' };

// Sky look per kind: tint colour, how much of it, brightness multiplier, fog near/far.
const LOOK = {
  clear: { tint: 0xffffff, amount: 0, dim: 1, near: 40, far: 100 },
  rain: { tint: 0x7d8a99, amount: 0.6, dim: 0.8, near: 30, far: 80 },
  storm: { tint: 0x4a5260, amount: 0.75, dim: 0.65, near: 25, far: 70 },
  snow: { tint: 0xd0dae6, amount: 0.5, dim: 0.9, near: 25, far: 75 },
  sandstorm: { tint: 0xd8b878, amount: 0.7, dim: 0.85, near: 12, far: 45 },
  fog: { tint: 0xc8d0d0, amount: 0.65, dim: 0.9, near: 8, far: 35 },
};
LOOK.stars = LOOK.rainbow = LOOK.clear;

// Falling things: count, size, colour, opacity, motion per second, which texture.
const PARTS = {
  rain: { count: 350, size: 0.55, color: 0xbbd8ff, opacity: 0.85, vx: 0, vy: -14, tex: 'streak' },
  storm: { count: 500, size: 0.6, color: 0xaabfe0, opacity: 0.85, vx: 3, vy: -18, tex: 'streak' },
  snow: { count: 300, size: 0.18, color: 0xffffff, opacity: 0.9, vx: 0, vy: -1.5, tex: 'dot', wobble: true },
  sandstorm: { count: 400, size: 0.22, color: 0xe0b060, opacity: 0.9, vx: 9, vy: -0.5, tex: 'dot' },
};
const MAX = 500, BOX = 24, TOP = 10, BOT = -8;

const TOASTS = {
  rain: "It's raining! Water creatures love the rain.",
  storm: 'A thunderstorm! Electric creatures love this.',
  snow: 'Snow is falling. Ice creatures come out to play!',
  sandstorm: 'A sandstorm! Rock and fire creatures like the hot wind.',
  fog: 'A misty morning... ghost creatures hide in the fog.',
  rainbow: 'A rainbow! Rainbow creatures love this.',
};

const RANGES = { clear: [180, 360], rain: [100, 180], storm: [60, 100], rainbow: [120, 180] };
const RAINBOW = [0xff3030, 0xff9a30, 0xffe030, 0x40d050, 0x3090ff, 0x4a50d8, 0x9050d0].map(c => new THREE.Color(c));

function texture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}

export class Weather {
  constructor(game, hooks = {}) {
    this.game = game;
    this.hooks = hooks;
    this.random = Math.random;
    this.phase = 'clear';
    this.left = 240;
    this.forced = null;
    this.here = 'clear';   // the kind where the player stands
    this.shown = 'clear';  // the kind currently drawn (follows `here` through a fade)
    this.biome = null;
    this.mix = 1;
    this.flashes = 0;
    this.flash = 0;
    this.covered = false;
    this.count = 0;
    this.clock = 0;        // game seconds since start (for toast limits)
    this.toastAt = {};
    this.nextCheck = 0;
    this.strikeIn = 10;
    this.thunderIn = -1;
    this.starIn = 8;
    this.starT = -1;
    this.starToasted = false;
    this.ambKey = undefined;
    this.icon = '';
    this._sky = { tint: new THREE.Color(), amount: 0, dim: 1, fogNear: 40, fogFar: 100, flash: 0 };
    this._last = new THREE.Vector3();
    this._hasLast = false;

    // Falling particles: one Points object that follows the camera.
    this.pos = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * BOX;
      this.pos[i * 3 + 1] = BOT + Math.random() * (TOP - BOT);
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.tex = {
      streak: texture((g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.15)'); grad.addColorStop(1, 'rgba(255,255,255,1)');
        g.fillStyle = grad; g.fillRect(w / 2 - 1.5, 0, 3, h);
      }, 16, 64),
      dot: texture((g, w, h) => {
        const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
      }, 16, 16),
    };
    this.mat = new THREE.PointsMaterial({ size: 0.3, map: this.tex.dot, transparent: true, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.visible = false;
    game.scene.add(this.points);

    // Rainbow arc, far to the north (-z).
    const ring = new THREE.RingGeometry(70, 80, 48, 7, 0, Math.PI);
    const rp = ring.attributes.position, cols = new Float32Array(rp.count * 3), c = new THREE.Color();
    for (let i = 0; i < rp.count; i++) {
      const t = Math.min(0.9999, Math.max(0, (Math.hypot(rp.getX(i), rp.getY(i)) - 70) / 10));
      const k = (1 - t) * (RAINBOW.length - 1), a = Math.floor(k);
      c.copy(RAINBOW[a]).lerp(RAINBOW[Math.min(RAINBOW.length - 1, a + 1)], k - a); // outer edge = red
      cols.set([c.r, c.g, c.b], i * 3);
    }
    ring.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.arcMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.arc = new THREE.Mesh(ring, this.arcMat);
    this.arc.frustumCulled = false;
    this.arc.renderOrder = 1;
    this.arc.visible = false;
    game.scene.add(this.arc);

    // Shooting star.
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.starMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false });
    this.star = new THREE.Line(lg, this.starMat);
    this.star.frustumCulled = false;
    this.star.visible = false;
    game.scene.add(this.star);
    this.starDir = new THREE.Vector3();
    this.starFrom = new THREE.Vector3();
  }

  rand(a, b) { return a + this.random() * (b - a); }
  duration(phase) { return this.rand(...RANGES[phase]); }

  reset() {
    this.phase = 'clear';
    this.left = this.rand(240, 360);
    this.forced = null;
    this.flash = 0; this.thunderIn = -1; this.starT = -1; this.starToasted = false;
    this.toastAt = {};
    this.here = this.shown = 'clear';
    this.mix = 1;
    this.covered = false;
    this.nextCheck = 0;
    this.count = 0;
    this.points.visible = false; this.arc.visible = false; this.star.visible = false;
    this.icon = '';
    this._hasLast = false;
    this.setAmbience(null);
  }

  get night() { return Math.sin(this.game.time * Math.PI * 2) < -0.1; }
  get day() { return Math.sin(this.game.time * Math.PI * 2) > 0.15; }

  kindAt(biome) {
    if (biome === 'cave') return 'clear';
    if (this.forced) return this.forced;
    if (this.phase === 'clear') {
      const t = this.game.time;
      if (biome === 'swamp' && (t >= 0.958 || t < 0.167)) return 'fog';
      return this.night ? 'stars' : 'clear';
    }
    if (this.phase === 'rainbow') return 'rainbow';
    if (COLD.has(biome)) return 'snow';
    if (biome === 'desert') return 'sandstorm';
    return this.phase; // rain or storm
  }

  boost(biome, type) { return BOOSTS[this.kindAt(biome)]?.[type] ?? 1; }
  boosts() { return { ...(BOOSTS[this.here] || {}) }; }

  // Phase machine ------------------------------------------------------------
  next() {
    this.forced = null;
    const wet = () => this.day ? 'rainbow' : 'clear';
    if (this.phase === 'clear') this.phase = 'rain';
    else if (this.phase === 'rain') this.phase = this.random() < 0.35 ? 'storm' : wet();
    else if (this.phase === 'storm') this.phase = wet();
    else this.phase = 'clear';
    this.left = this.duration(this.phase);
    this.hooks.changed?.();
  }

  tick(dt) {
    this.clock += dt;
    if (this.game.mp?.role !== 'guest') {
      this.left -= dt;
      if (this.left <= 0) this.next();
      else if (this.phase === 'rainbow' && this.night) this.next();
    }
    if (this.here === 'storm') {
      this.strikeIn -= dt;
      if (this.strikeIn <= 0) {
        this.strikeIn = this.rand(6, 14);
        this.flashes++;
        this.flash = 1;
        this.thunderIn = this.rand(0.5, 1.5);
      }
    }
    if (this.thunderIn >= 0) {
      this.thunderIn -= dt;
      if (this.thunderIn < 0) sound.play('thunder');
    }
  }

  skip() {
    this.forced = null;
    this.next();
    this.snap();
  }

  set(kind, seconds) {
    if (!KINDS.includes(kind)) throw new Error(`Unknown weather: ${kind}`);
    this.forced = kind === 'clear' ? null : kind;
    this.phase = kind === 'storm' ? 'storm' : kind === 'rainbow' ? 'rainbow'
      : ['snow', 'sandstorm', 'rain'].includes(kind) ? 'rain' : 'clear';
    this.left = seconds ?? this.duration(this.phase);
    this.toastAt = {};
    this.snap();
    this.hooks.changed?.();
  }

  state() { return { phase: this.phase, left: Math.round(this.left), forced: this.forced }; }

  // A visitor takes the host's weather.
  apply(s) {
    if (!s) return;
    const same = s.phase === this.phase && (s.forced || null) === this.forced;
    this.left = s.left;
    if (same) return;
    this.phase = s.phase;
    this.forced = s.forced || null;
    this.snap();
  }

  info() {
    return {
      phase: this.phase, here: this.here, biome: this.biome, forced: this.forced, left: Math.round(this.left),
      boosts: this.boosts(), particles: this.points.visible ? this.count : 0, rainbow: this.arc.visible,
    };
  }

  // Where the player is ------------------------------------------------------
  refresh() {
    const g = this.game, w = g.world, p = g.player;
    if (!w || !p) return;
    const x = Math.floor(p.pos.x), z = Math.floor(p.pos.z);
    this.biome = w.surface(x, z).id === B.WATER ? 'water' : w.biome(x, z);
    const here = this.kindAt(this.biome);
    // Covered: a solid block above the head keeps the rain and snow out (houses, gyms, caves).
    const y0 = Math.floor(p.pos.y + 1.8);
    let covered = false;
    for (let y = y0; y < y0 + 15 && !covered; y++) covered = isSolid(w.get(x, y, z));
    this.covered = covered;
    if (here !== this.here) {
      this.here = here;
      this.toastFor(here);
    }
    this.icon = ICONS[here];
    if (!(here === 'stars' && !covered) && this.starT >= 0) { this.starT = -1; this.star.visible = false; }
  }

  toastFor(kind) {
    const text = TOASTS[kind];
    if (!text) return;
    if (this.clock - (this.toastAt[kind] ?? -1e9) < 120) return;
    this.toastAt[kind] = this.clock;
    this.hooks.toast?.(text);
    if (kind === 'rainbow') sound.play('rainbow');
  }

  // Recompute where we are and jump the visuals to full strength.
  snap() {
    this.refresh();
    this.shown = this.here;
    this.mix = 1;
    this.applyLook();
    this.setAmbience(...this.wantedAmbience());
  }

  wantedAmbience() {
    if (this.covered) return [null];
    switch (this.here) {
      case 'rain': return ['rain'];
      case 'storm': return ['storm'];
      case 'snow': return ['wind', 0.03];
      case 'sandstorm': return ['wind'];
      default: return [null];
    }
  }

  setAmbience(name, level) {
    const key = `${name}:${level ?? ''}`;
    if (key === this.ambKey) return;
    this.ambKey = key;
    sound.setAmbience(name, level);
  }

  // Visuals ------------------------------------------------------------------
  applyLook() {
    const d = PARTS[this.shown];
    const show = !!d && !this.covered && this.mix > 0;
    this.points.visible = show;
    if (show) {
      this.count = d.count;
      this.geo.setDrawRange(0, d.count);
      this.mat.map = this.tex[d.tex];
      this.mat.size = d.size;
      this.mat.color.setHex(d.color);
      this.mat.opacity = d.opacity * this.mix;
      this.mat.needsUpdate = true;
    }
    this.arc.visible = this.shown === 'rainbow' && this.mix > 0;
    this.arcMat.opacity = 0.45 * this.mix;
  }

  update(dt, now = performance.now()) {
    const cam = this.game.camera;
    this.tick(dt);
    if (now >= this.nextCheck) { this.nextCheck = now + 500; this.refresh(); }
    // Fade out the old look, switch, fade in the new one.
    if (this.shown !== this.here) {
      this.mix = Math.max(0, this.mix - dt * 0.5);
      if (this.mix <= 0) this.shown = this.here;
    } else if (this.mix < 1) this.mix = Math.min(1, this.mix + dt * 0.5);
    this.applyLook();
    this.flash = Math.max(0, this.flash - dt / 0.25);

    const d = PARTS[this.shown];
    if (this.points.visible && d) {
      this.points.position.copy(cam.position);
      // Keep the flakes fixed in the world while the player walks through them.
      const mx = this._hasLast ? this._last.x - cam.position.x : 0;
      const my = this._hasLast ? this._last.y - cam.position.y : 0;
      const mz = this._hasLast ? this._last.z - cam.position.z : 0;
      const t = performance.now() / 1000, a = this.pos, H = BOX / 2, R = TOP - BOT;
      for (let i = 0; i < d.count; i++) {
        const j = i * 3;
        let x = a[j] + mx + d.vx * dt, y = a[j + 1] + my + d.vy * dt, z = a[j + 2] + mz;
        if (d.wobble) { x += Math.sin(t * 1.3 + i) * 0.6 * dt; z += Math.cos(t * 1.1 + i * 1.7) * 0.6 * dt; }
        a[j] = ((x + H) % BOX + BOX) % BOX - H;
        a[j + 1] = ((y - BOT) % R + R) % R + BOT;
        a[j + 2] = ((z + H) % BOX + BOX) % BOX - H;
      }
      this.geo.attributes.position.needsUpdate = true;
    }
    this._last.copy(cam.position);
    this._hasLast = true;
    if (this.arc.visible) this.arc.position.set(cam.position.x, cam.position.y - 20, cam.position.z - 130);

    // Shooting stars on clear nights.
    if (this.here === 'stars' && !this.covered) {
      if (this.starT >= 0) {
        this.starT += dt;
        const u = this.starT;
        if (u >= 1) { this.starT = -1; this.star.visible = false; this.starIn = this.rand(10, 25); }
        else {
          const s = this.star.geometry.attributes.position;
          const a = this.starFrom.clone().addScaledVector(this.starDir, u * 60), b = a.clone().addScaledVector(this.starDir, -14);
          s.setXYZ(0, a.x, a.y, a.z); s.setXYZ(1, b.x, b.y, b.z); s.needsUpdate = true;
          this.starMat.opacity = Math.sin(u * Math.PI);
        }
      } else {
        this.starIn -= dt;
        if (this.starIn <= 0) this.startStar();
      }
    }

    this.setAmbience(...this.wantedAmbience());
  }

  startStar() {
    const cam = this.game.camera.position, ang = this.random() * Math.PI * 2;
    this.starFrom.set(cam.x + Math.cos(ang) * 150, cam.y + this.rand(60, 90), cam.z + Math.sin(ang) * 150);
    this.starDir.set(-Math.sin(ang), -0.35, Math.cos(ang)).normalize();
    this.starT = 0;
    this.star.visible = true;
    if (!this.starToasted) {
      this.starToasted = true;
      this.hooks.toast?.('A shooting star! Make a wish. Cosmic creatures are out tonight.');
      sound.play('star');
    }
  }

  // Sky tint, fog and brightness for main.js updateSky.
  sky(light) {
    const a = LOOK.clear, b = LOOK[this.shown] || a, m = this.mix, s = this._sky;
    s.tint.setHex(b.tint).multiplyScalar(0.25 + 0.75 * light);
    s.amount = b.amount * m;
    s.dim = a.dim + (b.dim - a.dim) * m;
    s.fogNear = a.near + (b.near - a.near) * m;
    s.fogFar = a.far + (b.far - a.far) * m;
    s.flash = this.here === 'storm' ? this.flash : 0;
    return s;
  }
}
