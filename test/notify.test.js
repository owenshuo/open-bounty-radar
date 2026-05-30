import test from 'node:test';
import assert from 'node:assert/strict';
import {formatChangesMessage, sendTelegramMessage} from '../src/notify.js';

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
        reasons: ['checks changed: passing -> failing'],
        url: 'https://github.com/owner/repo/pull/2',
      },
    ],
  });

  assert.match(message, /Open Bounty Radar: 1 watch change/);
  assert.match(message, /checks changed/);
  assert.match(message, /https:\/\/github.com\/owner\/repo\/pull\/2/);
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
