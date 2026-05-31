import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

export function candidateKey(candidate) {
  return `${candidate.repository}#${candidate.number}`;
}

export async function loadWorkspace(filePath) {
  if (!filePath) return {version: 1, candidates: {}};
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return {version: 1, candidates: {}};
  }
}

export function mergeWorkspaceCandidates(workspace, candidates) {
  const next = {...workspace, version: workspace.version ?? 1, candidates: {...(workspace.candidates ?? {})}};
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    next.candidates[key] = {
      status: next.candidates[key]?.status ?? 'new',
      note: next.candidates[key]?.note ?? '',
      url: candidate.url,
      title: candidate.title,
      action: candidate.analysis?.action ?? 'consider',
      assessment: candidate.assessment?.verdict ?? null,
      updatedAt: new Date().toISOString(),
    };
  }
  return next;
}

export function mergeWorkspaceState(baseWorkspace, importedWorkspace) {
  const next = {version: 1, candidates: {...(baseWorkspace.candidates ?? {})}};
  for (const [key, imported] of Object.entries(importedWorkspace.candidates ?? importedWorkspace ?? {})) {
    const existing = next.candidates[key] ?? {};
    next.candidates[key] = {
      ...existing,
      ...imported,
      status: imported.status ?? existing.status ?? 'new',
      note: imported.note ?? existing.note ?? '',
      updatedAt: imported.updatedAt ?? existing.updatedAt ?? new Date().toISOString(),
    };
  }
  return next;
}

export function attachWorkspaceState(candidates, workspace) {
  return candidates.map((candidate) => ({
    ...candidate,
    workspace: workspace.candidates?.[candidateKey(candidate)] ?? {status: 'new', note: ''},
  }));
}

export async function saveWorkspace(filePath, workspace) {
  await mkdir(path.dirname(path.resolve(filePath)), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');
}

export function workspaceSummary(workspace) {
  const summary = {total: 0, new: 0, reading: 0, doing: 0, submitted: 0, watching: 0, skipped: 0};
  for (const item of Object.values(workspace.candidates ?? {})) {
    summary.total += 1;
    const status = item.status ?? 'new';
    summary[status] = (summary[status] ?? 0) + 1;
  }
  return summary;
}

export function renderWorkspaceSummary(workspace) {
  const summary = workspaceSummary(workspace);
  const lines = ['# Open Bounty Radar Workspace', '', `Candidates: ${summary.total}`, ''];
  for (const [status, count] of Object.entries(summary)) {
    if (status === 'total') continue;
    lines.push(`- ${status}: ${count}`);
  }
  lines.push('', '## Candidates', '');
  for (const [key, item] of Object.entries(workspace.candidates ?? {}).sort()) {
    lines.push(`- ${key} [${item.status ?? 'new'}] ${item.title ?? ''}`);
    if (item.note) lines.push(`  - Note: ${item.note}`);
    if (item.url) lines.push(`  - URL: ${item.url}`);
  }
  return `${lines.join('\n')}\n`;
}
