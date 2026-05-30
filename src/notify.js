const TELEGRAM_API = 'https://api.telegram.org';
const TELEGRAM_SAFE_LENGTH = 3900;

function truncate(text, max = TELEGRAM_SAFE_LENGTH) {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

export function formatChangesMessage({kind, generatedAt, changes}) {
  const lines = [
    `Open Bounty Radar: ${changes.length} ${kind} change(s)`,
    `Generated: ${generatedAt}`,
    '',
  ];

  for (const [index, change] of changes.slice(0, 10).entries()) {
    lines.push(`${index + 1}. [${change.severity}] ${change.title}`);
    lines.push(`${change.repository}#${change.number}: ${change.subject}`);
    for (const reason of change.reasons) lines.push(`- ${reason}`);
    lines.push(change.url, '');
  }

  if (changes.length > 10) lines.push(`And ${changes.length - 10} more change(s).`);
  return truncate(lines.join('\n').trim());
}

export async function sendTelegramMessage({botToken, chatId, text, fetchImpl = fetch}) {
  if (!botToken) throw new Error('Telegram bot token is required.');
  if (!chatId) throw new Error('Telegram chat ID is required.');

  const response = await fetchImpl(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram notification failed ${response.status}: ${body}`);
  }

  return response.json();
}
