import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAuditResult, runSelfAudit} from '../src/audit.js';

test('runs self audit without pack', async () => {
  const result = await runSelfAudit({runPack: false});
  assert.equal(result.ok, true);
  assert.match(renderAuditResult(result), /Open Bounty Radar Audit/);
});
