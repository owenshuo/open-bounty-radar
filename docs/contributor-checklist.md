# Bounty Contributor Checklist

Use this checklist before spending time on a paid issue.

## Before Starting

- Confirm the issue is still open.
- Confirm the bounty amount and payout route are visible.
- Check whether the project requires assignment or claiming before work starts.
- Check linked and mentioned PRs.
- Read maintainer comments for hidden constraints.
- Confirm the task can be verified in your environment.
- Avoid tasks that need accounts, devices, or regions you cannot access.

## Technical Triage

- Locate the likely files before committing to the task.
- Identify the smallest reliable reproduction path.
- Check whether existing tests cover nearby behavior.
- Estimate whether the fix needs product knowledge or external services.
- Prefer issues where you can add a deterministic regression test.

## Competition Triage

- Count open PRs linked by GitHub search.
- Count timeline cross-referenced PRs.
- Check whether any competing PR has maintainer approval or requested changes.
- Check whether the issue title/body has changed after competing PRs appeared.
- Avoid crowded issues unless you can make a clearly stronger implementation.

## Submission Readiness

- Keep the fix scoped to the issue.
- Include tests when practical.
- Run the relevant local checks.
- Write a clear PR title without generated placeholders.
- Explain the bug, fix, and verification steps.
- Follow the project's contribution and bounty rules.

## After Submission

- Watch CI/checks.
- Watch maintainer comments and review states.
- Respond to requested changes quickly.
- Do not repeatedly open duplicate PRs.
- Withdraw or close only when the project process makes that appropriate.
