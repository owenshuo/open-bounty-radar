import test from 'node:test';
import assert from 'node:assert/strict';
import {topCandidates} from '../src/candidate-ranking.js';

function candidate(number, overrides = {}) {
  return {
    repository: 'owner/repo',
    number,
    amount: 250,
    pullRequestCount: 0,
    updatedAt: '2026-01-01T00:00:00Z',
    score: {total: 20},
    analysis: {recommendation: 'consider', riskTags: []},
    ...overrides,
  };
}

test('orders top candidates by recommendation then score', () => {
  const ranked = topCandidates([
    candidate(1, {score: {total: 80}, analysis: {recommendation: 'risky', riskTags: []}}),
    candidate(2, {score: {total: 30}, analysis: {recommendation: 'strong', riskTags: []}}),
    candidate(3, {score: {total: 50}, analysis: {recommendation: 'consider', riskTags: []}}),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.number),
    [2, 3, 1],
  );
});

test('excludes skipped candidates from top candidates', () => {
  const ranked = topCandidates([
    candidate(1, {analysis: {recommendation: 'skip', riskTags: []}}),
    candidate(2, {analysis: {recommendation: 'consider', riskTags: []}}),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.number),
    [2],
  );
});

test('respects top candidate limit', () => {
  const ranked = topCandidates([candidate(1), candidate(2), candidate(3)], 2);
  assert.equal(ranked.length, 2);
});
