import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubClient} from '../src/github.js';

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {'content-type': 'application/json'},
  });
}

test('extracts pull requests from issue timeline cross references', async () => {
  const requestedUrls = [];
  const client = new GitHubClient({
    async fetchImpl(url) {
      requestedUrls.push(url.toString());
      return jsonResponse([
        {
          event: 'cross-referenced',
          source: {
            issue: {
              number: 3,
              title: 'Linked PR',
              html_url: 'https://github.com/owner/repo/pull/3',
              state: 'open',
              updated_at: '2026-01-01T00:00:00Z',
              pull_request: {},
            },
          },
        },
        {
          event: 'cross-referenced',
          source: {
            issue: {
              number: 4,
              title: 'Other repo PR',
              html_url: 'https://github.com/other/repo/pull/4',
              state: 'open',
              updated_at: '2026-01-01T00:00:00Z',
              pull_request: {},
            },
          },
        },
      ]);
    },
  });

  const pullRequests = await client.listTimelinePullRequestsForIssue({fullName: 'owner/repo', number: 1});
  assert.equal(pullRequests.length, 1);
  assert.equal(pullRequests[0].number, 3);
  assert.match(requestedUrls[0], /\/repos\/owner\/repo\/issues\/1\/timeline/);
});

test('searches global issues without a repository qualifier', async () => {
  const requestedUrls = [];
  const client = new GitHubClient({
    async fetchImpl(url) {
      requestedUrls.push(url);
      return jsonResponse({items: [{number: 1, title: 'Bounty issue'}]});
    },
  });

  const issues = await client.searchGlobalIssues({query: 'label:bounty $ in:title,body archived:false', maxIssues: 7});
  assert.equal(issues.length, 1);

  const url = requestedUrls[0];
  assert.equal(url.pathname, '/search/issues');
  assert.equal(url.searchParams.get('per_page'), '7');
  assert.equal(url.searchParams.get('sort'), 'updated');
  assert.equal(url.searchParams.get('order'), 'desc');
  assert.equal(url.searchParams.get('q'), 'is:issue is:open label:bounty $ in:title,body archived:false');
  assert.equal(url.searchParams.get('q').includes('repo:'), false);
});
