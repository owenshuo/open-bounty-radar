import {topCandidates} from './candidate-ranking.js';

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function renderCandidatesCsv(report) {
  const headers = ['repository', 'number', 'title', 'url', 'amount', 'currency', 'score', 'action', 'recommendation', 'risk'];
  const rows = report.candidates.map((candidate) => [
    candidate.repository,
    candidate.number,
    candidate.title,
    candidate.url,
    candidate.amount,
    candidate.currency,
    candidate.score.total,
    candidate.analysis?.action ?? 'consider',
    candidate.analysis?.recommendation ?? 'unknown',
    (candidate.analysis?.riskTags ?? []).map((risk) => `${risk.severity ?? 'unknown'}/${risk.name}`).join('; '),
  ]);
  return `${[headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
}

export function renderCandidatesJsonl(report) {
  return `${report.candidates.map((candidate) => JSON.stringify(candidate)).join('\n')}\n`;
}

export function renderActionPlan(report) {
  const lines = ['# Open Bounty Radar Action Plan', '', `Generated: ${report.generatedAt}`, ''];
  const top = topCandidates(report.candidates, 10);
  if (!top.length) {
    lines.push('No actionable candidates found.', '');
    return `${lines.join('\n')}\n`;
  }

  for (const candidate of top) {
    lines.push(`## ${candidate.analysis?.action ?? 'consider'}: ${candidate.repository}#${candidate.number}`);
    lines.push('');
    lines.push(`- Issue: [${candidate.title}](${candidate.url})`);
    lines.push(`- Bounty: ${candidate.currency} ${candidate.amount}`);
    lines.push(`- Score: ${candidate.score.total}`);
    lines.push(`- Risks: ${(candidate.analysis?.riskTags ?? []).map((risk) => `${risk.severity ?? 'unknown'}/${risk.name}`).join(', ') || 'none'}`);
    if (candidate.assessment) {
      lines.push(`- Assessment: ${candidate.assessment.verdict} (${candidate.assessment.confidence}% confidence)`);
      lines.push(`- Likely files: ${candidate.assessment.likelyFiles.join('; ')}`);
    }
    lines.push(`- Suggested next step: ${candidate.analysis?.action === 'act-now' ? 'review issue and reproduce immediately' : candidate.analysis?.action === 'watch' ? 'monitor competition before starting' : candidate.analysis?.action === 'manual-review' ? 'read requirements and decide manually' : 'skip for now'}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export function renderWatchlistSuggestions(report) {
  const pullRequests = report.candidates
    .filter((candidate) => ['act-now', 'watch', 'manual-review'].includes(candidate.analysis?.action))
    .map((candidate) => ({
      owner: candidate.repository.split('/')[0],
      repo: candidate.repository.split('/')[1],
      issueNumber: candidate.number,
      issueUrl: candidate.url,
      label: `${candidate.platform ?? candidate.adapter ?? 'GitHub'} ${candidate.repository}#${candidate.number} ${candidate.currency} ${candidate.amount}`,
      action: candidate.analysis?.action ?? 'consider',
      assessment: candidate.assessment?.verdict ?? null,
      note: 'Add the submitted PR number here after opening a pull request.',
      number: null,
    }));

  return `${JSON.stringify({generatedAt: report.generatedAt, pullRequestSuggestions: pullRequests}, null, 2)}\n`;
}
