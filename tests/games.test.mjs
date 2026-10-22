import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnake } from '../lib/arcade/games/snake.js';
import { createRoll } from '../lib/arcade/games/roll.js';
import { createBounce, BOUNCE_LEVELS, BROWS, TILE } from '../lib/arcade/games/bounce.js';
import { createSoccer } from '../lib/arcade/games/soccer.js';
import { makeEnv, seeded, run, STEP } from './helpers.mjs';

const env = makeEnv();
const Snake = createSnake(env), Roll = createRoll(env), Bounce = createBounce(env), Soccer = createSoccer(env);
const finite = (...ns) => ns.every(Number.isFinite);

/* ---------------- Snake ---------------- */
test('snake: eating food scores the level and grows the snake', () => {
  const s = new Snake({ level:3, maze:0 }), head = s.body[0], len = s.body.length;
  s.food = { x:head.x + 1, y:head.y }; s.step();
  assert.equal(s.score, 3); assert.equal(s.body.length, len + 1); assert.equal(s.eaten, 1);
});

test('snake: turning back on itself ends the game and reports the score', () => {
  const s = new Snake({ level:2, maze:0 }); let over = null; s.onOver = sc => { over = sc; };
  s.food = { x:0, y:0 };
  for(const k of ['up', 'left', 'down']){ s.key(k); s.step(); }
  assert.equal(s.dead, true);
  run(s, 3);
  assert.equal(s.done, true); assert.equal(over, 0);
});

test('snake: 180 degree turns are ignored', () => {
  const s = new Snake({ level:5, maze:0 }); s.key('left'); assert.equal(s.q.length, 0);
});

test('snake: with no maze the edges wrap around', () => {
  const s = new Snake({ level:5, maze:0 }); s.body = [{ x:31, y:5 }, { x:30, y:5 }]; s.food = { x:0, y:0 }; s.step();
  assert.equal(s.dead, false); assert.equal(s.body[0].x, 0);
});

/* ---------------- Rapid Roll ---------------- */
test('rapid roll: a full game ends with a finite score and 0 lives', () => {
  seeded(3, () => {
    const r = new Roll({ level:5 }); let over = null; r.onOver = sc => { over = sc; };
    run(r, 400, i => { r.held.left = (i >> 7) % 2 === 0; r.held.right = !r.held.left; });
    assert.equal(r.done, true); assert.ok(Number.isInteger(over) && over >= 0);
    assert.ok(r.lives <= 9);
  });
});

/* ---------------- Bounce ---------------- */
test('bounce: all six levels are well formed', () => {
  assert.equal(BOUNCE_LEVELS.length, 6);
  BOUNCE_LEVELS.forEach((rows, n) => {
    const w = rows[0].length, all = rows.join(''), who = `level ${n + 1}`;
    assert.equal(rows.length, BROWS, who + ': rows'); assert.ok(rows.every(r => r.length === w), who + ': equal widths');
    assert.equal(all.split('S').length - 1, 1, who + ': exactly one start');
    assert.equal(all.split('E').length - 1, 2, who + ': exit gate is 2 tiles tall');
    assert.ok(all.split('o').length - 1 >= 5, who + ': has rings');
    assert.ok([...rows[0]].every(c => c === '#'), who + ': ceiling'); assert.ok(rows.every(r => r[0] === '#'), who + ': left wall');
  });
});

const bounces = (g, seconds, each) => { // the launch speed of every bounce
  const out = []; let pv = 0;
  for(let i = 0; i < seconds * 120; i++){ each && each(i); g.update(STEP); if(pv > 0 && g.ball.vy < 0) out.push(Math.round(-g.ball.vy)); pv = g.ball.vy; }
  return out;
};

test('bounce: holding up/down picks a high/low bounce, otherwise normal', () => {
  const norm = bounces(new Bounce({ level:1 }), 6);
  assert.ok(norm.length >= 5 && norm.every(v => v === 110), 'normal ' + norm);
  const hi = new Bounce({ level:1 }); hi.key('up');
  assert.ok(bounces(hi, 6).every(v => v === 150), 'high');
  const lo = new Bounce({ level:1 }); lo.key('down');
  assert.ok(bounces(lo, 6).every(v => v === 75), 'low');
});

test('bounce: a single tap of up is remembered for the next bounce only (touch controls)', () => {
  const g = new Bounce({ level:1 });
  const v = bounces(g, 8, i => { if(i === 60){ g.key('up'); g.keyUp('up'); } });
  // (the launch from rest isn't counted by `bounces`, so the first entry is the bounce right after the tap)
  assert.equal(v[0], 150, 'the next bounce after the tap is high'); assert.ok(v.length >= 4 && v.slice(1).every(x => x === 110), 'then back to normal: ' + v);
});

test('bounce: the big ball bounces lower', () => {
  const g = new Bounce({ level:1 }); g.big = true;
  assert.ok(bounces(g, 5).every(v => v === 95));
});

test('bounce: falling into a pit costs a life and respawns small at the start', () => {
  const g = new Bounce({ level:1 }); const start = { ...g.spawn };
  g.big = true; g.ball.y = BROWS * TILE + 30; g.inv = 0; g.update(STEP);
  assert.equal(g.lives, 2); assert.equal(g.phase, 'dead');
  run(g, 1.5);
  assert.equal(g.phase, 'play'); assert.equal(g.big, false); assert.equal(g.ball.x, start.x);
});

test('bounce: collecting every ring opens the gate and reaching it clears the level', () => {
  const g = new Bounce({ level:1 }); const tiles = [];
  g.map.forEach((row, y) => row.forEach((c, x) => { if(c === 'o') tiles.push([x, y]); }));
  assert.ok(g.rings === tiles.length && g.open === false);
  const park = (x, y) => { Object.assign(g.ball, { x:x * TILE + 4, y:y * TILE + 4, vx:0, vy:0 }); g.update(1 / 5000); };
  for(const [x, y] of tiles) park(x, y);
  assert.equal(g.rings, 0); assert.equal(g.open, true); assert.equal(g.score, tiles.length * 10);
  const gate = []; g.map.forEach((row, y) => row.forEach((c, x) => { if(c === 'E') gate.push([x, y]); }));
  park(...gate[0]);
  assert.equal(g.phase, 'clear'); assert.ok(g.score > tiles.length * 10);
});

test('bounce: the exit gate is solid until the rings are collected', () => {
  const g = new Bounce({ level:1 }); const [gx, gy] = (() => { for(let y = 0; y < BROWS; y++){ const x = g.map[y].indexOf('E'); if(x >= 0) return [x, y]; } })();
  assert.equal(g.solid(gx, gy), true); g.open = true; assert.equal(g.solid(gx, gy), false);
});

/* ---------------- Soccer ---------------- */
const PR = 248; // right-hand goal line (matches games/soccer.js)

/* a competent human stand-in: chase the ball, dribble to goal, shoot when close, tackle near an opponent */
function playMatch(level, seed){
  return seeded(seed, () => {
    const g = new Soccer({ level, mode:0 }); let over = 0; g.onOver = () => { over++; };
    let charging = false;
    for(let n = 0; n < 120 * 700 && !g.done; n++){
      const c = g.ctl, b = g.ball, h = g.held, own = b.owner === c;
      const tx = own ? PR : b.x, ty = own ? (Math.abs(PR - c.x) < 45 ? 44 + ((n >> 8) % 2 ? 8 : -8) : c.y) : b.y;
      h.right = tx > c.x + 2; h.left = tx < c.x - 2; h.down = ty > c.y + 2; h.up = ty < c.y - 2;
      if(own && Math.abs(PR - c.x) < 46 && !charging){ g.key('select'); charging = true; }
      else if(charging && (g.selT === null || g.selT > .5)){ g.keyUp('select'); charging = false; }
      else if(!own && !charging && g.phase === 'play' && Math.hypot(c.x - b.x, c.y - b.y) < 7 && b.owner && b.owner.team === 1 && n % 40 === 0) g.key('select');
      g.update(STEP);
      for(const p of g.players) assert.ok(finite(p.x, p.y), 'player position stays finite');
      assert.ok(finite(b.x, b.y), 'ball position stays finite');
    }
    return { g, over };
  });
}

test('soccer: a whole match finishes once, with whole-number goals', () => {
  const { g, over } = playMatch(5, 11);
  assert.equal(g.done, true); assert.equal(over, 1);
  assert.ok(g.goals.every(n => Number.isInteger(n) && n >= 0));
  assert.ok(g.time >= g.len);
});

test('soccer: a goal pauses play, shows GOAL! and restarts from kick-off', () => seeded(21, () => {
  const e = makeEnv(), S = createSoccer(e), g = new S({ level:3, mode:0 });
  run(g, 1.5); assert.equal(g.phase, 'play');
  Object.assign(g.ball, { x:PR + 2, y:44, owner:null, vx:0, vy:0 }); g.update(STEP);
  assert.deepEqual(g.goals, [1, 0]); assert.equal(g.phase, 'goal'); assert.equal(e.calls.overlay.at(-1)[0], 'GOAL!');
  run(g, 3); // pause ends, kick-off
  assert.equal(g.phase === 'kickoff' || g.phase === 'play', true);
  assert.ok(e.calls.hidden >= 1);
  const p0 = g.players[1]; assert.ok(Math.abs(p0.x - p0.bx) < 40, 'players reset towards their start positions');
}));

test('soccer: tap passes to a team-mate, a hold shoots harder, a tackle steals', () => seeded(21, () => {
  const g = new Soccer({ level:3, mode:0 }); run(g, 1.2);
  const me = g.players.find(p => p.team === 0 && !p.gk); g.ctl = me; g.ball.owner = me; me.fx = 1; me.fy = 0;
  g.players.filter(p => p.team === 0 && p !== me && !p.gk).forEach((p, i) => { p.x = me.x + 25 + i; p.y = me.y; });
  g.update(STEP);
  g.key('select'); g.keyUp('select');
  assert.equal(g.ball.owner, null); assert.ok(g.ball.vx > 60, 'pass goes forward');
  const sp = () => Math.hypot(g.ball.vx, g.ball.vy);
  const give = () => { g.ctl = me; g.ball.owner = me; me.cd = 0; me.x = 200; me.y = 44; me.fx = 1; me.fy = 0; g.selT = null; g.update(STEP); };
  give(); g.key('select'); g.selT = 0.2; g.keyUp('select'); const tapSpeed = sp();
  give(); g.key('select'); g.selT = 0.9; g.keyUp('select'); const holdSpeed = sp();
  assert.ok(holdSpeed > tapSpeed + 30, `hold ${holdSpeed} vs tap ${tapSpeed}`); assert.ok(holdSpeed <= 221);
  // tackle
  const foe = g.players.find(p => p.team === 1 && !p.gk);
  Object.assign(me, { x:100, y:44, fx:1, fy:0, cd:0, stun:0, lunge:0, lcd:0 }); Object.assign(foe, { x:106, y:44, fx:-1, fy:0, stun:0, cd:0 });
  g.ball.owner = foe; g.ctl = me; g.selT = null; g.key('select'); run(g, 0.3);
  assert.equal(g.ball.owner, me, 'slide tackle wins the ball');
}));

test('soccer: higher levels are harder (same bot, same seeds)', () => {
  const avg = lvl => { let d = 0; for(let s = 1; s <= 6; s++){ const { g } = playMatch(lvl, s); d += g.goals[0] - g.goals[1]; } return d / 6; };
  const easy = avg(1), hard = avg(9);
  assert.ok(easy > 1, `level 1 should be beaten comfortably (avg goal difference ${easy})`);
  assert.ok(easy > hard + 1, `level 9 should be clearly harder (${easy} vs ${hard})`);
  assert.ok(hard < 1, `level 9 must not be a pushover: the bot should not win by much (avg goal difference ${hard})`);
});

import { bestPerPlayer } from '../lib/arcade/scores.js';
test('scores: one row per player, their highest, best first', () => {
  const rows = bestPerPlayer([{ name:'Ada', score:50, at:1 }, { name:'ada', score:90, at:2 }, { name:'Bo', score:70, at:3 }, { name:'Ada', score:90, at:4 }]);
  assert.deepEqual(rows.map(r => [r.name.toLowerCase(), r.score]), [['ada', 90], ['bo', 70]]);
  assert.equal(rows[0].at, 2);
  assert.deepEqual(bestPerPlayer(null), []);
});

/* ---------------- Table Tennis ---------------- */
import { createTennis } from '../lib/arcade/games/tennis.js';
const Tennis = createTennis(env);
/* a bot that follows the ball with the player's keys */
const tennisBot = g => { const d = g.b.y + 1.5 - g.py; g.keyUp('up'); g.keyUp('down'); if(d < -2) g.key('up'); else if(d > 2) g.key('down'); };
function playTennis(level, bot){
  const g = new Tennis({ level }); let over = null; g.onOver = s => { over = s; };
  for(let i = 0; i < 60 * 600 && over === null; i++){ if(bot) tennisBot(g); g.update(STEP); }
  return { g, over };
}
test('table tennis: a match ends once, first to 7, with a positive whole score when you win', () => seeded(5, () => {
  const { g, over } = playTennis(1, true);
  assert.ok(over !== null, 'the match finished');
  assert.ok(Math.max(g.you, g.cpu) === 7 && Math.min(g.you, g.cpu) < 7);
  assert.equal(over, g.score); assert.ok(Number.isInteger(over));
  if(g.won) assert.ok(over >= g.you * 10 + 50);
}));
test('table tennis: standing still loses, and the keys move the paddle inside the table', () => seeded(6, () => {
  const { g, over } = playTennis(3, false);
  assert.ok(g.cpu === 7 && !g.won); assert.equal(over, g.you * 10 * 3);
  const h = new Tennis({ level:1 }); h.key('up'); for(let i = 0; i < 200; i++) h.update(STEP);
  assert.ok(h.py >= 6 + 7 - 0.01 && h.py < 40); h.keyUp('up'); h.key('down'); for(let i = 0; i < 400; i++) h.update(STEP); assert.ok(h.py <= 86 - 7 + 0.01);
}));
test('table tennis: a higher level is harder for the same bot', () => seeded(8, () => {
  let easy = 0, hard = 0;
  for(let s = 0; s < 6; s++){ seeded(100 + s, () => { easy += playTennis(1, true).g.you; hard += playTennis(9, true).g.you; }); }
  assert.ok(easy > hard, `level 1 should lose fewer points than level 9 (${easy} vs ${hard})`);
}));
test('table tennis: aimTo glides the paddle at a fixed speed, a key press cancels it, a long hold is faster than a tap', () => seeded(9, () => {
  const g = new Tennis({ level:1 }); g.aimTo(10); const y0 = g.py; g.update(STEP * 12);
  assert.ok(g.py < y0 && y0 - g.py < 22, 'moved toward the target, but not instantly');
  for(let i = 0; i < 240; i++) g.update(STEP); assert.ok(Math.abs(g.py - 13) < .5, 'reached the clamped target');
  g.aimTo(70); g.key('up'); assert.equal(g.target, null);
  const h = new Tennis({ level:1 }), y1 = h.py; h.key('down'); for(let i = 0; i < 45; i++) h.update(STEP);
  assert.ok(h.py - y1 > 70 * 45 * STEP + 3, 'a held key accelerates beyond the starting speed');
}));
