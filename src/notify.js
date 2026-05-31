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
    if (change.action) lines.push(`Suggested action: ${change.action}`);
    if (change.riskSeverity) lines.push(`Risk: ${change.riskSeverity}`);
    if (change.winnerSignals?.length) lines.push(`Winner/payment signals: ${change.winnerSignals.join('; ')}`);
    for (const reason of change.reasons) lines.push(`- ${reason}`);
    lines.push(change.url, '');
  }

  if (changes.length > 10) lines.push(`And ${changes.length - 10} more change(s).`);
  return truncate(lines.join('\n').trim());
}

function severityRank(change) {
  return change.severity === 'high' ? 0 : change.severity === 'medium' ? 1 : 2;
}

export function formatDigestMessage({kind, generatedAt, changes, maxItems = 10}) {
  const ordered = [...changes].sort((left, right) => severityRank(left) - severityRank(right));
  const high = ordered.filter((change) => change.severity === 'high').length;
  const medium = ordered.filter((change) => change.severity === 'medium').length;
  const lines = [
    `Open Bounty Radar ${kind} digest`,
    `Generated: ${generatedAt}`,
    `Changes: ${ordered.length} (${high} high, ${medium} medium)`,
    '',
  ];

  for (const change of ordered.slice(0, maxItems)) {
    const action = change.action ? ` · action: ${change.action}` : '';
    const risk = change.riskSeverity ? ` · risk: ${change.riskSeverity}` : '';
    lines.push(`- [${change.severity}] ${change.repository}#${change.number}${action}${risk}`);
    lines.push(`  ${change.subject}`);
    lines.push(`  ${change.reasons.join('; ')}`);
    lines.push(`  ${change.url}`);
  }

  if (ordered.length > maxItems) lines.push('', `And ${ordered.length - maxItems} more change(s).`);
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

export async function sendWebhookMessage({url, payload, fetchImpl = fetch}) {
  if (!url) throw new Error('Webhook URL is required.');

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Webhook notification failed ${response.status}: ${body}`);
  }

  return response.json().catch(() => ({ok: true}));
}

export function discordPayload({text}) {
  return {content: text};
}

export function slackPayload({text}) {
  return {text};
}
