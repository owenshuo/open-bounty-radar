import {readFile} from 'node:fs/promises';

export async function loadJsonConfig(configPath) {
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

export async function loadConfig(configPath) {
  const config = await loadJsonConfig(configPath);

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

export async function loadWatchConfig(configPath) {
  const config = await loadJsonConfig(configPath);

  if (!Array.isArray(config.pullRequests) || config.pullRequests.length === 0) {
    throw new Error('Watch config must include at least one pull request.');
  }

  for (const pullRequest of config.pullRequests) {
    if (!pullRequest.owner || !pullRequest.repo || !Number.isInteger(pullRequest.number)) {
      throw new Error('Each watched pull request must include owner, repo, and integer number.');
    }
  }

  return config;
}
