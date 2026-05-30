# Contributing

Thanks for considering a contribution to Open Bounty Radar.

## Development

```bash
npm install
npm test
npm run scan
```

The project intentionally keeps the MVP dependency-light. Please avoid adding a package unless it removes meaningful maintenance burden.

## Good first contributions

- Add a new bounty platform adapter
- Improve GitHub linked PR detection
- Add fixtures for bounty amount parsing
- Improve scoring explanations
- Add notification outputs such as Telegram, Discord, or email

## Project rules

- Do not add features that encourage spammy pull requests.
- Keep issue and PR scanning respectful of API rate limits.
- Prefer transparent, explainable scoring over opaque ranking.
- Include tests for parser, scoring, and adapter behavior.

## Reporting issues

When reporting a bug, include:

- the config file used
- the command run
- the relevant report output
- whether `GITHUB_TOKEN` was set
