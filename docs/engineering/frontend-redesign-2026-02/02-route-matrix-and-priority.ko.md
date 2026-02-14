# Route Matrix and Priority Map (2026-02-14)

## 1. 목적

`apps/web`의 주요 라우트별 디자인 문제를 동일한 관점으로 정리해, 구현 우선순위(P0/P1/P2)와 파일 단위 작업 범위를 즉시 도출한다.

관점 4축:

- 시각 계층(Visual Hierarchy)
- 섹션 리듬(Section Rhythm)
- 구조 일관성(Structure Consistency)
- 반응형/접근성(Responsive + A11y)

## 2. 라우트 매트릭스

| Route                         | 시각 계층 문제                               | 섹션 리듬 문제                                    | 구조 일관성 문제                                      | 반응형/A11y 문제                           | 우선순위 |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ | -------- |
| `/app`                        | status/snapshot/actions가 동급 강조          | 하나의 카드 안에 다층 섹션이 연속                 | 대시보드만 타일형 중심, 목록 라우트와 체계 다름       | action-grid의 좁은 화면 우선순위 없음      | P1       |
| `/app/uploads`                | 업로드 핵심 CTA와 recent docs가 동급         | upload/summary/recent가 명확히 분리되지 않음      | 2개 peer 카드 구조가 다른 라우트와 패턴 다름          | 표 오버플로우 힌트 부재, 복구 셀 밀도 높음 | P0       |
| `/app/leaks`                  | KPI와 필터 블록이 시각적으로 유사            | hero->KPI->필터->표가 동급 느낌                   | row 클릭 + 내부 View 버튼 중복                        | 표 오버플로우 힌트/포커스 보강 필요        | P0       |
| `/app/leaks/[id]`             | 위험 액션(Dismiss)이 상단 1순위로 보임       | 요약/근거/raw pointer가 한 흐름에 밀집            | evidence 카드 안 raw JSON 상시 노출                   | 액션 그룹 모바일 우선순위 없음             | P0       |
| `/app/actions`                | queue KPI와 parse KPI가 동급 강도            | 긴 단일 카드 스택으로 스캔 피로                   | leaks와 동일한 중복 클릭 모델                         | 상태 탭 버튼 다수 래핑 시 예측 어려움      | P0       |
| `/app/actions/[id]`           | 6개 액션이 모두 동일 강조                    | editable/immutable/timeline의 구분 약함           | back/navigation 버튼이 command row에 혼재             | mobile에서 명령 우선순위 붕괴 가능         | P0       |
| `/app/reports`                | primaryAction과 body 필터의 행동축 분리      | summary/filter/table 사이 중간 계층 약함          | report row는 버튼 중심(타 route와 상호작용 모델 상이) | 유일하게 swipe 힌트 있음(일관성 부족)      | P1       |
| `/app/reports/[id]`           | share/export/toggle이 동급 강조              | raw JSON 토글이 레이아웃 점프 유발                | summary fields가 동적 순서 기반                       | 긴 share URL 모바일 가독성 약함            | P1       |
| `/app/settings`               | subtitle/요약 정보가 상대적으로 약함         | hero 이후 실질 섹션 1개에 집중                    | settings nav 시맨틱/동작 불일치                       | nav/action row 래핑 보강 필요              | P1       |
| `/app/settings/billing`       | metrics와 upgrade actions 우선순위 조정 필요 | hero->metrics->action의 전환은 괜찮으나 설명 부족 | general settings와 패턴 차이 큼                       | quota/action 정보의 모바일 스캔 보강 필요  | P1       |
| `/app/agency`                 | top findings가 강조되지만 drill-down 약함    | org summary 이후 행동 연결 섹션 부족              | list만 존재, 표/카드 인터랙션 다양성 부족             | 에러/빈 상태 복구 흐름 약함                | P1       |
| `/app/documents/[documentId]` | 버전/타임라인/정규화/raw가 동급 밀도         | 장문의 고밀도 연속 섹션                           | 표 2개 + 인라인 액션으로 복잡                         | 모바일에서 가독성/탐색 비용 큼             | P0       |
| `/agency/*`                   | raw HTML로 품질 인지 저하                    | 페이지 간 공통 레이아웃 리듬 부재                 | embedded와 디자인 시스템 분리                         | 전역 다크 배경 대비 가독성 취약            | P0       |

## 3. 공통 가로축 문제 (Cross-route)

### X-01. Active nav 신뢰도 부족

- 증상: 상세 라우트에서 상위 섹션 active 상태 소실
- 근거: `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`
- 우선순위: P0

### X-02. 상호작용 모델 중복

- 증상: row 클릭 + View 버튼 병행
- 근거:
  - `apps/web/src/app/(embedded)/app/leaks/page.tsx`
  - `apps/web/src/app/(embedded)/app/actions/page.tsx`
- 우선순위: P0

### X-03. focus-visible 규칙 불균형

- 증상: 일부 컴포넌트만 focus 스타일 보유
- 근거: `apps/web/src/app/globals.css`
- 우선순위: P0

### X-04. 테이블 모바일 패턴 불일치

- 증상: 어떤 페이지는 swipe 힌트, 다수 페이지는 없음
- 근거:
  - `apps/web/src/app/(embedded)/app/reports/page.tsx`
  - 그 외 table 라우트
- 우선순위: P1

## 4. P0 실행 순서

1. agency/embedded 디자인 시스템 통합 기반 정리
2. nav active/컨텍스트/포커스 규칙 정리
3. leaks/actions 목록 상호작용 모델 통일
4. detail 페이지(`leaks/[id]`, `actions/[id]`, `documents/[documentId]`) 정보 밀도 및 액션 우선순위 개선

## 5. 관련 파일 인덱스

- 라우트 엔트리: `apps/web/src/app/(embedded)/app/**/page.tsx`
- 외부 agency 라우트: `apps/web/src/app/agency/**/page.tsx`
- 공통 내비: `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`
- 공통 스타일: `apps/web/src/app/globals.css`
- 공통 컴포넌트:
  - `apps/web/src/components/embedded-shell.tsx`
  - `apps/web/src/components/uploads-panel.tsx`
  - `apps/web/src/components/common/StatePanel.tsx`
  - `apps/web/src/components/settings/SettingsSectionNav.tsx`
