import {readFile} from 'node:fs/promises';

export async function loadConfig(configPath) {
  const raw = await readFile(configPath, 'utf8');
  const config = JSON.parse(raw);

  if (!Array.isArray(config.repositories) || config.repositories.length === 0) {
    throw new Error('Config must include at least one repository.');
  }

  for (const repository of config.repositories) {
    if (!repository.owner || !repository.repo) {
      throw new Error('Each repository must include owner and repo.');
    }
  }

  return config;
}
