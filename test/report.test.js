import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdownReport} from '../src/report.js';

test('renders recommendations and risk tags in markdown scan reports', () => {
  const markdown = renderMarkdownReport({
    generatedAt: '2026-01-01T00:00:00Z',
    repositories: ['owner/repo'],
    candidates: [
      {
        repository: 'owner/repo',
        number: 1,
        title: 'Fix bounty issue',
        url: 'https://github.com/owner/repo/issues/1',
        state: 'open',
        labels: ['bounty'],
        amount: 500,
        currency: 'USD',
        rawAmount: '$500',
        pullRequestCount: 2,
        pullRequests: [
          {
            number: 2,
            title: 'Competing fix',
            url: 'https://github.com/owner/repo/pull/2',
            state: 'open',
            updatedAt: '2026-01-02T00:00:00Z',
            detectionSources: ['search', 'timeline'],
          },
        ],
        pullRequestDetection: 'both',
        updatedAt: '2026-01-01T00:00:00Z',
        score: {total: 30},
        analysis: {
          action: 'watch',
          recommendation: 'risky',
          reasonTags: [{name: 'solid-reward', detail: 'USD 500'}],
          riskTags: [{name: 'some-competition', detail: '2 linked PR(s)'}],
        },
      },
    ],
    errors: [],
  });

  assert.match(markdown, /Recommendation/);
  assert.match(markdown, /Action/);
  assert.match(markdown, /watch/);
  assert.match(markdown, /Top Candidates/);
  assert.match(markdown, /risky/);
  assert.match(markdown, /some-competition/);
  assert.match(markdown, /solid-reward/);
  assert.match(markdown, /Linked PR details/);
  assert.match(markdown, /Competing fix/);
  assert.match(markdown, /search\+timeline/);
});
