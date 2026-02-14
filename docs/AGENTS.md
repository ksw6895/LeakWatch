# DOCS KNOWLEDGE BASE

## OVERVIEW

Documentation domain for product requirements, architecture decisions, implementation steps, and operational runbooks.

## WHERE TO LOOK

| Task                             | Location                                                         | Notes                                      |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Docs index and stack assumptions | `README.md`                                                      | canonical docs entrypoint                  |
| Step-by-step build plan          | `steps/`                                                         | active steps + archived summaries          |
| Operational procedures           | `operations/runbooks/`                                           | setup, incident, deletion, cost guardrails |
| Product references               | `product/PRD.md`, `product/ROADMAP.md`                           | business scope and priorities              |
| Architecture references          | `architecture/ARCHITECTURE.md`, `architecture/DATA_MODEL.md`     | system context                             |
| Security and ops constraints     | `operations/SECURITY_PRIVACY.md`, `operations/DEPLOYMENT_OPS.md` | hard guardrails and operations             |
| API contract docs                | `api/OPENAPI.yaml`, `api/ERROR_CODES.md`                         | interface and error semantics              |
| Prompt templates                 | `prompts/`                                                       | model instruction templates                |
| Audit references                 | `audits/`                                                        | implementation/documentation audit history |

## CONVENTIONS

- Keep docs consistent with shipped code behavior (no speculative "already implemented" wording).
- Step docs (`steps/step-XX-*.md`) describe implementation sequence and acceptance criteria.
- Runbooks focus on actionable operations with concrete commands and rollback/mitigation notes.
- API behavior changes should be reflected in `api/OPENAPI.yaml` and related error docs.
- Preserve existing bilingual/localized docs style where present (e.g., `.ko.md`).

## ANTI-PATTERNS

- Do not duplicate root-level engineering rules in every doc file.
- Do not publish security/privacy guidance that conflicts with documented guardrails.
- Do not document unsupported Shopify billing data access assumptions.
- Do not leave stale command snippets when scripts/CI workflows change.

## COMMANDS

```bash
# repo-level checks typically run after doc-impacting technical changes
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# run infra needed by many runbooks
docker compose up -d postgres redis

# db procedure references used by docs
pnpm db:migrate -- --name <migration_name>
pnpm db:deploy
```

## NOTES

- `docs/README.md` is the navigation source for the documentation set; update it when adding/removing major docs.
- Step and runbook documents should reference each other when they describe the same implementation phase.
- Current implementation baseline is tracked in root `README.md` under "현재 구현 범위"; keep `docs/README.md` aligned when major documentation sets are removed or added.
- Root `pnpm db:*` scripts auto-load `.env`; prefer those commands in docs to reduce environment drift.
