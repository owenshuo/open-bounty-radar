import {access, mkdir, writeFile, rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {loadConfig, loadRadarConfig, loadWatchConfig} from './config.js';
import {expandRepositoryQueries} from './search-presets.js';
import {validateRadarConfig} from './validate.js';

function nodeMajor(version) {
  return Number(String(version).split('.')[0]);
}

function statusFor({ok, warning}) {
  if (ok) return 'ok';
  return warning ? 'warning' : 'error';
}

async function writableDirectoryFor(filePath) {
  const directory = path.dirname(path.resolve(filePath));
  const probe = path.join(directory, `.open-bounty-radar-doctor-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(directory, {recursive: true});
  await writeFile(probe, 'ok', 'utf8');
  await rm(probe, {force: true});
  return directory;
}

async function readableFile(filePath) {
  await access(path.resolve(filePath), constants.R_OK);
}

function addCheck(checks, name, status, detail) {
  checks.push({name, status, detail});
}

async function loadEnabledSections(radarConfig) {
  const sections = [];

  if (radarConfig.scan && radarConfig.scan.enabled !== false) {
    sections.push({
      name: 'scan',
      section: radarConfig.scan,
      config: await loadConfig(radarConfig.scan.config),
    });
  }

  if (radarConfig.watch && radarConfig.watch.enabled !== false) {
    sections.push({
      name: 'watch',
      section: radarConfig.watch,
      config: await loadWatchConfig(radarConfig.watch.config),
    });
  }

  return sections;
}

function outputDirectoriesFor(sectionName, section) {
  const defaults =
    sectionName === 'watch'
      ? {
          out: './reports/pr-watch.md',
          json: './reports/pr-watch.json',
          html: './reports/pr-watch.html',
        }
      : {
          out: './reports/bounty-report.md',
          json: './reports/bounty-report.json',
          html: './reports/bounty-report.html',
        };

  const paths = [
    section.out ?? defaults.out,
    section.json ?? defaults.json,
    section.html ?? defaults.html,
    section.dashboard,
    section.watchDashboard,
    section.csv,
    section.jsonl,
    section.actionPlan,
    section.watchlistSuggestions,
    section.workspace,
  ].filter(Boolean);
  return [...new Set(paths.map((filePath) => path.dirname(path.resolve(filePath))))];
}

async function checkGitHubToken({checks, sections, env, fetchImpl}) {
  const tokenEnvNames = [...new Set(sections.map(({config}) => config.githubTokenEnv ?? 'GITHUB_TOKEN'))];

  for (const tokenEnv of tokenEnvNames) {
    const token = env[tokenEnv];
    if (!token) {
      addCheck(checks, `GitHub token ${tokenEnv}`, 'warning', 'not set; unauthenticated GitHub API rate limits will be lower');
      continue;
    }

    addCheck(checks, `GitHub token ${tokenEnv}`, 'ok', 'set');

    try {
      const response = await fetchImpl('https://api.github.com/rate_limit', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'open-bounty-radar',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!response.ok) throw new Error(`GitHub request failed ${response.status}`);
      const data = await response.json();
      const core = data.resources?.core;
      const reset = core?.reset ? new Date(core.reset * 1000).toISOString() : 'unknown reset';
      const detail = core ? `${core.remaining}/${core.limit} core requests remaining; resets ${reset}` : 'rate limit endpoint reachable';
      addCheck(checks, 'GitHub API', 'ok', detail);

      const scopes = response.headers.get('x-oauth-scopes');
      addCheck(checks, 'GitHub token scopes', scopes ? 'ok' : 'warning', scopes || 'scope header unavailable; fine-grained tokens may omit this header');
    } catch (error) {
      addCheck(checks, 'GitHub API', 'warning', error instanceof Error ? error.message.split('\n')[0] : String(error));
    }
  }
}

function addScanOverviewChecks(checks, sectionConfig) {
  const repositories = sectionConfig.repositories ?? [];
  const queryCount = repositories.reduce((total, repository) => total + expandRepositoryQueries(repository).length, 0);
  const timelineRepositories = repositories.filter((repository) => (repository.linkedPullRequestDetection ?? sectionConfig.defaults?.linkedPullRequestDetection ?? 'both') !== 'search').length;
  addCheck(checks, 'Scan scope', 'ok', `${repositories.length} repos, ${queryCount} expanded query(ies)`);
  addCheck(checks, 'Timeline PR detection', timelineRepositories ? 'ok' : 'warning', timelineRepositories ? `${timelineRepositories} repo(s) use timeline or both detection` : 'disabled for all repositories');
  const liveAdapters = ['algora', 'opire'].filter((platform) => sectionConfig[platform]?.liveUrl);
  addCheck(checks, 'Live listing adapters', liveAdapters.length ? 'ok' : 'warning', liveAdapters.length ? `${liveAdapters.join(', ')} live source(s) configured` : 'no live listing source configured');
  addCheck(checks, 'Workspace state', sectionConfig.workspacePath ? 'ok' : 'warning', sectionConfig.workspacePath ? sectionConfig.workspacePath : 'workspacePath not set in scan config');
}

export async function inspectEnvironment(configPath, {env = process.env, fetchImpl = fetch, nodeVersion = process.versions.node} = {}) {
  const checks = [];
  const warnings = [];
  const errors = [];

  const major = nodeMajor(nodeVersion);
  addCheck(checks, 'Node.js', statusFor({ok: major >= 20}), `${nodeVersion} detected; >=20 required`);
  if (major < 20) errors.push('Node.js 20 or newer is required.');

  const validation = await validateRadarConfig(configPath, {env});
  addCheck(checks, 'Config validation', statusFor({ok: validation.valid}), validation.valid ? `${configPath} is valid` : `${validation.errors.length} error(s) found`);
  warnings.push(...validation.warnings);
  errors.push(...validation.errors);

  let sections = [];
  try {
    const radarConfig = await loadRadarConfig(configPath);
    await readableFile(configPath);
    addCheck(checks, 'Radar config file', 'ok', path.resolve(configPath));

    sections = await loadEnabledSections(radarConfig);
    for (const {name, section, config} of sections) {
      await readableFile(section.config);
      addCheck(checks, `${name} config file`, 'ok', path.resolve(section.config));

      if (name === 'scan') addScanOverviewChecks(checks, config);
      if (name === 'watch') addCheck(checks, 'Watch scope', 'ok', `${config.pullRequests.length} pull request(s)`);

      for (const outputDirectory of outputDirectoriesFor(name, section)) {
        const directory = await writableDirectoryFor(path.join(outputDirectory, '.probe'));
        addCheck(checks, `${name} output directory`, 'ok', directory);
      }

      if (config.statePath) {
        const directory = await writableDirectoryFor(config.statePath);
        addCheck(checks, `${name} state directory`, 'ok', directory);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addCheck(checks, 'File access', 'error', message);
    errors.push(message);
  }

  if (sections.length) await checkGitHubToken({checks, sections, env, fetchImpl});

  return {
    ok: errors.length === 0,
    configPath,
    checks,
    warnings,
    errors,
  };
}

export function renderDoctorResult(result) {
  const lines = [
    'Open Bounty Radar Doctor',
    '',
    `Config: ${result.configPath}`,
    `Status: ${result.ok ? 'ok' : 'failed'}`,
    '',
    'Checks:',
  ];

  for (const check of result.checks) {
    lines.push(`- [${check.status}] ${check.name}: ${check.detail}`);
  }

  lines.push('', `Warnings: ${result.warnings.length}`);
  for (const warning of result.warnings) lines.push(`- ${warning}`);

  lines.push('', `Errors: ${result.errors.length}`);
  for (const error of result.errors) lines.push(`- ${error}`);

  return `${lines.join('\n')}\n`;
}
