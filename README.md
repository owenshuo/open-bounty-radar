# Open Bounty Radar

Open Bounty Radar is a small CLI for discovering and monitoring paid open-source issues, bounty-style GitHub issues, and competitive pull request opportunities.

It helps turn scattered bounty research into a repeatable workflow:

```text
configure repos -> scan bounty issues -> score candidates -> inspect competition -> watch submitted PRs
```

It is designed for developers who want to find issues that are:

- still open
- clearly paid or bounty-backed
- not already crowded by many pull requests
- practical to review quickly from a Linux-friendly development workflow

## Who this is for

- Independent developers who want a practical bounty radar instead of manually refreshing GitHub searches.
- Open-source contributors who need to avoid already-crowded or already-solved issues.
- Small teams tracking submitted bounty PRs, maintainer comments, checks, and competitor movement.
- Builders who want a local-first workflow with explainable scoring and no hosted service requirement.

## Why this exists

Paid OSS issues are scattered across GitHub labels, issue bodies, platform comments, and project-specific conventions such as `/bounty $6000`. Developers waste time opening issues that are already solved, crowded, closed, or missing payment details.

This project turns that manual research into a repeatable scan and report.

## Current MVP

- Scans configured GitHub repositories with GitHub Search API
- Detects bounty amounts such as `$250`, `$6k`, `/bounty $6000`, and `250 USDC`
- Filters closed issues by default
- Searches for pull requests that mention each issue
- Reads GitHub issue timeline cross-references to catch linked PRs search can miss
- Scores candidates by bounty amount, freshness, open state, and PR competition
- Adds recommendation and risk tags such as `strong`, `risky`, `crowded`, and `special-requirements`
- Assigns risk severity levels so high-risk blockers stand out from minor warnings
- Adds action labels such as `act-now`, `watch`, `manual-review`, and `skip`
- Highlights top candidates so the report opens with the most actionable issues
- Shows linked PR competition details with state, update date, and detection source
- Writes Markdown and optional JSON reports
- Watches submitted pull requests for merge/close state, checks, reviews, and maintainer comments
- Stores state snapshots and detects meaningful changes between runs
- Sends Telegram notifications for detected changes

## Quick Start

```bash
git clone https://github.com/<your-user>/open-bounty-radar.git
cd open-bounty-radar
npm test
npm run init
npm run doctor
npm run validate
npm run radar
```

`npm run init` creates local config files, then `npm run radar` reads `bounty-radar.json` and runs both configured jobs:

- scan open bounty candidates
- watch already-submitted pull requests

Markdown, JSON, and static HTML reports are written to `reports/` by default.

`npm run doctor` checks your Node.js version, config files, output directories, token setup, and GitHub API connectivity.

`npm run validate` checks the radar config and referenced scan/watch configs without making GitHub API calls.

`npm run init` creates local config files from the examples:

- `bounty-radar.json`
- `bounty-radar.config.json`
- `bounty-radar.watchlist.json`

Local config files are ignored by git so you can customize them safely.

## 5-Minute Tour

1. Run `npm run init` to create local config files.
2. Edit `bounty-radar.config.json` and add repositories or search queries you care about.
3. Run `npm run doctor` to confirm the local environment and GitHub API access.
4. Run `npm run validate` to catch config mistakes without using GitHub API calls.
5. Run `npm run radar` to create Markdown, JSON, and HTML reports.
6. Open `reports/bounty-report.html` and start with the Top Candidates section.
7. Add submitted PRs to `bounty-radar.watchlist.json`, then keep using `npm run radar` to monitor them.

See [Demo Output](docs/demo-output.md) for a compact example of the generated reports.

## Guides

- [Configuration Guide](docs/configuration.md)
- [Demo Output](docs/demo-output.md)
- [Bounty Platform Notes](docs/bounty-platforms.md)
- [Bounty Contributor Checklist](docs/contributor-checklist.md)
- [Pull Request Quality Checklist](docs/pr-quality-checklist.md)
- [Scoring Guide](docs/scoring-guide.md)
- [Roadmap](docs/roadmap.md)

To run each job separately:

```bash
npm run scan
npm run watch
```

To validate an example or custom radar config:

```bash
node ./bin/open-bounty-radar.js validate --config ./examples/radar.full.json
```

To create local config files again and overwrite existing ones:

```bash
node ./bin/open-bounty-radar.js init --force
```

To enable Telegram notifications without adding CLI flags, set `notifications.telegram.enabled` to `true` in `bounty-radar.config.json` and/or `bounty-radar.watchlist.json`, then run:

```bash
npm run radar
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

The recommended one-command entrypoint is the local `bounty-radar.json` generated by `npm run init`:

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

Run it with:

```bash
npm run radar
```

You can disable either section by setting `"enabled": false`.

Additional example profiles:

- `examples/radar.minimal.json`: scan-only starter profile.
- `examples/radar.full.json`: explicit scan + watch profile for copying.

Development/demo commands that run directly from `examples/` are also available:

```bash
npm run validate:example
npm run doctor:example
npm run radar:example
```

### Scan Config

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
    "includeClosed": false,
    "linkedPullRequestDetection": "both"
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
node ./bin/open-bounty-radar.js scan --config ./examples/config.json --out ./reports/bounty-report.md --json ./reports/bounty-report.json --html ./reports/bounty-report.html
```

Add `--state` to compare this run with the previous run:

```bash
node ./bin/open-bounty-radar.js scan --config ./examples/config.json --out ./reports/bounty-report.md --state ./reports/radar-state.json
```

## Watching Pull Requests

### Watch Config

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
node ./bin/open-bounty-radar.js watch --config ./examples/watchlist.json --out ./reports/pr-watch.md --json ./reports/pr-watch.json --html ./reports/pr-watch.html
```

The watch report highlights PRs that need attention because they were closed, have failing checks, or received maintainer/owner activity.

## Telegram Notifications

Telegram notifications are change-based. The first run creates a baseline state file, then later runs notify only when something meaningful changes.

Required environment variables:

```bash
export TELEGRAM_BOT_TOKEN=123456:your_bot_token
export TELEGRAM_CHAT_ID=123456789
```

Run with notifications by turning on Telegram in the JSON config:

```json
{
  "notifications": {
    "telegram": {
      "enabled": true
    }
  }
}
```

Then use the normal one-command entrypoint:

```bash
npm run radar
```

You can also force notification mode from the CLI:

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

Linked PR detection supports `search`, `timeline`, or `both`. The default `both` mode merges GitHub Search results with issue timeline cross-references, then de-duplicates by PR URL.

This is not meant to decide for you. It is meant to triage quickly.

## Roadmap

The short version:

- better setup diagnostics
- richer HTML reports
- Algora and Opire adapters
- GitHub Actions scheduled reports
- maintainer assignment and winner-detection heuristics
- local web dashboard

See the full [Roadmap](docs/roadmap.md).

## Ethics

This project should help contributors find suitable work and reduce duplicate effort. It should not be used to spam maintainers, mass-generate low-quality pull requests, or bypass project contribution rules.

Always read the issue, reproduce the bug, follow the project process, and respect maintainers.
