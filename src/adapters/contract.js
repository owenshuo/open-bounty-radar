export function adapterMetadata(adapter) {
  return {
    name: adapter.name,
    sourceType: adapter.sourceType ?? 'unknown',
    requiresAuth: Boolean(adapter.requiresAuth),
    supportsLive: Boolean(adapter.supportsLive),
  };
}

export function validateCandidate(candidate, adapterName = 'unknown') {
  const required = ['repository', 'number', 'title', 'url', 'amount', 'currency', 'score', 'analysis'];
  const missing = required.filter((field) => candidate[field] === undefined || candidate[field] === null);
  if (missing.length) throw new Error(`${adapterName} adapter produced an invalid candidate; missing ${missing.join(', ')}`);
  return candidate;
}

export function validateCandidates(candidates, adapterName = 'unknown') {
  return candidates.map((candidate) => validateCandidate(candidate, adapterName));
}
