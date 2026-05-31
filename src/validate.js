import path from 'node:path';
import {loadConfig, loadRadarConfig, loadWatchConfig} from './config.js';

const LINKED_PR_DETECTION = new Set(['search', 'timeline', 'both']);

function outputWarnings(sectionName, section) {
  const warnings = [];
  const expected = [
    ['out', '.md'],
    ['json', '.json'],
    ['html', '.html'],
  ];

  for (const [field, extension] of expected) {
    if (!section[field]) continue;
    if (path.extname(section[field]).toLowerCase() !== extension) {
      warnings.push(`${sectionName}.${field} usually points to a ${extension} file.`);
    }
  }

  if (!section.out && !section.json && !section.html) {
    warnings.push(`${sectionName} has no report output configured.`);
  }

  return warnings;
}

function notificationIssues(config, label, env = process.env) {
  const warnings = [];
  const errors = [];
  const githubTokenEnv = config.githubTokenEnv ?? 'GITHUB_TOKEN';

  if (githubTokenEnv && !env[githubTokenEnv]) {
    warnings.push(`${label}: ${githubTokenEnv} is not set; GitHub API rate limits will be lower.`);
  }

  const telegram = config.notifications?.telegram;
  if (telegram?.enabled) {
    const botTokenEnv = telegram.botTokenEnv ?? 'TELEGRAM_BOT_TOKEN';
    const chatIdEnv = telegram.chatIdEnv ?? 'TELEGRAM_CHAT_ID';
    if (!env[botTokenEnv]) errors.push(`${label}: Telegram is enabled but ${botTokenEnv} is not set.`);
    if (!env[chatIdEnv]) errors.push(`${label}: Telegram is enabled but ${chatIdEnv} is not set.`);
  }

  return {warnings, errors};
}

function validateScanConfig(config, configPath, env) {
  const warnings = [];
  const errors = [];
  const notify = notificationIssues(config, `scan config ${configPath}`, env);
  warnings.push(...notify.warnings);
  errors.push(...notify.errors);

  const seenRepositories = new Set();
  for (const repository of config.repositories) {
    const fullName = `${repository.owner}/${repository.repo}`;
    if (seenRepositories.has(fullName)) warnings.push(`scan config ${configPath}: duplicate repository ${fullName}.`);
    seenRepositories.add(fullName);

    const strategy = repository.linkedPullRequestDetection ?? config.defaults?.linkedPullRequestDetection ?? 'both';
    if (!LINKED_PR_DETECTION.has(strategy)) {
      errors.push(`scan config ${configPath}: ${fullName} has invalid linkedPullRequestDetection "${strategy}".`);
    }

    if (repository.queries && !Array.isArray(repository.queries)) {
      errors.push(`scan config ${configPath}: ${fullName}.queries must be an array when provided.`);
    }
  }

  return {warnings, errors};
}

function validateWatchConfig(config, configPath, env) {
  const warnings = [];
  const errors = [];
  const notify = notificationIssues(config, `watch config ${configPath}`, env);
  warnings.push(...notify.warnings);
  errors.push(...notify.errors);

  const seenPullRequests = new Set();
  for (const pullRequest of config.pullRequests) {
    const key = `${pullRequest.owner}/${pullRequest.repo}#${pullRequest.number}`;
    if (seenPullRequests.has(key)) warnings.push(`watch config ${configPath}: duplicate pull request ${key}.`);
    seenPullRequests.add(key);
  }

  return {warnings, errors};
}

export async function validateRadarConfig(configPath, {env = process.env} = {}) {
  const warnings = [];
  const errors = [];
  let radarConfig;

  try {
    radarConfig = await loadRadarConfig(configPath);
  } catch (error) {
    return {
      valid: false,
      configPath,
      sections: [],
      warnings,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  const sections = [];
  const sectionSpecs = [
    ['scan', loadConfig, validateScanConfig],
    ['watch', loadWatchConfig, validateWatchConfig],
  ];

  for (const [sectionName, loader, sectionValidator] of sectionSpecs) {
    const section = radarConfig[sectionName];
    if (!section || section.enabled === false) {
      sections.push({name: sectionName, enabled: false});
      continue;
    }

    warnings.push(...outputWarnings(sectionName, section));
    sections.push({name: sectionName, enabled: true, config: section.config});

    try {
      const sectionConfig = await loader(section.config);
      const result = sectionValidator(sectionConfig, section.config, env);
      warnings.push(...result.warnings);
      errors.push(...result.errors);
    } catch (error) {
      errors.push(`${sectionName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    valid: errors.length === 0,
    configPath,
    sections,
    warnings,
    errors,
  };
}

export function renderValidationResult(result) {
  const lines = [
    `Config: ${result.configPath}`,
    `Status: ${result.valid ? 'valid' : 'invalid'}`,
    '',
    'Sections:',
  ];

  for (const section of result.sections) {
    lines.push(`- ${section.name}: ${section.enabled ? `enabled (${section.config})` : 'disabled'}`);
  }

  lines.push('', `Warnings: ${result.warnings.length}`);
  for (const warning of result.warnings) lines.push(`- ${warning}`);

  lines.push('', `Errors: ${result.errors.length}`);
  for (const error of result.errors) lines.push(`- ${error}`);

  return `${lines.join('\n')}\n`;
}
