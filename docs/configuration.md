# Configuration Guide

Open Bounty Radar uses JSON files so routine runs can stay one-command.

## Recommended Entrypoint

Create local config files and run the local radar profile with:

```bash
npm run init
npm run validate
npm run radar
```

The generated `bounty-radar.json` points to local scan and watch configs:

```json
{
  "scan": {
    "enabled": true,
    "config": "./bounty-radar.config.json",
    "out": "./reports/bounty-report.md",
    "json": "./reports/bounty-report.json",
    "html": "./reports/bounty-report.html"
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

Set `"enabled": false` to turn off either job.

`npm run validate` checks this file and the referenced scan/watch config files without calling the GitHub API.

`npm run init` creates local config files:

- `bounty-radar.json`
- `bounty-radar.config.json`
- `bounty-radar.watchlist.json`

These local config files are ignored by git. Re-run with `--force` to overwrite them.

Each enabled job can write:

- `out`: Markdown report
- `json`: machine-readable JSON report
- `html`: static HTML report for browser viewing

## Scan Config

`bounty-radar.config.json` controls bounty discovery. It is generated from `examples/config.json`.

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

`bounty-radar.watchlist.json` controls submitted PR monitoring. It is generated from `examples/watchlist.json`.

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

You can run the examples directly with:

```bash
npm run validate:example
npm run radar:example
```
