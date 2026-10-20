// The Restaurant (T33, gym 28, south slot 5): beat the waiter and the cook, then Chef Basil gives an order. Find the
// ingredients out in the world (break natural blocks), cook the dish in the pot (tap it while it is golden), serve it
// at the right table, and the happy customer calls the Chef for the battle. Every rematch is the next dish.
// plans/T33.md. The building is the same in every world; the order lives in game.keys (per player, saved).
import { B, WOOL, isSolid } from './blocks.js';
import { WORLD_H, WATER_LEVEL, MID_X, MID_Z } from './world.js';
import { trainersOf, trainerKey } from './gyms.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';

const RD = 8; // front and back walls at d = +-8
const RS = 10; // side walls at s = +-10
const H = 5; // walls fy+1..fy+5, roof layer at fy+6
const RAW = 3; // seconds the pot is raw
const BURNT_SHOW = 2.5; // seconds it shows burnt
const SIGHT = 16; // pot toasts only when the player is this close

/* ----------------------------- pure helpers ----------------------------- */

// Block ids of an ingredient (the def lists B names).
export const ingredientIds = (def, key) => (def.ingredients[key]?.blocks || []).map(n => B[n]);

// Which ingredients exist on this map as natural blocks anyone can break (not inside a gym, not placed by a player).
// Decided from the generated world, so it is the same every time; cached per world. A test may set world.foodSources.
export function sourcesFound(world, def) {
  if (world.foodSources) return world.foodSources;
  const cache = (sourcesFound.cache ||= new WeakMap());
  if (cache.has(world)) return cache.get(world);
  const found = new Set();
  for (const key of Object.keys(def.ingredients)) {
    for (const id of ingredientIds(def, key)) {
      let i = world.data.indexOf(id);
      while (i >= 0) {
        const x = i % world.W, z = Math.floor(i / world.W) % world.D, y = Math.floor(i / (world.W * world.D));
        if (!world.edits.has(i) && world.editAllowed(x, y, z, B.AIR)) { found.add(key); break; }
        i = world.data.indexOf(id, i + 1);
      }
      if (found.has(key)) break;
    }
  }
  cache.set(world, found);
  return found;
}

// Dishes (indices 1..) whose ingredients all exist on this map. Dish 0, the badge dish, only needs things every map has.
export function availableDishes(world, def) {
  const have = sourcesFound(world, def);
  return def.menu.map((d, i) => i).filter(i => i > 0 && def.menu[i].ingredients.every(k => have.has(k)));
}

// Which dish is on the menu for this player: the badge dish first, then one more per rematch win (the next dish that can
// be made on this map, round and round). A map with no such dish keeps the badge dish.
export function dishIndex(game, def) {
  if (!game.badges.includes(def.id)) return 0;
  const list = availableDishes(game.world, def);
  if (!list.length) return 0;
  return list[(game.rematchWins[def.id] || 0) % list.length];
}

// The open order: stage 'none' | 'shopping' (ingredients missing) | 'cook' (all found) | 'cooked' (dish ready) | 'served'.
export function orderState(game, def) {
  const has = k => game.keys.includes(`${def.id}:${k}`);
  const i = dishIndex(game, def), dish = def.menu[i];
  const missing = dish.ingredients.filter(k => !has(k));
  const stage = has('served') ? 'served' : has('cooked') ? 'cooked' : has('order') ? (missing.length ? 'shopping' : 'cook') : 'none';
  return { i, dish, missing, stage };
}

// "table 2 (blue)" for a dish of this gym (colours come from the built gym when there is one).
export const tableWords = (gym, dish) => `table ${dish.table} (${gym.tables?.[dish.table - 1]?.color || ['red', 'blue', 'green', 'yellow'][dish.table - 1]})`;

// The guide's words for the open order (WHEN.menu status), '' without one.
export function menuStatus(game, g) {
  const def = g.def, s = orderState(game, def), d = s.dish, I = def.ingredients;
  if (s.stage === 'none') return '';
  if (s.stage === 'served') return ` · ${def.leader.name} is waiting for a battle`;
  if (s.stage === 'cooked') return ` · ${d.emoji} ${d.name} is ready: take it to ${tableWords(g, d)}`;
  if (s.stage === 'cook') return ` · ${d.emoji} ${d.name}: cook it in the pot!`;
  return ` · ${d.emoji} ${d.name}: ${d.ingredients.map(k => I[k].emoji + (s.missing.includes(k) ? '' : '✓')).join(' ')}`;
}

/* ------------------------------- building ------------------------------- */

export function buildRestaurant(world, def, slot) {
  const { x: x0, z: z0, box } = slot;
  const fy = Math.max(WATER_LEVEL + 1, Math.min(world.terrainHeight(x0, z0), 24));
  const ddx = MID_X - x0, ddz = MID_Z - z0; // the door faces the middle of the map, like the other gyms
  const front = Math.abs(ddx) > Math.abs(ddz) ? [Math.sign(ddx), 0] : [0, Math.sign(ddz) || 1];
  const col = (d, s) => [x0 + front[0] * d + front[1] * s, z0 + front[1] * d + front[0] * s];
  const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
  const put = (x, y, z, id) => {
    if (!inBox(x, z)) throw new Error(`Restaurant wrote outside its slot box at ${x},${y},${z}`);
    world.set(x, y, z, id, false);
  };
  const putD = (d, s, y, id) => { const [x, z] = col(d, s); put(x, y, z, id); };
  const bbox = (d0, d1, s0, s1) => {
    const a = col(d0, s0), b = col(d1, s1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  };
  const FW = WOOL.food;

  world.levelSite(bbox(-RD - 2, RD + 3, -RS - 2, RS + 2), fy, box, 2);

  // 1. Shell: walls, floors, carpet, roof.
  for (let d = -RD; d <= RD; d++) for (let s = -RS; s <= RS; s++) {
    const [x, z] = col(d, s);
    for (let y = 1; y < fy; y++) if (!isSolid(world.get(x, y, z))) put(x, y, z, B.STONE);
    const wall = Math.abs(d) === RD || Math.abs(s) === RS;
    if (wall) {
      const corner = Math.abs(d) === RD && Math.abs(s) === RS;
      put(x, fy, z, B.BRICK);
      for (let y = fy + 1; y <= fy + H; y++) put(x, y, z, corner ? B.LOG : B.BRICK);
      put(x, fy + H + 1, z, B.BRICK);
    } else {
      put(x, fy, z, d <= -3 ? B.STONE_BRICKS : Math.abs(s) <= 1 ? FW : B.PLANKS);
      for (let y = fy + 1; y <= fy + H; y++) put(x, y, z, B.AIR);
      put(x, fy + H + 1, z, FW);
    }
  }

  // 2. Door, windows, awning, ceiling lamps.
  for (let s = -1; s <= 1; s++) for (let y = fy + 1; y <= fy + 3; y++) putD(RD, s, y, B.AIR);
  for (const s of [-6, -5, 5, 6]) for (let y = fy + 2; y <= fy + 3; y++) putD(RD, s, y, B.GLASS);
  for (const sd of [-RS, RS]) for (const d of [-5, -4, 3, 4]) for (let y = fy + 2; y <= fy + 3; y++) putD(d, sd, y, B.GLASS);
  for (let s = -3; s <= 3; s++) putD(RD + 1, s, fy + 4, FW);
  for (const s of [-3, 3]) for (let y = fy + 1; y <= fy + 3; y++) putD(RD + 1, s, y, B.LOG);
  for (const [d, s] of [[4, -5], [4, 5], [0, -5], [0, 5], [-5, 0], [-5, -6], [-5, 6]]) putD(d, s, fy + H + 1, B.LAMP);

  // 3. Tables: one block of its wool (a table with a tablecloth), a chair on the aisle side, the customer on the wall side.
  const TABLES = [
    { n: 1, d: 5, s: -6, wool: WOOL.fire, color: 'red' }, { n: 2, d: 5, s: 6, wool: WOOL.water, color: 'blue' },
    { n: 3, d: 1, s: -6, wool: WOOL.grass, color: 'green' }, { n: 4, d: 1, s: 6, wool: WOOL.electric, color: 'yellow' },
  ];
  for (const t of TABLES) {
    putD(t.d, t.s, fy + 1, t.wool);
    putD(t.d, t.s - 2 * Math.sign(t.s), fy + 1, B.PLANKS);
  }

  // 4. Kitchen: counter with a gap, stoves, THE POT on the middle stove, a fridge made of ice.
  for (let s = -9; s <= 9; s++) if (Math.abs(s) >= 3) putD(-3, s, fy + 1, B.PLANKS);
  for (let s = -6; s <= -4; s++) putD(-7, s, fy + 1, B.STOVE);
  putD(-7, -5, fy + 2, B.POT);
  for (const s of [6, 7]) for (let y = fy + 1; y <= fy + 2; y++) putD(-7, s, y, B.ICE);

  // Everything inside is bright, like the other gyms.
  const all = bbox(-RD - 1, RD + 2, -RS - 1, RS + 1);
  world.markLitBox(all.x0, all.x1, all.z0, all.z1);

  const cell = (d, s) => { const [x, z] = col(d, s); return [x + 0.5, fy + 1, z + 0.5]; };
  const headTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
  const [px, pz] = col(-7, -5);
  const people = def.customers.map(c => {
    const t = TABLES[c.table - 1], cs = t.s + 2 * Math.sign(t.s);
    return {
      kind: 'guest', name: c.name, title: `${c.name} · table ${c.table} (${t.color})`, colors: c.colors, line: c.line,
      table: c.table, pos: cell(t.d, cs), heading: headTo(col(t.d, cs), col(t.d, t.s)),
    };
  });
  return {
    def, x: x0, z: z0, y: fy + 1, front, fy,
    leaderPos: cell(-5, 0), trainerPos: cell(4, -2), trainerPositions: [cell(4, -2), cell(-1, 2)],
    people,
    pot: [px, fy + 2, pz],
    tables: TABLES.map(t => { const [x, z] = col(t.d, t.s); return { n: t.n, color: t.color, wool: t.wool, at: [x, fy + 1, z] }; }),
    protect: [{ ...bbox(-RD, RD + 1, -RS, RS), y0: 1, y1: WORLD_H - 1 }],
    area: { ...bbox(-RD - 2, RD + 3, -RS - 2, RS + 2), y0: fy - 1, y1: fy + H + 3 },
  };
}

/* ------------------------------ the live part ------------------------------ */

// LIVE.restaurant: the pot (raw -> golden -> burnt, by real time), orders, ingredients and serving. Blocks change only
// with setLive (this player only). State is only game.keys: food:order / cooked / served and food:<ingredient>.
export class RestaurantLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.def = gym.def;
    this.cells = new LiveCells(game.world, () => game.player);
    this.now = () => performance.now() / 1000; // tests replace it
    this.cookAt = null;
    this.last = 'idle';
    this.update(0);
  }

  get ui() { return this.game.ui; }
  has(k) { return this.game.keys.includes(`${this.def.id}:${k}`); }
  add(k) { if (!this.has(k)) this.game.keys.push(`${this.def.id}:${k}`); }
  drop(k) { const i = this.game.keys.indexOf(`${this.def.id}:${k}`); if (i >= 0) this.game.keys.splice(i, 1); }
  order() { return orderState(this.game, this.def); }
  table(dish) { return tableWords(this.gym, dish); }
  emojis(list) { return list.map(k => this.def.ingredients[k].emoji).join(' '); }
  atPot(b) { const [x, y, z] = this.gym.pot; return b.x === x && b.y === y && b.z === z; }
  near() { const p = this.game.player?.pos, [x, , z] = this.gym.pot; return !!p && Math.hypot(p.x - x, p.z - z) <= SIGHT; }

  phase(now = this.now()) {
    if (this.cookAt == null) return 'idle';
    const t = now - this.cookAt, time = this.order().dish.time;
    return t < RAW ? 'raw' : t < RAW + time ? 'golden' : t < RAW + time + BURNT_SHOW ? 'burnt' : 'done';
  }

  update() {
    this.cells.flush();
    let p = this.phase();
    if (p === 'done') { this.cookAt = null; p = 'idle'; }
    if (p !== this.last && this.near()) {
      if (p === 'golden') { sound.play('cookding'); this.ui?.toast("It's golden! Tap the pot now!"); }
      if (p === 'burnt') { sound.play('potburnt'); this.ui?.toast('Oh no, it burnt! Tap the pot to try again. Your ingredients are safe.'); }
    }
    this.last = p;
    const [x, y, z] = this.gym.pot;
    this.cells.want(x, y, z, p === 'golden' ? B.POT_GOLDEN : p === 'burnt' ? B.POT_BURNT : B.POT);
  }

  // The pot was clicked or tapped. Always handled (it never breaks).
  hit(block) {
    if (!this.atPot(block)) return false;
    const s = this.order(), d = s.dish, ui = this.ui, ph = this.phase();
    if (s.stage === 'none') ui.toast(`Talk to ${this.def.leader.name} first. He will tell you what to cook!`);
    else if (s.stage === 'shopping') ui.toast(`You still need ${this.emojis(s.missing)} for ${d.name}.`);
    else if (s.stage === 'cooked') ui.toast(`The ${d.name} is ready! Take it to ${this.table(d)}.`);
    else if (s.stage === 'served') ui.toast(`Go and battle ${this.def.leader.name}!`);
    else if (ph === 'idle' || ph === 'done') {
      this.cookAt = this.now();
      sound.play('potbubble');
      ui.toast('Watch the pot! Tap it when it turns golden.');
    } else if (ph === 'raw') ui.toast('Not yet... wait until it turns golden!');
    else if (ph === 'golden') {
      this.add('cooked');
      this.cookAt = null;
      sound.play('yum');
      ui.toast(`${d.emoji} ${d.name} is ready! Take it to ${this.table(d)}.`);
      this.game.save?.();
      this.update();
    } else { // burnt: start again at once
      this.cookAt = this.now();
      sound.play('potbubble');
      ui.toast("Let's try again! Tap it when it turns golden.");
    }
    return true;
  }

  prompt(block, how) {
    if (!this.atPot(block)) return null;
    return this.phase() === 'golden' ? `Cooking pot · it's golden, ${how} now!` : `Cooking pot · ${how} to cook`;
  }

  // A natural block was broken: it may be the next missing ingredient of the open order.
  broke(block) {
    const s = this.order();
    if (s.stage !== 'shopping') return;
    const I = this.def.ingredients;
    const key = s.missing.find(k => ingredientIds(this.def, k).includes(block.id));
    if (!key) return;
    this.add(key);
    sound.play('keyfound');
    const left = this.order().missing, n = s.dish.ingredients.length - left.length;
    this.ui.toast(`${I[key].emoji} You found ${I[key].found}! (${n}/${s.dish.ingredients.length} for ${s.dish.name})`);
    if (!left.length) this.ui.toast(`You have everything for ${s.dish.name}! Cook it in the pot at the Restaurant.`);
    this.game.save?.();
  }

  beatTrainers() {
    return trainersOf(this.def).every((p, i) => this.game.beaten.includes(trainerKey(this.def, i)));
  }

  talk(npc) {
    if (npc.gym !== this.gym) return false;
    const def = this.def, chef = def.leader.name, s = this.order(), d = s.dish, ui = this.ui, I = def.ingredients;
    if (npc.kind === 'leader') {
      if (!this.beatTrainers()) return false;
      if (s.stage === 'none') {
        this.add('order');
        this.game.save?.();
        const now = this.order();
        if (now.missing.length) {
          ui.toast(`${chef}: ${cap(this.table(d))} wants ${d.name}! I need ${this.emojis(now.missing)}.`);
          ui.toast(`Find them out in the world: ${now.missing.map(k => `${I[k].emoji} ${I[k].hint}`).join(' · ')}. Break one of each!`);
        } else ui.toast(`${chef}: ${cap(this.table(d))} wants ${d.name}! You already have everything. Cook it in the pot!`);
      } else if (s.stage === 'shopping') {
        ui.toast(`${chef}: ${d.name} for ${this.table(d)}. Still missing: ${this.emojis(s.missing)}. Look in ${s.missing.map(k => I[k].hint).join(' and ')}.`);
      } else if (s.stage === 'cook') ui.toast(`${chef}: You have everything! Cook it in the pot. Tap the pot when it turns golden.`);
      else if (s.stage === 'cooked') ui.toast(`${chef}: Quick, take the ${d.name} to ${this.table(d)} before it gets cold!`);
      else this.startChef();
      return true;
    }
    if (npc.kind === 'guest') {
      if (s.stage === 'cooked' && npc.def?.table === d.table) {
        this.add('served');
        this.drop('cooked');
        sound.play('yum');
        ui.toast(`${npc.name}: Yum, ${d.name}! Thank you! ${chef}, come and see!`);
        this.game.save?.();
        this.startChef();
        return true;
      }
      if ((s.stage === 'shopping' || s.stage === 'cook') && npc.def?.table === d.table) {
        ui.toast(`${npc.name}: Is my ${d.name} coming? I can't wait!`);
        return true;
      }
    }
    return false;
  }

  // The Chef comes to see the happy customer: the badge battle, or a rematch (the dish is its introduction).
  startChef() {
    const game = this.game, def = this.def, d = this.order().dish;
    const chef = game.npcs.list.find(n => n.gym === this.gym && n.kind === 'leader');
    if (!chef) return;
    if (!game.badges.includes(def.id)) game.startBattle({ trainer: chef, team: def.leaderTeam, intro: def.intro });
    else game.rematch.start(chef, [`${d.name} for ${this.table(d)}! Yum!`, 'Now a rematch, chef to chef. My team trained in the kitchen!']);
  }

  talkPrompt(npc) {
    if (npc.gym !== this.gym) return null;
    const s = this.order();
    if (npc.kind === 'leader') {
      if (!this.beatTrainers()) return null;
      if (s.stage === 'none') return { verb: 'get an order', action: 'Order!' };
      if (s.stage === 'served') return { verb: 'battle', action: 'Battle!' };
      return { verb: 'talk', action: 'Talk' };
    }
    if (npc.kind === 'guest') {
      if (s.stage === 'cooked' && npc.def?.table === s.dish.table) return { verb: `serve the ${s.dish.name}`, action: 'Serve!' };
      return { verb: 'talk', action: 'Talk' };
    }
    return null;
  }

  // The Chef lost: the order is finished (the badge or rematch win and its toasts were already handled).
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.trainer?.kind !== 'leader' || opts.trainer.gym !== this.gym) return;
    this.drop('order'); this.drop('cooked'); this.drop('served');
    this.cookAt = null;
    this.ui.toast(`${this.def.leader.name}: Come back soon! There is a new dish on the menu.`);
  }

  state() { return { ...this.order(), phase: this.phase(), cookAt: this.cookAt }; }
}

const cap = s => s[0].toUpperCase() + s.slice(1);
