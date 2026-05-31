import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAlgoraLiveListings, extractGitHubIssueListingsFromHtml, extractOpireLiveListings, fetchLiveListings} from '../src/platform-live.js';

test('extracts GitHub issue listings and bounty amounts from HTML', () => {
  const listings = extractGitHubIssueListingsFromHtml(
    '<a href="https://github.com/owner/repo/issues/12">Issue</a><span>/bounty $600</span>',
    {platform: 'Algora', sourceUrl: 'https://example.com'},
  );

  assert.equal(listings.length, 1);
  assert.equal(listings[0].githubIssueUrl, 'https://github.com/owner/repo/issues/12');
  assert.equal(listings[0].amount, 600);
  assert.deepEqual(listings[0].labels, ['algora', 'live-listing']);
});

test('fetches live listings from configured URL', async () => {
  const listings = await fetchLiveListings(
    {liveUrl: 'https://example.com/bounties', platform: 'Opire'},
    {
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return 'Reward 250 USDC https://github.com/o/r/issues/9';
        },
      }),
    },
  );

  assert.equal(listings[0].currency, 'USDC');
  assert.equal(listings[0].githubIssueUrl, 'https://github.com/o/r/issues/9');
});

test('extracts listings from JSON-LD script blocks', () => {
  const listings = extractGitHubIssueListingsFromHtml(
    '<script type="application/ld+json">{"url":"https://github.com/o/r/issues/7","reward":"$400"}</script>',
    {platform: 'Algora'},
  );

  assert.equal(listings.length, 1);
  assert.equal(listings[0].amount, 400);
});

test('uses platform-specific live extractors', () => {
  assert.equal(extractAlgoraLiveListings('/bounty $300 https://github.com/o/r/issues/1')[0].labels[0], 'algora');
  assert.equal(extractOpireLiveListings('/bounty $300 https://github.com/o/r/issues/2')[0].labels[0], 'opire');
});
