# Step 05 — Normalization LLM Pipeline (Archived Summary)

상태: 완료 (2026-02-12)

## 핵심 결과

- 추출 -> LLM 정규화 -> 스키마 검증/수리 파이프라인 구현
- 정규화 결과 DB 저장 및 다음 단계 큐 연계
- 실패 상태(`NORMALIZATION_FAILED`) 기록 경로 확보

## 코드 근거(대표)

- `apps/worker/src/jobs/normalize.ts`
- `apps/worker/src/normalization/*`
- `packages/shared/src/schemas/normalizedInvoice.schema.json`

## 현재 기준 문서

- `docs/architecture/NORMALIZATION_SCHEMA.md`
