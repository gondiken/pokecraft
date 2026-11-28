// The Parkour race's rules, pure (Node-runnable; parkourrace.js is the game for two on top of them). Owner 2026-11-28: both friends
// race the Obstacle Course (gym 30) against each other: both on the start platform, 3-2-1-Go, first to the finish flag wins. Each
// runs on their own screen and times their own run from their own Go (the course clock, obstaclecourse.js), so a slow internet
// never costs a place: the smaller time wins, and the leader (side 0) says so.
import { decide } from './matchrules.js';

export const PARKOUR = {
  count: 3,     // seconds of 3-2-1 before Go (real seconds)
  send: 0.3,    // how often my furthest flag (and my time, once I have one) goes to the friend
  grace: 2,     // leader: after my own finish, how long a friend's finish may still be on its way
  done: 5,      // seconds to cheer after the result, then both are out
  spots: [[14, -16], [17, -16]], // the start platform S0 (d 13..19, s -19..-13), side 0 and side 1, three blocks apart
  way: [0, 1],  // both face the first jump (towards +s, like the start flag)
};

// The two start spots on a built Obstacle Course (gymplace / buildObstacleCourse's gym object): [[x, y, z, yaw], [x, y, z, yaw]].
export function startSpots(gym) {
  const { x: x0, z: z0, front, side } = gym, y = gym.pieces.S0.y + 1;
  const col = (d, s) => [x0 + front[0] * d + side[0] * s, z0 + front[1] * d + side[1] * s];
  const [dd, ds] = PARKOUR.way, wx = front[0] * dd + side[0] * ds, wz = front[1] * dd + side[1] * ds;
  const yaw = Math.atan2(-wx, -wz);
  return PARKOUR.spots.map(([d, s]) => { const [x, z] = col(d, s); return [x + 0.5, y, z + 0.5, yaw]; });
}

// "You're 1st!" from the furthest flags (and finishes) of the two.
export function standing(mine, theirs, myTime = null, theirTime = null) {
  if (myTime != null) return "You're 1st!";
  if (theirTime != null) return "You're 2nd!";
  return mine > theirs ? "You're 1st!" : mine < theirs ? "You're 2nd!" : 'Neck and neck!';
}

// The leader's judge. times[0] = the leader's run, times[1] = the friend's (seconds from each one's own Go, null = not yet).
// step(dt, clock) -> the winner (0, 1, or null for a dead heat) once it is decided, else undefined. `clock` = the leader's run so far.
export class RaceJudge {
  constructor() { this.times = [null, null]; this.graceT = null; this.result = undefined; }
  set(side, t) { if (Number.isFinite(t) && t > 0 && this.times[side] == null) this.times[side] = t; }
  step(dt, clock) {
    if (this.result !== undefined) return this.result;
    const [a, b] = this.times;
    if (a != null && b != null) return (this.result = decide(a, b));
    if (b != null && clock >= b) return (this.result = 1); // their time has passed on my clock: I cannot beat it
    if (a != null) {
      if (this.graceT == null) this.graceT = PARKOUR.grace;
      else this.graceT -= dt;
      if (this.graceT <= 0) return (this.result = decide(a, b)); // their finish never came: mine stands
    }
    return undefined;
  }
}
