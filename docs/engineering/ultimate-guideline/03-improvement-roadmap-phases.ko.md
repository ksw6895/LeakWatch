## 3) 개선안 로드맵 (실행 가능 형태)

원칙: “API 계약을 최대한 유지”하되, UX에 필수인 경우만 API 확장(문서에 명시).  
단계: 0~2주(퀵윈), 2~6주(MVP 고도화), 6주+(확장)

---

## 에이전트 프롬프트 템플릿

- 문서 범위: Phase 0/1/2 로드맵 기반 실행 계획 수립

```text
TASK
- docs/engineering/ultimate-guideline/03-improvement-roadmap-phases.ko.md의
  현재 대상 페이즈에서 Epic 1개를 선택해 구현 계획과 검증 계획을 작성한다.

EXPECTED OUTCOME
- Epic 단위 실행 계획(태스크, 선후관계, 수용 기준)
- 병렬 가능/불가 작업 구분

MUST DO
- Phase 번호와 Epic ID(A~O)를 그대로 유지한다.
- API 변경 필요 여부를 "필수/권장/불필요"로 명시한다.
- 완료 정의(DoD)와 연결되는 검증 항목을 함께 제시한다.

MUST NOT DO
- 다음 페이즈 작업을 현재 페이즈에 혼합하지 않는다.
- 검증 없는 완료 보고를 하지 않는다.

CONTEXT
- Orchestration rules: docs/engineering/ultimate-guideline/04-multi-agent-orchestration-playbook.ko.md
- API constraints: docs/engineering/ultimate-guideline/05-api-data-change-requirements.ko.md

VALIDATION
- 선택한 Epic의 수용 기준을 체크박스로 평가한다.
```

### Phase 0 (0~2주) — 퀵윈: “길 잃지 않게” + “불안 제거” + “안전장치”

목표:

- 탐색(네비)과 컨텍스트(Shop/권한)를 고정해 사용자가 길을 잃지 않게 한다
- 업로드/액션의 실패/불안을 줄여 Activation/TTV를 올린다
- 위험 액션(메일 발송)의 실수 가능성을 낮춘다
- 최소 이벤트 계측으로 이후 개선의 근거를 만든다

범위(에픽 → 태스크):

1. Epic A: Embedded App Shell 통합

- Task A1: `apps/web/src/app/(embedded)/app/layout.tsx` 추가(공통 layout)
  - 산출물: layout + `EmbeddedProviders` 컴포넌트(신규)
  - 수용 기준:
    - `/app/*` 모든 페이지에서 AppProvider/AppBridgeProvider 중복 제거
    - `host`가 없으면 공통 Recover Panel 노출
- Task A2: App Bridge NavigationMenu 추가
  - 산출물: 메뉴 항목 7개(대시보드/업로드/누수/액션/리포트/빌링/에이전시)
  - 수용 기준:
    - 메뉴 클릭 후에도 `host`/`shop` 파라미터 유실 없음
    - 404 라우트로 이동하지 않음(미구현 라우트는 메뉴에서 제외하거나 Coming soon 페이지 제공)

2. Epic B: RBAC 정합성 + Billing 권한 수정

- Task B1: `apps/web/src/lib/auth/roles.ts` 수정
  - 결정(명시):
    - canManageBilling = OWNER only
    - canUpload = OWNER/MEMBER
    - canApproveSend = OWNER/MEMBER (AGENCY_ADMIN 포함 여부는 백엔드 정책 확인 후 결정)
  - 수용 기준:
    - MEMBER로 billing 페이지에서 업그레이드 버튼이 비활성 + 이유가 표시됨(또는 페이지 진입은 가능하나 action이 막힘)
    - 버튼 비활성 시 “Requires OWNER role” 문구가 정확

3. Epic C: Uploads UX 강화(안내/복구/폴링)

- Task C1: 업로드 화면에 고정 안내(포맷/용량/프라이버시)
  - 파일: `apps/web/src/components/uploads-panel.tsx`
  - 수용 기준: 안내가 스크롤 없이 드롭존 근처에 항상 보임
- Task C2: processing 상태 폴링 추가
  - 수용 기준:
    - running 상태 문서가 있으면 5초 폴링
    - running이 없어지면 폴링 중지
- Task C3: 실패 row에 Re-upload CTA + errorCode 매핑
  - 새 유틸: `apps/web/src/lib/api/error-mapping.ts` (신규)
  - 수용 기준:
    - errorCode가 존재하면 “코드 + 사람 언어 해결법”이 표기됨
    - 코드가 없으면 fallback 메시지

4. Epic D: Leak detail 안전/신뢰 강화

- Task D1: dismiss confirm modal + 설명 문구 추가
  - 파일: `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`
  - 수용 기준:
    - dismiss 클릭 시 확인 모달
    - dismiss 후 목록/상세 상태 즉시 반영
- Task D2: toEmail 기본값 제거(빈값) + 입력 검증
  - 수용 기준: 빈 값이면 Create action 버튼 비활성 + 이유 표시

5. Epic E: Actions send 안전장치

- Task E1: Approve & Send confirm modal + 이메일 검증
  - 파일: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
  - 수용 기준:
    - toEmail이 invalid면 승인 불가
    - confirm 모달에 shop 표시
- Task E2: Action 상태 표기 통일(최소한 FAILED 강조)
  - 파일: `apps/web/src/app/(embedded)/app/actions/page.tsx`, `.../actions/[id]/page.tsx`

6. Epic F: 최소 이벤트 계측 도입(4개)

- Task F1: `apps/web/src/lib/analytics/track.ts` 추가 + no-op fallback
- Task F2: 4개 이벤트 호출 삽입
  - dashboard quick action: `apps/web/src/components/embedded-shell.tsx`
  - finding detail view/dismiss: `apps/web/src/app/(embedded)/app/leaks/*`
  - action approved: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
- 수용 기준:
  - 실패 시 UX 영향 없음
  - name/properties 스키마가 문서(`docs/engineering/ANALYTICS_METRICS.md`)와 충돌하지 않음

필요 디자인 시스템/컴포넌트 정리(기존 Polaris + lw-\*)

- 그대로 사용/강화:
  - Polaris: Page, Layout, Card, Banner, Modal, Toast, Badge, Skeleton
  - LeakWatch: `StatePanel`, `MetricCard`, `StatusWidget`, `ActionTile`, `StoreSwitcher`
- 신규 제안(Phase 0에서 최소 구현):
  - `EmbeddedProviders`(AppProvider/AppBridgeProvider + NavigationMenu + Context Guard)
  - `useEmbeddedContext()` 훅(host/shop)
  - `error-mapping` 유틸

API/백엔드 요구사항(Phase 0에서 “필수”만)

- (권장) 모든 에러 응답에 `errorCode`를 포함
  - 확인 불가(가정): 현재 API가 errorCode를 반환하는지
  - 검증: `/v1/shops/{shopId}/documents`에 의도적으로 큰 파일 업로드 시 응답 JSON 확인
- 이벤트 수집 endpoint
  - ASSUMPTION: `/v1/events`가 아직 없을 수 있음
  - 대안 1: PostHog client-side만 먼저 붙이고(서버 필요 없음) 이벤트 수집
  - 대안 2: API에 `POST /v1/events` 추가(DB events 테이블)
  - 최소 스키마(문서 기반 `docs/engineering/ANALYTICS_METRICS.md`):
    - { name: string, occurredAt?: ISO, properties?: json } + auth context(orgId/shopId/userId는 서버에서 주입)

---

### Phase 1 (2~6주) — MVP 고도화: “설정/문서 상세/상태 추적”을 제품 수준으로

목표:

- “신뢰/설명가능성”을 문서 단위까지 확장
- 설정/권한/플랜/쿼터를 실제 운영 UX로 연결
- 액션 수동 상태 업데이트(WaitingReply/Resolved) 제공
- 리포트의 가독성을 올려 재방문/공유를 강화

범위(에픽 → 태스크):

1. Epic G: `/app/settings` 구현(US-03)

- Task G1: Settings UI 라우트 추가
  - 파일: `apps/web/src/app/(embedded)/app/settings/page.tsx` (신규)
  - 필드:
    - contactEmail (필수)
    - currency (기본 USD)
    - timezone (기본 Asia/Seoul)
  - 수용 기준:
    - GET/PATCH 성공/실패/로딩 상태 표준(StatePanel/Banner)
    - OWNER만 수정 가능, MEMBER/VIEWER는 read-only + 이유 표시
- API 요구:
  - `GET /v1/shops/:shopId/settings`
  - `PATCH /v1/shops/:shopId/settings` body: { contactEmail, currency, timezone }
  - error: AUTH_FORBIDDEN, TENANT_MISMATCH 등 (근거: `docs/api/ERROR_CODES.md`)

2. Epic H: Documents detail 라우트 구현

- Task H1: `/app/documents/[documentId]` 구현
  - 파일: `apps/web/src/app/(embedded)/app/documents/[documentId]/page.tsx` (신규)
  - 기능:
    - versions 리스트(최신/이전)
    - status 타임라인(Extract/Normalize/Detect)
    - errorCode/errorMessage 표시 + 재업로드 유도
    - normalized rawJson(토글)
    - lineItems 테이블(가능하면)
    - 원본 다운로드(버전 단위)
- API 요구(확인 불가(가정) → 검증 필요):
  - `GET /v1/documents/{id}` (openapi에 존재)
  - 원본 다운로드 endpoint가 없다면 추가:
    - `GET /v1/documents/{documentId}/versions/{versionId}/download` → { url: presignedGetUrl }

3. Epic I: Action 수동 상태 업데이트(US-43)

- Task I1: UI 버튼 추가(WaitingReply/Resolved)
  - 파일: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
  - 수용 기준:
    - 버튼 클릭 시 즉시 상태 반영
    - 감사로그/권한 에러 시 명확한 메시지
- API 요구:
  - `POST /v1/action-requests/:id/status` body: { status: "WAITING_REPLY"|"RESOLVED" } (정확한 enum은 팀에서 확정)
  - 또는 `PATCH /v1/action-requests/:id`로 확장(문서와 일치시키기)

4. Epic J: 리포트 UX 개선(weekly/monthly + 읽기 쉬운 요약)

- Task J1: reports 목록에 탭(Weekly/Monthly)
  - 데이터모델: ReportPeriod WEEKLY/MONTHLY(근거: `docs/architecture/DATA_MODEL.md`)
- Task J2: report detail 요약 카드 + raw JSON 토글
- API 요구(확인 필요):
  - `/v1/reports?period=WEEKLY|MONTHLY` 필터 지원(없으면 추가)

5. Epic K: 플랜/쿼터 UX 전면화

- Task K1: Layout에서 billing current 로드(권한/성능 고려)
  - 업로드/발송 버튼에 quota 기반 disable + upgrade CTA
- API 요구:
  - `GET /v1/billing/current?shopId=...` (현재 billing UI에서 사용 중)
  - 필드: limits/usage (이미 구현된 것으로 보임)

테스트/QA(Phase 1부터는 필수)

- 프론트 E2E 최소 2개(Playwright 도입 권장):
  - 업로드 → 상태 갱신 → leaks 생성 확인(스텁 가능)
  - action detail → approve confirm → 성공/실패 상태 표시
- 기존 CI 게이트 유지: `.github/workflows/ci.yml` (lint/typecheck/test/build)

---

### Phase 2 (6주+) — 확장: 에이전시 포털/자동 수집/고급 신뢰 & 공유

목표:

- 에이전시/멀티스토어 운영 흐름 완성
- 입력 자동화(이메일 포워딩), 설치 앱 목록 동기화, 리포트 공유(Export) 강화
- 제품의 “절감 성과”를 구조적으로 측정/증명

범위:

1. Epic L: Agency 외부 포털 라우트 구현(문서/step-13 기반)

- `/agency/login`, `/agency`, `/agency/shops/[shopId]`, `/agency/reports`
- 권한: AGENCY_VIEWER read-only, AGENCY_ADMIN 제한적 write(정책 확정)
- 근거: `docs/engineering/UI_UX.md`, `docs/steps/step-13-non-step-gap-closure.md`, `docs/operations/SECURITY_PRIVACY.md`

2. Epic M: 설치 앱 목록 동기화 + UNINSTALLED_APP_CHARGE 강화

- 근거: `docs/product/PRD.md`(L-05), `docs/operations/INTEGRATIONS_SHOPIFY.md`

3. Epic N: Report export (PDF/CSV) + sharing

- 근거: `docs/architecture/DATA_MODEL.md` report.storageKey

4. Epic O: Inbound email parsing (V1)

- 근거: `docs/product/PRD.md`, `docs/product/ROADMAP.md`

---
