# Bounty Platform Notes

This document tracks platform types that Open Bounty Radar can support over time.

## GitHub-Native Bounties

Some projects place bounty details directly in issue titles, issue bodies, labels, or maintainer comments.

Typical signals:

- dollar amounts such as `$250` or `$6000`
- slash commands such as `/bounty $6000`
- labels such as `bounty`, `paid`, `External`, or `help wanted`
- comments naming a payout process

Current support:

- GitHub issue search
- bounty amount parsing
- linked PR competition detection through search and timeline cross-references

## Algora

Algora is a bounty marketplace built around GitHub issues and pull requests.

Useful adapter fields:

- bounty amount
- repository
- issue URL
- current claim/PR state
- bounty status
- payout currency or method

## Opire

Opire also maps paid work to GitHub issues.

Useful adapter fields:

- issue URL
- amount
- repository
- assignee/claim status
- open/closed state

## Adapter Contract

Adapters convert platform-specific bounty listings into the same candidate shape used by GitHub-native scans. A candidate must include the fields validated by `src/adapters/contract.js`:

```json
{
  "repository": "owner/repo",
  "number": 123,
  "title": "Fix the failing widget test",
  "url": "https://github.com/owner/repo/issues/123",
  "amount": 250,
  "currency": "USD",
  "score": {
    "total": 42,
    "amountScore": 20,
    "freshnessScore": 12,
    "competitionPenalty": 0,
    "openScore": 10
  },
  "analysis": {
    "recommendation": "consider",
    "action": "watch",
    "reasonTags": [],
    "riskTags": []
  }
}
```

Recommended optional fields:

- `adapter`: short adapter id such as `algora` or `opire`
- `platform`: display name for reports
- `externalUrl`: canonical platform listing URL when different from the GitHub issue URL
- `state`: listing state such as `open`, `claimed`, `completed`, or `closed`
- `createdAt` and `updatedAt`: ISO timestamps used for freshness scoring
- `labels`: platform or GitHub labels carried into reports
- `rawAmount`: original amount text for auditability
- `pullRequestCount`, `pullRequests`, and `pullRequestDetection`: competition data from the source
- `pullRequestDetectionWarnings`: adapter-specific caveats for incomplete competition data

Adapters should not invent payout certainty. If a platform page only says a task is proposed, pending approval, or externally claim-gated, keep that state visible so scoring and readiness checks can downgrade it.

## Static Fixtures and Live Sources

Adapters can support static fixtures, live listing URLs, or both.

Static fixtures are best for tests, demos, and release smoke checks:

```json
{
  "listings": [
    {
      "url": "https://algora.io/bounties/example",
      "githubIssueUrl": "https://github.com/owner/repo/issues/123",
      "title": "Fix the failing widget test",
      "amount": 250,
      "currency": "USD",
      "state": "open",
      "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

Live sources should be treated as best-effort inputs. A live listing source may be an HTML page, JSON endpoint, RSS feed, or platform API, but it should still normalize to the same candidate shape. Prefer source data that includes:

- a canonical GitHub issue URL
- amount and currency
- listing state
- creation or update timestamp
- claim, assignee, or submission status when publicly visible

If a live source changes shape, requires authentication, rate-limits unexpectedly, or omits the GitHub issue URL, the adapter should skip the listing or emit a warning instead of returning a malformed high-confidence candidate.

## GitHub Enrichment

External listings are useful only when the tool can connect them back to GitHub contribution signals. After an adapter returns a candidate, enrichment should use the GitHub issue URL to add:

- current issue state and recent activity
- labels and maintainer comments that mention payout, claim, or assignment status
- linked pull requests from search and timeline cross-references
- PR state, draft status, review decision, checks, and merge status
- competition counts and warnings when several open PRs target the same issue

The enriched candidate should keep both URLs:

- `url` for the GitHub issue contributors act on
- `externalUrl` for the platform listing or payout context

This keeps reports actionable while preserving the source of bounty-specific metadata.

## Failure Behavior

Adapters should fail safely:

- validate every normalized candidate before returning it
- skip listings that cannot be tied to a GitHub issue
- keep authentication requirements explicit in adapter metadata
- avoid ranking stale, claimed, completed, or duplicate tasks as strong candidates
- preserve warnings when amount, claim status, or PR competition is inferred rather than directly reported
- return partial results when one listing fails, unless the whole source is unusable

Safe failure matters because adapter output can influence public contribution behavior. A broken adapter should reduce confidence and prompt manual review, not encourage duplicate PRs or speculative claims.

## Gitpay and Similar Sites

These sites may expose paid issues with less consistent metadata.

Useful future adapter fields:

- canonical GitHub issue URL
- payment amount
- platform status
- last activity time

## Evaluation Checklist

Before adding a platform adapter, check:

- Does it expose a stable public page or API?
- Can the tool link back to the original GitHub issue?
- Can paid status and amount be extracted reliably?
- Can competition or assigned status be inferred?
- Are scraping or API usage rules clear enough to respect?

## Risk Signals

Avoid ranking tasks highly when they appear to require:

- spammy mass PR behavior
- unclear or unverifiable payout terms
- private credentials or unsafe prompt/context disclosure
- unavailable hardware, geography, or paid account requirements
- content-only or marketing work outside the project scope
