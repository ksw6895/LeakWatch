import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvFile(content: string) {
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice('export '.length) : line;
    const index = normalized.indexOf('=');
    if (index <= 0) {
      continue;
    }

    const key = normalized.slice(0, index).trim();
    if (!key || key in process.env) {
      continue;
    }

    let value = normalized.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export function loadEnv() {
  const candidates = [
    process.env.LEAKWATCH_ENV_FILE,
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ].filter((value): value is string => Boolean(value));

  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, 'utf8');
    parseEnvFile(content);
    return;
  }
}

