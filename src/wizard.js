import {writeFile} from 'node:fs/promises';

export function buildWizardConfig({owner = 'Expensify', repo = 'App', minAmount = 100, presets = ['bounty', 'external'], telegram = false} = {}) {
  return {
    radar: {
      scan: {
        enabled: true,
        config: './bounty-radar.config.json',
        out: './reports/bounty-report.md',
        json: './reports/bounty-report.json',
        html: './reports/bounty-report.html',
        dashboard: './reports/dashboard.html',
        csv: './reports/bounty-candidates.csv',
        jsonl: './reports/bounty-candidates.jsonl',
        actionPlan: './reports/action-plan.md',
        history: './reports/history.jsonl',
      },
      watch: {
        enabled: true,
        config: './bounty-radar.watchlist.json',
        out: './reports/pr-watch.md',
        json: './reports/pr-watch.json',
        html: './reports/pr-watch.html',
        watchDashboard: './reports/watch-dashboard.html',
        history: './reports/history.jsonl',
      },
    },
    scan: {
      githubTokenEnv: 'GITHUB_TOKEN',
      statePath: './reports/radar-state.json',
      notifications: {telegram: {enabled: telegram}},
      defaults: {maxIssuesPerQuery: 10, includeClosed: false, linkedPullRequestDetection: 'both'},
      filters: {minAmount, excludeKeywords: ['marketing', 'hardware']},
      repositories: [{owner, repo, presets}],
    },
    watch: {
      githubTokenEnv: 'GITHUB_TOKEN',
      statePath: './reports/radar-state.json',
      notifications: {telegram: {enabled: telegram}},
      defaults: {activityLimit: 5},
      pullRequests: [],
    },
  };
}

export async function writeWizardConfig(config, {force = false} = {}) {
  const files = [
    ['bounty-radar.json', config.radar],
    ['bounty-radar.config.json', config.scan],
    ['bounty-radar.watchlist.json', config.watch],
  ];
  const written = [];
  for (const [file, value] of files) {
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, {encoding: 'utf8', flag: force ? 'w' : 'wx'});
    written.push(file);
  }
  return written;
}
