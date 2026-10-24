// T29: the Champion missions panel (#missions, opened with M, from the chip, or by talking to Champion Solenne) and the HUD chip.
// Contract: missionUi.open(mode) mode = 'desk' | 'view' (called by ui.openPanel('missions') AFTER #missions is shown),
// close() (ui.closePanel always calls it), refresh(), setChip(). missionUi.want = the mode game.openMissions(mode) asked for.
import { BLOCKS, drawBlockIcon } from './blocks.js';
import { spotOf, clueOf, drawMap } from './treasuremap.js';
import { buildOf } from './buildcheck.js';
import { MISSIONS } from './missions.js';
import { spotIndex, aType, ROUND_LEN, isGenId } from './missiongen.js'; // T38c
import { GYMS } from './gyms.js';
import { SPECIES } from './species.js';
import { spawnInfo, typeLink } from './book.js';
import { portrait } from './ui.js';
import { el } from './util.js';

const TILE = 16; // pixels per atlas tile (blocks.js)
const COOP_RANGE = 16;
const KIND_LINE = { map: 'Treasure map', build: 'Build challenge', boss: 'Giant battle (2 players)', catch: 'Catch a creature', rematch: 'Gym rematch' };
const KIND_ICON = { map: '🗺', build: '🏗', boss: '👥', catch: '✨', rematch: '🏅' };

export function createMissionUi(game, { atlas }) {
  const body = () => document.getElementById('missions-body');
  const touch = () => document.body.classList.contains('touch');
  let mode = null; // 'desk' | 'view' while the panel is open
  const colors = new Map();

  // Average colour of a block's top tile in the atlas.
  function colorOf(id) {
    if (colors.has(id)) return colors.get(id);
    let col = [128, 128, 128];
    try {
      const def = BLOCKS[id];
      const d = atlas.getContext('2d').getImageData(def.top * TILE, 0, TILE, TILE).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      if (n) col = [r / n, g / n, b / n];
    } catch { /* keep grey */ }
    colors.set(id, col);
    return col;
  }

  /* --------------------------------- chip --------------------------------- */

  const chip = el('div', { id: 'mission-chip', class: 'hidden', title: 'Champion missions (M)' });
  chip.addEventListener('pointerdown', e => e.stopPropagation());
  chip.addEventListener('click', e => { e.stopPropagation(); game.openMissions?.('view'); });
  document.getElementById('topright')?.append(chip);
  let chipKey = '';

  const gymOf = def => GYMS.find(g => g.id === def.gym);
  const leaderOf = def => `Leader ${gymOf(def)?.leader?.name || ''}`.trim();

  function nearbyFriend() {
    if (!game.mp?.active) return null;
    for (const a of game.mp.others.values()) if (a.pos.distanceTo(game.player.pos) <= COOP_RANGE) return a;
    return null;
  }

  function chipText() {
    const ms = game.missions;
    if (!game.champion || !game.missionState) return null;
    const def = ms.active;
    if (!def) return null; // the guide arrow already leads to the tower (owner 2026-10-25: fewer signs)
    if ((def.kind === 'map' || def.kind === 'build') && game.world.realm) return { text: `${def.name} · back home first`, icon: KIND_ICON[def.kind] }; // T38c
    if (def.kind === 'catch') return { text: `Catch ${aType(def.type)} creature`, icon: '✨' }; // T38c
    if (def.kind === 'rematch') return { text: `${def.name} · beat ${leaderOf(def)}`, icon: '🏅' }; // T38c
    if (def.kind === 'map') {
      const h = ms.hint;
      return { text: h ? `${def.name} · ${h.word}` : def.name, icon: '🗺', pulse: h?.period };
    }
    if (def.kind === 'build') {
      const r = ms.result;
      const f = r?.features.find(x => !x.done);
      return { text: `${def.name}${r ? ` · ${f ? `${f.have}/${f.need} ${f.name}` : '✓'}` : ''}`, icon: '🏗' };
    }
    const f = nearbyFriend();
    return { text: `${def.name} · ${f ? (touch() ? 'tap to ask' : `ask ${f.name} (M)`) : 'bring a friend'}`, icon: '👥' };
  }

  function setChip() {
    const t = chipText();
    const key = t ? `${t.icon || ''}|${t.text}|${t.pulse ? t.pulse.toFixed(1) : ''}` : '';
    if (key === chipKey) return;
    chipKey = key;
    chip.classList.toggle('hidden', !t);
    if (!t) return;
    chip.replaceChildren();
    if (t.icon) chip.append(el('span', { class: 'mc-icon', style: t.pulse ? `--pulse:${t.pulse.toFixed(1)}s` : '' }, t.icon), ' ');
    chip.append(t.text);
  }

  /* -------------------------------- panel --------------------------------- */

  const btn = (text, onclick, cls = '') => el('button', { class: `mbtn ${cls}`.trim(), onclick }, text);

  function mapCard(def) {
    if (game.world.realm) return el('p', { class: 'warn' }, 'The treasure is back home in our world. Wake up first!'); // T38c
    const spot = spotOf(game.world, spotIndex(def));
    if (!spot) return el('p', {}, 'This map is blank. Try a different mission!');
    const canvas = el('canvas', { class: 'map', width: 164, height: 164 });
    drawMap(canvas, game.world, spot, colorOf);
    const clue = clueOf(game.world, spot);
    const h = game.missions.hint;
    return el('div', { class: 'mission-map' }, canvas,
      el('div', { class: 'clue' }, clue.lines.map(l => el('p', {}, l)),
        el('p', { class: 'hot' }, h ? `Right now: ${h.word}` : '')));
  }

  function examplePic(build) {
    const blocks = build.example.filter(b => BLOCKS[b[3]]);
    const w = Math.max(...blocks.map(b => b[0])) + 1, h = Math.max(...blocks.map(b => b[1])) + 1, cell = Math.min(24, Math.floor(260 / w));
    const c = el('canvas', { class: 'example', width: w * cell, height: h * cell });
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (const b of [...blocks].sort((a, z) => z[2] - a[2])) {
      const icon = drawBlockIcon(atlas, b[3], cell * 1.3);
      g.drawImage(icon, b[0] * cell - cell * 0.15, (h - 1 - b[1]) * cell - cell * 0.15, cell * 1.3, cell * 1.3);
    }
    return c;
  }

  function buildCard(def) {
    const b = buildOf(def), ms = game.missions;
    const lines = (ms.result?.features || b.features.map(f => ({ ...f, done: false, have: 0, need: f.check({}).need }))).map(f =>
      el('li', { class: f.done ? 'ok' : '' }, `${f.done ? '✓' : '✗'} ${f.name}`, f.need > 1 ? ` (${f.have}/${f.need})` : ''));
    const away = game.world.realm ? el('p', { class: 'warn' }, 'Build it back home in our world!') : null; // T38c
    const stand = away || (ms.report && !ms.report.ok ? el('p', { class: 'warn' }, 'Stand right next to your build, then check again.') : null);
    const tip = b.tip && (game.blockCounts[75] || 0) < 3 ? el('p', { class: 'tip' }, b.tip) : null;
    return el('div', { class: 'mission-build' }, examplePic(b),
      el('div', { class: 'clue' }, el('p', {}, b.text), el('ul', { class: 'checks' }, lines), stand,
        tip,
        btn('Check my build', () => { game.missions.check(def); render(); }, 'primary')));
  }

  function bossCard(def) {
    const all = game.mp?.active ? [...game.mp.others.values()] : [];
    const near = all.filter(a => a.pos.distanceTo(game.player.pos) <= COOP_RANGE);
    const asks = near.map(a => btn(`Ask ${a.name} to help!`, () => {
      const c = game.coopFor?.(game, def.id, a);
      if (!c) game.ui.toast('Co-op battles are coming soon!');
      else if (c.error) game.ui.toast(c.error);
      else { game.closeMissions?.(); game.duels.challenge(a, c); }
    }, 'primary'));
    const helpText = near.length ? null : all.length ? `Walk closer to ${all[0].name} first.` : 'Play together with a friend first: Pause -> Play together.';
    return el('div', { class: 'mission-boss' },
      el('img', { class: 'boss-pic', src: portrait(def.species, 160, 140), alt: def.name }),
      el('div', { class: 'clue' }, el('p', {}, `Giant ${def.name.replace(/^Giant /, '')}`), el('p', {}, 'Two against one! Ask a friend in Play together to help.'), def.grow > 0 ? el('p', {}, 'This giant grows bigger every round!') : null,
        helpText && el('p', { class: 'warn' }, helpText), el('div', { class: 'mbtns' }, asks)));
  }

  // T38c: where a type lives in the main world (at most 3 biome names, most species first).
  function livesIn(type) {
    const tally = new Map();
    for (const [id, sp] of Object.entries(SPECIES)) {
      if (sp.type !== type) continue;
      for (const r of spawnInfo(id)) if (r.biome && (!r.when || r.when === 'day' || r.when === 'night')) tally.set(r.name, (tally.get(r.name) || 0) + 1);
    }
    return [...tally].sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0].toLowerCase());
  }

  function catchCard(def) {
    const places = livesIn(def.type);
    const go = t => { game.ui.closePanel(); game.book.open({ type: t }); };
    return el('div', { class: 'mission-catch' },
      el('div', { class: 'clue' }, el('p', {}, `Find ${aType(def.type)} creature and catch it!`),
        places.length ? el('p', {}, `Look in: ${places.join(', ')}.`) : null,
        el('p', {}, 'See them in the Creature Book: ', typeLink(def.type, go))));
  }

  function rematchCard(def) {
    const g = gymOf(def);
    return el('div', { class: 'mission-catch' },
      el('div', { class: 'clue' }, el('p', {}, `Go to the ${g?.name || 'gym'} and beat ${g?.leader?.name || 'the leader'} again!`)));
  }

  function card(def, { start = false } = {}) {
    const gen = isGenId(def.id);
    const inner = def.kind === 'map' ? mapCard(def) : def.kind === 'build' ? buildCard(def) : def.kind === 'catch' ? catchCard(def) : def.kind === 'rematch' ? rematchCard(def) : bossCard(def);
    return el('div', { class: 'mission-card' },
      el('div', { class: 'mc-head' }, el('span', { class: 'mc-big' }, KIND_ICON[def.kind]), el('div', {}, el('b', {}, def.name), el('div', { class: 'mc-kind' }, KIND_LINE[def.kind]))),
      inner,
      gen ? el('p', { class: 'mc-round' }, `Round ${def.round} · mission ${def.pos} of ${ROUND_LEN}`) : null,
      start ? btn('Start this mission!', () => game.missions.give(), 'primary') : null);
  }

  function render() {
    const root = body();
    if (!root || mode == null) return;
    const ms = game.missions, s = game.missionState;
    const kids = [el('h2', {}, 'Champion missions'),
      el('p', { class: 'mc-count' }, el('b', { class: 'mc-num' }, `Mission ${ms.number}`), ` · ${ms.doneCount} done`)];
    if (!game.champion) {
      kids.push(el('p', { class: 'mc-note' }, 'Become the Champion to get missions!'));
    } else {
      const active = ms.active;
      if (active) {
        kids.push(card(active));
        if (ms.canSwap()) kids.push(btn('Do a different one', () => { ms.swap(); }));
      } else if (mode === 'desk') {
        const n = ms.next();
        kids.push(n ? card(n, { start: true }) : el('p', { class: 'mc-note' }, 'Come back soon for a new mission!'));
      } else {
        kids.push(el('p', { class: 'mc-note' }, `Talk to Champion Solenne in the tower for mission ${ms.number}.`));
      }
      if (mode === 'desk') kids.push(btn('Battle Champion Solenne', () => { game.closeMissions?.(); ms.battle(); }));
      const chips = MISSIONS.filter(m => s.done.includes(m.id)).map(m => el('span', { class: 'chip done' }, `✓ ${m.name}`));
      if (s.gen > 0) chips.push(el('span', { class: 'chip done' }, `+ ${s.gen} more`));
      kids.push(el('div', { class: 'mission-done' }, chips.length ? chips : el('span', { class: 'mc-note' }, 'No missions done yet.')));
    }
    root.replaceChildren(...kids);
  }

  return {
    want: null,
    colorOf,
    open(m = 'view') { mode = m; render(); setChip(); },
    close() { mode = null; },
    refresh() { if (mode != null) render(); setChip(); },
    setChip,
    get mode() { return mode; },
  };
}
