const ACTION_ORDER = ['act-now', 'watch', 'manual-review', 'consider', 'skip'];
const SEVERITY_ORDER = ['high', 'medium', 'low', 'none'];

function groupBy(items, keyFn, order) {
  const groups = new Map(order.map((key) => [key, []]));
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .filter(([, groupItems]) => groupItems.length > 0)
    .map(([name, groupItems]) => ({name, candidates: groupItems}));
}

export function primaryRiskSeverity(candidate) {
  const severities = new Set((candidate.analysis?.riskTags ?? []).map((tag) => tag.severity).filter(Boolean));
  return SEVERITY_ORDER.find((severity) => severities.has(severity)) ?? 'none';
}

export function groupCandidatesByAction(candidates) {
  return groupBy(candidates, (candidate) => candidate.analysis?.action ?? 'consider', ACTION_ORDER);
}

export function groupCandidatesByRiskSeverity(candidates) {
  return groupBy(candidates, primaryRiskSeverity, SEVERITY_ORDER);
}

export function candidateActionSummary(candidates) {
  const summary = Object.fromEntries(ACTION_ORDER.map((action) => [action, 0]));
  for (const candidate of candidates) {
    const action = candidate.analysis?.action ?? 'consider';
    summary[action] = (summary[action] ?? 0) + 1;
  }
  return summary;
}

export function candidateRiskSummary(candidates) {
  const summary = Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, 0]));
  for (const candidate of candidates) {
    const severity = primaryRiskSeverity(candidate);
    summary[severity] = (summary[severity] ?? 0) + 1;
  }
  return summary;
}
