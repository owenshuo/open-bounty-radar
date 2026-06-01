import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeIssueComments} from '../src/comment-signals.js';

test('counts interest comments without treating them as proposals', () => {
  const signals = analyzeIssueComments([
    {body: 'I can work on this', user: {login: 'alice'}},
    {body: "I'd like to work on this", user: {login: 'bob'}},
  ]);

  assert.equal(signals.interestCount, 2);
  assert.equal(signals.proposalCount, 0);
  assert.equal(signals.reviewerActivity, false);
  assert.equal(signals.fixedOrClosing, false);
});

test('detects proposal density, reviewer activity, and closing signals', () => {
  const signals = analyzeIssueComments([
    {body: 'Here is my proposal: update submitReport and pass managerID through bypassNextApproverID.', user: {login: 'alice'}},
    {body: 'My proposal has the same RCA and ETA today.', user: {login: 'bob'}},
    {body: 'Sorry for the delay. I will review this one today', user: {login: 'c-plus'}},
    {body: 'Closing as requested', user: {login: 'bot'}},
  ]);

  assert.equal(signals.proposalCount, 2);
  assert.equal(signals.reviewerActivity, true);
  assert.equal(signals.fixedOrClosing, true);
  assert.equal(signals.examples.length, 4);
});

test('does not treat proposal text about a fix as fixed or closing', () => {
  const signals = analyzeIssueComments([
    {body: 'Replaces my earlier proposal. The root cause and fix are unchanged. ## Proposal', user: {login: 'alice'}},
  ]);

  assert.equal(signals.proposalCount, 1);
  assert.equal(signals.fixedOrClosing, false);
});
