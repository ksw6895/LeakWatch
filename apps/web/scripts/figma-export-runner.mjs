#!/usr/bin/env node

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium, firefox } from '@playwright/test';
import * as ts from 'typescript';

const DEFAULT_CAPTURE_STYLE = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}
html {
  scroll-behavior: auto !important;
}
`;

const DEFAULT_CONFIG = {
  outputDir: 'figma-export',
  baseUrl: 'http://127.0.0.1:3000',
  browserName: 'chromium',
  webServerCommand: 'pnpm --filter @leakwatch/web dev',
  includeRoutes: [],
  excludeRoutes: ['/'],
  viewports: [
    { id: 'desktop-1440x900', width: 1440, height: 900, deviceScaleFactor: 1 },
    { id: 'mobile-390x844', width: 390, height: 844, deviceScaleFactor: 2 },
  ],
  contextQuery: {
    host: 'snapshot-host',
    shop: 'demo.myshopify.com',
  },
  dynamicParamDefaults: {
    id: 'sample-id',
    shopId: 'shop-1',
    documentId: 'doc-1',
    token: 'share-token-1',
  },
  dynamicRouteParams: {
    '/app/leaks/[id]': { id: 'finding-1' },
    '/app/actions/[id]': { id: 'action-1' },
    '/app/reports/[id]': { id: 'report-1' },
    '/app/documents/[documentId]': { documentId: 'doc-1' },
    '/agency/shops/[shopId]': { shopId: 'shop-1' },
    '/reports/shared/[token]': { token: 'share-token-1' },
  },
  readySelectors: {
    '/app': '.lw-dashboard-root, .lw-page-stack',
    '/agency': '.lw-standalone-main',
    '/agency/reports': '.lw-standalone-main',
    '/agency/login': '.lw-standalone-main',
  },
  manualTargets: [],
  capture: {
    mode: 'fullPage',
    elementSelector: '',
    waitForNetworkIdleMs: 1500,
    waitAfterMs: 150,
    timeoutMs: 45000,
    style: DEFAULT_CAPTURE_STYLE,
  },
  mockApi: {
    enabled: true,
    strict: false,
  },
  storybook: {
    enabled: 'auto',
    baseUrl: 'http://127.0.0.1:6006',
  },
  failOnError: false,
};

const SCAN_IGNORE_DIRS = new Set(['.git', '.next', '.turbo', 'coverage', 'dist', 'node_modules']);

const FIXTURE_NOW = '2026-01-15T08:00:00.000Z';

function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      continue;
    }
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const equalsIndex = token.indexOf('=');
    if (equalsIndex !== -1) {
      const key = token.slice(2, equalsIndex);
      const value = token.slice(equalsIndex + 1);
      flags[key] = value;
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
      continue;
    }

    flags[key] = true;
  }

  return { flags, positional };
}

function toBooleanFlag(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

function toNumberFlag(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:]/g, '-');
}

function tokenizeCommand(commandText) {
  const matches = commandText.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
  if (!matches) {
    return [];
  }
  return matches.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token;
  });
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

function slugify(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function compactErrorMessage(message, maxLength = 220) {
  const flattened = stripAnsi(message)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 4)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (flattened.length <= maxLength) {
    return flattened;
  }

  return `${flattened.slice(0, Math.max(0, maxLength - 3))}...`;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      merged[key] = value;
      continue;
    }
    if (isPlainObject(value) && isPlainObject(base[key])) {
      merged[key] = deepMerge(base[key], value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function wildcardToRegex(pattern) {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAnyPattern(value, patterns) {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => wildcardToRegex(pattern).test(value));
}

function collectFiles(rootDir, predicate) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const queue = [rootDir];
  const files = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (SCAN_IGNORE_DIRS.has(entry.name)) {
          continue;
        }
        queue.push(fullPath);
        continue;
      }

      if (predicate(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function routeTemplateFromPageFile(filePath, appDir) {
  const relativePath = normalizePath(relative(appDir, filePath));
  const folder = relativePath.replace(/(?:^|\/)page\.(tsx|ts|jsx|js)$/u, '');
  if (folder === '') {
    return '/';
  }

  const segments = folder
    .split('/')
    .filter((segment) => segment.length > 0)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .filter((segment) => !segment.startsWith('@'));

  if (segments.length === 0) {
    return '/';
  }
  return `/${segments.join('/')}`;
}

function resolveDynamicRoute(template, config) {
  const missing = [];
  const routeSpecific = config.dynamicRouteParams?.[template] ?? {};
  const globalDefaults = config.dynamicParamDefaults ?? {};

  const resolvedPath = template.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_, key) => {
    const routeValue = routeSpecific[key];
    const globalValue = globalDefaults[key];
    const value = routeValue ?? globalValue;
    if (!value) {
      missing.push(key);
      return `[${key}]`;
    }
    return encodeURIComponent(value);
  });

  return { path: resolvedPath, missing };
}

function shouldAttachContext(routeTemplate) {
  return routeTemplate.startsWith('/app') || routeTemplate.startsWith('/agency');
}

function addContextQuery(pathname, routeTemplate, contextQuery) {
  if (!shouldAttachContext(routeTemplate)) {
    return pathname;
  }

  const queryEntries = Object.entries(contextQuery ?? {}).filter(([, value]) => Boolean(value));
  if (queryEntries.length === 0) {
    return pathname;
  }

  const url = new URL(`http://snapshot.local${pathname}`);
  for (const [key, value] of queryEntries) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

function inferReadySelector(target, config) {
  if (target.readySelector) {
    return target.readySelector;
  }
  if (target.routeTemplate && config.readySelectors?.[target.routeTemplate]) {
    return config.readySelectors[target.routeTemplate];
  }

  if (target.routeTemplate) {
    for (const [routePrefix, selector] of Object.entries(config.readySelectors ?? {})) {
      if (routePrefix.endsWith('*')) {
        const prefix = routePrefix.slice(0, -1);
        if (target.routeTemplate.startsWith(prefix)) {
          return selector;
        }
      }
    }
  }

  return '.lw-page-stack, .lw-standalone-main, .lw-embedded-layout, main, body';
}

function withBaseUrl(pathOrUrl, baseUrl) {
  try {
    const asAbsolute = new URL(pathOrUrl);
    return asAbsolute.toString();
  } catch {
    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return new URL(normalizedPath, baseUrl).toString();
  }
}

function parseStorybookEnabled(value) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === 'auto') {
    return 'auto';
  }
  return toBooleanFlag(value, true) ? 'true' : 'false';
}

async function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }

  const extension = extname(configPath).toLowerCase();
  if (extension === '.json') {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  }

  if (extension === '.mjs' || extension === '.js') {
    const moduleUrl = pathToFileURL(configPath).href;
    const loaded = await import(moduleUrl);
    return loaded.default ?? loaded.config ?? {};
  }

  if (extension === '.ts') {
    const source = readFileSync(configPath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: configPath,
    }).outputText;

    const tempPath = resolve(dirname(configPath), `.snap.config.${process.pid}.${Date.now()}.mjs`);
    writeFileSync(tempPath, transpiled);

    try {
      const loaded = await import(pathToFileURL(tempPath).href);
      return loaded.default ?? loaded.config ?? {};
    } finally {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    }
  }

  throw new Error(`Unsupported config extension: ${extension}`);
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function detectProject(rootDir) {
  const webDir = resolve(rootDir, 'apps/web');
  const appRouterDir = resolve(webDir, 'src/app');
  const pagesRouterDirA = resolve(webDir, 'src/pages');
  const pagesRouterDirB = resolve(webDir, 'pages');
  const viteConfig = resolve(webDir, 'vite.config.ts');
  const storybookConfigA = resolve(webDir, '.storybook');
  const storybookConfigB = resolve(rootDir, '.storybook');

  const storyFiles = collectFiles(rootDir, (filePath) => {
    return /\.stories\.(tsx|ts|jsx|js|mdx)$/u.test(filePath);
  });

  let kind = 'unknown';
  if (existsSync(appRouterDir)) {
    kind = 'next-app-router';
  } else if (existsSync(pagesRouterDirA) || existsSync(pagesRouterDirB)) {
    kind = 'next-pages-router';
  } else if (existsSync(viteConfig)) {
    kind = 'vite';
  }

  const storybookDetected =
    existsSync(storybookConfigA) || existsSync(storybookConfigB) || storyFiles.length > 0;

  return {
    kind,
    storybookDetected,
    storyFiles,
    appRouterDir,
  };
}

async function collectStorybookTargets(projectInfo, config, notes) {
  if (!projectInfo.storybookDetected) {
    return [];
  }

  const enabledMode = parseStorybookEnabled(config.storybook?.enabled);
  if (enabledMode === 'false') {
    notes.push('Storybook files detected but storybook capture is disabled in config.');
    return [];
  }

  const baseUrl = config.storybook?.baseUrl || 'http://127.0.0.1:6006';
  const indexJson = await fetchJson(`${baseUrl.replace(/\/$/u, '')}/index.json`, 4000);
  if (!indexJson || !indexJson.entries) {
    notes.push(
      'Storybook detected but index.json was not reachable. Falling back to route capture.',
    );
    return [];
  }

  const entries = Object.values(indexJson.entries).filter((entry) => {
    return entry && typeof entry.id === 'string' && entry.type === 'story';
  });

  const targets = entries.map((entry) => {
    const storyId = entry.id;
    const storyName = entry.title && entry.name ? `${entry.title} ${entry.name}` : storyId;
    const id = slugify(`story-${storyId}`);
    return {
      id,
      name: storyName,
      sourceType: 'storybook',
      storyId,
      routeTemplate: null,
      routePath: null,
      url: `${baseUrl.replace(/\/$/u, '')}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`,
      captureMode: config.capture?.mode || 'fullPage',
      elementSelector: config.capture?.elementSelector || '',
      readySelector: inferReadySelector({ readySelector: null, routeTemplate: null }, config),
      skipReason: null,
    };
  });

  notes.push(`Storybook capture selected with ${targets.length} stories.`);
  return targets;
}

function collectRouteTargets(projectInfo, config, notes) {
  if (projectInfo.kind !== 'next-app-router') {
    notes.push(
      `Route auto-collection currently supports Next App Router only. Detected: ${projectInfo.kind}`,
    );
    return [];
  }

  const pageFiles = collectFiles(projectInfo.appRouterDir, (filePath) => {
    return /\/page\.(tsx|ts|jsx|js)$/u.test(filePath);
  });

  const templates = Array.from(
    new Set(
      pageFiles.map((filePath) => routeTemplateFromPageFile(filePath, projectInfo.appRouterDir)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const includePatterns = config.includeRoutes || [];
  const excludePatterns = config.excludeRoutes || [];

  const targets = [];
  for (const template of templates) {
    if (includePatterns.length > 0 && !matchesAnyPattern(template, includePatterns)) {
      continue;
    }
    if (matchesAnyPattern(template, excludePatterns)) {
      continue;
    }

    const resolved = resolveDynamicRoute(template, config);
    const routePath = addContextQuery(resolved.path, template, config.contextQuery || {});
    const idBase =
      template === '/'
        ? 'home'
        : template
            .slice(1)
            .replace(/\//g, '-')
            .replace(/[\[\]]/g, '');

    targets.push({
      id: slugify(idBase),
      name: template,
      sourceType: 'next-route',
      storyId: null,
      routeTemplate: template,
      routePath,
      url: withBaseUrl(routePath, config.baseUrl),
      captureMode: config.capture?.mode || 'fullPage',
      elementSelector: config.capture?.elementSelector || '',
      readySelector: inferReadySelector({ readySelector: null, routeTemplate: template }, config),
      skipReason:
        resolved.missing.length > 0
          ? `Missing dynamic params: ${resolved.missing.join(', ')}`
          : null,
    });
  }

  notes.push(`Collected ${targets.length} route targets from App Router pages.`);
  return targets;
}

function collectManualTargets(config, notes) {
  const manualTargets = Array.isArray(config.manualTargets) ? config.manualTargets : [];
  if (manualTargets.length === 0) {
    return [];
  }

  const targets = [];
  for (const manualTarget of manualTargets) {
    const id = slugify(
      manualTarget.id ||
        manualTarget.name ||
        manualTarget.path ||
        manualTarget.url ||
        'manual-target',
    );
    const routePath = manualTarget.path || null;
    const baseTargetUrl =
      manualTarget.url || (routePath ? withBaseUrl(routePath, config.baseUrl) : null);
    if (!baseTargetUrl) {
      targets.push({
        id,
        name: manualTarget.name || id,
        sourceType: 'manual',
        storyId: null,
        routeTemplate: null,
        routePath,
        url: '',
        captureMode: manualTarget.captureMode || config.capture?.mode || 'fullPage',
        elementSelector: manualTarget.elementSelector || config.capture?.elementSelector || '',
        readySelector:
          manualTarget.readySelector || inferReadySelector({ routeTemplate: null }, config),
        skipReason: 'Manual target is missing both path and url.',
      });
      continue;
    }

    const url = new URL(baseTargetUrl);
    if (manualTarget.query) {
      for (const [key, value] of Object.entries(manualTarget.query)) {
        url.searchParams.set(key, value);
      }
    }

    targets.push({
      id,
      name: manualTarget.name || routePath || baseTargetUrl,
      sourceType: 'manual',
      storyId: null,
      routeTemplate: null,
      routePath,
      url: url.toString(),
      captureMode: manualTarget.captureMode || config.capture?.mode || 'fullPage',
      elementSelector: manualTarget.elementSelector || config.capture?.elementSelector || '',
      readySelector:
        manualTarget.readySelector || inferReadySelector({ routeTemplate: null }, config),
      skipReason: null,
    });
  }

  notes.push(`Loaded ${targets.length} manual override targets from config.`);
  return targets;
}

function ensureUniqueTargetIds(targets) {
  const counters = new Map();
  return targets.map((target) => {
    const baseId = slugify(target.id || target.name || 'target');
    const current = counters.get(baseId) ?? 0;
    counters.set(baseId, current + 1);

    if (current === 0) {
      return { ...target, id: baseId };
    }
    return { ...target, id: `${baseId}-${current + 1}` };
  });
}

function makeFindings() {
  return [
    {
      id: 'finding-1',
      type: 'DUPLICATE_CHARGE',
      status: 'OPEN',
      title: 'Duplicate Mailgun charge detected',
      summary: 'Two invoices show overlapping usage windows for the same SKU.',
      confidence: 92,
      estimatedSavingsAmount: '180',
      currency: 'USD',
      createdAt: FIXTURE_NOW,
    },
    {
      id: 'finding-2',
      type: 'UNUSED_LICENSE',
      status: 'REOPENED',
      title: 'Unused seats in analytics app',
      summary: 'Provisioned seats exceed active user count for 3 consecutive months.',
      confidence: 79,
      estimatedSavingsAmount: '64',
      currency: 'USD',
      createdAt: FIXTURE_NOW,
    },
  ];
}

function makeFindingDetail(id) {
  const findings = makeFindings();
  const baseFinding = findings.find((item) => item.id === id) ?? findings[0];
  return {
    ...baseFinding,
    evidence: [
      {
        id: 'ev-1',
        kind: 'invoice_line',
        excerpt: 'Duplicate billing period 2025-12-01 to 2025-12-31',
        pointerJson: { row: 8, column: 'line_item' },
        documentVersionId: 'ver-2',
        documentId: 'doc-1',
        documentVersionNumber: 2,
      },
    ],
  };
}

function makeActionDetail(id) {
  return {
    id,
    status: 'DRAFT',
    displayStatus: 'DRAFT',
    latestRunStatus: null,
    type: 'CLARIFICATION',
    toEmail: 'vendor@example.com',
    ccEmails: ['finance@example.com'],
    subject: 'Invoice clarification request',
    bodyMarkdown: 'Please confirm why this billing window was duplicated.',
    attachmentKey: 'org/org-1/shop/shop-1/evidence-pack/action-1.zip',
    finding: {
      id: 'finding-1',
      title: 'Duplicate Mailgun charge detected',
      summary: 'Overlapping line items appear on two invoices.',
      estimatedSavingsAmount: '180',
      currency: 'USD',
    },
    runs: [
      {
        id: 'run-1',
        status: 'QUEUED',
        mailgunMessageId: null,
        lastError: null,
        createdAt: FIXTURE_NOW,
        mailEvents: [],
      },
    ],
  };
}

function makeReports() {
  return [
    {
      id: 'report-1',
      period: 'MONTHLY',
      periodStart: '2025-12-01T00:00:00.000Z',
      periodEnd: '2025-12-31T23:59:59.000Z',
      createdAt: FIXTURE_NOW,
      summaryJson: {
        totalSpend: '3200',
        prevTotalSpend: '2950',
        deltaVsPrev: 250,
        topFindings: makeFindings().slice(0, 2),
      },
    },
    {
      id: 'report-2',
      period: 'WEEKLY',
      periodStart: '2025-12-08T00:00:00.000Z',
      periodEnd: '2025-12-14T23:59:59.000Z',
      createdAt: FIXTURE_NOW,
      summaryJson: {
        totalSpend: '870',
        prevTotalSpend: '920',
        deltaVsPrev: -50,
        topFindings: makeFindings().slice(0, 1),
      },
    },
  ];
}

function makeReportDetail(reportId) {
  const reports = makeReports();
  return reports.find((item) => item.id === reportId) ?? reports[0];
}

function makeDocuments() {
  return [
    {
      id: 'doc-1',
      vendorHint: 'Mailgun',
      createdAt: FIXTURE_NOW,
      versions: [
        {
          id: 'ver-2',
          version: 2,
          fileName: 'mailgun-december.pdf',
          mimeType: 'application/pdf',
          byteSize: 180432,
          status: 'DETECTED',
          errorCode: null,
          errorMessage: null,
          createdAt: FIXTURE_NOW,
          updatedAt: FIXTURE_NOW,
        },
      ],
    },
  ];
}

function makeDocumentDetail(documentId) {
  return {
    id: documentId,
    vendorHint: 'Mailgun',
    createdAt: FIXTURE_NOW,
    versions: [
      {
        id: 'ver-2',
        version: 2,
        fileName: 'mailgun-december.pdf',
        mimeType: 'application/pdf',
        byteSize: 180432,
        status: 'DETECTED',
        errorCode: null,
        errorMessage: null,
        createdAt: FIXTURE_NOW,
        updatedAt: FIXTURE_NOW,
        normalized: {
          id: 'norm-2',
          currency: 'USD',
          invoiceNumber: 'INV-2025-12-001',
          invoiceDate: '2025-12-31T00:00:00.000Z',
          billingPeriodStart: '2025-12-01T00:00:00.000Z',
          billingPeriodEnd: '2025-12-31T23:59:59.000Z',
          totalAmount: '3200',
          rawJson: {
            vendor: 'Mailgun',
            seats: 35,
            usage: 'messages',
          },
          lineItems: [
            {
              id: 'line-1',
              description: 'Primary subscription',
              amount: '3000',
              currency: 'USD',
              itemType: 'SUBSCRIPTION',
              recurringCadence: 'MONTHLY',
              periodStart: '2025-12-01T00:00:00.000Z',
              periodEnd: '2025-12-31T23:59:59.000Z',
            },
            {
              id: 'line-2',
              description: 'Overage',
              amount: '200',
              currency: 'USD',
              itemType: 'USAGE',
              recurringCadence: null,
              periodStart: null,
              periodEnd: null,
            },
          ],
        },
      },
      {
        id: 'ver-1',
        version: 1,
        fileName: 'mailgun-november.pdf',
        mimeType: 'application/pdf',
        byteSize: 174201,
        status: 'NORMALIZATION_FAILED',
        errorCode: 'NORMALIZATION_TIMEOUT',
        errorMessage: 'Normalization timed out while parsing table rows.',
        createdAt: '2025-11-30T08:00:00.000Z',
        updatedAt: '2025-11-30T08:02:10.000Z',
        normalized: null,
      },
    ],
  };
}

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function resolveMockApiResponse(method, pathname, searchParams, unknownApiPaths, strictMock) {
  const findings = makeFindings();

  if (method === 'GET' && pathname === '/v1/health') {
    return jsonResponse(200, { ok: true });
  }

  if (method === 'POST' && pathname === '/v1/events') {
    return {
      status: 204,
      headers: {},
      body: '',
    };
  }

  if (method === 'GET' && pathname === '/v1/auth/me') {
    return jsonResponse(200, {
      orgId: 'org-1',
      shopId: 'shop-1',
      userId: 'user-1',
      roles: ['OWNER', 'MEMBER', 'AGENCY_ADMIN', 'AGENCY_VIEWER'],
      shopDomain: 'demo.myshopify.com',
    });
  }

  if (method === 'GET' && pathname === '/v1/shops') {
    return jsonResponse(200, [
      { id: 'shop-1', shopifyDomain: 'demo.myshopify.com', displayName: 'Demo Shop' },
      { id: 'shop-2', shopifyDomain: 'sandbox.myshopify.com', displayName: 'Sandbox Shop' },
    ]);
  }

  const orgShopsMatch = pathname.match(/^\/v1\/orgs\/[^/]+\/shops$/u);
  if (method === 'GET' && orgShopsMatch) {
    return jsonResponse(200, [
      { id: 'shop-1', shopifyDomain: 'demo.myshopify.com', displayName: 'Demo Shop' },
      { id: 'shop-2', shopifyDomain: 'sandbox.myshopify.com', displayName: 'Sandbox Shop' },
    ]);
  }

  const orgSummaryMatch = pathname.match(/^\/v1\/orgs\/[^/]+\/summary$/u);
  if (method === 'GET' && orgSummaryMatch) {
    return jsonResponse(200, {
      shopsCount: 2,
      totalSpend: '4200',
      potentialSavings: '244',
      topFindingsAcrossShops: [
        {
          id: 'finding-1',
          shopId: 'shop-1',
          title: 'Duplicate Mailgun charge detected',
          estimatedSavingsAmount: '180',
          currency: 'USD',
        },
      ],
    });
  }

  const shopSummaryMatch = pathname.match(/^\/v1\/shops\/([^/]+)\/summary$/u);
  if (method === 'GET' && shopSummaryMatch) {
    return jsonResponse(200, {
      thisMonthSpend: '1200',
      potentialSavings: '244',
      openActions: 3,
      currency: 'USD',
    });
  }

  const shopFindingsMatch = pathname.match(/^\/v1\/shops\/([^/]+)\/findings$/u);
  if (method === 'GET' && shopFindingsMatch) {
    return jsonResponse(200, findings);
  }

  const findingsDetailMatch = pathname.match(/^\/v1\/findings\/([^/]+)$/u);
  if (method === 'GET' && findingsDetailMatch) {
    return jsonResponse(200, makeFindingDetail(findingsDetailMatch[1]));
  }

  const findingsDismissMatch = pathname.match(/^\/v1\/findings\/([^/]+)\/dismiss$/u);
  if (method === 'POST' && findingsDismissMatch) {
    const detail = makeFindingDetail(findingsDismissMatch[1]);
    return jsonResponse(200, { ...detail, status: 'DISMISSED' });
  }

  const findingsActionsMatch = pathname.match(/^\/v1\/findings\/([^/]+)\/actions$/u);
  if (method === 'POST' && findingsActionsMatch) {
    return jsonResponse(201, { id: 'action-1' });
  }

  if (method === 'GET' && pathname === '/v1/action-requests') {
    const requestedShopId = searchParams.get('shopId') || 'shop-1';
    return jsonResponse(200, [
      {
        id: 'action-1',
        status: 'DRAFT',
        displayStatus: 'DRAFT',
        latestRunStatus: null,
        type: 'CLARIFICATION',
        toEmail: 'vendor@example.com',
        subject: 'Clarify duplicate billing line item',
        createdAt: FIXTURE_NOW,
        finding: {
          id: 'finding-1',
          title: `Duplicate charge (${requestedShopId})`,
          estimatedSavingsAmount: '180',
          currency: 'USD',
        },
      },
    ]);
  }

  if (method === 'GET' && pathname === '/v1/action-requests/inbound-parse/metrics') {
    return jsonResponse(200, {
      windowDays: Number.parseInt(searchParams.get('windowDays') || '30', 10),
      inboundReplyEvents: 42,
      labeledFeedback: 21,
      labels: {
        TRUE_POSITIVE: 12,
        FALSE_POSITIVE: 2,
        TRUE_NEGATIVE: 6,
        FALSE_NEGATIVE: 1,
        UNLABELED: 21,
      },
      correctionRate: 0.18,
      falsePositiveRate: 0.09,
      falseNegativeRate: 0.05,
    });
  }

  const actionDetailMatch = pathname.match(/^\/v1\/action-requests\/([^/]+)$/u);
  if (method === 'GET' && actionDetailMatch) {
    return jsonResponse(200, makeActionDetail(actionDetailMatch[1]));
  }

  if (method === 'PATCH' && actionDetailMatch) {
    return jsonResponse(200, makeActionDetail(actionDetailMatch[1]));
  }

  const actionApproveMatch = pathname.match(/^\/v1\/action-requests\/([^/]+)\/approve$/u);
  if (method === 'POST' && actionApproveMatch) {
    return jsonResponse(200, { ok: true });
  }

  const actionStatusMatch = pathname.match(/^\/v1\/action-requests\/([^/]+)\/status$/u);
  if (method === 'POST' && actionStatusMatch) {
    return jsonResponse(200, { ok: true });
  }

  const evidenceDownloadMatch = pathname.match(/^\/v1\/evidence-packs\/([^/]+)\/download$/u);
  if (method === 'GET' && evidenceDownloadMatch) {
    return jsonResponse(200, { downloadUrl: 'https://example.com/evidence-pack.zip' });
  }

  if (method === 'GET' && pathname === '/v1/reports') {
    return jsonResponse(200, makeReports());
  }

  if (method === 'POST' && pathname === '/v1/reports/generate') {
    return jsonResponse(201, { id: 'report-3' });
  }

  const reportDetailMatch = pathname.match(/^\/v1\/reports\/([^/]+)$/u);
  if (method === 'GET' && reportDetailMatch) {
    return jsonResponse(200, makeReportDetail(reportDetailMatch[1]));
  }

  const reportShareCreateMatch = pathname.match(/^\/v1\/reports\/([^/]+)\/share-link$/u);
  if (method === 'POST' && reportShareCreateMatch) {
    return jsonResponse(200, { shareUrl: 'https://example.com/reports/shared/share-token-1' });
  }

  const reportShareRevokeMatch = pathname.match(/^\/v1\/reports\/([^/]+)\/share-link\/revoke$/u);
  if (method === 'POST' && reportShareRevokeMatch) {
    return jsonResponse(200, { ok: true });
  }

  const reportExportMatch = pathname.match(/^\/v1\/reports\/([^/]+)\/export$/u);
  if (method === 'GET' && reportExportMatch) {
    const format = searchParams.get('format') || 'csv';
    const extension = format.toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    const contentType = extension === 'pdf' ? 'application/pdf' : 'text/csv';
    const content = extension === 'pdf' ? 'JVBERi0xLjQKJQ==' : 'period,totalSpend\nMONTHLY,3200\n';
    return jsonResponse(200, {
      fileName: `report-${reportExportMatch[1]}.${extension}`,
      contentType,
      content,
    });
  }

  const sharedReportDetailMatch = pathname.match(/^\/v1\/reports\/shared\/([^/]+)$/u);
  if (method === 'GET' && sharedReportDetailMatch) {
    return jsonResponse(200, {
      id: 'report-1',
      period: 'MONTHLY',
      periodStart: '2025-12-01T00:00:00.000Z',
      periodEnd: '2025-12-31T23:59:59.000Z',
      createdAt: FIXTURE_NOW,
      summaryJson: {
        totalSpend: '3200',
        deltaVsPrev: 250,
      },
    });
  }

  const sharedReportExportMatch = pathname.match(/^\/v1\/reports\/shared\/([^/]+)\/export$/u);
  if (method === 'GET' && sharedReportExportMatch) {
    const format = searchParams.get('format') || 'csv';
    const extension = format.toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    const contentType = extension === 'pdf' ? 'application/pdf' : 'text/csv';
    const content = extension === 'pdf' ? 'JVBERi0xLjQKJQ==' : 'period,totalSpend\nMONTHLY,3200\n';
    return jsonResponse(200, {
      fileName: `shared-report.${extension}`,
      contentType,
      content,
    });
  }

  if (method === 'GET' && pathname === '/v1/billing/current') {
    return jsonResponse(200, {
      plan: 'STARTER',
      planStatus: 'ACTIVE',
      limits: {
        uploads: 50,
        emails: 200,
        findings: 200,
        reports: 30,
      },
      usage: {
        uploads: 8,
        emails: 54,
        reports: 6,
      },
    });
  }

  if (method === 'POST' && pathname === '/v1/billing/subscribe') {
    return jsonResponse(200, { confirmationUrl: null });
  }

  if (method === 'GET' && pathname === '/v1/documents') {
    return jsonResponse(200, makeDocuments());
  }

  const createDocumentMatch = pathname.match(/^\/v1\/shops\/([^/]+)\/documents$/u);
  if (method === 'POST' && createDocumentMatch) {
    return jsonResponse(201, {
      documentId: 'doc-1',
      versionId: 'ver-2',
      uploadUrl: 'https://example.com/presigned-upload',
    });
  }

  const completeDocumentMatch = pathname.match(
    /^\/v1\/documents\/([^/]+)\/versions\/([^/]+)\/complete$/u,
  );
  if (method === 'POST' && completeDocumentMatch) {
    return jsonResponse(200, { ok: true });
  }

  const documentDetailMatch = pathname.match(/^\/v1\/documents\/([^/]+)$/u);
  if (method === 'GET' && documentDetailMatch) {
    return jsonResponse(200, makeDocumentDetail(documentDetailMatch[1]));
  }

  const documentDownloadMatch = pathname.match(
    /^\/v1\/documents\/([^/]+)\/versions\/([^/]+)\/download$/u,
  );
  if (method === 'GET' && documentDownloadMatch) {
    return jsonResponse(200, {
      downloadUrl: 'https://example.com/document-version.pdf',
    });
  }

  const settingsMatch = pathname.match(/^\/v1\/shops\/([^/]+)\/settings$/u);
  if (method === 'GET' && settingsMatch) {
    return jsonResponse(200, {
      currency: 'USD',
      timezone: 'UTC',
      contactEmail: 'ops@example.com',
    });
  }

  if (method === 'PATCH' && settingsMatch) {
    return jsonResponse(200, {
      currency: 'USD',
      timezone: 'UTC',
      contactEmail: 'ops@example.com',
    });
  }

  const key = `${method} ${pathname}`;
  unknownApiPaths.add(key);

  if (strictMock) {
    return jsonResponse(500, {
      message: `Missing API mock for ${key}`,
    });
  }

  return jsonResponse(404, {
    message: `No snapshot mock registered for ${key}`,
  });
}

async function attachApiMocking(page, strictMock) {
  const unknownApiPaths = new Set();

  const routeHandler = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const response = resolveMockApiResponse(
      request.method(),
      url.pathname,
      url.searchParams,
      unknownApiPaths,
      strictMock,
    );

    await route.fulfill(response);
  };

  await page.route('**/v1/**', routeHandler);

  return {
    unknownApiPaths,
    dispose: async () => {
      await page.unroute('**/v1/**', routeHandler);
    },
  };
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function waitForServer(baseUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseUrl, { method: 'GET' });
      if (response.status < 500) {
        return true;
      }
    } catch {
      // ignore and retry
    }
    await sleep(400);
  }
  return false;
}

function startProcess(command, cwd, env, verbose, label) {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    throw new Error(`Invalid command: ${command}`);
  }

  const [executable, ...args] = tokens;

  const child = spawn(executable, args, {
    cwd,
    env,
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];

  const appendLogs = (streamName, chunk) => {
    const text = chunk.toString();
    const normalized = text.trim();
    if (normalized.length > 0) {
      logs.push(`[${streamName}] ${normalized}`);
      if (logs.length > 80) {
        logs.shift();
      }
    }
    if (verbose) {
      process.stdout.write(`[${label}] ${text}`);
    }
  };

  child.stdout?.on('data', (chunk) => appendLogs('stdout', chunk));
  child.stderr?.on('data', (chunk) => appendLogs('stderr', chunk));

  return {
    child,
    getLogs: () => logs.join('\n'),
  };
}

async function runCommand(command, cwd, verbose, label) {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    return {
      code: 1,
      logs: `Invalid command: ${command}`,
    };
  }
  const [executable, ...args] = tokens;

  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logs = [];
    const append = (streamName, chunk) => {
      const text = chunk.toString();
      const normalized = text.trim();
      if (normalized.length > 0) {
        logs.push(`[${streamName}] ${normalized}`);
        if (logs.length > 120) {
          logs.shift();
        }
      }

      if (verbose) {
        process.stdout.write(`[${label}] ${text}`);
      }
    };

    child.stdout?.on('data', (chunk) => append('stdout', chunk));
    child.stderr?.on('data', (chunk) => append('stderr', chunk));

    child.on('exit', (code) => {
      resolvePromise({
        code: code ?? 1,
        logs: logs.join('\n'),
      });
    });
  });
}

async function launchChromium(rootDir, verbose) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = formatError(error);
    const missingExecutable =
      message.includes("Executable doesn't exist") ||
      message.includes('Please run the following command');

    if (!missingExecutable) {
      throw error;
    }

    console.log('[figma-export] Chromium browser binary not found. Installing once...');
    const installResult = await runCommand(
      'pnpm --filter @leakwatch/web exec playwright install chromium',
      rootDir,
      true,
      'figma-browser-install',
    );

    if (installResult.code !== 0) {
      throw new Error(
        `Failed to install Playwright Chromium.\n${installResult.logs || 'No installer logs captured.'}`,
      );
    }

    return chromium.launch({ headless: true });
  }
}

async function launchFirefox(rootDir, verbose) {
  try {
    return await firefox.launch({ headless: true });
  } catch (error) {
    const message = formatError(error);
    const missingExecutable =
      message.includes("Executable doesn't exist") ||
      message.includes('Please run the following command');

    if (!missingExecutable) {
      throw error;
    }

    console.log('[figma-export] Firefox browser binary not found. Installing once...');
    const installResult = await runCommand(
      'pnpm --filter @leakwatch/web exec playwright install firefox',
      rootDir,
      true,
      'figma-browser-install',
    );

    if (installResult.code !== 0) {
      throw new Error(
        `Failed to install Playwright Firefox.\n${installResult.logs || 'No installer logs captured.'}`,
      );
    }

    return firefox.launch({ headless: true });
  }
}

async function launchBrowser(preferredBrowser, rootDir, verbose, notes) {
  if (preferredBrowser === 'firefox') {
    const browser = await launchFirefox(rootDir, verbose);
    notes.push('Browser: firefox (configured)');
    return {
      browser,
      browserName: 'firefox',
    };
  }

  try {
    const browser = await launchChromium(rootDir, verbose);
    notes.push('Browser: chromium');
    return {
      browser,
      browserName: 'chromium',
    };
  } catch (chromiumError) {
    const chromiumMessage = formatError(chromiumError);
    const sharedLibIssue = chromiumMessage.includes('error while loading shared libraries');
    const dependencyIssue =
      chromiumMessage.includes('libnspr4.so') || chromiumMessage.includes('with-deps');

    if (!sharedLibIssue && !dependencyIssue) {
      throw chromiumError;
    }

    notes.push(`Chromium launch failed. Falling back to firefox.`);
    notes.push(`Chromium fallback reason: ${compactErrorMessage(chromiumMessage)}`);
    const browser = await launchFirefox(rootDir, verbose);
    notes.push('Browser: firefox (fallback)');
    return {
      browser,
      browserName: 'firefox',
    };
  }
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform !== 'win32' && typeof child.pid === 'number') {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  } else {
    child.kill('SIGTERM');
  }

  await Promise.race([
    new Promise((resolvePromise) => {
      child.on('exit', () => resolvePromise());
    }),
    sleep(4000),
  ]);

  if (child.exitCode === null) {
    if (process.platform !== 'win32' && typeof child.pid === 'number') {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    } else {
      child.kill('SIGKILL');
    }
    await Promise.race([
      new Promise((resolvePromise) => {
        child.once('exit', () => resolvePromise());
      }),
      sleep(2000),
    ]);
  }
}

async function captureOne(page, target, viewport, config, outputDir) {
  const startedAt = Date.now();
  const captureMode = target.captureMode || config.capture.mode || 'fullPage';
  const captureTimeoutMs = config.capture.timeoutMs;
  const networkIdleMs = config.capture.waitForNetworkIdleMs;
  const waitAfterMs = config.capture.waitAfterMs;
  const style = config.capture.style || DEFAULT_CAPTURE_STYLE;
  const readySelector = target.readySelector || '.lw-page-stack, .lw-standalone-main, body';

  if (target.skipReason) {
    return {
      status: 'skipped',
      reason: target.skipReason,
      filepath: null,
      width: viewport.width,
      height: viewport.height,
      durationMs: Date.now() - startedAt,
      warnings: [],
    };
  }

  const apiMonitor = config.mockApi.enabled
    ? await attachApiMocking(page, config.mockApi.strict)
    : { unknownApiPaths: new Set(), dispose: async () => undefined };

  try {
    let lastGotoError = null;
    const waitUntilSequence = ['domcontentloaded', 'commit'];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      for (const waitUntil of waitUntilSequence) {
        try {
          await page.goto(target.url, {
            waitUntil,
            timeout: captureTimeoutMs,
          });
          lastGotoError = null;
          break;
        } catch (error) {
          lastGotoError = error;
        }
      }

      if (!lastGotoError) {
        break;
      }
      await page.waitForTimeout(300);
    }

    if (lastGotoError) {
      throw lastGotoError;
    }

    if (networkIdleMs > 0) {
      await page.waitForLoadState('networkidle', { timeout: networkIdleMs }).catch(() => undefined);
    }

    const readinessWarnings = [];
    await page
      .waitForSelector(readySelector, {
        timeout: captureTimeoutMs,
        state: 'attached',
      })
      .catch(() => {
        readinessWarnings.push(`Ready selector timeout: ${readySelector}`);
      });

    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });

    if (waitAfterMs > 0) {
      await page.waitForTimeout(waitAfterMs);
    }

    const screenDir = resolve(outputDir, 'png', target.id);
    ensureDirectory(screenDir);
    const filePath = resolve(screenDir, `${viewport.id}.png`);

    if (captureMode === 'element') {
      const selector = target.elementSelector || config.capture.elementSelector;
      if (!selector) {
        return {
          status: 'skipped',
          reason: 'Element capture mode requires element selector.',
          filepath: null,
          width: viewport.width,
          height: viewport.height,
          durationMs: Date.now() - startedAt,
          warnings: [
            ...readinessWarnings,
            ...Array.from(apiMonitor.unknownApiPaths).sort((left, right) =>
              left.localeCompare(right),
            ),
          ],
        };
      }

      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: captureTimeoutMs });

      const box = await locator.boundingBox();
      await locator.screenshot({
        path: filePath,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        style,
      });

      return {
        status: 'captured',
        reason: null,
        filepath: filePath,
        width: box ? Math.round(box.width) : viewport.width,
        height: box ? Math.round(box.height) : viewport.height,
        durationMs: Date.now() - startedAt,
        warnings: [
          ...readinessWarnings,
          ...Array.from(apiMonitor.unknownApiPaths).sort((left, right) =>
            left.localeCompare(right),
          ),
        ],
      };
    }

    await page.screenshot({
      path: filePath,
      fullPage: captureMode === 'fullPage',
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      style,
    });

    const measured = await page.evaluate(() => {
      const documentElement = document.documentElement;
      const body = document.body;
      const width = Math.max(
        window.innerWidth,
        documentElement?.scrollWidth ?? 0,
        body?.scrollWidth ?? 0,
      );
      const height = Math.max(
        window.innerHeight,
        documentElement?.scrollHeight ?? 0,
        body?.scrollHeight ?? 0,
      );
      return {
        width,
        height,
      };
    });

    return {
      status: 'captured',
      reason: null,
      filepath: filePath,
      width: captureMode === 'fullPage' ? measured.width : viewport.width,
      height: captureMode === 'fullPage' ? measured.height : viewport.height,
      durationMs: Date.now() - startedAt,
      warnings: [
        ...readinessWarnings,
        ...Array.from(apiMonitor.unknownApiPaths).sort((left, right) => left.localeCompare(right)),
      ],
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: formatError(error),
      filepath: null,
      width: viewport.width,
      height: viewport.height,
      durationMs: Date.now() - startedAt,
      warnings: Array.from(apiMonitor.unknownApiPaths).sort((left, right) =>
        left.localeCompare(right),
      ),
    };
  } finally {
    await apiMonitor.dispose();
  }
}

function toRelativePath(rootDir, absolutePath) {
  if (!absolutePath) {
    return null;
  }
  return normalizePath(relative(rootDir, absolutePath));
}

function createReport(manifest, outputDirRelative) {
  const lines = [];
  lines.push('# Figma Export Report');
  lines.push('');
  lines.push(`- Run ID: ${manifest.runId}`);
  lines.push(`- Generated At: ${manifest.generatedAt}`);
  lines.push(`- Duration: ${manifest.durationMs}ms`);
  lines.push(`- Project Type: ${manifest.project.type}`);
  lines.push(`- Capture Source: ${manifest.project.captureSource}`);
  lines.push(`- Captured: ${manifest.summary.captured}`);
  lines.push(`- Failed: ${manifest.summary.failed}`);
  lines.push(`- Skipped: ${manifest.summary.skipped}`);
  lines.push(`- Output Dir: ${outputDirRelative}`);
  lines.push('');

  if (manifest.notes.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const note of manifest.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  const capturedItems = manifest.entries.filter((entry) => entry.status === 'captured');
  if (capturedItems.length > 0) {
    lines.push('## Captured');
    lines.push('');
    lines.push('| Name | Viewport | Size | File |');
    lines.push('| --- | --- | --- | --- |');
    for (const item of capturedItems) {
      lines.push(
        `| ${item.name} | ${item.viewport} | ${item.width}x${item.height} | ${item.filepath} |`,
      );
    }
    lines.push('');
  }

  const failedItems = manifest.entries.filter((entry) => entry.status === 'failed');
  if (failedItems.length > 0) {
    lines.push('## Failed');
    lines.push('');
    lines.push('| Name | Viewport | Reason |');
    lines.push('| --- | --- | --- |');
    for (const item of failedItems) {
      lines.push(`| ${item.name} | ${item.viewport} | ${item.reason || 'Unknown error'} |`);
    }
    lines.push('');
  }

  const skippedItems = manifest.entries.filter((entry) => entry.status === 'skipped');
  if (skippedItems.length > 0) {
    lines.push('## Skipped');
    lines.push('');
    lines.push('| Name | Viewport | Reason |');
    lines.push('| --- | --- | --- |');
    for (const item of skippedItems) {
      lines.push(`| ${item.name} | ${item.viewport} | ${item.reason || 'Skipped'} |`);
    }
    lines.push('');
  }

  const warningItems = manifest.entries.filter((entry) => entry.warnings.length > 0);
  if (warningItems.length > 0) {
    lines.push('## API Mock Gaps');
    lines.push('');
    for (const item of warningItems) {
      lines.push(`### ${item.name} / ${item.viewport}`);
      lines.push('');
      for (const warning of item.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const inferredRootDir = resolve(scriptDir, '..', '..', '..');
  const rootDir = resolve(flags['root-dir'] ? String(flags['root-dir']) : inferredRootDir);

  const configPath = resolve(rootDir, String(flags.config || 'snap.config.ts'));
  const userConfig = await loadConfig(configPath);
  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  const dryRun = toBooleanFlag(flags['dry-run'], false);
  const verbose = toBooleanFlag(flags.verbose, false);
  const noServer = toBooleanFlag(flags['no-server'], false);
  const keepOutput = toBooleanFlag(flags['keep-output'], false);
  const maxTargets = toNumberFlag(flags['max-targets'], null);

  if (flags['base-url']) {
    config.baseUrl = String(flags['base-url']);
  }
  if (flags['browser']) {
    config.browserName = String(flags.browser).toLowerCase();
  }
  if (flags['output-dir']) {
    config.outputDir = String(flags['output-dir']);
  }
  if (flags['strict-mock'] !== undefined) {
    config.mockApi.strict = toBooleanFlag(flags['strict-mock'], true);
  }
  if (flags['mock-api'] !== undefined) {
    config.mockApi.enabled = toBooleanFlag(flags['mock-api'], true);
  }
  if (flags['fail-on-error'] !== undefined) {
    config.failOnError = toBooleanFlag(flags['fail-on-error'], true);
  }

  const outputDir = resolve(rootDir, config.outputDir);
  if (!outputDir.startsWith(rootDir)) {
    throw new Error(`Output directory must be inside repository root: ${outputDir}`);
  }

  if (!keepOutput) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  ensureDirectory(outputDir);
  ensureDirectory(resolve(outputDir, 'png'));

  const startedAt = Date.now();
  const notes = [];

  const projectInfo = detectProject(rootDir);
  notes.push(`Detected project mode: ${projectInfo.kind}`);
  notes.push(`Storybook detected: ${projectInfo.storybookDetected ? 'yes' : 'no'}`);

  let targets = await collectStorybookTargets(projectInfo, config, notes);
  let captureSource = 'storybook';
  if (targets.length === 0) {
    captureSource = 'routes';
    targets = collectRouteTargets(projectInfo, config, notes);
  }

  const manualTargets = collectManualTargets(config, notes);
  const allTargets = ensureUniqueTargetIds([...targets, ...manualTargets]);

  if (maxTargets !== null) {
    notes.push(`max-targets flag applied: ${maxTargets}`);
  }

  const scopedTargets =
    maxTargets === null ? allTargets : allTargets.slice(0, Math.max(0, maxTargets));
  if (scopedTargets.length === 0) {
    notes.push('No capture targets resolved.');
  }

  let webServerHandle = null;
  let browser = null;
  let browserUsed = null;

  try {
    const needsWebServer = captureSource !== 'storybook';
    if (!dryRun && needsWebServer) {
      const ready = await waitForServer(config.baseUrl, 2500);
      if (!ready && !noServer) {
        const serverEnv = {
          ...process.env,
          SNAPSHOT_MODE: '1',
          NEXT_PUBLIC_SHOPIFY_API_KEY: '',
        };

        webServerHandle = startProcess(
          config.webServerCommand,
          rootDir,
          serverEnv,
          verbose,
          'figma-web',
        );
      }

      const becameReady = await waitForServer(config.baseUrl, 120000);
      if (!becameReady) {
        const tailLogs = webServerHandle ? webServerHandle.getLogs() : '';
        throw new Error(
          `Web server did not become ready at ${config.baseUrl}.\n${tailLogs ? `Recent logs:\n${tailLogs}` : ''}`,
        );
      }
    }

    if (!dryRun) {
      const launched = await launchBrowser(config.browserName, rootDir, verbose, notes);
      browser = launched.browser;
      browserUsed = launched.browserName;
    }

    const entries = [];

    for (const viewport of config.viewports) {
      if (dryRun) {
        for (const target of scopedTargets) {
          entries.push({
            name: target.name,
            sourceType: target.sourceType,
            url: target.url,
            storyId: target.storyId,
            routeTemplate: target.routeTemplate,
            viewport: viewport.id,
            width: viewport.width,
            height: viewport.height,
            filepath: null,
            status: 'skipped',
            reason: 'dry-run',
            durationMs: 0,
            warnings: [],
          });
        }
        continue;
      }

      const context = await browser.newContext({
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
        deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
        locale: 'en-US',
        timezoneId: 'UTC',
        reducedMotion: 'reduce',
        colorScheme: 'light',
        serviceWorkers: 'block',
      });

      await context.addInitScript(
        ({ fixedNow }) => {
          const seed = 0.123456789;
          Date.now = () => fixedNow;
          Math.random = () => seed;
        },
        { fixedNow: new Date(FIXTURE_NOW).getTime() },
      );

      for (const target of scopedTargets) {
        const page = await context.newPage();
        const result = await captureOne(page, target, viewport, config, outputDir);
        await page.close();

        entries.push({
          name: target.name,
          sourceType: target.sourceType,
          url: target.url,
          storyId: target.storyId,
          routeTemplate: target.routeTemplate,
          viewport: viewport.id,
          width: result.width,
          height: result.height,
          filepath: toRelativePath(outputDir, result.filepath),
          status: result.status,
          reason: result.reason,
          durationMs: result.durationMs,
          warnings: result.warnings,
        });

        if (verbose) {
          const statusLabel = result.status.toUpperCase();
          const reasonSuffix = result.reason ? ` (${result.reason})` : '';
          console.log(
            `[figma-export] ${statusLabel}: ${target.name} @ ${viewport.id}${reasonSuffix}`,
          );
        }
      }

      await context.close();
    }

    const summary = {
      total: entries.length,
      captured: entries.filter((entry) => entry.status === 'captured').length,
      failed: entries.filter((entry) => entry.status === 'failed').length,
      skipped: entries.filter((entry) => entry.status === 'skipped').length,
    };

    const manifest = {
      runId: nowIsoSafe(),
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      project: {
        type: projectInfo.kind,
        baseUrl: config.baseUrl,
        browser: dryRun ? null : browserUsed,
        captureSource,
        storybookDetected: projectInfo.storybookDetected,
        snapshotMode: true,
      },
      summary,
      notes,
      entries,
    };

    writeFileSync(resolve(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    const report = createReport(manifest, toRelativePath(rootDir, outputDir));
    writeFileSync(resolve(outputDir, 'report.md'), report);

    console.log(`[figma-export] Captured: ${summary.captured}`);
    console.log(`[figma-export] Failed: ${summary.failed}`);
    console.log(`[figma-export] Skipped: ${summary.skipped}`);
    console.log(
      `[figma-export] Manifest: ${toRelativePath(rootDir, resolve(outputDir, 'manifest.json'))}`,
    );
    console.log(
      `[figma-export] Report: ${toRelativePath(rootDir, resolve(outputDir, 'report.md'))}`,
    );
    console.log(`[figma-export] PNG folder: ${toRelativePath(rootDir, resolve(outputDir, 'png'))}`);

    if (config.failOnError && summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    if (webServerHandle) {
      await stopProcess(webServerHandle.child);
    }
  }
}

await main().catch((error) => {
  console.error(`[figma-export] ${formatError(error)}`);
  process.exit(1);
});
