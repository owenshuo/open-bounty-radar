function truncate(text, max = 100) {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length <= max ? singleLine : `${singleLine.slice(0, max - 3)}...`;
}

function checksText(checks) {
  if (checks.state === 'unknown') return 'unknown';
  if (checks.state === 'passing') return `passing (${checks.total})`;
  if (checks.state === 'pending') return `pending (${checks.pending}/${checks.total})`;
  return `failing (${checks.failing}/${checks.total})`;
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

export function renderWatchReport(report) {
  const lines = [
    '# Open Bounty Radar PR Watch Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Pull requests: ${report.pullRequests.length}`,
    '',
  ];

  if (report.pullRequests.length) {
    lines.push('| Status | PR | Checks | Latest activity |');
    lines.push('| --- | --- | --- | --- |');
    for (const item of report.pullRequests) {
      const label = item.label ? `${item.label}: ` : '';
      const activity = item.latestActivity[0]
        ? `${item.latestActivity[0].type} by ${item.latestActivity[0].author}: ${truncate(item.latestActivity[0].body || item.latestActivity[0].state || '')}`
        : 'none';
      lines.push(`| ${item.status} | [${item.repository}#${item.number}: ${(label + item.title).replaceAll('|', '\\|')}](${item.url}) | ${checksText(item.checks)} | ${activity.replaceAll('|', '\\|')} |`);
    }
    lines.push('');
  }

  appendChanges(lines, report);

  const attention = report.pullRequests.filter((item) => item.needsAttention);
  lines.push('## Needs Attention', '');
  if (!attention.length) {
    lines.push('No watched pull requests currently need attention.', '');
  } else {
    for (const item of attention) {
      lines.push(`- [${item.repository}#${item.number}](${item.url}) ${item.status}: ${item.title}`);
    }
    lines.push('');
  }

  lines.push('## Details', '');
  for (const item of report.pullRequests) {
    lines.push(`### ${item.repository}#${item.number}`);
    lines.push('');
    lines.push(`- Title: [${item.title}](${item.url})`);
    if (item.label) lines.push(`- Label: ${item.label}`);
    lines.push(`- State: ${item.state}${item.merged ? ' (merged)' : ''}${item.draft ? ' (draft)' : ''}`);
    lines.push(`- Branch: ${item.headRef}`);
    lines.push(`- Updated: ${item.updatedAt}`);
    lines.push(`- Checks: ${checksText(item.checks)}`);
    lines.push(`- Status: ${item.status}`);
    if (item.latestActivity.length) {
      lines.push('- Latest activity:');
      for (const event of item.latestActivity) {
        lines.push(`  - ${event.createdAt} ${event.type} by ${event.author} (${event.association}): ${truncate(event.body || event.state || '', 160)}`);
      }
    }
    lines.push('');
  }

  if (report.errors?.length) {
    lines.push('## Watch Warnings', '');
    for (const error of report.errors) lines.push(`- ${error.repository}#${error.number}: ${error.message.split('\n')[0]}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
