import test from 'node:test';
import assert from 'node:assert/strict';
import {renderActionPlan, renderCandidatesCsv, renderCandidatesJsonl, renderWatchlistSuggestions} from '../src/exports.js';

function report() {
  return {
    generatedAt: '2026-01-01T00:00:00Z',
    candidates: [
      {
        repository: 'owner/repo',
        number: 1,
        title: 'Fix, quoted "issue"',
        url: 'https://github.com/owner/repo/issues/1',
        amount: 500,
        currency: 'USD',
        pullRequestCount: 0,
        updatedAt: '2026-01-01T00:00:00Z',
        score: {total: 40},
        analysis: {action: 'act-now', recommendation: 'strong', riskTags: []},
        assessment: {verdict: 'start-now', confidence: 90, likelyFiles: ['src/actions']},
      },
    ],
  };
}

test('renders CSV export', () => {
  const csv = renderCandidatesCsv(report());
  assert.match(csv, /repository,number,title/);
  assert.match(csv, /"Fix, quoted ""issue"""/);
});

test('renders watchlist suggestions from actionable candidates', () => {
  const output = JSON.parse(
    renderWatchlistSuggestions({
      generatedAt: '2026-01-01T00:00:00Z',
      candidates: [
        {
          platform: 'GitHub',
          repository: 'owner/repo',
          number: 10,
          url: 'https://github.com/owner/repo/issues/10',
          currency: 'USD',
          amount: 500,
          analysis: {action: 'act-now'},
          assessment: {verdict: 'start-now'},
        },
        {
          repository: 'owner/repo',
          number: 11,
          url: 'https://github.com/owner/repo/issues/11',
          currency: 'USD',
          amount: 50,
          analysis: {action: 'skip'},
        },
      ],
    }),
  );

  assert.equal(output.pullRequestSuggestions.length, 1);
  assert.equal(output.pullRequestSuggestions[0].issueNumber, 10);
  assert.equal(output.pullRequestSuggestions[0].number, null);
});

test('renders JSONL export', () => {
  const jsonl = renderCandidatesJsonl(report());
  assert.equal(JSON.parse(jsonl.trim()).repository, 'owner/repo');
});

test('renders action plan export', () => {
  const plan = renderActionPlan(report());
  assert.match(plan, /Open Bounty Radar Action Plan/);
  assert.match(plan, /review issue and reproduce immediately/);
});
