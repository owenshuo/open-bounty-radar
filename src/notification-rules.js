const SEVERITY_RANK = {low: 1, medium: 2, high: 3};
const RULE_PRESETS = {
  quiet: {minSeverity: 'high', actions: ['act-now', 'fix-ci', 'reply'], minAmount: 250},
  aggressive: {minSeverity: 'low'},
  'high-value-only': {minSeverity: 'medium', minAmount: 1000},
  'low-competition-only': {minSeverity: 'medium', competitionRisks: ['none', 'low'], actions: ['act-now', 'watch']},
};

export function availableNotificationRulePresets() {
  return Object.keys(RULE_PRESETS);
}

export function resolveNotificationRules(rules = {}) {
  const preset = rules.preset ? (RULE_PRESETS[rules.preset] ?? {}) : {};
  return {...preset, ...rules};
}

function severityAtLeast(value, minimum = 'low') {
  return (SEVERITY_RANK[value] ?? 0) >= (SEVERITY_RANK[minimum] ?? 1);
}

function listIncludes(list, value) {
  return !Array.isArray(list) || list.length === 0 || list.includes(value);
}

export function filterChangesByNotificationRules(changes, rules = {}) {
  const resolved = resolveNotificationRules(rules);
  return changes.filter((change) => {
    if (!severityAtLeast(change.severity, resolved.minSeverity ?? 'low')) return false;
    if (!listIncludes(resolved.actions, change.action)) return false;
    if (!listIncludes(resolved.riskSeverities, change.riskSeverity)) return false;
    if (!listIncludes(resolved.competitionRisks, change.competitionRisk)) return false;
    if (resolved.minAmount && Number(change.amount ?? 0) < Number(resolved.minAmount)) return false;
    if (resolved.onlyNeedsAttention && !change.needsAttention && change.action !== 'fix-ci' && change.action !== 'reply') return false;
    return true;
  });
}
