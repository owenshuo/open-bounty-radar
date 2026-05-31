import {findBountyAmount} from './money.js';

const GITHUB_ISSUE_URL = /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/\d+/g;

function cleanText(text) {
  return text.replaceAll(/\s+/g, ' ').trim();
}

function contextAround(text, index, size = 280) {
  return cleanText(text.slice(Math.max(0, index - size), Math.min(text.length, index + size)));
}

export function extractGitHubIssueListingsFromHtml(html, {platform = 'External', sourceUrl = null} = {}) {
  const embeddedJson = [...html.matchAll(/<script[^>]+type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join('\n');
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? '';
  const text = `${embeddedJson}\n${nextData}\n${html.replaceAll(/<script[\s\S]*?<\/script>/gi, ' ').replaceAll(/<style[\s\S]*?<\/style>/gi, ' ')}`;
  const seen = new Set();
  const listings = [];

  for (const match of text.matchAll(GITHUB_ISSUE_URL)) {
    const githubIssueUrl = match[0];
    if (seen.has(githubIssueUrl)) continue;
    seen.add(githubIssueUrl);

    const description = contextAround(text, match.index ?? 0);
    const bounty = findBountyAmount(description);
    if (!bounty) continue;

    listings.push({
      url: sourceUrl,
      githubIssueUrl,
      title: `${platform} bounty ${githubIssueUrl.split('/').slice(-4).join('/')}`,
      amount: bounty.amount,
      currency: bounty.currency,
      description,
      labels: [platform.toLowerCase(), 'live-listing'],
      updatedAt: new Date().toISOString(),
    });
  }

  return listings;
}

export function extractGenericLiveListings(html, options = {}) {
  return extractGitHubIssueListingsFromHtml(html, {...options, platform: options.platform ?? 'External'});
}

export function extractAlgoraLiveListings(html, options = {}) {
  return extractGitHubIssueListingsFromHtml(html, {...options, platform: 'Algora'});
}

export function extractOpireLiveListings(html, options = {}) {
  return extractGitHubIssueListingsFromHtml(html, {...options, platform: 'Opire'});
}

function extractorFor(platform) {
  if (platform === 'algora') return extractAlgoraLiveListings;
  if (platform === 'opire') return extractOpireLiveListings;
  return extractGenericLiveListings;
}

export async function fetchLiveListings(sourceConfig = {}, {fetchImpl = fetch} = {}) {
  if (!sourceConfig.liveUrl) return [];
  const response = await fetchImpl(sourceConfig.liveUrl, {
    headers: {'User-Agent': 'open-bounty-radar'},
  });
  if (!response.ok) throw new Error(`Live listing fetch failed ${response.status}: ${sourceConfig.liveUrl}`);
  const html = await response.text();
  return extractorFor(sourceConfig.extractor ?? sourceConfig.platform?.toLowerCase())(html, {
    platform: sourceConfig.platform,
    sourceUrl: sourceConfig.liveUrl,
  });
}
