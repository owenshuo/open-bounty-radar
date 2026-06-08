import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateDetailFileName, renderCandidateDetailHtml, renderDashboardHtmlReport} from '../src/dashboard-report.js';

test('renders dashboard grouped by action', () => {
  const html = renderDashboardHtmlReport({
    generatedAt: '2026-01-01T00:00:00Z',
    repositories: ['owner/repo'],
    candidates: [
      {
        repository: 'owner/repo',
        number: 1,
        title: '<b>Fix</b>',
        url: 'https://github.com/owner/repo/issues/1',
        amount: 500,
        currency: 'USD',
        pullRequestCount: 0,
        score: {total: 40},
        competition: {summary: {risk: 'none', open: 0, strong: 0, winner: 0, failing: 0}},
        readiness: {status: 'ready', checks: [{id: 'open', label: 'Issue is still open', status: 'pass', detail: 'state: open'}]},
        workspace: {status: 'doing', note: 'read first'},
        assessment: {verdict: 'start-now', confidence: 90, likelyFiles: ['src'], nextSteps: ['Reproduce'], abandonIf: ['Closed']},
        analysis: {action: 'act-now', recommendation: 'strong', riskTags: []},
      },
    ],
  });

  assert.match(html, /Open Bounty Radar Dashboard/);
  assert.match(html, /Data updated/);
  assert.match(html, /generated-at-local/);
  assert.match(html, /2026-01-01T00:00:00Z/);
  assert.match(html, /Act now/);
  assert.match(html, /Action Groups/);
  assert.match(html, /Dashboard filters/);
  assert.match(html, /Copy URL/);
  assert.match(html, /Details/);
  assert.match(html, /Low competition/);
  assert.match(html, /Strong competition/);
  assert.match(html, /Export Workspace/);
  assert.match(html, /Import Workspace/);
  assert.match(html, /import-workspace-file/);
  assert.match(html, /normalizeWorkspaceImport/);
  assert.match(html, /status-select/);
  assert.match(html, /bench-note/);
  assert.match(html, /Ready/);
  assert.match(html, /Doing/);
  assert.match(html, /read first/);
  assert.match(html, /start-now · 90%/);
  assert.match(html, /data-filter-action="watch"/);
  assert.match(html, /&lt;b&gt;Fix&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Fix<\/b>/);
});

test('renders candidate detail pages with competition rows', () => {
  const candidate = {
    repository: 'owner/repo',
    number: 3,
    title: 'Fix race',
    url: 'https://github.com/owner/repo/issues/3',
    amount: 1000,
    currency: 'USD',
    pullRequestCount: 1,
    score: {total: 45},
    competition: {summary: {risk: 'high', open: 1, strong: 1, winner: 0, failing: 0}},
    readiness: {status: 'needs-review', checks: [{id: 'competition', label: 'Competition is not already winning', status: 'warning', detail: 'high risk'}]},
    assessment: {verdict: 'avoid-unless-better', confidence: 45, likelyFiles: ['src/actions'], nextSteps: ['Read linked PRs'], abandonIf: ['Approved competitor']},
    analysis: {
      action: 'manual-review',
      recommendation: 'risky',
      reasonTags: [{name: 'high-reward', detail: 'USD 1000'}],
      riskTags: [{name: 'strong-competing-pr', detail: '1 strong', severity: 'high'}],
    },
    pullRequests: [
      {
        number: 4,
        title: '<script>alert(1)</script>',
        url: 'https://github.com/owner/repo/pull/4',
        state: 'open',
        strength: 'strong',
        checks: {state: 'passing'},
        latestReviewState: 'APPROVED',
        maintainerApproved: true,
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
  };

  assert.equal(candidateDetailFileName(candidate), 'owner__repo__3.html');
  const html = renderCandidateDetailHtml(candidate, {generatedAt: '2026-01-01T00:00:00Z'});
  assert.match(html, /Competing Pull Requests/);
  assert.match(html, /AI-Style Assessment/);
  assert.match(html, /PR Readiness Checklist/);
  assert.match(html, /Competition is not already winning/);
  assert.match(html, /Copy Action Plan/);
  assert.match(html, /maintainer approved/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});
