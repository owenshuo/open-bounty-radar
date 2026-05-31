import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCandidate, attachAssessments} from '../src/ai-assessment.js';

function candidate(overrides = {}) {
  return {
    title: 'Fix workspace approval modal',
    labels: ['bounty'],
    state: 'open',
    pullRequestCount: 0,
    analysis: {action: 'act-now', riskTags: []},
    ...overrides,
  };
}

test('assesses act-now low competition candidates as start-now', () => {
  const assessment = assessCandidate(candidate());
  assert.equal(assessment.verdict, 'start-now');
  assert.ok(assessment.confidence >= 80);
  assert.ok(assessment.likelyFiles.some((item) => item.includes('frontend') || item.includes('domain')));
});

test('warns when strong competing PRs exist', () => {
  const assessment = assessCandidate(
    candidate({
      pullRequestCount: 1,
      competition: {summary: {risk: 'high', strong: 1, winner: 0}},
    }),
  );
  assert.equal(assessment.verdict, 'avoid-unless-better');
  assert.ok(assessment.abandonIf.some((item) => item.includes('competing PR')));
});

test('attaches assessments to candidate arrays', () => {
  const [enriched] = attachAssessments([candidate()]);
  assert.equal(enriched.assessment.verdict, 'start-now');
});
