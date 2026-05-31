import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWatchDashboardHtmlReport} from '../src/watch-dashboard-report.js';

test('renders interactive watch dashboard', () => {
  const html = renderWatchDashboardHtmlReport({
    generatedAt: '2026-01-01T00:00:00Z',
    pullRequests: [
      {
        repository: 'owner/repo',
        number: 2,
        title: '<b>Fix bounty</b>',
        url: 'https://github.com/owner/repo/pull/2',
        status: 'needs_attention',
        action: 'fix-ci',
        needsAttention: true,
        state: 'open',
        merged: false,
        checks: {state: 'failing', total: 3, failing: 1, pending: 0},
        updatedAt: '2026-01-01T00:00:00Z',
        latestActivity: [],
        winnerSignals: ['selected mentioned by maintainer'],
      },
    ],
  });

  assert.match(html, /Open Bounty Radar Watch Dashboard/);
  assert.match(html, /Watch filters/);
  assert.match(html, /fix-ci/);
  assert.match(html, /selected mentioned/);
  assert.match(html, /&lt;b&gt;Fix bounty&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Fix bounty<\/b>/);
});
