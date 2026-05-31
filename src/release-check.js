import {spawn} from 'node:child_process';

export function buildReleaseCheckPlan() {
  return [
    {name: 'tests', command: 'npm', args: ['test']},
    {name: 'example validation', command: 'npm', args: ['run', 'validate:example']},
    {name: 'offline demo scan', command: 'npm', args: ['run', 'demo:offline']},
    {name: 'package audit', command: 'npm', args: ['run', 'audit:pack']},
    {name: 'whitespace diff check', command: 'git', args: ['diff', '--check']},
  ];
}

function runCommand(step, {cwd = process.cwd()} = {}) {
  return new Promise((resolve) => {
    const useNpmShim = process.platform === 'win32' && step.command === 'npm';
    const executable = useNpmShim ? 'cmd.exe' : step.command;
    const args = useNpmShim ? ['/c', 'npm', ...step.args] : step.args;
    const child = spawn(executable, args, {cwd});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => resolve({...step, code: 1, stdout, stderr: error.message}));
    child.on('close', (code) => resolve({...step, code, stdout, stderr}));
  });
}

export async function runReleaseCheck({cwd = process.cwd(), runner = runCommand} = {}) {
  const steps = [];
  for (const step of buildReleaseCheckPlan()) {
    const result = await runner(step, {cwd});
    steps.push(result);
    if (result.code !== 0) break;
  }
  return {
    ok: steps.every((step) => step.code === 0) && steps.length === buildReleaseCheckPlan().length,
    steps,
  };
}

export function renderReleaseCheckResult(result) {
  const lines = ['Open Bounty Radar Release Check', '', `Status: ${result.ok ? 'ok' : 'failed'}`, '', 'Steps:'];
  for (const step of result.steps) {
    lines.push(`- [${step.code === 0 ? 'ok' : 'error'}] ${step.name}: ${step.command} ${step.args.join(' ')}`);
    if (step.code !== 0) {
      const detail = (step.stderr || step.stdout || '').trim().split(/\r?\n/).slice(-8).join('\n');
      if (detail) lines.push(detail);
    }
  }
  return `${lines.join('\n')}\n`;
}
