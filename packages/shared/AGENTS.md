# SHARED KNOWLEDGE BASE

## OVERVIEW

Shared TypeScript package for cross-app types, env parsing, queue constants, logging, and Shopify utility functions.

## WHERE TO LOOK

| Task                      | Location        | Notes                             |
| ------------------------- | --------------- | --------------------------------- |
| Public API surface        | `src/index.ts`  | controls exports consumed by apps |
| Runtime env schema        | `src/env.ts`    | zod-based env parsing helpers     |
| Logger factory            | `src/logger.ts` | shared pino logger config         |
| Queue names/payload types | `src/queue.ts`  | shared worker/API queue contracts |
| Shopify helpers           | `src/shopify/`  | domain URL + HMAC/crypto helpers  |
| Shared types              | `src/types.ts`  | reusable domain types             |
| Package tests             | `test/`         | unit tests for shared helpers     |

## CONVENTIONS

- Keep exports intentional; add/remove only through `src/index.ts`.
- Preserve backward compatibility for symbols used by multiple apps.
- Shared code should stay framework-neutral when possible.
- Security-sensitive helpers (HMAC/crypto) require deterministic tests for edge cases.

## ANTI-PATTERNS

- Do not introduce app-specific behavior into shared utilities.
- Do not break export paths consumed by `@leakwatch/shared` aliases.
- Do not duplicate queue/event constants defined in `src/queue.ts`.

## COMMANDS

```bash
pnpm --filter @leakwatch/shared dev
pnpm --filter @leakwatch/shared build
pnpm --filter @leakwatch/shared lint
pnpm --filter @leakwatch/shared typecheck
pnpm --filter @leakwatch/shared test
```

## NOTES

- Root `tsconfig.base.json` maps `@leakwatch/shared` to this package source; treat path/exports changes as cross-workspace impact.
