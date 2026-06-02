# Contributing

Thanks for helping improve Open Bounty Radar.

## Local Setup

```bash
npm install
npm test
npm run validate:example
npm run scan:example
```

## Pull Request Checklist

- Keep changes focused on one behavior or feature.
- Add or update tests for new logic.
- Run `npm test` and `npm run audit`.
- Do not commit generated `reports/` output.
- Do not include private tokens, workspace exports, or unpublished bounty work.
- Follow the [Responsible Contribution Guide](docs/responsible-contribution.md) when using the project for bounty-related OSS work.

## Contribution Quality

Please make pull requests that materially improve the project. Drive-by documentation edits, generic rewrites, duplicated content, or changes that appear primarily intended to farm contribution credit may be closed without merge.

Good contributions usually include at least one of:

- a clear bug fix or behavior improvement
- tests or fixtures that protect existing behavior
- documentation that explains a real project-specific workflow or maintenance decision
- evidence from running the relevant command, test, or scan

## Project Values

This tool should help contributors make better decisions and avoid duplicate work. It should not encourage spammy, low-quality, or rule-evading pull requests.
