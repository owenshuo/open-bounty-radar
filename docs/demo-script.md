# Demo Script

Use this short flow when showing Open Bounty Radar in a README recording, GitHub issue, or product demo.

## One-Minute Flow

```bash
npm run init
npm run validate
npm run demo:offline
npm run serve
```

Open the local dashboard and show:

- Top candidates grouped by action.
- Low competition and strong competition filters.
- A candidate detail page.
- The AI-style assessment block.
- Competing PR strength, checks, and review state.
- `reports/demo-watchlist-suggestions.json` for turning candidates into monitored PR entries after submitting work.
- `reports/demo-workspace.json` for local triage status.
- The dashboard workbench status selector plus Export Workspace and Import Workspace buttons.

`npm run demo:offline` uses `examples/fixtures/demo-listings.json`, so it is safe to run without a GitHub token and stable enough for screenshots.

## Narrative

Open Bounty Radar helps contributors avoid wasting time on paid issues that are already solved, crowded, unclear, or blocked by unavailable accounts. It combines GitHub issue search, linked PR detection, competition analysis, local scoring, dashboard triage, and change-based notifications.

## Screenshots To Capture

- `reports/demo-dashboard.html` with filters visible.
- A `reports/details/*.html` candidate detail page from a live/example scan, or `reports/demo-dashboard.html` for the fixture-only dashboard.
- `reports/demo-action-plan.md`.
- `reports/demo-watchlist-suggestions.json`.
- `reports/demo-workspace.json`.

Keep screenshots free of private tokens, local-only account names, and unpublished bounty work.
