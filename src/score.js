export function scoreCandidate(candidate) {
  const competitionPenalty = Math.min(candidate.pullRequestCount * 12, 48);
  const amountScore = Math.min(candidate.amount / 100, 50);
  const freshnessDays = Math.max(0, (Date.now() - Date.parse(candidate.updatedAt)) / 86_400_000);
  const freshnessScore = Math.max(0, 25 - freshnessDays * 2);
  const openScore = candidate.state === 'open' ? 15 : -30;
  const total = Math.round(amountScore + freshnessScore + openScore - competitionPenalty);

  return {
    total,
    amountScore: Math.round(amountScore),
    freshnessScore: Math.round(freshnessScore),
    competitionPenalty,
    openScore,
  };
}
