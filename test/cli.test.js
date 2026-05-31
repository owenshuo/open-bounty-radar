import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);

test('prints help from top-level --help', async () => {
  const {stdout} = await execFileAsync(process.execPath, ['./bin/open-bounty-radar.js', '--help']);
  assert.match(stdout, /Open Bounty Radar/);
  assert.match(stdout, /validate/);
  assert.match(stdout, /doctor/);
  assert.match(stdout, /audit/);
  assert.match(stdout, /serve/);
  assert.match(stdout, /wizard/);
  assert.match(stdout, /watch-dashboard/);
  assert.match(stdout, /workspace/);
  assert.match(stdout, /issue-list/);
  assert.match(stdout, /inspect-details-dir/);
  assert.match(stdout, /release-check/);
  assert.match(stdout, /init/);
});
