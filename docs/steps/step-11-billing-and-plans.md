# Step 11 — Billing & Plans (Shopify Billing)

## 목표(사용자 가치)
- 사용량 제한/유료 기능(메일 발송/리포트)을 플랜에 따라 제어하고, Shopify를 통해 구독 결제가 가능하다.

## 범위/비범위
- 범위:
  - Organization.plan 관리
  - Shopify Billing subscription 생성/확인
  - Entitlements 체크(업로드/이메일 발송 제한)
- 비범위:
  - Stripe 외부 결제(대안으로만 문서화)

## 선행 조건(필요 계정/키/설정)
- Shopify Billing API 사용 가능
- 플랜 가격/권한 확정(/docs/PRICING...)

## 구현 체크리스트(세부 태스크)
1) 플랜/제한치 정의(코드 상수)
- FREE: uploads=3, emails=0, findings=3
- STARTER: uploads=50, emails=10
- PRO: uploads=200, emails=50, multiShop=3

2) Entitlement middleware
- upload/createDocumentVersion 시 uploads limit 체크
- action approve/send 시 emails limit 체크
- findings list는 FREE에서 3개까지만(초과는 blurred + upgrade CTA)

3) Billing endpoints
- GET /v1/billing/current
- POST /v1/billing/subscribe?plan=STARTER|PRO
  - Shopify confirmation URL 반환
- POST /v1/billing/webhooks (옵션)
  - subscription 업데이트 이벤트 처리

4) 플랜 변경 시 처리
- Organization.plan 업데이트
- repeatable jobs(리포트 이메일) 활성/비활성

5) UX
- Settings/Billing 페이지:
  - 현재 플랜/사용량
  - Upgrade 버튼
  - 제한 초과 시 안내 모달

## 파일/디렉토리 구조(추가/변경 파일 명시)
- apps/api/src/modules/billing/*
- apps/web/src/app/(embedded)/app/settings/billing/*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)
- BillingService
  - createSubscription(shopId, plan) → confirmationUrl
  - checkActiveSubscription(shopId) → planStatus
- EntitlementService
  - canUpload(orgId) / canSendEmail(orgId)
  - recordUsage(metric)

## API/DB 변경사항
- Organization.plan, planStatus 사용
- usage_counters를 플랜 enforcement에 사용

## 테스트(케이스 + 실행 커맨드)
- FREE에서 이메일 발송 시 402/403 + upgrade 코드 반환
- STARTER에서 email 10회 초과 시 차단
- pnpm test:api

## Definition of Done(정량 기준)
- dev store에서 유료 플랜 subscription 생성(테스트 모드)
- 플랜에 따라 제한이 정확히 적용

## 흔한 함정/디버깅 팁
- Shopify Billing confirmation 이후 리다이렉트 처리(embedded 내)
- subscription 상태가 비동기일 수 있어, 확인은 서버에서 재조회

## 롤백/마이그레이션 주의사항
- 플랜 enum 변경 시 기존 org 데이터 마이그레이션 필요
