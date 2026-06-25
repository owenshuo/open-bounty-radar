# GitHub Actions Template

The repository includes `.github/workflows/radar.yml.example` as a copy-ready scheduled workflow.
It also ships `.github/workflows/pages.yml`, which publishes a hosted dashboard site with:

- `/live/discovery-dashboard.html`: live discovery output refreshed by GitHub Actions.
- `/demo/demo-dashboard.html`: deterministic offline fixture output for demos and screenshots.

The Pages dashboard workflow runs on pushes and manual dispatch. A dedicated Live Dashboard Refresh workflow runs on manual dispatch and a staggered schedule at minute 17 every six hours. GitHub Actions supports scheduled workflows at a minimum interval of five minutes, but scheduled runs can be delayed during high load, so the default avoids exact hour and half-hour boundaries and keeps Pages deployment notifications quieter.

## Setup

1. Copy `.github/workflows/radar.yml.example` to `.github/workflows/radar.yml`.
2. Create local or repository config files:
   - `bounty-radar.json`
   - `bounty-radar.config.json`
   - `bounty-radar.watchlist.json`
3. Add repository secrets:
   - `RADAR_GITHUB_TOKEN`
   - `TELEGRAM_BOT_TOKEN` if Telegram notifications are enabled
   - `TELEGRAM_CHAT_ID` if Telegram notifications are enabled
4. Adjust the schedule if needed.

The template runs:

```bash
npm ci
npm run validate
npm run radar
```

It uploads the generated `reports/` directory as a workflow artifact.

## Notes

- Use a dedicated fine-grained token if possible.
- For the hosted live dashboard, add `OPEN_BOUNTY_RADAR_GITHUB_TOKEN` as a repository secret when you want a dedicated read-only token. The workflow falls back to the built-in `GITHUB_TOKEN`.
- Keep local generated reports out of source control unless they are intentional examples.
- Keep notification secrets in GitHub Actions secrets, not JSON config files.
