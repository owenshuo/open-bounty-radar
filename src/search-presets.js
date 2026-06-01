export const SEARCH_PRESETS = {
  bounty: ['$ in:title,body', 'bounty in:title,body', '/bounty in:body'],
  external: ['label:External', 'External in:body'],
  recent: ['created:>=@today-14d'],
  'low-competition': ['-linked:pr'],
  'crypto-bounty': ['USDC in:title,body', 'crypto bounty in:title,body', '/bounty in:body'],
  reward: ['reward in:title,body', 'paid issue in:title,body', 'paid in:title,body'],
  amounts: ['$250 in:title,body', '$500 in:title,body', '$1000 in:title,body'],
};

export function availableSearchPresets() {
  return Object.keys(SEARCH_PRESETS);
}

function expandRelativeDate(query, now = new Date()) {
  return query.replaceAll('@today-14d', new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10));
}

export function expandRepositoryQueries(repository, {now = new Date()} = {}) {
  const explicitQueries = repository.queries ?? [];
  const presets = repository.presets ?? [];
  const presetQueries = presets.flatMap((preset) => SEARCH_PRESETS[preset] ?? []);
  const queries = [...explicitQueries, ...presetQueries].map((query) => expandRelativeDate(query, now));
  return queries.length ? [...new Set(queries)] : ['bounty'];
}

export function invalidRepositoryPresets(repository) {
  return (repository.presets ?? []).filter((preset) => !SEARCH_PRESETS[preset]);
}
