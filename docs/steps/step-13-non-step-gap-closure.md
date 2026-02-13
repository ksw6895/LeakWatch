# Step 13 — Non-step 문서 갭 클로저

문서 기준일: 2026-02-13 (KST)

## 목표

`docs/steps/**` 외 일반 문서(PRD/UI_UX/ARCHITECTURE/ANALYTICS/SECURITY/INTEGRATIONS) 기준으로 남아있는 구현 갭을 수습해 문서-코드 정합성을 높인다.

연계 점검 리포트:

- `docs/audits/AUDIT_2026-02-13.ko.md`

## 범위

### 포함

1. 스토어 설정 API/UI 보강 (US-03)

- 통화/타임존/연락 이메일 조회/수정

2. Finding 재오픈 규칙 구현 (US-32)

- `DISMISSED/RESOLVED` 이후 동일 근거 재발 시 `REOPENED`

3. 액션 수동 상태 갱신 API/UI 보강 (US-43)

- WaitingReply/Resolved 수동 업데이트

4. Agency 라우트 확장

- `/agency/login`, `/agency/shops/[shopId]`, `/agency/reports` 기본 뼈대 + 권한 제약

5. 분석 이벤트 계측 최소 도입

- `dashboard_quick_action_clicked`, `finding_detail_viewed`, `finding_dismissed`, `action_approved_sent`

### 제외

- 인바운드 이메일 자동 파싱(V1)
- 완전 자동 벤더 해지 실행

## 구현 체크리스트

### A. 스토어 설정 관리

- [x] API
  - `GET /v1/shops/:shopId/settings`
  - `PATCH /v1/shops/:shopId/settings`
- [x] DTO 검증: currency/timezone/contactEmail
- [x] RBAC: OWNER/MEMBER write 정책 확인
- [x] Web UI: Settings 페이지에서 수정/저장/오류 상태

권장 파일:

- `apps/api/src/modules/shops/*`
- `apps/web/src/app/(embedded)/app/settings/*`

### B. Finding 재오픈 규칙

- [x] detection upsert 시 기존 `DISMISSED/RESOLVED` finding 재발 조건 정의
- [x] 조건 만족 시 `REOPENED` 전이
- [x] 이력/감사로그 남기기
- [x] 테스트: dismissed -> 재탐지 -> reopened

권장 파일:

- `apps/worker/src/jobs/detection.ts`
- `apps/api/test/*finding*.spec.ts`

### C. Action 수동 상태 갱신

- [x] Action 상태 모델 확장(필요 시 enum)
- [x] `POST /v1/action-requests/:id/status` 또는 동등 엔드포인트
- [x] UI 버튼: WaitingReply/Resolved
- [x] 감사로그 및 권한 차단 테스트

권장 파일:

- `apps/api/src/modules/actions/*`
- `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`

### D. Agency 라우트 확장

- [x] `/agency/login`
- [x] `/agency/shops/[shopId]`
- [x] `/agency/reports`
- [x] 권한 없는 write 액션은 disabled + 이유 표시

권장 파일:

- `apps/web/src/app/agency/**`
- `apps/api/src/modules/agency/*`

### E. 이벤트 계측

- [x] 공통 track 유틸 추가
- [x] 핵심 이벤트 4종 전송
- [x] 실패 시 no-op(사용자 플로우 방해 금지)

권장 파일:

- `apps/web/src/lib/analytics/*`
- `apps/web/src/components/embedded-shell.tsx`
- `apps/web/src/app/(embedded)/app/leaks/*`
- `apps/web/src/app/(embedded)/app/actions/*`

## 테스트/검증

- API: `pnpm --filter @leakwatch/api test`
- Web: `pnpm --filter @leakwatch/web lint && pnpm --filter @leakwatch/web typecheck && pnpm --filter @leakwatch/web test`

필수 검증 케이스:

1. Shop settings 업데이트 후 대시보드/리포트 통화 반영
2. Finding dismiss 후 동일 조건 재발 시 REOPENED
3. Action 수동 상태 전환 및 목록/상세 반영
4. Agency 신규 라우트 권한 차단
5. 이벤트 계측 호출이 렌더링/행동 흐름을 방해하지 않음

## 실행 로그 (2026-02-14)

- 반영 커밋
  - `6c6563a`: Embedded app layout/nav + billing OWNER-only guard + 404 대체 라우트
  - `9e8ef25`: Uploads 복구 UX(vendorHint/polling/error recovery) + Leaks/Actions confirm safety
  - `e0c4d6c`: Shop settings API/UI + action manual status + finding reopened + agency routes + analytics
- 검증 로그
  - API: `pnpm --filter @leakwatch/api lint && pnpm --filter @leakwatch/api typecheck && pnpm --filter @leakwatch/api test`
  - Web: `pnpm --filter @leakwatch/web lint && pnpm --filter @leakwatch/web typecheck && pnpm --filter @leakwatch/web test`
  - Worker: `pnpm --filter @leakwatch/worker lint && pnpm --filter @leakwatch/worker typecheck && pnpm --filter @leakwatch/worker test`

## Definition of Done

- [x] non-step 점검 리포트의 P0/P1 항목이 코드로 반영됨
- [x] API/Web 테스트 통과
- [x] 문서(`PRD`, `UI_UX`, `ANALYTICS_METRICS`)와 구현 불일치 항목 갱신
- [x] 운영/보안 가드레일 위반 없음(tenant scope, RBAC, webhook, secret handling)
