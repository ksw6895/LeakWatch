type SnapshotViewport = {
  id: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
};

type SnapshotManualTarget = {
  id?: string;
  name?: string;
  path?: string;
  url?: string;
  query?: Record<string, string>;
  captureMode?: 'fullPage' | 'viewport' | 'element';
  elementSelector?: string;
  readySelector?: string;
};

type SnapshotConfig = {
  outputDir?: string;
  baseUrl?: string;
  browserName?: 'chromium' | 'firefox';
  includeRoutes?: string[];
  excludeRoutes?: string[];
  viewports?: SnapshotViewport[];
  contextQuery?: {
    host?: string;
    shop?: string;
  };
  dynamicParamDefaults?: Record<string, string>;
  dynamicRouteParams?: Record<string, Record<string, string>>;
  readySelectors?: Record<string, string>;
  manualTargets?: SnapshotManualTarget[];
  capture?: {
    mode?: 'fullPage' | 'viewport' | 'element';
    elementSelector?: string;
    waitForNetworkIdleMs?: number;
    waitAfterMs?: number;
    timeoutMs?: number;
  };
  mockApi?: {
    enabled?: boolean;
    strict?: boolean;
  };
  failOnError?: boolean;
};

const config: SnapshotConfig = {
  outputDir: 'figma-export',
  baseUrl: 'http://127.0.0.1:3000',
  browserName: 'chromium',
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
    waitForNetworkIdleMs: 1500,
    waitAfterMs: 150,
    timeoutMs: 45000,
  },
  mockApi: {
    enabled: true,
    strict: false,
  },
  failOnError: false,
};

export default config;
