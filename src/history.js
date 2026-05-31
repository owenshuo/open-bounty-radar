import {appendFile} from 'node:fs/promises';
import {candidateActionSummary, candidateRiskSummary} from './candidate-groups.js';
import {watchSummary} from './watch-insights.js';

function scanHistoryEntry(report) {
  return {
    kind: 'scan',
    generatedAt: report.generatedAt,
    candidates: report.candidates.length,
    actions: candidateActionSummary(report.candidates),
    risks: candidateRiskSummary(report.candidates),
    errors: report.errors?.length ?? 0,
  };
}

function watchHistoryEntry(report) {
  return {
    kind: 'watch',
    generatedAt: report.generatedAt,
    pullRequests: report.pullRequests.length,
    status: watchSummary(report.pullRequests),
    errors: report.errors?.length ?? 0,
  };
}

export function historyEntry(kind, report) {
  if (kind === 'scan') return scanHistoryEntry(report);
  if (kind === 'watch') return watchHistoryEntry(report);
  throw new Error(`Unknown history kind: ${kind}`);
}

export async function appendHistory(kind, report, historyPath) {
  if (!historyPath) return null;
  const entry = historyEntry(kind, report);
  await appendFile(historyPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}
