# Demo Assets

This folder documents lightweight assets for presenting Open Bounty Radar.

## Suggested GitHub Description

Local-first bounty radar for finding paid OSS issues, inspecting PR competition, and monitoring submitted work.

## Suggested Topics

- github
- bounty
- open-source
- cli
- dashboard
- notifications
- developer-tools

## Screenshot Checklist

- Offline demo dashboard at `reports/demo-dashboard.html` with action and competition filters.
- Candidate detail page with AI-style assessment.
- Watch dashboard with next-action groups.
- Action plan markdown.
- Watchlist suggestions JSON.
- Workspace status JSON.

## Stable Demo Fixture

Run:

```bash
npm run demo:offline
```

The fixture source is `examples/fixtures/demo-listings.json`. It avoids GitHub API calls and produces deterministic demo files under `reports/demo-*`.

## Short Pitch

Open Bounty Radar helps contributors decide which paid OSS issues are worth their time by combining bounty detection, linked PR competition analysis, local scoring, dashboard triage, notification rules, and submitted-PR monitoring.
