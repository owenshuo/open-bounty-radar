# Scoring Guide

Open Bounty Radar scoring is intentionally explainable.

The score is a triage signal, not an automatic decision.

## Current Inputs

- Bounty amount
- Issue freshness
- Open or closed state
- Linked PR competition count
- Lightweight issue text signals for recommendation and risk tags

## Current Behavior

Higher scores usually mean:

- the bounty amount is higher
- the issue was updated recently
- the issue is still open
- fewer linked PRs were found

Lower scores usually mean:

- the bounty is small
- the issue is stale
- the issue is closed
- multiple competing PRs already exist

## Recommendation Tags

Each candidate can include a recommendation:

- `strong`: good amount, open, fresh enough, and low linked PR competition
- `consider`: potentially useful but not clearly strong
- `risky`: visible risk such as crowded PR competition, unclear wording, or special access requirements
- `skip`: currently unsuitable, usually because the issue is not open

Reason tags explain why a candidate looks promising:

- `high-reward`
- `solid-reward`
- `fresh`
- `no-linked-prs`
- `low-competition`
- `repro-signal`

Risk tags explain why a candidate may be poor:

- `low-reward`
- `stale`
- `crowded`
- `some-competition`
- `not-open`
- `special-requirements`
- `unclear`
- `thin-description`
- `no-repro-signal`

## Linked PR Detection

Competition is detected through:

- GitHub Search queries for PRs mentioning the issue
- GitHub issue timeline cross-references

The default `both` mode merges these results and de-duplicates by PR URL.

Reports include linked PR details for each candidate:

- PR number and title
- state
- last update date
- detection source, such as `search`, `timeline`, or `search+timeline`

## Action Labels

Reports include an action label beside the recommendation:

- `act-now`: strong candidate with meaningful reward and low competition.
- `watch`: usable candidate with some competition or a reason to monitor before starting.
- `manual-review`: risky candidate that may still be worth reading because of high reward or unclear requirements.
- `skip`: closed, unsuitable, or too risky for normal triage.
- `consider`: default middle ground when the signal is useful but not urgent.

## Risk Severity

Risk tags include a severity level so reports can separate small warnings from blockers:

- `high`: closed issues, crowded issues, unclear requirements, or special account/platform requirements.
- `medium`: stale issues, low reward, or missing reproduction signal.
- `low`: modest competition or thin descriptions that still may be workable.

## Future Scoring Inputs

Good future improvements:

- maintainer activity recency
- issue clarity and reproduction quality
- required account or hardware signals
- whether linked PRs are failing or approved
- whether the issue has an assigned contributor
- whether the bounty platform shows claimed or paid status

## Human Review Still Matters

Always inspect the issue before starting work. A high score can still be a poor target if:

- the payout terms are unclear
- the project requires assignment first
- a competing PR is already approved
- the task needs an unavailable paid product or device
- the issue is vague enough to invite rejection

## Top Candidates

Reports include a `Top Candidates` section. It ranks candidates by:

- recommendation strength
- score
- bounty amount
- number of risk tags
- linked PR competition
- freshness

Skipped candidates are excluded from the top list.
