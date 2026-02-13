## 4) “초고성능 코딩 에이전트 다수” 오케스트레이션 지시서

### 4.1 에이전트 역할 분담(권장)

목표는 “병렬로 진행해도 충돌이 최소화”되도록 경계를 명확히 잡는 것.

- Agent 1: UX/IA Lead (문서/설계 + PR 리뷰 게이트키퍼)
  - 산출물: 화면 IA, 네비 구조, 공통 상태 규칙, 카피 가이드
  - 주요 파일 영향: `docs/engineering/UI_UX.md` 업데이트(필요 시), PRD/analytics alignment

- Agent 2: App Shell/Navigation Engineer
  - Task: `(embedded)/app/layout.tsx`, `EmbeddedProviders`, NavigationMenu, Context Guard
  - 주요 파일: `apps/web/src/app/(embedded)/app/layout.tsx`(신규), `apps/web/src/lib/navigation/embedded.ts`(활용/확장)

- Agent 3: Uploads UX Engineer
  - Task: 폴링/실패 CTA/errorCode mapping/vendorHint 입력
  - 주요 파일: `apps/web/src/components/uploads-panel.tsx`, `apps/web/src/lib/api/error-mapping.ts`(신규)

- Agent 4: Leaks UX Engineer
  - Task: leaks list 필터/정렬, leak detail dismiss confirm, toEmail 기본값 제거, evidence UI 계층
  - 주요 파일: `apps/web/src/app/(embedded)/app/leaks/page.tsx`, `.../leaks/[id]/page.tsx`

- Agent 5: Actions Safety Engineer
  - Task: approve confirm modal, email validation, 상태 표기 통일
  - 주요 파일: `apps/web/src/app/(embedded)/app/actions/page.tsx`, `.../actions/[id]/page.tsx`

- Agent 6: Billing/Settings Engineer
  - Task: roles 권한 정합성, billing redirect flow, (Phase 1) settings page 구현
  - 주요 파일: `apps/web/src/lib/auth/roles.ts`, `apps/web/src/app/(embedded)/app/settings/billing/page.tsx`, `(Phase1) settings/page.tsx`

- Agent 7: Analytics/Observability Engineer
  - Task: track 유틸 + 4 이벤트 삽입 + (옵션) API endpoint 스펙 정의
  - 주요 파일: `apps/web/src/lib/analytics/track.ts`(신규), 삽입 대상 페이지들

- Agent 8: QA/E2E Engineer
  - Task: 시각 회귀 체크리스트, Playwright 도입(Phase 1), a11y 점검 자동화(선택)
  - 주요 파일: `apps/web` 테스트 셋업, CI 확장(필요 시)

### 4.2 브랜치 전략/PR 규칙(실행 규칙)

- 브랜치 네이밍:
  - `feat/web-shell-nav`
  - `feat/uploads-polling`
  - `feat/leaks-filters`
  - `feat/actions-safety`
  - `chore/roles-rbac-fix`
  - `feat/analytics-track`
- PR 단위:
  - “한 PR = 한 에픽의 한 슬라이스” (리뷰 가능 크기)
  - 파일 변경이 15개 넘으면 PR 분리(원칙)
- 머지 기준:
  - CI 통과 필수(`.github/workflows/ci.yml`: db:deploy, lint, typecheck, test, build)
  - UX Gate(아래 체크리스트) 100% 충족

### 4.3 코드리뷰 체크리스트(필수)

임베디드/금융/메일 발송 UX 특성상, 아래 항목은 누락 금지.

1. Embedded 제약

- [ ] 페이지 이동 시 `host`/`shop` 파라미터 유실 없음
- [ ] host missing 시 “빈 화면” 없이 Recover Panel 노출
- [ ] apiFetch 사용(직접 fetch 난립 금지): `apps/web/src/lib/api/fetcher.ts`

2. 권한/RBAC/플랜

- [ ] billing/settings는 OWNER-only로 UI 차단 + 이유 표시
- [ ] write 기능(upload/send 등)에서 disabled 시 이유가 사용자 언어로 명확
- [ ] (가능하면) quota 초과 시 사전 차단 + 업그레이드 유도

3. 에러/상태

- [ ] loading/empty/error가 StatePanel/Banner로 일관
- [ ] errorCode가 있으면 코드 + 해결법 표시(사용자에게 actionable)

4. 위험 액션(Approve & Send, Dismiss)

- [ ] confirm modal 존재
- [ ] 이메일 입력 검증(to/cc)
- [ ] 클릭 후 로딩/중복 클릭 방지
- [ ] 실패 시 재시도 경로 제공

5. 접근성/반응형

- [ ] 키보드 내비게이션 가능
- [ ] 클릭 영역이 button/link로 구현되었거나 role/aria 제공
- [ ] 모바일에서 테이블 overflow 처리

6. 관측/로그

- [ ] 핵심 이벤트 트래킹 호출 추가(실패 시 no-op)
- [ ] 이벤트에 orgId/shopId/findingId/actionId가 포함(가능한 범위)

### 4.4 품질 게이트(강제)

- 정적: ESLint + Typecheck + Prettier (CI가 이미 수행)
- 테스트:
  - 최소: 기존 vitest 통과 (`pnpm --filter @leakwatch/web test`)
  - Phase 1부터: Playwright E2E 2개 이상
- 퍼포먼스(권장):
  - “첫 화면 로딩”에서 네트워크 중복(`/v1/auth/me`) 감소 확인
  - 폴링은 running 상태에서만 동작, backoff/stop 조건 명확

### 4.5 Definition of Done(DoD) 템플릿

PR마다 아래를 체크해 최종 “완료”를 정의한다.

- 기능(Functional)
  - [ ] 요구된 UX 시나리오 1개 이상을 E2E 또는 수동 스모크로 검증했다(증거: 캡처/로그)
  - [ ] `host`/`shop` 파라미터 유지가 확인됐다
  - [ ] 권한 없는 사용자(ROLE)에서 UI가 올바르게 차단/안내된다

- 품질(Quality)
  - [ ] lint/typecheck/test/build 통과(CI)
  - [ ] 로딩/에러/빈 상태가 UI 표준(StatePanel/Banner)으로 구현됐다
  - [ ] 접근성: 키보드로 주요 플로우 가능, focus 상태 확인

- 관측(Observability)
  - [ ] 관련 이벤트가 track된다(이벤트명/프로퍼티 기록)
  - [ ] 실패 시 UX를 방해하지 않는다(no-op)

- 문서(Documentation)
  - [ ] 변경된 UX가 `docs/engineering/UI_UX.md`와 충돌하지 않도록 업데이트(필요 시)
  - [ ] “확인 불가(가정)”으로 둔 부분이 있으면 검증 결과를 PR에 기록

---

## 에이전트 프롬프트 템플릿

- 문서 범위: 멀티 에이전트 역할 분담, PR 규칙, 품질 게이트, DoD 운영

```text
TASK
- docs/engineering/ultimate-guideline/04-multi-agent-orchestration-playbook.ko.md 기준으로
  이번 작업을 담당 에이전트별로 분배하고, PR 단위를 정의한다.

EXPECTED OUTCOME
- 에이전트별 담당 범위, 파일 경계, 검증 책임
- PR 병합 순서와 게이트 조건

MUST DO
- "한 PR = 한 에픽의 한 슬라이스" 원칙을 지킨다.
- 위험 액션/권한/RBAC/Embedded 제약 점검 항목을 포함한다.
- 결과 보고 시 DoD 체크 상태를 남긴다.

MUST NOT DO
- 동일 파일 동시 수정이 필요한 작업을 병렬 배치하지 않는다.
- CI/QA 게이트를 생략하지 않는다.

CONTEXT
- Phase plan: docs/engineering/ultimate-guideline/03-improvement-roadmap-phases.ko.md
- QA baseline: docs/engineering/TESTING_QA.md

VALIDATION
- 리뷰 체크리스트 4.3, 품질 게이트 4.4, DoD 4.5 충족 여부를 기록한다.
```
