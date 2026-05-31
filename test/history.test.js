import test from 'node:test';
import assert from 'node:assert/strict';
import {historyEntry} from '../src/history.js';

test('builds scan history entries', () => {
  const entry = historyEntry('scan', {
    generatedAt: '2026-01-01T00:00:00Z',
    candidates: [{analysis: {action: 'act-now', riskTags: []}}],
    errors: [],
  });

  assert.equal(entry.kind, 'scan');
  assert.equal(entry.candidates, 1);
  assert.equal(entry.actions['act-now'], 1);
});

test('builds watch history entries', () => {
  const entry = historyEntry('watch', {
    generatedAt: '2026-01-01T00:00:00Z',
    pullRequests: [{state: 'open', merged: false, needsAttention: true}],
    errors: [],
  });

  assert.equal(entry.kind, 'watch');
  assert.equal(entry.status.needs_attention, 1);
});
