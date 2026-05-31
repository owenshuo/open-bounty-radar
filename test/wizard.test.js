import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWizardConfig} from '../src/wizard.js';

test('builds starter wizard configs', () => {
  const config = buildWizardConfig({owner: 'owner', repo: 'repo', minAmount: 250});
  assert.equal(config.scan.filters.minAmount, 250);
  assert.equal(config.scan.repositories[0].owner, 'owner');
  assert.equal(config.radar.scan.dashboard, './reports/dashboard.html');
});
