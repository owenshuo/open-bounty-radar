import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePullRequestCompetition, summarizeCompetition} from '../src/competition.js';

test('summarizes competition risk from enriched pull requests', () => {
  const summary = summarizeCompetition([
    {state: 'open', draft: false, merged: false, strength: 'strong', checks: {state: 'passing'}},
    {state: 'open', draft: true, merged: false, strength: 'weak', checks: {state: 'failing'}},
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.open, 2);
  assert.equal(summary.strong, 1);
  assert.equal(summary.risk, 'high');
  assert.equal(summary.tag, 'strong-competing-pr');
});

test('enriches linked pull requests with review and check strength', async () => {
  const client = {
    async getPullRequest() {
      return {
        number: 7,
        title: 'Competing fix',
        html_url: 'https://github.com/o/r/pull/7',
        state: 'open',
        draft: false,
        merged_at: null,
        updated_at: '2026-01-02T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        user: {login: 'dev'},
        head: {sha: 'abc', ref: 'fix', repo: {full_name: 'fork/r'}},
        additions: 10,
        deletions: 2,
        changed_files: 1,
      };
    },
    async listPullRequestReviews() {
      return [{state: 'APPROVED', author_association: 'MEMBER', submitted_at: '2026-01-03T00:00:00Z'}];
    },
    async listCheckRuns() {
      return {check_runs: [{conclusion: 'success', status: 'completed'}]};
    },
    async getCombinedStatus() {
      return {statuses: []};
    },
  };

  const result = await analyzePullRequestCompetition(client, {
    fullName: 'o/r',
    pullRequests: [{number: 7, title: 'Linked', url: 'https://github.com/o/r/pull/7', state: 'open'}],
  });

  assert.equal(result.pullRequests[0].strength, 'strong');
  assert.equal(result.pullRequests[0].maintainerApproved, true);
  assert.equal(result.summary.risk, 'high');
});
