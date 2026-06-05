import {analyzeCandidate} from '../candidate-analysis.js';
import {analyzePullRequestCompetition} from '../competition.js';
import {analyzeIssueComments} from '../comment-signals.js';
import {findLinkedPullRequests} from '../linked-prs.js';
import {findBountyAmount} from '../money.js';
import {scoreCandidate} from '../score.js';
import {expandRepositoryQueries} from '../search-presets.js';
import {issueTimelineSignals} from '../timeline-signals.js';

function fullNameFromIssue(issue, fallbackFullName = null) {
  if (fallbackFullName) return fallbackFullName;
  if (issue.repository?.full_name) return issue.repository.full_name;
  const match = /\/repos\/([^/]+\/[^/]+)$/i.exec(issue.repository_url ?? '');
  if (match) return match[1];
  const urlMatch = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/\d+/i.exec(issue.html_url ?? '');
  if (urlMatch) return urlMatch[1];
  throw new Error(`Cannot determine repository for issue ${issue.html_url ?? issue.number ?? 'unknown'}`);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({length: workerCount}, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function enrichmentConcurrency(repoConfig = {}, defaults = {}) {
  const value = Number(repoConfig.enrichmentConcurrency ?? defaults.enrichmentConcurrency ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

async function candidateFromIssue({client, issue, fullName, defaults = {}, repoConfig = {}}) {
  const issueFullName = fullNameFromIssue(issue, fullName);
  const linkedPullRequestDetection = repoConfig.linkedPullRequestDetection ?? defaults.linkedPullRequestDetection ?? 'both';
  const competitionDetails = repoConfig.competitionDetails ?? defaults.competitionDetails ?? true;
  const competitionDetailLimit = repoConfig.competitionDetailLimit ?? defaults.competitionDetailLimit ?? 5;
  const issueText = `${issue.title}\n\n${issue.body ?? ''}`;
  const bounty = findBountyAmount(issueText);
  if (!bounty) return null;

  const linkedPullRequests = await findLinkedPullRequests(client, {
    fullName: issueFullName,
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    strategy: linkedPullRequestDetection,
  });
  const timelineSignals = linkedPullRequestDetection === 'search' ? [] : issueTimelineSignals(await client.listIssueTimeline({fullName: issueFullName, number: issue.number}).catch(() => []));
  const comments = await client.listIssueComments({fullName: issueFullName, number: issue.number, perPage: repoConfig.commentSignalLimit ?? defaults.commentSignalLimit ?? 50}).catch(() => []);
  const commentSignals = analyzeIssueComments(comments);
  const competition = competitionDetails
    ? await analyzePullRequestCompetition(client, {fullName: issueFullName, pullRequests: linkedPullRequests.pullRequests, limit: competitionDetailLimit}).catch((error) => ({
        pullRequests: linkedPullRequests.pullRequests,
        summary: null,
        warnings: [`competition details unavailable: ${error.message.split('\n')[0]}`],
      }))
    : {pullRequests: linkedPullRequests.pullRequests, summary: null, warnings: []};
  const pullRequests = competition.pullRequests;

  const candidate = {
    adapter: 'github',
    platform: 'GitHub',
    repository: issueFullName,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    labels: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean),
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login).filter(Boolean),
    bountySignals: {
      assigned: (issue.assignees ?? []).length > 0,
      labelSignals: (issue.labels ?? [])
        .map((label) => (typeof label === 'string' ? label : label.name))
        .filter((label) => /assigned|selected|winner|paid|completed/i.test(label ?? '')),
      timelineSignals,
      commentSignals,
    },
    amount: bounty.amount,
    currency: bounty.currency,
    rawAmount: bounty.raw,
    pullRequestCount: pullRequests.length,
    pullRequestDetection: linkedPullRequestDetection,
    pullRequestDetectionWarnings: [...linkedPullRequests.warnings, ...competition.warnings],
    competition: {
      summary: competition.summary,
      detailLimit: competitionDetailLimit,
    },
    pullRequests: pullRequests.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      updatedAt: pr.updatedAt,
      detectionSources: pr.detectionSources,
      draft: pr.draft,
      merged: pr.merged,
      mergedAt: pr.mergedAt,
      author: pr.author,
      checks: pr.checks,
      latestReviewState: pr.latestReviewState,
      maintainerApproved: pr.maintainerApproved,
      maintainerChangesRequested: pr.maintainerChangesRequested,
      strength: pr.strength,
      changedFiles: pr.changedFiles,
      warnings: pr.warnings,
    })),
  };

  const scored = {...candidate, score: scoreCandidate(candidate)};
  return {...scored, analysis: analyzeCandidate(scored, {text: issueText})};
}

export const githubAdapter = {
  name: 'github',
  sourceType: 'github-api',
  requiresAuth: false,
  supportsLive: true,
  async scan({client, repoConfig, defaults = {}}) {
    const fullName = `${repoConfig.owner}/${repoConfig.repo}`;
    const queries = expandRepositoryQueries(repoConfig);
    const maxIssuesPerQuery = repoConfig.maxIssuesPerQuery ?? defaults.maxIssuesPerQuery ?? 25;
    const includeClosed = repoConfig.includeClosed ?? defaults.includeClosed ?? false;
    const concurrency = enrichmentConcurrency(repoConfig, defaults);
    const seen = new Set();
    const candidates = [];

    for (const query of queries) {
      const issues = await client.searchIssues({
        fullName,
        query,
        maxIssues: maxIssuesPerQuery,
        includeClosed,
      });

      const newIssues = [];
      for (const issue of issues) {
        const key = `${fullName}#${issue.number}`;
        if (seen.has(key)) continue;
        seen.add(key);
        newIssues.push(issue);
      }

      const queryCandidates = await mapWithConcurrency(newIssues, concurrency, (issue) => candidateFromIssue({client, issue, fullName, defaults, repoConfig}));
      candidates.push(...queryCandidates.filter(Boolean));
    }

    return candidates;
  },
  async search({client, searchConfig, defaults = {}}) {
    const queries = expandRepositoryQueries(searchConfig);
    const maxIssuesPerQuery = searchConfig.maxIssuesPerQuery ?? defaults.globalMaxIssuesPerQuery ?? defaults.maxIssuesPerQuery ?? 10;
    const includeClosed = searchConfig.includeClosed ?? defaults.includeClosed ?? false;
    const concurrency = enrichmentConcurrency(searchConfig, defaults);
    const seen = new Set();
    const candidates = [];

    for (const query of queries) {
      const issues = await client.searchGlobalIssues({query, maxIssues: maxIssuesPerQuery, includeClosed});
      const newIssues = [];
      for (const issue of issues) {
        const key = issue.html_url ?? `${issue.repository_url}#${issue.number}`;
        if (seen.has(key)) continue;
        seen.add(key);
        newIssues.push(issue);
      }

      const queryCandidates = await mapWithConcurrency(newIssues, concurrency, (issue) => candidateFromIssue({client, issue, defaults, repoConfig: searchConfig}));
      candidates.push(...queryCandidates.filter(Boolean));
    }

    return candidates;
  },
};
