# API KNOWLEDGE BASE

## OVERVIEW

NestJS API service for auth, documents, findings, actions, reports, and Shopify integration.

## WHERE TO LOOK

| Task                     | Location                                 | Notes                                            |
| ------------------------ | ---------------------------------------- | ------------------------------------------------ |
| Bootstrap + global pipe  | `src/main.ts`                            | `v1` prefix, `ValidationPipe`, env load          |
| Module wiring            | `src/app.module.ts`                      | global guards + audit interceptor                |
| Auth + tenant boundaries | `src/modules/auth/`                      | Shopify session guard, tenant guard, roles guard |
| Prisma lifecycle         | `src/common/prisma/`                     | shared DB client module/service                  |
| Upload + queue enqueue   | `src/modules/documents/`                 | presign/upload complete path                     |
| Evidence download API    | `src/modules/evidence/`                  | action attachment presigned download endpoint    |
| DB schema + seed         | `prisma/schema.prisma`, `prisma/seed.ts` | single schema for API/worker                     |
| Test setup               | `test/setup.ts`, `test/helpers.ts`       | test app bootstrap + DB reset                    |

## CONVENTIONS

- Keep tenant scope explicit in all DB reads/writes (`orgId`, `shopId`).
- DTO boundary uses `class-validator` decorators (avoid raw unvalidated payloads).
- Nest module naming stays conventional: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.guard.ts`.
- Prisma access goes through injected `PrismaService`/tenant-aware service, not ad-hoc clients.
- API tests are Vitest with include pattern `test/**/*.spec.ts`.

## ANTI-PATTERNS

- Never query tenant data without scope filters.
- Never return unbounded internal error details to clients.
- Never mark processing success if queue enqueue/persistence failed.
- Never add broad refactors during bugfixes in this package.

## COMMANDS

```bash
pnpm --filter @leakwatch/api dev
pnpm --filter @leakwatch/api lint
pnpm --filter @leakwatch/api typecheck
pnpm --filter @leakwatch/api test
pnpm --filter @leakwatch/api test -- test/documents-upload.spec.ts
```

## NOTES

- Global guards order is defined in `src/app.module.ts`; preserve when adding new global providers.
- Use `docs/steps/step-03-core-db-and-multitenancy.md` as tenancy policy reference.
