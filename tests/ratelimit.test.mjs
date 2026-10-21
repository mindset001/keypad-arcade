import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter, memoryStore, offStore } from '../lib/ratelimit.js';

const T0 = 1_000_000;

test('allows up to the limit, then refuses, and says how long to wait', async () => {
  const l = createLimiter(memoryStore());
  for(let i = 1; i <= 3; i++) assert.equal((await l.hit('k', 3, 60, T0)).ok, true, 'attempt ' + i);
  const r = await l.hit('k', 3, 60, T0 + 10_000);
  assert.equal(r.ok, false); assert.equal(r.count, 4); assert.equal(r.retryAfter, 50);
});

test('the window resets by itself', async () => {
  const l = createLimiter(memoryStore());
  for(let i = 0; i < 5; i++) await l.hit('k', 3, 60, T0);
  assert.equal((await l.hit('k', 3, 60, T0 + 61_000)).ok, true);
  assert.equal((await l.hit('k', 3, 60, T0 + 61_000)).count, 2);
});

test('keys are independent', async () => {
  const l = createLimiter(memoryStore());
  for(let i = 0; i < 5; i++) await l.hit('a', 2, 60, T0);
  assert.equal((await l.hit('b', 2, 60, T0)).ok, true);
});

test('blocked() reports a full counter without counting, and clear() lifts it', async () => {
  const l = createLimiter(memoryStore());
  assert.equal((await l.blocked('k', 2, T0)).blocked, false);
  await l.hit('k', 2, 60, T0); assert.equal((await l.blocked('k', 2, T0)).blocked, false);
  await l.hit('k', 2, 60, T0);
  const b = await l.blocked('k', 2, T0 + 5000); assert.equal(b.blocked, true); assert.equal(b.retryAfter, 55);
  assert.equal((await l.blocked('k', 2, T0 + 5000)).blocked, true, 'checking twice does not change anything');
  await l.clear('k'); assert.equal((await l.blocked('k', 2, T0 + 5000)).blocked, false);
  assert.equal((await l.blocked('k', 2, T0 + 120_000)).blocked, false);
});

test('the off store never limits', async () => {
  const l = createLimiter(offStore);
  for(let i = 0; i < 50; i++) assert.equal((await l.hit('k', 1, 60, T0)).ok, true);
  assert.equal((await l.blocked('k', 1, T0)).blocked, false);
});
