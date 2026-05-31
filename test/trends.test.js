import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoryJsonl, renderHistoryTrendSvg, summarizeHistory} from '../src/trends.js';

test('summarizes history trends', () => {
  const entries = parseHistoryJsonl('{"kind":"scan","candidates":1,"actions":{"act-now":0}}\n{"kind":"scan","candidates":3,"actions":{"act-now":1}}\n');
  const summary = summarizeHistory(entries);
  assert.equal(summary.candidateDelta, 2);
  assert.equal(summary.actNowDelta, 1);
  assert.match(renderHistoryTrendSvg(entries), /polyline/);
});
