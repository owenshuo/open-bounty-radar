import test from 'node:test';
import assert from 'node:assert/strict';
import {issueTimelineSignals} from '../src/timeline-signals.js';

test('extracts issue timeline bounty signals', () => {
  const signals = issueTimelineSignals([
    {event: 'assigned', assignee: {login: 'alice'}},
    {event: 'labeled', label: {name: 'paid'}},
    {event: 'closed', state_reason: 'completed'},
  ]);
  assert.deepEqual(signals, ['assigned to alice', 'label paid', 'closed (completed)']);
});
