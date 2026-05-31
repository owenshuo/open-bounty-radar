import {normalizeAlgoraListing, parseGitHubIssueUrl} from './algora.js';

export function normalizeOpireListing(listing) {
  const issueUrl = listing.githubIssueUrl ?? listing.issueUrl ?? listing.repositoryUrl;
  const issue = parseGitHubIssueUrl(issueUrl);
  if (!issue) throw new Error(`Opire listing must include a GitHub issue URL: ${listing.url ?? 'unknown listing'}`);

  return {
    ...normalizeAlgoraListing({
      ...listing,
      githubIssueUrl: issueUrl,
      labels: listing.labels ?? ['opire'],
      title: listing.title ?? `Opire bounty for ${issue.repository}#${issue.number}`,
    }),
    adapter: 'opire',
    platform: 'Opire',
  };
}

export const opireAdapter = {
  name: 'opire',
  sourceType: 'listing-source',
  requiresAuth: false,
  supportsLive: true,
  scanStatic({listings = []}) {
    return listings.map((listing) => normalizeOpireListing(listing));
  },
};
