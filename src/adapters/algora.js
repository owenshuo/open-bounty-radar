import {analyzeCandidate} from '../candidate-analysis.js';
import {findBountyAmount} from '../money.js';
import {scoreCandidate} from '../score.js';

const GITHUB_ISSUE_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i;

export function parseGitHubIssueUrl(url) {
  const match = GITHUB_ISSUE_URL.exec(url ?? '');
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    number: Number(match[3]),
    repository: `${match[1]}/${match[2]}`,
  };
}

export function normalizeAlgoraListing(listing) {
  const issue = parseGitHubIssueUrl(listing.githubIssueUrl);
  if (!issue) throw new Error(`Algora listing must include a GitHub issue URL: ${listing.url ?? 'unknown listing'}`);

  const bounty = listing.amount && listing.currency ? {amount: listing.amount, currency: listing.currency, raw: `${listing.currency} ${listing.amount}`} : findBountyAmount(`${listing.title ?? ''}\n${listing.description ?? ''}`);
  if (!bounty) throw new Error(`Algora listing has no detectable bounty amount: ${listing.url ?? listing.githubIssueUrl}`);

  const candidate = {
    adapter: 'algora',
    platform: 'Algora',
    externalUrl: listing.url ?? null,
    repository: issue.repository,
    number: issue.number,
    title: listing.title ?? `Algora bounty for ${issue.repository}#${issue.number}`,
    url: listing.githubIssueUrl,
    state: listing.state ?? 'open',
    createdAt: listing.createdAt ?? null,
    updatedAt: listing.updatedAt ?? listing.createdAt ?? new Date().toISOString(),
    labels: listing.labels ?? ['algora'],
    amount: bounty.amount,
    currency: bounty.currency,
    rawAmount: bounty.raw,
    pullRequestCount: listing.pullRequestCount ?? 0,
    pullRequestDetection: 'external',
    pullRequestDetectionWarnings: [],
    pullRequests: listing.pullRequests ?? [],
  };
  const scored = {...candidate, score: scoreCandidate(candidate)};
  return {...scored, analysis: analyzeCandidate(scored, {text: listing.description ?? listing.title ?? ''})};
}

export const algoraAdapter = {
  name: 'algora',
  sourceType: 'listing-source',
  requiresAuth: false,
  supportsLive: true,
  scanStatic({listings = []}) {
    return listings.map((listing) => normalizeAlgoraListing(listing));
  },
};
