// T19 Firewall Maze (Cyber gym, slot 2): the three laser rooms are solvable (and trap-free), switches and reset
// buttons work, lasers never turn on inside you and are never an edit, the trainers and the leader can be beaten,
// and a tablet can tap the reset button. Screenshots: tests/screenshots/t19-maze-*.png
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, newGame, playBattle, waitFor, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// Helpers living in the page (window.fw): world cells of the maze, a walk search over standing cells.
const INSTALL = async () => {
  const { B } = await import('/src/blocks.js');
  const F = await import('/src/firewall.js');
  const fw = window.fw = {};
  fw.B = B; fw.F = F;
  fw.gym = w => w.gyms.find(g => g.def.id === 'cyber');
  fw.cell = (g, k, r, c) => { const [d, s] = F.ROOM_AT[k](r, c); return F.mazeCol(g, d, s); };
  // Can you walk (4 directions, flat) from room k's entry cell to its exit cell right now?
  fw.walk = (w, g, k, from = [0, 5], to = [8, 5]) => {
    const fy = g.fy, ok = (x, z) => !w.isSolid(x, fy + 1, z) && !w.isSolid(x, fy + 2, z) && w.isSolid(x, fy, z);
    const box = g.rooms[k].box;
    const inRoom = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
    const [sx, sz] = fw.cell(g, k, ...from), [ex, ez] = fw.cell(g, k, ...to);
    const seen = new Set([sx + ',' + sz]), st = [[sx, sz]];
    while (st.length) {
      const [x, z] = st.pop();
      if (x === ex && z === ez) return true;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + a, nz = z + b;
        if (!inRoom(nx, nz) || seen.has(nx + ',' + nz) || !ok(nx, nz)) continue;
        seen.add(nx + ',' + nz); st.push([nx, nz]);
      }
    }
    return false;
  };
  // T23.5: can you walk from local (d, s) out to the front of the gym (d 12) right now, alone?
  fw.out = (w, g, [fd, fs]) => {
    const fy = g.fy, ok = (x, z) => !w.isSolid(x, fy + 1, z) && !w.isSolid(x, fy + 2, z) && w.isSolid(x, fy, z);
    const loc = new Map();
    for (let d = -16; d <= 12; d++) for (let s = -20; s <= 20; s++) { const [x, z] = F.mazeCol(g, d, s); loc.set(x + ',' + z, d); }
    const [sx, sz] = F.mazeCol(g, fd, fs);
    const seen = new Set([sx + ',' + sz]), st = [[sx, sz]];
    while (st.length) {
      const [x, z] = st.pop();
      if (loc.get(x + ',' + z) === 12) return true;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + a, nz = z + b, k = nx + ',' + nz;
        if (!loc.has(k) || seen.has(k) || !ok(nx, nz)) continue;
        seen.add(k); st.push([nx, nz]);
      }
    }
    return false;
  };
  fw.exitShut = (w, g) => g.exit.every(([x, y, z]) => w.isSolid(x, y, z));
};

const SEQ = [[['r', 2, 2]], [['r', 2, 7], ['b', 5, 1]], [['r', 1, 7], ['b', 4, 4], ['r', 4, 0]]]; // switches to press, room by room

export default async function ({ browser, base, t }) {
  // 1. The room grids: solvable, the fewest presses 1 / 2 / 3, no trap, and the friend lane solves each with no switch.
  const page = await openGame(browser, base);
  await newGame(page, 1);
  const grids = await page.evaluate(async () => {
    const { ROOMS, solveRoom } = await import('/src/firewall.js');
    return ROOMS.map(r => ({ plain: solveRoom(r), friend: solveRoom(r, { friend: true }), w: r[0].length, h: r.length }));
  });
  t.ok(grids.every(g => g.w === 11 && g.h === 9), 'every room is 11 columns by 9 rows');
  t.ok(grids.map(g => g.plain.presses).join() === '1,2,3' && grids.every(g => g.plain.solvable && !g.plain.trap), 'rooms need 1, 2 and 3 switch presses, and none has a trap');
  t.ok(grids.every(g => g.friend.solvable && g.friend.presses === 0 && !g.friend.trap), 'with the friend lane open each room needs no switch');
  // T23.5: walking back alone. Room 1 lets you out in the state you leave it in; rooms 2 and 3 are traps that way,
  // so the server room has its own exit (checked in the live game below).
  const back = await page.evaluate(async () => {
    const { ROOMS, solveRoom } = await import('/src/firewall.js');
    return ROOMS.map(r => [0, 1].map(phase => solveRoom(r, { back: true, phase })));
  });
  t.ok(back[0][1].solvable && back.every(r => r.every(x => typeof x.trap === 'boolean')), `backwards check runs; room 1 can be walked back (${JSON.stringify(back.map(r => r.map(x => x.solvable && !x.trap)))})`);

  // 2. Placement on three seeds: inside slot 2's box, protected, lasers in their start state, nothing recorded as an edit.
  const placed = await page.evaluate(async seeds => {
    const { World } = await import('/src/world.js');
    const { B } = await import('/src/blocks.js');
    const { ROOM_AT, mazeCol } = await import('/src/firewall.js');
    const out = [];
    for (const seed of seeds) {
      const w = new World(seed, null, null);
      w.generate();
      const g = w.gyms.find(x => x.def.id === 'cyber'), s = g.slot, b = s.box;
      const inBox = (x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
      const p = g.protect[0];
      const solid = (x, y, z) => w.isSolid(x, y, z);
      const stand = ([x, y, z]) => !solid(Math.floor(x), Math.floor(y), Math.floor(z)) && !solid(Math.floor(x), Math.floor(y) + 1, Math.floor(z)) && solid(Math.floor(x), Math.floor(y) - 1, Math.floor(z));
      const cellsOk = g.rooms.every(r => r.red.every(([x, y, z]) => w.get(x, y, z) === B.LASER_RED && inBox(x, z))
        && r.blue.every(([x, y, z]) => w.get(x, y, z) === B.AIR) && r.friend.every(([x, y, z]) => w.get(x, y, z) === B.LASER_FRIEND));
      const inP = ([x, y, z]) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && y >= p.y0 && y <= p.y1;
      const everything = g.rooms.every(r => [...r.red, ...r.blue, ...r.friend, r.reset].every(inP) && [...r.switches.keys()].every(k => inP(k.split(',').map(Number))));
      const cnt = g.rooms.map(r => [r.red.length, r.blue.length, r.friend.length]);
      const people = [g.leaderPos, ...g.trainerPositions].every(stand);
      // each room: entry blocked in the start state is checked in the live game; here the doors are open (1 wide, 3 tall)
      const door = (k, r, c, dd) => { const [d, sd] = ROOM_AT[k](r, c); const [x, z] = mazeCol(g, d + dd, sd); return [1, 2, 3].every(h => !solid(x, g.fy + h, z)); };
      const doorsOk = door(0, 0, 5, 1) && door(0, 8, 5, -1) && door(1, 0, 5, -1) && door(1, 8, 5, 1) && door(2, 0, 5, 1) && door(2, 8, 5, -1);
      const entrance = [-13, -12, -11].every(s => { const [ex, ez] = mazeCol(g, 10, s); return [1, 2, 3].every(h => !solid(ex, g.fy + h, ez)); });
      const roofAt = (d, s) => { const [rx, rz] = mazeCol(g, d, s); return solid(rx, g.fy + 5, rz); };
      out.push({ seed, slot: s.k === 2, inBox: inBox(p.x0, p.z0) && inBox(p.x1, p.z1) && p.y0 === 1, cellsOk, everything, cnt, people, doorsOk, entrance,
        edits: w.edits.size, area: !!g.area, fy: g.fy, roof: roofAt(0, 0) && roofAt(8, -12) && roofAt(-11, 12) });
    }
    return out;
  }, [1, 4242, 777]);
  for (const p of placed) {
    t.ok(p.slot && p.inBox && p.cellsOk && p.everything && p.people && p.doorsOk && p.entrance && p.area && p.edits === 0 && p.roof,
      `seed ${p.seed}: the maze is in slot 2, protected, lasers start red-on, doors and people fit, no edits ${JSON.stringify(p)}`);
  }

  // 3. In the live game: rooms are blocked at the start, the switches open them in order, a reset puts them back.
  await page.evaluate(INSTALL);
  const setup = await page.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('titanox', 70), makeCreature('glacieron', 70)];
    document.exitPointerLock();
    const gym = window.fw.gym(g.world);
    const [x, z] = window.fw.F.mazeCol(gym, 14, 0);
    g.player.pos.set(x + 0.5, g.world.surface(x, z).y + 1, z + 0.5);
    g.player.vel.set(0, 0, 0);
    g.time = 0.25;
    return { fy: gym.fy };
  });
  t.ok(setup.fy > 0, 'the game has a Firewall Maze');
  const rooms = [];
  for (let k = 0; k < 3; k++) {
    const r = await page.evaluate(async ([k, seq]) => {
      const g = window.pokecraft, w = g.world, gym = window.fw.gym(w), { B } = window.fw, fy = gym.fy;
      const log = { before: window.fw.walk(w, gym, k), steps: [], ids: [] };
      let at = [0, 5]; // where the player is: the entry, then the last switch pressed
      for (const [kind, rr, cc] of seq) {
        const [x, z] = window.fw.cell(gym, k, rr, cc);
        log.steps.push(window.fw.walk(w, gym, k, at, [rr, cc])); // the next switch can be reached from here right now
        at = [rr, cc];
        const id = w.get(x, fy, z);
        log.right = (log.right ?? true) && id === (kind === 'r' ? B.SWITCH_RED : B.SWITCH_BLUE);
        g.gymLive.stand(x, fy, z, id);
        log.ids.push([w.get(...gym.rooms[k].red[0]), gym.rooms[k].blue.length ? w.get(...gym.rooms[k].blue[0]) : null]);
      }
      log.after = window.fw.walk(w, gym, k, at);
      return log;
    }, [k, SEQ[k]]);
    rooms.push(r);
    t.ok(!r.before, `room ${k + 1}: blocked at the start`);
    t.ok(r.steps.every(Boolean) && r.right, `room ${k + 1}: each switch can be reached in turn`);
    t.ok(r.after, `room ${k + 1}: open after ${SEQ[k].length} press${SEQ[k].length > 1 ? 'es' : ''}`);
  }
  const ids = await page.evaluate(() => { const { B } = window.fw; return { red: B.LASER_RED, blue: B.LASER_BLUE, air: B.AIR }; });
  t.ok(rooms[0].ids[0][0] === ids.air && rooms[0].ids[0][1] === ids.blue, 'room 1: after the red switch the red lasers are off and the blue ones on');
  t.ok(rooms[2].ids[1][0] === ids.red && rooms[2].ids[1][1] === ids.air, 'room 3: the blue switch turns the red lasers back on and the blue ones off');
  t.ok(await page.evaluate(() => window.pokecraft.world.edits.size === 0), 'switches change no saved block (no edits)');

  // Reset buttons, with the prompt, and a laser never turning on inside the player.
  const reset = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = window.fw.gym(w), { B } = window.fw, fy = gym.fy;
    const room = gym.rooms[0], [rx, ry, rz] = room.reset;
    const block = { x: rx, y: ry, z: rz, id: w.get(rx, ry, rz), normal: [0, 1, 0] };
    const out = { id: block.id === B.RESET_BUTTON, prompt: g.gymLive.prompt(block, 'tap'), other: g.gymLive.prompt({ x: rx + 50, y: 5, z: rz, id: 1 }, 'tap') };
    const [sx, sz] = window.fw.cell(gym, 0, 2, 2);
    g.gymLive.stand(sx, fy, sz, w.get(sx, fy, sz)); // red switch: red off
    out.off = w.get(...room.red[0]) === B.AIR;
    // stand inside a red laser cell while red is off, then reset
    const [lx, ly, lz] = room.red[0];
    g.player.pos.set(lx + 0.5, fy + 1, lz + 0.5); g.player.vel.set(0, 0, 0);
    out.hit = g.gymLive.hit(block);
    out.toast = document.getElementById('toast').textContent;
    out.inside = w.get(lx, fy + 1, lz) === B.AIR; // still open: it never turns on inside you
    out.others = room.red.filter(([x, , z]) => !(x === lx && z === lz)).every(([x, y, z]) => w.get(x, y, z) === B.LASER_RED);
    out.cell = [lx, fy + 1, lz];
    return out;
  });
  t.ok(reset.id && reset.prompt === 'Reset button · tap to reset the room' && reset.other === null, `reset button has its prompt (${reset.prompt})`);
  t.ok(reset.off && reset.hit && /Room reset!/.test(reset.toast), 'hitting the reset button resets the room and says so');
  t.ok(reset.inside && reset.others, 'a laser does not turn on inside the player; the rest of the room did reset');
  await page.evaluate(([x, y, z]) => { const g = window.pokecraft; g.player.pos.set(x - 3.5, y, z + 0.5); }, reset.cell);
  await waitFor(page, ([x, y, z]) => window.pokecraft.world.get(x, y, z) === window.fw.B.LASER_RED, reset.cell, 60000);
  t.ok(true, 'it turns on as soon as the player steps out');

  // Lasers and rooms can't be changed; nothing maze-shaped is saved.
  await page.waitForTimeout(2100);
  const prot = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, gym = window.fw.gym(w), { B } = window.fw, fy = gym.fy;
    const [lx, ly, lz] = gym.rooms[0].red[0];
    const before = w.edits.size;
    g.breakBlock({ x: lx, y: ly, z: lz, id: B.LASER_RED, normal: [0, 1, 0] });
    const toast = document.getElementById('toast').textContent;
    const kept = w.get(lx, ly, lz) === B.LASER_RED;
    const [fx, fz] = window.fw.cell(gym, 1, 4, 4);
    g.hotbar[g.selected] = B.STONE;
    g.placeBlock({ x: fx, y: fy, z: fz, id: w.get(fx, fy, fz), normal: [0, 1, 0] });
    const placed = w.get(fx, fy + 1, fz);
    g.save();
    const save = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    return { toast, kept, same: w.edits.size === before, placed, saved: Object.keys(save.edits || {}).length };
  });
  t.ok(prot.kept && prot.same && /Lasers can't be broken/.test(prot.toast), `breaking a laser changes nothing and says why (${prot.toast})`);
  t.ok(prot.placed === 0 && prot.same && prot.saved === 0, 'building inside a maze room is refused, and the save holds no maze block');

  // T23.5: the exit door. Shut from outside (not a way in), open from inside the server room, and you can walk out alone.
  const exitA = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = window.fw.gym(w), M = window.fw.F.mazeCol, fy = gym.fy;
    const out = { shut: window.fw.exitShut(w, gym), noWayIn: !window.fw.out(w, gym, [-11, 12]) };
    const [x, z] = M(gym, -9, 15);
    g.player.pos.set(x + 0.5, fy + 1, z + 0.5); g.player.vel.set(0, 0, 0);
    return out;
  });
  t.ok(exitA.shut, 'the exit door is shut for a player outside without the badge');
  t.ok(exitA.noWayIn, 'with the door shut the server room cannot be reached from the front without the rooms');
  await waitFor(page, () => { const g = window.pokecraft; return !window.fw.exitShut(g.world, window.fw.gym(g.world)); }, null, 60000);
  const exitB = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, gym = window.fw.gym(w);
    return { toast: document.getElementById('toast').textContent, out: window.fw.out(w, gym, [-11, 12]), edits: w.edits.size };
  });
  t.ok(/this way out/.test(exitB.toast), `standing in the server room opens the exit and says so (${exitB.toast})`);
  t.ok(exitB.out && exitB.edits === 0, 'from the server room you can walk out to the front alone; the door is no edit');
  await page.evaluate(() => { const g = window.pokecraft, gym = window.fw.gym(g.world), [x, z] = window.fw.F.mazeCol(gym, -9, 21); g.player.pos.set(x + 0.5, gym.fy + 1, z + 0.5); g.player.vel.set(0, 0, 0); });
  await waitFor(page, () => { const g = window.pokecraft; return window.fw.exitShut(g.world, window.fw.gym(g.world)); }, null, 60000);
  t.ok(true, 'the exit door shuts again once you are out (no badge yet)');

  // 4. The people: both trainers, then the leader, then the badge.
  const who = async (i, kind) => page.evaluate(async ([i, kind]) => {
    const g = window.pokecraft, gym = window.fw.gym(g.world);
    const npc = g.npcs.list.find(n => n.gym === gym && (kind === 'leader' ? n.kind === 'leader' : n.kind === 'trainer' && n.index === i));
    const p = npc.model.position;
    g.player.pos.set(p.x + 1.5, gym.y, p.z); // inside the maze, next to them
    g.player.vel.set(0, 0, 0);
    g.talkTo(npc);
    return { name: npc.name, inBattle: g.inBattle, toast: document.getElementById('toast').textContent };
  }, [i, kind]);
  const early = await who(0, 'leader');
  t.ok(!early.inBattle && /Beat .* first/.test(early.toast), `the leader waits for both trainers (${early.toast})`);
  for (const i of [0, 1]) {
    const r = await who(i, 'trainer');
    t.ok(r.inBattle, `${r.name} battles`);
    t.ok(await playBattle(page), `${r.name}'s battle finishes`);
  }
  const lead = await who(0, 'leader');
  t.ok(lead.inBattle, `${lead.name} battles after both trainers`);
  t.ok(await playBattle(page), `${lead.name}'s battle finishes`);
  const done = await page.evaluate(() => ({ badges: window.pokecraft.badges, beaten: window.pokecraft.beaten }));
  t.ok(done.badges.includes('cyber') && done.beaten.includes('cyber:trainer') && done.beaten.includes('cyber:trainer2'), 'Circuit Badge awarded');
  // T23.5: after beating the leader, walk out alone from the leader's spot, whatever state the laser rooms are in.
  await page.evaluate(() => { const g = window.pokecraft, gym = window.fw.gym(g.world); for (const r of gym.rooms) g.gymLive.hit({ x: r.reset[0], y: r.reset[1], z: r.reset[2], id: window.fw.B.RESET_BUTTON }); const [x, , z] = gym.leaderPos; g.player.pos.set(x + 1.5, gym.fy + 1, z); g.player.vel.set(0, 0, 0); });
  await waitFor(page, () => { const g = window.pokecraft; return !window.fw.exitShut(g.world, window.fw.gym(g.world)); }, null, 60000);
  const leave = await page.evaluate(() => { const g = window.pokecraft, w = g.world, gym = window.fw.gym(w); return { out: window.fw.out(w, gym, [-11, 13]), back: [0, 1, 2].map(k => window.fw.walk(w, gym, k, [8, 5], [0, 5])) }; });
  t.ok(leave.out, `after beating the leader you can walk out alone through the exit (rooms back: ${leave.back})`);

  // 5. Screenshots: outside by day and night, each room from its entry, the server room.
  const shot = async (name, place) => {
    await page.evaluate(place);
    await page.waitForTimeout(4500);
    await page.evaluate(() => document.getElementById('pause').classList.add('hidden')); // the picture, not the menu (it can reappear)
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, name) });
    console.log(`  screenshot ${name}`);
  };
  const look = (d, s, y, tx, ty, tz) => `(() => {
    const g = window.pokecraft, w = g.world, gym = window.fw.gym(w), M = window.fw.F.mazeCol, fy = gym.fy;
    document.exitPointerLock(); g.creatures.clear(); g.creatures.spawnTimer = 1e9;
    const [x, z] = M(gym, ${d}, ${s});
    g.player.pos.set(x + 0.5, ${y}, z + 0.5); g.player.vel.set(0, 0, 0);
    const [lx, lz] = M(gym, ${tx[0]}, ${tx[1]});
    g.player.lookAt({ x: lx + 0.5, y: ${ty}, z: lz + 0.5 });
  })()`;
  await page.evaluate(() => { window.pokecraft.time = 0.25; });
  await shot('t19-maze-outside.png', look(30, -6, 'w.surface(x, z).y + 6', [0, -2], 'fy + 2'));
  await page.evaluate(() => { window.pokecraft.time = 0.75; });
  await shot('t19-maze-outside-night.png', look(26, -8, 'w.surface(x, z).y + 4', [0, -2], 'fy + 2'));
  // room 1..3 from their entry cell (row 0, column 5), looking at the middle of the room; lasers in the start state
  await page.evaluate(() => { const g = window.pokecraft; g.gymLive.hit({ ...Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, window.fw.gym(g.world).rooms[0].reset[i]])), id: window.fw.B.RESET_BUTTON }); });
  for (let k = 0; k < 3; k++) {
    await page.evaluate(k => {
      const g = window.pokecraft, gym = window.fw.gym(g.world);
      g.gymLive.hit({ x: gym.rooms[k].reset[0], y: gym.rooms[k].reset[1], z: gym.rooms[k].reset[2], id: window.fw.B.RESET_BUTTON });
    }, k);
    await shot(`t19-maze-room${k + 1}.png`, `(() => {
      const g = window.pokecraft, gym = window.fw.gym(g.world), fy = gym.fy;
      document.exitPointerLock();
      const [x, z] = window.fw.cell(gym, ${k}, 0, 5), [cx, cz] = window.fw.cell(gym, ${k}, 6, 5);
      g.player.pos.set(x + 0.5, fy + 1, z + 0.5); g.player.vel.set(0, 0, 0);
      g.player.lookAt({ x: cx + 0.5, y: fy + 1.2, z: cz + 0.5 });
    })()`);
  }
  await shot('t19-maze-server.png', look(-5, 12, 'fy + 1', [-11, 12], 'fy + 2'));
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 6. A tablet taps the reset button (the tapAt path), after stepping on a switch.
  const pad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await pad.tap('text=New Game');
  await pad.tap('.starter >> nth=0');
  await pad.waitForTimeout(1500);
  await pad.evaluate(INSTALL);
  const tap = await pad.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = window.fw.gym(w), { B } = window.fw, fy = gym.fy;
    g.weather.set('clear'); g.time = 0.25; g.creatures.clear(); g.creatures.spawnTimer = 1e9;
    const [sx, sz] = window.fw.cell(gym, 0, 2, 2);
    g.gymLive.stand(sx, fy, sz, w.get(sx, fy, sz)); // red switch
    const off = w.get(...gym.rooms[0].red[0]) === B.AIR;
    // stand in the room next to the button (row 0, column 6) looking at it
    const [rx, ry, rz] = gym.rooms[0].reset, [px, pz] = window.fw.cell(gym, 0, 0, 6);
    g.player.pos.set(px + 0.5, fy + 1, pz + 0.5); g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: rx + 0.5, y: ry + 0.5, z: rz + 0.5 });
    return { off };
  });
  t.ok(tap.off, 'tablet: stepping on the red switch turned the red lasers off');
  await pad.waitForFunction(() => /Reset button/.test(document.getElementById('prompt').textContent), null, { timeout: 60000 }).catch(() => {});
  t.ok(await pad.evaluate(() => /Reset button · tap to reset the room/.test(document.getElementById('prompt').textContent)), 'tablet: looking at the button shows "tap to reset the room"');
  const spot = await pad.evaluate(() => {
    const g = window.pokecraft, gym = window.fw.gym(g.world), [rx, ry, rz] = gym.rooms[0].reset;
    const v = new (g.player.eyePos.constructor)(rx + 0.5, ry + 0.5, rz + 0.5).project(g.camera);
    return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight];
  });
  await pad.touchscreen.tap(spot[0], spot[1]);
  t.ok(await pad.evaluate(() => { const g = window.pokecraft, gym = window.fw.gym(g.world); return g.world.get(...gym.rooms[0].red[0]) === window.fw.B.LASER_RED && /Room reset!/.test(document.getElementById('toast').textContent); }), 'tablet: tapping the reset button resets the room');
  t.ok(!pad.errors.length, `tablet: no page errors ${pad.errors.join('; ')}`);
  await pad.context().close();
}
