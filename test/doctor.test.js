import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEnvironment, renderDoctorResult} from '../src/doctor.js';

test('doctor reports healthy environment with token and reachable GitHub API', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 4999,
          },
        },
      }),
      {status: 200, headers: {'content-type': 'application/json'}},
    );

  const result = await inspectEnvironment('./examples/radar.json', {
    env: {GITHUB_TOKEN: 'test-token'},
    fetchImpl,
    nodeVersion: '20.20.0',
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.checks.some((check) => check.name === 'GitHub API' && check.status === 'ok'));

  const rendered = renderDoctorResult(result);
  assert.match(rendered, /Open Bounty Radar Doctor/);
  assert.match(rendered, /4999\/5000 core requests remaining/);
});

test('doctor warns when GitHub token is missing', async () => {
  const result = await inspectEnvironment('./examples/radar.json', {
    env: {},
    fetchImpl: async () => {
      throw new Error('fetch should not be called without a token');
    },
    nodeVersion: '20.20.0',
  });

  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((warning) => warning.includes('GITHUB_TOKEN is not set')));
  assert.ok(result.checks.some((check) => check.name === 'GitHub token GITHUB_TOKEN' && check.status === 'warning'));
});
