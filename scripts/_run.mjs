import { spawn } from 'node:child_process';

function quoteCmdArg(arg) {
  const value = String(arg);
  // Minimal quoting for cmd.exe; good enough for our typical args.
  if (!/[\s"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function spawnCrossPlatform(command, args, { cwd, env, stdio, label } = {}) {
  const isWindows = process.platform === 'win32';
  const shouldUseCmd =
    isWindows &&
    (command === 'npm' || command === 'npx' || command.endsWith('.cmd') || command.endsWith('.bat'));

  if (shouldUseCmd) {
    const comspec = env?.ComSpec || process.env.ComSpec || 'cmd.exe';
    const commandLine = [command, ...args].map(quoteCmdArg).join(' ');
    return spawn(comspec, ['/d', '/s', '/c', commandLine], {
      cwd,
      stdio,
      shell: false,
      env,
    });
  }

  return spawn(command, args, {
    cwd,
    stdio,
    shell: false,
    env,
  });
}

export function run(command, args, { cwd, label } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCrossPlatform(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
      label,
    });

    child.on('error', (err) => {
      const prefix = label ? `[${label}] ` : '';
      reject(new Error(`${prefix}${err.message}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const prefix = label ? `[${label}] ` : '';
        reject(new Error(`${prefix}Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
      }
    });
  });
}

export function spawnLongRunning(command, args, { cwd, label } = {}) {
  const child = spawnCrossPlatform(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    label,
  });

  child.on('error', (err) => {
    const prefix = label ? `[${label}] ` : '';
    // eslint-disable-next-line no-console
    console.error(`${prefix}${err.message}`);
  });

  return child;
}
