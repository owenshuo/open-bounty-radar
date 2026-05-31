# GitHub Actions Template

The repository includes `.github/workflows/radar.yml.example` as a copy-ready scheduled workflow.

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
- Keep local generated reports out of source control unless they are intentional examples.
- Keep notification secrets in GitHub Actions secrets, not JSON config files.
