import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadConfig} from './config.js';
import {GitHubClient} from './github.js';
import {findBountyAmount} from './money.js';
import {renderMarkdownReport} from './report.js';
import {scoreCandidate} from './score.js';

function parseArgs(args) {
  const parsed = {command: args[0], config: 'bounty-radar.config.json', out: 'bounty-report.md', json: null};
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') parsed.config = args[++index];
    else if (arg === '--out') parsed.out = args[++index];
    else if (arg === '--json') parsed.json = args[++index];
    else if (arg === '--help' || arg === '-h') parsed.command = 'help';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Open Bounty Radar

Usage:
  open-bounty-radar scan --config ./examples/config.json --out ./reports/bounty-report.md

Options:
  --config <path>  JSON config file. Default: bounty-radar.config.json
  --out <path>     Markdown report path. Default: bounty-report.md
  --json <path>    Optional machine-readable JSON report path.
`);
}

async function ensureParent(filePath) {
  await mkdir(path.dirname(path.resolve(filePath)), {recursive: true});
}

async function scanRepository(client, repoConfig, defaults) {
  const fullName = `${repoConfig.owner}/${repoConfig.repo}`;
  const queries = repoConfig.queries?.length ? repoConfig.queries : ['bounty'];
  const maxIssuesPerQuery = repoConfig.maxIssuesPerQuery ?? defaults.maxIssuesPerQuery ?? 25;
  const includeClosed = repoConfig.includeClosed ?? defaults.includeClosed ?? false;
  const seen = new Set();
  const candidates = [];

  for (const query of queries) {
    const issues = await client.searchIssues({
      fullName,
      query,
      maxIssues: maxIssuesPerQuery,
      includeClosed,
    });

    for (const issue of issues) {
      const key = `${fullName}#${issue.number}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const bounty = findBountyAmount(`${issue.title}\n\n${issue.body ?? ''}`);
      if (!bounty) continue;

      const pullRequests = await client.searchPullRequestsForIssue({
        fullName,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      });

      const candidate = {
        repository: fullName,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean),
        amount: bounty.amount,
        currency: bounty.currency,
        rawAmount: bounty.raw,
        pullRequestCount: pullRequests.length,
        pullRequests: pullRequests.map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          state: pr.state,
          updatedAt: pr.updated_at,
        })),
      };

      candidates.push({...candidate, score: scoreCandidate(candidate)});
    }
  }

  return candidates;
}

export async function runCli(args) {
  const parsed = parseArgs(args);
  if (!parsed.command || parsed.command === 'help') {
    printHelp();
    return;
  }
  if (parsed.command !== 'scan') throw new Error(`Unknown command: ${parsed.command}`);

  const config = await loadConfig(parsed.config);
  const token = config.githubTokenEnv ? process.env[config.githubTokenEnv] : process.env.GITHUB_TOKEN;
  const client = new GitHubClient({token});
  const allCandidates = [];
  const errors = [];

  for (const repo of config.repositories) {
    try {
      const candidates = await scanRepository(client, repo, config.defaults ?? {});
      allCandidates.push(...candidates);
    } catch (error) {
      const repository = `${repo.owner}/${repo.repo}`;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({repository, message});
      console.warn(`Warning: failed to scan ${repository}: ${message.split('\n')[0]}`);
    }
  }

  const filtered = allCandidates
    .filter((candidate) => candidate.amount >= (config.filters?.minAmount ?? 0))
    .filter((candidate) => {
      const text = `${candidate.title} ${candidate.labels.join(' ')}`.toLowerCase();
      return !(config.filters?.excludeKeywords ?? []).some((keyword) => text.includes(keyword.toLowerCase()));
    })
    .sort((left, right) => right.score.total - left.score.total || right.amount - left.amount);

  const report = {
    generatedAt: new Date().toISOString(),
    candidates: filtered,
    repositories: config.repositories.map((repo) => `${repo.owner}/${repo.repo}`),
    errors,
  };

  await ensureParent(parsed.out);
  await writeFile(parsed.out, renderMarkdownReport(report), 'utf8');

  if (parsed.json) {
    await ensureParent(parsed.json);
    await writeFile(parsed.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(`Found ${filtered.length} bounty candidate(s).`);
  console.log(`Markdown report: ${path.resolve(parsed.out)}`);
  if (parsed.json) console.log(`JSON report: ${path.resolve(parsed.json)}`);
}
