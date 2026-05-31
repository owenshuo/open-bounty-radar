const SPECIAL_REQUIREMENT_KEYWORDS = [
  'ios only',
  'android only',
  'iphone',
  'ipad',
  'macos only',
  'hardware',
  'subscription',
  'paid account',
  'enterprise account',
  'admin account',
  'approval required',
];

const REPRO_KEYWORDS = ['steps to reproduce', 'reproduce', 'expected result', 'actual result', 'expected behavior', 'actual behavior'];
const UNCLEAR_KEYWORDS = ['tbd', 'needs investigation', 'unclear', 'not sure', 'maybe', 'investigate'];

function daysSince(dateValue) {
  return Math.max(0, (Date.now() - Date.parse(dateValue)) / 86_400_000);
}

function hasAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function tag(name, detail) {
  return {name, detail};
}

function actionFor({recommendation, riskTags, candidate}) {
  const risks = new Set(riskTags.map((item) => item.name));

  if (recommendation === 'skip') return 'skip';
  if (recommendation === 'strong') return 'act-now';
  if (risks.has('crowded') || risks.has('unclear') || risks.has('special-requirements')) return 'manual-review';
  if (candidate.pullRequestCount > 0 || recommendation === 'risky') return 'watch';
  return 'consider';
}

export function analyzeCandidate(candidate, {text = ''} = {}) {
  const reasonTags = [];
  const riskTags = [];
  const freshnessDays = daysSince(candidate.updatedAt);
  const fullText = `${candidate.title ?? ''}\n${candidate.labels?.join(' ') ?? ''}\n${text}`;

  if (candidate.amount >= 1000) reasonTags.push(tag('high-reward', `${candidate.currency} ${candidate.amount}`));
  else if (candidate.amount >= 250) reasonTags.push(tag('solid-reward', `${candidate.currency} ${candidate.amount}`));
  else riskTags.push(tag('low-reward', `${candidate.currency} ${candidate.amount}`));

  if (freshnessDays <= 3) reasonTags.push(tag('fresh', `updated ${Math.round(freshnessDays)} day(s) ago`));
  else if (freshnessDays >= 21) riskTags.push(tag('stale', `updated ${Math.round(freshnessDays)} day(s) ago`));

  if (candidate.pullRequestCount === 0) reasonTags.push(tag('no-linked-prs', 'no linked or mentioned PRs found'));
  else if (candidate.pullRequestCount <= 1) reasonTags.push(tag('low-competition', `${candidate.pullRequestCount} linked PR(s)`));
  else if (candidate.pullRequestCount >= 4) riskTags.push(tag('crowded', `${candidate.pullRequestCount} linked PR(s)`));
  else riskTags.push(tag('some-competition', `${candidate.pullRequestCount} linked PR(s)`));

  if (candidate.state !== 'open') riskTags.push(tag('not-open', `issue state is ${candidate.state}`));
  if (hasAny(fullText, SPECIAL_REQUIREMENT_KEYWORDS)) riskTags.push(tag('special-requirements', 'may need specific hardware, account, or platform access'));
  if (hasAny(fullText, UNCLEAR_KEYWORDS)) riskTags.push(tag('unclear', 'wording suggests investigation or uncertainty'));

  if (text.trim().length < 120) riskTags.push(tag('thin-description', 'issue body is short'));
  if (hasAny(fullText, REPRO_KEYWORDS)) reasonTags.push(tag('repro-signal', 'description appears to include reproduction or expected/actual behavior'));
  else riskTags.push(tag('no-repro-signal', 'no obvious reproduction keywords found'));

  let recommendation = 'consider';
  if (candidate.state !== 'open') recommendation = 'skip';
  else if (riskTags.some((item) => ['crowded', 'special-requirements', 'unclear'].includes(item.name))) recommendation = 'risky';
  else if (candidate.score.total >= 35 && candidate.amount >= 250 && candidate.pullRequestCount <= 1) recommendation = 'strong';

  return {
    recommendation,
    action: actionFor({recommendation, riskTags, candidate}),
    reasonTags,
    riskTags,
  };
}
