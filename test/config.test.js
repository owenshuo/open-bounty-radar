import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {loadConfig, loadRadarConfig} from '../src/config.js';

test('loads radar configs with scan and watch sections', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'open-bounty-radar-'));
  try {
    const configPath = path.join(dir, 'radar.json');
    await writeFile(
      configPath,
      JSON.stringify({
        scan: {config: './examples/config.json'},
        watch: {config: './examples/watchlist.json'},
      }),
      'utf8',
    );

    const config = await loadRadarConfig(configPath);
    assert.equal(config.scan.config, './examples/config.json');
    assert.equal(config.watch.config, './examples/watchlist.json');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('rejects radar configs without enabled jobs', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'open-bounty-radar-'));
  try {
    const configPath = path.join(dir, 'radar.json');
    await writeFile(configPath, JSON.stringify({}), 'utf8');

    await assert.rejects(() => loadRadarConfig(configPath), /must include scan, watch, or both/);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('loads external-adapter-only scan configs for offline demos', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'open-bounty-radar-'));
  try {
    const configPath = path.join(dir, 'scan.json');
    await writeFile(
      configPath,
      JSON.stringify({
        repositories: [],
        algora: {
          listingsPath: './examples/fixtures/demo-listings.json',
          enrichGitHub: false,
        },
      }),
      'utf8',
    );

    const config = await loadConfig(configPath);
    assert.deepEqual(config.repositories, []);
    assert.equal(config.algora.enrichGitHub, false);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
