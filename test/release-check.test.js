import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReleaseCheckPlan, renderReleaseCheckResult, runReleaseCheck} from '../src/release-check.js';

test('defines release check gates in order', () => {
  const plan = buildReleaseCheckPlan();
  assert.deepEqual(plan.map((step) => step.name), ['tests', 'example validation', 'offline demo scan', 'package audit', 'whitespace diff check']);
  assert.deepEqual(plan.at(-1).args, ['diff', '--check']);
});

test('renders release check results and stops on first failed gate', async () => {
  const result = await runReleaseCheck({
    runner: async (step) => ({...step, code: step.name === 'example validation' ? 1 : 0, stdout: 'nope', stderr: ''}),
  });

  assert.equal(result.ok, false);
  assert.equal(result.steps.length, 2);
  assert.match(renderReleaseCheckResult(result), /Open Bounty Radar Release Check/);
  assert.match(renderReleaseCheckResult(result), /example validation/);
});
