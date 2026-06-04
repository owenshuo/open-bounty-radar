import test from 'node:test';
import assert from 'node:assert/strict';
import {createFetchWithProxyFromEnv} from '../src/proxy-fetch.js';

test('uses the provided fetch implementation when no proxy is configured', () => {
  const fetchImpl = async () => new Response('ok');
  assert.equal(createFetchWithProxyFromEnv({fetchImpl, env: {}, fallbackGitConfig: false}), fetchImpl);
});
