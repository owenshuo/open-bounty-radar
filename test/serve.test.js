import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {serveReports} from '../src/serve.js';

test('serves reports directory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'obr-serve-'));
  const {server, url} = await serveReports({root: dir, port: 0});
  try {
    const address = server.address();
    await writeFile(path.join(dir, 'dashboard.html'), '<h1>ok</h1>', 'utf8');
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /ok/);
    const favicon = await fetch(`http://127.0.0.1:${address.port}/favicon.ico`);
    assert.equal(favicon.status, 204);
    assert.match(url, /http:\/\/127\.0\.0\.1:/);
  } finally {
    server.close();
    await rm(dir, {recursive: true, force: true});
  }
});
