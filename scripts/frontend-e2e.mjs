#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { release as osRelease } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const ROOT_ENV_PATH = resolve(ROOT_DIR, '.env');
const ROOT_ENV_EXAMPLE_PATH = resolve(ROOT_DIR, '.env.example');

function fail(message) {
  console.error(`[frontend-e2e] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const flags = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--') {
      continue;
    }
    if (!token.startsWith('--')) {
      continue;
    }

    const equalsIndex = token.indexOf('=');
    if (equalsIndex >= 0) {
      flags[token.slice(2, equalsIndex)] = token.slice(equalsIndex + 1);
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
      continue;
    }

    flags[key] = 'true';
  }

  return { command, flags };
}

function toBooleanFlag(rawValue, defaultValue = false) {
  if (rawValue === undefined) {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return defaultValue;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function normalizePublicUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`Invalid --public-url: ${value}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    fail(`--public-url must use http or https: ${value}`);
  }

  parsed.pathname = '/';
  parsed.search = '';
  parsed.hash = '';
  return trimTrailingSlash(parsed.toString());
}

function normalizeShopDomain(value) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized)) {
    fail(`Invalid --shop-domain: ${value}`);
  }
  return normalized;
}

function parseEnvFile(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice('export '.length) : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key || key in env) {
      continue;
    }

    let value = normalized.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function readRootEnv() {
  if (!existsSync(ROOT_ENV_PATH)) {
    return {};
  }
  return parseEnvFile(readFileSync(ROOT_ENV_PATH, 'utf8'));
}

function ensureRootEnvFile() {
  if (existsSync(ROOT_ENV_PATH)) {
    return;
  }
  if (!existsSync(ROOT_ENV_EXAMPLE_PATH)) {
    fail('Missing .env and .env.example in repository root');
  }
  copyFileSync(ROOT_ENV_EXAMPLE_PATH, ROOT_ENV_PATH);
  console.log('[frontend-e2e] Created .env from .env.example');
}

function upsertEnvValue(text, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');
  const line = `${key}=${value}`;

  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }

  const suffix = text.endsWith('\n') || text.length === 0 ? '' : '\n';
  return `${text}${suffix}${line}\n`;
}

function syncPublicUrlToEnv(publicUrl) {
  ensureRootEnvFile();
  let text = readFileSync(ROOT_ENV_PATH, 'utf8');

  for (const key of ['SHOPIFY_APP_URL', 'API_BASE_URL', 'NEXT_PUBLIC_API_URL']) {
    text = upsertEnvValue(text, key, publicUrl);
  }

  writeFileSync(ROOT_ENV_PATH, text);
}

async function detectNgrokPublicUrl() {
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    const tunnels = Array.isArray(json.tunnels) ? json.tunnels : [];
    const matched = tunnels.find((item) => {
      return (
        item &&
        typeof item.public_url === 'string' &&
        item.public_url.startsWith('https://') &&
        item.config?.addr?.toString().endsWith(':3000')
      );
    });
    if (matched?.public_url) {
      return trimTrailingSlash(matched.public_url);
    }

    const firstHttps = tunnels.find(
      (item) =>
        item && typeof item.public_url === 'string' && item.public_url.startsWith('https://'),
    );
    return firstHttps?.public_url ? trimTrailingSlash(firstHttps.public_url) : null;
  } catch {
    return null;
  }
}

function parseCallbackUrl(callbackUrl) {
  let parsed;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    fail(`Invalid --callback-url: ${callbackUrl}`);
  }

  const shopDomain = parsed.searchParams.get('shop');
  const host = parsed.searchParams.get('host');
  return {
    publicUrl: trimTrailingSlash(parsed.origin),
    shopDomain: shopDomain ? normalizeShopDomain(shopDomain) : null,
    host: host?.trim() || null,
  };
}

function resolveOpenCommand() {
  if (process.platform === 'darwin') {
    return { command: 'open', args: (url) => [url] };
  }
  if (process.platform === 'win32') {
    return { command: 'cmd', args: (url) => ['/c', 'start', '', url] };
  }

  const release = osRelease();
  const isWsl =
    process.platform === 'linux' &&
    (release.toLowerCase().includes('microsoft') ||
      (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP ? true : false));

  if (isWsl) {
    return { command: 'powershell.exe', args: (url) => ['-NoProfile', 'Start-Process', url] };
  }

  return { command: 'xdg-open', args: (url) => [url] };
}

function openExternalUrl(url) {
  const opener = resolveOpenCommand();
  const result = spawnSync(opener.command, opener.args(url), {
    stdio: 'ignore',
    cwd: ROOT_DIR,
    shell: false,
  });
  return result.status === 0;
}

function runCommand(command, args, description) {
  console.log(`\n[frontend-e2e] ${description}`);
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function withContext(publicUrl, path, shopDomain, host) {
  const target = new URL(path, publicUrl);
  target.searchParams.set('shop', shopDomain);
  target.searchParams.set('host', host);
  return target.toString();
}

function buildFrontendUrls(publicUrl, shopDomain, host) {
  const pages = [
    '/app',
    '/app/uploads',
    '/app/leaks',
    '/app/actions',
    '/app/reports',
    '/app/settings',
    '/app/settings/billing',
    '/app/agency',
    '/agency/login',
    '/agency/reports',
  ];
  return pages.map((path) => withContext(publicUrl, path, shopDomain, host));
}

function printPartnerDashboardValues(publicUrl) {
  console.log('\n[frontend-e2e] Shopify Partner Dashboard values');
  console.log(`App URL: ${publicUrl}`);
  console.log(`Allowed redirection URL(s): ${publicUrl}/v1/shopify/auth/callback`);
  console.log(`Webhook URL (app/uninstalled): ${publicUrl}/v1/shopify/webhooks/app-uninstalled`);
  console.log(`Webhook URL (shop/update): ${publicUrl}/v1/shopify/webhooks/shop-update`);
}

function printUsage() {
  console.log(`
Usage:
  pnpm e2e:frontend:bootstrap [-- --start-dev=true|false]
  pnpm e2e:frontend:prep -- [--public-url=<https-url>] [--shop-domain=<shop.myshopify.com>] [--open-auth=true|false]
  pnpm e2e:frontend:links -- [--public-url=<https-url>] --shop-domain=<shop.myshopify.com> --host=<host>
  pnpm e2e:frontend:open -- [--public-url=<https-url>] --shop-domain=<shop.myshopify.com> --host=<host>
  pnpm e2e:frontend:open -- --callback-url="https://.../app?shop=...&host=..."

Examples:
  pnpm e2e:frontend:prep -- --shop-domain=leakwatch-dev-01.myshopify.com
  pnpm e2e:frontend:open -- --callback-url="https://abc.ngrok-free.dev/app?shop=leakwatch-dev-01.myshopify.com&host=..."
  curl -s "http://127.0.0.1:4040/api/tunnels" | jq -r '.tunnels[] | select(.proto=="https") | .public_url'
`);
}

function resolvePublicUrlForCommand(flags, callbackData, envFromFile, detectedNgrokUrl) {
  const explicitPublicUrl = flags['public-url']?.trim();
  if (explicitPublicUrl) {
    return normalizePublicUrl(explicitPublicUrl);
  }

  if (callbackData?.publicUrl) {
    return normalizePublicUrl(callbackData.publicUrl);
  }

  if (detectedNgrokUrl) {
    return normalizePublicUrl(detectedNgrokUrl);
  }

  const fromEnv = envFromFile.SHOPIFY_APP_URL?.trim();
  if (fromEnv) {
    return normalizePublicUrl(fromEnv);
  }

  fail('Unable to resolve public URL. Pass --public-url or start ngrok and retry.');
}

async function runPrep(flags) {
  const callbackData = flags['callback-url'] ? parseCallbackUrl(flags['callback-url']) : null;
  const envFromFile = readRootEnv();
  const detectedNgrokUrl = await detectNgrokPublicUrl();
  const publicUrl = resolvePublicUrlForCommand(flags, callbackData, envFromFile, detectedNgrokUrl);

  if (!publicUrl.startsWith('https://')) {
    console.warn(
      `[frontend-e2e] Warning: Shopify embedded flow usually requires HTTPS public URL. Current: ${publicUrl}`,
    );
  }

  let shopDomain = flags['shop-domain']?.trim() || callbackData?.shopDomain || null;
  if (shopDomain) {
    shopDomain = normalizeShopDomain(shopDomain);
  }

  syncPublicUrlToEnv(publicUrl);
  console.log(
    `[frontend-e2e] Synced .env keys: SHOPIFY_APP_URL, API_BASE_URL, NEXT_PUBLIC_API_URL => ${publicUrl}`,
  );
  printPartnerDashboardValues(publicUrl);

  console.log('\n[frontend-e2e] Health check URL');
  console.log(`${publicUrl}/v1/health`);

  if (!shopDomain) {
    console.log('\n[frontend-e2e] shop domain not provided');
    console.log('Set --shop-domain to auto-open OAuth start URL.');
    console.log('How to find it: Shopify Admin > Settings > Domains > copy *.myshopify.com');
    console.log(
      `Or run: pnpm e2e:frontend:prep -- --public-url=${publicUrl} --shop-domain=<store>.myshopify.com`,
    );
    return;
  }

  const authStartUrl = `${publicUrl}/v1/shopify/auth/start?shop=${encodeURIComponent(shopDomain)}`;
  console.log('\n[frontend-e2e] OAuth start URL');
  console.log(authStartUrl);

  const shouldOpenAuth = toBooleanFlag(flags['open-auth'], true);
  if (shouldOpenAuth) {
    const opened = openExternalUrl(authStartUrl);
    console.log(
      opened
        ? '[frontend-e2e] Opened OAuth URL in browser.'
        : '[frontend-e2e] Could not auto-open browser. Open the OAuth URL manually.',
    );
  }

  console.log('\n[frontend-e2e] After OAuth completes');
  console.log('1) Copy full callback URL from browser address bar (contains shop and host).');
  console.log('2) Run:');
  console.log(
    `pnpm e2e:frontend:open -- --callback-url="${publicUrl}/app?shop=${shopDomain}&host=<host>"`,
  );
}

function resolveLinkInputs(flags) {
  const callbackData = flags['callback-url'] ? parseCallbackUrl(flags['callback-url']) : null;
  const envFromFile = readRootEnv();

  const publicUrl = resolvePublicUrlForCommand(flags, callbackData, envFromFile, null);
  const rawShop = flags['shop-domain']?.trim() || callbackData?.shopDomain || null;
  const rawHost = flags.host?.trim() || callbackData?.host || null;

  if (!rawShop) {
    fail('Missing shop domain. Pass --shop-domain or --callback-url with ?shop=.');
  }
  if (!rawHost) {
    fail('Missing host parameter. Pass --host or --callback-url with ?host=.');
  }

  return {
    publicUrl,
    shopDomain: normalizeShopDomain(rawShop),
    host: rawHost,
  };
}

function runLinks(flags, shouldOpenBrowser) {
  const { publicUrl, shopDomain, host } = resolveLinkInputs(flags);
  const urls = buildFrontendUrls(publicUrl, shopDomain, host);

  console.log('[frontend-e2e] Frontend experience URLs (Mailgun send flow excluded)');
  for (const url of urls) {
    console.log(url);
    if (shouldOpenBrowser) {
      openExternalUrl(url);
    }
  }

  console.log('\n[frontend-e2e] Dynamic route tip');
  console.log(
    'Open /app/uploads, upload a file, then click document detail to verify /app/documents/[documentId] flow.',
  );
  console.log(
    'Approve-and-send can show MAILGUN_NOT_CONFIGURED if MAILGUN_* is empty; this is expected.',
  );
}

function runBootstrap(flags) {
  runCommand('docker', ['compose', 'up', '-d', 'postgres', 'redis'], 'Starting postgres and redis');
  runCommand('pnpm', ['install'], 'Installing dependencies');
  runCommand('pnpm', ['db:deploy'], 'Applying database migrations');

  const shouldStartDev = toBooleanFlag(flags['start-dev'], false);
  if (shouldStartDev) {
    runCommand('pnpm', ['dev'], 'Starting web/api/worker in dev mode');
  } else {
    console.log('\n[frontend-e2e] Next step');
    console.log('Run `pnpm dev` in a dedicated terminal and keep it running.');
  }
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'bootstrap') {
    runBootstrap(flags);
    return;
  }

  if (command === 'prep') {
    await runPrep(flags);
    return;
  }

  if (command === 'links') {
    runLinks(flags, false);
    return;
  }

  if (command === 'open') {
    runLinks(flags, true);
    return;
  }

  fail(`Unknown command: ${command}`);
}

await main();
