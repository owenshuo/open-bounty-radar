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

function candidateCard(candidate) {
  const detailHref = candidate.detailPath ?? `details/${candidateDetailFileName(candidate)}`;
  return `
    <article class="candidate" id="candidate-${escapeHtml(candidate.repository.replaceAll('/', '-'))}-${escapeHtml(candidate.number)}" data-action="${escapeHtml(candidate.analysis?.action ?? 'consider')}" data-status="${escapeHtml(candidate.workspace?.status ?? 'new')}" data-readiness="${escapeHtml(readinessText(candidate))}" data-competition="${escapeHtml(candidate.competition?.summary?.risk ?? 'unknown')}" data-risk="${escapeHtml(riskNames(candidate))}" data-repo="${escapeHtml(candidate.repository)}" data-title="${escapeHtml(candidate.title.toLowerCase())}">
      <div class="candidate-main">
        <div class="candidate-kicker">
          <a class="issue-link" href="${escapeHtml(candidate.url)}">${escapeHtml(candidate.repository)}#${escapeHtml(candidate.number)}</a>
          <span>${escapeHtml(candidate.platform ?? candidate.adapter ?? 'GitHub')}</span>
        </div>
        <h3>${escapeHtml(candidate.title)}</h3>
        <p>${escapeHtml(money(candidate))} · score ${escapeHtml(candidate.score.total)} · ${escapeHtml(competitionSummaryText(candidate))} · ${escapeHtml(assessmentText(candidate))}</p>
        <textarea class="bench-note" data-workspace-key="${escapeHtml(`${candidate.repository}#${candidate.number}`)}" placeholder="Add local note">${escapeHtml(candidate.workspace?.note ?? '')}</textarea>
      </div>
      <div class="candidate-tags">
        <select class="status-select" data-workspace-key="${escapeHtml(`${candidate.repository}#${candidate.number}`)}" aria-label="Candidate status">
          ${['new', 'reading', 'doing', 'submitted', 'watching', 'skipped'].map((status) => `<option value="${status}"${(candidate.workspace?.status ?? 'new') === status ? ' selected' : ''}>${status}</option>`).join('')}
        </select>
        <span class="tag action-${escapeHtml(candidate.analysis?.action ?? 'consider')}">${escapeHtml(candidate.analysis?.action ?? 'consider')}</span>
        <span class="tag readiness-${escapeHtml(readinessText(candidate))}">${escapeHtml(readinessText(candidate))}</span>
        <span class="tag">${escapeHtml(candidate.analysis?.recommendation ?? 'unknown')}</span>
        <a class="copy" href="${escapeHtml(detailHref)}">Details</a>
        <button class="copy" type="button" data-copy="${escapeHtml(candidate.url)}">Copy URL</button>
        <span class="muted">${escapeHtml(riskNames(candidate))}</span>
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
    :root { --bg: #f4f7fb; --panel: #fff; --text: #18202f; --muted: #667085; --border: #d7deea; --accent: #116149; --accent-soft: #e7f4ef; --high: #a83232; --medium: #8a5a00; --low: #315f9f; --shadow: 0 10px 30px rgba(24, 32, 47, 0.07); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1200px; margin: 0 auto; padding: 32px 20px 48px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 24px; padding: 18px 0; border-bottom: 1px solid var(--border); }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    h3 { margin: 6px 0; font-size: 16px; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .muted { color: var(--muted); font-size: 13px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0 24px; }
    .metric, .candidate, .group { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); }
    .metric { padding: 14px; position: relative; overflow: hidden; }
    .metric::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--accent); opacity: 0.82; }
    .metric span { display: block; color: var(--muted); font-size: 13px; }
    .metric strong { display: block; font-size: 24px; margin-top: 4px; }
    .candidate { display: grid; grid-template-columns: minmax(0, 1fr) 280px; justify-content: space-between; gap: 18px; padding: 16px; margin-bottom: 12px; transition: border-color 0.15s ease, transform 0.15s ease; }
    .candidate:hover { border-color: #a9b8ca; transform: translateY(-1px); }
    .candidate-kicker { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .candidate-main p { margin: 0; color: var(--muted); font-size: 13px; }
    .candidate-tags { display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap; justify-content: flex-end; min-width: 220px; }
    .tag { display: inline-block; border-radius: 999px; padding: 3px 9px; font-size: 12px; border: 1px solid var(--border); background: #f4f6fa; white-space: nowrap; }
    .copy, .filter-button { border: 1px solid var(--border); background: #fff; color: var(--text); border-radius: 6px; padding: 6px 10px; cursor: pointer; }
    .status-select { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 4px 8px; }
    .bench-note { width: 100%; min-height: 38px; border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; margin-top: 10px; resize: vertical; font: inherit; color: var(--text); }
    .copy:hover, .filter-button:hover, .filter-button.active { border-color: var(--accent); color: var(--accent); }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 20px; align-items: center; }
    .controls input { min-width: 220px; border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; }
    .hidden { display: none; }
    .action-act-now { color: var(--low); border-color: #b8c9e6; background: #f1f6ff; }
    .action-watch, .action-manual-review { color: var(--medium); border-color: #e7d2a5; background: #fff8e9; }
    .action-skip { color: var(--high); border-color: #e7b6b6; background: #fff1f1; }
    .readiness-ready { color: var(--accent); border-color: #b7d8ca; background: var(--accent-soft); }
    .readiness-needs-review { color: var(--medium); border-color: #e7d2a5; background: #fff8e9; }
    .readiness-blocked { color: var(--high); border-color: #e7b6b6; background: #fff1f1; }
    .group { padding: 14px; margin-bottom: 16px; }
    .group h2 { margin-top: 0; }
    @media (max-width: 720px) { header, .candidate { display: block; } .candidate-tags { justify-content: flex-start; margin-top: 10px; min-width: 0; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Open Bounty Radar Dashboard</h1>
        <div class="muted">Generated: ${escapeHtml(report.generatedAt)}</div>
      </div>
      <div class="muted">${escapeHtml(report.repositories?.length ?? 0)} repos · ${escapeHtml(report.candidates.length)} candidates</div>
    </header>

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

    <section>
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
      <button class="filter-button" type="button" id="export-workspace">Export Workspace</button>
      <button class="filter-button" type="button" id="import-workspace">Import Workspace</button>
      <input class="hidden" id="import-workspace-file" type="file" accept="application/json">
    </section>

    <section>
      <h2>Top 10</h2>
      ${top.length ? top.map(candidateCard).join('') : '<p class="muted">No recommended candidates.</p>'}
    </section>

    <section>
      <h2>Action Groups</h2>
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
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy URL'; }, 1200);
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
