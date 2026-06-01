# Roadmap

Open Bounty Radar is intentionally small, local-first, and dependency-light. The roadmap favors features that help contributors make better decisions before spending time on a bounty.

## Near Term Maintenance Priorities

These issues are good candidates for GitHub roadmap issues before the next public release:

- Improve the offline demo so reviewers can inspect a generated dashboard without a GitHub token.
- Add screenshots or checked-in static demo artifacts for README and release notes.
- Expand adapter documentation for GitHub-linked bounty platforms and their expected data shape.
- Add npm publishing notes and package verification steps.
- Improve contributor guidance for responsible bounty participation and duplicate PR avoidance.

### Setup Diagnostics

The `doctor` command checks:

- Node.js version
- GitHub token presence
- GitHub API connectivity and rate limit
- readable config files
- writable report and state paths
- scan scope and timeline PR detection

### Report Quality

Improve the HTML and Markdown reports with:

- clearer action labels such as `act now`, `watch`, and `skip`
- grouped risks by severity
- better explanations for score changes
- candidate detail pages or anchors
- compact report mode for notifications

### GitHub Search Modes

Reusable search presets now cover:

- bounty-like issue bodies
- label-based searches
- low-competition issues
- recently created issues

Future search work can add GitHub Discussions that mention bounties.

## Platform Adapters

### Algora

Algora is the first external platform target because many bounties map back to real GitHub issues and PRs.

The current foundation can normalize GitHub-linked Algora listings. Future live discovery should:

- discover open bounties
- resolve the linked GitHub issue
- detect existing PR competition
- preserve platform payout metadata in reports

### Opire

Opire is another useful GitHub-linked bounty source. The adapter should follow the same pattern:

- discover bounty listings
- map listings to GitHub issues
- reuse GitHub issue and PR scoring

### Other Platforms

Later candidates:

- Gitpay
- CommitPay
- PrTask
- BountyHub
- project-specific bounty comments

## Monitoring

Future monitoring improvements:

- assignment changes
- maintainer labels
- issue close reason
- winner or selected implementation signals
- competitor PR merge and close events
- repeated competitor updates

## Notifications

Current notification support starts with Telegram. Good next outputs:

- email
- Discord
- Slack
- GitHub issue comments
- webhook JSON

Notifications should remain change-based so routine scans stay quiet.

## Dashboard

A local dashboard can make the tool easier to demo and use:

- latest top candidates
- watched PR status
- risk filters
- platform filters
- state history
- one-click report links

The dashboard should be optional and should not replace the CLI.

Current dashboard support is static HTML with client-side filters, search, top candidates, action groups, and copyable issue URLs.

## Principles

- Keep scoring explainable.
- Avoid encouraging spammy pull requests.
- Prefer local files and portable JSON.
- Keep the core CLI useful without hosted infrastructure.
- Add dependencies only when they remove real maintenance cost.

## Release Readiness Goals

Before tagging a public release:

- `npm run release:check` passes locally and in CI.
- The README links to demo output, configuration docs, release notes, and security policy.
- The GitHub repository has topics for discoverability.
- At least one release note explains the user-facing workflow.
- Any live adapter behavior is documented as best-effort and resilient to source changes.
