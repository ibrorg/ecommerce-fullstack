import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './_run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

await run('node', ['scripts/install-all.mjs'], { cwd: rootDir, label: 'root' });

await run('npm', ['run', 'type-check'], { cwd: backendDir, label: 'backend' });
await run('npm', ['run', 'type-check'], { cwd: frontendDir, label: 'frontend' });
