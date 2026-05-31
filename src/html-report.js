import {topCandidates} from './candidate-ranking.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(candidate) {
  return `${candidate.currency} ${candidate.amount.toLocaleString('en-US')}`;
}

function dateOnly(value) {
  return value ? value.slice(0, 10) : 'unknown';
}

function checksText(checks) {
  if (checks.state === 'unknown') return 'unknown';
  if (checks.state === 'passing') return `passing (${checks.total})`;
  if (checks.state === 'pending') return `pending (${checks.pending}/${checks.total})`;
  return `failing (${checks.failing}/${checks.total})`;
}

function severityClass(tag, fallback = '') {
  if (tag?.severity === 'high') return 'high';
  if (tag?.severity === 'medium') return 'medium';
  if (tag?.severity === 'low') return 'low';
  return fallback;
}

function tagsHtml(tags, className = '') {
  if (!tags?.length) return '<span class="muted">none</span>';
  return tags.map((item) => `<span class="pill ${severityClass(item, className)}" title="${escapeHtml(item.detail)}">${escapeHtml(item.severity ? `${item.severity}/${item.name}` : item.name)}</span>`).join(' ');
}

function changeList(report) {
  if (!report.changeSummary) return '';
  if (!report.changes?.length) return '<p class="muted">No changes detected since the previous state snapshot.</p>';

  const items = report.changes
    .map(
      (change) => `
        <li>
          <a href="${escapeHtml(change.url)}">${escapeHtml(change.repository)}#${escapeHtml(change.number)}</a>
          <strong>${escapeHtml(change.title)}</strong>
          <span class="pill ${escapeHtml(change.severity)}">${escapeHtml(change.severity)}</span>
          <div class="muted">${escapeHtml(change.reasons.join('; '))}</div>
        </li>`,
    )
    .join('');

  return `<ul class="plain-list">${items}</ul>`;
}

function topCandidatesHtml(candidates) {
  const top = topCandidates(candidates);
  if (!top.length) return '<p class="muted">No recommended candidates to highlight.</p>';

  return `<ul class="plain-list">${top
    .map(
      (candidate) => `
        <li>
          <a href="${escapeHtml(candidate.url)}">${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)}</a>
          <span class="pill ${candidate.analysis?.action === 'act-now' ? 'low' : candidate.analysis?.action === 'skip' ? 'high' : candidate.analysis?.action === 'manual-review' ? 'medium' : ''}">${escapeHtml(candidate.analysis?.action ?? 'consider')}</span>
          <span class="pill ${candidate.analysis?.recommendation === 'strong' ? 'low' : candidate.analysis?.recommendation === 'risky' ? 'medium' : ''}">${escapeHtml(candidate.analysis?.recommendation ?? 'unknown')}</span>
          <span class="muted">score ${escapeHtml(candidate.score.total)} / ${escapeHtml(money(candidate))}</span>
          <div>${escapeHtml(candidate.title)}</div>
          <div class="muted">Why: ${escapeHtml((candidate.analysis?.reasonTags ?? []).map((item) => item.name).join(', ') || 'none')}</div>
          <div class="muted">Risks: ${escapeHtml((candidate.analysis?.riskTags ?? []).map((item) => item.name).join(', ') || 'none')}</div>
        </li>`,
    )
    .join('')}</ul>`;
}

function linkedPullRequestsHtml(candidate) {
  if (!candidate.pullRequests?.length) return '<p class="muted">No linked or mentioned PRs found.</p>';

  const rows = candidate.pullRequests
    .map((pr) => {
      const sources = pr.detectionSources?.length ? pr.detectionSources.join('+') : 'unknown';
      return `
        <tr>
          <td><a href="${escapeHtml(pr.url)}">#${escapeHtml(pr.number)}</a></td>
          <td>${escapeHtml(pr.title)}</td>
          <td>${escapeHtml(pr.state)}</td>
          <td>${escapeHtml(dateOnly(pr.updatedAt))}</td>
          <td>${escapeHtml(sources)}</td>
        </tr>`;
    })
    .join('');

  return `<table><thead><tr><th>PR</th><th>Title</th><th>State</th><th>Updated</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function competitionDetailsHtml(candidates) {
  if (!candidates.length) return '';

  return `
    <h2>Competition Details</h2>
    ${candidates
      .map(
        (candidate) => `
          <section>
            <h3><a href="${escapeHtml(candidate.url)}">${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)}</a></h3>
            ${linkedPullRequestsHtml(candidate)}
          </section>`,
      )
      .join('')}`;
}

function page({title, generatedAt, summary, body}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fb;
      --panel: #ffffff;
      --text: #18202f;
      --muted: #697386;
      --border: #d9deea;
      --accent: #116149;
      --high: #a83232;
      --medium: #8a5a00;
      --low: #315f9f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 48px; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .muted { color: var(--muted); font-size: 14px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }
    .metric {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
    }
    .metric strong { display: block; font-size: 22px; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td { padding: 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { font-size: 13px; color: var(--muted); background: #eef1f6; }
    tr:last-child td { border-bottom: 0; }
    .pill {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 12px;
      border: 1px solid var(--border);
      background: #f4f6fa;
      white-space: nowrap;
    }
    .high { color: var(--high); border-color: #e7b6b6; background: #fff1f1; }
    .medium { color: var(--medium); border-color: #e7d2a5; background: #fff8e9; }
    .low { color: var(--low); border-color: #b8c9e6; background: #f1f6ff; }
    .plain-list { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px 18px 12px 32px; }
    .plain-list li { margin: 8px 0; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="muted">Generated: ${escapeHtml(generatedAt)}</div>
    </header>
    <section class="summary">${summary}</section>
    ${body}
  </main>
</body>
</html>
`;
}

export function renderScanHtmlReport(report) {
  const rows = report.candidates
    .map(
      (candidate) => `
        <tr>
          <td>${escapeHtml(candidate.score.total)}</td>
          <td><span class="pill ${candidate.analysis?.action === 'act-now' ? 'low' : candidate.analysis?.action === 'skip' ? 'high' : candidate.analysis?.action === 'manual-review' ? 'medium' : ''}">${escapeHtml(candidate.analysis?.action ?? 'consider')}</span></td>
          <td><span class="pill ${candidate.analysis?.recommendation === 'strong' ? 'low' : candidate.analysis?.recommendation === 'risky' ? 'medium' : candidate.analysis?.recommendation === 'skip' ? 'high' : ''}">${escapeHtml(candidate.analysis?.recommendation ?? 'unknown')}</span></td>
          <td>${escapeHtml(money(candidate))}</td>
          <td><a href="${escapeHtml(candidate.url)}">${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)}</a><div>${escapeHtml(candidate.title)}</div></td>
          <td>${escapeHtml(candidate.pullRequestCount)} PR(s)</td>
          <td>${tagsHtml(candidate.analysis?.riskTags, 'medium')}</td>
          <td>${escapeHtml(dateOnly(candidate.updatedAt))}</td>
        </tr>`,
    )
    .join('');

  const body = `
    <h2>Changes</h2>
    ${changeList(report)}
    <h2>Top Candidates</h2>
    ${topCandidatesHtml(report.candidates)}
    <h2>Candidates</h2>
    ${
      rows
        ? `<table><thead><tr><th>Score</th><th>Action</th><th>Recommendation</th><th>Bounty</th><th>Issue</th><th>Competition</th><th>Risks</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="muted">No bounty candidates matched the current filters.</p>'
    }
    ${competitionDetailsHtml(report.candidates)}
  `;

  return page({
    title: 'Open Bounty Radar Report',
    generatedAt: report.generatedAt,
    summary: `
      <div class="metric"><span class="muted">Candidates</span><strong>${escapeHtml(report.candidates.length)}</strong></div>
      <div class="metric"><span class="muted">Repositories</span><strong>${escapeHtml(report.repositories.length)}</strong></div>
      <div class="metric"><span class="muted">Warnings</span><strong>${escapeHtml(report.errors?.length ?? 0)}</strong></div>
    `,
    body,
  });
}

export function renderWatchHtmlReport(report) {
  const attentionCount = report.pullRequests.filter((item) => item.needsAttention).length;
  const rows = report.pullRequests
    .map(
      (item) => `
        <tr>
          <td><span class="pill ${item.needsAttention ? 'high' : 'low'}">${escapeHtml(item.status)}</span></td>
          <td><a href="${escapeHtml(item.url)}">${escapeHtml(item.repository)}#${escapeHtml(item.number)}</a><div>${escapeHtml(item.title)}</div></td>
          <td>${escapeHtml(checksText(item.checks))}</td>
          <td>${escapeHtml(dateOnly(item.updatedAt))}</td>
        </tr>`,
    )
    .join('');

  const body = `
    <h2>Changes</h2>
    ${changeList(report)}
    <h2>Watched Pull Requests</h2>
    ${
      rows
        ? `<table><thead><tr><th>Status</th><th>PR</th><th>Checks</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="muted">No pull requests are currently watched.</p>'
    }
  `;

  return page({
    title: 'Open Bounty Radar PR Watch Report',
    generatedAt: report.generatedAt,
    summary: `
      <div class="metric"><span class="muted">Pull requests</span><strong>${escapeHtml(report.pullRequests.length)}</strong></div>
      <div class="metric"><span class="muted">Needs attention</span><strong>${escapeHtml(attentionCount)}</strong></div>
      <div class="metric"><span class="muted">Warnings</span><strong>${escapeHtml(report.errors?.length ?? 0)}</strong></div>
    `,
    body,
  });
}
