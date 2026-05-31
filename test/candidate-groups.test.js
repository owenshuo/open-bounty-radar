import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateActionSummary, candidateRiskSummary, groupCandidatesByAction, primaryRiskSeverity} from '../src/candidate-groups.js';

function candidate(action, riskTags = []) {
  return {analysis: {action, riskTags}};
}

test('groups candidates by action in decision order', () => {
  const groups = groupCandidatesByAction([candidate('watch'), candidate('act-now'), candidate('watch')]);
  assert.deepEqual(
    groups.map((group) => [group.name, group.candidates.length]),
    [
      ['act-now', 1],
      ['watch', 2],
    ],
  );
});

test('summarizes primary risk severity', () => {
  const candidates = [
    candidate('act-now', [{name: 'crowded', severity: 'high'}]),
    candidate('watch', [{name: 'stale', severity: 'medium'}]),
    candidate('consider', []),
  ];

  assert.equal(primaryRiskSeverity(candidates[0]), 'high');
  assert.deepEqual(candidateRiskSummary(candidates), {high: 1, medium: 1, low: 0, none: 1});
  assert.deepEqual(candidateActionSummary(candidates), {'act-now': 1, watch: 1, 'manual-review': 0, consider: 1, skip: 0});
});
