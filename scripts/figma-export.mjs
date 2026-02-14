#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');

const args = process.argv.slice(2);
const commandArgs = [
  '--filter',
  '@leakwatch/web',
  'exec',
  'node',
  'scripts/figma-export-runner.mjs',
  `--root-dir=${ROOT_DIR}`,
  ...args,
];

const result = spawnSync('pnpm', commandArgs, {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`[figma-export] Failed to launch command: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
