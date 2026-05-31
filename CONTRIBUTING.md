# Contributing

Thanks for considering a contribution to Open Bounty Radar.

## Development

```bash
npm install
npm test
npm run init
npm run validate
npm run radar
```

The project intentionally keeps the MVP dependency-light. Please avoid adding a package unless it removes meaningful maintenance burden.

Useful focused commands:

```bash
npm run validate:example
npm run radar:example
npm run scan:example
npm run watch:example
```

Before opening a pull request, run:

```bash
npm test
npm run validate:example
npm run radar:example
```

## Good first contributions

- Add a new bounty platform adapter
- Improve GitHub linked PR detection
- Add fixtures for bounty amount parsing
- Improve scoring explanations
- Add notification outputs such as Discord or email
- Add platform adapters for Algora, Opire, or other GitHub-linked bounty sites
- Improve documentation in `docs/`

## Adapter contributions

Platform adapters should keep the GitHub issue as the main source of truth whenever possible. A good adapter should:

- preserve the external platform URL
- resolve the linked GitHub issue or pull request
- keep payout metadata visible in JSON and reports
- include fixtures for edge cases
- avoid scraping patterns that are fragile or aggressive

If a platform requires login, document that clearly and keep credentials out of config files.

## Documentation contributions

Documentation changes are welcome when they make the tool easier to run or easier to trust. Good docs usually include:

- the command to run
- the config fields involved
- a small example
- the expected output

Avoid documenting private tokens, real payment identifiers, or personal account details.

## Project rules

- Do not add features that encourage spammy pull requests.
- Keep issue and PR scanning respectful of API rate limits.
- Prefer transparent, explainable scoring over opaque ranking.
- Include tests for parser, scoring, and adapter behavior.
- Keep local config and generated reports out of commits unless they are intentional examples.
- Do not commit secrets, tokens, wallet addresses, or private bounty notes.

## Pull request checklist

- Tests pass with `npm test`.
- Example validation passes with `npm run validate:example`.
- Example radar run passes with `npm run radar:example`.
- New behavior is documented in `README.md` or `docs/`.
- User-facing reports remain readable in Markdown and HTML.

## Reporting issues

When reporting a bug, include:

- the config file used
- the command run
- the relevant report output
- whether `GITHUB_TOKEN` was set
