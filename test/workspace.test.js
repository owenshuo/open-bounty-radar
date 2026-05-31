import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {attachWorkspaceState, loadWorkspace, mergeWorkspaceCandidates, mergeWorkspaceState, renderWorkspaceSummary, saveWorkspace, workspaceSummary} from '../src/workspace.js';

test('merges candidates into local workspace state and preserves user status', async () => {
  const workspace = {
    version: 1,
    candidates: {
      'owner/repo#1': {status: 'doing', note: 'started'},
    },
  };
  const candidates = [
    {repository: 'owner/repo', number: 1, title: 'Fix', url: 'https://github.com/o/r/issues/1', analysis: {action: 'act-now'}, assessment: {verdict: 'start-now'}},
    {repository: 'owner/repo', number: 2, title: 'Other', url: 'https://github.com/o/r/issues/2', analysis: {action: 'watch'}},
  ];

  const merged = mergeWorkspaceCandidates(workspace, candidates);
  assert.equal(merged.candidates['owner/repo#1'].status, 'doing');
  assert.equal(merged.candidates['owner/repo#2'].status, 'new');

  const attached = attachWorkspaceState(candidates, merged);
  assert.equal(attached[0].workspace.note, 'started');

  const dir = await mkdtemp(path.join(tmpdir(), 'obr-workspace-'));
  try {
    const file = path.join(dir, 'workspace.json');
    await saveWorkspace(file, merged);
    assert.match(await readFile(file, 'utf8'), /owner\/repo#2/);
    assert.equal((await loadWorkspace(file)).candidates['owner/repo#1'].status, 'doing');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('merges exported workspace state into existing state', () => {
  const merged = mergeWorkspaceState(
    {version: 1, candidates: {'owner/repo#1': {status: 'reading', note: 'old'}}},
    {candidates: {'owner/repo#1': {status: 'doing', note: 'new'}, 'owner/repo#2': {status: 'skipped'}}},
  );

  assert.equal(merged.candidates['owner/repo#1'].status, 'doing');
  assert.equal(merged.candidates['owner/repo#1'].note, 'new');
  assert.equal(merged.candidates['owner/repo#2'].status, 'skipped');
});

test('summarizes and renders workspace state', () => {
  const workspace = {candidates: {'a/r#1': {status: 'doing', title: 'Fix A'}, 'a/r#2': {status: 'skipped', title: 'Fix B'}}};
  assert.deepEqual(workspaceSummary(workspace), {total: 2, new: 0, reading: 0, doing: 1, submitted: 0, watching: 0, skipped: 1});
  assert.match(renderWorkspaceSummary(workspace), /doing: 1/);
  assert.match(renderWorkspaceSummary(workspace), /a\/r#1/);
});
