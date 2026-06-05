import test from 'node:test';
import assert from 'node:assert/strict';
import {findLinkedPullRequests, mergeLinkedPullRequests, normalizePullRequest} from '../src/linked-prs.js';

test('normalizes pull requests from search issue results', () => {
  assert.deepEqual(normalizePullRequest({number: 12, title: 'Fix it', html_url: 'https://github.com/o/r/pull/12', state: 'open', updated_at: '2026-01-01T00:00:00Z'}, 'search'), {
    number: 12,
    title: 'Fix it',
    url: 'https://github.com/o/r/pull/12',
    state: 'open',
    updatedAt: '2026-01-01T00:00:00Z',
    detectionSources: ['search'],
  });
});

test('merges duplicate linked pull requests across detection sources', () => {
  const merged = mergeLinkedPullRequests([
    {
      source: 'search',
      pullRequests: [{number: 1, title: 'Search title', html_url: 'https://github.com/o/r/pull/1', state: 'open', updated_at: '2026-01-01T00:00:00Z'}],
    },
    {
      source: 'timeline',
      pullRequests: [{number: 1, title: 'Timeline title', html_url: 'https://github.com/o/r/pull/1', state: 'open', updated_at: '2026-01-02T00:00:00Z'}],
    },
  ]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].detectionSources, ['search', 'timeline']);
  assert.equal(merged[0].title, 'Timeline title');
});

test('finds linked pull requests from all available sources', async () => {
  const client = {
    async searchPullRequestsForIssue() {
      return [{number: 1, title: 'Search', html_url: 'https://github.com/o/r/pull/1', state: 'open', updated_at: '2026-01-01T00:00:00Z'}];
    },
    async listTimelinePullRequestsForIssue() {
      return [{number: 2, title: 'Timeline', html_url: 'https://github.com/o/r/pull/2', state: 'open', updated_at: '2026-01-02T00:00:00Z'}];
    },
  };

  const result = await findLinkedPullRequests(client, {
    fullName: 'o/r',
    issueNumber: 10,
    issueUrl: 'https://github.com/o/r/issues/10',
    strategy: 'both',
  });

  assert.equal(result.pullRequests.length, 2);
  assert.deepEqual(result.warnings, []);
});

test('can disable linked pull request detection for broad discovery', async () => {
  const result = await findLinkedPullRequests(
    {
      async searchPullRequestsForIssue() {
        throw new Error('search should not run');
      },
      async listTimelinePullRequestsForIssue() {
        throw new Error('timeline should not run');
      },
    },
    {
      fullName: 'o/r',
      issueNumber: 10,
      issueUrl: 'https://github.com/o/r/issues/10',
      strategy: 'none',
    },
  );

  assert.deepEqual(result.pullRequests, []);
  assert.match(result.warnings[0], /disabled/);
});

test('keeps successful results when one detection source fails', async () => {
  const client = {
    async searchPullRequestsForIssue() {
      return [{number: 1, title: 'Search', html_url: 'https://github.com/o/r/pull/1', state: 'open', updated_at: '2026-01-01T00:00:00Z'}];
    },
    async listTimelinePullRequestsForIssue() {
      throw new Error('timeline unavailable');
    },
  };

  const result = await findLinkedPullRequests(client, {
    fullName: 'o/r',
    issueNumber: 10,
    issueUrl: 'https://github.com/o/r/issues/10',
  });

  assert.equal(result.pullRequests.length, 1);
  assert.match(result.warnings[0], /timeline unavailable/);
});
