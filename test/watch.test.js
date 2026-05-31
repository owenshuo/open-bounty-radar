import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPullRequest, latestActivity, needsAttention, summarizeChecks} from '../src/watch.js';
import {groupWatchItems, watchAction, winnerSignals} from '../src/watch-insights.js';

test('summarizes failing checks', () => {
  assert.deepEqual(
    summarizeChecks({
      checkRuns: [{status: 'completed', conclusion: 'success'}, {status: 'completed', conclusion: 'failure'}],
      statuses: [],
    }),
    {state: 'failing', total: 2, failing: 1, pending: 0},
  );
});

test('classifies merged pull requests first', () => {
  assert.equal(classifyPullRequest({merged_at: '2026-01-01T00:00:00Z', state: 'closed'}, {state: 'failing'}), 'merged');
});

test('marks maintainer activity as needing attention', () => {
  assert.equal(
    needsAttention({
      status: 'open',
      latestActivity: [{association: 'COLLABORATOR'}],
    }),
    true,
  );
});

test('marks requested changes as needing attention', () => {
  assert.equal(
    needsAttention({
      status: 'open',
      latestActivity: [{association: 'NONE', state: 'CHANGES_REQUESTED'}],
    }),
    true,
  );
});

test('combines latest comments and reviews', () => {
  const activity = latestActivity({
    comments: [{created_at: '2026-01-02T00:00:00Z', body: 'comment', user: {login: 'alice'}}],
    reviews: [{submitted_at: '2026-01-03T00:00:00Z', state: 'APPROVED', user: {login: 'bob'}}],
  });
  assert.equal(activity[0].type, 'review');
  assert.equal(activity[0].author, 'bob');
});

test('suggests next watch actions', () => {
  assert.equal(watchAction({merged: true, state: 'closed', checks: {state: 'passing'}, latestActivity: []}), 'claim-or-confirm');
  assert.equal(watchAction({merged: false, state: 'open', checks: {state: 'failing'}, latestActivity: []}), 'fix-ci');
  assert.equal(watchAction({merged: false, state: 'open', checks: {state: 'passing'}, latestActivity: [{association: 'MEMBER'}]}), 'reply');
});

test('detects winner and payment signals', () => {
  const signals = winnerSignals({
    merged: false,
    latestActivity: [{author: 'maintainer', body: 'Winner selected, payment sent soon.'}],
  });
  assert.ok(signals.some((signal) => signal.includes('selected')));
  assert.ok(signals.some((signal) => signal.includes('payment sent')));
});

test('groups watched pull requests by status bucket', () => {
  const groups = groupWatchItems([
    {state: 'open', merged: false, needsAttention: true},
    {state: 'closed', merged: true, needsAttention: false},
  ]);
  assert.deepEqual(
    groups.map((group) => group.name),
    ['needs_attention', 'merged'],
  );
});
