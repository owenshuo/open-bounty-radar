import test from 'node:test';
import assert from 'node:assert/strict';
import {renderScanHtmlReport, renderWatchHtmlReport} from '../src/html-report.js';

test('renders scan HTML reports with escaped content', () => {
  const html = renderScanHtmlReport({
    generatedAt: '2026-01-01T00:00:00Z',
    repositories: ['owner/repo'],
    candidates: [
      {
        repository: 'owner/repo',
        number: 1,
        title: '<script>alert(1)</script>',
        url: 'https://github.com/owner/repo/issues/1',
        amount: 500,
        currency: 'USD',
        pullRequestCount: 0,
        updatedAt: '2026-01-01T00:00:00Z',
        score: {total: 42},
        analysis: {
          recommendation: 'strong',
          reasonTags: [{name: 'no-linked-prs', detail: 'none found'}],
          riskTags: [{name: 'no-repro-signal', detail: 'no keywords'}],
        },
      },
    ],
    errors: [],
    changes: [],
    changeSummary: {firstRun: false},
  });

  assert.match(html, /<!doctype html>/);
  assert.match(html, /Open Bounty Radar Report/);
  assert.match(html, /strong/);
  assert.match(html, /no-repro-signal/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('renders watch HTML reports with check status', () => {
  const html = renderWatchHtmlReport({
    generatedAt: '2026-01-01T00:00:00Z',
    pullRequests: [
      {
        repository: 'owner/repo',
        number: 2,
        title: 'Fix bounty',
        url: 'https://github.com/owner/repo/pull/2',
        status: 'needs_attention',
        needsAttention: true,
        checks: {state: 'failing', total: 3, failing: 1, pending: 0},
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    errors: [],
    changes: [],
    changeSummary: {firstRun: false},
  });

  assert.match(html, /Open Bounty Radar PR Watch Report/);
  assert.match(html, /needs_attention/);
  assert.match(html, /failing \(1\/3\)/);
});
