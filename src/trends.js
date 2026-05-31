export function parseHistoryJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function summarizeHistory(entries) {
  const latestScan = [...entries].reverse().find((entry) => entry.kind === 'scan');
  const previousScan = [...entries].reverse().filter((entry) => entry.kind === 'scan')[1] ?? null;
  const latestWatch = [...entries].reverse().find((entry) => entry.kind === 'watch');
  const previousWatch = [...entries].reverse().filter((entry) => entry.kind === 'watch')[1] ?? null;

  return {
    latestScan,
    latestWatch,
    candidateDelta: latestScan && previousScan ? latestScan.candidates - previousScan.candidates : 0,
    actNowDelta: latestScan && previousScan ? (latestScan.actions?.['act-now'] ?? 0) - (previousScan.actions?.['act-now'] ?? 0) : 0,
    attentionDelta: latestWatch && previousWatch ? (latestWatch.status?.needs_attention ?? 0) - (previousWatch.status?.needs_attention ?? 0) : 0,
  };
}

export function renderHistoryTrendSvg(entries, {width = 640, height = 160} = {}) {
  const scans = entries.filter((entry) => entry.kind === 'scan').slice(-14);
  if (!scans.length) return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="No scan history"></svg>`;
  const max = Math.max(1, ...scans.map((entry) => entry.candidates));
  const points = scans
    .map((entry, index) => {
      const x = scans.length === 1 ? width / 2 : (index / (scans.length - 1)) * (width - 40) + 20;
      const y = height - 20 - (entry.candidates / max) * (height - 40);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Candidate trend"><polyline fill="none" stroke="#116149" stroke-width="3" points="${points}"/></svg>`;
}
