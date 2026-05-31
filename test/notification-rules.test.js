import test from 'node:test';
import assert from 'node:assert/strict';
import {filterChangesByNotificationRules, resolveNotificationRules} from '../src/notification-rules.js';

test('filters notification changes by severity, action, amount, and competition risk', () => {
  const changes = [
    {severity: 'high', action: 'act-now', amount: 500, competitionRisk: 'none'},
    {severity: 'low', action: 'watch', amount: 500, competitionRisk: 'none'},
    {severity: 'high', action: 'act-now', amount: 50, competitionRisk: 'none'},
    {severity: 'high', action: 'manual-review', amount: 500, competitionRisk: 'high'},
  ];

  const filtered = filterChangesByNotificationRules(changes, {
    minSeverity: 'medium',
    actions: ['act-now'],
    minAmount: 100,
    competitionRisks: ['none'],
  });

  assert.deepEqual(filtered, [changes[0]]);
});

test('resolves notification rule presets with local overrides', () => {
  const rules = resolveNotificationRules({preset: 'high-value-only', minAmount: 2000});
  assert.equal(rules.minSeverity, 'medium');
  assert.equal(rules.minAmount, 2000);
});
