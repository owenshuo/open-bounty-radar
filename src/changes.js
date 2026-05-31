function issueKey(candidate) {
  return `issue:${candidate.repository}#${candidate.number}`;
}

function pullRequestKey(item) {
  return `pr:${item.repository}#${item.number}`;
}

function latestActivityFingerprint(activity) {
  if (!activity) return null;
  return [activity.createdAt, activity.type, activity.author, activity.state ?? '', activity.url ?? ''].join('|');
}

function activityNeedsAttention(activity) {
  if (!activity) return false;
  return ['COLLABORATOR', 'MEMBER', 'OWNER'].includes(activity.association) || activity.state === 'CHANGES_REQUESTED';
}

function scanSnapshot(report) {
  const items = {};
  for (const candidate of report.candidates) {
    items[issueKey(candidate)] = {
      key: issueKey(candidate),
      type: 'issue',
      repository: candidate.repository,
      number: candidate.number,
      title: candidate.title,
      url: candidate.url,
      state: candidate.state,
      amount: candidate.amount,
      currency: candidate.currency,
      pullRequestCount: candidate.pullRequestCount,
      competitionRisk: candidate.competition?.summary?.risk ?? 'unknown',
      strongCompetition: candidate.competition?.summary ? candidate.competition.summary.strong + candidate.competition.summary.winner : 0,
      scoreTotal: candidate.score.total,
      action: candidate.analysis?.action ?? 'consider',
      riskSeverity: candidate.analysis?.riskTags?.find((tag) => tag.severity === 'high')?.severity ?? candidate.analysis?.riskTags?.find((tag) => tag.severity === 'medium')?.severity ?? candidate.analysis?.riskTags?.find((tag) => tag.severity === 'low')?.severity ?? 'none',
      updatedAt: candidate.updatedAt,
    };
  }
  return {generatedAt: report.generatedAt, items};
}

function watchSnapshot(report) {
  const items = {};
  for (const item of report.pullRequests) {
    const latestActivity = item.latestActivity[0] ?? null;
    items[pullRequestKey(item)] = {
      key: pullRequestKey(item),
      type: 'pull_request',
      repository: item.repository,
      number: item.number,
      title: item.title,
      url: item.url,
      status: item.status,
      state: item.state,
      merged: item.merged,
      draft: item.draft,
      checksState: item.checks.state,
      failingChecks: item.checks.failing,
      pendingChecks: item.checks.pending,
      needsAttention: item.needsAttention,
      action: item.action ?? 'wait',
      winnerSignals: item.winnerSignals ?? [],
      latestActivity,
      latestActivityKey: latestActivityFingerprint(latestActivity),
      latestActivityNeedsAttention: activityNeedsAttention(latestActivity),
      updatedAt: item.updatedAt,
    };
  }
  return {generatedAt: report.generatedAt, items};
}

function changeFromCurrent(current, title, reasons, severity = 'medium') {
  return {
    key: current.key,
    type: current.type,
    severity,
    title,
    repository: current.repository,
    number: current.number,
    subject: current.title,
    url: current.url,
    reasons,
    action: current.action,
    riskSeverity: current.riskSeverity,
    amount: current.amount,
    currency: current.currency,
    competitionRisk: current.competitionRisk,
    needsAttention: current.needsAttention,
    winnerSignals: current.winnerSignals,
  };
}

function scanChange(previous, current) {
  if (!previous) return changeFromCurrent(current, 'New bounty candidate', [`${current.currency} ${current.amount}`, `${current.pullRequestCount} linked PR(s)`], 'high');

  const reasons = [];
  if (previous.state !== current.state) reasons.push(`state changed: ${previous.state} -> ${current.state}`);
  if (previous.amount !== current.amount || previous.currency !== current.currency) {
    reasons.push(`bounty changed: ${previous.currency} ${previous.amount} -> ${current.currency} ${current.amount}`);
  }
  if (previous.pullRequestCount !== current.pullRequestCount) reasons.push(`competition changed: ${previous.pullRequestCount} -> ${current.pullRequestCount} PR(s)`);
  if (previous.competitionRisk !== current.competitionRisk) reasons.push(`competition risk changed: ${previous.competitionRisk ?? 'unknown'} -> ${current.competitionRisk}`);
  if (previous.strongCompetition !== current.strongCompetition) reasons.push(`strong competing PRs changed: ${previous.strongCompetition ?? 0} -> ${current.strongCompetition}`);
  if (previous.action !== current.action) reasons.push(`action changed: ${previous.action ?? 'unknown'} -> ${current.action}`);
  if (previous.riskSeverity !== current.riskSeverity) reasons.push(`risk changed: ${previous.riskSeverity ?? 'unknown'} -> ${current.riskSeverity}`);

  if (!reasons.length) return null;
  const severity = current.state === 'open' && current.pullRequestCount <= 1 ? 'high' : 'medium';
  return changeFromCurrent(current, 'Bounty candidate changed', reasons, severity);
}

function watchChange(previous, current) {
  if (!previous) return null;

  const reasons = [];
  if (previous.status !== current.status) reasons.push(`status changed: ${previous.status} -> ${current.status}`);
  if (previous.action !== current.action) reasons.push(`next action changed: ${previous.action ?? 'unknown'} -> ${current.action}`);
  if (previous.checksState !== current.checksState) reasons.push(`checks changed: ${previous.checksState} -> ${current.checksState}`);
  if ((current.winnerSignals ?? []).length && JSON.stringify(previous.winnerSignals ?? []) !== JSON.stringify(current.winnerSignals ?? [])) reasons.push(`winner/payment signal: ${current.winnerSignals.join('; ')}`);
  if (!previous.needsAttention && current.needsAttention) reasons.push('now needs attention');
  if (previous.latestActivityKey !== current.latestActivityKey && current.latestActivityNeedsAttention) {
    const activity = current.latestActivity;
    reasons.push(`new maintainer activity: ${activity.type} by ${activity.author}`);
  }

  if (!reasons.length) return null;

  const highStatuses = new Set(['closed', 'merged', 'needs_attention']);
  const severity = highStatuses.has(current.status) || current.checksState === 'failing' || current.latestActivityNeedsAttention ? 'high' : 'medium';
  return changeFromCurrent(current, 'Watched pull request changed', reasons, severity);
}

export function buildSnapshot(kind, report) {
  if (kind === 'scan') return scanSnapshot(report);
  if (kind === 'watch') return watchSnapshot(report);
  throw new Error(`Unknown snapshot kind: ${kind}`);
}

export function detectReportChanges(kind, report, previousState = {}, {notifyOnFirstRun = false} = {}) {
  const snapshot = buildSnapshot(kind, report);
  const previousItems = previousState?.[kind]?.items ?? null;

  if (!previousItems) {
    const changes = notifyOnFirstRun
      ? Object.values(snapshot.items).map((item) =>
          changeFromCurrent(item, kind === 'scan' ? 'New bounty candidate' : 'New watched pull request baseline', ['first observed in state'], 'medium'),
        )
      : [];
    return {changes, firstRun: true, snapshot};
  }

  const changes = [];
  for (const current of Object.values(snapshot.items)) {
    const previous = previousItems[current.key];
    const change = kind === 'scan' ? scanChange(previous, current) : watchChange(previous, current);
    if (change) changes.push(change);
  }

  return {changes, firstRun: false, snapshot};
}
