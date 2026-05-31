# Pull Request Quality Checklist

This checklist is for contributors using Open Bounty Radar to find work.

## Minimum Bar

- The PR fixes the linked issue, not just a nearby symptom.
- The PR title is specific and does not contain placeholders.
- The description links the issue and summarizes the change.
- The code follows the existing project style.
- The change is narrow enough for maintainers to review.
- Tests or manual verification steps are included.

## Strong Bounty PR

- Includes a regression test when the project has a test path.
- Handles edge cases mentioned in the issue or comments.
- Avoids broad rewrites unless the issue requires them.
- Explains tradeoffs and any intentionally untouched cases.
- Keeps generated files, formatting churn, and unrelated edits out.
- Passes local checks before submission.

## Review Response

- Treat reviewer comments as requirements, not debate prompts.
- Push focused follow-up commits.
- Mention exactly what changed after review.
- Re-run relevant tests after each update.
- Do not force-push away useful review context unless the project asks.

## Red Flags

- The fix only changes a timeout or guard without addressing root cause.
- Tests assert implementation details instead of behavior.
- The PR contains unrelated cleanup or style churn.
- The description is vague about verification.
- The branch includes secrets, tokens, local reports, or generated noise.
- The PR appears mass-produced or disconnected from the issue.
