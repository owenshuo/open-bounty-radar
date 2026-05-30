import test from 'node:test';
import assert from 'node:assert/strict';
import {detectReportChanges} from '../src/changes.js';

function scanReport(overrides = {}) {
  return {
    generatedAt: '2026-01-01T00:00:00Z',
    candidates: [
      {
        repository: 'owner/repo',
        number: 1,
        title: 'Paid issue',
        url: 'https://github.com/owner/repo/issues/1',
        state: 'open',
        amount: 500,
        currency: 'USD',
        pullRequestCount: 0,
        updatedAt: '2026-01-01T00:00:00Z',
        score: {total: 100},
        ...overrides,
      },
    ],
  };
}

function watchReport(overrides = {}) {
  return {
    generatedAt: '2026-01-01T00:00:00Z',
    pullRequests: [
      {
        repository: 'owner/repo',
        number: 2,
        title: 'Bounty fix',
        url: 'https://github.com/owner/repo/pull/2',
        status: 'open',
        state: 'open',
        merged: false,
        draft: false,
        checks: {state: 'passing', failing: 0, pending: 0},
        needsAttention: false,
        latestActivity: [],
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
      },
    ],
  };
}

test('initial scan run stores baseline without notification changes', () => {
  const detected = detectReportChanges('scan', scanReport(), {});
  assert.equal(detected.firstRun, true);
  assert.deepEqual(detected.changes, []);
});

test('scan detects new candidate after baseline exists', () => {
  const detected = detectReportChanges('scan', scanReport(), {scan: {items: {}}});
  assert.equal(detected.changes.length, 1);
  assert.equal(detected.changes[0].title, 'New bounty candidate');
});

test('scan detects competition changes', () => {
  const initial = detectReportChanges('scan', scanReport(), {});
  const detected = detectReportChanges('scan', scanReport({pullRequestCount: 2}), {scan: initial.snapshot});
  assert.equal(detected.changes.length, 1);
  assert.match(detected.changes[0].reasons[0], /competition changed/);
});

test('watch detects failing checks', () => {
  const initial = detectReportChanges('watch', watchReport(), {});
  const detected = detectReportChanges('watch', watchReport({status: 'needs_attention', checks: {state: 'failing', failing: 1, pending: 0}, needsAttention: true}), {
    watch: initial.snapshot,
  });
  assert.equal(detected.changes.length, 1);
  assert.equal(detected.changes[0].severity, 'high');
});

test('watch detects maintainer activity', () => {
  const initial = detectReportChanges('watch', watchReport(), {});
  const detected = detectReportChanges(
    'watch',
    watchReport({
      latestActivity: [
        {
          type: 'comment',
          author: 'maintainer',
          association: 'MEMBER',
          body: 'Can you update this?',
          url: 'https://github.com/owner/repo/pull/2#issuecomment-1',
          createdAt: '2026-01-02T00:00:00Z',
        },
      ],
      needsAttention: true,
    }),
    {watch: initial.snapshot},
  );
  assert.equal(detected.changes.length, 1);
  assert.match(detected.changes[0].reasons.join(' '), /maintainer activity/);
});
