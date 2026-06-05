function pullRequestNumberFromUrl(url) {
  const match = url?.match(/\/pull\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function normalizePullRequest(pr, source) {
  const url = pr.html_url ?? pr.url;
  return {
    number: pr.number ?? pullRequestNumberFromUrl(url),
    title: pr.title ?? '(untitled pull request)',
    url,
    state: pr.state ?? 'unknown',
    updatedAt: pr.updated_at ?? pr.updatedAt ?? null,
    detectionSources: [source],
  };
}

export function mergeLinkedPullRequests(results) {
  const byUrl = new Map();

  for (const result of results) {
    for (const pr of result.pullRequests) {
      const normalized = normalizePullRequest(pr, result.source);
      if (!normalized.url) continue;

      const existing = byUrl.get(normalized.url);
      if (!existing) {
        byUrl.set(normalized.url, normalized);
        continue;
      }

      byUrl.set(normalized.url, {
        ...existing,
        ...Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== null && value !== undefined)),
        detectionSources: [...new Set([...existing.detectionSources, ...normalized.detectionSources])],
      });
    }
  }

  return [...byUrl.values()].sort((left, right) => Date.parse(right.updatedAt ?? 0) - Date.parse(left.updatedAt ?? 0));
}

function shouldUseSource(strategy, source) {
  return strategy === 'both' || strategy === source;
}

export async function findLinkedPullRequests(client, {fullName, issueNumber, issueUrl, strategy = 'both'}) {
  const tasks = [];

  if (strategy === 'none') {
    return {pullRequests: [], warnings: ['linked pull request detection disabled']};
  }

  if (shouldUseSource(strategy, 'search')) {
    tasks.push(
      client
        .searchPullRequestsForIssue({fullName, issueNumber, issueUrl})
        .then((pullRequests) => ({source: 'search', pullRequests}))
        .catch((error) => ({source: 'search', error})),
    );
  }

  if (shouldUseSource(strategy, 'timeline')) {
    tasks.push(
      client
        .listTimelinePullRequestsForIssue({fullName, number: issueNumber})
        .then((pullRequests) => ({source: 'timeline', pullRequests}))
        .catch((error) => ({source: 'timeline', error})),
    );
  }

  if (!tasks.length) throw new Error(`Unsupported linked pull request detection strategy: ${strategy}`);

  const results = await Promise.all(tasks);
  const successful = results.filter((result) => !result.error);
  const warnings = results.filter((result) => result.error).map((result) => `${result.source}: ${result.error.message.split('\n')[0]}`);

  if (!successful.length && results.length) throw results[0].error;

  return {
    pullRequests: mergeLinkedPullRequests(successful),
    warnings,
  };
}
