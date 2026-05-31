import {readFile} from 'node:fs/promises';

export async function loadJsonConfig(configPath) {
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

export async function loadConfig(configPath) {
  const config = await loadJsonConfig(configPath);
  const hasExternalSource = Boolean(config.algora || config.opire);

  if (!Array.isArray(config.repositories)) {
    throw new Error('Config must include a repositories array.');
  }

  if (config.repositories.length === 0 && !hasExternalSource) {
    throw new Error('Config must include at least one repository or external adapter source.');
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

export async function loadRadarConfig(configPath) {
  const config = await loadJsonConfig(configPath);

  if (!config.scan && !config.watch) {
    throw new Error('Radar config must include scan, watch, or both.');
  }

  for (const sectionName of ['scan', 'watch']) {
    const section = config[sectionName];
    if (!section || section.enabled === false) continue;
    if (!section.config) throw new Error(`Radar ${sectionName} section must include a config path.`);
  }

  return config;
}
