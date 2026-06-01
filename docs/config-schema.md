# Config Schema

Open Bounty Radar uses plain JSON config files. This document is a human-readable schema for the main fields.

The machine-readable JSON Schema is shipped at:

```text
schema/open-bounty-radar.schema.json
```

Editors that support JSON Schema can use it for autocompletion and validation. It covers the top-level radar config, scan configs, watch configs, GitHub repositories, GitHub-wide searches, Algora/Opire listing sources, notification targets, workspace paths, and report outputs.

## Radar Config

```json
{
  "scan": {
    "enabled": true,
    "config": "./bounty-radar.config.json",
    "out": "./reports/bounty-report.md",
    "json": "./reports/bounty-report.json",
    "html": "./reports/bounty-report.html",
    "dashboard": "./reports/dashboard.html",
    "detailsDir": "./reports/details"
  },
  "watch": {
    "enabled": true,
    "config": "./bounty-radar.watchlist.json",
    "out": "./reports/pr-watch.md",
    "json": "./reports/pr-watch.json",
    "html": "./reports/pr-watch.html"
  }
}
```

## Scan Config

Required:

- `repositories`: array of GitHub repositories to scan.

Common optional fields:

- `githubTokenEnv`: environment variable for a GitHub token.
- `statePath`: path for change detection snapshots.
- `defaults.maxIssuesPerQuery`: per-query GitHub search limit.
- `defaults.globalMaxIssuesPerQuery`: per-query GitHub-wide search limit.
- `defaults.includeClosed`: include closed issues when true.
- `defaults.linkedPullRequestDetection`: `search`, `timeline`, or `both`.
- `defaults.competitionDetails`: enrich linked PRs with review/check strength when true.
- `defaults.competitionDetailLimit`: maximum linked PRs to enrich per issue.
- `filters.minAmount`: minimum bounty amount.
- `filters.excludeKeywords`: keywords to skip.
- `githubSearches`: optional GitHub-wide issue searches.
- `algora`: optional Algora listing source.
- `opire`: optional Opire listing source.

`repositories` may be empty only when another source such as `githubSearches`, `algora`, or `opire` is configured. This enables broad discovery, offline demos, and platform-only scans.

Repository entries:

```json
{
  "owner": "Expensify",
  "repo": "App",
  "queries": ["$ in:title,body label:External"],
  "presets": ["bounty", "external", "recent"]
}
```

GitHub-wide search entries:

```json
{
  "name": "global-bounty-labels",
  "queries": ["label:bounty $ in:title,body archived:false"],
  "presets": ["amounts"],
  "maxIssuesPerQuery": 5
}
```

## Adapter Listing Sources

Algora and Opire can use any of:

- `listings`: inline array for tests or curated sources.
- `listingsPath`: local JSON file containing an array.
- `listingsUrl`: HTTP endpoint returning an array.

Each listing should include a GitHub issue URL and bounty amount:

```json
{
  "url": "https://example.com/bounties/1",
  "githubIssueUrl": "https://github.com/owner/repo/issues/123",
  "title": "Fix bounty issue",
  "amount": 500,
  "currency": "USD",
  "description": "Steps to reproduce..."
}
```

## Watch Config

Required:

- `pullRequests`: array of PRs with `owner`, `repo`, and integer `number`.

Optional:

- `defaults.activityLimit`: number of latest comments/reviews to include.
- `notifications.telegram.enabled`: send Telegram changes when true.
- `notifications.webhook.enabled`: send structured JSON changes when true.
