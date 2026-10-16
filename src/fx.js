// Battle effects: small blocky animations for attacks, hits and status changes.
//
// Rules (see plans/T7.md): every effect is time-based and closed-form (step(p) puts everything where
// it belongs at progress p, so a slow frame rate just shows fewer frames), uses only Math.random once
// per effect (never battle.rng, so player battles stay in step), never blocks a battle (travel is
// bounded and every promise also resolves from a timer), and is cheap (few objects, shared textures).
//
// Recipes live in fxrecipes.js: (k, from, to, opts) => ({ dur, step(p) }). To add a type, add an
// entry to TRAVEL, IMPACT and FX_COLORS there.
import * as THREE from 'three';
import { MOVES } from './species.js';
import { TRAVEL, IMPACT, SIG, FX_COLORS } from './fxrecipes.js';

const KEY = 'pokecraft-fx';
const MAX_LIVE = 6;
const MAX_POINTS = 300;
const HIDDEN = -1e4;
const RESOLVED = Promise.resolve();

const easeOut = t => 1 - (1 - t) * (1 - t);
const wave = t => Math.sin(Math.PI * t);

/* ------------------------------ shared textures ------------------------------ */

// 8x8 pixel pictures ('#' = solid). Drawn white so colours can tint them.
const BITMAPS = {
  dot: ['..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..'],
  star: ['...##...', '...##...', '..####..', '########', '########', '..####..', '...##...', '...##...'],
  leaf: ['.....###', '...#####', '..######', '.#######', '.######.', '######..', '#####...', '##......'],
  bubble: ['..####..', '.#....#.', '#..#...#', '#.#....#', '#......#', '#......#', '.#....#.', '..####..'],
  shard: ['...##...', '...##...', '..####..', '..####..', '..####..', '...##...', '...##...', '...##...'],
  note: ['....####', '....#..#', '....#...', '....#...', '....#...', '..###...', '.####...', '..##....'],
  bone: ['........', '##....##', '########', '##....##', '........', '........', '........', '........'],
  skull: ['..####..', '.######.', '########', '##.##.##', '##.##.##', '########', '.#.##.#.', '..#..#..'],
  z: ['######..', '....##..', '...##...', '..##....', '.##.....', '######..', '........', '........'],
  plus: ['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...'],
  up: ['...##...', '..####..', '.######.', '########', '..####..', '..####..', '..####..', '..####..'],
  down: ['..####..', '..####..', '..####..', '..####..', '########', '.######.', '..####..', '...##...'],
  puff: ['........', '..###...', '.#####..', '########', '########', '.######.', '........', '........'],
  drop: ['...##...', '...##...', '..####..', '.######.', '########', '########', '.######.', '..####..'],
  splat: ['#..##..#', '.######.', '########', '.######.', '########', '.######.', '#.####.#', '..#..#..'],
  square: ['........', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '........'],
  plane: ['........', '##......', '#####...', '########', '#####...', '..##....', '...#....', '........'],
  craneup: ['#......#', '##....##', '###..###', '.######.', '..####..', '..##.##.', '.....###', '........'],
  cranedown: ['........', '...##...', '.######.', '########', '##.##.##', '#..##..#', '...##.##', '......##'],
  streak: ['........', '........', '..######', '########', '..######', '........', '........', '........'],
  gear: ['..#..#..', '.######.', '########', '###..###', '###..###', '########', '.######.', '..#..#..'],
  clock: ['.##..##.', '########', '##.##.##', '##.###.#', '##....##', '.######.', '.#....#.', '#......#'],
  bang: ['...##...', '...##...', '...##...', '...##...', '...##...', '........', '...##...', '...##...'],
  heart: ['.##..##.', '########', '########', '########', '.######.', '..####..', '...##...', '........'],
  coin: ['..####..', '.######.', '##....##', '##.##.##', '##.##.##', '##....##', '.######.', '..####..'],
  gem: ['........', '.######.', '########', '.######.', '..####..', '...##...', '........', '........'],
};

const TEXTURES = {};
function texture(name) {
  if (TEXTURES[name]) return TEXTURES[name];
  const c = document.createElement('canvas');
  c.width = c.height = 40;
  const g = c.getContext('2d');
  if (name === 'soft') {
    const grad = g.createRadialGradient(20, 20, 1, 20, 20, 19);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 40, 40);
  } else {
    // White pixels with a dark outline: tinted by the particle colour, but still readable on a bright sky.
    const rows = BITMAPS[name] || BITMAPS.star;
    const on = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && rows[y][x] === '#';
    g.fillStyle = 'rgba(25,20,50,0.8)';
    for (let y = -1; y <= 8; y++) for (let x = -1; x <= 8; x++) {
      if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) g.fillRect((x + 1) * 4, (y + 1) * 4, 4, 4);
    }
    g.fillStyle = '#fff';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (on(x, y)) g.fillRect((x + 1) * 4, (y + 1) * 4, 4, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return (TEXTURES[name] = t);
}

// Shared geometries. cone: base (radius 1) at z = 0, point at z = 1.
const GEOS = {};
function geometry(name) {
  if (GEOS[name]) return GEOS[name];
  let g;
  if (name === 'box') g = new THREE.BoxGeometry(1, 1, 1);
  else if (name === 'ring') g = new THREE.RingGeometry(0.8, 1, 12);
  else if (name === 'disc') g = new THREE.CircleGeometry(1, 12);
  else { g = new THREE.ConeGeometry(1, 1, 8, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5); }
  return (GEOS[name] = g);
}

const tmpColor = new THREE.Color();
const ok = v => v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const goodSpot = s => !!s && ok(s.pos) && Number.isFinite(s.top) && Number.isFinite(s.r);

/* ------------------------------ the engine ------------------------------ */

export class Fx {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'fx';
    scene.add(this.root);
    this.on = true;
    try { this.on = localStorage.getItem(KEY) !== 'off'; } catch { /* private window */ }
    this.hold = null; // tests: a number 0..1 freezes every effect at that progress
    this.active = new Set();
    this.errors = [];
    this.stats = { made: 0, disposed: 0, live: 0, points: 0 };
  }

  setOn(on) {
    this.on = !!on;
    try { localStorage.setItem(KEY, this.on ? 'on' : 'off'); } catch { /* ignore */ }
    if (!this.on) this.clear();
  }

  update(now) {
    if (!this.active.size) return;
    for (const e of [...this.active]) {
      let p = this.hold != null ? this.hold : Math.min(1, Math.max(0, (now - e.t0) / e.dur));
      try {
        e.step(p);
        if (e.pts) for (const a of e.pts) a.needsUpdate = true;
      } catch (err) { this.errors.push(`${e.name}: ${err.message}`); this.finish(e); continue; }
      if (p >= 1 && this.hold == null) this.finish(e);
    }
  }

  attack(moveId, from, to) {
    const mv = MOVES[moveId];
    if (!this.on || !mv || !goodSpot(from) || !goodSpot(to)) return RESOLVED;
    const rec = (mv.sig && SIG[moveId]) || TRAVEL[mv.type] || TRAVEL.normal;
    return this.run(`attack:${moveId}`, rec, from, to, { type: mv.type, big: false });
  }

  impact(type, to, { big = false } = {}) {
    if (!this.on || !goodSpot(to)) return RESOLVED;
    return this.run(`impact:${type}`, IMPACT[type] || IMPACT.normal, to, to, { type, big });
  }

  status(kind, spot, opts = {}) {
    if (!this.on || !goodSpot(spot) || !STATUS[kind]) return RESOLVED;
    const from = goodSpot(opts.from) ? opts.from : spot;
    return this.run(`status:${kind}`, STATUS[kind], from, spot, opts);
  }

  aura(type, spot) {
    if (!this.on || !goodSpot(spot)) return RESOLVED;
    return this.run(`aura:${type}`, aura, spot, spot, { type });
  }

  clear() {
    for (const e of [...this.active]) this.finish(e);
  }

  /* ---- internals ---- */

  run(name, rec, from, to, opts) {
    while (this.active.size >= MAX_LIVE) this.finish(this.active.values().next().value);
    const e = { name, t0: performance.now(), dur: 400, step: null, objs: [], geos: [], mats: [], pts: [], npts: 0, done: false, resolve: null };
    const promise = new Promise(res => { e.resolve = res; });
    this.active.add(e);
    this.stats.live = this.active.size;
    try {
      const r = rec(this.kit(e, from, to), from, to, opts);
      e.dur = Math.max(50, r.dur);
      e.step = r.step;
      r.step(0);
    } catch (err) {
      this.errors.push(`${name}: ${err.message}`);
      this.finish(e);
      return promise;
    }
    const guard = () => {
      if (e.done) return;
      if (this.hold != null) setTimeout(guard, 400); // tests freeze effects on purpose
      else this.finish(e);
    };
    setTimeout(guard, e.dur + 400); // a hidden tab stops animation frames: never wait for them
    return promise;
  }

  finish(e) {
    if (e.done) return;
    e.done = true;
    for (const o of e.objs) this.root.remove(o);
    for (const g of e.geos) { g.dispose(); this.stats.disposed++; }
    for (const m of e.mats) { m.dispose(); this.stats.disposed++; }
    this.stats.points -= e.npts;
    this.active.delete(e);
    this.stats.live = this.active.size;
    e.resolve();
  }

  // The toolbox a recipe gets. Everything it makes belongs to the effect and goes away with it.
  kit(e, from, to) {
    const fx = this;
    const dir = new THREE.Vector3(to.pos.x - from.pos.x, 0, to.pos.z - from.pos.z);
    const dist = dir.length();
    if (dist < 0.01) dir.set(1, 0, 0); else dir.divideScalar(dist);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const a = new THREE.Vector3(from.pos.x + dir.x * from.r * 0.9, from.pos.y, from.pos.z + dir.z * from.r * 0.9);
    const b = new THREE.Vector3(to.pos.x - dir.x * to.r * 0.7, to.pos.y, to.pos.z - dir.z * to.r * 0.7);
    const add = (obj, mat, geo) => {
      obj.frustumCulled = false;
      obj.renderOrder = 999;
      e.objs.push(obj); e.mats.push(mat); fx.stats.made++;
      if (geo) { e.geos.push(geo); fx.stats.made++; }
      fx.root.add(obj);
      return obj;
    };
    const base = (_glow, opacity) => ({
      transparent: true, depthWrite: false, depthTest: false, fog: false, opacity,
      // Additive blending turns bright colours white on a daytime sky, so "glow" only means "bright" here.
      blending: THREE.NormalBlending,
    });
    return {
      dir, side, dist,
      ease: easeOut, wave,
      seeds(n, m) { const s = new Float32Array(n * m); for (let i = 0; i < s.length; i++) s[i] = Math.random(); return s; },
      // A point on the path at t (0 to 1), with an arc of height `lift`.
      at(t, out, lift = 0) {
        t = Math.min(1, Math.max(0, t));
        out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * lift, a.z + (b.z - a.z) * t);
        return out;
      },
      points({ n = 20, tex = 'dot', size = 0.3, colors = [0xffffff], glow = false, opacity = 1 } = {}) {
        n = Math.max(0, Math.min(n, 80, MAX_POINTS - fx.stats.points));
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const pa = new THREE.BufferAttribute(pos, 3), ca = new THREE.BufferAttribute(col, 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', pa); geo.setAttribute('color', ca);
        const mat = new THREE.PointsMaterial({ map: texture(tex), size, vertexColors: true, sizeAttenuation: true, alphaTest: 0.02, ...base(glow, opacity) });
        const pts = new THREE.Points(geo, mat);
        const setColor = (i, hex) => { tmpColor.setHex(hex); col[i * 3] = tmpColor.r; col[i * 3 + 1] = tmpColor.g; col[i * 3 + 2] = tmpColor.b; };
        for (let i = 0; i < n; i++) { pos[i * 3 + 1] = HIDDEN; setColor(i, colors[i % colors.length]); }
        pts.n = n;
        pts.set = (i, x, y, z) => { if (i < n) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; } };
        pts.hide = i => pts.set(i, 0, HIDDEN, 0);
        pts.color = (i, hex) => { if (i < n) { setColor(i, hex); ca.needsUpdate = true; } };
        pts.fade = v => { mat.opacity = Math.max(0, v); };
        e.pts.push(pa);
        e.npts += n; fx.stats.points += n;
        return add(pts, mat, geo);
      },
      mesh(geoName, { color = 0xffffff, glow = false, opacity = 1 } = {}) {
        const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, forceSinglePass: true, ...base(glow, opacity) });
        return add(new THREE.Mesh(geometry(geoName), mat), mat);
      },
      sprite(tex, { color = 0xffffff, size = 0.5, glow = false, opacity = 1 } = {}) {
        const mat = new THREE.SpriteMaterial({ map: texture(tex), color, ...base(glow, opacity) });
        const s = add(new THREE.Sprite(mat), mat);
        s.scale.setScalar(size);
        return s;
      },
    };
  }
}

/* ------------------------------ status effects ------------------------------ */

const STAT_COLORS = { atk: 0xff6a3a, def: 0x5aa0ff, spd: 0xc8f04a };
const lerp = (a, b, t) => a + (b - a) * t;

// Small helper: stand a mesh flat on the ground (rings, discs).
function flat(m, x, y, z, s) { m.rotation.set(-Math.PI / 2, 0, 0); m.position.set(x, y, z); m.scale.setScalar(s); }

const STATUS = {
  heal(k, from, to) {
    const { x, y, z } = to.pos, feet = 2 * y - to.top;
    const pts = k.points({ n: 8, tex: 'plus', size: 0.4, glow: true, colors: [0x6bff8a, 0xc8ffd0] });
    const disc = k.mesh('disc', { color: 0x4cd96a, glow: true, opacity: 0.3 });
    const s = k.seeds(8, 2);
    return {
      dur: 850,
      step(p) {
        for (let i = 0; i < 8; i++) {
          const q = Math.min(1, p * 1.2 - s[i * 2] * 0.2);
          const ang = i * 0.8 + q * 2;
          if (q <= 0) pts.hide(i); else pts.set(i, x + Math.cos(ang) * (to.r + 0.1), feet + 0.1 + q * (to.top - feet + 0.3), z + Math.sin(ang) * (to.r + 0.1));
        }
        pts.fade(1 - p * p);
        flat(disc, x, feet + 0.05, z, to.r * (0.8 + p * 0.8));
        disc.material.opacity = 0.35 * wave(p);
      },
    };
  },
  up(k, from, to, opts) { return arrows(k, to, opts, 1); },
  down(k, from, to, opts) { return arrows(k, to, opts, -1); },
  sleep(k, from, to) {
    const pts = k.points({ n: 4, tex: 'z', size: 0.3, colors: [0xcfe0ff, 0xffffff] });
    const hx = to.pos.x, hz = to.pos.z;
    return {
      dur: 950,
      step(p) {
        for (let i = 0; i < 4; i++) {
          const q = p * 1.4 - i * 0.22;
          if (q <= 0 || q > 1) pts.hide(i);
          else pts.set(i, hx + 0.2 + q * 0.5 + Math.sin(q * 9 + i) * 0.12, to.top + 0.1 + q * 1.1, hz);
        }
        pts.material.size = 0.3 + p * 0.35;
        pts.fade(p < 0.8 ? 1 : (1 - p) / 0.2);
      },
    };
  },
  flinch(k, from, to) {
    const bang = k.sprite('bang', { color: 0xffe14a, size: 0.1, glow: true });
    const pts = k.points({ n: 4, tex: 'star', size: 0.28, glow: true, colors: [0xfff08a] });
    return {
      dur: 750,
      step(p) {
        bang.position.set(to.pos.x, to.top + 0.6, to.pos.z);
        const pop = p < 0.2 ? easeOut(p / 0.2) * 1.15 : 1.15 - Math.min(0.15, (p - 0.2) * 0.4);
        bang.scale.setScalar(Math.max(0.01, 0.9 * pop));
        bang.material.opacity = p < 0.8 ? 1 : (1 - p) / 0.2;
        for (let i = 0; i < 4; i++) {
          const ang = i * Math.PI / 2 + p * 6;
          pts.set(i, to.pos.x + Math.cos(ang) * 0.6, to.top + 0.6 + Math.sin(ang) * 0.45, to.pos.z);
        }
        pts.fade(1 - p);
      },
    };
  },
  recoil(k, from, to) {
    const pts = k.points({ n: 6, tex: 'puff', size: 0.5, colors: [0xcfc8b8, 0xa8a090] });
    const star = k.sprite('star', { color: 0xffe14a, size: 0.1, glow: true });
    const s = k.seeds(6, 2);
    return {
      dur: 500,
      step(p) {
        for (let i = 0; i < 6; i++) {
          const ang = s[i * 2] * 6.283, d = (0.2 + s[i * 2 + 1] * 0.5) * easeOut(p);
          pts.set(i, to.pos.x + Math.cos(ang) * (to.r + d), to.pos.y - 0.2 + p * 0.4, to.pos.z + Math.sin(ang) * (to.r + d));
        }
        pts.fade(1 - p);
        star.position.set(to.pos.x, to.top + 0.2, to.pos.z);
        star.scale.setScalar(0.1 + 0.5 * wave(Math.min(1, p * 1.6)));
        star.material.opacity = 1 - p;
      },
    };
  },
  miss(k, from, to) {
    const pts = k.points({ n: 5, tex: 'puff', size: 0.75, colors: [0xdad8d0, 0xb8b6ae] });
    const sd = from === to ? new THREE.Vector3(1, 0, 0) : k.side;
    return {
      dur: 550,
      step(p) {
        for (let i = 0; i < 5; i++) {
          const q = p - i * 0.06;
          if (q <= 0) { pts.hide(i); continue; }
          const m = (to.r + 0.5) * (1 - q * 1.6);
          pts.set(i, to.pos.x + sd.x * m, to.pos.y + 0.1 * i + q * 0.3, to.pos.z + sd.z * m);
        }
        pts.fade(1 - p);
      },
    };
  },
  power(k, from, to) {
    const N = 16;
    const pts = k.points({ n: N, tex: 'star', size: 0.34, glow: true, colors: [0xffd84a, 0xfff2a0, 0xffb830] });
    const feet = 2 * to.pos.y - to.top;
    return {
      dur: 950,
      step(p) {
        for (let i = 0; i < N; i++) {
          const q = p * 1.3 - (i / N) * 0.3;
          if (q <= 0) { pts.hide(i); continue; }
          const ang = i * 1.1 + q * 7;
          pts.set(i, to.pos.x + Math.cos(ang) * (to.r + 0.15), feet + Math.min(1, q) * (to.top - feet + 0.3), to.pos.z + Math.sin(ang) * (to.r + 0.15));
        }
        pts.fade(p < 0.75 ? 1 : (1 - p) / 0.25);
      },
    };
  },
};

// Stat arrows: three rise (up) or sink (down) round the creature.
function arrows(k, to, opts, dirn) {
  const col = STAT_COLORS[opts.stat] ?? STAT_COLORS.atk;
  const dim = dirn > 0 ? 1 : 0.6;
  const hex = (Math.round((col >> 16 & 255) * dim) << 16) | (Math.round((col >> 8 & 255) * dim) << 8) | Math.round((col & 255) * dim);
  const pts = k.points({ n: 3, tex: dirn > 0 ? 'up' : 'down', size: 0.5, glow: dirn > 0, colors: [hex] });
  const feet = 2 * to.pos.y - to.top;
  return {
    dur: 850,
    step(p) {
      for (let i = 0; i < 3; i++) {
        const q = p * 1.3 - i * 0.12;
        if (q <= 0) { pts.hide(i); continue; }
        const t = Math.min(1, q), ang = i * 2.094 + 0.5;
        const y = dirn > 0 ? lerp(feet, to.top + 0.3, t) : lerp(to.top + 0.4, feet, t);
        pts.set(i, to.pos.x + Math.cos(ang) * (to.r + 0.25), y, to.pos.z + Math.sin(ang) * (to.r + 0.25));
      }
      pts.fade(p < 0.7 ? 1 : (1 - p) / 0.3);
    },
  };
}

// Status moves: twelve sparkles in the move's colours circle the user once.
function aura(k, from, to, opts) {
  const cols = FX_COLORS[opts.type] || FX_COLORS.normal;
  const N = 12;
  const pts = k.points({ n: N, tex: 'star', size: 0.3, glow: true, colors: cols });
  const feet = 2 * to.pos.y - to.top;
  return {
    dur: 750,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + p * 6.283;
        const y = lerp(feet + 0.2, to.top, (i % 4) / 3) + Math.sin(p * 6 + i) * 0.1;
        pts.set(i, to.pos.x + Math.cos(ang) * (to.r + 0.25), y, to.pos.z + Math.sin(ang) * (to.r + 0.25));
      }
      pts.fade(p < 0.7 ? 1 : (1 - p) / 0.3);
    },
  };
}
