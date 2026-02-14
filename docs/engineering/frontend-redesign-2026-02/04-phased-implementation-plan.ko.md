# Frontend Redesign Phased Implementation Plan

## 0. 목표

디자인 완성도, 정보 스캔 속도, 액션 전환율을 동시에 높이되, 기존 기능/API 계약은 그대로 유지한다.

핵심 KPI:

- First meaningful action 시간 단축 (Dashboard -> Upload/Leaks/Actions)
- 상세 페이지에서 action 수행 전환율 상승
- 모바일/키보드 사용 시 실패 없는 탐색

## 1. Phase 1 - Foundation (공통 기반)

목표: 디자인 시스템/레이아웃/내비의 기반 계약을 먼저 고정한다.

### 작업 항목

1. 글로벌 토큰 계층 정리

- 파일: `apps/web/src/app/globals.css`
- 변경:
  - semantic token 보강(`surface`, `text`, `status`, `focus`, `table`)
  - hardcoded color 축소
  - focus-visible 스타일 공통 추가

2. embedded 공통 provider/layout 정리

- 파일:
  - `apps/web/src/app/(embedded)/app/layout.tsx`
  - 신규 provider 컴포넌트 (클라이언트)
  - embedded 페이지의 중복 provider 제거
- 변경:
  - AppProvider/AppBridgeProvider 중복 제거
  - 모든 embedded route를 동일 provider 컨텍스트로 통합

3. 내비 active 규칙 개선

- 파일: `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`
- 변경:
  - 상세 경로에서도 상위 섹션 active 인식
  - `aria-current` 부여

### 완료 기준

- embedded 페이지들이 중복 provider 없이 렌더링
- 상세 라우트에서도 현재 섹션 내비가 올바르게 강조
- nav/focus/table interactive 대상에 키보드 포커스 시각 신호가 존재

## 2. Phase 2 - Route-Level Restructure (핵심 라우트)

목표: 실제 사용 빈도가 높은 라우트의 정보 구조와 액션 우선순위를 바로잡는다.

### 작업 항목

1. leaks/actions 목록 상호작용 모델 통일

- 파일:
  - `apps/web/src/app/(embedded)/app/leaks/page.tsx`
  - `apps/web/src/app/(embedded)/app/actions/page.tsx`
- 변경:
  - row click + 내부 View 버튼 중복 제거
  - 단일 명확한 진입 동작 유지

2. detail 페이지 액션 우선순위 재정렬

- 파일:
  - `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`
  - `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
- 변경:
  - primary vs secondary action 그룹 분리
  - 위험 액션(dismiss/send) 시각 강조 균형 조정

3. documents detail 정보 밀도 재구성

- 파일: `apps/web/src/app/(embedded)/app/documents/[documentId]/page.tsx`
- 변경:
  - 요약/히스토리/정규화/raw 영역의 계층 분리
  - 긴 기술 payload 기본 접힘 또는 보조화

### 완료 기준

- leaks/actions 목록에서 조작 모델이 명확하고 중복 없음
- detail 페이지에서 사용자가 "다음 행동"을 즉시 파악 가능
- documents 상세 페이지에서 핵심 정보(버전/상태/결과)를 1~2 스크린 내 스캔 가능

## 3. Phase 3 - Consistency and Responsive Hardening

목표: route 간 균질성, 모바일 대응, 접근성 완성도를 마무리한다.

### 작업 항목

1. table mobile policy 통일

- 파일: `apps/web/src/app/globals.css` + 표 사용 각 route
- 변경:
  - overflow hint 노출 규칙 통일
  - 좁은 화면에서 action cell 밀도 완화

2. settings/agency 디자인 언어 수렴

- 파일:
  - `apps/web/src/app/(embedded)/app/settings/page.tsx`
  - `apps/web/src/app/(embedded)/app/settings/billing/page.tsx`
  - `apps/web/src/app/agency/**/page.tsx`
- 변경:
  - raw HTML 레이아웃 제거
  - 공통 패널/타이포/섹션 구조로 통일

3. motion/accessibility 폴리싱

- 파일: `apps/web/src/app/globals.css` + interactive components
- 변경:
  - reduced-motion 범위 확장
  - hover/focus 상태 균질화

### 완료 기준

- 모든 핵심 라우트가 동일 디자인 언어(레이아웃/타이포/액션 패턴)를 공유
- 모바일에서 표/버튼/내비 탐색이 깨지지 않음
- a11y 핵심 포인트(focus-visible, aria-current, role 일치) 충족

## 4. 리스크 및 완화

1. 리스크: provider 통합 중 AppBridge host 처리 회귀

- 완화: host 없음 fallback은 기존처럼 유지하고, 내비/가드 패널에서 명시 안내 유지

2. 리스크: 대량 라우트 수정 시 회귀 범위 확대

- 완화: phase별로 타입체크/테스트 수행 후 다음 단계 진행

3. 리스크: 디자인 개선 중 기능 흐름 변경 유혹

- 완화: API 호출/상태 머신 로직은 그대로 두고 view 계층만 우선 수정

## 5. 검증 명령

```bash
pnpm --filter @leakwatch/web typecheck
pnpm --filter @leakwatch/web test
pnpm --filter @leakwatch/web lint
```

## 6. 구현 완료 후 기록

완료 시 다음을 `05-execution-summary.ko.md`에 기록한다.

- 실제 반영 파일 목록
- 각 phase의 완료 여부
- 남은 후속 개선(P2) 항목
