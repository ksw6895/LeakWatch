# Step-13 + P0 이후 실행 백로그 재확정 (P1/P2)

기준일: 2026-02-14 (KST)

## 1) 재스캔 범위

- Ultimate guideline 분할 문서 전체: `docs/engineering/ultimate-guideline/01~08*.ko.md`
- 기존 백로그/증거 문서: `docs/engineering/ultimate-guideline/09-post-step13-p1-p2-backlog.ko.md`(이전판)
- Step 문서: `docs/steps/step-13-non-step-gap-closure.md`
- 구현 코드: `apps/web/src/**`, `apps/api/src/**`, `apps/worker/src/**`
- API 계약 문서: `docs/api/OPENAPI.yaml`

## 2) 제외 목록 (이미 반영된 항목)

아래 항목은 코드 반영과 커밋 증거가 확인되어 현재 실행 백로그에서 제외한다.

| 구분    | 제외 항목                                                              | 코드 증거                                                                                                                                                                                                                                                                              | 커밋 증거                                |
| ------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| P0      | App Shell/네비/host 복구 (`P0-01`,`P0-02`,`P0-05`)                     | `apps/web/src/app/(embedded)/app/layout.tsx`                                                                                                                                                                                                                                           | `6c6563a`                                |
| P0      | 멀티스토어 컨텍스트 고정 (`P0-03`)                                     | `apps/web/src/components/StoreSwitcher.tsx`                                                                                                                                                                                                                                            | `6c6563a`                                |
| P0      | 업로드 UX/폴링/vendorHint/복구 (`P0-06`,`P0-07`,`P0-08`,`P0-09`)       | `apps/web/src/components/uploads-panel.tsx`                                                                                                                                                                                                                                            | `9e8ef25`                                |
| P0      | Leaks 상세 신뢰/안전 (`P0-12`,`P0-13`)                                 | `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`                                                                                                                                                                                                                                  | `9e8ef25`                                |
| P0      | Actions 승인 안전장치/상태 표기 (`P0-16`,`P0-17`)                      | `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`, `apps/web/src/app/(embedded)/app/actions/page.tsx`                                                                                                                                                                            | `9e8ef25`, `e0c4d6c`                     |
| P0      | Billing OWNER-only + confirmation redirect (`P0-22`,`P0-23`)           | `apps/web/src/lib/auth/roles.ts`, `apps/web/src/app/(embedded)/app/settings/billing/page.tsx`                                                                                                                                                                                          | `6c6563a`                                |
| P0      | 상태 패널 표준/보안 신호/이벤트 계측 (`P0-28`,`P0-29`,`P0-30`)         | `apps/web/src/components/common/StatePanel.tsx`, `apps/web/src/lib/analytics/track.ts`, `apps/web/src/components/embedded-shell.tsx`                                                                                                                                                   | `e0c4d6c`                                |
| Step-13 | US-03 설정 API/UI                                                      | `apps/api/src/modules/shops/shops.controller.ts`, `apps/web/src/app/(embedded)/app/settings/page.tsx`                                                                                                                                                                                  | `e0c4d6c`, `f5db04c`                     |
| Step-13 | US-32 재탐지 시 REOPENED 전이                                          | `apps/worker/src/jobs/detection.ts`, `apps/worker/test/detection.test.ts`                                                                                                                                                                                                              | `e0c4d6c`                                |
| Step-13 | US-43 액션 수동 상태 업데이트                                          | `apps/api/src/modules/actions/actions.controller.ts`, `apps/api/src/modules/actions/update-action-status.dto.ts`, `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`                                                                                                              | `e0c4d6c`                                |
| P1-I    | Action lifecycle 정교화 (WAITING_REPLY/RESOLVED, RBAC, 감사로그, 표시) | `apps/api/src/modules/auth/tenant-prisma.service.ts`, `apps/web/src/app/(embedded)/app/actions/page.tsx`, `apps/api/test/actions-flow.spec.ts`                                                                                                                                         | `e0c4d6c`, `0750963`                     |
| P1-J    | 리포트 UX/필터/요약 + API period 연동                                  | `apps/api/src/modules/reports/reports.controller.ts`, `apps/web/src/app/(embedded)/app/reports/page.tsx`, `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`                                                                                                                      | `0750963`, `2f4778d`                     |
| P1-K    | 플랜/쿼터 게이트(upload/action/report)                                 | `apps/api/src/modules/billing/billing.service.ts`, `apps/api/src/modules/reports/reports.service.ts`, `apps/web/src/components/uploads-panel.tsx`, `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`, `apps/web/src/app/(embedded)/app/reports/page.tsx`                         | `0750963`, `2f4778d`                     |
| P2-L    | Agency 포털 핵심 라우트 + API 가드레일                                 | `apps/web/src/app/agency/login/page.tsx`, `apps/web/src/app/agency/page.tsx`, `apps/web/src/app/agency/shops/[shopId]/page.tsx`, `apps/web/src/app/agency/reports/page.tsx`, `apps/api/src/modules/agency/agency.controller.ts`                                                        | `e0c4d6c`, `2f4778d`, `734840b`          |
| P2-M    | 설치 앱 동기화 + 감지 정확도 보강(기반)                                | `apps/api/src/modules/shops/installed-apps-sync.dto.ts`, `apps/api/src/modules/shops/shops.controller.ts`, `apps/api/src/modules/shopify/shopify.controller.ts`, `apps/api/src/modules/shopify/shopify-webhook.service.ts`                                                             | `734840b`                                |
| P2-01   | 설치 앱 동기화 자동화(주기 스케줄 + 운영 알림)                         | `apps/worker/src/main.ts`, `apps/worker/src/jobs/installed-apps-sync.ts`, `apps/worker/src/queue.ts`, `packages/shared/src/queue.ts`, `apps/api/src/modules/auth/tenant-prisma.service.ts`                                                                                             | 현재 실행 변경분(본 실행 단위 커밋 예정) |
| P2-04   | Assumption closure(1/3/4 검증 + 2 deferred 명시)                       | `docs/engineering/ultimate-guideline/06-assumptions-and-validation.ko.md`, `apps/api/test/actions-flow.spec.ts`, `apps/api/test/billing.spec.ts`                                                                                                                                       | 현재 실행 변경분(본 실행 단위 커밋 예정) |
| P2-N    | report share/export 협업 흐름(PDF + revoke 포함)                       | `apps/api/src/modules/reports/reports.controller.ts`, `apps/api/src/modules/reports/reports.service.ts`, `apps/api/test/reports.spec.ts`, `apps/web/src/app/reports/shared/[token]/page.tsx`, `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`                                  | `734840b`, `469e37a`, 현재 실행 변경분   |
| P2-O    | inbound email parsing V1(기반)                                         | `apps/api/src/modules/mailgun/mailgun.controller.ts`, `apps/api/src/modules/mailgun/mailgun.service.ts`, `apps/api/test/actions-flow.spec.ts`                                                                                                                                          | `ee46c6a`, `734840b`                     |
| P2-03   | inbound parsing 정확도 고도화 + 운영 피드백 루프                       | `apps/api/src/modules/mailgun/mailgun.service.ts`, `apps/api/src/modules/auth/tenant-prisma.service.ts`, `apps/api/src/modules/actions/actions.controller.ts`, `apps/api/test/actions-flow.spec.ts`, `apps/web/src/app/(embedded)/app/actions/page.tsx`                                | 현재 실행 변경분(본 실행 단위 커밋 예정) |
| P2-05   | 모바일/접근성/성능 자동 품질게이트(Playwright+axe+CI)                  | `apps/web/playwright.config.ts`, `apps/web/e2e/agency-quality-gates.spec.ts`, `.github/workflows/ci.yml`, `apps/web/package.json`                                                                                                                                                      | 현재 실행 변경분(본 실행 단위 커밋 예정) |
| P1-H    | 문서 상세(`/app/documents/[documentId]`) 실구현 + 다운로드 동선        | `apps/web/src/app/(embedded)/app/documents/[documentId]/page.tsx`, `apps/api/src/modules/documents/documents.controller.ts`, `apps/api/src/modules/documents/documents.service.ts`, `apps/web/src/components/uploads-panel.tsx`, `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx` | 현재 실행 변경분(본 실행 단위 커밋 예정) |

## 3) 남은 작업 확정 (P1)

- 현재 실행 기준 P1 잔여 항목 없음.
- P1-H 후속(문서 상세/API 계약/테스트 동기화)은 이번 실행에서 반영 완료했고, 풀 검증은 `6) 검증 기준`에 따른 결과로 관리한다.

## 4) 남은 작업 확정 (P2)

### P2-01) 설치 앱 동기화 자동화 고도화 (Epic M)

- 현재 상태: worker repeat job(`INSTALLED_APPS_SYNC`)으로 일 단위 자동 재동기화 + 감사로그 기반 staleness/no-baseline alert 경로 반영
- 잔여 보강:
  - Shopify API 직접 installed-app 조회 스코프 확보 여부(S2) 확정 후 snapshot source 품질 고도화
- 완료 조건:
  - 수동 호출 없이도 주기 동기화가 동작하고 감사로그/오류 추적이 남음 (충족)

### P2-03) Inbound parsing 정확도 고도화 (Epic O)

- 현재 상태: 규칙 기반 V2(가중치 신호 + negative/uncertain 처리)로 확장, inbound parse 결과를 이벤트 payload/audit에 기록
- 반영 내용:
  - 문구 편차 대응: 긍정/부정/불확실 신호 확장 + 점수 기반 결정(`resolved|waiting_reply|uncertain`)
  - 운영 피드백 루프: 수동 상태 업데이트 시 `ACTION_INBOUND_PARSE_FEEDBACK` 라벨(`TP/FP/TN/FN/UNLABELED`) 기록
  - 대시보드: `/v1/action-requests/inbound-parse/metrics` + Actions UI 품질 카드
- 완료 조건:
  - false-positive/false-negative 관측 지표를 API/UI에서 30일 창으로 확인 가능 (충족)

### P2-04) Assumption 잔여 항목 닫기

- 출처: `docs/engineering/ultimate-guideline/06-assumptions-and-validation.ko.md`
- 현재 상태:
  - 가정 1(displayStatus/latestRunStatus): 검증 완료
  - 가정 2(errorCode 응답 표준): 명시적 deferred
  - 가정 3(AGENCY_ADMIN write scope): 검증 완료
  - 가정 4(billing subscribe confirmationUrl): 검증 완료
- 완료 조건:
  - 가정 1~4가 문서상 `검증 완료` 또는 `명시적 deferred`로 정리됨 (충족)

### P2-05) 모바일/접근성/성능 자동 품질게이트

- 현재 상태: Playwright E2E 프로젝트(데스크톱/모바일)와 axe 접근성 검사 추가
- 반영 내용:
  - 주요 플로우 회귀: agency reports / agency shop workspace를 API mock 기반으로 검증
  - 접근성 자동검사: axe(`wcag2a`,`wcag2aa`) serious/critical 0건 게이트
  - 성능 기준: navigation DCL < 3s 임계값 검증(모의 API 조건)
  - CI 통합: Chromium 설치 + `pnpm --filter @leakwatch/web test:e2e` 실행
- 완료 조건:
  - CI에서 모바일/접근성/핵심 플로우 회귀 자동 탐지 (충족)

## 5) 실행 우선순위

1. P2-04 deferred 항목(`errorCode` 전역 표준) 별도 배치

## 6) 검증 기준

각 배치 완료마다 아래를 최소 동등 수준으로 실행한다.

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- 필요 시 `pnpm build`

## 7) 명시적 리스크

- `errorCode` 전역 표준화 deferred 항목은 별도 배치로 남아 있음(P2-04 가정 2).
