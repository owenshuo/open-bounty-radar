import {analyzeCandidate} from '../candidate-analysis.js';
import {analyzePullRequestCompetition} from '../competition.js';
import {findLinkedPullRequests} from '../linked-prs.js';
import {findBountyAmount} from '../money.js';
import {scoreCandidate} from '../score.js';
import {expandRepositoryQueries} from '../search-presets.js';
import {issueTimelineSignals} from '../timeline-signals.js';

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
    const linkedPullRequestDetection = repoConfig.linkedPullRequestDetection ?? defaults.linkedPullRequestDetection ?? 'both';
    const competitionDetails = repoConfig.competitionDetails ?? defaults.competitionDetails ?? true;
    const competitionDetailLimit = repoConfig.competitionDetailLimit ?? defaults.competitionDetailLimit ?? 5;
    const seen = new Set();
    const candidates = [];

    for (const query of queries) {
      const issues = await client.searchIssues({
        fullName,
        query,
        maxIssues: maxIssuesPerQuery,
        includeClosed,
      });

      for (const issue of issues) {
        const key = `${fullName}#${issue.number}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const issueText = `${issue.title}\n\n${issue.body ?? ''}`;
        const bounty = findBountyAmount(issueText);
        if (!bounty) continue;

        const linkedPullRequests = await findLinkedPullRequests(client, {
          fullName,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          strategy: linkedPullRequestDetection,
        });
        const timelineSignals = linkedPullRequestDetection === 'search' ? [] : issueTimelineSignals(await client.listIssueTimeline({fullName, number: issue.number}).catch(() => []));
        const competition = competitionDetails
          ? await analyzePullRequestCompetition(client, {fullName, pullRequests: linkedPullRequests.pullRequests, limit: competitionDetailLimit}).catch((error) => ({
              pullRequests: linkedPullRequests.pullRequests,
              summary: null,
              warnings: [`competition details unavailable: ${error.message.split('\n')[0]}`],
            }))
          : {pullRequests: linkedPullRequests.pullRequests, summary: null, warnings: []};
        const pullRequests = competition.pullRequests;

        const candidate = {
          adapter: 'github',
          platform: 'GitHub',
          repository: fullName,
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean),
          assignees: (issue.assignees ?? []).map((assignee) => assignee.login).filter(Boolean),
          bountySignals: {
            assigned: (issue.assignees ?? []).length > 0,
            labelSignals: issue.labels
              .map((label) => (typeof label === 'string' ? label : label.name))
              .filter((label) => /assigned|selected|winner|paid|completed/i.test(label ?? '')),
            timelineSignals,
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
        candidates.push({...scored, analysis: analyzeCandidate(scored, {text: issueText})});
      }
    }

    return candidates;
  },
};
