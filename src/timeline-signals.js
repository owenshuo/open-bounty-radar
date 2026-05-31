const SIGNAL_LABELS = /assigned|selected|winner|paid|completed/i;

export function issueTimelineSignals(events = []) {
  const signals = [];
  for (const event of events) {
    if (event.event === 'assigned' && event.assignee?.login) signals.push(`assigned to ${event.assignee.login}`);
    if (event.event === 'labeled' && SIGNAL_LABELS.test(event.label?.name ?? '')) signals.push(`label ${event.label.name}`);
    if (event.event === 'closed') signals.push(`closed${event.state_reason ? ` (${event.state_reason})` : ''}`);
    if (event.event === 'cross-referenced' && event.source?.issue?.pull_request) signals.push(`cross-referenced PR ${event.source.issue.html_url}`);
  }
  return [...new Set(signals)];
}
