import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fetchJsonWithCache} from '../src/cache.js';

test('fetches JSON and reuses fresh cache', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'obr-cache-'));
  try {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify([{id: calls}]), {status: 200});
    };

    const first = await fetchJsonWithCache('https://example.com/listings.json', {fetchImpl, cacheDir: dir});
    const second = await fetchJsonWithCache('https://example.com/listings.json', {fetchImpl, cacheDir: dir});
    assert.equal(first.source, 'live');
    assert.equal(second.source, 'cache');
    assert.equal(calls, 1);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
