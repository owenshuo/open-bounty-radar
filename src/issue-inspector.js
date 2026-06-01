import {analyzeCandidate} from './candidate-analysis.js';
import {assessCandidate} from './ai-assessment.js';
import {analyzePullRequestCompetition} from './competition.js';
import {analyzeIssueComments} from './comment-signals.js';
import {findLinkedPullRequests} from './linked-prs.js';
import {findBountyAmount} from './money.js';
import {scoreCandidate} from './score.js';
import {issueTimelineSignals} from './timeline-signals.js';

const ISSUE_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i;

export function parseIssueUrl(url) {
  const match = ISSUE_URL.exec(url ?? '');
  if (!match) throw new Error(`Unsupported GitHub issue URL: ${url}`);
  return {owner: match[1], repo: match[2], number: Number(match[3]), fullName: `${match[1]}/${match[2]}`};
}

export async function inspectIssue(client, {issueUrl, defaults = {}}) {
  const issueRef = parseIssueUrl(issueUrl);
  const issue = await client.getIssue({fullName: issueRef.fullName, number: issueRef.number});
  const issueText = `${issue.title ?? ''}\n${issue.body ?? ''}`;
  const bounty = findBountyAmount(issueText) ?? {amount: 0, currency: 'UNKNOWN', raw: 'not detected'};
  const strategy = defaults.linkedPullRequestDetection ?? 'both';
  const linked = await findLinkedPullRequests(client, {
    fullName: issueRef.fullName,
    issueNumber: issueRef.number,
    issueUrl,
    strategy,
  });
  const competition = await analyzePullRequestCompetition(client, {
    fullName: issueRef.fullName,
    pullRequests: linked.pullRequests,
    limit: defaults.competitionDetailLimit ?? 8,
  });
  const comments = client.listIssueComments ? await client.listIssueComments({fullName: issueRef.fullName, number: issueRef.number, perPage: defaults.commentSignalLimit ?? 50}).catch(() => []) : [];

  const candidate = {
    adapter: 'github',
    platform: 'GitHub',
    repository: issueRef.fullName,
    number: issueRef.number,
    title: issue.title,
    url: issue.html_url ?? issueUrl,
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    labels: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean),
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login).filter(Boolean),
    bountySignals: {
      assigned: (issue.assignees ?? []).length > 0,
      labelSignals: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)).filter((label) => /assigned|selected|winner|paid|completed/i.test(label ?? '')),
      timelineSignals: strategy === 'search' ? [] : issueTimelineSignals(await client.listIssueTimeline({fullName: issueRef.fullName, number: issueRef.number}).catch(() => [])),
      commentSignals: analyzeIssueComments(comments),
    },
    amount: bounty.amount,
    currency: bounty.currency,
    rawAmount: bounty.raw,
    pullRequestCount: competition.pullRequests.length,
    pullRequestDetection: strategy,
    pullRequestDetectionWarnings: [...linked.warnings, ...competition.warnings],
    competition: {summary: competition.summary, detailLimit: defaults.competitionDetailLimit ?? 8},
    pullRequests: competition.pullRequests,
  };
  const scored = {...candidate, score: scoreCandidate(candidate)};
  const analyzed = {...scored, analysis: analyzeCandidate(scored, {text: issueText})};
  return {...analyzed, assessment: assessCandidate(analyzed)};
}

export async function inspectIssues(client, {issueUrls, defaults = {}}) {
  const candidates = [];
  const errors = [];
  for (const issueUrl of issueUrls) {
    try {
      candidates.push(await inspectIssue(client, {issueUrl, defaults}));
    } catch (error) {
      errors.push({issueUrl, message: error instanceof Error ? error.message : String(error)});
    }
  }
  return {generatedAt: new Date().toISOString(), candidates, errors};
}

export function renderIssueInspectionMarkdown(candidate) {
  const lines = [
    `# Issue Inspection: ${candidate.repository}#${candidate.number}`,
    '',
    `Issue: [${candidate.title}](${candidate.url})`,
    `State: ${candidate.state}`,
    `Bounty: ${candidate.currency} ${candidate.amount} (${candidate.rawAmount})`,
    `Action: ${candidate.analysis?.action ?? 'consider'}`,
    `Assessment: ${candidate.assessment.verdict} (${candidate.assessment.confidence}% confidence)`,
    `Competition: ${candidate.competition?.summary?.risk ?? 'unknown'} risk, ${candidate.pullRequestCount} linked PR(s)`,
    '',
    '## Next Steps',
    '',
    ...candidate.assessment.nextSteps.map((step) => `- ${step}`),
    '',
    '## Abandon If',
    '',
    ...candidate.assessment.abandonIf.map((step) => `- ${step}`),
    '',
    '## Likely Files',
    '',
    ...candidate.assessment.likelyFiles.map((hint) => `- ${hint}`),
    '',
    '## Competing Pull Requests',
    '',
  ];
  if (!candidate.pullRequests.length) lines.push('No linked pull requests found.');
  for (const pr of candidate.pullRequests) lines.push(`- [#${pr.number}: ${pr.title}](${pr.url}) - ${pr.strength ?? 'unknown'} - ${pr.checks?.state ?? 'unknown checks'} - ${pr.latestReviewState ?? 'no review'}`);
  return `${lines.join('\n')}\n`;
}

export function renderIssueInspectionBatchMarkdown(report) {
  const lines = ['# Issue Inspection Batch', '', `Generated: ${report.generatedAt}`, '', `Issues inspected: ${report.candidates.length}`, ''];
  for (const candidate of report.candidates) {
    lines.push(`## ${candidate.repository}#${candidate.number}`, '');
    lines.push(`- Issue: [${candidate.title}](${candidate.url})`);
    lines.push(`- Action: ${candidate.analysis?.action ?? 'consider'}`);
    lines.push(`- Assessment: ${candidate.assessment.verdict} (${candidate.assessment.confidence}% confidence)`);
    lines.push(`- Readiness: ${candidate.readiness?.status ?? 'unknown'}`);
    lines.push(`- Competition: ${candidate.competition?.summary?.risk ?? 'unknown'} risk, ${candidate.pullRequestCount} PR(s)`, '');
  }
  if (report.errors?.length) {
    lines.push('## Errors', '');
    for (const error of report.errors) lines.push(`- ${error.issueUrl}: ${error.message}`);
  }
  return `${lines.join('\n')}\n`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderIssueInspectionBatchHtml(report) {
  const rows = report.candidates
    .map(
      (candidate) => `<tr>
        <td>
          <a href="${escapeHtml(candidate.detailPath ?? candidate.url)}">${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)}</a>
          ${candidate.detailPath ? `<span> · <a href="${escapeHtml(candidate.url)}">GitHub</a></span>` : ''}
          <br><span>${escapeHtml(candidate.title)}</span>
        </td>
        <td>${escapeHtml(candidate.currency)} ${escapeHtml(candidate.amount)}</td>
        <td>${escapeHtml(candidate.analysis?.action ?? 'consider')}</td>
        <td>${escapeHtml(candidate.assessment?.verdict ?? 'unknown')} · ${escapeHtml(candidate.assessment?.confidence ?? 'n/a')}%</td>
        <td>${escapeHtml(candidate.readiness?.status ?? 'unknown')}</td>
        <td>${escapeHtml(candidate.competition?.summary?.risk ?? 'unknown')} · ${escapeHtml(candidate.pullRequestCount)} PR(s)</td>
      </tr>`,
    )
    .join('');
  const errorRows = (report.errors ?? [])
    .map((error) => `<li><strong>${escapeHtml(error.issueUrl)}</strong>: ${escapeHtml(error.message)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open Bounty Radar Issue Inspection</title>
  <style>
    :root { --bg: #f4f7fb; --panel: #fff; --text: #18202f; --muted: #667085; --border: #d7deea; --accent: #116149; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1160px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 6px; font-size: 30px; letter-spacing: 0; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .muted, td span { color: var(--muted); font-size: 13px; }
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 30px rgba(24, 32, 47, 0.07); padding: 16px; margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--border); padding: 11px 10px; text-align: left; vertical-align: top; font-size: 14px; }
    th { color: var(--muted); background: #f8fafc; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Issue Inspection</h1>
    <div class="muted">Generated: ${escapeHtml(report.generatedAt)} · ${escapeHtml(report.candidates.length)} issue(s) · ${escapeHtml(report.errors?.length ?? 0)} error(s)</div>
    <section class="panel">
      <table>
        <thead><tr><th>Issue</th><th>Bounty</th><th>Action</th><th>Assessment</th><th>Readiness</th><th>Competition</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    ${
      errorRows
        ? `<section class="panel"><h2>Errors</h2><ul>${errorRows}</ul></section>`
        : ''
    }
  </main>
</body>
</html>`;
}
