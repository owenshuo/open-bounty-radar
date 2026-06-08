import {candidateActionSummary, candidateRiskSummary, groupCandidatesByAction} from './candidate-groups.js';
import {topCandidates} from './candidate-ranking.js';
import {parseHistoryJsonl, renderHistoryTrendSvg, summarizeHistory} from './trends.js';

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

export function candidateDetailFileName(candidate) {
  return `${candidate.repository.replaceAll('/', '__')}__${candidate.number}.html`.replaceAll(/[^a-zA-Z0-9_.-]/g, '-');
}

function riskNames(candidate) {
  const risks = candidate.analysis?.riskTags ?? [];
  if (!risks.length) return 'none';
  return risks.map((risk) => `${risk.severity ? `${risk.severity}/` : ''}${risk.name}`).join(', ');
}

function competitionSummaryText(candidate) {
  const summary = candidate.competition?.summary;
  if (!summary) return `${candidate.pullRequestCount} linked PR(s), detail analysis unavailable`;
  return `${summary.risk} risk · ${summary.open} open · ${summary.strong} strong · ${summary.winner} merged/winner · ${summary.failing} failing`;
}

function assessmentText(candidate) {
  if (!candidate.assessment) return 'assessment unavailable';
  return `${candidate.assessment.verdict} · ${candidate.assessment.confidence}%`;
}

function readinessText(candidate) {
  return candidate.readiness?.status ?? 'unknown';
}

function statusOptions(candidate) {
  return ['new', 'reading', 'doing', 'submitted', 'watching', 'skipped'].map((status) => `<option value="${status}"${(candidate.workspace?.status ?? 'new') === status ? ' selected' : ''}>${status}</option>`).join('');
}

function candidateCard(candidate) {
  const detailHref = candidate.detailPath ?? `details/${candidateDetailFileName(candidate)}`;
  const action = candidate.analysis?.action ?? 'consider';
  const readiness = readinessText(candidate);
  const riskText = riskNames(candidate);
  return `
    <article class="candidate candidate-card" id="candidate-${escapeHtml(candidate.repository.replaceAll('/', '-'))}-${escapeHtml(candidate.number)}" data-action="${escapeHtml(action)}" data-status="${escapeHtml(candidate.workspace?.status ?? 'new')}" data-readiness="${escapeHtml(readiness)}" data-competition="${escapeHtml(candidate.competition?.summary?.risk ?? 'unknown')}" data-risk="${escapeHtml(riskText)}" data-repo="${escapeHtml(candidate.repository)}" data-title="${escapeHtml(candidate.title.toLowerCase())}">
      <div class="candidate-main">
        <div class="candidate-kicker">
          <span class="issue-chip"><a class="issue-link" href="${escapeHtml(candidate.url)}">${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)}</a></span>
          <span class="meta-chip">${escapeHtml(candidate.platform ?? candidate.adapter ?? 'GitHub')}</span>
          <span class="meta-chip">${escapeHtml(money(candidate))}</span>
          <span class="meta-chip">score ${escapeHtml(candidate.score.total)}</span>
        </div>
        <h3>${escapeHtml(candidate.title)}</h3>
        <p>${escapeHtml(competitionSummaryText(candidate))} · ${escapeHtml(assessmentText(candidate))}</p>
        <textarea class="bench-note" data-workspace-key="${escapeHtml(`${candidate.repository}#${candidate.number}`)}" placeholder="Add local analysis note">${escapeHtml(candidate.workspace?.note ?? '')}</textarea>
      </div>
      <div class="candidate-tags">
        <div class="tag-row align-end">
          <select class="status-select" data-workspace-key="${escapeHtml(`${candidate.repository}#${candidate.number}`)}" aria-label="Candidate status">
            ${statusOptions(candidate)}
          </select>
          <span class="tag action-${escapeHtml(action)}">${escapeHtml(action)}</span>
          <span class="tag readiness-${escapeHtml(readiness)}">${escapeHtml(readiness)}</span>
        </div>
        <div class="tag-row align-end">
        <span class="tag">${escapeHtml(candidate.analysis?.recommendation ?? 'unknown')}</span>
          <a class="copy detail-link" href="${escapeHtml(detailHref)}">Details</a>
          <button class="copy" type="button" data-copy="${escapeHtml(candidate.url)}">Copy URL</button>
        </div>
        <span class="risk-line">${escapeHtml(riskText)}</span>
      </div>
    </article>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function tagsHtml(tags = []) {
  if (!tags.length) return '<p class="muted">None.</p>';
  return `<div class="tag-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag.severity ? `${tag.severity}/${tag.name}` : tag.name)}${tag.detail ? `: ${escapeHtml(tag.detail)}` : ''}</span>`).join('')}</div>`;
}

function pullRequestRows(candidate) {
  if (!candidate.pullRequests?.length) return '<p class="muted">No linked or mentioned PRs found.</p>';
  return `<table>
    <thead><tr><th>PR</th><th>Strength</th><th>State</th><th>Checks</th><th>Review</th><th>Updated</th></tr></thead>
    <tbody>
      ${candidate.pullRequests
        .map(
          (pr) => `<tr>
            <td><a href="${escapeHtml(pr.url)}">#${escapeHtml(pr.number)}</a><br><span class="muted">${escapeHtml(pr.title)}</span></td>
            <td>${escapeHtml(pr.strength ?? 'unknown')}</td>
            <td>${escapeHtml(pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state)}</td>
            <td>${escapeHtml(pr.checks?.state ?? 'unknown')}</td>
            <td>${escapeHtml(pr.latestReviewState ?? 'none')}${pr.maintainerApproved ? ' · maintainer approved' : ''}${pr.maintainerChangesRequested ? ' · changes requested' : ''}</td>
            <td>${escapeHtml(pr.updatedAt ?? 'unknown')}</td>
          </tr>`,
        )
        .join('')}
    </tbody>
  </table>`;
}

function readinessHtml(candidate) {
  const checks = candidate.readiness?.checks ?? [];
  if (!checks.length) return '<p class="muted">No readiness checklist available.</p>';
  return `<ul class="readiness-list">${checks.map((check) => `<li class="readiness-${escapeHtml(check.status)}"><strong>${escapeHtml(check.label)}</strong><span>${escapeHtml(check.status)} · ${escapeHtml(check.detail)}</span></li>`).join('')}</ul>`;
}

export function renderCandidateDetailHtml(candidate, report = {}) {
  const summary = candidate.competition?.summary;
  const candidates = report.candidates ?? [];
  const index = candidates.findIndex((item) => item.repository === candidate.repository && item.number === candidate.number);
  const previous = index > 0 ? candidates[index - 1] : null;
  const next = index >= 0 && index < candidates.length - 1 ? candidates[index + 1] : null;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)} · Open Bounty Radar</title>
  <style>
    :root { --bg: #f6f8fb; --panel: #fff; --text: #18202f; --muted: #667085; --border: #d7deea; --accent: #116149; --accent-soft: #e7f4ef; --warning: #8a5a00; --danger: #a83232; --info: #315f9f; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1080px; margin: 0 auto; padding: 32px 20px 48px; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1 { margin: 8px 0; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 26px 0 10px; font-size: 20px; }
    .muted { color: var(--muted); font-size: 13px; }
    .panel, .metric { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 28px rgba(24, 32, 47, 0.06); }
    .panel { padding: 16px; margin: 14px 0; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
    .metric { padding: 14px; }
    .metric span { display: block; color: var(--muted); font-size: 13px; }
    .metric strong { display: block; font-size: 22px; margin-top: 4px; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 12px; border: 1px solid var(--border); background: #f4f6fa; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; font-size: 14px; }
    th { color: var(--muted); font-size: 12px; background: #f4f6fa; }
    .readiness-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .readiness-list li { display: flex; justify-content: space-between; gap: 12px; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
    .readiness-pass { background: var(--accent-soft); }
    .readiness-warning { background: #fff8e9; }
    .readiness-fail, .readiness-blocked { background: #fff1f1; }
  </style>
</head>
<body>
  <main>
    <a href="${escapeHtml(report.indexPath ?? '../dashboard.html')}">Back to ${escapeHtml(report.indexLabel ?? 'dashboard')}</a>
    <span class="muted"> · </span>
    ${previous ? `<a href="${escapeHtml(candidateDetailFileName(previous))}">Previous</a>` : '<span class="muted">Previous</span>'}
    <span class="muted"> · </span>
    ${next ? `<a href="${escapeHtml(candidateDetailFileName(next))}">Next</a>` : '<span class="muted">Next</span>'}
    <h1>${escapeHtml(candidate.title)}</h1>
    <div class="muted">${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)} · generated ${escapeHtml(report.generatedAt ?? '')}</div>

    <section class="metrics">
      ${metric('Amount', money(candidate))}
      ${metric('Score', candidate.score?.total ?? 'unknown')}
      ${metric('Action', candidate.analysis?.action ?? 'consider')}
      ${metric('Competition risk', summary?.risk ?? 'unknown')}
      ${metric('Linked PRs', candidate.pullRequestCount)}
      ${metric('Open PRs', summary?.open ?? 'unknown')}
    </section>

    <section class="panel">
      <h2>Decision Signals</h2>
      <p><strong>Recommendation:</strong> ${escapeHtml(candidate.analysis?.recommendation ?? 'unknown')}</p>
      <p><strong>Assessment:</strong> ${escapeHtml(assessmentText(candidate))}</p>
      <p><strong>Competition:</strong> ${escapeHtml(competitionSummaryText(candidate))}</p>
      <p><a href="${escapeHtml(candidate.url)}">Open GitHub issue</a></p>
      <button class="copy" type="button" data-copy="${escapeHtml([`Issue: ${candidate.url}`, `Action: ${candidate.analysis?.action ?? 'consider'}`, `Assessment: ${assessmentText(candidate)}`, `Next: ${candidate.assessment?.nextSteps?.join(' | ') ?? 'review issue'}`].join('\n'))}">Copy Action Plan</button>
    </section>

    <section class="panel">
      <h2>AI-Style Assessment</h2>
      <p><strong>Likely files:</strong> ${escapeHtml(candidate.assessment?.likelyFiles?.join('; ') ?? 'unknown')}</p>
      <p><strong>Next steps:</strong></p>
      <ul>${(candidate.assessment?.nextSteps ?? []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul>
      <p><strong>Abandon if:</strong></p>
      <ul>${(candidate.assessment?.abandonIf ?? []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul>
    </section>

    <section class="panel">
      <h2>PR Readiness Checklist</h2>
      ${readinessHtml(candidate)}
    </section>

    <section class="panel">
      <h2>Reason Tags</h2>
      ${tagsHtml(candidate.analysis?.reasonTags)}
      <h2>Risk Tags</h2>
      ${tagsHtml(candidate.analysis?.riskTags)}
    </section>

    <section>
      <h2>Competing Pull Requests</h2>
      ${pullRequestRows(candidate)}
    </section>
  </main>
  <script>
    for (const button of document.querySelectorAll('.copy')) {
      button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy Action Plan'; }, 1200);
      });
    }
  </script>
</body>
</html>`;
}

export function renderDashboardHtmlReport(report) {
  const actionSummary = candidateActionSummary(report.candidates);
  const riskSummary = candidateRiskSummary(report.candidates);
  const top = topCandidates(report.candidates, 10);
  const groups = groupCandidatesByAction(report.candidates);
  const historyEntries = report.historyText ? parseHistoryJsonl(report.historyText) : [];
  const trend = summarizeHistory(historyEntries);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open Bounty Radar Dashboard</title>
  <style>
    :root { color-scheme: dark; --bg: #070d19; --panel: #101827; --panel-soft: #0c1423; --text: #f8fafc; --muted: #94a3b8; --border: #263345; --border-strong: #3b4a61; --accent: #10b981; --blue: #60a5fa; --rose: #fb7185; --amber: #fbbf24; --danger: #f87171; --shadow: 0 18px 44px rgba(0, 0, 0, 0.28); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1, h2, h3 { letter-spacing: 0; }
    h1 { margin: 0; font-size: 22px; line-height: 1.1; }
    h2 { margin: 0 0 14px; font-size: 18px; }
    h3 { margin: 8px 0; font-size: 16px; line-height: 1.35; }
    main { max-width: 1280px; margin: 0 auto; padding: 24px 18px 56px; }
    .topbar { position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--border); background: rgba(7, 13, 25, 0.88); backdrop-filter: blur(14px); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24); }
    .topbar-inner { max-width: 1280px; margin: 0 auto; padding: 14px 18px; display: flex; justify-content: space-between; gap: 18px; align-items: center; }
    .brand { display: flex; gap: 12px; align-items: center; min-width: 0; }
    .brand-mark { width: 42px; height: 42px; border-radius: 8px; background: #1d4ed8; color: #d1fae5; display: grid; place-items: center; font-weight: 900; box-shadow: 0 10px 28px rgba(29, 78, 216, 0.35); }
    .generated { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .live-pill { display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(16, 185, 129, 0.28); background: rgba(16, 185, 129, 0.1); color: #34d399; border-radius: 999px; padding: 7px 11px; font-size: 12px; white-space: nowrap; }
    .live-dot { width: 7px; height: 7px; border-radius: 99px; background: #34d399; box-shadow: 0 0 14px #34d399; }
    .muted { color: var(--muted); font-size: 13px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 12px; margin: 0 0 22px; }
    .metric, .candidate, .group, .trend-panel, .controls { background: rgba(16, 24, 39, 0.82); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); }
    .metric { padding: 14px; position: relative; overflow: hidden; min-height: 78px; }
    .metric::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--accent); }
    .metric:nth-child(1)::before { background: var(--rose); }
    .metric:nth-child(2)::before { background: var(--amber); }
    .metric:nth-child(3)::before { background: var(--blue); }
    .metric:nth-child(4)::before { background: var(--danger); }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; font-size: 25px; margin-top: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .trend-panel { padding: 16px; margin-bottom: 22px; }
    .trend-panel svg { width: 100%; max-height: 135px; background: rgba(7, 13, 25, 0.45); border: 1px solid rgba(38, 51, 69, 0.75); border-radius: 8px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 24px; padding: 14px; align-items: center; }
    .controls input { flex: 1 1 260px; min-width: 0; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; background: #070d19; color: var(--text); outline: none; }
    .controls input:focus, .bench-note:focus, .status-select:focus { border-color: var(--blue); }
    .control-divider { width: 1px; align-self: stretch; background: var(--border); margin: 0 2px; }
    .filter-button, .copy { border: 1px solid var(--border); background: #121c2d; color: #dbeafe; border-radius: 8px; padding: 8px 11px; cursor: pointer; font-size: 12px; font-weight: 700; }
    .filter-button:hover, .copy:hover { border-color: var(--border-strong); background: #17243a; text-decoration: none; }
    .filter-button.active { border-color: var(--blue); background: #1d4ed8; color: #fff; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16); }
    .workspace-button { border-color: rgba(16, 185, 129, 0.32); color: #a7f3d0; }
    .hidden { display: none !important; }
    .section-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin: 24px 0 12px; }
    .section-heading h2 { margin: 0; }
    .candidate { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 320px); gap: 18px; padding: 18px; margin-bottom: 12px; transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
    .candidate:hover { border-color: var(--border-strong); transform: translateY(-1px); box-shadow: 0 0 22px rgba(96, 165, 250, 0.08), var(--shadow); }
    .candidate-kicker { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--muted); font-size: 12px; }
    .issue-chip, .meta-chip { display: inline-flex; align-items: center; min-height: 24px; border: 1px solid var(--border); background: #070d19; border-radius: 7px; padding: 3px 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .meta-chip { color: var(--muted); }
    .candidate-main p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; }
    .candidate-tags { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; min-width: 0; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .align-end { justify-content: flex-end; }
    .tag { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: 12px; border: 1px solid var(--border); background: #070d19; color: #cbd5e1; white-space: nowrap; }
    .action-act-now { color: #fecdd3; border-color: rgba(251, 113, 133, 0.35); background: rgba(251, 113, 133, 0.12); }
    .action-watch, .action-manual-review { color: #fde68a; border-color: rgba(251, 191, 36, 0.35); background: rgba(251, 191, 36, 0.12); }
    .action-skip { color: #fecaca; border-color: rgba(248, 113, 113, 0.35); background: rgba(248, 113, 113, 0.12); }
    .readiness-ready { color: #a7f3d0; border-color: rgba(16, 185, 129, 0.35); background: rgba(16, 185, 129, 0.12); }
    .readiness-needs-review { color: #fde68a; border-color: rgba(251, 191, 36, 0.35); background: rgba(251, 191, 36, 0.12); }
    .readiness-blocked { color: #fecaca; border-color: rgba(248, 113, 113, 0.35); background: rgba(248, 113, 113, 0.12); }
    .status-select { border: 1px solid var(--border); background: #070d19; color: #cbd5e1; border-radius: 8px; padding: 6px 8px; }
    .bench-note { width: 100%; min-height: 46px; border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; margin-top: 12px; resize: vertical; font: inherit; font-size: 13px; color: var(--text); background: #070d19; outline: none; }
    .risk-line { display: block; max-width: 100%; color: #64748b; font-size: 11px; line-height: 1.45; text-align: right; overflow-wrap: anywhere; }
    .detail-link { text-align: center; }
    .group { padding: 16px; margin-bottom: 16px; }
    .group h2 { margin: 0 0 12px; color: #dbeafe; font-size: 15px; text-transform: uppercase; }
    footer { color: #64748b; text-align: center; font-size: 12px; padding: 12px 0 0; }
    @media (max-width: 780px) {
      .topbar-inner { align-items: flex-start; flex-direction: column; }
      .live-pill { white-space: normal; }
      .candidate { grid-template-columns: 1fr; }
      .candidate-tags, .align-end { align-items: flex-start; justify-content: flex-start; }
      .risk-line { text-align: left; }
      .control-divider { display: none; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-mark">OBR</div>
        <div>
          <h1>Open Bounty Radar</h1>
          <div class="generated">Generated: ${escapeHtml(report.generatedAt)}</div>
        </div>
      </div>
      <div class="live-pill"><span class="live-dot"></span><span>${escapeHtml(report.repositories?.length ?? 0)} repos · ${escapeHtml(report.candidates.length)} candidates</span></div>
    </div>
  </header>
  <main>
    <section class="metrics">
      ${metric('Act now', actionSummary['act-now'])}
      ${metric('Watch', actionSummary.watch)}
      ${metric('Manual review', actionSummary['manual-review'])}
      ${metric('High risk', riskSummary.high)}
      ${metric('Medium risk', riskSummary.medium)}
      ${metric('Low risk', riskSummary.low)}
      ${metric('Candidate delta', trend.candidateDelta)}
      ${metric('Act-now delta', trend.actNowDelta)}
    </section>

    <section class="trend-panel">
      <h2>History Trend</h2>
      ${renderHistoryTrendSvg(historyEntries)}
    </section>

    <section class="controls" aria-label="Dashboard filters">
      <input id="search" type="search" placeholder="Search title, repo, or issue">
      <button class="filter-button active" type="button" data-filter-action="all">All</button>
      <button class="filter-button" type="button" data-filter-action="act-now">Act now</button>
      <button class="filter-button" type="button" data-filter-action="watch">Watch</button>
      <button class="filter-button" type="button" data-filter-action="manual-review">Manual review</button>
      <button class="filter-button" type="button" data-filter-risk="high">High risk</button>
      <button class="filter-button" type="button" data-filter-competition="none">Low competition</button>
      <button class="filter-button" type="button" data-filter-competition="high">Strong competition</button>
      <button class="filter-button" type="button" data-filter-readiness="ready">Ready</button>
      <button class="filter-button" type="button" data-filter-status="doing">Doing</button>
      <span class="control-divider"></span>
      <button class="filter-button workspace-button" type="button" id="export-workspace">Export Workspace</button>
      <button class="filter-button workspace-button" type="button" id="import-workspace">Import Workspace</button>
      <input class="hidden" id="import-workspace-file" type="file" accept="application/json">
    </section>

    <section>
      <div class="section-heading">
        <h2>Top Candidates Feed</h2>
        <span class="muted">${escapeHtml(top.length)} highlighted</span>
      </div>
      ${top.length ? top.map(candidateCard).join('') : '<p class="muted">No recommended candidates.</p>'}
    </section>

    <section>
      <div class="section-heading">
        <h2>Action Groups</h2>
        <span class="muted">${escapeHtml(groups.length)} groups</span>
      </div>
      ${
        groups.length
          ? groups
              .map(
                (group) => `
                  <div class="group">
                    <h2>${escapeHtml(group.name)} (${escapeHtml(group.candidates.length)})</h2>
                    ${group.candidates.map(candidateCard).join('')}
                  </div>`,
              )
              .join('')
          : '<p class="muted">No candidates matched the current filters.</p>'
      }
    </section>
    <footer>Open Bounty Radar · static dashboard generated from the latest scan</footer>
  </main>
  <script>
    const state = { action: 'all', risk: null, competition: null, readiness: null, status: null, query: '' };
    const cards = [...document.querySelectorAll('.candidate')];
    const buttons = [...document.querySelectorAll('.filter-button')];
    function applyFilters() {
      const query = state.query.trim().toLowerCase();
      for (const card of cards) {
        const actionMatch = state.action === 'all' || card.dataset.action === state.action;
        const riskMatch = !state.risk || card.dataset.risk.includes(state.risk + '/');
        const competitionMatch = !state.competition || card.dataset.competition === state.competition;
        const readinessMatch = !state.readiness || card.dataset.readiness === state.readiness;
        const statusMatch = !state.status || card.dataset.status === state.status;
        const queryMatch = !query || card.dataset.title.includes(query) || card.dataset.repo.toLowerCase().includes(query) || card.textContent.toLowerCase().includes(query);
        card.classList.toggle('hidden', !(actionMatch && riskMatch && competitionMatch && readinessMatch && statusMatch && queryMatch));
      }
    }
    for (const button of buttons) {
      button.addEventListener('click', () => {
        if (!button.dataset.filterAction && !button.dataset.filterCompetition && !button.dataset.filterReadiness && !button.dataset.filterStatus && !button.dataset.filterRisk) return;
        if (button.dataset.filterAction) {
          state.action = button.dataset.filterAction;
          state.risk = null;
          state.competition = null;
          state.readiness = null;
          state.status = null;
        } else if (button.dataset.filterCompetition) {
          state.competition = button.dataset.filterCompetition;
          state.action = 'all';
          state.risk = null;
          state.readiness = null;
          state.status = null;
        } else if (button.dataset.filterReadiness) {
          state.readiness = button.dataset.filterReadiness;
          state.action = 'all';
          state.risk = null;
          state.competition = null;
          state.status = null;
        } else if (button.dataset.filterStatus) {
          state.status = button.dataset.filterStatus;
          state.action = 'all';
          state.risk = null;
          state.competition = null;
          state.readiness = null;
        } else {
          state.risk = button.dataset.filterRisk;
          state.action = 'all';
          state.competition = null;
          state.readiness = null;
          state.status = null;
        }
        for (const item of buttons) item.classList.remove('active');
        button.classList.add('active');
        applyFilters();
      });
    }
    document.getElementById('search').addEventListener('input', (event) => {
      state.query = event.target.value;
      applyFilters();
    });
    for (const button of document.querySelectorAll('.copy')) {
      button.addEventListener('click', async () => {
        if (!button.dataset.copy) return;
        const originalText = button.textContent;
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = originalText; }, 1200);
      });
    }
    const workspaceKey = 'open-bounty-radar-workbench';
    const saved = JSON.parse(localStorage.getItem(workspaceKey) || '{}');
    function normalizeWorkspaceImport(value) {
      return value?.candidates && typeof value.candidates === 'object' ? value.candidates : value;
    }
    function persistWorkspace() {
      localStorage.setItem(workspaceKey, JSON.stringify(saved, null, 2));
    }
    function applyWorkspaceState() {
      for (const select of document.querySelectorAll('.status-select')) {
        if (saved[select.dataset.workspaceKey]?.status) {
          select.value = saved[select.dataset.workspaceKey].status;
          select.closest('.candidate').dataset.status = select.value;
        }
      }
      for (const note of document.querySelectorAll('.bench-note')) {
        if (saved[note.dataset.workspaceKey]?.note) note.value = saved[note.dataset.workspaceKey].note;
      }
      applyFilters();
    }
    for (const select of document.querySelectorAll('.status-select')) {
      if (saved[select.dataset.workspaceKey]?.status) select.value = saved[select.dataset.workspaceKey].status;
      select.addEventListener('change', () => {
        saved[select.dataset.workspaceKey] = {...(saved[select.dataset.workspaceKey] || {}), status: select.value, updatedAt: new Date().toISOString()};
        select.closest('.candidate').dataset.status = select.value;
        persistWorkspace();
        applyFilters();
      });
    }
    for (const note of document.querySelectorAll('.bench-note')) {
      if (saved[note.dataset.workspaceKey]?.note) note.value = saved[note.dataset.workspaceKey].note;
      note.addEventListener('input', () => {
        saved[note.dataset.workspaceKey] = {...(saved[note.dataset.workspaceKey] || {}), note: note.value, updatedAt: new Date().toISOString()};
        persistWorkspace();
      });
    }
    document.getElementById('export-workspace').addEventListener('click', async () => {
      await navigator.clipboard.writeText(JSON.stringify(saved, null, 2));
      document.getElementById('export-workspace').textContent = 'Copied Workspace';
      setTimeout(() => { document.getElementById('export-workspace').textContent = 'Export Workspace'; }, 1200);
    });
    document.getElementById('import-workspace').addEventListener('click', () => {
      document.getElementById('import-workspace-file').click();
    });
    document.getElementById('import-workspace-file').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const imported = normalizeWorkspaceImport(JSON.parse(await file.text()));
      for (const [key, value] of Object.entries(imported ?? {})) {
        saved[key] = {...(saved[key] || {}), ...value, updatedAt: value.updatedAt ?? new Date().toISOString()};
      }
      persistWorkspace();
      applyWorkspaceState();
      document.getElementById('import-workspace').textContent = 'Imported Workspace';
      setTimeout(() => { document.getElementById('import-workspace').textContent = 'Import Workspace'; }, 1200);
      event.target.value = '';
    });
    applyWorkspaceState();
  </script>
</body>
</html>
`;
}
