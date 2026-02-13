# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-13T02:34:57+09:00
**Commit:** 00d1a20
**Branch:** main

## OVERVIEW

LeakWatch is a pnpm+turborepo TypeScript monorepo for Shopify subscription leak detection.
Runtime domains are split into API (NestJS), Web (Next.js App Router), Worker (BullMQ pipeline), and Shared library code.

## STRUCTURE

```text
LeakWatch/
|- apps/
|  |- api/      # NestJS API + Prisma + Vitest
|  |- web/      # Next.js 14 App Router + Vitest
|  `- worker/   # BullMQ worker pipeline + Vitest
|- packages/
|  `- shared/   # shared TS types/utils/shopify helpers
|- docs/        # product and implementation docs/runbooks
|- .github/workflows/ci.yml
|- turbo.json
`- pnpm-workspace.yaml
```

## WHERE TO LOOK

| Task                      | Location                                                                                                           | Notes                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| API bootstrap + guards    | `apps/api/src/main.ts`, `apps/api/src/app.module.ts`                                                               | Global prefix `v1`, validation pipe, global guards/interceptor |
| Web routing               | `apps/web/src/app/`                                                                                                | App Router; embedded routes in `apps/web/src/app/(embedded)/`  |
| Worker queue flow         | `apps/worker/src/queue.ts`, `apps/worker/src/jobs/`                                                                | ingest -> normalize -> detection -> evidence-pack pipeline     |
| Shared exports            | `packages/shared/src/index.ts`                                                                                     | Public surface used by all packages                            |
| DB schema/migrations      | `apps/api/prisma/schema.prisma`                                                                                    | single Prisma schema for API/worker                            |
| CI contract               | `.github/workflows/ci.yml`                                                                                         | install -> db:deploy -> lint -> typecheck -> test -> build     |
| Package-level agent rules | `apps/api/AGENTS.md`, `apps/web/AGENTS.md`, `apps/worker/AGENTS.md`, `packages/shared/AGENTS.md`, `docs/AGENTS.md` | read local file before editing inside that subtree             |

## CONVENTIONS

- Workspace: `pnpm-workspace.yaml` (`apps/*`, `packages/*`) + `turbo.json` task orchestration.
- TypeScript strictness from `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Shared imports should use `@leakwatch/shared` path aliases defined in `tsconfig.base.json`.
- Per-package Vitest patterns differ and are authoritative in each `vitest.config.ts`.
- Pre-commit runs `lint-staged`; staged TS/JS/JSON/MD/YAML are auto-formatted by Prettier.

## ANTI-PATTERNS (THIS PROJECT)

- Do not bypass tenant scoping (`orgId`/`shopId`) in API queries and access control paths.
- Do not swallow worker failures; persist status/error metadata and rethrow when retry semantics are needed.
- Do not assume Shopify can directly expose all 3rd-party app billing details; ingestion relies on uploaded/forwarded invoice evidence.
- Do not exceed documented upload/security guardrails (private storage, presigned URL TTLs, retention policy).
- Do not introduce cross-package duplicated rules in child AGENTS files; keep global policy here and local policy in subtree AGENTS.

## COMMANDS

```bash
# workspace
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# infra + db
docker compose up -d postgres redis
pnpm db:migrate -- --name <migration_name>
pnpm db:deploy
pnpm db:seed

# per-package examples
pnpm --filter @leakwatch/api start
pnpm --filter @leakwatch/worker start
pnpm --filter @leakwatch/web start
pnpm --filter @leakwatch/api test -- test/documents-upload.spec.ts
pnpm --filter @leakwatch/web test -- src/test/fetcher.test.ts
pnpm --filter @leakwatch/worker test -- test/queue.test.ts
```

## NOTES

- Local docker postgres maps `5433:5432` (`docker-compose.yml`), CI service postgres exposes `5432`.
- Root `pnpm db:*` scripts auto-load `.env` before Prisma commands.
- LSP may be unavailable unless `typescript-language-server` is installed; use grep/ast-grep fallback when needed.
- Keep root AGENTS concise; package-specific rules belong in nearest subtree AGENTS.
