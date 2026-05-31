import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_FILES = [
  {
    source: 'examples/config.json',
    target: 'bounty-radar.config.json',
    transform: (config) => config,
  },
  {
    source: 'examples/watchlist.json',
    target: 'bounty-radar.watchlist.json',
    transform: (config) => config,
  },
  {
    source: 'examples/radar.full.json',
    target: 'bounty-radar.json',
    transform: (config) => ({
      ...config,
      scan: {
        ...config.scan,
        config: './bounty-radar.config.json',
      },
      watch: {
        ...config.watch,
        config: './bounty-radar.watchlist.json',
      },
    }),
  },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function initializeLocalConfig({cwd = process.cwd(), force = false} = {}) {
  const written = [];
  const skipped = [];

  for (const file of DEFAULT_FILES) {
    const sourcePath = path.resolve(cwd, file.source);
    const targetPath = path.resolve(cwd, file.target);

    if (!force && (await exists(targetPath))) {
      skipped.push({path: targetPath, reason: 'already exists'});
      continue;
    }

    const source = JSON.parse(await readFile(sourcePath, 'utf8'));
    const output = file.transform(source);
    await mkdir(path.dirname(targetPath), {recursive: true});
    await writeFile(targetPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    written.push({path: targetPath});
  }

  return {written, skipped};
}

export function renderInitResult(result) {
  const lines = ['Local config initialization complete.', ''];

  lines.push(`Written: ${result.written.length}`);
  for (const item of result.written) lines.push(`- ${item.path}`);

  lines.push('', `Skipped: ${result.skipped.length}`);
  for (const item of result.skipped) lines.push(`- ${item.path} (${item.reason})`);

  lines.push('', 'Next steps:');
  lines.push('- Edit bounty-radar.config.json and bounty-radar.watchlist.json');
  lines.push('- Run: npm run validate');
  lines.push('- Run: npm run radar');

  return `${lines.join('\n')}\n`;
}
