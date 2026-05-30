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

export function findBountyAmount(text) {
  for (const {pattern, read} of MONEY_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;

    const {symbol, numberText, suffix, currencyText} = read(match);
    const amount = Number(numberText.replaceAll(',', '')) * (suffix?.toLowerCase() === 'k' ? 1000 : 1);
    if (!Number.isFinite(amount)) continue;

    return {
      amount,
      currency: currencyText?.toUpperCase() ?? CURRENCY_SYMBOLS.get(symbol) ?? 'USD',
      raw: match[0].trim(),
    };
  }

  return null;
}
