import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnLongRunning, run } from './_run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

// Install deps if needed (fast no-op when already installed)
await run('node', ['scripts/install-all.mjs'], { cwd: rootDir, label: 'root' });

// Start both dev servers
// eslint-disable-next-line no-console
console.log('Starting backend + frontend dev servers...');

const backend = spawnLongRunning('npm', ['run', 'dev'], { cwd: backendDir, label: 'backend' });
const frontend = spawnLongRunning('npm', ['run', 'dev'], { cwd: frontendDir, label: 'frontend' });

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  // eslint-disable-next-line no-console
  console.log(`\nShutting down (${signal})...`);

  try {
    backend.kill('SIGINT');
  } catch {
    // ignore
  }

  try {
    frontend.kill('SIGINT');
  } catch {
    // ignore
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

backend.on('exit', (code) => {
  if (!shuttingDown) {
    // eslint-disable-next-line no-console
    console.log(`Backend exited (${code}). Stopping frontend...`);
    shutdown('backend-exit');
  }
});

frontend.on('exit', (code) => {
  if (!shuttingDown) {
    // eslint-disable-next-line no-console
    console.log(`Frontend exited (${code}). Stopping backend...`);
    shutdown('frontend-exit');
  }
});

// Keep process alive while children run
await new Promise((resolve) => {
  const maybeResolve = () => {
    if (backend.killed && frontend.killed) resolve();
  };
  backend.on('close', maybeResolve);
  frontend.on('close', maybeResolve);
});
