import {access, readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';

const SECRET_PATTERN = /github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9_]+|[0-9]{8,}:[A-Za-z0-9_-]{20,}/;

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, {cwd = process.cwd()} = {}) {
  return new Promise((resolve) => {
    const executable = process.platform === 'win32' && command === 'npm' ? 'cmd.exe' : command;
    const finalArgs = process.platform === 'win32' && command === 'npm' ? ['/c', 'npm', ...args] : args;
    const child = spawn(executable, finalArgs, {cwd});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => resolve({code: 1, stdout, stderr: error.message}));
    child.on('close', (code) => resolve({code, stdout, stderr}));
  });
}

function check(name, ok, detail) {
  return {name, status: ok ? 'ok' : 'error', detail};
}

export async function runSelfAudit({cwd = process.cwd(), runPack = false} = {}) {
  const checks = [];
  const requiredFiles = ['README.md', 'package.json', 'docs/configuration.md', 'docs/config-schema.md', 'schema/open-bounty-radar.schema.json', 'examples/radar.json', 'examples/config.demo.json', '.gitignore', '.npmignore'];
  for (const file of requiredFiles) checks.push(check(`file ${file}`, await exists(path.join(cwd, file)), 'required project file'));

  const gitignore = await readFile(path.join(cwd, '.gitignore'), 'utf8');
  checks.push(check('reports ignored', gitignore.includes('reports/'), 'reports/ should not be committed'));

  const readme = await readFile(path.join(cwd, 'README.md'), 'utf8');
  for (const link of [...readme.matchAll(/\]\((docs\/[^)]+)\)/g)].map((match) => match[1])) {
    checks.push(check(`README link ${link}`, await exists(path.join(cwd, link)), 'linked doc exists'));
  }

  const docs = await run('rg', ['-n', SECRET_PATTERN.source, '-S', '.'], {cwd});
  const realSecrets = docs.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.includes('github_pat_xxx'));
  checks.push(check('secret scan', realSecrets.length === 0, realSecrets.length ? realSecrets.join('; ') : 'no real-looking secrets found'));

  if (runPack) {
    const packed = await run('npm', ['pack', '--dry-run'], {cwd});
    checks.push(check('npm pack dry-run', packed.code === 0, packed.code === 0 ? 'package can be packed' : packed.stderr || packed.stdout));
  }

  return {
    ok: checks.every((item) => item.status === 'ok'),
    checks,
  };
}

export function renderAuditResult(result) {
  const lines = ['Open Bounty Radar Audit', '', `Status: ${result.ok ? 'ok' : 'failed'}`, '', 'Checks:'];
  for (const item of result.checks) lines.push(`- [${item.status}] ${item.name}: ${item.detail}`);
  return `${lines.join('\n')}\n`;
}
