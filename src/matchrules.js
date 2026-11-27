// The rules of Playland's games for two friends (owner 2026-11-26) that need no browser: where everybody stands at a kick-off,
// which side a goal or basket counts for, the score, and who won a kart race. Pure (imports only stadium.js and ballphysics.js), Node-runnable.
import { goalOf, BALL_R } from './stadium.js';
import { touchKick } from './ballphysics.js';

export const MATCH = { ready: 2, goalPause: 1.8, outPause: 0.8, claimFor: 2, edge: 0.4, highY: 12.5, highFor: 1 };

// The two sports. Side 0 (the leader) starts in the west half and scores in the east goal / hoop (index 1); side 1 the other way.
// `has` = the side that gets the ball at a kick-off (the one who was scored on; the invited friend first).
export const SPORTS = {
  football: {
    key: 'foot', icon: '⚽', name: 'Football', to: 3, word: 'Kick!', shout: 'GOAL!', cheer: 'goalcheer', thing: 'goal',
    box: part => part.pitchBox, centre: part => part.ballSpot,
    ballAt: part => part.ballSpot,
    standAt: (part, side, has) => (side === has ? 3 : 10),       // blocks from the centre, in your own half
    target: (part, i) => ({ x: part.goals[i].mid[0], y: part.goals[i].top + 2.2, z: part.goals[i].mid[1] }),
    // which goal the ball is in now (-1 = none)
    scored: (part, ball) => goalOf(part, ball.pos),
  },
  hoops: {
    key: 'hoop', icon: '🏀', name: 'Basketball', to: 5, word: 'Shoot!', shout: 'Swish!', cheer: 'netswish', thing: 'hoop',
    box: part => part.courtBox, centre: part => part.courtSpot,
    ballAt: (part, has) => [part.courtSpot[0] + (has === 0 ? -6 : 6), part.courtSpot[1], part.courtSpot[2]],
    standAt: (part, side, has) => (side === has ? 8 : 5),         // with the ball: behind it; without: in front of your own hoop
    target: (part, i) => ({ x: part.hoops[i].hole[0], y: part.hoops[i].rimMid + 4.6, z: part.hoops[i].hole[1] }),
    scored: (part, ball, prevY) => part.hoops.findIndex(h => prevY >= h.rimMid && ball.pos.y < h.rimMid && Math.abs(ball.pos.x - h.hole[0]) < 1 && Math.abs(ball.pos.z - h.hole[1]) < 1),
  },
};
// A player as the ball's owner sees them: a solid box at their feet position (Ball.update's obstacle shape). The ball bounces off it.
export const BODY = { half: 0.35, height: 1.8, still: 0.5, own: 0.3 };
export const bodyBox = (pos, id = 'friend') => ({ x0: pos.x - BODY.half, x1: pos.x + BODY.half, y0: pos.y, y1: pos.y + BODY.height, z0: pos.z - BODY.half, z1: pos.z + BODY.half, v: { x: 0, y: 0, z: 0 }, id });
// One frame of a match ball in one browser (owner 2026-11-27: "the ball doesn't go through the other player?"). A ball never goes
// through a player, however hard and close the kick and however slow the frames:
//   - my own body: running into the ball kicks it (ballphysics touchKick, as in the stadium's own game); standing (slower than
//     BODY.still) I am a solid box the ball bounces off, checked in the ball's own 1/120 s sub-steps (never skipped over, never
//     noticed too late); not for BODY.own seconds after my own kick, so a ball beside my feet does not bounce off me;
//   - `friend` (their feet position, only handed in by the ball's OWNER): a solid box too, so my kick at them bounces off at
//     once on my screen instead of waiting for their browser to say so.
// pl = ballphysics' player box. Returns { touch: 'kick' | 'nudge' | 'body' | null (any of them = the ball is mine now), blocked }.
export function ballFrame(ball, dt, pl, friend = null) {
  const out = { touch: touchKick(ball, pl), blocked: false }, boxes = [];
  if (Math.hypot(pl.vx, pl.vz) < BODY.still && ball.time - ball.kickedAt >= BODY.own) boxes.push(bodyBox(pl, 'me'));
  if (friend) boxes.push(bodyBox(friend));
  ball.update(dt, boxes.length ? () => boxes : undefined);
  for (const ev of ball.events) if (ev.kind === 'keeper') { if (ev.obs?.id === 'me') out.touch ||= 'body'; else out.blocked = true; }
  return out;
}
// The side that scores when the ball is in goal / hoop i.
export const scorerOf = i => (i === 1 ? 0 : 1);
// Where side `side` stands at a kick-off: [x, y (feet), z, yaw].
export function startSpot(sport, part, side, has) {
  const c = sport.centre(part), d = sport.standAt(part, side, has), sx = side === 0 ? -1 : 1;
  return [c[0] + sx * d, c[1] - BALL_R - 0.001, c[2], side === 0 ? -Math.PI / 2 : Math.PI / 2];
}

/* ---- the score of a match for two: sides 0 (the leader) and 1 ---- */
export class MatchScore {
  constructor(to) { this.to = to; this.score = [0, 0]; this.n = 1; }
  add(side) { this.score[side]++; return this.score[side] >= this.to; }
  get winner() { return this.score[0] >= this.to ? 0 : this.score[1] >= this.to ? 1 : null; }
  load(score, n) { if (Array.isArray(score) && score.length === 2 && score.every(Number.isInteger)) this.score = [...score]; if (Number.isInteger(n)) this.n = n; }
}

/* ---- a kart race for two ---- */
export const DUEL = { send: 0.5, grace: 1.2, done: 5 };
// Who won, from the two race times (null = not finished): side 0, side 1, or null for a dead heat.
export function decide(a, b) {
  if (a == null && b == null) return null;
  if (b == null) return 0;
  if (a == null) return 1;
  return Math.abs(a - b) < 0.005 ? null : a < b ? 0 : 1;
}
