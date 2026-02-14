# External Reference Patterns and LeakWatch Adaptation

## 1. Goal

Collect proven design-system patterns from production React/Next.js dashboard repos and map them to concrete retrofit actions in `apps/web`.

## 2. Reference Set (High Signal)

## 2.1 Token Layering and Theme Alias

- `dubinc/dub`
  - https://github.com/dubinc/dub/blob/59024b211e5efab351bc56d9e76bcc7c7cef6c1d/packages/tailwind-config/themes.css
  - https://github.com/dubinc/dub/blob/59024b211e5efab351bc56d9e76bcc7c7cef6c1d/packages/tailwind-config/tailwind.config.ts
- `openstatusHQ/openstatus`
  - https://github.com/openstatusHQ/openstatus/blob/90c3e39ca2a35740882ae89a9ac423049f50ea93/packages/ui/src/globals.css
- `calcom/cal.com`
  - https://github.com/calcom/cal.com/blob/c21281a55c3d2c047845d37ce36731e7ad64b964/packages/config/theme/tokens.css
- `formbricks/formbricks`
  - https://github.com/formbricks/formbricks/blob/08ac490512cdd61c8cd9b3572135c9b5193e9d24/apps/web/modules/ui/globals.css

Transferable pattern:

- Base token -> semantic alias -> component token 3단계 계층
- 물리값(HEX/RGBA)과 의미값(`--color-*`, `--surface-*`, `--status-*`) 분리

LeakWatch 적용:

- 대상: `apps/web/src/app/globals.css`
- 목표:
  - 직접 색상 literal 최소화
  - 상태 색상/경계/포커스/표 배경을 semantic token으로 통일

## 2.2 Layout and Shell Primitive

- `calcom/cal.com`
  - https://github.com/calcom/cal.com/blob/c21281a55c3d2c047845d37ce36731e7ad64b964/apps/web/modules/shell/Shell.tsx
- `openstatusHQ/openstatus`
  - https://github.com/openstatusHQ/openstatus/blob/90c3e39ca2a35740882ae89a9ac423049f50ea93/apps/dashboard/src/app/%28dashboard%29/layout.tsx
- `formbricks/formbricks`
  - https://github.com/formbricks/formbricks/blob/08ac490512cdd61c8cd9b3572135c9b5193e9d24/apps/web/modules/ui/components/page-content-wrapper/index.tsx
  - https://github.com/formbricks/formbricks/blob/08ac490512cdd61c8cd9b3572135c9b5193e9d24/apps/web/modules/ui/components/page-header/index.tsx

Transferable pattern:

- route-group layout에서 provider + shell + shared context를 고정
- 각 page는 "콘텐츠만" 유지

LeakWatch 적용:

- 대상:
  - `apps/web/src/app/(embedded)/app/layout.tsx`
  - `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`
  - 중복 provider가 있는 각 `page.tsx`
- 목표:
  - AppProvider/AppBridgeProvider 중복 제거
  - 내비/컨텍스트/복구 패널 공통화

## 2.3 Table/Card Primitive Standardization

- `openstatusHQ/openstatus`
  - https://github.com/openstatusHQ/openstatus/blob/90c3e39ca2a35740882ae89a9ac423049f50ea93/packages/ui/src/components/ui/table.tsx
- `dubinc/dub`
  - https://github.com/dubinc/dub/blob/59024b211e5efab351bc56d9e76bcc7c7cef6c1d/packages/ui/src/table/table.tsx
- `formbricks/formbricks`
  - https://github.com/formbricks/formbricks/blob/08ac490512cdd61c8cd9b3572135c9b5193e9d24/apps/web/modules/ui/components/card/index.tsx

Transferable pattern:

- 먼저 표/카드의 기본 primitive와 상태를 표준화하고, 고급 기능은 이후 단계에서 추가

LeakWatch 적용:

- 대상:
  - 표 사용 라우트: `uploads`, `leaks`, `actions`, `reports`, `documents`
  - 카드/상태 컴포넌트: `StatePanel`, `lw-content-box`, `lw-surface`
- 목표:
  - row interaction 정책 단일화
  - 모바일 힌트/오버플로우 정책 통일

## 2.4 Typography Primitive

- `formbricks/formbricks`
  - https://github.com/formbricks/formbricks/blob/08ac490512cdd61c8cd9b3572135c9b5193e9d24/apps/web/modules/ui/components/typography/index.tsx
- `saleor/saleor-dashboard`
  - https://github.com/saleor/saleor-dashboard/blob/a3d1e1997de9a4df67a84d590ce3b2ef470234a8/src/themeOverrides.ts

Transferable pattern:

- 페이지 단위 ad-hoc 타이포 대신 primitive/variant 계약으로 통일

LeakWatch 적용:

- 대상:
  - `lw-title`, `lw-subtitle`, `lw-metric-label`, `lw-metric-value`
  - `Text` variant 사용 패턴 across routes
- 목표:
  - heading/body/hint 스케일을 페이지 간 일관되게 맞춤

## 3. Adaptation Rules (No Rewrite)

1. 기능 로직(API 호출/권한/상태 전이)은 건드리지 않고 시각/구조 계층부터 교정
2. 공통 레이아웃/토큰/상호작용 계약을 먼저 만들고 라우트를 순차 전환
3. 한 번에 모든 표를 갈아엎지 않고 "row interaction -> focus -> mobile hint" 순으로 점진 개선
4. agency 라우트는 embedded와 동일한 디자인 언어로 수렴하되 라우팅/권한 플로우는 유지

## 4. Adoption Checklist

- [ ] semantic token 도입 후 hardcoded color 사용량 감소
- [ ] embedded route provider 중복 제거
- [ ] nav active rule 상세 라우트까지 일관 적용
- [ ] row click vs button click 중복 제거
- [ ] focus-visible 규칙 nav/table/action 모두 커버
- [ ] agency 라우트가 raw HTML 레이아웃에서 디자인 시스템 레이아웃으로 전환
