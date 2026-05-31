import test from 'node:test';
import assert from 'node:assert/strict';
import {expandRepositoryQueries, invalidRepositoryPresets} from '../src/search-presets.js';

test('expands repository search presets with explicit queries', () => {
  const queries = expandRepositoryQueries(
    {queries: ['custom query'], presets: ['recent', 'crypto-bounty']},
    {now: new Date('2026-05-31T00:00:00Z')},
  );

  assert.ok(queries.includes('custom query'));
  assert.ok(queries.includes('created:>=2026-05-17'));
  assert.ok(queries.includes('USDC in:title,body'));
});

test('reports invalid repository presets', () => {
  assert.deepEqual(invalidRepositoryPresets({presets: ['bounty', 'unknown']}), ['unknown']);
});
