import test from 'node:test';
import assert from 'node:assert/strict';
import {readinessChecklist} from '../src/readiness.js';

test('marks clean open candidates as ready', () => {
  const result = readinessChecklist({
    state: 'open',
    amount: 500,
    currency: 'USD',
    competition: {summary: {strong: 0, winner: 0, risk: 'none'}},
    analysis: {riskTags: []},
  });

  assert.equal(result.status, 'ready');
  assert.ok(result.checks.every((check) => check.status === 'pass'));
});

test('blocks candidates with winner competition or unavailable requirements', () => {
  const result = readinessChecklist({
    state: 'open',
    amount: 500,
    competition: {summary: {strong: 0, winner: 1, risk: 'high'}},
    analysis: {riskTags: [{name: 'special-requirements'}]},
  });

  assert.equal(result.status, 'blocked');
  assert.ok(result.checks.some((check) => check.status === 'fail'));
});
