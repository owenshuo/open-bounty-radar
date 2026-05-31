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

function tag(name, detail, severity = null) {
  return severity ? {name, detail, severity} : {name, detail};
}

function risk(name, detail, severity = 'medium') {
  return tag(name, detail, severity);
}

function actionFor({recommendation, riskTags, candidate}) {
  const risks = new Set(riskTags.map((item) => item.name));

  if (recommendation === 'skip') return 'skip';
  if (recommendation === 'strong') return 'act-now';
  if (risks.has('crowded') || risks.has('strong-competing-pr') || risks.has('unclear') || risks.has('special-requirements')) return 'manual-review';
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
  else riskTags.push(risk('low-reward', `${candidate.currency} ${candidate.amount}`, 'medium'));

  if (freshnessDays <= 3) reasonTags.push(tag('fresh', `updated ${Math.round(freshnessDays)} day(s) ago`));
  else if (freshnessDays >= 21) riskTags.push(risk('stale', `updated ${Math.round(freshnessDays)} day(s) ago`, 'medium'));

  if (candidate.pullRequestCount === 0) reasonTags.push(tag('no-linked-prs', 'no linked or mentioned PRs found'));
  else if (candidate.pullRequestCount <= 1) reasonTags.push(tag('low-competition', `${candidate.pullRequestCount} linked PR(s)`));
  else if (candidate.pullRequestCount >= 4) riskTags.push(risk('crowded', `${candidate.pullRequestCount} linked PR(s)`, 'high'));
  else riskTags.push(risk('some-competition', `${candidate.pullRequestCount} linked PR(s)`, 'low'));

  if (candidate.competition?.summary) {
    const summary = candidate.competition.summary;
    if (summary.risk === 'high') riskTags.push(risk('strong-competing-pr', `${summary.strong + summary.winner} strong or merged competing PR(s)`, 'high'));
    else if (summary.risk === 'medium') riskTags.push(risk('active-competition', `${summary.active} active competing PR(s)`, 'medium'));
    else if (summary.risk === 'low') riskTags.push(risk('light-competition', `${summary.active} active competing PR(s)`, 'low'));
    else reasonTags.push(tag('weak-competition', 'linked PRs look closed, draft, failing, or inactive'));
  }

  if (candidate.state !== 'open') riskTags.push(risk('not-open', `issue state is ${candidate.state}`, 'high'));
  if (hasAny(fullText, SPECIAL_REQUIREMENT_KEYWORDS)) riskTags.push(risk('special-requirements', 'may need specific hardware, account, or platform access', 'high'));
  if (hasAny(fullText, UNCLEAR_KEYWORDS)) riskTags.push(risk('unclear', 'wording suggests investigation or uncertainty', 'high'));

  if (text.trim().length < 120) riskTags.push(risk('thin-description', 'issue body is short', 'low'));
  if (hasAny(fullText, REPRO_KEYWORDS)) reasonTags.push(tag('repro-signal', 'description appears to include reproduction or expected/actual behavior'));
  else riskTags.push(risk('no-repro-signal', 'no obvious reproduction keywords found', 'medium'));

  let recommendation = 'consider';
  if (candidate.state !== 'open') recommendation = 'skip';
  else if (riskTags.some((item) => ['crowded', 'strong-competing-pr', 'special-requirements', 'unclear'].includes(item.name))) recommendation = 'risky';
  else if (candidate.score.total >= 35 && candidate.amount >= 250 && candidate.pullRequestCount <= 1 && candidate.competition?.summary?.risk !== 'high') recommendation = 'strong';

  return {
    recommendation,
    action: actionFor({recommendation, riskTags, candidate}),
    reasonTags,
    riskTags,
  };
}
