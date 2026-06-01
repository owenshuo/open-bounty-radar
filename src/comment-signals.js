const INTEREST_PATTERNS = [
  /\bi can work on this\b/i,
  /\bi(?:'|’)d like to work on this\b/i,
  /\bi would like to work on this\b/i,
  /\bcan i work on this\b/i,
  /\binterested in working on this\b/i,
];

const PROPOSAL_PATTERNS = [
  /\bproposal\b/i,
  /\bmy proposal\b/i,
  /\bhere is my proposal\b/i,
  /\bsolution\b/i,
  /\bETA\b/,
  /\bRCA\b/,
  /\bi will send a pr\b/i,
  /\bdraft pr\b/i,
];

const REVIEW_PATTERNS = [
  /\breview(?:ing)? (?:this|the )?(?:one )?(?:proposal|proposals|today)\b/i,
  /\bi will review this(?: one)? today\b/i,
  /\bwill review (?:this|the )?(?:one )?today\b/i,
  /\bc\+\b/i,
];

const FIXED_PATTERNS = [
  /\balready fixed\b/i,
  /\bhas been fixed\b/i,
  /\bthis (?:is|was) fixed\b/i,
  /\bfixed in\b/i,
  /\bclosing as requested\b/i,
  /\bthis has been resolved\b/i,
  /\bresolved by\b/i,
];

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function compactExample(comment) {
  const author = comment.user?.login ?? comment.author ?? 'unknown';
  const body = String(comment.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  return {author, createdAt: comment.created_at ?? comment.createdAt ?? null, body};
}

export function analyzeIssueComments(comments = []) {
  const signals = {
    interestCount: 0,
    proposalCount: 0,
    reviewerActivity: false,
    fixedOrClosing: false,
    examples: [],
  };

  for (const comment of comments) {
    const body = String(comment.body ?? '');
    const matched = [];
    if (matchesAny(body, INTEREST_PATTERNS)) {
      signals.interestCount += 1;
      matched.push('interest');
    }
    const proposalMatched = matchesAny(body, PROPOSAL_PATTERNS);
    if (proposalMatched) {
      signals.proposalCount += 1;
      matched.push('proposal');
    }
    if (matchesAny(body, REVIEW_PATTERNS)) {
      signals.reviewerActivity = true;
      matched.push('reviewer-activity');
    }
    if (!proposalMatched && matchesAny(body, FIXED_PATTERNS)) {
      signals.fixedOrClosing = true;
      matched.push('fixed-or-closing');
    }
    if (matched.length && signals.examples.length < 5) signals.examples.push({...compactExample(comment), matched});
  }

  return signals;
}
