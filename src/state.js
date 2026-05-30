import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

export async function loadState(statePath) {
  try {
    const raw = await readFile(statePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') return {version: 1};
    throw error;
  }
}

export function updateStateSnapshot(state, kind, snapshot) {
  return {
    ...state,
    version: 1,
    updatedAt: new Date().toISOString(),
    [kind]: snapshot,
  };
}

export async function saveState(statePath, state) {
  await mkdir(path.dirname(path.resolve(statePath)), {recursive: true});
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}
