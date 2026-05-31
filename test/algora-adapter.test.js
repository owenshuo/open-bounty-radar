import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlgoraListing, parseGitHubIssueUrl} from '../src/adapters/algora.js';

test('parses GitHub issue URLs from Algora listings', () => {
  assert.deepEqual(parseGitHubIssueUrl('https://github.com/owner/repo/issues/123'), {
    owner: 'owner',
    repo: 'repo',
    number: 123,
    repository: 'owner/repo',
  });
});

test('normalizes static Algora listings into candidates', () => {
  const candidate = normalizeAlgoraListing({
    url: 'https://console.algora.io/bounties/abc',
    githubIssueUrl: 'https://github.com/owner/repo/issues/123',
    title: 'Fix Algora bounty',
    amount: 750,
    currency: 'USD',
    description: 'Steps to reproduce: run the command. Expected behavior: pass. Actual behavior: fails.',
  });

  assert.equal(candidate.adapter, 'algora');
  assert.equal(candidate.platform, 'Algora');
  assert.equal(candidate.repository, 'owner/repo');
  assert.equal(candidate.amount, 750);
  assert.equal(candidate.externalUrl, 'https://console.algora.io/bounties/abc');
});
