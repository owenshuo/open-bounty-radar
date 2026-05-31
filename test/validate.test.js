import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {renderValidationResult, validateRadarConfig} from '../src/validate.js';

async function withConfigFiles(files, callback) {
  const dir = await mkdtemp(path.join(tmpdir(), 'open-bounty-radar-validate-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(path.join(dir, name), JSON.stringify(contents), 'utf8');
    }
    return await callback(dir);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}

test('validates a complete radar config', async () => {
  await withConfigFiles(
    {
      'scan.json': {
        githubTokenEnv: 'GITHUB_TOKEN',
        defaults: {linkedPullRequestDetection: 'both'},
        repositories: [{owner: 'owner', repo: 'repo', queries: ['bounty']}],
      },
      'watch.json': {
        githubTokenEnv: 'GITHUB_TOKEN',
        pullRequests: [{owner: 'owner', repo: 'repo', number: 1}],
      },
      'radar.json': {
        scan: {config: null, out: 'report.md', json: 'report.json', html: 'report.html'},
        watch: {config: null, out: 'watch.md', json: 'watch.json', html: 'watch.html'},
      },
    },
    async (dir) => {
      const radarPath = path.join(dir, 'radar.json');
      const radar = {
        scan: {config: path.join(dir, 'scan.json'), out: 'report.md', json: 'report.json', html: 'report.html'},
        watch: {config: path.join(dir, 'watch.json'), out: 'watch.md', json: 'watch.json', html: 'watch.html'},
      };
      await writeFile(radarPath, JSON.stringify(radar), 'utf8');

      const result = await validateRadarConfig(radarPath, {env: {GITHUB_TOKEN: 'token'}});
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
    },
  );
});

test('reports invalid linked pull request detection strategies', async () => {
  await withConfigFiles(
    {
      'scan.json': {
        repositories: [{owner: 'owner', repo: 'repo', linkedPullRequestDetection: 'magic'}],
      },
      'radar.json': {
        scan: {config: null},
      },
    },
    async (dir) => {
      const radarPath = path.join(dir, 'radar.json');
      await writeFile(radarPath, JSON.stringify({scan: {config: path.join(dir, 'scan.json')}}), 'utf8');

      const result = await validateRadarConfig(radarPath, {env: {GITHUB_TOKEN: 'token'}});
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /invalid linkedPullRequestDetection/);
    },
  );
});

test('reports invalid search presets', async () => {
  await withConfigFiles(
    {
      'scan.json': {
        repositories: [{owner: 'owner', repo: 'repo', presets: ['bounty', 'made-up']}],
      },
      'radar.json': {
        scan: {config: null},
      },
    },
    async (dir) => {
      const radarPath = path.join(dir, 'radar.json');
      await writeFile(radarPath, JSON.stringify({scan: {config: path.join(dir, 'scan.json')}}), 'utf8');

      const result = await validateRadarConfig(radarPath, {env: {GITHUB_TOKEN: 'token'}});
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /invalid preset/);
    },
  );
});

test('reports Telegram environment errors when notifications are enabled', async () => {
  await withConfigFiles(
    {
      'scan.json': {
        githubTokenEnv: 'GITHUB_TOKEN',
        notifications: {telegram: {enabled: true}},
        repositories: [{owner: 'owner', repo: 'repo'}],
      },
      'radar.json': {
        scan: {config: null},
      },
    },
    async (dir) => {
      const radarPath = path.join(dir, 'radar.json');
      await writeFile(radarPath, JSON.stringify({scan: {config: path.join(dir, 'scan.json')}}), 'utf8');

      const result = await validateRadarConfig(radarPath, {env: {GITHUB_TOKEN: 'token'}});
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /TELEGRAM_BOT_TOKEN/);
      assert.match(result.errors.join('\n'), /TELEGRAM_CHAT_ID/);
    },
  );
});

test('reports Discord and Slack webhook environment errors when enabled', async () => {
  await withConfigFiles(
    {
      'scan.json': {
        githubTokenEnv: 'GITHUB_TOKEN',
        notifications: {discord: {enabled: true}, slack: {enabled: true}},
        repositories: [{owner: 'owner', repo: 'repo', queries: ['bounty']}],
      },
    },
    async (dir) => {
      const radarPath = path.join(dir, 'radar.json');
      await writeFile(radarPath, JSON.stringify({scan: {config: path.join(dir, 'scan.json')}}), 'utf8');

      const result = await validateRadarConfig(radarPath, {env: {GITHUB_TOKEN: 'token'}});

      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /DISCORD_WEBHOOK_URL/);
      assert.match(result.errors.join('\n'), /SLACK_WEBHOOK_URL/);
    },
  );
});

test('reports invalid notification rule presets and live URLs', async () => {
  await withConfigFiles(
    {
      'scan.json': {
        githubTokenEnv: 'GITHUB_TOKEN',
        notifications: {rules: {preset: 'magic'}},
        repositories: [{owner: 'owner', repo: 'repo', queries: ['bounty']}],
        algora: {liveUrl: 'not-a-url'},
      },
    },
    async (dir) => {
      const radarPath = path.join(dir, 'radar.json');
      await writeFile(radarPath, JSON.stringify({scan: {config: path.join(dir, 'scan.json')}}), 'utf8');

      const result = await validateRadarConfig(radarPath, {env: {GITHUB_TOKEN: 'token'}});

      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /notifications\.rules\.preset/);
      assert.match(result.errors.join('\n'), /algora\.liveUrl/);
    },
  );
});

test('renders duplicate watch PR warnings', async () => {
  await withConfigFiles(
    {
      'watch.json': {
        pullRequests: [
          {owner: 'owner', repo: 'repo', number: 1},
          {owner: 'owner', repo: 'repo', number: 1},
        ],
      },
      'radar.json': {
        watch: {config: null},
      },
    },
    async (dir) => {
      const radarPath = path.join(dir, 'radar.json');
      await writeFile(radarPath, JSON.stringify({watch: {config: path.join(dir, 'watch.json')}}), 'utf8');

      const result = await validateRadarConfig(radarPath, {env: {GITHUB_TOKEN: 'token'}});
      assert.equal(result.valid, true);
      assert.match(renderValidationResult(result), /duplicate pull request owner\/repo#1/);
    },
  );
});
