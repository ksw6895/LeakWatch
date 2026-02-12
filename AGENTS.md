# AGENTS.md

Guidance for coding agents working in this repository.

## Repository Snapshot

- Monorepo: `pnpm` workspaces + Turborepo.
- Apps: `apps/api` (NestJS + Prisma + Vitest), `apps/web` (Next.js 14 + React + Vitest), `apps/worker` (Node worker + BullMQ + Vitest).
- Package: `packages/shared` (shared TS utilities/types).

## Agent Rule Files

- Cursor rules: `.cursorrules` not found, `.cursor/rules/` not found.
- Copilot rules: `.github/copilot-instructions.md` not found.
- If these files appear later, treat them as highest-priority instructions.

## Environment and Tooling

- Node `20.x`
- `pnpm 9.x` (pinned as `pnpm@9.15.4`)
- Docker (Postgres + Redis for local/integration testing)
- TypeScript strict mode enabled in `tsconfig.base.json`

## Workspace Commands (Root)

Run from repo root unless noted.

- Install: `pnpm install`
- Dev (all packages): `pnpm dev`
- Build (all packages): `pnpm build`
- Lint (all packages): `pnpm lint`
- Typecheck (all packages): `pnpm typecheck`
- Test (all packages): `pnpm test`

## Package Commands

- API (`@leakwatch/api`): `pnpm --filter @leakwatch/api dev|build|lint|typecheck|test`
- Web (`@leakwatch/web`): `pnpm --filter @leakwatch/web dev|build|lint|typecheck|test`
- Worker (`@leakwatch/worker`): `pnpm --filter @leakwatch/worker dev|build|lint|typecheck|test`
- Shared (`@leakwatch/shared`): `pnpm --filter @leakwatch/shared dev|build|lint|typecheck|test`

## Running a Single Test (Important)

All projects use Vitest.

- Single test file:
  - `pnpm --filter @leakwatch/api test -- test/documents-upload.spec.ts`
  - `pnpm --filter @leakwatch/worker test -- test/queue.test.ts`
  - `pnpm --filter @leakwatch/web test -- src/test/fetcher.test.ts`
- Single test name:
  - `pnpm --filter @leakwatch/api test -- -t "creates document upload"`
- File + test name:
  - `pnpm --filter @leakwatch/api test -- test/documents-upload.spec.ts -t "rejects oversized upload"`
- Explicit Vitest form:
  - `pnpm --filter @leakwatch/api exec vitest run test/documents-upload.spec.ts -t "..."`

## Database and Infra Commands

- Start local infra: `docker compose up -d postgres redis`
- Local migration: `pnpm db:migrate -- --name <migration_name>`
- CI/prod-style migration: `pnpm db:deploy`
- Seed database: `pnpm db:seed`

## CI Expectations

CI currently runs this sequence:

1. `pnpm install --frozen-lockfile`
2. `pnpm db:deploy`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm build`
   Before finishing substantial work, run equivalent checks for touched packages.

## Formatting and Linting

- Prettier (`.prettierrc`): single quotes, semicolons, trailing commas (`es5`), print width `100`.
- ESLint (`.eslintrc.cjs`) extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `prettier`.
- `@typescript-eslint/no-explicit-any` is off, but still prefer precise types.

## TypeScript and Type Safety

- Compiler constraints: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Prefer explicit DTO/domain types over loose object literals.
- Use `import type` for type-only imports.
- Validate input at boundaries:
  - API request DTOs with `class-validator`
  - environment variables with `zod` + `parseEnv`
- Avoid broad casts (`as any`, double-casts) unless absolutely necessary.

## Imports and Module Structure

- Keep import groups ordered:
  1. external packages
  2. internal/workspace imports
- Separate import groups with one blank line.
- Use `@leakwatch/shared` for cross-package shared code.
- Keep relative paths short and consistent with nearby modules.

## Naming and File Conventions

- `PascalCase`: classes, interfaces, types.
- `camelCase`: functions, methods, variables.
- `UPPER_SNAKE_CASE`: constants, queue names, shared identifiers.
- API DTO classes should end in `Dto`.
- NestJS files follow framework naming: `*.module.ts`, `*.service.ts`, `*.guard.ts`, etc.
- Filenames are generally kebab-case or framework-conventional (`page.tsx`, `main.ts`).

## Error Handling Guidelines

- API layer:
  - throw NestJS HTTP exceptions (`BadRequestException`, `UnauthorizedException`, etc.)
  - validate early and return/throw early
  - use safe, stable client-facing error messages/codes
- Worker layer:
  - persist failed status + error metadata on job failure
  - log structured context (`documentVersionId`, error code, counts)
  - rethrow when retry/failure behavior is needed
- Do not swallow errors silently.

## Testing Conventions

- API tests: `apps/api/test/**/*.spec.ts`
- Worker tests: `apps/worker/test/**/*.test.ts`
- Shared tests: `packages/shared/test/**/*.test.ts`
- Web tests: `apps/web/src/**/*.test.ts`
- Favor deterministic tests and existing setup/helpers before adding fixtures.

## Commit and Hook Behavior

- Pre-commit hook runs `pnpm lint-staged`.
- Staged TS/JS/JSON/MD/YAML files are auto-formatted by Prettier.
- Keep diffs focused; avoid opportunistic unrelated refactors.

## Practical Agent Checklist

1. Make only task-scoped changes.
2. Match local style and patterns in touched files.
3. Run targeted tests first (single file or `-t` pattern).
4. Run lint + typecheck for affected packages.
5. For broad changes, run full `pnpm test` and `pnpm build`.
6. Report any skipped checks in handoff notes.
