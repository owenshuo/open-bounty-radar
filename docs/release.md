# Release Checklist

Use this checklist before publishing or tagging a release.

## Local Validation

```bash
npm run release:check
```

`release:check` runs the core local gates in order:

- `npm test`
- `npm run validate:example`
- `npm run demo:offline`
- `npm run audit:pack`
- `git diff --check`

Optional live checks before a real release:

```bash
npm run doctor:example
npm run scan:example
npm run watch:example
```

## Review

- README reflects current commands and outputs.
- `docs/config-schema.md` matches supported config fields.
- `schema/open-bounty-radar.schema.json` matches supported config fields.
- Example configs run successfully.
- Offline demo fixtures still generate `reports/demo-dashboard.html`.
- Generated reports are not committed unless intentionally added as examples.
- No secrets, tokens, wallet addresses, or private bounty notes are present.
- `npm pack --dry-run` output excludes reports, local config, and tests through `.npmignore`.

## npm Publishing

The package is shaped as a CLI through the `bin` field and can be published to npm after the release check passes.

```bash
npm whoami
npm pack --dry-run
npm publish
```

`prepublishOnly` runs `npm run release:check` again before publishing, so a stale or broken package should fail locally before it reaches the registry.

After publishing, verify the CLI entrypoint:

```bash
npx open-bounty-radar --help
```

## Suggested Tag Flow

```bash
git status
git tag v0.1.0
git push origin v0.1.0
```

## Suggested GitHub Release Notes

Use a short public note that makes the project easy to evaluate:

```text
Open Bounty Radar v0.1.0 is the first public CLI release for discovering, scoring, and monitoring paid open-source issues and bounty-style pull request opportunities.

Highlights:
- Local-first scan and watch workflows.
- Markdown, JSON, CSV, JSONL, static HTML, and dashboard outputs.
- Linked PR competition analysis, readiness checks, watch insights, and notification rules.
- GitHub Actions template, JSON schema, offline demo fixtures, release checks, and CI.

Start with:
npm test
npm run init
npm run doctor
npm run radar

For an offline demo:
npm run demo:offline
npm run serve
```

After publishing the release, add or verify repository topics: `open-source`, `bounty`, `github`, `cli`, `developer-tools`, `triage`, `pull-requests`, `oss`.
