const CURRENCY_SYMBOLS = new Map([
  ['$', 'USD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
]);

const MONEY_PATTERNS = [
  {
    pattern: /(?:\/bounty|bounty|reward|paid|prize)\s*[:#-]?\s*(\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|K)?\s*(usdc|usd|eur|gbp)?/i,
    read: (match) => ({symbol: match[1], numberText: match[2], suffix: match[3], currencyText: match[4]}),
  },
  {
    pattern: /(\$|€|£)\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|K)?\s*(?:bounty|reward|prize)?/i,
    read: (match) => ({symbol: match[1], numberText: match[2], suffix: match[3], currencyText: null}),
  },
  {
    pattern: /\b([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|K)?\s*(usdc|usd|eur|gbp)\b/i,
    read: (match) => ({symbol: null, numberText: match[1], suffix: match[2], currencyText: match[3]}),
  },
];

function globalPattern(pattern) {
  return new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
}

function isLikelyDateMatch(text, match, {symbol, suffix, currencyText, numberText}) {
  if (symbol || suffix || currencyText) return false;
  if (!/^(?:19|20)\d{2}$/.test(numberText.replaceAll(',', ''))) return false;

  const nextText = text.slice(match.index + match[0].length);
  return /^\s*[-/]\s*\d{1,2}(?:\s*[-/]\s*\d{1,2})?\b/.test(nextText);
}

export function findBountyAmount(text) {
  for (const {pattern, read} of MONEY_PATTERNS) {
    for (const match of text.matchAll(globalPattern(pattern))) {
      const {symbol, numberText, suffix, currencyText} = read(match);
      if (isLikelyDateMatch(text, match, {symbol, suffix, currencyText, numberText})) continue;

      const amount = Number(numberText.replaceAll(',', '')) * (suffix?.toLowerCase() === 'k' ? 1000 : 1);
      if (!Number.isFinite(amount)) continue;

      return {
        amount,
        currency: currencyText?.toUpperCase() ?? CURRENCY_SYMBOLS.get(symbol) ?? 'USD',
        raw: match[0].trim(),
      };
    }
  }

  return null;
}
