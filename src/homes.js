// T22: homes. findRoom (the room finder, knows no home type), Home (one record + its last report/result) and
// HomeManager (game.homes: ownership, placing/choosing/removing, re-checks on edits, play-together messages).
import { B, isSolid } from './blocks.js';
import { HOME_TYPES } from './hometypes.js';
import { sound } from './sound.js';
import { findRoom } from './roomfinder.js';

const ACTIVE_RANGE = 24; // the meter and glow stay on this close to the Doormat
const TOAST_RANGE = 32;  // you hear about your own home changing this close
const RECHECK = 0.25;    // seconds between re-checks of homes whose box was edited

/* ------------------------------ room finder ------------------------------ */

export { findRoom };

/* --------------------------------- Home ---------------------------------- */

export class Home {
  constructor({ owner, name = '', x, y, z, type = null }, game = null) {
    Object.assign(this, { owner, name, x, y, z, type });
    Object.defineProperty(this, 'game', { value: game, enumerable: false });
    this.report = null;  // findRoom's report (see homes.js findRoom)
    this.result = null;  // HomeType.evaluate(report), or null while no type is chosen
    this.world = null;
  }

  get homeType() { return HOME_TYPES[this.type] ?? null; }
  get finished() { return !!this.result?.finished; }
  get full() { return !!this.result?.full; }

  check(world = this.world) {
    this.world = world;
    this.report = findRoom(world, this.x, this.y, this.z);
    this.result = this.homeType?.evaluate(this.report) ?? null;
  }

  // Inside columns (not the Doormat, not the door) with a solid floor and air at floor+1 and floor+2: [{ x, y: f+1, z }].
  freeCells() {
    const r = this.report, w = this.world;
    if (!r?.found || r.escaped || !w) return [];
    const door = new Set((r.door ?? []).map(([x, z]) => `${x},${z}`));
    const cells = [];
    for (const [x, z] of r.inside) {
      if ((x === r.mat[0] && z === r.mat[2]) || door.has(`${x},${z}`)) continue;
      if (isSolid(w.get(x, r.f, z)) && w.get(x, r.f + 1, z) === B.AIR && w.get(x, r.f + 2, z) === B.AIR) cells.push({ x, y: r.f + 1, z });
    }
    return cells;
  }

  // A random free cell (not the one the player stands in), or null (T21's interface: creatures.env.homes()).
  spawnSpot(playerPos = this.game?.player?.pos) {
    const cells = this.freeCells().filter(c => !playerPos || Math.floor(playerPos.x) !== c.x || Math.floor(playerPos.z) !== c.z || Math.floor(playerPos.y) !== c.y);
    return cells.length ? cells[Math.floor(Math.random() * cells.length)] : null;
  }

  // n free cells, furthest from the door first (T23: where the leader and assistant stand).
  standSpots(n) {
    const door = this.report?.door?.[0] ?? [this.x, this.z];
    return this.freeCells()
      .sort((a, b) => Math.hypot(b.x - door[0], b.z - door[1]) - Math.hypot(a.x - door[0], a.z - door[1]))
      .slice(0, n);
  }

  toSave() { return { owner: this.owner, name: this.name, x: this.x, y: this.y, z: this.z, type: this.type }; }
}

/* ------------------------------ HomeManager ------------------------------ */

export class HomeManager {
  constructor(game) {
    this.game = game;
    this.world = null;
    this.list = [];            // every Home in this world
    this.worldOwner = null;    // owner id of the world (you in your own world, the host while visiting)
    this.active = null;        // the Home whose meter and glow show (or null)
    this.onMat = null;         // the Home whose Doormat you stand on (or null)
    this.matPos = null;        // [x, y, z] of ANY Doormat you stand on (also one with no record: an orphan)
    this.checks = 0;           // how many re-checks ran (for tests)
    this.dirty = new Set();    // homes to re-check
    this.since = 0;            // seconds since the last re-check
    this.listeners = [];
  }

  get playerId() { return this.game.playerId; }

  // A new world: no homes, hooks world.onEdit.
  reset(world) {
    this.world = world;
    this.list = [];
    this.active = null; this.onMat = null; this.matPos = null;
    this.dirty.clear();
    this.worldOwner = this.playerId ?? null;
    world.onEdit = (x, y, z, old, id) => this.onEdit(x, y, z, old, id);
  }

  // Records from a save or from the host. Bad ones are dropped (see plans/T22.md section 4). `worldOwner`: the world's owner id.
  load(records, worldOwner) {
    this.list = []; this.active = null; this.onMat = null; this.matPos = null; this.dirty.clear();
    this.worldOwner = worldOwner ?? this.playerId ?? null;
    for (const rec of Array.isArray(records) ? records : []) {
      const home = this.valid(rec);
      if (!home) continue;
      this.list = this.list.filter(h => h.owner !== home.owner && !(h.x === home.x && h.y === home.y && h.z === home.z)); // one per owner and per mat, the last wins
      this.list.push(home);
    }
    for (const h of this.list) { h.check(this.world); this.checks++; }
  }

  // A Home from a record if it is sane and sits on a Doormat, else null.
  valid(rec) {
    const w = this.world;
    if (!rec || typeof rec !== 'object' || typeof rec.owner !== 'string' || !w) return null;
    const { x, y, z } = rec;
    if (![x, y, z].every(Number.isInteger) || !w.inBounds(x, y, z) || w.get(x, y, z) !== B.DOORMAT) return null;
    return new Home({ owner: rec.owner, name: typeof rec.name === 'string' ? rec.name.slice(0, 24) : '', x, y, z, type: HOME_TYPES[rec.type] ? rec.type : null }, this.game);
  }

  findRoom(x, y, z) { return findRoom(this.world, x, y, z); } // the room around a Doormat cell (specs)

  toSave() { return this.list.map(h => h.toSave()); }

  mine() { return this.list.find(h => h.owner === this.playerId) ?? null; }
  at(x, y, z) { return this.list.find(h => h.x === x && h.y === y && h.z === z) ?? null; }
  worldOwnerHome() { return this.list.find(h => h.owner === this.worldOwner) ?? null; }
  ready() { return this.list.filter(h => h.finished); } // creatures.env.homes()

  // What the chooser would change: the Home on the mat you stand on, or its [x, y, z] when it is an orphan.
  chooseTarget() { return this.onMat ?? this.matPos; }

  onChange(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }
  emit(home, what) { for (const fn of this.listeners) fn(home, what); }

  send(home) { this.game.mp?.sendHome(home.toSave()); }
  say(text) { this.game.ui?.toast(text); }
  near(home, range = TOAST_RANGE) {
    const p = this.game.player?.pos;
    return !!p && Math.hypot(p.x - home.x, p.z - home.z) <= range;
  }

  // You placed a Doormat at (x, y, z): your home moves here (the old mat turns into Planks), and it is sent to everyone.
  place(x, y, z) {
    const w = this.world, old = this.mine();
    const name = this.game.mp?.name ?? '';
    let home = this.at(x, y, z);
    if (home && home.owner !== this.playerId) return home; // somebody's mat is already here
    let what = 'placed';
    if (old && old !== home) {
      this.list = this.list.filter(h => h !== old);
      if (w.get(old.x, old.y, old.z) === B.DOORMAT) {
        w.set(old.x, old.y, old.z, B.PLANKS);
        this.game.mp?.sendBlock(old.x, old.y, old.z, B.PLANKS);
      }
      what = 'moved';
    }
    home = new Home({ owner: this.playerId, name, x, y, z, type: old?.type ?? null }, this.game);
    this.list.push(home);
    home.check(w); this.checks++;
    this.active = home;
    this.send(home);
    this.say(what === 'moved' ? 'Your home moved here!' : 'A Doormat! Stand on it to choose what kind of home to make.');
    this.emit(home, what);
    return home;
  }

  // `target`: a Home or [x, y, z] of a Doormat. Claims an orphan mat; only the owner changes an owned home.
  choose(target, type) {
    if (!HOME_TYPES[type]) return false;
    let home = target instanceof Home ? target : this.at(...target);
    if (!home) {
      const [x, y, z] = target;
      if (this.world.get(x, y, z) !== B.DOORMAT) return false;
      const old = this.mine();
      if (old) this.list = this.list.filter(h => h !== old); // one home per owner: the old mat stays as it is
      home = new Home({ owner: this.playerId, name: this.game.mp?.name ?? '', x, y, z, type: null }, this.game);
      this.list.push(home);
    } else if (home.owner !== this.playerId) return false;
    home.type = type;
    home.check(this.world); this.checks++;
    this.active = home;
    if (this.matPos && this.matPos[0] === home.x && this.matPos[1] === home.y && this.matPos[2] === home.z) this.onMat = home;
    this.send(home);
    this.emit(home, 'type');
    this.announce(home, false);
    return true;
  }

  // A 'home' message: replaces that owner's record (or the record at that spot).
  apply(rec) {
    const home = this.valid(rec);
    if (!home) return null;
    const gone = this.list.filter(h => h.owner === home.owner || (h.x === home.x && h.y === home.y && h.z === home.z));
    const before = gone.find(h => h.owner === home.owner);
    this.list = this.list.filter(h => !gone.includes(h));
    this.list.push(home);
    home.check(this.world); this.checks++;
    if (gone.includes(this.active)) this.active = home.owner === this.playerId ? home : null;
    if (gone.includes(this.onMat)) this.onMat = home;
    this.emit(home, before ? (before.type !== home.type ? 'type' : 'moved') : 'placed');
    return home;
  }

  // From World.set: a Doormat gone means its home is gone; edits inside a home's box mark it for a re-check.
  onEdit(x, y, z, old, id) {
    if (old === B.DOORMAT && id !== B.DOORMAT) {
      const home = this.at(x, y, z);
      if (home) {
        this.list = this.list.filter(h => h !== home);
        this.dirty.delete(home);
        if (this.active === home) this.active = null;
        if (this.onMat === home) this.onMat = null;
        if (home.owner === this.playerId) this.say('No doormat, no home! Put a Doormat down to make a home.');
        this.emit(home, 'removed');
      }
    }
    for (const h of this.list) {
      if (Math.abs(x - h.x) <= 23 && Math.abs(z - h.z) <= 23 && y >= h.y - 1 && y <= h.y + 13) this.dirty.add(h);
    }
  }

  // Every frame: re-check dirty homes (at most every 0.25 s), end `active` when you walk away.
  update(dt, pos) {
    this.since += dt;
    if (this.dirty.size && this.since >= RECHECK) {
      this.since = 0;
      for (const h of [...this.dirty]) {
        this.dirty.delete(h);
        if (!this.list.includes(h)) continue;
        const was = h.finished;
        h.check(this.world); this.checks++;
        if (was !== h.finished) { this.emit(h, h.finished ? 'finished' : 'unfinished'); this.announce(h, true); }
        else this.emit(h, 'checked');
      }
    }
    const a = this.active;
    if (a && pos && Math.hypot(pos.x - a.x, pos.z - a.z) > ACTIVE_RANGE) this.active = null;
  }

  // Toasts for your own home when it becomes ready or stops being ready.
  announce(home, changed) {
    if (home.owner !== this.playerId || !this.near(home)) return;
    const t = home.homeType;
    if (home.finished && t) {
      this.say(`Your ${t.name} is ready! ${t.name.split(' ')[0]} creatures may come to visit.`);
      sound.play('doorchime');
    } else if (changed && t) this.say('Your home needs fixing. Stand on the Doormat to see what is missing.');
  }

  // Called every frame the player stands on the ground, with the block under the feet. Returns true when the home
  // chooser should open (you just stepped on a Doormat that is new, or yours without a type): main.js opens it.
  stand(x, y, z, id) {
    if (id !== B.DOORMAT) { this.onMat = null; this.matPos = null; return false; }
    if (this.matPos && this.matPos[0] === x && this.matPos[1] === y && this.matPos[2] === z) return false;
    this.matPos = [x, y, z];
    this.onMat = this.at(x, y, z);
    if (this.onMat) this.active = this.onMat;
    return !this.onMat || (this.onMat.type === null && this.onMat.owner === this.playerId);
  }
}
