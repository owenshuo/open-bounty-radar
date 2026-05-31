# Configuration Guide

Open Bounty Radar uses JSON files so routine runs can stay one-command.

## Recommended Entrypoint

Create local config files and run the local radar profile with:

```bash
npm run init
npm run doctor
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

`npm run doctor` checks the same config plus the local runtime, output directories, token setup, and GitHub API connectivity.

`npm run init` creates local config files:

- `bounty-radar.json`
- `bounty-radar.config.json`
- `bounty-radar.watchlist.json`

These local config files are ignored by git. Re-run with `--force` to overwrite them.

Each enabled job can write:

- `out`: Markdown report
- `json`: machine-readable JSON report
- `html`: static HTML report for browser viewing
- `dashboard`: static HTML dashboard for action-based triage
- `detailsDir`: directory for per-candidate dashboard detail pages
- `watchDashboard`: static HTML dashboard for watched PRs
- `csv`: scan CSV export
- `jsonl`: scan JSONL export
- `actionPlan`: Markdown action plan export
- `watchlistSuggestions`: JSON suggestions for PRs to add after submitting work
- `workspace`: local workspace state JSON used by the scan job
- `history`: JSONL history append path

The local report server can be started with:

```bash
npm run serve
```

It serves the `reports/` directory and opens the scan dashboard as the default page.

## Scan Config

`bounty-radar.config.json` controls bounty discovery. It is generated from `examples/config.json`.

Important fields:

- `githubTokenEnv`: environment variable that contains a GitHub token.
- `statePath`: local state file used to detect changes between runs.
- `notifications.telegram.enabled`: send Telegram alerts when changes are detected.
- `notifications.webhook.enabled`: send structured JSON alerts to a generic webhook.
- `notifications.discord.enabled`: send compact digest alerts to a Discord incoming webhook.
- `notifications.slack.enabled`: send compact digest alerts to a Slack incoming webhook.
- `notifications.rules`: filter notification changes by severity, action, amount, competition risk, or attention state.
- `defaults.maxIssuesPerQuery`: GitHub search results to inspect per query.
- `defaults.linkedPullRequestDetection`: `search`, `timeline`, or `both`.
- `defaults.competitionDetails`: enrich linked PRs with reviews, checks, and strength labels.
- `defaults.competitionDetailLimit`: maximum linked PRs to enrich per issue.
- `filters.minAmount`: minimum detected bounty amount.
- `filters.excludeKeywords`: skip noisy matches.
- `repositories`: GitHub repositories and search queries to scan.

Repositories can use explicit `queries`, `presets`, or both:

```json
{
  "owner": "Expensify",
  "repo": "App",
  "presets": ["bounty", "external", "recent"],
  "queries": ["$ in:title,body label:External"]
}
```

Available presets:

- `bounty`
- `external`
- `recent`
- `low-competition`
- `crypto-bounty`

## Platform Adapters

Algora and Opire can be configured from curated listing sources:

```json
{
  "algora": {
    "listingsUrl": "https://example.com/algora-listings.json"
  },
  "opire": {
    "listingsPath": "./local-opire-listings.json"
  }
}
```

Each listing should include a GitHub issue URL and bounty amount. By default, these adapter candidates are enriched from GitHub with issue state, linked PR competition, and timeline signals. Set `enrichGitHub` to `false` on the adapter config to keep the listing source fully offline.

Adapters can also use a simple `liveUrl` HTML source. The live extractor looks for GitHub issue links near bounty amounts and turns them into listing candidates:

```json
{
  "algora": {
    "platform": "Algora",
    "liveUrl": "https://example.com/bounties"
  }
}
```

Use `examples/config.adapters.json` for a complete local example.

## Single Issue Inspection

Use `inspect` when you already have one issue URL and want a focused report:

```bash
node ./bin/open-bounty-radar.js inspect --issue-url https://github.com/owner/repo/issues/123 --out ./reports/issue-inspection.md --json ./reports/issue-inspection.json --html ./reports/issue-inspection.html
```

Batch mode accepts a text file with one issue URL per line or a JSON array:

```bash
node ./bin/open-bounty-radar.js inspect --issue-list ./issues.txt --out ./reports/issue-batch.md --json ./reports/issue-batch.json
```

Add `--html ./reports/issue-batch.html` for a compact browser dashboard of the batch results.

The inspection report includes bounty detection, linked PR competition, local assessment, likely file hints, next steps, and abandon conditions.

## Workspace State

Set `workspacePath` in scan config or pass `--workspace ./reports/workspace.json`. The scan writes candidate keys such as `owner/repo#123` with local status and notes. The dashboard also stores quick status changes in browser local storage and can copy that workbench state for later syncing.

Merge a dashboard export back into the local workspace with:

```bash
node ./bin/open-bounty-radar.js scan --workspace ./reports/workspace.json --workspace-import ./exports/workbench.json
```

Or use the dedicated workspace command:

```bash
node ./bin/open-bounty-radar.js workspace --workspace ./reports/workspace.json --workspace-import ./exports/workbench.json --out ./reports/workspace-summary.md --json ./reports/workspace.json
```

The dashboard includes status filters, local notes, readiness filters, and export controls so routine triage can happen without editing JSON by hand.

## Notification Rule Presets

`notifications.rules.preset` can be one of:

- `quiet`: high severity, actionable changes only.
- `aggressive`: notify on any severity.
- `high-value-only`: only medium/high changes at or above 1000.
- `low-competition-only`: actionable changes with none/low competition.

Explicit rule fields override preset values.

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
export OPEN_BOUNTY_RADAR_WEBHOOK_URL=https://example.com/webhook
export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

PowerShell:

```powershell
$env:GITHUB_TOKEN="github_pat_xxx"
$env:TELEGRAM_BOT_TOKEN="123456:your_bot_token"
$env:TELEGRAM_CHAT_ID="123456789"
$env:OPEN_BOUNTY_RADAR_WEBHOOK_URL="https://example.com/webhook"
$env:DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
$env:SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

Telegram, Discord, and Slack send compact human-readable digests by default. Generic webhook notifications send JSON with the digest plus the structured change list.

## Example Profiles

- `examples/radar.minimal.json`: scan-only starter profile.
- `examples/radar.json`: default scan + watch profile.
- `examples/radar.full.json`: explicit full profile for copying into local configs.
- `examples/config.presets.json`: search preset examples.
- `examples/config.adapters.json`: GitHub + Algora + Opire adapter examples.

You can run the examples directly with:

```bash
npm run validate:example
npm run doctor:example
npm run radar:example
npm run dashboard:example
```
