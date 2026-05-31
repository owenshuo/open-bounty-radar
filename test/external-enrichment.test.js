import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichExternalCandidateWithGitHub} from '../src/external-enrichment.js';

test('enriches external listing candidates with GitHub issue and competition details', async () => {
  const client = {
    async getIssue() {
      return {
        title: 'Canonical issue title',
        body: 'Steps to reproduce: run it. Expected behavior: pass. Actual behavior: fail.',
        html_url: 'https://github.com/o/r/issues/5',
        state: 'open',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        labels: [{name: 'bounty'}],
        assignees: [{login: 'maintainer'}],
      };
    },
    async searchPullRequestsForIssue() {
      return [{number: 6, title: 'Fix', html_url: 'https://github.com/o/r/pull/6', state: 'open', updated_at: '2026-01-03T00:00:00Z'}];
    },
    async listTimelinePullRequestsForIssue() {
      return [];
    },
    async listIssueTimeline() {
      return [];
    },
    async getPullRequest() {
      return {
        title: 'Fix',
        html_url: 'https://github.com/o/r/pull/6',
        state: 'open',
        draft: false,
        merged_at: null,
        updated_at: '2026-01-03T00:00:00Z',
        created_at: '2026-01-03T00:00:00Z',
        user: {login: 'dev'},
        head: {sha: 'abc', ref: 'fix', repo: {full_name: 'dev/r'}},
      };
    },
    async listPullRequestReviews() {
      return [];
    },
    async listCheckRuns() {
      return {check_runs: []};
    },
    async getCombinedStatus() {
      return {statuses: []};
    },
  };

  const candidate = await enrichExternalCandidateWithGitHub(client, {
    adapter: 'algora',
    platform: 'Algora',
    repository: 'o/r',
    number: 5,
    title: 'Listing title',
    url: 'https://github.com/o/r/issues/5',
    state: 'open',
    labels: ['algora'],
    amount: 500,
    currency: 'USD',
    rawAmount: 'USD 500',
    pullRequestCount: 0,
    pullRequestDetection: 'external',
    pullRequestDetectionWarnings: [],
    pullRequests: [],
  });

  assert.equal(candidate.title, 'Canonical issue title');
  assert.equal(candidate.pullRequestCount, 1);
  assert.equal(candidate.competition.summary.active, 1);
  assert.deepEqual(candidate.assignees, ['maintainer']);
});
