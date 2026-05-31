import test from 'node:test';
import assert from 'node:assert/strict';
import {discordPayload, formatChangesMessage, formatDigestMessage, sendTelegramMessage, sendWebhookMessage, slackPayload} from '../src/notify.js';

test('formats change notification messages', () => {
  const message = formatChangesMessage({
    kind: 'watch',
    generatedAt: '2026-01-01T00:00:00Z',
    changes: [
      {
        severity: 'high',
        title: 'Watched pull request changed',
        repository: 'owner/repo',
        number: 2,
        subject: 'Bounty fix',
        action: 'fix-ci',
        winnerSignals: ['selected mentioned by maintainer'],
        reasons: ['checks changed: passing -> failing'],
        url: 'https://github.com/owner/repo/pull/2',
      },
    ],
  });

  assert.match(message, /Open Bounty Radar: 1 watch change/);
  assert.match(message, /checks changed/);
  assert.match(message, /Suggested action: fix-ci/);
  assert.match(message, /selected mentioned/);
  assert.match(message, /https:\/\/github.com\/owner\/repo\/pull\/2/);
});

test('formats compact digest notifications sorted by severity', () => {
  const message = formatDigestMessage({
    kind: 'scan',
    generatedAt: '2026-01-01T00:00:00Z',
    changes: [
      {
        severity: 'medium',
        repository: 'owner/repo',
        number: 1,
        subject: 'Medium change',
        action: 'watch',
        riskSeverity: 'low',
        reasons: ['competition changed'],
        url: 'https://github.com/owner/repo/issues/1',
      },
      {
        severity: 'high',
        repository: 'owner/repo',
        number: 2,
        subject: 'High change',
        action: 'act-now',
        riskSeverity: 'none',
        reasons: ['new bounty'],
        url: 'https://github.com/owner/repo/issues/2',
      },
    ],
  });

  assert.match(message, /Open Bounty Radar scan digest/);
  assert.match(message, /Changes: 2 \(1 high, 1 medium\)/);
  assert.ok(message.indexOf('owner/repo#2') < message.indexOf('owner/repo#1'));
});

test('sends Telegram messages with expected payload', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({url, options});
    return {
      ok: true,
      async json() {
        return {ok: true};
      },
    };
  };

  await sendTelegramMessage({
    botToken: 'token',
    chatId: 'chat',
    text: 'hello',
    fetchImpl: fakeFetch,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bottoken/sendMessage');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    chat_id: 'chat',
    text: 'hello',
    disable_web_page_preview: true,
  });
});

test('sends webhook messages with JSON payload', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({url, options});
    return {
      ok: true,
      async json() {
        return {ok: true};
      },
    };
  };

  await sendWebhookMessage({
    url: 'https://example.com/webhook',
    payload: {hello: 'world'},
    fetchImpl: fakeFetch,
  });

  assert.equal(calls[0].url, 'https://example.com/webhook');
  assert.deepEqual(JSON.parse(calls[0].options.body), {hello: 'world'});
});

test('formats Discord and Slack webhook payloads', () => {
  assert.deepEqual(discordPayload({text: 'hello'}), {content: 'hello'});
  assert.deepEqual(slackPayload({text: 'hello'}), {text: 'hello'});
});
