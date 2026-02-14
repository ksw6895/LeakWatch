# Frontend Design Problem Audit (2026-02-14)

## 1. 범위 및 조사 방식

- 대상 범위: `apps/web` 전체 (임베디드 라우트, 외부 agency 라우트, 공통 스타일/컴포넌트)
- 조사 방법:
  - 내부 코드 탐색: `explore` 에이전트 3개 병렬 실행
  - 직접 검색: `grep`, `ast-grep`, 파일 단위 정독
  - 외부 레퍼런스 탐색: `librarian` 에이전트 병렬 실행(진행 중 결과 별도 문서 반영)
- 근거 파일(핵심):
  - 스타일 기초: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`
  - 쉘/네비: `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`
  - 대시보드/공통 컴포넌트: `apps/web/src/components/embedded-shell.tsx`, `apps/web/src/components/common/StatePanel.tsx`
  - 주요 라우트: `apps/web/src/app/(embedded)/app/**/page.tsx`
  - 외부 agency 라우트: `apps/web/src/app/agency/**/page.tsx`

## 2. 총평

현재 UI는 기능은 동작하지만, "정보 우선순위", "상호작용 일관성", "반응형/접근성 완성도"가 낮아 사용자가 빠르게 판단하고 행동하기 어렵다.

특히 다음 4가지가 핵심 병목이다.

1. 시각 체계 분열: embedded 폴라리스 기반 UI와 agency의 raw HTML UI가 크게 분리되어 경험이 이질적
2. 상호작용 패턴 불일치: 테이블 행 클릭 + 내부 버튼 중복 등으로 조작 모델이 흔들림
3. 정보 밀도 과다: 상세 페이지(`actions/[id]`, `documents/[documentId]`)에서 중요/부차 정보 계층이 약함
4. 접근성/모바일 부족: 포커스 가시성, 좁은 화면 테이블 대응, 내비 현재 위치 표시가 불완전

## 3. 문제 리스트 (심각도 순)

심각도 기준:

- Critical: 사용성/신뢰에 즉시 큰 손실
- High: 핵심 플로우 전환율과 유지율에 직접 악영향
- Medium: 장기적으로 피로/혼란/회귀 리스크 증가

### 3.1 Critical

#### C-01. agency 영역이 전역 다크 배경 위에 raw 텍스트로 노출되어 가독성과 완성도가 급락

- 근거:
  - 전역 배경/텍스트: `apps/web/src/app/globals.css`
  - raw `<main style={...}>`: `apps/web/src/app/agency/page.tsx`, `apps/web/src/app/agency/login/page.tsx`, `apps/web/src/app/agency/reports/page.tsx`, `apps/web/src/app/agency/shops/[shopId]/page.tsx`
- 문제:
  - 임베디드 화면 대비 agency 화면이 프로토타입처럼 보여 제품 신뢰를 낮춤
  - 페이지 간 이동 시 브랜드/품질 연속성이 끊김

#### C-02. 라우트별 UI 시스템이 2개로 분리(Polaris+lw vs raw semantic HTML)

- 근거:
  - embedded: `apps/web/src/app/(embedded)/app/leaks/page.tsx` 등
  - agency: `apps/web/src/app/agency/**/page.tsx`
- 문제:
  - 동일 제품 내 IA/타이포/컨트롤 affordance가 달라 학습 비용이 증가

### 3.2 High

#### H-01. 전역 스타일 파일 단일 집중(대형)으로 구조적 유지보수 위험

- 근거: `apps/web/src/app/globals.css` (500+ lines)
- 문제:
  - 토큰/컴포넌트/반응형 규칙이 단일 파일에 혼재
  - 작은 수정이 광범위 회귀를 유발하기 쉬움

#### H-02. 색상 토큰 체계가 선언 대비 활용되지 않음 (토큰 무결성 저하)

- 근거: 선언된 `--lw-success`, `--lw-warning`, `--lw-danger` 등 대비 실제 사용 불균형 (`apps/web/src/app/globals.css`)
- 문제:
  - 상태 색 표준화가 어려워 화면별 톤 드리프트 발생

#### H-03. `lw-surface`, `lw-glass-panel`, `lw-content-box`가 유사 역할로 중복

- 근거: `apps/web/src/app/globals.css`
- 문제:
  - 같은 레벨의 카드가 페이지마다 약간씩 다른 깊이/경계감을 보여 일관성 하락

#### H-04. 내비 현재 위치 인식이 상세 라우트에서 약함

- 근거: strict equality active 체크 `pathname === item.href` in `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`
- 문제:
  - `/app/leaks/[id]`, `/app/actions/[id]` 등에서 상위 섹션 맥락이 약해짐

#### H-05. 스토어 컨텍스트 전역 고정이 약함

- 근거:
  - `StoreSwitcher` 사용 위치 편중: `apps/web/src/components/embedded-shell.tsx`
  - 전역 헤더 상시 노출 부재: `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`
- 문제:
  - 멀티 스토어 사용 시 "지금 어느 상점인지" 인지가 떨어짐

#### H-06. 테이블 인터랙션 모델이 중복 (row click + 내부 View 버튼)

- 근거:
  - `apps/web/src/app/(embedded)/app/leaks/page.tsx`
  - `apps/web/src/app/(embedded)/app/actions/page.tsx`
- 문제:
  - 클릭 타겟 우선순위 혼란, 키보드/스크린리더 흐름이 복잡해짐

#### H-07. 상세 페이지 액션 우선순위가 비즈니스 위험도와 불일치

- 근거:
  - leak detail의 액션 순서: `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`
  - action detail의 대량 액션 동급 배치: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
- 문제:
  - 사용자가 먼저 수행해야 할 안전한 작업보다 위험/보조 작업이 동급으로 보임

#### H-08. 문서 상세 페이지 정보 밀도가 과도

- 근거: `apps/web/src/app/(embedded)/app/documents/[documentId]/page.tsx`
- 문제:
  - 버전 히스토리 + 타임라인 + 정규화 + raw JSON이 연속 배치되어 스캔 비용이 큼

### 3.3 Medium

#### M-01. 작은 텍스트/대문자 라벨 의존 비율이 높아 장시간 사용 시 피로 증가

- 근거: `apps/web/src/app/globals.css`

#### M-02. 모션 언어가 단일 진입 애니메이션에 치우침

- 근거: `lw-animate-in`, `@keyframes lw-rise` only in `apps/web/src/app/globals.css`

#### M-03. reduced-motion 대응이 hover/transition 계열까지 포괄하지 않음

- 근거: `@media (prefers-reduced-motion: reduce)` 범위 제한 in `apps/web/src/app/globals.css`

#### M-04. 인터랙티브 요소 포커스 가시성 불균형

- 근거:
  - nav link focus 스타일 부재: `apps/web/src/app/globals.css`
  - action tile focus는 존재

#### M-05. 모바일 테이블 대응이 페이지별로 다름

- 근거:
  - reports만 swipe 힌트 문구 제공: `apps/web/src/app/(embedded)/app/reports/page.tsx`
  - 다수 페이지는 동일 패턴 부재

#### M-06. settings 섹션 네비 시맨틱이 `tablist`지만 라우팅 버튼 동작

- 근거: `apps/web/src/components/settings/SettingsSectionNav.tsx`
- 문제:
  - 접근성 시맨틱과 실제 동작이 불일치

## 4. 즉시 개선 타깃 (P0)

- P0-1: 전역 스타일 토큰/컴포넌트 계층 정리 + focus/responsive 표준화
- P0-2: embedded 헤더/내비 개선(상위 섹션 active, store context 고정)
- P0-3: leaks/actions 목록의 row 클릭 중복 모델 제거
- P0-4: detail 페이지 액션 우선순위 및 정보 밀도 개선
- P0-5: agency 라우트의 디자인 시스템 통합

## 5. 산출물 연계

- 우선순위/라우트 매핑: `docs/engineering/frontend-redesign-2026-02/02-route-matrix-and-priority.ko.md`
- 단계별 구현 계획: `docs/engineering/frontend-redesign-2026-02/03-phased-implementation-plan.ko.md`
- 검증 체크리스트: `docs/engineering/frontend-redesign-2026-02/04-verification-checklist.ko.md`
