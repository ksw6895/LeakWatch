# Step-13 + P0 이후 실행 백로그 확정 (P1/P2)

기준일: 2026-02-14 (KST)

## 1) 스캔 범위

- Ultimate guideline 분할 문서 전체: `docs/engineering/ultimate-guideline/01-08*.ko.md`
- Step-13 실행/증거: `docs/steps/step-13-non-step-gap-closure.md`
- 현재 구현 코드(웹/API/워커): `apps/web/src/**`, `apps/api/src/**`, `apps/worker/src/**`
- 반영 커밋 기준점: `6c6563a`, `9e8ef25`, `e0c4d6c`

## 2) 제외 목록 (이미 반영되어 이번 백로그에서 제외)

아래 항목은 코드 반영 증거와 커밋 증거가 확인되어 "남은 작업"에서 제외한다.

| 구분    | 제외 항목                                                        | 코드 증거                                                                                                                                                                 | 커밋 증거            |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| P0      | App Shell/네비/host 복구 (`P0-01`,`P0-02`,`P0-05`)               | `apps/web/src/app/(embedded)/app/layout.tsx`                                                                                                                              | `6c6563a`            |
| P0      | 멀티스토어 컨텍스트 고정 (`P0-03`)                               | `apps/web/src/components/StoreSwitcher.tsx`                                                                                                                               | `6c6563a`            |
| P0      | 업로드 UX/폴링/vendorHint/복구 (`P0-06`,`P0-07`,`P0-08`,`P0-09`) | `apps/web/src/components/uploads-panel.tsx`                                                                                                                               | `9e8ef25`            |
| P0      | Leaks 상세 신뢰/안전 (`P0-12`,`P0-13`)                           | `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`                                                                                                                     | `9e8ef25`            |
| P0      | Actions 승인 안전장치/상태 표기 (`P0-16`,`P0-17`)                | `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`, `apps/web/src/app/(embedded)/app/actions/page.tsx`                                                               | `9e8ef25`, `e0c4d6c` |
| P0      | Billing OWNER-only + confirmation redirect (`P0-22`,`P0-23`)     | `apps/web/src/lib/auth/roles.ts`, `apps/web/src/app/(embedded)/app/settings/billing/page.tsx`                                                                             | `6c6563a`            |
| P0      | 상태 패널 표준/보안 신호/이벤트 계측 (`P0-28`,`P0-29`,`P0-30`)   | `apps/web/src/components/common/StatePanel.tsx`, `apps/web/src/lib/analytics/track.ts`, `apps/web/src/components/embedded-shell.tsx`                                      | `e0c4d6c`            |
| Step-13 | US-03 설정 API/UI                                                | `apps/api/src/modules/shops/shops.controller.ts`, `apps/web/src/app/(embedded)/app/settings/page.tsx`                                                                     | `e0c4d6c`            |
| Step-13 | US-32 재탐지시 REOPENED 전이                                     | `apps/worker/src/jobs/detection.ts`, `apps/worker/test/detection.test.ts`                                                                                                 | `e0c4d6c`            |
| Step-13 | US-43 액션 수동 상태 업데이트                                    | `apps/api/src/modules/actions/actions.controller.ts`, `apps/api/src/modules/actions/update-action-status.dto.ts`, `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx` | `e0c4d6c`            |
| Step-13 | Agency 라우트 골격                                               | `apps/web/src/app/agency/login/page.tsx`, `apps/web/src/app/agency/shops/[shopId]/page.tsx`, `apps/web/src/app/agency/reports/page.tsx`                                   | `e0c4d6c`            |

## 3) 남은 작업 확정 (P1)

아래는 Step-13 + P0 이후 "미반영 또는 부분 반영" 상태로 확정한 실행 백로그다.

### P1-01) 문서 상세(Explainability) 실구현 완료

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-10`, `03-improvement-roadmap-phases.ko.md` Epic H
- 현상/미반영 증거:
  - `apps/web/src/app/(embedded)/app/documents/[documentId]/page.tsx`가 placeholder 상태
  - 원본/버전/타임라인/근거 탐색 흐름 부재
- 실행 범위:
  - `/app/documents/[documentId]` 상세를 실데이터 기반으로 구현
  - version 목록, status 타임라인, errorCode 기반 가이드, 원본 다운로드 링크 연결
- 완료 조건:
  - placeholder 제거
  - 업로드 목록/누수 상세에서 문서 상세로 이동 가능

### P1-02) Finding 상태 수명주기 UX 완성 (Dismiss/Resolve/Reopen)

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-14`
- 현상/미반영 증거:
  - `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`는 dismiss 중심이며 resolve/reopen UX가 제한적
  - Step-13에서 REOPENED 로직은 워커에 반영됐지만 UI 설명/행동 흐름은 불충분
- 실행 범위:
  - Leaks 목록/상세에 REOPENED 강조 및 상태 전이 설명 보강
  - Resolve 경로를 UI에서 명확히 표현(액션/결과와 연결)
- 완료 조건:
  - 사용자 기준으로 OPEN/DISMISSED/RESOLVED/REOPENED 의미와 다음 액션이 혼동되지 않음

### P1-03) 금액/통화/타임존 포맷 통일

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-15`
- 현상/미반영 증거:
  - `apps/web/src/app/(embedded)/app/reports/page.tsx`, `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`, `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx` 등에서 포맷 방식 혼재
  - `apps/web/src/lib/format/*` 공통 유틸 부재
- 실행 범위:
  - 포맷 유틸(`formatMoney`, `formatDateTime`) 도입 및 주요 화면 일괄 적용
- 완료 조건:
  - 동일 데이터가 화면별로 다른 표기로 보이지 않음

### P1-04) Action 상세 편집 UX 강화 (템플릿/미리보기)

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-18`
- 현상/미반영 증거:
  - `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`에서 본문은 단일 TextField 편집만 제공
- 실행 범위:
  - 템플릿 quick insert(Refund/Cancel/Downgrade)
  - Markdown preview 토글
- 완료 조건:
  - 승인 전 메일 품질 검토가 UI 내에서 가능

### P1-05) Reply-To = contactEmail 운영 정책 반영

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-19`, `03-improvement-roadmap-phases.ko.md`
- 현상/미반영 증거:
  - `apps/worker/src/jobs/send-email.ts`에 Mailgun `h:Reply-To` 세팅 부재
  - `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`에 reply handling 안내 부재
- 실행 범위:
  - shop settings의 `contactEmail`을 액션 발송 Reply-To로 반영
  - 액션 상세에 회신 경로 안내 추가
- 완료 조건:
  - 회신 경로가 정책/코드/UI에서 일치

### P1-06) Reports 의사결정 UX 고도화

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-24`, `03-improvement-roadmap-phases.ko.md` Epic J
- 현상/미반영 증거:
  - `apps/web/src/app/(embedded)/app/reports/page.tsx`: weekly/monthly 탭 구분 없이 단일 테이블
  - `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`: raw JSON 중심 표현
- 실행 범위:
  - Weekly/Monthly 필터 탭 도입
  - 상세 화면에 KPI 카드/요약 우선, raw JSON은 Advanced 토글로 이동
- 완료 조건:
  - 보고서가 "원문 데이터 표시"가 아니라 "즉시 의사결정" 중심으로 동작

### P1-07) Agency 롤업 -> 실무 Drill-down 연결

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-25`
- 현상/미반영 증거:
  - `apps/web/src/app/(embedded)/app/agency/page.tsx`의 top findings가 링크/액션 없이 텍스트 표시
- 실행 범위:
  - top finding 클릭 시 해당 shop 컨텍스트 leaks detail로 이동
  - shopId를 domain/displayName 우선으로 표기
- 완료 조건:
  - agency 대시보드에서 실제 처리 화면으로 1~2클릭 이동 가능

### P1-08) 접근성(A11y) 표준화

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-31`
- 현상/미반영 증거:
  - `apps/web/src/components/uploads-panel.tsx`에 Dropzone 키보드 접근성/aria 힌트가 제한적
- 실행 범위:
  - 클릭 가능한 custom 영역을 button/link semantics로 정리
  - Dropzone keyboard/aria/focus-visible 표준화
- 완료 조건:
  - 키보드만으로 업로드 -> 누수 -> 액션 핵심 흐름 수행 가능

### P1-09) 모바일/반응형 테이블 가독성 개선

- 출처: `02-uiux-problem-list-and-improvements.ko.md`의 `P1-36`
- 현상/미반영 증거:
  - uploads/leaks/actions/reports 테이블이 모바일 최적화 카드 뷰 없이 가로 스크롤 의존
- 실행 범위:
  - 모바일 우선 열 축소/카드 변환 패턴 도입
  - "Swipe to view" 힌트 및 터치 타겟 규격화
- 완료 조건:
  - 주요 리스트 화면의 모바일 사용성 저하 이슈 해소

## 4) 남은 작업 확정 (P2)

### P2-01) Agency 외부 포털 완성도 확장

- 출처: `03-improvement-roadmap-phases.ko.md` Epic L
- 현재 상태: 라우트 골격은 반영(`e0c4d6c`)됐으나 운영 UX/권한 정책 고도화는 미완료
- 실행 범위: `/agency`, `/agency/shops/[shopId]`, `/agency/reports`의 실사용 플로우/권한 매트릭스 완성

### P2-02) 설치 앱 동기화 + UNINSTALLED_APP_CHARGE 강화

- 출처: `03-improvement-roadmap-phases.ko.md` Epic M
- 실행 범위: 설치 앱 목록 주기 동기화, 해지 후 청구 감지 정확도 강화

### P2-03) Report export/share

- 출처: `03-improvement-roadmap-phases.ko.md` Epic N
- 실행 범위: PDF/CSV export, 공유 링크/다운로드 운영 흐름

### P2-04) Inbound email parsing V1

- 출처: `03-improvement-roadmap-phases.ko.md` Epic O
- 실행 범위: 벤더 회신 수신 -> 파싱 -> 액션 상태 연동 파이프라인 구축

### P2-05) Assumption 잔여 항목 해소

- 출처: `06-assumptions-and-validation.ko.md`
- 실행 범위: displayStatus/latestRunStatus 응답 정합, errorCode 표준, AGENCY_ADMIN write 범위, billing subscribe 계약 검증 고도화

## 5) 우선 실행 순서 제안

1. P1-01 (문서 상세)
2. P1-06 (Reports UX)
3. P1-05 (Reply-To 정책)
4. P1-07 (Agency drill-down)
5. P1-03 (포맷 통일) + P1-08 (A11y) + P1-09 (모바일)
6. 이후 P2 순차 착수

## 6) 검증 로그 기준

이 문서 기준 실행 시, 각 배치 완료마다 아래 중 최소 동등 검증을 남긴다.

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## 7) 실행 단위 업데이트 (2026-02-14)

이번 실행 단위에서 아래 항목을 코드/문서 동기화 기준으로 반영했다.

- P1-I (Action lifecycle 정교화)
  - API: `POST /v1/action-requests/:id/status` 흐름 유지 + dismiss RBAC 강화 + dismiss 감사로그 추가
    - `apps/api/src/modules/actions/actions.controller.ts`
    - `apps/api/src/modules/findings/findings.controller.ts`
    - `apps/api/src/modules/auth/tenant-prisma.service.ts`
  - Web: actions 리스트/상세에서 `displayStatus` 중심 표시 일관화
    - `apps/web/src/app/(embedded)/app/actions/page.tsx`
    - `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`

- P1-J (리포트 UX/필터/요약)
  - API: `period` 필터 지원 + report export endpoint 추가
    - `apps/api/src/modules/reports/reports.controller.ts`
    - `apps/api/src/modules/reports/reports.service.ts`
  - Web: weekly/monthly/all 필터 탭, 요약 지표 확장, 상세 advanced JSON 토글 + CSV export
    - `apps/web/src/app/(embedded)/app/reports/page.tsx`
    - `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`

- P1-K (플랜/쿼터 게이트)
  - API: reports quota meter(`reports_generated`) 추가, report 생성 시 게이트 적용
    - `apps/api/src/modules/billing/billing.service.ts`
    - `apps/api/src/modules/reports/reports.service.ts`
  - Web: upload/action/report 화면에서 quota 안내/차단 상태 노출 보강
    - `apps/web/src/components/uploads-panel.tsx`
    - `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
    - `apps/web/src/app/(embedded)/app/settings/billing/page.tsx`

- P2-L (Agency 포털 본체)
  - `/agency/login`, `/agency/shops/[shopId]`, `/agency/reports`를 실제 API 연동형 운영 흐름으로 연결
  - API role matrix 보강(`OWNER`, `MEMBER`, `AGENCY_ADMIN`, `AGENCY_VIEWER`) + cross-org attach 차단
    - `apps/web/src/app/agency/login/page.tsx`
    - `apps/web/src/app/agency/shops/[shopId]/page.tsx`
    - `apps/web/src/app/agency/reports/page.tsx`
    - `apps/api/src/modules/agency/agency.controller.ts`
    - `apps/api/src/modules/agency/agency.service.ts`

- P2-M (설치 앱 동기화 + 감지 정확도 보강)
  - 설치 앱 스냅샷 sync endpoint 추가 + vendor status ACTIVE/SUSPECTED_UNUSED 갱신 + audit log 기록
    - `apps/api/src/modules/shops/installed-apps-sync.dto.ts`
    - `apps/api/src/modules/shops/shops.controller.ts`
    - `apps/api/src/modules/auth/tenant-prisma.service.ts`
  - Shopify `shop-update` webhook 추가(메타데이터 동기화)
    - `apps/api/src/modules/shopify/shopify.controller.ts`
    - `apps/api/src/modules/shopify/shopify-webhook.service.ts`

- P2-N (export/share 협업 흐름)
  - report share-link 발급 + public shared 조회/export endpoint 추가
  - web shared viewer(`/reports/shared/[token]`) 및 embedded report 상세의 share action 연결
    - `apps/api/src/modules/reports/reports.controller.ts`
    - `apps/api/src/modules/reports/reports.service.ts`
    - `apps/web/src/app/reports/shared/[token]/page.tsx`
    - `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`

- P2-O (Inbound email parsing V1 + 운영 UX 보강)
  - Mailgun inbound webhook 추가 + message-id 후보 파싱 + action run 상태 연동 + 감사로그
    - `apps/api/src/modules/mailgun/mailgun.controller.ts`
    - `apps/api/src/modules/mailgun/mailgun.service.ts`
  - 오탐 완화를 위한 negative context keyword 처리(`not resolved`, `unresolved`, `issue persists`) 반영

미완료/리스크:

- public share link는 현재 `SHOPIFY_APP_URL` 기반 7일 만료 JWT로 운영되며, 별도 단축/강제폐기 UX는 후속 범위다.
- inbound parsing은 규칙 기반 V1이며, 고도화된 intent 분류(LLM/규칙 혼합) 전에는 문구 편차로 인한 false-positive/negative 가능성이 남는다.
- Web `next build`의 embedded `useSearchParams` pre-render 제약은 기존 코드 이슈로 잔존할 수 있어, full build에서 신규 회귀와 분리해 판단이 필요하다.
