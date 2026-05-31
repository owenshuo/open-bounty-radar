# Scoring Guide

Open Bounty Radar scoring is intentionally explainable.

The score is a triage signal, not an automatic decision.

## Current Inputs

- Bounty amount
- Issue freshness
- Open or closed state
- Linked PR competition count

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

## Linked PR Detection

Competition is detected through:

- GitHub Search queries for PRs mentioning the issue
- GitHub issue timeline cross-references

The default `both` mode merges these results and de-duplicates by PR URL.

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
