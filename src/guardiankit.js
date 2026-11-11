// Owner 2026-11-08: the Wizard's drawing board is a real part kit. Your guardian (species `guardian`, type Custom only) is built from seven
// parts (body, head, eyes, legs, tail, back, extra), each in its own colour (the twelve paints or Rainbow). A creature carries its design in
// `c.paint` = { n: name, p: [7 part numbers], c: [7 colour numbers] } (the old six designs still carry a [body, accent, belly] triple there;
// custom.js `cleanPaint` cleans either by the species). Part and colour numbers are saved: the lists are APPEND-ONLY.
// Every part knows where it attaches, so any mix stands on y = 0, faces +z and animates (legs walk, wings flap and the guardian flies, tails
// wag). Nothing here uses Math.random. The kit holds Zenithar's own parts too (Grand body, Crowned head, Grand wings, Star tail, Halo):
// Champion Solenne drew Zenithar on this same board long ago (STORY.md).
import * as THREE from 'three';
import { box, pivot, glow, addWings } from './shapes.js';
import { PAINTS } from './custom.js';
import { cleanLooks, makeLook, kindOf } from './movekinds.js'; // owner 2026-11-10: each attack's own look, designed per its kind

export const SLOTS = ['body', 'head', 'eyes', 'legs', 'tail', 'back', 'extra'];
export const SLOT_LABELS = { body: 'Body', head: 'Head', eyes: 'Eyes', legs: 'Legs', tail: 'Tail', back: 'Back', extra: 'Extra' };
export const SLOT_ICONS = { body: '🟫', head: '🙂', eyes: '👀', legs: '🦵', tail: '〰️', back: '🪽', extra: '✨' };
export const RAINBOW = PAINTS.length; // 12: the colour after the twelve paints
export const KIT_COLOURS = [...PAINTS.map(p => ({ name: p.name, hex: p.hex })), { name: 'Rainbow', hex: 0xffffff, rainbow: true }];
export const NAME_MAX = 12;

const WOOD = 0xb88a58, METAL = 0xc8ced6, BEAK = 0xffa030, PINK = 0xffa8c8, BLACK = 0x161320, WHITE = 0xffffff;
const mix = (hex, f, to) => {
  const t = to ?? (f > 1 ? 0xffffff : 0);
  const k = f > 1 ? f - 1 : 1 - f;
  const ch = s => Math.round(((hex >> s) & 255) * (1 - k) + ((t >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// ---- parts: name + a builder; bodies and heads also say where things attach ----
// A body is built in body space (bottom y 0, centre z 0). legs: hip spots [x, z]; neck / tail / back: [y, z] where those parts attach.
const BODIES = [
  { name: 'Round', w: 0.5, legs: [[-0.14, 0.13], [0.14, 0.13], [-0.14, -0.13], [0.14, -0.13]], neck: [0.4, 0.17], tail: [0.2, -0.25], back: [0.44, -0.02],
    build(g, C) { C.box(g, 0.5, 0.42, 0.5, 'c', 0, 0.21, 0); C.box(g, 0.4, 0.06, 0.4, 'c', 0, 0.45, 0); C.box(g, 0.3, 0.24, 0.04, 'l', 0, 0.19, 0.25); } },
  { name: 'Long', w: 0.34, legs: [[-0.11, 0.2], [0.11, 0.2], [-0.11, -0.2], [0.11, -0.2]], neck: [0.16, 0.3], tail: [0.18, -0.3], back: [0.28, -0.02],
    build(g, C) { C.box(g, 0.34, 0.28, 0.6, 'c', 0, 0.14, 0); C.box(g, 0.26, 0.04, 0.5, 'l', 0, 0.01, 0); C.box(g, 0.2, 0.16, 0.04, 'l', 0, 0.12, 0.3); } },
  { name: 'Tall', w: 0.36, upright: true, arms: 0.21, legs: [[-0.1, 0], [0.1, 0]], neck: [0.46, 0], tail: [0.1, -0.15], back: [0.34, -0.15],
    build(g, C) { C.box(g, 0.36, 0.46, 0.3, 'c', 0, 0.23, 0); C.box(g, 0.26, 0.3, 0.04, 'l', 0, 0.2, 0.15); } },
  { name: 'Chunky', w: 0.58, legs: [[-0.19, 0.17], [0.19, 0.17], [-0.19, -0.17], [0.19, -0.17]], neck: [0.28, 0.27], tail: [0.2, -0.27], back: [0.4, -0.04],
    build(g, C) { C.box(g, 0.58, 0.38, 0.54, 'c', 0, 0.19, 0); C.box(g, 0.62, 0.12, 0.22, 'd', 0, 0.34, 0.12); C.box(g, 0.4, 0.22, 0.04, 'l', 0, 0.16, 0.27); } },
  { name: 'Bean', w: 0.4, upright: true, arms: 0.22, legs: [[-0.11, 0.02], [0.11, 0.02]], neck: [0.5, 0.02], tail: [0.12, -0.18], back: [0.34, -0.16],
    build(g, C) { C.box(g, 0.4, 0.32, 0.36, 'c', 0, 0.16, 0); C.box(g, 0.32, 0.2, 0.3, 'c', 0, 0.4, 0.01); C.box(g, 0.28, 0.24, 0.04, 'l', 0, 0.18, 0.18); } },
  { name: 'Noodle', w: 0.26, legs: [[-0.1, 0.16], [0.1, 0.16], [-0.1, -0.18], [0.1, -0.18]], neck: [0.12, 0.32], tail: [0.12, -0.32], back: [0.24, 0],
    build(g, C, P) {
      [0.2, 0, -0.2].forEach((z, i) => {
        const s = pivot(g, 0, 0, z);
        C.box(s, 0.26 - i * 0.02, 0.24, 0.22, 'c', 0, 0.12, 0); C.box(s, 0.18, 0.03, 0.14, 'd', 0, 0.245, 0); C.box(s, 0.18, 0.03, 0.16, 'l', 0, 0.005, 0);
        (P.segments ||= []).push({ g: s, i });
      });
    } },
  { name: 'Grand', w: 0.46, legs: [[-0.15, 0.24], [0.15, 0.24], [-0.15, -0.24], [0.15, -0.24]], neck: [0.4, 0.36], tail: [0.24, -0.38], back: [0.38, 0], big: true,
    build(g, C) {
      C.box(g, 0.46, 0.38, 0.72, 'c', 0, 0.19, 0); C.box(g, 0.34, 0.05, 0.6, 'l', 0, 0.01, 0);
      C.box(g, 0.48, 0.08, 0.3, 'd', 0, 0.4, -0.05); C.box(g, 0.22, 0.26, 0.12, 'd', 0, 0.22, -0.4);   // the saddle stripe and the rump
      C.box(g, 0.22, 0.22, 0.22, 'd', 0, 0.4, 0.3);                                                    // the neck and its mane
      for (let i = 0; i < 3; i++) C.box(g, 0.16 - i * 0.02, 0.14, 0.12, i % 2 ? 'l' : 'd', 0, 0.54 - i * 0.08, 0.24 - i * 0.12);
    } },
  // owner 2026-11-08: "3 more options to each ... a bit weirder"
  { name: 'Jelly', w: 0.5, legs: [[-0.14, 0.13], [0.14, 0.13], [-0.14, -0.13], [0.14, -0.13]], neck: [0.36, 0.16], tail: [0.15, -0.25], back: [0.4, -0.02],
    build(g, C, P) {
      const j = pivot(g, 0, 0, 0);                                                                     // it wobbles like jelly
      C.box(j, 0.5, 0.36, 0.5, 'c', 0, 0.18, 0); C.box(j, 0.42, 0.06, 0.42, 'c', 0, 0.39, 0); C.box(j, 0.3, 0.2, 0.04, 'l', 0, 0.17, 0.25);
      for (const [x, z, h] of [[-0.25, 0.1, 0.1], [0.25, -0.05, 0.14], [-0.1, -0.25, 0.08], [0.12, 0.25, 0.09]]) C.box(j, 0.06, h, 0.06, 'l', x, 0.08 - h / 2 + 0.06, z); // drips
      (P.squash ||= []).push({ g: j, amp: 0.07, speed: 3.2, phase: 0 });
    } },
  { name: 'Stack', w: 0.36, upright: true, arms: 0.2, legs: [[-0.1, 0], [0.1, 0]], neck: [0.48, 0], tail: [0.08, -0.15], back: [0.32, -0.13],
    build(g, C) {
      C.box(g, 0.36, 0.18, 0.3, 'c', 0, 0.09, 0);
      C.box(g, 0.3, 0.16, 0.26, 'l', 0, 0.26, 0).rotation.y = 0.35;
      C.box(g, 0.26, 0.14, 0.24, 'd', 0, 0.41, 0).rotation.y = -0.25;
    } },
  { name: 'Robot', w: 0.4, upright: true, arms: 0.23, legs: [[-0.11, 0], [0.11, 0]], neck: [0.42, 0], tail: [0.1, -0.16], back: [0.32, -0.16],
    build(g, C, P) {
      C.box(g, 0.4, 0.42, 0.32, 'c', 0, 0.21, 0); C.box(g, 0.26, 0.2, 0.03, 'd', 0, 0.23, 0.16);   // the belly screen
      P.tip = glow(C.box(g, 0.08, 0.05, 0.02, 'l', -0.05, 0.27, 0.18), C.hex('l')); glow(C.box(g, 0.12, 0.03, 0.02, 'l', 0.03, 0.19, 0.18), C.hex('l'));
      for (const [x, y] of [[-0.17, 0.38], [0.17, 0.38], [-0.17, 0.04], [0.17, 0.04]]) C.fix(g, 0.04, 0.04, 0.02, METAL, x, y, 0.165); // rivets
    } },
];

// A head is built with its bottom at y 0 and its middle at z 0; face: where the eyes go; top: where an extra sits.
const HEADS = [
  { name: 'Cube', face: { z: 0.14, y: 0.16, s: 0.075 }, top: 0.28, build(h, C) { C.box(h, 0.3, 0.28, 0.28, 'c', 0, 0.14, 0); C.box(h, 0.08, 0.03, 0.02, 'd', 0, 0.06, 0.14); } },
  { name: 'Fox', face: { z: 0.13, y: 0.16, s: 0.08 }, top: 0.3, build(h, C) {
    C.box(h, 0.3, 0.24, 0.26, 'c', 0, 0.12, 0); C.box(h, 0.16, 0.11, 0.12, 'l', 0, 0.07, 0.17); C.fix(h, 0.05, 0.04, 0.03, BLACK, 0, 0.11, 0.235);
    for (const s of [-1, 1]) { C.box(h, 0.09, 0.15, 0.06, 'c', s * 0.1, 0.3, 0).rotation.z = -s * 0.15; C.box(h, 0.045, 0.09, 0.03, 'd', s * 0.1, 0.29, 0.025).rotation.z = -s * 0.15; }
  } },
  { name: 'Bunny', face: { z: 0.13, y: 0.15, s: 0.075 }, top: 0.3, build(h, C) {
    C.box(h, 0.28, 0.26, 0.26, 'c', 0, 0.13, 0); C.fix(h, 0.05, 0.035, 0.02, PINK, 0, 0.09, 0.135);
    for (const s of [-1, 1]) { C.box(h, 0.07, 0.3, 0.05, 'c', s * 0.07, 0.4, -0.03); C.box(h, 0.035, 0.22, 0.02, 'l', s * 0.07, 0.39, -0.002); C.box(h, 0.06, 0.035, 0.02, 'l', s * 0.1, 0.06, 0.13); }
  } },
  { name: 'Cat', face: { z: 0.13, y: 0.15, s: 0.075 }, top: 0.27, build(h, C) {
    C.box(h, 0.3, 0.25, 0.26, 'c', 0, 0.125, 0); C.fix(h, 0.05, 0.03, 0.02, PINK, 0, 0.085, 0.135);
    for (const s of [-1, 1]) {
      const e = C.box(h, 0.1, 0.1, 0.05, 'c', s * 0.1, 0.25, 0); e.rotation.z = Math.PI / 4;
      const i = C.box(h, 0.05, 0.05, 0.03, 'l', s * 0.1, 0.25, 0.02); i.rotation.z = Math.PI / 4;
      for (const y of [0.07, 0.1]) C.fix(h, 0.12, 0.01, 0.01, BLACK, s * 0.17, y, 0.135);
    }
  } },
  { name: 'Bird', face: { z: 0.14, y: 0.17, s: 0.085 }, top: 0.36, build(h, C) {
    C.box(h, 0.28, 0.28, 0.28, 'c', 0, 0.14, 0); C.box(h, 0.2, 0.12, 0.04, 'l', 0, 0.06, 0.14);
    C.fix(h, 0.1, 0.06, 0.12, BEAK, 0, 0.11, 0.19); C.fix(h, 0.08, 0.03, 0.08, mix(BEAK, 0.7), 0, 0.07, 0.17);
    [-0.05, 0, 0.05].forEach((x, i) => { C.box(h, 0.03, 0.1 + (i === 1 ? 0.04 : 0), 0.03, 'd', x, 0.32 + (i === 1 ? 0.02 : 0), -0.04).rotation.x = -0.3; });
  } },
  { name: 'Dragon', face: { z: 0.13, y: 0.17, s: 0.08 }, top: 0.26, build(h, C) {
    C.box(h, 0.28, 0.24, 0.26, 'c', 0, 0.12, 0); C.box(h, 0.2, 0.13, 0.16, 'c', 0, 0.07, 0.2); C.box(h, 0.16, 0.03, 0.14, 'l', 0, 0.005, 0.2);
    for (const s of [-1, 1]) { C.fix(h, 0.03, 0.03, 0.02, BLACK, s * 0.05, 0.11, 0.285); C.box(h, 0.1, 0.03, 0.04, 'd', s * 0.08, 0.235, 0.12); C.fix(h, 0.025, 0.04, 0.02, WHITE, s * 0.06, 0.0, 0.27); }
  } },
  { name: 'Bear', face: { z: 0.14, y: 0.17, s: 0.08 }, top: 0.3, build(h, C) {
    C.box(h, 0.32, 0.28, 0.28, 'c', 0, 0.14, 0); C.box(h, 0.16, 0.1, 0.06, 'l', 0, 0.08, 0.16); C.fix(h, 0.06, 0.04, 0.02, BLACK, 0, 0.11, 0.195);
    for (const s of [-1, 1]) { C.box(h, 0.1, 0.1, 0.05, 'c', s * 0.13, 0.3, -0.02); C.box(h, 0.05, 0.05, 0.02, 'l', s * 0.13, 0.3, 0.01); }
  } },
  { name: 'Crowned', face: { z: 0.15, y: 0.17, s: 0.085 }, top: 0.5, build(h, C) {
    C.box(h, 0.32, 0.3, 0.3, 'c', 0, 0.15, 0); C.box(h, 0.22, 0.12, 0.08, 'l', 0, 0.07, 0.17);
    glow(C.box(h, 0.07, 0.07, 0.03, 'l', 0, 0.26, 0.155), C.hex('l'));                               // the forehead gem
    for (let i = 0; i < 5; i++) { const hh = i === 2 ? 0.2 : i % 2 ? 0.12 : 0.16; glow(C.box(h, 0.045, hh, 0.045, 'l', (i - 2) * 0.055, 0.3 + hh / 2, -0.01), C.hex('l')); }
    for (const s of [-1, 1]) C.box(h, 0.05, 0.12, 0.05, 'd', s * 0.13, 0.33, -0.08).rotation.z = -s * 0.3;
  } },
  { name: 'Mushroom', face: { z: 0.12, y: 0.12, s: 0.07 }, top: 0.42, build(h, C) {
    C.box(h, 0.24, 0.22, 0.24, 'l', 0, 0.11, 0); C.box(h, 0.46, 0.12, 0.46, 'c', 0, 0.28, 0); C.box(h, 0.32, 0.08, 0.32, 'c', 0, 0.38, 0);
    for (const [x, z] of [[-0.12, 0.1], [0.1, -0.12], [0.14, 0.12], [-0.1, -0.1], [0, 0]]) C.fix(h, 0.07, 0.02, 0.07, WHITE, x, z === 0 && x === 0 ? 0.425 : 0.345, z);
    for (const s of [-1, 1]) C.fix(h, 0.07, 0.02, 0.02, WHITE, s * 0.15, 0.27, 0.235);
  } },
  { name: 'Robot', face: { z: 0.15, y: 0.18, s: 0.08 }, top: 0.3, build(h, C) {
    C.box(h, 0.32, 0.3, 0.3, 'c', 0, 0.15, 0); C.box(h, 0.18, 0.06, 0.02, 'd', 0, 0.06, 0.155);
    for (const x of [-0.06, -0.02, 0.02, 0.06]) C.fix(h, 0.015, 0.05, 0.025, METAL, x, 0.06, 0.16);      // the grille mouth
    for (const s of [-1, 1]) { C.fix(h, 0.04, 0.08, 0.08, METAL, s * 0.18, 0.15, 0); C.box(h, 0.03, 0.05, 0.05, 'l', s * 0.205, 0.15, 0); }
  } },
  { name: 'Shark', face: { z: 0.12, y: 0.18, s: 0.1 }, top: 0.27, build(h, C) {
    C.box(h, 0.28, 0.26, 0.3, 'c', 0, 0.13, 0); C.box(h, 0.2, 0.14, 0.14, 'c', 0, 0.13, 0.2); C.box(h, 0.22, 0.06, 0.16, 'l', 0, 0.03, 0.17);
    for (const x of [-0.07, -0.025, 0.025, 0.07]) { const t = C.fix(h, 0.03, 0.04, 0.02, WHITE, x, 0.075, 0.265); t.rotation.z = Math.PI / 4; }
    C.box(h, 0.03, 0.14, 0.12, 'd', 0, 0.31, -0.05).rotation.x = -0.4;                                 // the fin on top
  } },
];

// Eyes at the head's face (z, y, s = half the gap); `C` is the eyes' colour.
const EYES = [
  { name: 'Big', build(h, C, f) { for (const s of [-1, 1]) { const x = s * f.s;
    C.eye(h, 0.1, 0.11, 0.03, WHITE, x, f.y, f.z); C.eye(h, 0.065, 0.075, 0.02, 'c', x, f.y - 0.01, f.z + 0.02);
    C.eye(h, 0.032, 0.042, 0.02, BLACK, x, f.y - 0.012, f.z + 0.03); C.eye(h, 0.022, 0.022, 0.01, WHITE, x - 0.02, f.y + 0.02, f.z + 0.04); } } },
  { name: 'Sleepy', build(h, C, f) { for (const s of [-1, 1]) { C.eye(h, 0.09, 0.025, 0.02, BLACK, s * f.s, f.y - 0.01, f.z + 0.005); C.eye(h, 0.06, 0.03, 0.01, 'l', s * (f.s + 0.04), f.y - 0.06, f.z + 0.005); } } },
  { name: 'Sparkly', build(h, C, f) { for (const s of [-1, 1]) { glow(C.eye(h, 0.09, 0.1, 0.03, 'c', s * f.s, f.y, f.z), C.hex('d')); C.eye(h, 0.03, 0.03, 0.02, WHITE, s * f.s - 0.02, f.y + 0.025, f.z + 0.02); C.eye(h, 0.018, 0.018, 0.02, WHITE, s * f.s + 0.022, f.y - 0.025, f.z + 0.02); } } },
  { name: 'One big', build(h, C, f) { C.eye(h, 0.17, 0.16, 0.03, WHITE, 0, f.y, f.z); C.eye(h, 0.11, 0.11, 0.02, 'c', 0, f.y - 0.01, f.z + 0.02); C.eye(h, 0.055, 0.055, 0.02, BLACK, 0, f.y - 0.01, f.z + 0.03); C.eye(h, 0.03, 0.03, 0.01, WHITE, -0.035, f.y + 0.035, f.z + 0.04); } },
  { name: 'Three', build(h, C, f) { for (const [x, y, k] of [[-f.s, -0.01, 1], [f.s, -0.01, 1], [0, 0.075, 0.75]]) {
    C.eye(h, 0.08 * k, 0.09 * k, 0.03, WHITE, x, f.y + y, f.z); C.eye(h, 0.05 * k, 0.06 * k, 0.02, 'c', x, f.y + y - 0.005, f.z + 0.02); C.eye(h, 0.025 * k, 0.03 * k, 0.02, BLACK, x, f.y + y - 0.006, f.z + 0.03); } } },
  { name: 'Shades', build(h, C, f) { C.eye(h, f.s * 2 + 0.14, 0.07, 0.03, BLACK, 0, f.y, f.z + 0.005); C.eye(h, f.s * 2 + 0.16, 0.02, 0.035, 'c', 0, f.y + 0.04, f.z + 0.005); for (const s of [-1, 1]) C.eye(h, 0.03, 0.015, 0.01, WHITE, s * f.s - 0.02, f.y + 0.015, f.z + 0.025); } },
  { name: 'Googly', build(h, C, f, P) { [-1, 1].forEach((s, i) => {
    C.eye(h, 0.12, 0.12, 0.03, WHITE, s * f.s, f.y, f.z); C.eye(h, 0.13, 0.025, 0.035, 'c', s * f.s, f.y + 0.07, f.z);
    const g = pivot(h, s * f.s, f.y, f.z + 0.025); C.eye(g, 0.05, 0.05, 0.02, BLACK, 0.025, -0.02, 0);
    (P.wobble ||= []).push({ g, axis: 'z', speed: 5 + i * 1.7, phase: i * 2, amp: 1.2 }); }); } },
  { name: 'Stalks', build(h, C, f, P) { [-1, 1].forEach((s, i) => {
    const g = pivot(h, s * f.s, f.y + 0.02, f.z - 0.05);
    C.eye(g, 0.025, 0.18, 0.025, 'd', 0, 0.09, 0); C.eye(g, 0.09, 0.09, 0.09, WHITE, 0, 0.2, 0); C.eye(g, 0.05, 0.05, 0.02, 'c', 0, 0.2, 0.046); C.eye(g, 0.025, 0.025, 0.02, BLACK, 0, 0.2, 0.054);
    (P.wobble ||= []).push({ g, axis: 'z', speed: 3 + i, phase: i * 1.3, amp: 0.25 }); }); } },
  { name: 'Hearts', build(h, C, f) { for (const s of [-1, 1]) { const x = s * f.s;
    for (const dx of [-0.022, 0.022]) glow(C.eye(h, 0.05, 0.05, 0.03, 'c', x + dx, f.y + 0.015, f.z), C.hex('d'));
    const b = glow(C.eye(h, 0.06, 0.06, 0.029, 'c', x, f.y - 0.012, f.z), C.hex('d')); b.rotation.z = Math.PI / 4; } } },
  { name: 'Hypno', build(h, C, f, P) { [-1, 1].forEach(s => {
    C.eye(h, 0.11, 0.11, 0.03, WHITE, s * f.s, f.y, f.z); const g = pivot(h, s * f.s, f.y, f.z + 0.02);
    C.eye(g, 0.09, 0.02, 0.01, 'c', 0, 0, 0); C.eye(g, 0.02, 0.09, 0.01, 'c', 0, 0, 0); C.eye(g, 0.06, 0.06, 0.008, 'd', 0, 0, 0).rotation.z = Math.PI / 4; C.eye(g, 0.025, 0.025, 0.01, BLACK, 0, 0, 0.006);
    (P.spin ||= []).push({ g, axis: 'z', speed: 4 * s }); }); } },
];

// Legs: `len` lifts the body; each builder makes one leg hanging down from its hip pivot. `flat` = no walk swing.
const LEGS = [
  { name: 'None', len: 0 },
  { name: 'Stubby', len: 0.14, build(g, C) { C.box(g, 0.11, 0.14, 0.11, 'c', 0, -0.07, 0); C.box(g, 0.12, 0.04, 0.14, 'd', 0, -0.12, 0.02); } },
  { name: 'Long', len: 0.36, build(g, C) { C.box(g, 0.08, 0.34, 0.08, 'c', 0, -0.17, 0); C.box(g, 0.1, 0.04, 0.14, 'd', 0, -0.34, 0.02); } },
  { name: 'Paws', len: 0.22, build(g, C) { C.box(g, 0.13, 0.18, 0.13, 'c', 0, -0.09, 0); C.box(g, 0.16, 0.07, 0.18, 'l', 0, -0.185, 0.03); for (const x of [-0.05, 0, 0.05]) C.box(g, 0.03, 0.03, 0.02, 'd', x, -0.19, 0.125); } },
  { name: 'Bird', len: 0.3, build(g, C) { C.box(g, 0.09, 0.13, 0.09, 'c', 0, -0.06, 0); C.box(g, 0.035, 0.17, 0.035, 'd', 0, -0.2, 0); for (const a of [-0.5, 0, 0.5]) { const t = C.box(g, 0.025, 0.02, 0.1, 'd', Math.sin(a) * 0.03, -0.29, 0.04); t.rotation.y = a; } } },
  { name: 'Wheels', len: 0.18, flat: true, build(g, C, P) { const w = pivot(g, 0, -0.09, 0); C.box(w, 0.06, 0.18, 0.18, 'd', 0, 0, 0); C.box(w, 0.065, 0.12, 0.12, 'c', 0, 0, 0); C.fix(w, 0.07, 0.05, 0.05, METAL, 0, 0, 0); (P.spin ||= []).push({ g: w, axis: 'x', speed: 5 }); } },
  { name: 'Tentacles', len: 0.24, ring: 6, flat: true, build(g, C, P, i) {
    C.box(g, 0.09, 0.16, 0.09, 'c', 0, -0.08, 0); const t = pivot(g, 0, -0.16, 0); C.box(t, 0.07, 0.1, 0.07, 'l', 0, -0.04, 0.02);
    (P.wobble ||= []).push({ g, axis: i % 2 ? 'x' : 'z', speed: 3, phase: i, amp: 0.25 }); } },
  { name: 'Cloud', len: 0.1, hover: true, under: true, build(g, C) { for (const [x, z, s] of [[0, 0, 0.3], [-0.14, 0.08, 0.2], [0.15, -0.06, 0.22], [0.02, -0.15, 0.18]]) C.box(g, s, 0.1, s, 'l', x, -0.05, z); } },
  { name: 'Frog', len: 0.16, build(g, C) { C.box(g, 0.1, 0.12, 0.1, 'c', 0, -0.06, 0); C.box(g, 0.18, 0.04, 0.22, 'l', 0, -0.14, 0.05); for (const x of [-0.06, 0, 0.06]) C.box(g, 0.04, 0.045, 0.04, 'd', x, -0.135, 0.17); } },
  { name: 'Spider', len: 0.2, ring: 8, flat: true, build(g, C, P, i) {               // eight bendy legs reaching out
    g.rotation.y = -((i / 8) * Math.PI * 2 + 0.3);
    const up = C.box(g, 0.3, 0.03, 0.03, 'c', 0.14, 0.07, 0); up.rotation.z = 0.4;
    C.box(g, 0.03, 0.33, 0.03, 'd', 0.27, -0.035, 0);
    (P.wobble ||= []).push({ g, axis: 'z', speed: 6, phase: i * 0.8, amp: 0.08 }); } },
  { name: 'Pogo', len: 0.32, under: true, build(g, C, P) {                          // one bouncy spring
    const sp = pivot(g, 0, 0, 0);
    for (let k = 0; k < 4; k++) C.fix(sp, 0.13 - (k % 2) * 0.03, 0.03, 0.13 - (k % 2) * 0.03, METAL, 0, -0.04 - k * 0.06, 0);
    C.fix(sp, 0.03, 0.26, 0.03, METAL, 0, -0.14, 0); C.box(sp, 0.2, 0.05, 0.2, 'c', 0, -0.295, 0);
    (P.squash ||= []).push({ g: sp, amp: 0.12, speed: 7, phase: 0 }); } },
];

// Tails point backwards (-z) from their pivot; parts.tail wags.
const TAILS = [
  { name: 'None' },
  { name: 'Fluffy', build(t, C) { const a = pivot(t, 0, 0, 0); a.rotation.x = 0.6; C.box(a, 0.14, 0.14, 0.24, 'c', 0, 0, -0.12); C.box(a, 0.17, 0.17, 0.12, 'l', 0, 0, -0.27); } },
  { name: 'Paintbrush', build(t, C) { const a = pivot(t, 0, 0, 0); a.rotation.x = 0.9; C.fix(a, 0.04, 0.04, 0.3, WOOD, 0, 0, -0.15); C.fix(a, 0.06, 0.06, 0.08, METAL, 0, 0, -0.33); C.box(a, 0.13, 0.13, 0.22, 'l', 0, 0, -0.48); C.box(a, 0.15, 0.15, 0.1, 'c', 0, 0, -0.63); } },
  { name: 'Spiky', build(t, C) { for (let i = 0; i < 3; i++) { C.box(t, 0.14 - i * 0.035, 0.12 - i * 0.03, 0.16, 'c', 0, -i * 0.02, -0.08 - i * 0.15); C.box(t, 0.04, 0.07, 0.06, 'd', 0, 0.07 - i * 0.03, -0.08 - i * 0.15).rotation.x = 0.6; } C.box(t, 0.1, 0.03, 0.08, 'd', 0, -0.04, -0.5); } },
  { name: 'Curly', build(t, C) { for (let i = 0; i < 8; i++) { const a = i * 0.85; C.box(t, 0.05, 0.05, 0.05, i % 2 ? 'c' : 'l', Math.cos(a) * 0.05, 0.02 + Math.sin(a) * 0.05 + i * 0.012, -0.03 - i * 0.025); } } },
  { name: 'Fin', build(t, C) { C.box(t, 0.08, 0.1, 0.14, 'c', 0, 0, -0.07); C.box(t, 0.03, 0.3, 0.14, 'c', 0, 0.02, -0.2); for (const y of [-0.08, 0.02, 0.12]) C.box(t, 0.035, 0.03, 0.12, 'l', 0, y, -0.21); } },
  { name: 'Star', build(t, C, P) {
    for (let i = 0; i < 3; i++) C.box(t, 0.12 - i * 0.02, 0.12 - i * 0.02, 0.2, i % 2 ? 'l' : 'c', 0, i * 0.06, -0.1 - i * 0.17);
    P.tip = glow(C.box(t, 0.15, 0.15, 0.15, 'l', 0, 0.2, -0.6), C.hex('l')); } },
  { name: 'Feather fan', build(t, C) { const a = pivot(t, 0, 0.04, 0); a.rotation.x = -0.5;
    for (let i = -2; i <= 2; i++) { const f = pivot(a, 0, 0, 0); f.rotation.z = i * 0.32; C.box(f, 0.05, 0.4, 0.02, 'c', 0, 0.22, -0.02); C.box(f, 0.07, 0.07, 0.03, 'l', 0, 0.38, -0.02); C.box(f, 0.035, 0.035, 0.035, 'd', 0, 0.38, -0.01); } } },
  { name: 'Lightning', build(t, C, P) {
    [[0.04, -0.08, 0.7], [0.12, -0.17, -0.7], [0.2, -0.26, 0.7]].forEach(([y, z, r]) => { C.box(t, 0.05, 0.05, 0.16, 'c', 0, y, z).rotation.x = r; });
    P.tip = glow(C.box(t, 0.08, 0.08, 0.08, 'l', 0, 0.28, -0.34), C.hex('l')); } },
  { name: 'Rocket', build(t, C, P) {
    C.box(t, 0.1, 0.1, 0.22, 'c', 0, 0, -0.11); C.box(t, 0.12, 0.12, 0.04, 'l', 0, 0, -0.04);
    for (const s of [-1, 1]) C.box(t, 0.08, 0.02, 0.08, 'd', s * 0.08, 0, -0.18);          // the fins
    C.box(t, 0.02, 0.08, 0.08, 'd', 0, 0.08, -0.18);
    P.tip = glow(C.fix(t, 0.08, 0.08, 0.1, 0xffb030, 0, 0, -0.27), 0xff7020); glow(C.fix(t, 0.05, 0.05, 0.08, 0xfff080, 0, 0, -0.34), 0xffd040); } },
  { name: 'Mermaid', build(t, C) {
    C.box(t, 0.12, 0.09, 0.16, 'c', 0, 0, -0.08); C.box(t, 0.08, 0.07, 0.14, 'c', 0, 0.02, -0.21); C.box(t, 0.1, 0.02, 0.12, 'l', 0, 0.045, -0.12);
    for (const s of [-1, 1]) { const f = C.box(t, 0.2, 0.03, 0.12, 'l', s * 0.08, 0.04, -0.32); f.rotation.y = s * 0.5; } } },
];

// The back: wings (fly = the guardian floats and flaps), spikes, a shell, a sail.
const BACKS = [
  { name: 'None' },
  { name: 'Feathers', fly: true, build(g, C, P, b) { addWings(P, g, null, b.w * 0.32, 0, 0, 0.42, 0.24, C.hex('c'), C.hex('l'), { lift: 0.3 }); C.tag(g); } },
  { name: 'Dragon wings', fly: true, build(g, C, P, b) { addWings(P, g, null, b.w * 0.32, 0.02, 0, 0.5, 0.3, C.hex('c'), C.hex('d'), { lift: 0.45 }); C.tag(g); } },
  { name: 'Butterfly', fly: true, build(g, C, P, b) { addWings(P, g, null, b.w * 0.2, 0.05, -0.02, 0.34, 0.38, C.hex('c'), C.hex('l'), { upright: true, lift: 0.2 }); C.tag(g); } },
  { name: 'Spikes', build(g, C) { for (let i = 0; i < 4; i++) { const s = C.box(g, 0.08 - i * 0.008, 0.08 - i * 0.008, 0.03, i % 2 ? 'l' : 'c', 0, 0.03, 0.15 - i * 0.12); s.rotation.z = Math.PI / 4; } } },
  { name: 'Shell', build(g, C) { C.box(g, 0.42, 0.1, 0.42, 'c', 0, 0.02, 0); C.box(g, 0.3, 0.08, 0.3, 'c', 0, 0.1, 0); for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1], [0, 0]]) C.box(g, 0.08, 0.02, 0.08, 'd', x, 0.145, z); } },
  { name: 'Grand wings', fly: true, build(g, C, P, b) {
    addWings(P, g, null, b.w * 0.3, 0.02, 0.04, 0.6, 0.32, C.hex('c'), C.hex('l'), { lift: 0.3 });
    addWings(P, g, null, b.w * 0.3, -0.04, -0.14, 0.38, 0.22, C.hex('d'), C.hex('l'), { lift: 0.15 }); C.tag(g); } },
  { name: 'Sail', build(g, C) { const s = pivot(g, 0, 0, 0);
    C.box(s, 0.04, 0.3, 0.04, 'd', 0, 0.15, 0.14); C.box(s, 0.04, 0.3, 0.04, 'd', 0, 0.15, -0.14); C.box(s, 0.04, 0.04, 0.32, 'd', 0, 0.3, 0); C.box(s, 0.025, 0.24, 0.24, 'c', 0, 0.15, 0); C.box(s, 0.03, 0.08, 0.08, 'l', 0, 0.18, 0.03); } },
  { name: 'Jetpack', fly: true, build(g, C, P) {
    for (const s of [-1, 1]) {
      C.box(g, 0.09, 0.09, 0.26, 'c', s * 0.07, 0.05, -0.06); C.box(g, 0.1, 0.1, 0.03, 'l', s * 0.07, 0.05, 0.07); C.fix(g, 0.07, 0.07, 0.04, METAL, s * 0.07, 0.05, -0.21);
      const f = pivot(g, s * 0.07, 0.05, -0.25); glow(C.fix(f, 0.06, 0.06, 0.08, 0xffb030, 0, 0, -0.04), 0xff7020); glow(C.fix(f, 0.035, 0.035, 0.06, 0xfff080, 0, 0, -0.1), 0xffd040);
      (P.squash ||= []).push({ g: f, amp: 0.25, speed: 18, phase: s }); } } },
  { name: 'Propeller', fly: true, build(g, C, P) {
    C.box(g, 0.03, 0.2, 0.03, 'd', 0, 0.1, 0); C.fix(g, 0.06, 0.04, 0.06, METAL, 0, 0.21, 0);
    const r = pivot(g, 0, 0.23, 0); C.box(r, 0.56, 0.02, 0.07, 'c', 0, 0, 0); C.box(r, 0.07, 0.02, 0.56, 'l', 0, 0, 0);
    (P.spin ||= []).push({ g: r, axis: 'y', speed: 16 }); } },
  { name: 'Mushrooms', build(g, C) {                                                    // little mushrooms growing on its back
    for (const [x, z, h, w] of [[-0.09, 0.05, 0.08, 0.12], [0.08, -0.04, 0.12, 0.14], [0, -0.14, 0.05, 0.09], [0.11, 0.11, 0.04, 0.07]]) {
      C.fix(g, 0.04, h, 0.04, 0xf2eadc, x, h / 2, z); C.box(g, w, 0.05, w, 'c', x, h + 0.02, z); C.fix(g, w * 0.3, 0.015, w * 0.3, WHITE, x + w * 0.15, h + 0.05, z);
    } } },
];

// Extras sit on the head's top (at: 'head') or around the body (at: 'body').
const EXTRAS = [
  { name: 'None' },
  { name: 'Horns', build(h, C, top) { for (const s of [-1, 1]) { const g = pivot(h, s * 0.09, top - 0.02, -0.02); g.rotation.z = -s * 0.35; C.box(g, 0.05, 0.12, 0.05, 'c', 0, 0.06, 0); C.box(g, 0.035, 0.06, 0.035, 'l', 0, 0.15, 0); } } },
  { name: 'Antennae', build(h, C, top, P) { [-1, 1].forEach((s, i) => { const g = pivot(h, s * 0.07, top - 0.02, 0); g.rotation.z = -s * 0.25; C.box(g, 0.02, 0.16, 0.02, 'd', 0, 0.08, 0); glow(C.box(g, 0.06, 0.06, 0.06, 'c', 0, 0.18, 0), C.hex('d')); (P.wobble ||= []).push({ g, axis: 'x', speed: 4, phase: i * 1.5, amp: 0.15 }); }); } },
  { name: 'Halo', build(h, C, top, P) { const g = pivot(h, 0, top + 0.12, 0); for (const [w, d, x, z] of [[0.3, 0.04, 0, 0.13], [0.3, 0.04, 0, -0.13], [0.04, 0.3, 0.13, 0], [0.04, 0.3, -0.13, 0]]) glow(C.box(g, w, 0.03, d, 'c', x, 0, z), C.hex('c')); (P.spin ||= []).push({ g, axis: 'y', speed: 1.5 }); } },
  { name: 'Top hat', build(h, C, top) { C.box(h, 0.3, 0.03, 0.3, 'd', 0, top + 0.015, 0); C.box(h, 0.2, 0.2, 0.2, 'd', 0, top + 0.13, 0); C.box(h, 0.21, 0.04, 0.21, 'c', 0, top + 0.06, 0); } },
  { name: 'Bow', build(h, C, top) { const g = pivot(h, 0.08, top, 0.02); C.box(g, 0.05, 0.05, 0.05, 'd', 0, 0.02, 0); for (const s of [-1, 1]) { const b = C.box(g, 0.1, 0.08, 0.04, 'c', s * 0.07, 0.03, 0); b.rotation.z = s * 0.3; } } },
  { name: 'Sparkles', body: true, build(r, C, mid, P) { const g = pivot(r, 0, mid.y, mid.z); for (let k = 0; k < 7; k++) { const a = k * 0.9, y = ((k * 37) % 5) * 0.08 - 0.12; glow(C.box(g, 0.05, 0.05, 0.05, 'c', Math.cos(a) * mid.r, y, Math.sin(a) * mid.r), C.hex('c')).rotation.set(0.6, 0.6, 0); } (P.spin ||= []).push({ g, axis: 'y', speed: 0.8 }); } },
  { name: 'Flower', build(h, C, top) { const g = pivot(h, -0.08, top, 0.02); C.fix(g, 0.02, 0.08, 0.02, 0x3c8a3c, 0, 0.04, 0); for (const [x, y] of [[0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04]]) C.box(g, 0.045, 0.045, 0.02, 'c', x, 0.1 + y, 0); C.fix(g, 0.035, 0.035, 0.025, 0xf0c828, 0, 0.1, 0.005); } },
  { name: 'Unicorn horn', build(h, C, top) { const g = pivot(h, 0, top - 0.04, 0.08); g.rotation.x = 0.35;
    for (let k = 0; k < 4; k++) { const b = C.box(g, 0.07 - k * 0.014, 0.07, 0.07 - k * 0.014, k % 2 ? 'l' : 'c', 0, 0.035 + k * 0.065, 0); b.rotation.y = k * 0.4; }
    glow(C.box(g, 0.02, 0.05, 0.02, 'l', 0, 0.3, 0), C.hex('l')); } },
  { name: 'Crown', build(h, C, top) {
    C.box(h, 0.26, 0.06, 0.26, 'c', 0, top + 0.03, 0);
    for (const [x, z] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11], [0, 0.11], [0, -0.11]]) C.box(h, 0.045, 0.07, 0.045, 'c', x, top + 0.09, z);
    glow(C.fix(h, 0.05, 0.04, 0.02, 0xe13c3c, 0, top + 0.03, 0.135), 0x801010); } },
  { name: 'Rain cloud', build(h, C, top, P) {                                            // its own little cloud, raining
    const g = pivot(h, 0, top + 0.22, -0.02);
    for (const [x, y, w] of [[0, 0.02, 0.24], [-0.1, 0, 0.14], [0.11, -0.005, 0.15]]) C.box(g, w, 0.09, 0.14, 'l', x, y, 0);
    for (const [x, d] of [[-0.08, 0.1], [-0.02, 0.15], [0.05, 0.08], [0.1, 0.13]]) C.box(g, 0.018, 0.05, 0.018, 'c', x, -0.05 - d / 2, (x * 7) % 0.05);
    (P.wobble ||= []).push({ g, axis: 'z', speed: 1.6, phase: 0, amp: 0.08 }); } },
];

export const KIT = { body: BODIES, head: HEADS, eyes: EYES, legs: LEGS, tail: TAILS, back: BACKS, extra: EXTRAS };
export const partName = (slot, i) => KIT[slot][i]?.name ?? '';

// The bare start (owner 2026-11-08: "a bare skeleton, body first"): a plain grey body with a plain head, simple eyes and stubby legs.
export const BARE = Object.freeze({ n: '', p: [0, 0, 0, 1, 0, 0, 0], c: [10, 10, 11, 10, 10, 10, 2] });
// Zenithar's own design (STORY.md: Solenne drew it): every part from the kit; the spec checks it builds.
export const ZENITHAR = Object.freeze({ n: 'Zenithar', p: [6, 7, 0, 3, 6, 6, 3], c: [10, 2, 7, 2, 10, 10, 2] });

// ---- names ----
const HEAD_START = ['Bloc', 'Fox', 'Bun', 'Kit', 'Peep', 'Drak', 'Bear', 'Crown', 'Shroom', 'Robo', 'Chomp'];
const BACK_END = ['', 'wing', 'flap', 'flutter', 'spike', 'shell', 'glory', 'sail', 'jet', 'copter', 'sprout'];
const TAIL_END = ['', 'tail', 'brush', 'spike', 'curl', 'fin', 'twinkle', 'fan', 'zap', 'rocket', 'splash'];
const BODY_END = ['ball', 'paw', 'top', 'tank', 'bean', 'noodle', 'mane', 'wobble', 'tower', 'bot'];
// A name from the parts ("Foxwing", "Bunflutter"); the child can type their own.
export function kitName(d) {
  const [b, h, , , t, k] = d.p;
  return HEAD_START[h] + (BACK_END[k] || TAIL_END[t] || BODY_END[b]);
}
const SYL_A = ['Zi', 'Bo', 'Lu', 'Ki', 'Mo', 'Pa', 'Ri', 'Su', 'Ta', 'Wo', 'Fe', 'Ny', 'Glo', 'Spa', 'Twi', 'Bru'];
const SYL_B = ['ppy', 'nix', 'zle', 'mo', 'rri', 'blo', 'nka', 'sh', 'xel', 'ffin', 'lla', 'ro', 'by', 'tto'];
const SYL_C = ['', '', 'o', 'a', 'kins', 'zu', 'ly'];
// A silly made-up name from a number (the 🎲 button passes a fresh one each tap).
export const randomName = k => {
  const h = Math.abs(Math.imul(k | 0, 2654435761)) >>> 0;
  return (SYL_A[h % SYL_A.length] + SYL_B[(h >>> 8) % SYL_B.length] + SYL_C[(h >>> 16) % SYL_C.length]).slice(0, NAME_MAX);
};
export function cleanName(n, d) {
  const s = typeof n === 'string' ? n.replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
  return s || kitName(d);
}

// ---- the saved design ----
const okIndex = (n, len) => Number.isInteger(n) && n >= 0 && n < len;
export function isKitDesign(d) { return !!d && typeof d === 'object' && !Array.isArray(d) && Array.isArray(d.p); }
// Any input -> a clean design (junk parts / colours -> the bare start's; a missing name -> one from the parts).
export function cleanDesign(d) {
  const src = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const p = SLOTS.map((s, i) => (Array.isArray(src.p) && okIndex(src.p[i], KIT[s].length) ? src.p[i] : BARE.p[i]));
  const c = SLOTS.map((s, i) => (Array.isArray(src.c) && okIndex(src.c[i], KIT_COLOURS.length) ? src.c[i] : BARE.c[i]));
  const out = { n: '', p, c };
  out.n = cleanName(src.n, out);
  const a = cleanLooks(src.a, n => okIndex(n, KIT_COLOURS.length)); // owner 2026-11-10: each attack's designed look (only there once designed)
  if (a) out.a = a;
  return out;
}
// How one of the guardian's attacks looks (`move` = its MOVES entry): a look its kind draws (movekinds.js makeLook), or null = the Custom
// type's paint look (an attack never designed, a helping move).
export const hexOfColour = n => (KIT_COLOURS[n]?.rainbow ? null : KIT_COLOURS[n]?.hex ?? 0xffffff);
export function lookOf(design, moveId, move) {
  if (!isKitDesign(design) || !design.a?.[moveId] || !move) return null;
  return makeLook(kindOf(moveId), design.a[moveId], hexOfColour);
}
export const designKey = d => `${d.p.join('')}.${d.c.join('-')}.${d.n}`;
export const flies = d => !!BACKS[d.p[5]]?.fly || !!LEGS[d.p[3]]?.hover;

// ---- the model (species.js buildModel: shape 'kit', m.design) ----
// A colour helper per part: box(parent, w, h, d, shade 'c' | 'l' | 'd' or a fixed hex, x, y, z). Rainbow parts get their own hue in
// parts.rainbow (animateModel makes the colours flow).
function colourer(ci, P, counter) {
  const k = KIT_COLOURS[ci] ?? KIT_COLOURS[10];
  const base = k.rainbow ? 0xd0a0ff : k.hex;
  const shades = { c: base, l: mix(base, 1.45), d: mix(base, 0.55) };
  const hex = s => (typeof s === 'number' ? s : shades[s]);
  const mark = (m, s) => { if (k.rainbow && typeof s === 'string') (P.rainbow ||= []).push({ mat: m.material, offset: (counter.n++ * 0.11) % 1, light: s }); return m; };
  return {
    hex,
    box: (g, w, h, d, s, x, y, z) => mark(box(g, w, h, d, hex(s), x, y, z), s),
    fix: (g, w, h, d, c, x, y, z) => box(g, w, h, d, c, x, y, z),
    eye: (g, w, h, d, s, x, y, z) => { const m = typeof s === 'string' ? mark(box(g, w, h, d, hex(s), x, y, z), s) : box(g, w, h, d, s, x, y, z); m.userData.eye = true; return m; },
    tag: g => { if (k.rainbow) g.traverse(o => { if (o.isMesh) mark(o, 'c'); }); }, // wings made by addWings
  };
}

export function buildKit(root, m, parts) {
  const d = cleanDesign(m.design);
  const [bi, hi, ei, li, ti, ki, xi] = d.p;
  const counter = { n: 0 };
  const C = SLOTS.map((s, i) => colourer(d.c[i], parts, counter));
  const body = BODIES[bi], leg = LEGS[li], back = BACKS[ki];
  const fly = flies(d);
  const lift = pivot(root, 0, 0, 0);                         // the whole guardian: hops (no legs) or floats (wings, a cloud)
  if (fly) { parts.bounce = lift; parts.hover = true; } else if (!leg.len) parts.bounce = lift;
  const bodyG = pivot(lift, 0, leg.len, 0);
  body.build(bodyG, C[0], parts);
  // legs
  if (leg.build) {
    const spots = leg.ring ? Array.from({ length: leg.ring }, (_, i) => { const a = (i / leg.ring) * Math.PI * 2 + 0.3; return [Math.cos(a) * body.w * 0.3, Math.sin(a) * body.w * 0.3]; })
      : leg.under ? [[0, 0]] : body.legs;
    const phases = spots.length === 2 ? [0, Math.PI] : [0, Math.PI, Math.PI, 0];
    spots.forEach(([x, z], i) => {
      const g = pivot(lift, x, leg.len, z);
      leg.build(g, C[3], parts, i);
      if (!leg.flat && !leg.under) (parts.legs ||= []).push({ g, phase: phases[i % phases.length] });
    });
  }
  // arms on an upright body (in the body's colour)
  if (body.upright) {
    [-1, 1].forEach((s, i) => { const g = pivot(bodyG, s * body.arms, 0.36, 0.03); C[0].box(g, 0.08, 0.2, 0.08, 'c', 0, -0.09, 0); C[0].box(g, 0.09, 0.05, 0.09, 'l', 0, -0.2, 0); (parts.arms ||= []).push({ g, phase: i * Math.PI }); });
  }
  // head, eyes, extra on the head
  const head = HEADS[hi];
  const hg = pivot(bodyG, 0, body.neck[0], body.neck[1]);
  parts.head = hg;
  head.build(hg, C[1], parts);
  EYES[ei].build(hg, C[2], head.face, parts);
  const extra = EXTRAS[xi];
  if (extra.build && !extra.body) extra.build(hg, C[6], head.top, parts);
  // tail, back
  if (TAILS[ti].build) { const tg = pivot(bodyG, 0, body.tail[0], body.tail[1]); parts.tail = tg; TAILS[ti].build(tg, C[4], parts); }
  if (back.build) back.build(pivot(bodyG, 0, body.back[0], body.back[1]), C[5], parts, body);
  if (extra.build && extra.body) extra.build(bodyG, C[6], { y: 0.25, z: 0, r: body.w * 0.75 + 0.15 }, parts);
  if (parts.rainbow) for (const r of parts.rainbow) r.mat.color.setHSL(r.offset, 0.75, r.light === 'd' ? 0.4 : r.light === 'l' ? 0.75 : 0.6);
}
// The recipe buildModel uses for a guardian: the kit's shape, and body / accent / belly / dark from the design (used by effects that read them).
export function kitModel(design) {
  const d = cleanDesign(design);
  const hexOf = i => (KIT_COLOURS[i]?.rainbow ? 0xd0a0ff : KIT_COLOURS[i]?.hex ?? 0xaab4be);
  const b = hexOf(d.c[0]);
  return { shape: 'kit', scale: BODIES[d.p[0]].big ? 1.2 : 1.15, design: d, body: b, accent: hexOf(d.c[6] ?? d.c[1]), belly: mix(b, 1.45), dark: mix(b, 0.55), extras: [] };
}
