import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUBS, CLUB_LVL, ROUNDS, newLeague, tally, standings, leagueOpp, leagueRecord, poisson } from '../lib/arcade/league.js';
import { seeded } from './helpers.mjs';

test('fixtures: 5 rounds of 3 matches, every club plays once per round', () => {
  assert.equal(ROUNDS.length, 5);
  for(const round of ROUNDS){
    assert.equal(round.length, 3);
    assert.deepEqual(round.flat().sort(), [0, 1, 2, 3, 4, 5]);
  }
});

test('fixtures: every pair of clubs meets exactly once (15 matches)', () => {
  const pairs = ROUNDS.flat().map(([a, b]) => [a, b].sort().join('-'));
  assert.equal(new Set(pairs).size, 15);
  assert.equal(pairs.length, 15);
});

test('the player meets each of the five opponents exactly once', () => {
  const faced = [];
  const L = newLeague();
  for(let r = 0; r < 5; r++){ L.round = r; faced.push(leagueOpp(L)); }
  assert.deepEqual(faced.sort(), [1, 2, 3, 4, 5]);
  assert.equal(CLUB_LVL.length, CLUBS.length);
});

test('tally: 3 points for a win, 1 each for a draw, goals recorded', () => {
  const L = newLeague();
  tally(L, 0, 1, 3, 1); tally(L, 2, 3, 2, 2);
  assert.deepEqual([L.rows[0].pts, L.rows[1].pts, L.rows[2].pts, L.rows[3].pts], [3, 0, 1, 1]);
  assert.equal(L.rows[0].gf, 3); assert.equal(L.rows[0].ga, 1); assert.equal(L.rows[1].gf, 1);
  assert.deepEqual([L.rows[0].w, L.rows[1].l, L.rows[2].d], [1, 1, 1]);
});

test('standings: points, then goal difference, then goals scored, then club order', () => {
  const L = newLeague();
  Object.assign(L.rows[1], { pts:6, gf:5, ga:1 });   // gd +4
  Object.assign(L.rows[2], { pts:6, gf:4, ga:1 });   // gd +3
  Object.assign(L.rows[3], { pts:6, gf:6, ga:3 });   // gd +3, more goals than club 2
  Object.assign(L.rows[4], { pts:9 });
  assert.deepEqual(standings(L).slice(0, 4).map(r => r.i), [4, 1, 3, 2]);
});

test('leagueRecord: advances the round and every club plays one game each round', () => {
  seeded(7, () => {
    const L = newLeague();
    for(let r = 0; r < 5; r++){
      leagueRecord(L, r % 3, 1);
      assert.equal(L.round, r + 1);
      assert.ok(L.rows.every(x => x.p === r + 1), `round ${r + 1}: everyone has played ${r + 1}`);
    }
    // goals for and against balance across the whole table
    assert.equal(L.rows.reduce((n, x) => n + x.gf, 0), L.rows.reduce((n, x) => n + x.ga, 0));
    assert.equal(L.rows[0].p, 5);
  });
});

test('poisson: mean is close to lambda and never negative', () => {
  seeded(42, () => {
    let sum = 0, min = Infinity; const n = 20000;
    for(let i = 0; i < n; i++){ const g = poisson(1.3); sum += g; min = Math.min(min, g); }
    assert.ok(Math.abs(sum / n - 1.3) < 0.06, `mean ${sum / n}`);
    assert.ok(min >= 0);
  });
});
