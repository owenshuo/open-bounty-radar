import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCandidate} from '../src/candidate-analysis.js';

function candidate(overrides = {}) {
  return {
    title: 'Fix paid issue',
    labels: ['bounty'],
    amount: 500,
    currency: 'USD',
    state: 'open',
    pullRequestCount: 0,
    updatedAt: new Date().toISOString(),
    score: {total: 45},
    ...overrides,
  };
}

test('marks high quality low competition candidates as strong', () => {
  const analysis = analyzeCandidate(candidate(), {
    text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.',
  });

  assert.equal(analysis.recommendation, 'strong');
  assert.equal(analysis.action, 'act-now');
  assert.ok(analysis.reasonTags.some((item) => item.name === 'no-linked-prs'));
  assert.ok(analysis.reasonTags.some((item) => item.name === 'repro-signal'));
});

test('marks crowded candidates as risky', () => {
  const analysis = analyzeCandidate(candidate({pullRequestCount: 5}), {
    text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.',
  });

  assert.equal(analysis.recommendation, 'risky');
  assert.equal(analysis.action, 'manual-review');
  assert.ok(analysis.riskTags.some((item) => item.name === 'crowded'));
  assert.ok(analysis.riskTags.some((item) => item.name === 'crowded' && item.severity === 'high'));
});

test('marks closed candidates as skip', () => {
  const analysis = analyzeCandidate(candidate({state: 'closed'}), {text: 'Detailed issue body with reproduce steps.'});
  assert.equal(analysis.recommendation, 'skip');
  assert.equal(analysis.action, 'skip');
  assert.ok(analysis.riskTags.some((item) => item.name === 'not-open'));
  assert.ok(analysis.riskTags.some((item) => item.name === 'not-open' && item.severity === 'high'));
});

test('detects special requirement and thin description risks', () => {
  const analysis = analyzeCandidate(candidate({title: 'iPhone-only bug'}), {text: 'Needs paid account'});
  assert.equal(analysis.recommendation, 'risky');
  assert.equal(analysis.action, 'manual-review');
  assert.ok(analysis.riskTags.some((item) => item.name === 'special-requirements'));
  assert.ok(analysis.riskTags.some((item) => item.name === 'special-requirements' && item.severity === 'high'));
  assert.ok(analysis.riskTags.some((item) => item.name === 'thin-description'));
  assert.ok(analysis.riskTags.some((item) => item.name === 'thin-description' && item.severity === 'low'));
});

test('marks modest competition as watch', () => {
  const analysis = analyzeCandidate(candidate({pullRequestCount: 2, score: {total: 30}}), {
    text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.',
  });

  assert.equal(analysis.recommendation, 'consider');
  assert.equal(analysis.action, 'watch');
  assert.ok(analysis.riskTags.some((item) => item.name === 'some-competition' && item.severity === 'low'));
});
