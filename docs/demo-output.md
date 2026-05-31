# Demo Output

Open Bounty Radar writes Markdown, JSON, and static HTML reports. The HTML report is meant for quick review in a browser. The Markdown report is useful for terminal workflows, notes, and automation logs.

## Scan Report Shape

```text
# Open Bounty Radar Report

Generated: 2026-05-31T00:00:00.000Z

## Summary

- Repositories scanned: 2
- Bounty candidates: 3
- Warnings: 0

## Top Candidates

- owner/repo#123 - Add retry support for delayed artifacts
  - Action: act-now
  - Recommendation: strong
  - Bounty: USD 1,500
  - Why: solid-reward, fresh, low-competition
  - Risks: none

## Candidates

### owner/repo#123

- Bounty: USD 1,500
- Action: act-now
- Recommendation: strong
- Why: solid-reward: detected meaningful reward; fresh: issue was updated recently
- Risks: none
- Competition: 1 linked PR(s)
- Linked PR details:
  - #124: Initial implementation - open - 2026-05-30 - search+timeline
- PR detection: both
```

## Watch Report Shape

```text
# Open Bounty Radar PR Watch Report

## Summary

- Pull requests watched: 2
- Needs attention: 1

## Watched Pull Requests

### owner/repo#456

- Status: needs-attention
- Checks: failing (1/6)
- Latest activity: maintainer comment, requested changes
```

## HTML Report

The static HTML report includes:

- summary metrics
- detected changes since the previous state snapshot
- top candidates
- all candidates
- recommendation and risk tags
- linked PR competition details

The report is written to `reports/bounty-report.html` when the `html` output path is configured.

## JSON Report

The JSON report mirrors the same data for downstream scripts:

- candidates
- scores
- recommendations
- risk tags
- linked pull requests
- detected changes
- warnings

Use it when you want to plug the radar into another notification system or dashboard.
