# Step 12 — Hardening: Security + Observability + Cost Controls

## 목표(사용자 가치)

- 안정적으로 운영 가능하고, 오류/비용/보안 리스크를 즉시 감지/차단한다.

## 범위/비범위

- 범위:
  - Sentry 통합(web/api/worker)
  - rate limiting(업로드/메일)
  - audit logs 강화
  - LLM 비용 가드레일(캐시/요약/쿼터)
  - 데이터 삭제 runbook/엔드포인트(관리자)
- 비범위:
  - SOC2 수준의 완전한 컴플라이언스(후속 단계)

## 선행 조건(필요 계정/키/설정)

- Sentry DSN
- Upstash rate limit 또는 Redis 기반 limiter

## 구현 체크리스트(세부 태스크)

1. Observability

- request_id middleware
- job_id/correlation_id 로그
- Sentry captureException in worker processors
- API latency tracing

2. Rate limiting

- API:
  - upload init: 30/min/org (ASSUMPTION)
  - action approve: 10/min/org
- Mail:
  - 50/day/org

3. LLM cost controls

- cache table:
  - key: sha256(prompt+input)
  - value: output json
  - ttl: 30 days
- evidence line selection으로 긴 텍스트 축소
- max tokens 제한(모델 옵션)

4. Security hardening

- presigned URL 로그 금지
- webhook signature strict verify
- CSP/headers(Next.js)
- dependency audit(Dependabot)

5. Data deletion admin endpoint(선택)

- POST /v1/admin/orgs/{orgId}/delete (owner+support only)

## 파일/디렉토리 구조(추가/변경 파일 명시)

- apps/api/src/middleware/\*
- apps/worker/src/observability/\*
- apps/api/src/modules/admin/\* (옵션)

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)

- RateLimiter
  - consume(key, limit, windowSec)
- LLMCache
  - get(hash) / set(hash, value, ttl)
- AuditService
  - record(action, meta)

## API/DB 변경사항

- llm_cache 테이블 추가(옵션)
- usage_counters 강화

## 테스트(케이스 + 실행 커맨드)

- rate limit 초과 시 429
- webhook signature invalid 시 401
- 캐시 hit 시 openai 호출이 발생하지 않음(mock)
- pnpm test:api, pnpm test:worker

## Definition of Done(정량 기준)

- Sentry에 api/worker 에러가 잡힌다.
- rate limit이 동작한다.
- LLM 캐시 hit율을 측정할 수 있다(usage counter)

## 흔한 함정/디버깅 팁

- raw body 필요 endpoint(webhook)는 global body parser 설정과 충돌 → route별 예외 처리
- 캐시 키에 “모델 버전/프롬프트 버전”을 포함하지 않으면 잘못된 재사용 위험

## 롤백/마이그레이션 주의사항

- 캐시 테이블 추가는 안전
- rate limit 설정은 환경변수로 조정 가능하게

## 완료 상태(코드 반영)

- [x] API request id + latency logging 추가: `apps/api/src/middleware/request-id.middleware.ts`, `apps/api/src/main.ts`
- [x] Rate limiting 구현: `apps/api/src/common/rate-limiter.service.ts`
- [x] 업로드/액션 승인 rate limit 적용: `DocumentsService`, `ActionsController`
- [x] LLM cache 테이블 추가: `LlmCache` model + migration
- [x] Normalize 파이프라인 캐시 적용 + hit metric 기록: `apps/worker/src/jobs/normalize.ts`
- [x] LLM cache helper 구현/테스트: `apps/worker/src/normalization/cache.ts`, `apps/worker/test/llm-cache.test.ts`
- [x] Web 보안 헤더(CSP 등) 추가: `apps/web/next.config.mjs`
- [x] Dependabot 설정 추가: `.github/dependabot.yml`
