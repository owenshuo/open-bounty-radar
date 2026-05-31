const MAINTAINER_ASSOCIATIONS = new Set(['COLLABORATOR', 'MEMBER', 'OWNER']);
const WINNER_KEYWORDS = ['selected', 'winner', 'paid', 'payment sent', 'bounty awarded', 'merged'];

function activityText(event) {
  return `${event.body ?? ''} ${event.state ?? ''}`.toLowerCase();
}

export function watchAction(item) {
  if (item.merged) return 'claim-or-confirm';
  if (item.state === 'closed') return 'stop';
  if (item.checks.state === 'failing') return 'fix-ci';
  if (item.latestActivity.some((event) => event.state === 'CHANGES_REQUESTED')) return 'revise';
  if (item.latestActivity.some((event) => MAINTAINER_ASSOCIATIONS.has(event.association))) return 'reply';
  if (item.checks.state === 'pending') return 'wait-checks';
  return 'wait';
}

export function watchGroup(item) {
  if (item.merged) return 'merged';
  if (item.state === 'closed') return 'closed';
  if (item.needsAttention) return 'needs_attention';
  return 'healthy';
}

export function winnerSignals(item) {
  const signals = [];
  if (item.merged) signals.push('merged');
  for (const event of item.latestActivity ?? []) {
    const text = activityText(event);
    for (const keyword of WINNER_KEYWORDS) {
      if (text.includes(keyword)) signals.push(`${keyword} mentioned by ${event.author}`);
    }
  }
  return [...new Set(signals)];
}

export function groupWatchItems(items) {
  const order = ['needs_attention', 'healthy', 'merged', 'closed'];
  const groups = new Map(order.map((name) => [name, []]));
  for (const item of items) groups.get(watchGroup(item)).push(item);
  return [...groups.entries()].filter(([, groupItems]) => groupItems.length).map(([name, pullRequests]) => ({name, pullRequests}));
}

export function watchSummary(items) {
  const summary = {needs_attention: 0, healthy: 0, merged: 0, closed: 0};
  for (const item of items) summary[watchGroup(item)] += 1;
  return summary;
}
