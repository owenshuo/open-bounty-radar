export function summarizeChecks({checkRuns = [], statuses = []} = {}) {
  const failingCheckRuns = checkRuns.filter((run) => ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'].includes(run.conclusion));
  const pendingCheckRuns = checkRuns.filter((run) => run.status !== 'completed' || !run.conclusion);
  const failingStatuses = statuses.filter((status) => ['failure', 'error'].includes(status.state));
  const pendingStatuses = statuses.filter((status) => status.state === 'pending');

  if (failingCheckRuns.length || failingStatuses.length) {
    return {
      state: 'failing',
      total: checkRuns.length + statuses.length,
      failing: failingCheckRuns.length + failingStatuses.length,
      pending: pendingCheckRuns.length + pendingStatuses.length,
    };
  }

  if (pendingCheckRuns.length || pendingStatuses.length) {
    return {
      state: 'pending',
      total: checkRuns.length + statuses.length,
      failing: 0,
      pending: pendingCheckRuns.length + pendingStatuses.length,
    };
  }

  if (checkRuns.length || statuses.length) {
    return {
      state: 'passing',
      total: checkRuns.length + statuses.length,
      failing: 0,
      pending: 0,
    };
  }

  return {state: 'unknown', total: 0, failing: 0, pending: 0};
}

export function classifyPullRequest(pr, checkSummary) {
  if (pr.merged_at) return 'merged';
  if (pr.state === 'closed') return 'closed';
  if (pr.draft) return 'draft';
  if (checkSummary.state === 'failing') return 'needs_attention';
  if (checkSummary.state === 'pending') return 'pending_checks';
  return 'open';
}

export function latestActivity({comments = [], reviews = [], limit = 5} = {}) {
  const commentEvents = comments.map((comment) => ({
    type: 'comment',
    author: comment.user?.login ?? 'unknown',
    association: comment.author_association ?? 'NONE',
    body: comment.body ?? '',
    url: comment.html_url,
    createdAt: comment.created_at,
  }));

  const reviewEvents = reviews.map((review) => ({
    type: 'review',
    author: review.user?.login ?? 'unknown',
    association: review.author_association ?? 'NONE',
    state: review.state,
    body: review.body ?? '',
    url: review.html_url,
    createdAt: review.submitted_at ?? review.created_at,
  }));

  return [...commentEvents, ...reviewEvents]
    .filter((event) => event.createdAt)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);
}

export function needsAttention(watchItem) {
  const maintainerAssociations = new Set(['COLLABORATOR', 'MEMBER', 'OWNER']);
  return (
    ['needs_attention', 'closed'].includes(watchItem.status) ||
    watchItem.latestActivity.some((event) => maintainerAssociations.has(event.association) || event.state === 'CHANGES_REQUESTED')
  );
}
