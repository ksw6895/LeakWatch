# WEB KNOWLEDGE BASE

## OVERVIEW

Next.js 14 App Router frontend for embedded Shopify workflows, especially auth bootstrap and document uploads.

## WHERE TO LOOK

| Task                      | Location                                    | Notes                                |
| ------------------------- | ------------------------------------------- | ------------------------------------ |
| Root route behavior       | `src/app/page.tsx`                          | redirects `/` to `/app`              |
| Global layout/style       | `src/app/layout.tsx`, `src/app/globals.css` | app shell + global CSS               |
| Embedded app routes       | `src/app/(embedded)/app/`                   | Shopify embedded pages               |
| Reports routes            | `src/app/(embedded)/app/reports/`           | report list/detail + generate action |
| Agency route              | `src/app/(embedded)/app/agency/`            | org-level summary dashboard          |
| Billing settings route    | `src/app/(embedded)/app/settings/billing/`  | plan/usage + upgrade actions         |
| Upload UI flow            | `src/components/uploads-panel.tsx`          | create -> presign -> PUT -> complete |
| Embedded shell/auth fetch | `src/components/embedded-shell.tsx`         | loads `/v1/auth/me`                  |
| Store switcher            | `src/components/StoreSwitcher.tsx`          | multi-shop selector for embedded UI  |
| API client wrapper        | `src/lib/api/fetcher.ts`                    | base URL + optional session token    |
| Shopify token bridge      | `src/lib/shopify/session-token.ts`          | App Bridge session token retrieval   |
| Web tests                 | `src/test/`                                 | Vitest jsdom tests                   |

## CONVENTIONS

- Routing follows App Router conventions (`src/app/**/page.tsx`).
- Embedded-specific pages stay under `src/app/(embedded)/`.
- Server/API calls should use `apiFetch` instead of scattered raw `fetch` calls.
- Vitest config is authoritative for this package: `environment: jsdom`, include `src/**/*.test.ts`.
- Keep Polaris/App Bridge integration code isolated under `src/lib/shopify` and embedded components.

## ANTI-PATTERNS

- Do not hardcode API origins when `NEXT_PUBLIC_API_URL`/same-origin logic already covers it.
- Do not bypass auth context (`host` + session token) for embedded API calls.
- Do not move embedded routes outside `(embedded)` group without a routing reason.

## COMMANDS

```bash
pnpm --filter @leakwatch/web dev
pnpm --filter @leakwatch/web lint
pnpm --filter @leakwatch/web typecheck
pnpm --filter @leakwatch/web test
pnpm --filter @leakwatch/web test -- src/test/fetcher.test.ts
```

## NOTES

- `next.config.mjs` contains current Next runtime config and should be consulted before changing routing/network behavior.
- Security headers (CSP, nosniff, referrer policy) are defined in `next.config.mjs` and should remain aligned with Shopify embedded requirements.
