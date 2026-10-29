import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, currentId, beginTurn, expireTurn, revealAnswer, advanceTurn, nextRound, validSession } from '../static/flow.js';

const ids = Array.from({ length: 100 }, (_, i) => `material-${i}`);
const completeTurn = (session, now = 1000) => {
  assert.equal(beginTurn(session, now), true);
  assert.equal(expireTurn(session, now + 15000), true);
  assert.equal(revealAnswer(session), true);
  assert.equal(advanceTurn(session), true);
};

test('Start is required, material expires after 15 seconds, reveal and next are separate', () => {
  const s = createSession(ids);
  assert.equal(s.phase, 'ready');
  assert.equal(expireTurn(s, 999999), false);
  assert.equal(revealAnswer(s), false);
  assert.equal(advanceTurn(s), false);
  assert.equal(beginTurn(s, 1000), true);
  assert.equal(beginTurn(s, 5000), false);
  assert.equal(s.deadline, 16000);
  assert.equal(revealAnswer(s), false);
  assert.equal(expireTurn(s, 15999), false);
  assert.equal(expireTurn(s, 16000), true);
  assert.equal(s.phase, 'blank');
  assert.equal(advanceTurn(s), false);
  assert.equal(revealAnswer(s), true);
  assert.equal(revealAnswer(s), false);
  assert.equal(s.phase, 'answer');
  assert.equal(advanceTurn(s), true);
  assert.equal(s.phase, 'ready');
  assert.equal(s.turn, 1);
});

test('exactly three turns per round and no repeats across all 33 full rounds', () => {
  const s = createSession(ids);
  const seen = new Set();
  for (let round = 1; round <= 33; round++) {
    assert.equal(s.round, round);
    for (let turn = 0; turn < 3; turn++) {
      assert.equal(s.turn, turn);
      assert.equal(seen.has(currentId(s)), false);
      seen.add(currentId(s));
      completeTurn(s);
      assert.equal(s.phase, turn === 2 ? 'roundEnd' : 'ready');
      assert.equal(validSession(s, ids), true);
    }
    assert.equal(nextRound(s), true);
    assert.equal(s.phase, round === 33 ? 'exhausted' : 'ready');
  }
  assert.equal(seen.size, 99);
  assert.equal(s.order.length - s.cursor, 1);
  assert.equal(beginTurn(s), false);
  assert.equal(nextRound(s), false);
});

test('reload preserves the deck and original deadline, even after the tab was away', () => {
  const s = createSession(ids);
  beginTurn(s, 1000);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(validSession(restored, ids), true);
  assert.deepEqual(restored.order, s.order);
  assert.equal(currentId(restored), currentId(s));
  assert.equal(expireTurn(restored, 10000), false);
  assert.equal(restored.deadline, 16000);
  assert.equal(expireTurn(restored, 20000), true);
  assert.equal(restored.phase, 'blank');
  assert.equal(validSession(restored, ids), true);
});

test('reject stale or damaged history instead of accepting duplicate materials', () => {
  const s = createSession(ids);
  assert.equal(validSession(s, ids), true);
  const duplicate = structuredClone(s);
  duplicate.order[0] = duplicate.order[1];
  assert.equal(validSession(duplicate, ids), false);
  assert.equal(validSession({ ...s, version: 1 }, ids), false);
  assert.equal(validSession({ ...s, cursor: 4 }, ids), false);
  assert.equal(validSession({ ...s, phase: 'running', deadline: null }, ids), false);
});
