import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {detectReportChanges} from './changes.js';
import {loadConfig, loadWatchConfig} from './config.js';
import {GitHubClient} from './github.js';
import {findBountyAmount} from './money.js';
import {formatChangesMessage, sendTelegramMessage} from './notify.js';
import {renderMarkdownReport} from './report.js';
import {scoreCandidate} from './score.js';
import {loadState, saveState, updateStateSnapshot} from './state.js';
import {classifyPullRequest, latestActivity, needsAttention, summarizeChecks} from './watch.js';
import {renderWatchReport} from './watch-report.js';

function parseArgs(args) {
  const parsed = {command: args[0], config: 'bounty-radar.config.json', out: 'bounty-report.md', json: null, state: null, notify: false};
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') parsed.config = args[++index];
    else if (arg === '--out') parsed.out = args[++index];
    else if (arg === '--json') parsed.json = args[++index];
    else if (arg === '--state') parsed.state = args[++index];
    else if (arg === '--notify') parsed.notify = true;
    else if (arg === '--help' || arg === '-h') parsed.command = 'help';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Open Bounty Radar

Usage:
  open-bounty-radar scan --config ./examples/config.json --out ./reports/bounty-report.md
  open-bounty-radar watch --config ./examples/watchlist.json --out ./reports/pr-watch.md

Options:
  --config <path>  JSON config file. Default: bounty-radar.config.json
  --out <path>     Markdown report path. Default: bounty-report.md
  --json <path>    Optional machine-readable JSON report path.
  --state <path>   Optional state snapshot path for change detection.
  --notify         Send Telegram notification for detected changes.
`);
}

async function ensureParent(filePath) {
  await mkdir(path.dirname(path.resolve(filePath)), {recursive: true});
}

async function applyStateAndNotifications({kind, report, parsed, config}) {
  const notifications = config.notifications ?? {};
  const telegram = notifications.telegram ?? {};
  const statePath = parsed.state ?? config.statePath ?? (parsed.notify || telegram.enabled ? './reports/open-bounty-radar-state.json' : null);
  if (!statePath) return report;

  const previousState = await loadState(statePath);
  const detected = detectReportChanges(kind, report, previousState, {
    notifyOnFirstRun: Boolean(notifications.notifyOnFirstRun),
  });
  const nextReport = {
    ...report,
    changes: detected.changes,
    changeSummary: {
      firstRun: detected.firstRun,
      statePath: path.resolve(statePath),
    },
  };

  const shouldNotify = parsed.notify || telegram.enabled;
  if (shouldNotify && detected.changes.length) {
    const botTokenEnv = telegram.botTokenEnv ?? 'TELEGRAM_BOT_TOKEN';
    const chatIdEnv = telegram.chatIdEnv ?? 'TELEGRAM_CHAT_ID';
    const botToken = process.env[botTokenEnv];
    const chatId = process.env[chatIdEnv];
    if (!botToken || !chatId) throw new Error(`Telegram notification requested but ${botTokenEnv} or ${chatIdEnv} is not set.`);

    await sendTelegramMessage({
      botToken,
      chatId,
      text: formatChangesMessage({kind, generatedAt: report.generatedAt, changes: detected.changes}),
    });
    console.log(`Sent Telegram notification for ${detected.changes.length} change(s).`);
  }

  await saveState(statePath, updateStateSnapshot(previousState, kind, detected.snapshot));

  if (detected.firstRun && !detected.changes.length) console.log(`Initialized ${kind} state at ${path.resolve(statePath)}.`);
  else console.log(`Detected ${detected.changes.length} ${kind} change(s).`);

  return nextReport;
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

async function watchPullRequest(client, pullRequestConfig, defaults) {
  const fullName = `${pullRequestConfig.owner}/${pullRequestConfig.repo}`;
  const number = pullRequestConfig.number;
  const activityLimit = pullRequestConfig.activityLimit ?? defaults.activityLimit ?? 5;
  const pr = await client.getPullRequest({fullName, number});
  const [comments, reviews, checkRunsResult, statusResult] = await Promise.all([
    client.listIssueComments({fullName, number, perPage: 50}),
    client.listPullRequestReviews({fullName, number, perPage: 50}),
    client.listCheckRuns({fullName, ref: pr.head.sha}).catch((error) => ({error})),
    client.getCombinedStatus({fullName, ref: pr.head.sha}).catch((error) => ({error})),
  ]);

  const checkRuns = checkRunsResult.error ? [] : (checkRunsResult.check_runs ?? []);
  const statuses = statusResult.error ? [] : (statusResult.statuses ?? []);
  const checks = summarizeChecks({checkRuns, statuses});
  const status = classifyPullRequest(pr, checks);
  const item = {
    repository: fullName,
    number,
    label: pullRequestConfig.label ?? null,
    title: pr.title,
    url: pr.html_url,
    state: pr.state,
    draft: pr.draft,
    merged: Boolean(pr.merged_at),
    mergedAt: pr.merged_at,
    updatedAt: pr.updated_at,
    createdAt: pr.created_at,
    headRef: `${pr.head.repo?.full_name ?? 'unknown'}:${pr.head.ref}`,
    checks,
    latestActivity: latestActivity({comments, reviews, limit: activityLimit}),
  };

  return {
    ...item,
    status,
    needsAttention: needsAttention({...item, status}),
    warnings: [
      checkRunsResult.error ? `check-runs unavailable: ${checkRunsResult.error.message}` : null,
      statusResult.error ? `commit status unavailable: ${statusResult.error.message}` : null,
    ].filter(Boolean),
  };
}

async function runScan(parsed) {
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

  const baseReport = {
    generatedAt: new Date().toISOString(),
    candidates: filtered,
    repositories: config.repositories.map((repo) => `${repo.owner}/${repo.repo}`),
    errors,
  };
  const report = await applyStateAndNotifications({kind: 'scan', report: baseReport, parsed, config});

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

async function runWatch(parsed) {
  const config = await loadWatchConfig(parsed.config);
  const token = config.githubTokenEnv ? process.env[config.githubTokenEnv] : process.env.GITHUB_TOKEN;
  const client = new GitHubClient({token});
  const pullRequests = [];
  const errors = [];

  for (const pullRequest of config.pullRequests) {
    try {
      pullRequests.push(await watchPullRequest(client, pullRequest, config.defaults ?? {}));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        repository: `${pullRequest.owner}/${pullRequest.repo}`,
        number: pullRequest.number,
        message,
      });
      console.warn(`Warning: failed to watch ${pullRequest.owner}/${pullRequest.repo}#${pullRequest.number}: ${message.split('\n')[0]}`);
    }
  }

  const baseReport = {
    generatedAt: new Date().toISOString(),
    pullRequests: pullRequests.sort((left, right) => Number(right.needsAttention) - Number(left.needsAttention) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    errors,
  };
  const report = await applyStateAndNotifications({kind: 'watch', report: baseReport, parsed, config});

  await ensureParent(parsed.out);
  await writeFile(parsed.out, renderWatchReport(report), 'utf8');

  if (parsed.json) {
    await ensureParent(parsed.json);
    await writeFile(parsed.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(`Watched ${pullRequests.length} pull request(s).`);
  console.log(`Markdown report: ${path.resolve(parsed.out)}`);
  if (parsed.json) console.log(`JSON report: ${path.resolve(parsed.json)}`);
}

export async function runCli(args) {
  const parsed = parseArgs(args);
  if (!parsed.command || parsed.command === 'help') {
    printHelp();
    return;
  }
  if (parsed.command === 'scan') return runScan(parsed);
  if (parsed.command === 'watch') return runWatch(parsed);
  throw new Error(`Unknown command: ${parsed.command}`);
}
