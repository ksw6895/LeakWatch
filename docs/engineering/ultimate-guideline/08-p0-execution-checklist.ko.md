# P0 실행 체크리스트 (분할 문서 기준)

이 문서는 `docs/engineering/ultimate-guideline` 분할 문서를 기준으로 P0 항목만 실행하기 위한 체크리스트다.

## 0) 사용 순서

1. `01-product-user-core-flow.ko.md`로 사용자 여정/우선순위 컨텍스트 고정
2. `02-uiux-problem-list-and-improvements.ko.md`의 P0 항목 범위 확정
3. `03-improvement-roadmap-phases.ko.md`의 Phase 0 Epic(A~F) 기준으로 실행
4. `04-multi-agent-orchestration-playbook.ko.md`의 게이트로 리뷰
5. `05-api-data-change-requirements.ko.md`/`06-assumptions-and-validation.ko.md`로 계약/가정 검증

## 1) P0 범위 체크

- [x] P0-01 App Shell 통합 범위 확정
- [x] P0-02 Navigation/IA 고정 범위 확정
- [x] P0-03 멀티스토어 컨텍스트 고정 범위 확정
- [x] P0-04 404 라우트 대응(제거/Coming soon/대체 UI) 범위 확정
- [x] P0-05 host/session 복구 패널 공통화 범위 확정
- [x] P0-06 업로드 안내/프라이버시/복구 CTA 범위 확정
- [x] P0-07 처리 상태 자동 갱신(폴링) 범위 확정
- [x] P0-08 vendorHint 입력/전송 범위 확정
- [x] P0-09 실패 사유 + 재업로드 즉시 CTA 범위 확정
- [x] P0-11 leaks 필터/정렬 최소 개선 범위 확정
- [x] P0-12 leak 상세 정보 계층(요약/근거/액션) 범위 확정
- [x] P0-13 toEmail 기본값 제거 + 검증 범위 확정
- [x] P0-16 Approve & Send 안전장치 범위 확정
- [x] P0-17 Actions 상태 표기 혼선 제거 범위 확정
- [x] P0-22 billing OWNER-only 정합성 범위 확정
- [x] P0-23 billing confirmation redirect UX 범위 확정
- [x] P0-27 RBAC 불일치 정합화 범위 확정
- [x] P0-28 loading/empty/error 표준화 범위 확정
- [x] P0-29 보안/프라이버시 신뢰 신호 상시 노출 범위 확정
- [x] P0-30 핵심 이벤트 계측 4종 범위 확정

## 2) Phase 0 Epic 실행 체크

### Epic A: Embedded App Shell 통합

- [x] `/app/*` 공통 layout/provider 구조 적용
- [x] 중복 Provider 제거
- [x] host 누락 시 공통 Recover Panel 동작
- [x] 메뉴 이동 시 `host`/`shop` 파라미터 보존

### Epic B: RBAC 정합성 + Billing 권한

- [x] `canManageBilling` OWNER-only 반영
- [x] disabled reason 문구 분리(예: billing vs upload/send)
- [x] MEMBER/VIEWER 관점에서 오노출/오동작 없음

### Epic C: Uploads UX 강화

- [x] 지원 포맷/용량/프라이버시 안내 고정 노출
- [x] processing 상태에서 자동 폴링 + 종료 조건
- [x] 실패 row 재업로드 CTA + errorCode 매핑

### Epic D: Leak detail 신뢰/안전

- [x] dismiss confirm modal 적용
- [x] toEmail 기본값 제거 + 입력 검증
- [x] 상태 반영 및 재시도 경로 확인

### Epic E: Actions send 안전장치

- [x] Approve & Send confirm modal 적용
- [x] to/cc 이메일 형식 검증 적용
- [x] 실패 시 errorCode/재시도 경로 노출

### Epic F: 최소 이벤트 계측 도입

- [x] `dashboard_quick_action_clicked`
- [x] `finding_detail_viewed`
- [x] `finding_dismissed`
- [x] `action_approved_sent`
- [x] 전송 실패 시 UX 비차단(no-op)

## 3) API/가정 동기화 체크

- [x] 에러 응답 `errorCode` 존재 여부 검증
- [x] billing subscribe 응답에서 confirmation URL/redirect 방식 검증
- [x] action request 상태 응답 모델(displayStatus/latestRunStatus) 검증
- [x] AGENCY_ADMIN 권한 범위 정책 검증

## 4) 검증/게이트 체크

- [x] 변경 단위별 수용 기준 체크 완료
- [x] lint/typecheck/test 중 관련 검증 실행
- [x] 위험 액션(Approve & Send, Dismiss) 중복 클릭/실패 경로 검증
- [x] 권한 없는 사용자에서 차단 + 이유 안내 검증
- [x] 문서 동기화(`docs/README.md`, 분할 인덱스, 관련 설계 문서) 완료

## 5) 완료 조건

- [x] P0 대상 항목이 구현 또는 명시적 deferred 상태로 분류됨
- [x] 미해결 가정은 근거와 다음 액션이 기록됨
- [x] PR/체크리스트/검증 로그로 재현 가능한 증거가 남아 있음

## 6) 구현 상태 스냅샷 (2026-02-14)

완료(코드 반영 + 검증 + 커밋/푸시):

- App Shell 공통 레이아웃/Recover Panel/네비게이션 추가
- billing OWNER-only UI 차단 + 별도 reason 문구 적용
- `/app/settings`, `/app/documents/[documentId]` 404 대체 라우트 제공
- Uploads: vendorHint 입력/전송, processing 폴링, 실패 사유 + 재업로드 CTA
- Leak detail: dismiss confirm modal, toEmail 기본값 제거 + 형식 검증
- Actions: Approve & Send confirm modal, to/cc 검증, 상태 수동 업데이트(WaitingReply/Resolved)
- Finding 재탐지 시 DISMISSED/RESOLVED -> REOPENED 전이 + 감사로그
- 핵심 이벤트 4종 계측 + 실패 시 no-op
- Agency 라우트 골격(`/agency/login`, `/agency/shops/[shopId]`, `/agency/reports`) 추가

Deferred/후속(근거 및 액션은 `09-post-step13-p1-p2-backlog.ko.md`로 승격):

- 없음

증거 커밋:

- `6c6563a`
- `9e8ef25`
- `e0c4d6c`
