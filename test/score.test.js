import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCandidate} from '../src/score.js';

test('penalizes crowded issues', () => {
  const base = {
    amount: 1000,
    pullRequestCount: 0,
    state: 'open',
    updatedAt: new Date().toISOString(),
  };
  const quiet = scoreCandidate(base);
  const crowded = scoreCandidate({...base, pullRequestCount: 5});
  assert.ok(quiet.total > crowded.total);
});

test('penalizes closed issues', () => {
  const updatedAt = new Date().toISOString();
  assert.ok(
    scoreCandidate({amount: 1000, pullRequestCount: 0, state: 'open', updatedAt}).total >
      scoreCandidate({amount: 1000, pullRequestCount: 0, state: 'closed', updatedAt}).total,
  );
});
