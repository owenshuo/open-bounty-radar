function riskNames(candidate) {
  return new Set((candidate.analysis?.riskTags ?? []).map((risk) => risk.name));
}

function confidenceFor(candidate) {
  const risks = riskNames(candidate);
  let confidence = 70;
  if (candidate.analysis?.action === 'act-now') confidence += 15;
  if (candidate.pullRequestCount === 0) confidence += 10;
  if (candidate.competition?.summary?.risk === 'high') confidence -= 25;
  if (risks.has('thin-description')) confidence -= 10;
  if (risks.has('special-requirements')) confidence -= 20;
  return Math.max(10, Math.min(95, confidence));
}

function verdictFor(candidate) {
  const risks = riskNames(candidate);
  if (candidate.state !== 'open' || candidate.analysis?.action === 'skip') return 'skip';
  if (candidate.competition?.summary?.risk === 'high') return 'avoid-unless-better';
  if (risks.has('special-requirements') || risks.has('unclear')) return 'manual-review';
  if (candidate.analysis?.action === 'act-now') return 'start-now';
  if (candidate.analysis?.action === 'watch') return 'watch-first';
  return 'consider';
}

function likelyFiles(candidate) {
  const text = `${candidate.title} ${(candidate.labels ?? []).join(' ')}`.toLowerCase();
  const hints = [];
  if (/ui|modal|screen|page|button|selector|navigation/.test(text)) hints.push('frontend screens/components/routes');
  if (/api|server|backend|database|db|sql/.test(text)) hints.push('server/API/data-access layer');
  if (/test|ci|workflow|docker|image/.test(text)) hints.push('tests/CI/build configuration');
  if (/expense|report|workspace|policy|approval/.test(text)) hints.push('domain actions and policy/report helpers');
  return hints.length ? hints : ['issue-linked implementation files', 'nearby tests for the affected behavior'];
}

export function assessCandidate(candidate) {
  const verdict = verdictFor(candidate);
  const confidence = confidenceFor(candidate);
  const risks = riskNames(candidate);
  const nextSteps = [];
  const abandonIf = [];

  if (verdict === 'start-now') nextSteps.push('Reproduce the issue and inspect linked domain code immediately.');
  else if (verdict === 'watch-first') nextSteps.push('Read linked PRs first, then decide whether a better implementation is still possible.');
  else if (verdict === 'avoid-unless-better') nextSteps.push('Open competing PRs and continue only if they are incomplete, failing, or missing regression tests.');
  else if (verdict === 'manual-review') nextSteps.push('Confirm account, hardware, and unclear requirement risks before coding.');
  else nextSteps.push('Read the issue body and project contribution rules before starting.');

  nextSteps.push('Identify the smallest behavior-focused regression test.');
  nextSteps.push('Check maintainer comments, labels, and assignment/payment rules.');

  if (candidate.competition?.summary?.strong || candidate.competition?.summary?.winner) abandonIf.push('A competing PR is already approved, merged, selected, or clearly better.');
  if (risks.has('special-requirements')) abandonIf.push('Required account, device, or paid workspace is unavailable.');
  if (risks.has('unclear')) abandonIf.push('Acceptance criteria cannot be confirmed from the issue or maintainer comments.');
  if (!abandonIf.length) abandonIf.push('A newer maintainer comment changes the scope or closes the issue.');

  return {
    verdict,
    confidence,
    likelyFiles: likelyFiles(candidate),
    nextSteps,
    abandonIf,
  };
}

export function attachAssessments(candidates) {
  return candidates.map((candidate) => ({...candidate, assessment: assessCandidate(candidate)}));
}
