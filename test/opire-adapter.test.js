import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOpireListing} from '../src/adapters/opire.js';

test('normalizes Opire listings into candidates', () => {
  const candidate = normalizeOpireListing({
    url: 'https://opire.dev/bounties/example',
    issueUrl: 'https://github.com/owner/repo/issues/321',
    title: 'Fix Opire bounty',
    amount: 300,
    currency: 'USD',
    description: 'Steps to reproduce: run it. Expected behavior: passes. Actual behavior: fails.',
  });

  assert.equal(candidate.adapter, 'opire');
  assert.equal(candidate.platform, 'Opire');
  assert.equal(candidate.repository, 'owner/repo');
  assert.equal(candidate.number, 321);
});
