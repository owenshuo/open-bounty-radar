function item(id, label, status, detail) {
  return {id, label, status, detail};
}

export function readinessChecklist(candidate) {
  const risks = new Set((candidate.analysis?.riskTags ?? []).map((risk) => risk.name));
  const checks = [
    item('open', 'Issue is still open', candidate.state === 'open' ? 'pass' : 'fail', `state: ${candidate.state}`),
    item('bounty', 'Bounty amount is detected', candidate.amount > 0 ? 'pass' : 'fail', `${candidate.currency} ${candidate.amount}`),
    item('competition', 'Competition is not already winning', candidate.competition?.summary?.winner ? 'fail' : candidate.competition?.summary?.strong ? 'warning' : 'pass', candidate.competition?.summary ? `${candidate.competition.summary.risk} risk` : 'unknown'),
    item('repro', 'Reproduction signal exists', risks.has('no-repro-signal') ? 'warning' : 'pass', risks.has('no-repro-signal') ? 'no obvious reproduction wording' : 'repro wording detected'),
    item('requirements', 'No unavailable account/device requirement', risks.has('special-requirements') ? 'fail' : 'pass', risks.has('special-requirements') ? 'special requirement risk' : 'none detected'),
    item('scope', 'Scope looks clear enough to implement', risks.has('unclear') || risks.has('thin-description') ? 'warning' : 'pass', risks.has('unclear') ? 'unclear wording' : risks.has('thin-description') ? 'thin description' : 'clear enough'),
  ];
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warning').length;
  const status = failed ? 'blocked' : warnings ? 'needs-review' : 'ready';
  return {status, checks};
}

export function attachReadiness(candidates) {
  return candidates.map((candidate) => ({...candidate, readiness: readinessChecklist(candidate)}));
}
