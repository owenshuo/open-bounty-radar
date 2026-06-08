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

test('skips low-return crowded candidates', () => {
  const analysis = analyzeCandidate(candidate({amount: 250, pullRequestCount: 8, score: {total: -15}}), {
    text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.',
  });

  assert.equal(analysis.recommendation, 'skip');
  assert.equal(analysis.action, 'skip');
  assert.ok(analysis.riskTags.some((item) => item.name === 'low-return-crowded' && item.severity === 'high'));
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

test('escalates candidates when competing PR analysis is strong', () => {
  const analysis = analyzeCandidate(
    candidate({
      pullRequestCount: 1,
      competition: {summary: {risk: 'high', strong: 1, winner: 0, active: 0}},
    }),
    {text: 'Steps to reproduce\nExpected result\nActual result'},
  );

  assert.equal(analysis.recommendation, 'risky');
  assert.equal(analysis.action, 'manual-review');
  assert.ok(analysis.riskTags.some((item) => item.name === 'strong-competing-pr' && item.severity === 'high'));
});

test('does not downgrade simple interest comments', () => {
  const analysis = analyzeCandidate(
    candidate({
      bountySignals: {commentSignals: {interestCount: 4, proposalCount: 0, reviewerActivity: false, fixedOrClosing: false}},
    }),
    {text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.'},
  );

  assert.equal(analysis.recommendation, 'strong');
  assert.equal(analysis.action, 'act-now');
  assert.ok(analysis.reasonTags.some((item) => item.name === 'contributor-interest'));
  assert.equal(analysis.riskTags.some((item) => item.name === 'proposal-crowded'), false);
});

test('downgrades crowded proposals and reviewer activity', () => {
  const analysis = analyzeCandidate(
    candidate({
      bountySignals: {commentSignals: {interestCount: 2, proposalCount: 3, reviewerActivity: true, fixedOrClosing: false}},
    }),
    {text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.'},
  );

  assert.equal(analysis.recommendation, 'risky');
  assert.equal(analysis.action, 'manual-review');
  assert.ok(analysis.riskTags.some((item) => item.name === 'proposal-crowded' && item.severity === 'high'));
  assert.ok(analysis.riskTags.some((item) => item.name === 'maintainer-reviewing' && item.severity === 'high'));
});

test('skips comments that say the issue is fixed or closing', () => {
  const analysis = analyzeCandidate(
    candidate({
      bountySignals: {commentSignals: {interestCount: 0, proposalCount: 0, reviewerActivity: false, fixedOrClosing: true}},
    }),
    {text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.'},
  );

  assert.equal(analysis.recommendation, 'skip');
  assert.equal(analysis.action, 'skip');
  assert.ok(analysis.riskTags.some((item) => item.name === 'fixed-or-closing' && item.severity === 'high'));
});

test('skips candidates when comments flag bounty payment risk', () => {
  const analysis = analyzeCandidate(
    candidate({
      bountySignals: {commentSignals: {interestCount: 0, proposalCount: 1, reviewerActivity: false, fixedOrClosing: false, paymentRisk: true}},
    }),
    {text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.'},
  );

  assert.equal(analysis.recommendation, 'skip');
  assert.equal(analysis.action, 'skip');
  assert.ok(analysis.riskTags.some((item) => item.name === 'payment-risk' && item.severity === 'high'));
});

test('skips candidates when comments show the bounty was already hired or paid', () => {
  const analysis = analyzeCandidate(
    candidate({
      bountySignals: {
        commentSignals: {
          interestCount: 0,
          proposalCount: 0,
          reviewerActivity: false,
          fixedOrClosing: false,
          alreadyAssignedOrPaid: true,
        },
      },
    }),
    {text: 'Steps to reproduce: open the page. Expected behavior: it works. Actual behavior: it fails.'},
  );

  assert.equal(analysis.recommendation, 'skip');
  assert.equal(analysis.action, 'skip');
  assert.ok(analysis.riskTags.some((item) => item.name === 'already-assigned-or-paid' && item.severity === 'high'));
});
