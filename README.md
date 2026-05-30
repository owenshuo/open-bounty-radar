# Open Bounty Radar

Open Bounty Radar is a small CLI for discovering and monitoring paid open-source issues, bounty-style GitHub issues, and competitive pull request opportunities.

It is designed for developers who want to find issues that are:

- still open
- clearly paid or bounty-backed
- not already crowded by many pull requests
- practical to review quickly from a Linux-friendly development workflow

## Why this exists

Paid OSS issues are scattered across GitHub labels, issue bodies, platform comments, and project-specific conventions such as `/bounty $6000`. Developers waste time opening issues that are already solved, crowded, closed, or missing payment details.

This project turns that manual research into a repeatable scan and report.

## Current MVP

- Scans configured GitHub repositories with GitHub Search API
- Detects bounty amounts such as `$250`, `$6k`, `/bounty $6000`, and `250 USDC`
- Filters closed issues by default
- Searches for pull requests that mention or link each issue
- Scores candidates by bounty amount, freshness, open state, and PR competition
- Writes Markdown and optional JSON reports
- Watches submitted pull requests for merge/close state, checks, reviews, and maintainer comments
- Stores state snapshots and detects meaningful changes between runs
- Sends Telegram notifications for detected changes

## Quick Start

```bash
git clone https://github.com/<your-user>/open-bounty-radar.git
cd open-bounty-radar
npm test
npm run scan
```

To monitor already-submitted pull requests:

```bash
npm run watch
```

To detect changes between runs and send Telegram notifications:

```bash
npm run watch:notify
```

For higher rate limits, set a GitHub token:

```bash
export GITHUB_TOKEN=github_pat_xxx
export TELEGRAM_BOT_TOKEN=123456:your_bot_token
export TELEGRAM_CHAT_ID=123456789
npm run scan
```

On Windows PowerShell:

```powershell
$env:GITHUB_TOKEN="github_pat_xxx"
$env:TELEGRAM_BOT_TOKEN="123456:your_bot_token"
$env:TELEGRAM_CHAT_ID="123456789"
npm run scan
```

## Configuration

Create a JSON config:

```json
{
  "githubTokenEnv": "GITHUB_TOKEN",
  "statePath": "./reports/radar-state.json",
  "notifications": {
    "notifyOnFirstRun": false,
    "telegram": {
      "enabled": false,
      "botTokenEnv": "TELEGRAM_BOT_TOKEN",
      "chatIdEnv": "TELEGRAM_CHAT_ID"
    }
  },
  "defaults": {
    "maxIssuesPerQuery": 20,
    "includeClosed": false
  },
  "filters": {
    "minAmount": 100,
    "excludeKeywords": ["marketing", "hardware", "ios only"]
  },
  "repositories": [
    {
      "owner": "Expensify",
      "repo": "App",
      "queries": ["$ in:title,body label:External"]
    }
  ]
}
```

Then run:

```bash
node ./bin/open-bounty-radar.js scan --config ./examples/config.json --out ./reports/bounty-report.md --json ./reports/bounty-report.json
```

Add `--state` to compare this run with the previous run:

```bash
node ./bin/open-bounty-radar.js scan --config ./examples/config.json --out ./reports/bounty-report.md --state ./reports/radar-state.json
```

## Watching Pull Requests

Create a watchlist:

```json
{
  "githubTokenEnv": "GITHUB_TOKEN",
  "statePath": "./reports/radar-state.json",
  "notifications": {
    "notifyOnFirstRun": false,
    "telegram": {
      "enabled": false,
      "botTokenEnv": "TELEGRAM_BOT_TOKEN",
      "chatIdEnv": "TELEGRAM_CHAT_ID"
    }
  },
  "defaults": {
    "activityLimit": 5
  },
  "pullRequests": [
    {
      "owner": "spaceandtimefdn",
      "repo": "sxt-proof-of-sql",
      "number": 1986,
      "label": "Example watched bounty PR"
    }
  ]
}
```

Then run:

```bash
node ./bin/open-bounty-radar.js watch --config ./examples/watchlist.json --out ./reports/pr-watch.md --json ./reports/pr-watch.json
```

The watch report highlights PRs that need attention because they were closed, have failing checks, or received maintainer/owner activity.

## Telegram Notifications

Telegram notifications are change-based. The first run creates a baseline state file, then later runs notify only when something meaningful changes.

Required environment variables:

```bash
export TELEGRAM_BOT_TOKEN=123456:your_bot_token
export TELEGRAM_CHAT_ID=123456789
```

Run with notifications:

```bash
node ./bin/open-bounty-radar.js watch --config ./examples/watchlist.json --out ./reports/pr-watch.md --state ./reports/radar-state.json --notify
```

To enable notifications from config instead of passing `--notify`, set `notifications.telegram.enabled` to `true`.

## Scoring

The score is intentionally simple:

- higher bounty amount improves score
- recently updated issues score higher
- open issues score higher than closed ones
- each linked or mentioned PR reduces score

This is not meant to decide for you. It is meant to triage quickly.

## Roadmap

- Algora adapter
- Opire adapter
- Gitpay and other bounty platform adapters
- GitHub Actions scheduled reports
- Email, Discord, and GitHub issue notifications
- Local web dashboard
- Better linked PR detection via GraphQL timeline data
- Maintainer assignment and winner-detection heuristics

## Ethics

This project should help contributors find suitable work and reduce duplicate effort. It should not be used to spam maintainers, mass-generate low-quality pull requests, or bypass project contribution rules.

Always read the issue, reproduce the bug, follow the project process, and respect maintainers.
