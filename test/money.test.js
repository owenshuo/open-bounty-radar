import test from 'node:test';
import assert from 'node:assert/strict';
import {findBountyAmount} from '../src/money.js';

test('detects slash bounty amounts', () => {
  assert.deepEqual(findBountyAmount('/bounty $6000'), {
    amount: 6000,
    currency: 'USD',
    raw: '/bounty $6000',
  });
});

test('detects compact k amounts', () => {
  const result = findBountyAmount('Reward: $6k for the best implementation');
  assert.equal(result.amount, 6000);
  assert.equal(result.currency, 'USD');
});

test('detects explicit currency text', () => {
  const result = findBountyAmount('Prize 250 USDC');
  assert.equal(result.amount, 250);
  assert.equal(result.currency, 'USDC');
});

test('returns null when no money is present', () => {
  assert.equal(findBountyAmount('help wanted bug report'), null);
});
