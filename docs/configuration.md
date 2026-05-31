# Configuration Guide

Open Bounty Radar uses JSON files so routine runs can stay one-command.

## Recommended Entrypoint

Use `examples/radar.json` with:

```bash
npm run validate
npm run radar
```

The radar config points to the scan and watch configs:

```json
{
  "scan": {
    "enabled": true,
    "config": "./examples/config.json",
    "out": "./reports/bounty-report.md",
    "json": "./reports/bounty-report.json",
    "html": "./reports/bounty-report.html"
  },
  "watch": {
    "enabled": true,
    "config": "./examples/watchlist.json",
    "out": "./reports/pr-watch.md",
    "json": "./reports/pr-watch.json",
    "html": "./reports/pr-watch.html"
  }
}
```

Set `"enabled": false` to turn off either job.

`npm run validate` checks this file and the referenced scan/watch config files without calling the GitHub API.

Each enabled job can write:

- `out`: Markdown report
- `json`: machine-readable JSON report
- `html`: static HTML report for browser viewing

## Scan Config

`examples/config.json` controls bounty discovery.

Important fields:

- `githubTokenEnv`: environment variable that contains a GitHub token.
- `statePath`: local state file used to detect changes between runs.
- `notifications.telegram.enabled`: send Telegram alerts when changes are detected.
- `defaults.maxIssuesPerQuery`: GitHub search results to inspect per query.
- `defaults.linkedPullRequestDetection`: `search`, `timeline`, or `both`.
- `filters.minAmount`: minimum detected bounty amount.
- `filters.excludeKeywords`: skip noisy matches.
- `repositories`: GitHub repositories and search queries to scan.

## Watch Config

`examples/watchlist.json` controls submitted PR monitoring.

Important fields:

- `defaults.activityLimit`: number of latest comments/reviews to include.
- `pullRequests`: PRs to watch, with owner, repo, number, and optional label.

## Notification Environment

Secrets should stay in environment variables, not JSON.

```bash
export GITHUB_TOKEN=github_pat_xxx
export TELEGRAM_BOT_TOKEN=123456:your_bot_token
export TELEGRAM_CHAT_ID=123456789
```

PowerShell:

```powershell
$env:GITHUB_TOKEN="github_pat_xxx"
$env:TELEGRAM_BOT_TOKEN="123456:your_bot_token"
$env:TELEGRAM_CHAT_ID="123456789"
```

## Example Profiles

- `examples/radar.minimal.json`: scan-only starter profile.
- `examples/radar.json`: default scan + watch profile.
- `examples/radar.full.json`: explicit full profile for copying into local configs.
