import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function parseEnvFile(content) {
  for (const rawLine of content.split(/\r?\n/)) {
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

function loadEnvForWeb() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, '.env.local'),
    resolve(currentDir, '.env'),
    resolve(currentDir, '../../.env'),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue;
    }
    parseEnvFile(readFileSync(envPath, 'utf8'));
  }
}

loadEnvForWeb();

function toOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const allowedDevOrigins = Array.from(
  new Set(
    [
      toOrigin(process.env.SHOPIFY_APP_URL),
      toOrigin(process.env.NEXT_PUBLIC_API_URL),
      'http://localhost:3000',
    ].filter((value) => Boolean(value)),
  ),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins,
  experimental: {
    optimizePackageImports: ['@shopify/polaris'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; connect-src 'self' https:; frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: 'http://localhost:4000/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
