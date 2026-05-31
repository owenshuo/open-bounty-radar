import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

function cacheKey(url) {
  return Buffer.from(url).toString('base64url');
}

export async function fetchJsonWithCache(url, {fetchImpl = fetch, cacheDir = './.cache/open-bounty-radar', ttlMs = 15 * 60_000} = {}) {
  await mkdir(cacheDir, {recursive: true});
  const cachePath = path.join(cacheDir, `${cacheKey(url)}.json`);

  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf8'));
    if (Date.now() - Date.parse(cached.fetchedAt) <= ttlMs) return {data: cached.data, source: 'cache', cachePath};
  } catch {
    // Missing or invalid cache should not block live fetching.
  }

  try {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    await writeFile(cachePath, `${JSON.stringify({url, fetchedAt: new Date().toISOString(), data}, null, 2)}\n`, 'utf8');
    return {data, source: 'live', cachePath};
  } catch (error) {
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8'));
      return {data: cached.data, source: 'stale-cache', cachePath, warning: error instanceof Error ? error.message : String(error)};
    } catch {
      throw error;
    }
  }
}
