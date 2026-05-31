import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {algoraAdapter} from './adapters/algora.js';
import {githubAdapter} from './adapters/github.js';
import {opireAdapter} from './adapters/opire.js';
import {validateCandidates} from './adapters/contract.js';
import {attachAssessments} from './ai-assessment.js';
import {runSelfAudit, renderAuditResult} from './audit.js';
import {topCandidates} from './candidate-ranking.js';
import {fetchJsonWithCache} from './cache.js';
import {detectReportChanges} from './changes.js';
import {loadConfig, loadRadarConfig, loadWatchConfig} from './config.js';
import {candidateDetailFileName, renderCandidateDetailHtml, renderDashboardHtmlReport} from './dashboard-report.js';
import {enrichExternalCandidates} from './external-enrichment.js';
import {renderActionPlan, renderCandidatesCsv, renderCandidatesJsonl, renderWatchlistSuggestions} from './exports.js';
import {GitHubClient} from './github.js';
import {appendHistory} from './history.js';
import {renderScanHtmlReport, renderWatchHtmlReport} from './html-report.js';
import {initializeLocalConfig, renderInitResult} from './init.js';
import {inspectIssue, inspectIssues, renderIssueInspectionBatchHtml, renderIssueInspectionBatchMarkdown, renderIssueInspectionMarkdown} from './issue-inspector.js';
import {filterChangesByNotificationRules} from './notification-rules.js';
import {discordPayload, formatChangesMessage, formatDigestMessage, sendTelegramMessage, sendWebhookMessage, slackPayload} from './notify.js';
import {fetchLiveListings} from './platform-live.js';
import {attachReadiness} from './readiness.js';
import {renderMarkdownReport} from './report.js';
import {serveReports} from './serve.js';
import {loadState, saveState, updateStateSnapshot} from './state.js';
import {inspectEnvironment, renderDoctorResult} from './doctor.js';
import {renderValidationResult, validateRadarConfig} from './validate.js';
import {renderReleaseCheckResult, runReleaseCheck as runReleaseCheckPlan} from './release-check.js';
import {classifyPullRequest, latestActivity, needsAttention, summarizeChecks} from './watch.js';
import {renderWatchDashboardHtmlReport} from './watch-dashboard-report.js';
import {watchAction, winnerSignals} from './watch-insights.js';
import {renderWatchReport} from './watch-report.js';
import {buildWizardConfig, writeWizardConfig} from './wizard.js';
import {attachWorkspaceState, loadWorkspace, mergeWorkspaceCandidates, mergeWorkspaceState, renderWorkspaceSummary, saveWorkspace} from './workspace.js';

function parseArgs(args) {
  const parsed = {command: args[0], config: null, out: 'bounty-report.md', json: null, html: null, dashboard: null, detailsDir: null, inspectDetailsDir: null, watchDashboard: null, csv: null, jsonl: null, actionPlan: null, watchlistSuggestions: null, workspace: null, workspaceImport: null, issueUrl: null, issueList: null, history: null, root: './reports', port: 8787, owner: 'Expensify', repo: 'App', minAmount: 100, pack: false, state: null, notify: false, force: false};
  let configProvided = false;
  if (args[0] === '--help' || args[0] === '-h') parsed.command = 'help';
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') {
      parsed.config = args[++index];
      configProvided = true;
    }
    else if (arg === '--out') parsed.out = args[++index];
    else if (arg === '--json') parsed.json = args[++index];
    else if (arg === '--html') parsed.html = args[++index];
    else if (arg === '--dashboard') parsed.dashboard = args[++index];
    else if (arg === '--details-dir') parsed.detailsDir = args[++index];
    else if (arg === '--inspect-details-dir') parsed.inspectDetailsDir = args[++index];
    else if (arg === '--watch-dashboard') parsed.watchDashboard = args[++index];
    else if (arg === '--csv') parsed.csv = args[++index];
    else if (arg === '--jsonl') parsed.jsonl = args[++index];
    else if (arg === '--action-plan') parsed.actionPlan = args[++index];
    else if (arg === '--watchlist-suggestions') parsed.watchlistSuggestions = args[++index];
    else if (arg === '--workspace') parsed.workspace = args[++index];
    else if (arg === '--workspace-import') parsed.workspaceImport = args[++index];
    else if (arg === '--issue-url') parsed.issueUrl = args[++index];
    else if (arg === '--issue-list') parsed.issueList = args[++index];
    else if (arg === '--history') parsed.history = args[++index];
    else if (arg === '--root') parsed.root = args[++index];
    else if (arg === '--port') parsed.port = Number(args[++index]);
    else if (arg === '--owner') parsed.owner = args[++index];
    else if (arg === '--repo') parsed.repo = args[++index];
    else if (arg === '--min-amount') parsed.minAmount = Number(args[++index]);
    else if (arg === '--pack') parsed.pack = true;
    else if (arg === '--state') parsed.state = args[++index];
    else if (arg === '--notify') parsed.notify = true;
    else if (arg === '--force') parsed.force = true;
    else if (arg === '--help' || arg === '-h') parsed.command = 'help';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!configProvided) parsed.config = defaultConfigPath(parsed.command);
  return parsed;
}

function defaultConfigPath(command) {
  if (command === 'radar' || command === 'validate') return 'bounty-radar.json';
  if (command === 'watch') return 'bounty-radar.watchlist.json';
  return 'bounty-radar.config.json';
}

function printHelp() {
  console.log(`Open Bounty Radar

Usage:
  open-bounty-radar init
  open-bounty-radar radar
  open-bounty-radar doctor
  open-bounty-radar audit
  open-bounty-radar release-check
  open-bounty-radar serve
  open-bounty-radar wizard
  open-bounty-radar workspace --workspace ./reports/workspace.json
  open-bounty-radar inspect --issue-url https://github.com/owner/repo/issues/123
  open-bounty-radar validate
  open-bounty-radar scan --out ./reports/bounty-report.md
  open-bounty-radar watch --out ./reports/pr-watch.md

Options:
  --config <path>  JSON config file. Defaults to local bounty-radar files.
  --out <path>     Markdown report path. Default: bounty-report.md
  --json <path>    Optional machine-readable JSON report path.
  --html <path>    Optional static HTML report path.
  --dashboard <path> Optional static dashboard HTML path for scan reports.
  --details-dir <path> Optional candidate detail page directory for scan dashboard.
  --inspect-details-dir <path> Optional issue detail page directory for batch inspect HTML.
  --watch-dashboard <path> Optional static dashboard HTML path for watch reports.
  --csv <path>     Optional scan CSV export path.
  --jsonl <path>   Optional scan JSONL export path.
  --action-plan <path> Optional Markdown action plan path.
  --watchlist-suggestions <path> Optional JSON file with candidate-to-watchlist suggestions.
  --workspace <path> Optional local workspace state JSON for candidate status and notes.
  --workspace-import <path> Optional exported workspace JSON to merge before scan.
  --issue-url <url> GitHub issue URL for inspect.
  --issue-list <path> Text or JSON file of GitHub issue URLs for batch inspect.
  --history <path> Optional JSONL history append path.
  --root <path>    Reports directory for serve. Default: ./reports
  --port <number>  Local serve port. Default: 8787
  --pack           Include npm pack --dry-run in audit.
  --state <path>   Optional state snapshot path for change detection.
  --notify         Send Telegram notification for detected changes.
  --force          Overwrite local config files when used with init.

Commands:
  init      Create local config files from examples.
  radar     Run enabled scan/watch jobs from one radar config.
  serve     Serve the reports directory as a local web UI.
  audit     Run project self-audit checks.
  release-check Run test, example validation, audit, and whitespace checks.
  wizard    Generate starter local config files.
  workspace Summarize or merge local workspace state.
  inspect   Inspect one GitHub issue deeply.
  doctor    Check local environment, config files, output paths, and GitHub API access.
  validate  Validate configs without calling the GitHub API.
  scan      Scan configured repositories for bounty candidates.
  watch     Watch configured pull requests for status changes.
`);
}

async function ensureParent(filePath) {
  await mkdir(path.dirname(path.resolve(filePath)), {recursive: true});
}

async function loadListingsSource(sourceConfig = {}, {fetchImpl = fetch} = {}) {
  if (sourceConfig.listings?.length) return sourceConfig.listings;
  if (sourceConfig.listingsPath) return JSON.parse(await readFile(sourceConfig.listingsPath, 'utf8'));
  if (sourceConfig.liveUrl) return fetchLiveListings(sourceConfig, {fetchImpl});
  if (sourceConfig.listingsUrl) {
    const result = await fetchJsonWithCache(sourceConfig.listingsUrl, {
      fetchImpl,
      cacheDir: sourceConfig.cacheDir ?? './.cache/open-bounty-radar',
      ttlMs: sourceConfig.cacheTtlMs ?? 15 * 60_000,
    });
    if (result.warning) console.warn(`Warning: using stale cache for ${sourceConfig.listingsUrl}: ${result.warning}`);
    return result.data;
  }
  return [];
}

function historyPath(parsed, config) {
  return parsed.history ?? config.historyPath ?? null;
}

async function applyStateAndNotifications({kind, report, parsed, config}) {
  const notifications = config.notifications ?? {};
  const telegram = notifications.telegram ?? {};
  const webhook = notifications.webhook ?? {};
  const discord = notifications.discord ?? {};
  const slack = notifications.slack ?? {};
  const statePath = parsed.state ?? config.statePath ?? (parsed.notify || telegram.enabled || webhook.enabled || discord.enabled || slack.enabled ? './reports/open-bounty-radar-state.json' : null);
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

  const shouldNotify = parsed.notify || telegram.enabled || webhook.enabled || discord.enabled || slack.enabled;
  const notificationChanges = filterChangesByNotificationRules(detected.changes, notifications.rules ?? {});
  nextReport.changeSummary.notificationChanges = notificationChanges.length;
  if (shouldNotify && notificationChanges.length) {
    const digest = formatDigestMessage({kind, generatedAt: report.generatedAt, changes: notificationChanges});
    if (parsed.notify || telegram.enabled) {
      const botTokenEnv = telegram.botTokenEnv ?? 'TELEGRAM_BOT_TOKEN';
      const chatIdEnv = telegram.chatIdEnv ?? 'TELEGRAM_CHAT_ID';
      const botToken = process.env[botTokenEnv];
      const chatId = process.env[chatIdEnv];
      if (!botToken || !chatId) throw new Error(`Telegram notification requested but ${botTokenEnv} or ${chatIdEnv} is not set.`);

      await sendTelegramMessage({
        botToken,
        chatId,
        text: telegram.digest === false ? formatChangesMessage({kind, generatedAt: report.generatedAt, changes: notificationChanges}) : digest,
      });
      console.log(`Sent Telegram notification for ${notificationChanges.length} change(s).`);
    }

    if (webhook.enabled) {
      const urlEnv = webhook.urlEnv ?? 'OPEN_BOUNTY_RADAR_WEBHOOK_URL';
      const url = webhook.url ?? process.env[urlEnv];
      if (!url) throw new Error(`Webhook notification requested but ${urlEnv} is not set and notifications.webhook.url is empty.`);
      await sendWebhookMessage({
        url,
        payload: {
          kind,
          generatedAt: report.generatedAt,
          summary: digest,
          changes: notificationChanges,
        },
      });
      console.log(`Sent webhook notification for ${notificationChanges.length} change(s).`);
    }

    if (discord.enabled) {
      const urlEnv = discord.urlEnv ?? 'DISCORD_WEBHOOK_URL';
      const url = discord.url ?? process.env[urlEnv];
      if (!url) throw new Error(`Discord notification requested but ${urlEnv} is not set and notifications.discord.url is empty.`);
      await sendWebhookMessage({url, payload: discordPayload({text: digest})});
      console.log(`Sent Discord notification for ${notificationChanges.length} change(s).`);
    }

    if (slack.enabled) {
      const urlEnv = slack.urlEnv ?? 'SLACK_WEBHOOK_URL';
      const url = slack.url ?? process.env[urlEnv];
      if (!url) throw new Error(`Slack notification requested but ${urlEnv} is not set and notifications.slack.url is empty.`);
      await sendWebhookMessage({url, payload: slackPayload({text: digest})});
      console.log(`Sent Slack notification for ${notificationChanges.length} change(s).`);
    }
  }

  await saveState(statePath, updateStateSnapshot(previousState, kind, detected.snapshot));

  if (detected.firstRun && !detected.changes.length) console.log(`Initialized ${kind} state at ${path.resolve(statePath)}.`);
  else console.log(`Detected ${detected.changes.length} ${kind} change(s), ${notificationChanges.length} matched notification rules.`);

  return nextReport;
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

  const attention = needsAttention({...item, status});
  const enriched = {
    ...item,
    status,
    needsAttention: attention,
    action: watchAction({...item, status, needsAttention: attention}),
    warnings: [
      checkRunsResult.error ? `check-runs unavailable: ${checkRunsResult.error.message}` : null,
      statusResult.error ? `commit status unavailable: ${statusResult.error.message}` : null,
    ].filter(Boolean),
  };

  return {
    ...enriched,
    winnerSignals: winnerSignals(enriched),
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
      const candidates = validateCandidates(await githubAdapter.scan({client, repoConfig: repo, defaults: config.defaults ?? {}}), 'github');
      allCandidates.push(...candidates);
    } catch (error) {
      const repository = `${repo.owner}/${repo.repo}`;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({repository, message});
      console.warn(`Warning: failed to scan ${repository}: ${message.split('\n')[0]}`);
    }
  }

  if (config.algora) {
    try {
      const candidates = validateCandidates(algoraAdapter.scanStatic({listings: await loadListingsSource(config.algora)}), 'algora');
      allCandidates.push(...(config.algora.enrichGitHub === false ? candidates : await enrichExternalCandidates(client, candidates, config.defaults ?? {})));
    } catch (error) {
      errors.push({repository: 'algora', message: error instanceof Error ? error.message : String(error)});
    }
  }

  if (config.opire) {
    try {
      const candidates = validateCandidates(opireAdapter.scanStatic({listings: await loadListingsSource(config.opire)}), 'opire');
      allCandidates.push(...(config.opire.enrichGitHub === false ? candidates : await enrichExternalCandidates(client, candidates, config.defaults ?? {})));
    } catch (error) {
      errors.push({repository: 'opire', message: error instanceof Error ? error.message : String(error)});
    }
  }

  const assessed = attachReadiness(attachAssessments(allCandidates));
  const workspacePath = parsed.workspace ?? config.workspacePath ?? null;
  const baseWorkspace = await loadWorkspace(workspacePath);
  const importedWorkspace = parsed.workspaceImport ? JSON.parse(await readFile(parsed.workspaceImport, 'utf8')) : null;
  const workspace = importedWorkspace ? mergeWorkspaceState(baseWorkspace, importedWorkspace) : baseWorkspace;
  const withWorkspace = attachWorkspaceState(assessed, workspace);

  const filtered = withWorkspace
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
  const scanHistoryPath = historyPath(parsed, config);
  const historyText = scanHistoryPath ? await readFile(scanHistoryPath, 'utf8').catch(() => '') : '';
  const reportWithHistory = historyText ? {...report, historyText} : report;

  await ensureParent(parsed.out);
  await writeFile(parsed.out, renderMarkdownReport(reportWithHistory), 'utf8');

  if (parsed.json) {
    await ensureParent(parsed.json);
    await writeFile(parsed.json, `${JSON.stringify(reportWithHistory, null, 2)}\n`, 'utf8');
  }

  if (parsed.html) {
    await ensureParent(parsed.html);
    await writeFile(parsed.html, renderScanHtmlReport(reportWithHistory), 'utf8');
  }

  if (parsed.dashboard) {
    await ensureParent(parsed.dashboard);
    const detailsDir = parsed.detailsDir ?? path.join(path.dirname(parsed.dashboard), 'details');
    await mkdir(path.resolve(detailsDir), {recursive: true});
    const dashboardDir = path.dirname(path.resolve(parsed.dashboard));
    const reportWithDetails = {
      ...reportWithHistory,
      candidates: reportWithHistory.candidates.map((candidate) => ({
        ...candidate,
        detailPath: path.relative(dashboardDir, path.join(path.resolve(detailsDir), candidateDetailFileName(candidate))).replaceAll('\\', '/'),
      })),
    };
    await writeFile(parsed.dashboard, renderDashboardHtmlReport(reportWithDetails), 'utf8');
    for (const candidate of reportWithDetails.candidates) {
      await writeFile(path.join(path.resolve(detailsDir), candidateDetailFileName(candidate)), renderCandidateDetailHtml(candidate, reportWithDetails), 'utf8');
    }
  }

  if (parsed.csv) {
    await ensureParent(parsed.csv);
    await writeFile(parsed.csv, renderCandidatesCsv(reportWithHistory), 'utf8');
  }

  if (parsed.jsonl) {
    await ensureParent(parsed.jsonl);
    await writeFile(parsed.jsonl, renderCandidatesJsonl(reportWithHistory), 'utf8');
  }

  if (parsed.actionPlan) {
    await ensureParent(parsed.actionPlan);
    await writeFile(parsed.actionPlan, renderActionPlan(reportWithHistory), 'utf8');
  }

  if (parsed.watchlistSuggestions) {
    await ensureParent(parsed.watchlistSuggestions);
    await writeFile(parsed.watchlistSuggestions, renderWatchlistSuggestions(reportWithHistory), 'utf8');
  }

  if (scanHistoryPath) {
    await ensureParent(scanHistoryPath);
    await appendHistory('scan', reportWithHistory, scanHistoryPath);
  }

  if (workspacePath) {
    await saveWorkspace(workspacePath, mergeWorkspaceCandidates(workspace, filtered));
  }

  console.log(`Found ${filtered.length} bounty candidate(s).`);
  for (const [index, candidate] of topCandidates(filtered, 3).entries()) {
    console.log(`Top ${index + 1}: ${candidate.analysis?.action ?? 'consider'} ${candidate.repository}#${candidate.number} (${candidate.currency} ${candidate.amount}, score ${candidate.score.total})`);
  }
  console.log(`Markdown report: ${path.resolve(parsed.out)}`);
  if (parsed.json) console.log(`JSON report: ${path.resolve(parsed.json)}`);
  if (parsed.html) console.log(`HTML report: ${path.resolve(parsed.html)}`);
  if (parsed.dashboard) console.log(`Dashboard: ${path.resolve(parsed.dashboard)}`);
  if (parsed.dashboard) console.log(`Candidate details: ${path.resolve(parsed.detailsDir ?? path.join(path.dirname(parsed.dashboard), 'details'))}`);
  if (parsed.csv) console.log(`CSV export: ${path.resolve(parsed.csv)}`);
  if (parsed.jsonl) console.log(`JSONL export: ${path.resolve(parsed.jsonl)}`);
  if (parsed.actionPlan) console.log(`Action plan: ${path.resolve(parsed.actionPlan)}`);
  if (parsed.watchlistSuggestions) console.log(`Watchlist suggestions: ${path.resolve(parsed.watchlistSuggestions)}`);
  if (scanHistoryPath) console.log(`History appended: ${path.resolve(scanHistoryPath)}`);
  if (workspacePath) console.log(`Workspace updated: ${path.resolve(workspacePath)}`);
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

  if (parsed.html) {
    await ensureParent(parsed.html);
    await writeFile(parsed.html, renderWatchHtmlReport(report), 'utf8');
  }

  if (parsed.watchDashboard) {
    await ensureParent(parsed.watchDashboard);
    await writeFile(parsed.watchDashboard, renderWatchDashboardHtmlReport(report), 'utf8');
  }

  const watchHistoryPath = historyPath(parsed, config);
  if (watchHistoryPath) {
    await ensureParent(watchHistoryPath);
    await appendHistory('watch', report, watchHistoryPath);
  }

  console.log(`Watched ${pullRequests.length} pull request(s).`);
  const needingAttention = pullRequests.filter((item) => item.needsAttention).length;
  console.log(`Watch summary: ${needingAttention} need attention, ${pullRequests.length - needingAttention} waiting/healthy.`);
  console.log(`Markdown report: ${path.resolve(parsed.out)}`);
  if (parsed.json) console.log(`JSON report: ${path.resolve(parsed.json)}`);
  if (parsed.html) console.log(`HTML report: ${path.resolve(parsed.html)}`);
  if (parsed.watchDashboard) console.log(`Watch dashboard: ${path.resolve(parsed.watchDashboard)}`);
  if (watchHistoryPath) console.log(`History appended: ${path.resolve(watchHistoryPath)}`);
}

function sectionParsed(command, section, fallback) {
  return {
    command,
    config: section.config,
    out: section.out ?? fallback.out,
    json: section.json ?? fallback.json ?? null,
    html: section.html ?? fallback.html ?? null,
    dashboard: section.dashboard ?? fallback.dashboard ?? null,
    detailsDir: section.detailsDir ?? fallback.detailsDir ?? null,
    inspectDetailsDir: section.inspectDetailsDir ?? fallback.inspectDetailsDir ?? null,
    watchDashboard: section.watchDashboard ?? fallback.watchDashboard ?? null,
    csv: section.csv ?? fallback.csv ?? null,
    jsonl: section.jsonl ?? fallback.jsonl ?? null,
    actionPlan: section.actionPlan ?? fallback.actionPlan ?? null,
    watchlistSuggestions: section.watchlistSuggestions ?? fallback.watchlistSuggestions ?? null,
    workspace: section.workspace ?? fallback.workspace ?? null,
    workspaceImport: section.workspaceImport ?? fallback.workspaceImport ?? null,
    history: section.history ?? fallback.history ?? null,
    state: section.state ?? null,
    notify: Boolean(section.notify),
  };
}

async function runRadar(parsed) {
  const config = await loadRadarConfig(parsed.config);
  const enabledSections = [];

  if (config.scan?.enabled !== false) {
    enabledSections.push('scan');
    await runScan(
      sectionParsed('scan', config.scan, {
        out: './reports/bounty-report.md',
        json: './reports/bounty-report.json',
        html: './reports/bounty-report.html',
        dashboard: './reports/dashboard.html',
        csv: './reports/bounty-candidates.csv',
        jsonl: './reports/bounty-candidates.jsonl',
        actionPlan: './reports/action-plan.md',
        watchlistSuggestions: './reports/watchlist-suggestions.json',
        workspace: './reports/workspace.json',
        history: './reports/history.jsonl',
      }),
    );
  }

  if (config.watch?.enabled !== false) {
    enabledSections.push('watch');
    await runWatch(
      sectionParsed('watch', config.watch, {
        out: './reports/pr-watch.md',
        json: './reports/pr-watch.json',
        html: './reports/pr-watch.html',
        watchDashboard: './reports/watch-dashboard.html',
        history: './reports/history.jsonl',
      }),
    );
  }

  console.log(`Radar run complete: ${enabledSections.join(' + ')}`);
}

async function runValidate(parsed) {
  const result = await validateRadarConfig(parsed.config);
  console.log(renderValidationResult(result));
  if (!result.valid) throw new Error('Configuration validation failed.');
}

async function runDoctor(parsed) {
  const result = await inspectEnvironment(parsed.config);
  console.log(renderDoctorResult(result));
  if (!result.ok) throw new Error('Doctor checks failed.');
}

async function runInit(parsed) {
  const result = await initializeLocalConfig({force: parsed.force});
  console.log(renderInitResult(result));
}

async function runServe(parsed) {
  const result = await serveReports({root: parsed.root, port: parsed.port});
  console.log(`Serving reports from ${result.root}`);
  console.log(result.url);
}

async function runAudit(parsed) {
  const result = await runSelfAudit({runPack: parsed.pack});
  console.log(renderAuditResult(result));
  if (!result.ok) throw new Error('Audit checks failed.');
}

async function runReleaseCheckCommand() {
  const result = await runReleaseCheckPlan();
  console.log(renderReleaseCheckResult(result));
  if (!result.ok) throw new Error('Release check failed.');
}

async function runWizard(parsed) {
  const config = buildWizardConfig({owner: parsed.owner, repo: parsed.repo, minAmount: parsed.minAmount});
  const written = await writeWizardConfig(config, {force: parsed.force});
  console.log(`Wrote ${written.length} config file(s):`);
  for (const file of written) console.log(`- ${file}`);
}

async function runInspect(parsed) {
  if (!parsed.issueUrl && !parsed.issueList) throw new Error('inspect requires --issue-url or --issue-list.');
  const token = process.env.GITHUB_TOKEN;
  const client = new GitHubClient({token});
  if (parsed.issueList) {
    const raw = await readFile(parsed.issueList, 'utf8');
    const issueUrls = parsed.issueList.endsWith('.json') ? JSON.parse(raw) : raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const report = await inspectIssues(client, {issueUrls, defaults: {linkedPullRequestDetection: 'both', competitionDetailLimit: 8}});
    const reportWithReadiness = {...report, candidates: attachReadiness(report.candidates)};
    await ensureParent(parsed.out);
    await writeFile(parsed.out, renderIssueInspectionBatchMarkdown(reportWithReadiness), 'utf8');
    if (parsed.json) {
      await ensureParent(parsed.json);
      await writeFile(parsed.json, `${JSON.stringify(reportWithReadiness, null, 2)}\n`, 'utf8');
    }
    if (parsed.html) {
      await ensureParent(parsed.html);
      const detailsDir = parsed.inspectDetailsDir ?? path.join(path.dirname(parsed.html), 'issue-details');
      await mkdir(path.resolve(detailsDir), {recursive: true});
      const htmlDir = path.dirname(path.resolve(parsed.html));
      const reportWithDetails = {
        ...reportWithReadiness,
        indexPath: path.relative(path.resolve(detailsDir), path.resolve(parsed.html)).replaceAll('\\', '/'),
        indexLabel: 'batch inspection',
        candidates: reportWithReadiness.candidates.map((candidate) => ({
          ...candidate,
          detailPath: path.relative(htmlDir, path.join(path.resolve(detailsDir), candidateDetailFileName(candidate))).replaceAll('\\', '/'),
        })),
      };
      await writeFile(parsed.html, renderIssueInspectionBatchHtml(reportWithDetails), 'utf8');
      for (const candidate of reportWithDetails.candidates) {
        await writeFile(path.join(path.resolve(detailsDir), candidateDetailFileName(candidate)), renderCandidateDetailHtml(candidate, reportWithDetails), 'utf8');
      }
    }
    console.log(`Inspected ${reportWithReadiness.candidates.length} issue(s), ${reportWithReadiness.errors.length} error(s).`);
    console.log(`Markdown report: ${path.resolve(parsed.out)}`);
    if (parsed.json) console.log(`JSON report: ${path.resolve(parsed.json)}`);
    if (parsed.html) console.log(`HTML report: ${path.resolve(parsed.html)}`);
    if (parsed.html) console.log(`Issue details: ${path.resolve(parsed.inspectDetailsDir ?? path.join(path.dirname(parsed.html), 'issue-details'))}`);
    return;
  }

  const candidate = attachReadiness([await inspectIssue(client, {issueUrl: parsed.issueUrl, defaults: {linkedPullRequestDetection: 'both', competitionDetailLimit: 8}})])[0];
  const report = {
    generatedAt: new Date().toISOString(),
    candidates: [candidate],
  };

  await ensureParent(parsed.out);
  await writeFile(parsed.out, renderIssueInspectionMarkdown(candidate), 'utf8');

  if (parsed.json) {
    await ensureParent(parsed.json);
    await writeFile(parsed.json, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
  }

  if (parsed.html) {
    await ensureParent(parsed.html);
    await writeFile(parsed.html, renderCandidateDetailHtml(candidate, report), 'utf8');
  }

  console.log(`Inspected ${candidate.repository}#${candidate.number}: ${candidate.assessment.verdict} (${candidate.assessment.confidence}% confidence).`);
  console.log(`Markdown report: ${path.resolve(parsed.out)}`);
  if (parsed.json) console.log(`JSON report: ${path.resolve(parsed.json)}`);
  if (parsed.html) console.log(`HTML report: ${path.resolve(parsed.html)}`);
}

async function runWorkspace(parsed) {
  const workspacePath = parsed.workspace ?? './reports/workspace.json';
  const base = await loadWorkspace(workspacePath);
  const imported = parsed.workspaceImport ? JSON.parse(await readFile(parsed.workspaceImport, 'utf8')) : null;
  const workspace = imported ? mergeWorkspaceState(base, imported) : base;
  if (imported) await saveWorkspace(workspacePath, workspace);

  await ensureParent(parsed.out);
  await writeFile(parsed.out, renderWorkspaceSummary(workspace), 'utf8');
  if (parsed.json) {
    await ensureParent(parsed.json);
    await writeFile(parsed.json, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');
  }

  console.log(`${imported ? 'Merged and summarized' : 'Summarized'} workspace: ${path.resolve(workspacePath)}`);
  console.log(`Markdown report: ${path.resolve(parsed.out)}`);
  if (parsed.json) console.log(`JSON report: ${path.resolve(parsed.json)}`);
}

export async function runCli(args) {
  const parsed = parseArgs(args);
  if (!parsed.command || parsed.command === 'help') {
    printHelp();
    return;
  }
  if (parsed.command === 'init') return runInit(parsed);
  if (parsed.command === 'radar') return runRadar(parsed);
  if (parsed.command === 'serve') return runServe(parsed);
  if (parsed.command === 'audit') return runAudit(parsed);
  if (parsed.command === 'release-check') return runReleaseCheckCommand(parsed);
  if (parsed.command === 'wizard') return runWizard(parsed);
  if (parsed.command === 'workspace') return runWorkspace(parsed);
  if (parsed.command === 'inspect') return runInspect(parsed);
  if (parsed.command === 'doctor') return runDoctor(parsed);
  if (parsed.command === 'validate') return runValidate(parsed);
  if (parsed.command === 'scan') return runScan(parsed);
  if (parsed.command === 'watch') return runWatch(parsed);
  throw new Error(`Unknown command: ${parsed.command}`);
}
