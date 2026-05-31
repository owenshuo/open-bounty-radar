import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {initializeLocalConfig, renderInitResult} from '../src/init.js';

async function withProjectCopy(callback) {
  const dir = await mkdtemp(path.join(tmpdir(), 'open-bounty-radar-init-'));
  try {
    await cp(path.resolve('examples'), path.join(dir, 'examples'), {recursive: true});
    return await callback(dir);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}

test('initializes local config files from examples', async () => {
  await withProjectCopy(async (dir) => {
    const result = await initializeLocalConfig({cwd: dir});
    assert.equal(result.written.length, 3);
    assert.equal(result.skipped.length, 0);

    const radar = JSON.parse(await readFile(path.join(dir, 'bounty-radar.json'), 'utf8'));
    assert.equal(radar.scan.config, './bounty-radar.config.json');
    assert.equal(radar.watch.config, './bounty-radar.watchlist.json');
  });
});

test('does not overwrite existing local configs by default', async () => {
  await withProjectCopy(async (dir) => {
    const target = path.join(dir, 'bounty-radar.config.json');
    await writeFile(target, '{"custom":true}\n', 'utf8');

    const result = await initializeLocalConfig({cwd: dir});
    assert.equal(result.written.length, 2);
    assert.equal(result.skipped.length, 1);
    assert.equal(await readFile(target, 'utf8'), '{"custom":true}\n');
  });
});

test('overwrites existing local configs with force', async () => {
  await withProjectCopy(async (dir) => {
    const target = path.join(dir, 'bounty-radar.config.json');
    await writeFile(target, '{"custom":true}\n', 'utf8');

    const result = await initializeLocalConfig({cwd: dir, force: true});
    assert.equal(result.written.length, 3);
    assert.equal(result.skipped.length, 0);
    assert.notEqual(await readFile(target, 'utf8'), '{"custom":true}\n');
  });
});

test('renders init result with next steps', () => {
  const output = renderInitResult({
    written: [{path: '/tmp/bounty-radar.json'}],
    skipped: [{path: '/tmp/bounty-radar.config.json', reason: 'already exists'}],
  });

  assert.match(output, /Local config initialization complete/);
  assert.match(output, /validate --config/);
  assert.match(output, /already exists/);
});
