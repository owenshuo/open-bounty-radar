import {groupWatchItems, watchSummary} from './watch-insights.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function checksText(checks) {
  if (checks.state === 'unknown') return 'unknown';
  if (checks.state === 'passing') return `passing (${checks.total})`;
  if (checks.state === 'pending') return `pending (${checks.pending}/${checks.total})`;
  return `failing (${checks.failing}/${checks.total})`;
}

function activityTimeline(item) {
  if (!item.latestActivity?.length) return '<p class="muted">No recent activity.</p>';
  return `<ol>${item.latestActivity
    .map((event) => `<li><span class="muted">${escapeHtml(event.createdAt)}</span> ${escapeHtml(event.type)} by ${escapeHtml(event.author)}: ${escapeHtml(event.body || event.state || '')}</li>`)
    .join('')}</ol>`;
}

function watchCard(item) {
  return `
    <article class="watch-card" data-status="${escapeHtml(item.status)}" data-action="${escapeHtml(item.action ?? 'wait')}" data-title="${escapeHtml(item.title.toLowerCase())}" data-repo="${escapeHtml(item.repository)}">
      <div>
        <a href="${escapeHtml(item.url)}">${escapeHtml(item.repository)}#${escapeHtml(item.number)}</a>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="muted">${escapeHtml(checksText(item.checks))} · updated ${escapeHtml(item.updatedAt)}</p>
      </div>
      <div class="tags">
        <span class="tag ${item.needsAttention ? 'high' : 'low'}">${escapeHtml(item.status)}</span>
        <span class="tag">${escapeHtml(item.action ?? 'wait')}</span>
        ${item.winnerSignals?.length ? `<span class="tag high">signal</span>` : ''}
      </div>
      <details>
        <summary>Activity and signals</summary>
        ${item.winnerSignals?.length ? `<p><strong>Winner/payment signals:</strong> ${escapeHtml(item.winnerSignals.join('; '))}</p>` : ''}
        ${activityTimeline(item)}
      </details>
    </article>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

export function renderWatchDashboardHtmlReport(report) {
  const summary = watchSummary(report.pullRequests);
  const groups = groupWatchItems(report.pullRequests);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open Bounty Radar Watch Dashboard</title>
  <style>
    :root { --bg: #f7f8fb; --panel: #fff; --text: #18202f; --muted: #697386; --border: #d9deea; --accent: #116149; --high: #a83232; --low: #315f9f; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1160px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    h2 { margin: 26px 0 12px; font-size: 20px; }
    h3 { margin: 6px 0; font-size: 16px; }
    a { color: var(--accent); text-decoration: none; }
    .muted { color: var(--muted); font-size: 13px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0; }
    .metric, .watch-card, .group { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; }
    .metric { padding: 14px; }
    .metric span { display: block; color: var(--muted); font-size: 13px; }
    .metric strong { display: block; font-size: 24px; margin-top: 4px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 22px; }
    .controls input, .controls button { border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; background: #fff; color: var(--text); }
    .controls button { cursor: pointer; }
    .controls button.active { border-color: var(--accent); color: var(--accent); }
    .watch-card { padding: 14px; margin-bottom: 10px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .tag { border: 1px solid var(--border); background: #f4f6fa; border-radius: 999px; padding: 3px 9px; font-size: 12px; }
    .tag.high { color: var(--high); border-color: #e7b6b6; background: #fff1f1; }
    .tag.low { color: var(--low); border-color: #b8c9e6; background: #f1f6ff; }
    details { margin-top: 8px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Open Bounty Radar Watch Dashboard</h1>
      <div class="muted">Generated: ${escapeHtml(report.generatedAt)}</div>
    </header>
    <section class="metrics">
      ${metric('Needs attention', summary.needs_attention)}
      ${metric('Healthy', summary.healthy)}
      ${metric('Merged', summary.merged)}
      ${metric('Closed', summary.closed)}
    </section>
    <section class="controls" aria-label="Watch filters">
      <input id="watch-search" type="search" placeholder="Search PR title, repo, or action">
      <button class="active" type="button" data-status="all">All</button>
      <button type="button" data-status="needs_attention">Needs attention</button>
      <button type="button" data-status="open">Open</button>
      <button type="button" data-action="fix-ci">Fix CI</button>
      <button type="button" data-action="reply">Reply</button>
    </section>
    <section>
      <h2>Pull Requests</h2>
      ${groups.length ? groups.map((group) => `<section class="group"><h2>${escapeHtml(group.name)} (${escapeHtml(group.pullRequests.length)})</h2>${group.pullRequests.map(watchCard).join('')}</section>`).join('') : '<p class="muted">No watched pull requests.</p>'}
    </section>
  </main>
  <script>
    const state = { status: 'all', action: null, query: '' };
    const cards = [...document.querySelectorAll('.watch-card')];
    const buttons = [...document.querySelectorAll('.controls button')];
    function applyFilters() {
      const query = state.query.trim().toLowerCase();
      for (const card of cards) {
        const statusMatch = state.status === 'all' || card.dataset.status === state.status;
        const actionMatch = !state.action || card.dataset.action === state.action;
        const queryMatch = !query || card.dataset.title.includes(query) || card.dataset.repo.toLowerCase().includes(query) || card.dataset.action.includes(query);
        card.classList.toggle('hidden', !(statusMatch && actionMatch && queryMatch));
      }
    }
    for (const button of buttons) {
      button.addEventListener('click', () => {
        state.status = button.dataset.status ?? 'all';
        state.action = button.dataset.action ?? null;
        for (const item of buttons) item.classList.remove('active');
        button.classList.add('active');
        applyFilters();
      });
    }
    document.getElementById('watch-search').addEventListener('input', (event) => {
      state.query = event.target.value;
      applyFilters();
    });
  </script>
</body>
</html>
`;
}
