import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './_run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const projects = [
  { name: 'backend', dir: path.join(rootDir, 'backend') },
  { name: 'frontend', dir: path.join(rootDir, 'frontend') },
];

function hasNodeModules(projectDir) {
  return fs.existsSync(path.join(projectDir, 'node_modules'));
}

for (const project of projects) {
  if (hasNodeModules(project.dir)) {
    // eslint-disable-next-line no-console
    console.log(`[${project.name}] node_modules already present; skipping install.`);
    continue;
  }

  // eslint-disable-next-line no-console
  console.log(`[${project.name}] Installing dependencies...`);
  await run('npm', ['install'], { cwd: project.dir, label: project.name });
}

// eslint-disable-next-line no-console
console.log('All dependencies are installed.');
