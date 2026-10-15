// T16 gym access objects (src/access.js). A: the guide says exactly what it said before the refactor (golden file
// recorded on the old code with PC_GUIDE_RECORD=1). B: a test-only gym kind works without touching the guide.
// C: guide.js has no gym-kind checks left.
import fs from 'node:fs';
import { openGame, newGame } from '../helpers.mjs';

const GOLDEN = new URL('../fixtures/guide-golden.json', import.meta.url).pathname;
const RECORD = !!process.env.PC_GUIDE_RECORD;

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 1);
  await page.evaluate(() => { window.pokecraft.creatures.clear(); document.exitPointerLock(); });

  // ---- A: golden replay (synchronous inside the page, so the game loop can't call updateGuide in between) ----
  const steps = await page.evaluate(async () => {
    const g = window.pokecraft;
    const { World, WORLD_W } = await import('/src/world.js');
    const { GYMS } = await import('/src/gyms.js');
    const ids22 = GYMS.slice(0, 22).map(d => d.id), allIds = GYMS.map(d => d.id);
    const out = [];
    const saved = { world: g.world, toast: g.ui.toast, setGuide: g.ui.setGuide, badges: g.badges, champion: g.champion,
      time: g.time, night: g.night, pos: g.player.pos.clone(), yaw: g.player.yaw };
    const worlds = [1, 22, 122].map(seed => { const w = new World(seed, null, null); w.generate(); return [seed, w]; });
    let toasts = [], guide = '';
    try {
      g.ui.toast = m => { toasts.push(m); };
      g.ui.setGuide = m => { guide = m; };
      g.player.yaw = 0;
      for (const [seed, w] of worlds) {
        g.world = w;
        for (const mode of ['day', 'night']) {
          g.time = mode === 'day' ? 0.25 : 0.75; g.night = mode === 'night';
          const tag = `${seed}/${mode}`;
          const rec = (label, x, z, y) => {
            x = Math.min(221, Math.max(2, Math.round(x))); z = Math.min(221, Math.max(2, Math.round(z)));
            g.player.pos.set(x + 0.5, y ?? w.surface(x, z).y + 1, z + 0.5);
            toasts = []; guide = '';
            g.updateGuide();
            out.push({ label: `${tag} ${label}`, guide, target: g.guideTarget, toasts });
          };
          const remaining = ids => { g.badges = allIds.filter(i => !ids.includes(i)); g.champion = false; };
          // 1. everything beaten
          g.badges = allIds.slice(); g.champion = true;
          rec('champion', 0.5, 60.5);
          // 2. every gym in turn
          for (const id of ids22) {
            const G = w.gyms.find(x => x.def.id === id);
            g.badges = w.gyms.slice(0, w.gyms.indexOf(G)).map(x => x.def.id); g.champion = false;
            const [fx, fz] = G.front;
            rec(`${id} spawn`, 112, 112);
            for (const d of [40, 12, 6]) rec(`${id} front${d}`, G.x + fx * d, G.z + fz * d);
            rec(`${id} centre`, G.x, G.z, G.y);
            if (G.cave) {
              const [mx, , mz] = G.cave.mouth;
              rec(`${id} mouth`, mx, mz, w.ground[mx + mz * WORLD_W] + 1);
              rec(`${id} out30`, mx - fx * 30, mz - fz * 30);
              const d = 16, tread = G.y - 1 + Math.floor((d - 9) / G.cave.spot.rise);
              rec(`${id} stairs`, G.x + fx * d, G.z + fz * d, tread + 1);
              rec(`${id} d10`, G.x + fx * 10, G.z + fz * 10, G.y);
              rec(`${id} hill`, G.x, G.z);
            }
            if (G.sky) {
              rec(`${id} behind4`, G.x - fx * 4, G.z - fz * 4);
              rec(`${id} pad`, G.pad[0], G.pad[2], G.pad[1] + 1);
              rec(`${id} island`, G.x, G.z, G.y);
              rec(`${id} h13`, G.x + fx * 13, G.z + fz * 13);
              rec(`${id} h26`, G.x + fx * 26, G.z + fz * 26);
              rec(`${id} behind4b`, G.x - fx * 4, G.z - fz * 4);
            }
          }
          // 3. night gyms skipped by day
          for (const rest of [['cosmic', 'alien', 'light'], ['alien', 'light'], ['cosmic', 'alien'], ['cosmic'], ['alien']]) {
            remaining(rest);
            rec(`skip ${rest.join('+')}`, 112, 112);
          }
          // 4. the tower
          g.badges = allIds.slice(); g.champion = false;
          rec('tower spawn', 112, 112);
          rec('tower centre', w.tower.x, w.tower.z, w.tower.y);
          rec('tower spawn again', 112, 112);
          // 5. talking to people of the night gyms by day (closed: a toast only)
          if (mode === 'day') {
            for (const id of ['cosmic', 'alien']) {
              const G = w.gyms.find(x => x.def.id === id);
              g.player.pos.set(112.5, 60, 112.5);
              toasts = [];
              g.talkTo({ kind: 'trainer', name: 'T', gym: G });
              out.push({ label: `${tag} talk ${id}`, guide: '', target: null, toasts, battle: !!g.inBattle });
            }
          }
        }
      }
    } finally {
      g.world = saved.world; g.ui.toast = saved.toast; g.ui.setGuide = saved.setGuide; g.badges = saved.badges;
      g.champion = saved.champion; g.time = saved.time; g.night = saved.night; g.player.pos.copy(saved.pos); g.player.yaw = saved.yaw;
    }
    return out;
  });
  t.ok(steps.length > 300, `guide replay recorded ${steps.length} steps`);
  if (RECORD) {
    fs.mkdirSync(new URL('../fixtures/', import.meta.url).pathname, { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify(steps, null, 1) + '\n');
    console.log(`  recorded ${steps.length} steps to tests/fixtures/guide-golden.json`);
    await page.context().close();
    return;
  }
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  let bad = -1;
  for (let i = 0; i < Math.max(golden.length, steps.length); i++) {
    if (JSON.stringify(golden[i]) !== JSON.stringify(steps[i])) { bad = i; break; }
  }
  t.ok(bad < 0 && golden.length === steps.length,
    bad < 0 ? `the guide matches the golden file (${steps.length} steps)` : `first difference at step ${bad}: expected ${JSON.stringify(golden[bad])} got ${JSON.stringify(steps[bad])}`);

  // ---- B: a test-only access kind, no guide change ----
  const b = await page.evaluate(async () => {
    const g = window.pokecraft;
    const { WHERE, WHEN } = await import('/src/access.js');
    const { GYMS } = await import('/src/gyms.js');
    const allIds = GYMS.map(d => d.id);
    const def = GYMS.find(d => d.id === 'light');
    const G = g.world.gyms.find(x => x.def.id === 'light');
    const saved = { toast: g.ui.toast, setGuide: g.ui.setGuide, badges: g.badges, champion: g.champion, pos: g.player.pos.clone() };
    const r = {};
    let toasts = [], guide = '';
    WHERE.beacon = gm => ({
      aim(p) {
        const x = gm.x + 3.5, z = gm.z + 0.5, h = Math.hypot(x - p.x, z - p.z);
        if (h > 20) return { x, z, text: (arrow, dist) => `Beacon ${gm.def.name} ${arrow} ${dist}m` };
        return { text: () => 'Beacon: hidden nearby' };
      },
      welcome: () => 'Beacon welcome',
    });
    WHEN.never = () => ({ wait: () => 'tomorrow', closedText: () => 'Beacon closed' });
    try {
      g.ui.toast = m => { toasts.push(m); };
      g.ui.setGuide = m => { guide = m; };
      const rem = ids => { g.badges = allIds.filter(i => !ids.includes(i)); g.champion = false; };
      const at = (x, z, y) => { g.player.pos.set(x, y, z); toasts = []; g.updateGuide(); return { guide, target: g.guideTarget, toasts: toasts.slice() }; };
      def.access = { where: 'beacon', when: 'never' };
      g.access.forget();
      rem(['light', 'paper']);
      r.both = at(112.5, 112.5, 60);
      rem(['light']);
      r.far = at(112.5, 112.5, 60);
      r.beacon = [G.x + 3.5, G.z + 0.5];
      r.near = at(G.x + 8.5, G.z + 0.5, 60);
      at(112.5, 112.5, 60);
      r.inside = at(G.x + 0.5, G.z + 0.5, G.y);
      // talking: closed, no battle
      toasts = [];
      g.talkTo(g.npcs.list.find(n => n.kind === 'trainer' && n.gym.def.id === 'light'));
      r.talk = toasts.slice(); r.battle = !!g.inBattle;
      // open it: walking in shows the kind's own welcome
      def.access = { where: 'beacon', when: 'always' };
      g.access.forget();
      at(112.5, 112.5, 60);
      r.welcome = at(G.x + 0.5, G.z + 0.5, G.y).toasts;
    } finally {
      delete def.access; delete WHERE.beacon; delete WHEN.never; g.access.forget();
      g.ui.toast = saved.toast; g.ui.setGuide = saved.setGuide; g.badges = saved.badges; g.champion = saved.champion; g.player.pos.copy(saved.pos);
    }
    return r;
  });
  t.ok(b.both.guide.startsWith('Next: Origami Gym') && b.both.guide.endsWith(' · Sunbeam Gym opens tomorrow'), `a closed kind is skipped and named (${b.both.guide})`);
  t.ok(b.far.guide.startsWith('Beacon Sunbeam Gym') && b.far.guide.endsWith(' (opens tomorrow)') && b.far.target[0] === b.beacon[0] && b.far.target[1] === b.beacon[1], `the new kind aims at its own point (${b.far.guide})`);
  t.ok(b.near.guide === 'Beacon: hidden nearby (opens tomorrow)' && b.near.target === null, `close by there is no arrow (${b.near.guide})`);
  t.ok(b.inside.toasts.includes('Beacon closed'), 'walking in says the kind is closed');
  t.ok(b.talk.includes('Beacon closed') && !b.battle, 'talking to its trainer says the kind is closed, no battle');
  t.ok(b.welcome.includes('Beacon welcome'), "when open, walking in shows the kind's welcome");

  // ---- C: the guide has no gym-kind checks ----
  const src = await page.evaluate(() => fetch('/src/guide.js').then(r => r.text()));
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/world\.tower/g, '');
  const kind = code.match(/\.(sky|cave|night|nightText|pad|padColor|front|mouth|saucer|place|tower|ground)\b/);
  const defs = [...code.matchAll(/def\.(\w+)/g)].map(m => m[1]).filter(n => n !== 'id');
  t.ok(!kind && !defs.length, `guide.js asks nothing about kinds of gyms (${kind ? kind[0] : ''}${defs.join()})`);
  t.ok(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`);
  await page.context().close();
}
