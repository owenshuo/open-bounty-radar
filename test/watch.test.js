import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPullRequest, latestActivity, needsAttention, summarizeChecks} from '../src/watch.js';

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
