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

## Suggested Tag Flow

```bash
git status
git tag v0.1.0
git push origin v0.1.0
```

Publishing to npm is optional. The package is already shaped as a CLI through the `bin` field.
