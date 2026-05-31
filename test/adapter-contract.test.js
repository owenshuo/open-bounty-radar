import test from 'node:test';
import assert from 'node:assert/strict';
import {adapterList} from '../src/adapters/index.js';
import {validateCandidate} from '../src/adapters/contract.js';

test('lists adapter metadata', () => {
  const names = adapterList().map((adapter) => adapter.name);
  assert.deepEqual(names.sort(), ['algora', 'github', 'opire']);
});

test('validates adapter candidates', () => {
  assert.throws(() => validateCandidate({repository: 'owner/repo'}, 'test'), /missing/);
});
