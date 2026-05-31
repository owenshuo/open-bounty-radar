import {topCandidates} from './candidate-ranking.js';

function money(candidate) {
  return `${candidate.currency} ${candidate.amount.toLocaleString('en-US')}`;
}

function prSummary(candidate) {
  if (candidate.pullRequestCount === 0) return '0 linked/mentioned PRs';
  const prs = candidate.pullRequests
    .slice(0, 3)
    .map((pr) => {
      const sources = pr.detectionSources?.length ? ` (${pr.detectionSources.join('+')})` : '';
      return `[#${pr.number}](${pr.url})${sources}`;
    })
    .join(', ');
  return `${candidate.pullRequestCount} PR(s): ${prs}`;
}

function tagSummary(tags) {
  if (!tags?.length) return 'none';
  return tags.map((item) => `${item.name}: ${item.detail}`).join('; ');
}

function appendChanges(lines, report) {
  if (!report.changeSummary) return;

  lines.push('## Changes', '');
  if (report.changeSummary.firstRun) lines.push(`State initialized: ${report.changeSummary.statePath}`, '');
  if (!report.changes?.length) {
    lines.push('No changes detected since the previous state snapshot.', '');
    return;
  }

  for (const change of report.changes) {
    lines.push(`- [${change.repository}#${change.number}](${change.url}) ${change.title} (${change.severity}): ${change.reasons.join('; ')}`);
  }
  lines.push('');
}

function appendTopCandidates(lines, candidates) {
  const top = topCandidates(candidates);
  lines.push('## Top Candidates', '');
  if (!top.length) {
    lines.push('No recommended candidates to highlight.', '');
    return;
  }

  for (const candidate of top) {
    const reasons = tagSummary(candidate.analysis?.reasonTags);
    const risks = tagSummary(candidate.analysis?.riskTags);
    lines.push(`- [${candidate.repository}#${candidate.number}](${candidate.url}) ${candidate.analysis?.recommendation ?? 'unknown'} / score ${candidate.score.total} / ${money(candidate)}`);
    lines.push(`  - Why: ${reasons}`);
    lines.push(`  - Risks: ${risks}`);
  }
  lines.push('');
}

export function renderMarkdownReport(report) {
  const lines = [
    '# Open Bounty Radar Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Repositories: ${report.repositories.join(', ')}`,
    '',
    `Candidates: ${report.candidates.length}`,
    '',
  ];

  if (report.candidates.length === 0) {
    lines.push('No bounty candidates matched the current filters.', '');
    appendChanges(lines, report);
    if (report.errors?.length) {
      lines.push('## Scan Warnings', '');
      for (const error of report.errors) {
        lines.push(`- ${error.repository}: ${error.message.split('\n')[0]}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  appendChanges(lines, report);
  appendTopCandidates(lines, report.candidates);

  lines.push('| Score | Recommendation | Bounty | Issue | Competition | Risks | Updated |');
  lines.push('| ---: | --- | --- | --- | --- | --- | --- |');
  for (const candidate of report.candidates) {
    lines.push(
      `| ${candidate.score.total} | ${candidate.analysis?.recommendation ?? 'unknown'} | ${money(candidate)} | [${candidate.repository}#${candidate.number}: ${candidate.title.replaceAll('|', '\\|')}](${candidate.url}) | ${prSummary(candidate)} | ${tagSummary(candidate.analysis?.riskTags).replaceAll('|', '\\|')} | ${candidate.updatedAt.slice(0, 10)} |`,
    );
  }

  lines.push('', '## Details', '');
  for (const candidate of report.candidates) {
    lines.push(`### ${candidate.repository}#${candidate.number}`);
    lines.push('');
    lines.push(`- Title: [${candidate.title}](${candidate.url})`);
    lines.push(`- Bounty: ${money(candidate)} (${candidate.rawAmount})`);
    lines.push(`- State: ${candidate.state}`);
    lines.push(`- Labels: ${candidate.labels.length ? candidate.labels.join(', ') : 'none'}`);
    lines.push(`- Recommendation: ${candidate.analysis?.recommendation ?? 'unknown'}`);
    lines.push(`- Why: ${tagSummary(candidate.analysis?.reasonTags)}`);
    lines.push(`- Risks: ${tagSummary(candidate.analysis?.riskTags)}`);
    lines.push(`- Competition: ${prSummary(candidate)}`);
    lines.push(`- PR detection: ${candidate.pullRequestDetection ?? 'search'}`);
    if (candidate.pullRequestDetectionWarnings?.length) lines.push(`- PR detection warnings: ${candidate.pullRequestDetectionWarnings.join('; ')}`);
    lines.push(`- Score breakdown: ${JSON.stringify(candidate.score)}`);
    lines.push('');
  }

  if (report.errors?.length) {
    lines.push('## Scan Warnings', '');
    for (const error of report.errors) {
      lines.push(`- ${error.repository}: ${error.message.split('\n')[0]}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
