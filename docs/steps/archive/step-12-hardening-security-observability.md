# Step 12 — Hardening Security & Observability (Archived Summary)

상태: 완료 (2026-02-13)

## 핵심 결과

- request_id/latency 로깅 및 rate limit 적용
- LLM cache 적용 및 비용 가드레일 기초 구축
- 웹 보안 헤더/CI 의존성 관리 구성

## 코드 근거(대표)

- `apps/api/src/middleware/request-id.middleware.ts`
- `apps/api/src/common/rate-limiter.service.ts`
- `apps/worker/src/normalization/cache.ts`
- `apps/web/next.config.mjs`

## 현재 기준 문서

- `docs/operations/SECURITY_PRIVACY.md`
- `docs/operations/DEPLOYMENT_OPS.md`
