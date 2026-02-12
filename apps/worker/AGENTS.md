# WORKER KNOWLEDGE BASE

## OVERVIEW

BullMQ worker service that runs document ingestion, normalization, and detection queue jobs.

## WHERE TO LOOK

| Task                | Location                          | Notes                                                   |
| ------------------- | --------------------------------- | ------------------------------------------------------- |
| Worker bootstrap    | `src/main.ts`                     | startup + graceful shutdown                             |
| Queue registration  | `src/queue.ts`                    | worker dispatch by job name                             |
| Ingestion job       | `src/jobs/ingest.ts`              | extraction + status transitions + normalize enqueue     |
| Normalization job   | `src/jobs/normalize.ts`           | LLM normalize/repair + persistence + detection enqueue  |
| Detection job       | `src/jobs/detection.ts`           | step-06 rule engine + finding/evidence persistence      |
| Extractors          | `src/extractors/`                 | pdf/image/csv + external command helper                 |
| LLM client/env      | `src/llm/client.ts`, `src/env.ts` | model calls + retry/env validation                      |
| Persistence + usage | `src/normalization/`              | normalized invoice persistence + token usage accounting |
| Worker tests        | `test/`                           | queue + normalization tests                             |

## CONVENTIONS

- Status transitions on `documentVersion` must be explicit and persisted.
- Queue enqueue operations should use deterministic job IDs and retry/backoff options.
- On failure, persist `errorCode`/`errorMessage`, log context, then rethrow when retry behavior is intended.
- LLM output must pass schema validation/repair flow before persistence.
- Vitest pattern is `test/**/*.test.ts` with node environment.

## ANTI-PATTERNS

- Do not swallow job errors after logging.
- Do not skip normalization schema validation before writing invoice data.
- Do not enqueue downstream jobs without guarding for current status/idempotency.
- Do not read/write cross-tenant data outside document/shop/org scope.

## COMMANDS

```bash
pnpm --filter @leakwatch/worker dev
pnpm --filter @leakwatch/worker lint
pnpm --filter @leakwatch/worker typecheck
pnpm --filter @leakwatch/worker test
pnpm --filter @leakwatch/worker test -- test/queue.test.ts
```

## NOTES

- Detection (`RUN_DETECTION`) is implemented in `src/jobs/detection.ts`; update docs/tests together when changing rules or thresholds.
