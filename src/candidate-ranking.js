const RECOMMENDATION_WEIGHT = {
  strong: 4,
  consider: 3,
  risky: 2,
  skip: 1,
};

function riskCount(candidate) {
  return candidate.analysis?.riskTags?.length ?? 0;
}

function recommendationWeight(candidate) {
  return RECOMMENDATION_WEIGHT[candidate.analysis?.recommendation] ?? 0;
}

export function compareCandidates(left, right) {
  return (
    recommendationWeight(right) - recommendationWeight(left) ||
    right.score.total - left.score.total ||
    right.amount - left.amount ||
    riskCount(left) - riskCount(right) ||
    left.pullRequestCount - right.pullRequestCount ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );
}

export function topCandidates(candidates, limit = 5) {
  return [...candidates]
    .filter((candidate) => candidate.analysis?.recommendation !== 'skip')
    .sort(compareCandidates)
    .slice(0, limit);
}
