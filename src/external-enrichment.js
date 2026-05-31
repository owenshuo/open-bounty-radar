import {analyzeCandidate} from './candidate-analysis.js';
import {analyzePullRequestCompetition} from './competition.js';
import {findLinkedPullRequests} from './linked-prs.js';
import {scoreCandidate} from './score.js';
import {issueTimelineSignals} from './timeline-signals.js';

function labelNames(issue) {
  return (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean);
}

export async function enrichExternalCandidateWithGitHub(client, candidate, defaults = {}) {
  const fullName = candidate.repository;
  const strategy = candidate.pullRequestDetection === 'external' ? (defaults.linkedPullRequestDetection ?? 'both') : candidate.pullRequestDetection;
  const competitionDetails = defaults.competitionDetails ?? true;
  const competitionDetailLimit = defaults.competitionDetailLimit ?? 5;

  const issue = await client.getIssue({fullName, number: candidate.number});
  const linkedPullRequests = await findLinkedPullRequests(client, {
    fullName,
    issueNumber: candidate.number,
    issueUrl: issue.html_url ?? candidate.url,
    strategy,
  });
  const competition = competitionDetails
    ? await analyzePullRequestCompetition(client, {fullName, pullRequests: linkedPullRequests.pullRequests, limit: competitionDetailLimit})
    : {pullRequests: linkedPullRequests.pullRequests, summary: null, warnings: []};

  const labels = labelNames(issue);
  const enriched = {
    ...candidate,
    title: issue.title ?? candidate.title,
    url: issue.html_url ?? candidate.url,
    state: issue.state ?? candidate.state,
    createdAt: issue.created_at ?? candidate.createdAt,
    updatedAt: issue.updated_at ?? candidate.updatedAt,
    labels: labels.length ? [...new Set([...candidate.labels, ...labels])] : candidate.labels,
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login).filter(Boolean),
    bountySignals: {
      assigned: (issue.assignees ?? []).length > 0,
      labelSignals: labels.filter((label) => /assigned|selected|winner|paid|completed/i.test(label)),
      timelineSignals: strategy === 'search' ? [] : issueTimelineSignals(await client.listIssueTimeline({fullName, number: candidate.number}).catch(() => [])),
    },
    pullRequestCount: competition.pullRequests.length,
    pullRequestDetection: strategy,
    pullRequestDetectionWarnings: [...(candidate.pullRequestDetectionWarnings ?? []), ...linkedPullRequests.warnings, ...competition.warnings],
    competition: {
      summary: competition.summary,
      detailLimit: competitionDetailLimit,
    },
    pullRequests: competition.pullRequests,
  };
  const scored = {...enriched, score: scoreCandidate(enriched)};
  return {...scored, analysis: analyzeCandidate(scored, {text: `${issue.title ?? ''}\n${issue.body ?? ''}`})};
}

export async function enrichExternalCandidates(client, candidates, defaults = {}) {
  const enriched = [];
  for (const candidate of candidates) {
    if (!candidate.repository || !candidate.number) {
      enriched.push(candidate);
      continue;
    }
    enriched.push(await enrichExternalCandidateWithGitHub(client, candidate, defaults).catch((error) => ({
      ...candidate,
      pullRequestDetectionWarnings: [...(candidate.pullRequestDetectionWarnings ?? []), `GitHub enrichment unavailable: ${error.message.split('\n')[0]}`],
    })));
  }
  return enriched;
}
