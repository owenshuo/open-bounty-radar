import {summarizeChecks} from './watch.js';

const MAINTAINER_ASSOCIATIONS = new Set(['COLLABORATOR', 'MEMBER', 'OWNER']);

function latestReviewState(reviews) {
  return [...reviews]
    .sort((left, right) => Date.parse(right.submitted_at ?? 0) - Date.parse(left.submitted_at ?? 0))
    .find((review) => review.state !== 'COMMENTED')?.state ?? null;
}

function isMaintainerReview(review) {
  return MAINTAINER_ASSOCIATIONS.has(review.author_association);
}

function strengthFor({pullRequest, checks, latestState, maintainerApproved, maintainerChangesRequested}) {
  if (pullRequest.merged_at) return 'winner';
  if (maintainerApproved || latestState === 'APPROVED') return 'strong';
  if (pullRequest.state === 'open' && checks.state === 'passing' && !pullRequest.draft) return 'strong';
  if (maintainerChangesRequested || latestState === 'CHANGES_REQUESTED' || checks.state === 'failing') return 'weak';
  if (pullRequest.draft) return 'weak';
  if (pullRequest.state === 'open') return 'active';
  return 'inactive';
}

function riskFor(summary) {
  if (summary.winner > 0 || summary.strong > 0) return 'high';
  if (summary.active > 1) return 'medium';
  if (summary.active === 1) return 'low';
  return 'none';
}

function tagForRisk(risk) {
  if (risk === 'high') return 'strong-competing-pr';
  if (risk === 'medium') return 'active-competition';
  if (risk === 'low') return 'light-competition';
  return 'weak-or-no-competition';
}

async function optional(promise, fallback) {
  try {
    return await promise;
  } catch (error) {
    return {...fallback, error};
  }
}

export function summarizeCompetition(items) {
  const summary = {
    total: items.length,
    open: 0,
    closed: 0,
    draft: 0,
    merged: 0,
    winner: 0,
    strong: 0,
    active: 0,
    weak: 0,
    inactive: 0,
    failing: 0,
    pending: 0,
    passing: 0,
  };

  for (const item of items) {
    if (item.state === 'open') summary.open += 1;
    else summary.closed += 1;
    if (item.draft) summary.draft += 1;
    if (item.merged) summary.merged += 1;
    if (summary[item.strength] !== undefined) summary[item.strength] += 1;
    if (item.checks?.state && summary[item.checks.state] !== undefined) summary[item.checks.state] += 1;
  }

  const risk = riskFor(summary);
  return {
    ...summary,
    risk,
    tag: tagForRisk(risk),
  };
}

export async function analyzePullRequestCompetition(client, {fullName, pullRequests, limit = 5}) {
  const enriched = [];
  const warnings = [];

  for (const linked of pullRequests.slice(0, limit)) {
    if (!linked.number) {
      enriched.push({...linked, strength: 'inactive', warnings: ['missing PR number']});
      continue;
    }

    const pr = await optional(client.getPullRequest({fullName, number: linked.number}), null);
    if (!pr || pr.error) {
      warnings.push(`PR #${linked.number}: ${pr?.error?.message?.split('\n')[0] ?? 'details unavailable'}`);
      enriched.push({...linked, strength: 'active', warnings: ['details unavailable']});
      continue;
    }

    const [reviewsResult, checkRunsResult, statusResult] = await Promise.all([
      optional(client.listPullRequestReviews({fullName, number: linked.number, perPage: 50}), []),
      optional(client.listCheckRuns({fullName, ref: pr.head.sha}), {check_runs: []}),
      optional(client.getCombinedStatus({fullName, ref: pr.head.sha}), {statuses: []}),
    ]);

    const reviews = Array.isArray(reviewsResult) ? reviewsResult : [];
    const checks = summarizeChecks({
      checkRuns: checkRunsResult.error ? [] : (checkRunsResult.check_runs ?? []),
      statuses: statusResult.error ? [] : (statusResult.statuses ?? []),
    });
    const maintainerReviews = reviews.filter(isMaintainerReview);
    const latestState = latestReviewState(reviews);
    const maintainerApproved = maintainerReviews.some((review) => review.state === 'APPROVED');
    const maintainerChangesRequested = maintainerReviews.some((review) => review.state === 'CHANGES_REQUESTED');
    const strength = strengthFor({pullRequest: pr, checks, latestState, maintainerApproved, maintainerChangesRequested});

    enriched.push({
      ...linked,
      state: pr.state ?? linked.state,
      title: pr.title ?? linked.title,
      url: pr.html_url ?? linked.url,
      updatedAt: pr.updated_at ?? linked.updatedAt,
      createdAt: pr.created_at ?? null,
      draft: Boolean(pr.draft),
      merged: Boolean(pr.merged_at),
      mergedAt: pr.merged_at ?? null,
      author: pr.user?.login ?? null,
      headRef: `${pr.head.repo?.full_name ?? 'unknown'}:${pr.head.ref}`,
      additions: pr.additions ?? null,
      deletions: pr.deletions ?? null,
      changedFiles: pr.changed_files ?? null,
      checks,
      latestReviewState: latestState,
      maintainerApproved,
      maintainerChangesRequested,
      strength,
      warnings: [
        reviewsResult.error ? `reviews unavailable: ${reviewsResult.error.message.split('\n')[0]}` : null,
        checkRunsResult.error ? `check-runs unavailable: ${checkRunsResult.error.message.split('\n')[0]}` : null,
        statusResult.error ? `commit status unavailable: ${statusResult.error.message.split('\n')[0]}` : null,
      ].filter(Boolean),
    });
  }

  const skipped = Math.max(0, pullRequests.length - limit);
  if (skipped) warnings.push(`${skipped} linked PR(s) skipped by competition detail limit ${limit}`);

  return {
    pullRequests: enriched,
    summary: summarizeCompetition(enriched),
    warnings,
  };
}
