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

Useful future adapter fields:

- bounty amount
- repository
- issue URL
- current claim/PR state
- bounty status
- payout currency or method

## Opire

Opire also maps paid work to GitHub issues.

Useful future adapter fields:

- issue URL
- amount
- repository
- assignee/claim status
- open/closed state

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
