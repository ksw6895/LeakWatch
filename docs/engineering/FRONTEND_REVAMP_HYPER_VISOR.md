# LeakWatch Frontend Revamp Guideline

Project codename: `Project Hyper-Visor`  
Scope: `apps/web` frontend only (UI/UX, information architecture, visual language, interaction)  
Out of scope: API contracts, worker jobs, DB schema, queue topology, auth semantics

## 1. 문서 목적

이 문서는 LeakWatch 프론트엔드를 단순 관리화면에서 `실시간 금융 보안 관제(Command Center)` 경험으로 고도화하기 위한 실행 가이드다.

### 사용자 가치

- `시간 단축`: 인증 -> 업로드 -> 탐지 -> 액션까지의 경로를 짧게 만든다.
- `신뢰 강화`: 누수 근거(Evidence), 신뢰도(Confidence), 금액(Estimated Savings)을 한 눈에 보여준다.
- `행동 유도`: 읽기 중심 UI에서 액션 중심 UI(Upload, Approve/Send, Resolve/Dismiss)로 전환한다.

### 엔지니어링 원칙

- 백엔드 로직/데이터 계약은 유지한다.
- Shopify Embedded 제약(`host`, `shop`, App Bridge)을 절대 훼손하지 않는다.
- Polaris 기반 일관성을 유지하면서도 LeakWatch 전용 시각 계층을 입힌다.

## 2. 현재 상태(AS-IS) 진단

근거 파일:

- `apps/web/src/components/embedded-shell.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/(embedded)/app/**/*.tsx`

현 상태 요약:

- 공통 CSS 유틸(`lw-*`)이 이미 있고, hero/metric/table 패턴이 각 페이지에 분산되어 있다.
- 페이지별 뷰는 동작하지만, 정보 우선순위(critical -> secondary)가 화면마다 다르게 표현된다.
- 대시보드/리스트는 텍스트 중심이며, `누수 리스크의 긴급도`와 `즉시 액션`이 시각적으로 약하다.
- 데이터 상태(loading/empty/error)의 표현 일관성은 기본 수준이며, CTA 밀도와 명확성은 화면마다 편차가 있다.
- 모션은 entrance 중심으로 제한적이며, 사용자 의사결정에 도움을 주는 상태 전이 모션이 부족하다.

## 3. 타겟 경험(TO-BE) 정의

컨셉: `Glass & Neon HUD`

### 시각 언어

- 유리 질감(반투명 패널), 네온 강조색, 깊은 배경 레이어를 통한 몰입형 대시보드
- 중요한 수치(잠재 절감액, 오픈 액션, 신뢰도)는 크게, 설명 텍스트는 절제

### 인터랙션

- 클릭 가능한 모든 타일/행에 hover/active/focus 상태를 명확히 제공
- 상태 변화(업로드 진행, 액션 승인, 리포트 생성)를 연속적 피드백으로 표현

### 정보 구조

- Dashboard를 Bento Grid 기반으로 재배치
- "현재 위험", "즉시 할 일", "근거/상세 이동" 3축으로 콘텐츠 정렬

## 4. 서비스 특화 UX 원칙 (LeakWatch-specific)

### 4.1 누수 탐지 제품의 신뢰 요소를 우선 노출

- `금액 + 근거 + 신뢰도`를 항상 함께 배치한다.
- 누수 카드/상세에서 근거 없이 금액만 강조하지 않는다.
- Evidence는 원문 excerpt와 pointer(json)를 병치해 감사 가능성(auditability)을 유지한다.

### 4.2 액션 파이프라인 가시성 보장

- 상태 전이를 사용자 언어로 노출한다.
- 예: `DRAFT -> APPROVED -> SENT/FAILED` 타임라인
- 실패는 숨기지 않고 원인(`lastError`)과 재시도 경로를 분리 제공한다.

### 4.3 멀티 스토어/에이전시 사용성을 기본값으로 설계

- `StoreSwitcher`가 있는 화면은 스토어 컨텍스트를 항상 헤더 근처에서 확인 가능해야 한다.
- org 롤업(agency)은 개별 shop의 합산이라는 점을 명시한다.
- 금액/건수는 "전체 합계"와 "우선순위 항목"을 동시에 보여준다.

### 4.4 임베디드 제약 대응

- URL 전환 시 `host`, `shop` 파라미터를 유지한다.
- App Bridge 사용 가능 시 App Bridge를 우선하고, fallback은 현재 방식(window.location) 유지.
- 세션 불일치 경고(예: host missing)는 빈 화면 대신 안내 패널로 처리한다.

## 5. 디자인 시스템 가이드

### 5.1 토큰 계층

1차 토큰(`base`) -> 의미 토큰(`semantic`) -> 컴포넌트 토큰(`component`) 3단계를 사용한다.

### 베이스 컬러 제안

- `--lw-bg-deep`: #0b1220
- `--lw-bg-layer`: #111a2b
- `--lw-surface-glass`: rgba(255,255,255,0.62)
- `--lw-border-glass`: rgba(255,255,255,0.72)
- `--lw-accent-primary`: #2563eb
- `--lw-accent-cyan`: #06b6d4
- `--lw-state-danger`: #ef4444
- `--lw-state-warning`: #f59e0b
- `--lw-state-success`: #10b981
- `--lw-text-strong`: #0f172a
- `--lw-text-muted`: #64748b

### 타이포그래피

- Display: `Space Grotesk`
- Body/UI: `Public Sans`
- 숫자 KPI는 Display 계열 + 좁은 letter spacing(`-0.03em`)
- 라벨/보조텍스트는 대문자 + tracking 확장으로 계층 분리

### 모서리/간격/깊이

- Radius: 12 / 16 / 24의 3단계 고정
- Spacing scale: 4, 8, 12, 16, 24, 32, 40
- Shadow(권장): `0 8px 20px rgba(2, 12, 27, 0.08)`
- Shadow(강조): `0 0 24px rgba(37, 99, 235, 0.28)`

### 5.2 접근성 기준 (필수)

- 본문 텍스트 대비비 최소 4.5:1
- 데이터 강조색만으로 의미를 전달하지 않는다(아이콘/라벨 동시 사용)
- hover 의존 인터랙션은 키보드 포커스로 동등 제공
- `prefers-reduced-motion: reduce` 모션 축소 규칙 유지/확장

### 5.3 글로벌 스타일 운영

- `apps/web/src/app/globals.css`에 토큰과 공통 유틸을 집중한다.
- 인라인 스타일은 줄이고, 반복 패턴은 `lw-*` 클래스로 승격한다.
- Polaris 컴포넌트 위에 커스텀 래퍼를 얹는 방식으로 유지보수성을 확보한다.

예시 스켈레톤:

```css
:root {
  --lw-bg-deep: #0b1220;
  --lw-surface-glass: rgba(255, 255, 255, 0.62);
  --lw-border-glass: rgba(255, 255, 255, 0.72);
  --lw-accent-primary: #2563eb;
  --lw-text-strong: #0f172a;
  --lw-text-muted: #64748b;
}

.lw-glass-panel {
  background: var(--lw-surface-glass);
  border: 1px solid var(--lw-border-glass);
  backdrop-filter: blur(14px);
  border-radius: 24px;
}

.lw-bento-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 24px;
}
```

## 6. 정보 구조와 레이아웃 규칙

### 6.1 Command Center 레이아웃 (Dashboard 기준)

- 상단 Hero(12열): 상태, 인증/세션, 핵심 메시지
- KPI 스트립(4+4+4): 월 지출, 잠재 절감, 오픈 액션
- Quick Actions(12열): 업로드/누수/리포트/액션/에이전시/빌링
- Priority Findings(12열): 상위 누수 목록 + 상세 진입
- StoreSwitcher/메타 섹션(12열)

### 6.2 반응형 기준

- Desktop(>=1280): Bento 12열 유지
- Tablet(>=768): 6열 리플로우
- Mobile(<768): 단일열, CTA 우선 배치
- 표는 모바일에서 카드형으로 단계적 전환하거나 가로 스크롤을 명시 지원

## 7. 화면별 개선 가이드

### 7.1 `/app` Dashboard

핵심 목표:

- 현재 리스크를 10초 내 파악
- 다음 행동(Upload / Verify / View Leaks)을 즉시 수행

데이터 소스(기존 API 유지):

- `/v1/auth/me`
- `/v1/shops/{shopId}/summary`

필수 위젯:

- Hero status widget
- KPI 3종
- Quick Action Dock
- Top Findings (최대 5, 순위/절감액 강조)

상태 규칙:

- `host` 없음: 초기화 패널 + 로딩/재시도 안내
- `summary` 없음: Empty 카드 + 연결 CTA
- API 실패: 오류 문구 + Retry 버튼

### 7.2 `/app/uploads`

핵심 목표:

- 증빙 업로드 성공률 극대화
- 업로드 이후 처리 상태를 불안 없이 추적

가이드:

- 드롭존 시각 피드백 강화(active/focus)
- 업로드 단계(`preparing/uploading/completing/done/error`)를 프로그레스/문구로 고정 노출
- 파일 타입/용량 제한을 드롭존 근처에 고정 텍스트로 배치
- 실패 row에는 `Re-upload` 또는 동일 플로우 재진입 버튼 제공

### 7.3 `/app/leaks` 목록

핵심 목표:

- 누수 우선순위를 빠르게 정렬하고 상세로 진입

가이드:

- 필터 bar(상태/타입/금액 최소치) 도입
- savings, confidence, status를 같은 행에서 스캔 가능하게 정렬
- OPEN/REOPENED는 고대비 강조
- 테이블 행 클릭 영역 확장(버튼만 클릭 가능한 구조 지양)

### 7.4 `/app/leaks/[id]` 상세

핵심 목표:

- "왜 누수인지"를 1스크롤 내 설득
- 곧바로 액션 생성 또는 dismiss 수행

가이드:

- 상단: 제목, 상태, 신뢰도, 절감액
- 본문: 요약 -> 근거 리스트 -> pointer JSON
- 하단 액션: Dismiss / Create action / Back
- pointer JSON은 코드 블록으로, excerpt는 사람이 읽기 쉬운 카드로 분리

### 7.5 `/app/actions` + `/app/actions/[id]`

핵심 목표:

- 아웃바운드 커뮤니케이션의 준비/승인/발송을 안전하게 처리

가이드:

- 목록에서 status별 grouping 또는 탭 제공
- 상세에서 `editable 영역`(to/cc/subject/body)과 `immutable 영역`(finding summary, savings)을 분리
- status timeline에서 실패 이벤트를 시각적으로 강조
- `Approve and send`는 위험 액션이므로 명확한 disabled/loading 상태 필요

### 7.6 `/app/reports` + `/app/reports/[id]`

핵심 목표:

- 기간별 성과를 빠르게 비교하고 상세 리포트를 조회

가이드:

- weekly/monthly 분리 표시
- 생성 버튼은 백그라운드 진행 상태를 피드백(loading + 최근 생성시간 갱신)
- 상세 JSON 출력은 섹션화(요약 KPI, 상위 finding, 원본 JSON 토글)

### 7.7 `/app/agency`

핵심 목표:

- 다중 shop의 누수/절감 기회를 경영 관점으로 요약

가이드:

- Connected shops, total spend, potential savings 3축 고정
- top findings는 shop 식별자 배지와 함께 표시
- 전체합계와 개별 사례를 한 화면에서 연결

### 7.8 `/app/settings/billing`

핵심 목표:

- 사용량 임계치를 사전에 인지하고 적절히 업그레이드

가이드:

- 플랜/상태/쿼터/사용량을 한 카드 안에서 수직 정렬
- 퍼센트만 보여주지 말고 분자/분모 동시 표기
- 업그레이드 액션은 plan별 value proposition 한 줄 설명 추가

## 8. 컴포넌트 구조 가이드

권장 분리:

- `src/components/dashboard/StatusWidget.tsx`
- `src/components/dashboard/MetricCard.tsx`
- `src/components/dashboard/ActionTile.tsx`
- `src/components/common/StatePanel.tsx` (loading/empty/error 공통)

규칙:

- 데이터 fetch 로직과 presentational UI를 분리한다.
- 페이지에서 inline style 남발 대신 className + 토큰 조합을 사용한다.
- 이벤트 핸들러(`goTo`, `onAuthenticate`)는 공통 유틸로 추출 가능한지 우선 검토한다.

## 9. 모션/인터랙션 가이드

- 진입 모션: 섹션 단위 stagger(100~180ms) 유지
- hover 모션: `translateY(-2~-4px)` + border/광원 강화
- 상태 전이(업로드): 진행바와 단계 문구를 항상 동기화
- 상태 전이(액션 승인): 버튼 로딩 + 타임라인 항목 업데이트 애니메이션 적용
- reduced motion 사용자는 모든 모션을 즉시 상태 전환으로 처리

`framer-motion`은 선택 도입:

- 장점: 선언적 전환, layout animation
- 조건: 번들 증가를 허용할 성능 예산이 확인된 경우
- 미도입 시: CSS keyframes + transition으로 동일 UX를 구현

## 10. 기술 가드레일

- `apiFetch` 사용 원칙을 유지한다 (`fetch` 직접 호출 최소화).
- 임베디드 내 API 호출은 `host` 컨텍스트를 항상 전달한다.
- 네비게이션 시 `shop`/`host` 파라미터 유실 금지.
- 백엔드 API 형태를 바꾸지 않고 프론트에서만 매핑/표현을 개선한다.
- 보안 관련 링크/다운로드 URL은 기존 presigned 정책을 존중한다.

### 10.1 권한 기반 UI 정책

- `OWNER`/`MEMBER`: 업로드, 액션 승인/발송, 설정 변경 가능
- `AGENCY_VIEWER`: 읽기 전용(리포트/누수 조회 중심)
- 권한 없는 액션 버튼은 숨기지 말고 disabled + 이유 툴팁으로 제공

## 11. 단계별 실행 계획

Phase 0. Baseline (0.5일)

- 현재 화면 캡처 수집
- 주요 전환 경로 시간 측정(인증/업로드/누수 상세/액션 승인)
- 시각 회귀 기준 스냅샷 확보

Phase 1. Foundation (1일)

- `globals.css` 토큰 체계 정리
- 공통 레이아웃 클래스(`lw-glass-panel`, `lw-bento-grid`) 도입
- loading/empty/error 공통 패널 구현

Phase 2. Dashboard Revamp (1~1.5일)

- `embedded-shell.tsx`를 위젯 조합 구조로 개편
- KPI + Quick Actions + Priority Findings 재배치
- 반응형 레이아웃 적용

Phase 3. Feature Pages Pass (2~3일)

- uploads/leaks/actions/reports/agency/billing 순으로 동일 패턴 확장
- 테이블 시각/상태 체계 통일
- 상세 페이지의 evidence/timeline 가독성 개선

Phase 4. Polish + QA (1일)

- 접근성 점검(포커스, 대비, 키보드 이동)
- 모바일/저해상도 레이아웃 점검
- 성능/번들 체크 및 마무리 조정

## 12. 검증 체크리스트 (DoD)

기능:

- 기존 API 연동 동작이 모두 유지된다.
- `shop`/`host` 파라미터가 페이지 이동 후에도 유지된다.
- 업로드/누수/액션/리포트 핵심 플로우가 회귀 없이 동작한다.

UX:

- Dashboard 첫 화면에서 `리스크/가치/다음 행동`이 명확하다.
- 모든 주요 버튼에 명확한 disabled/loading/hover/focus 상태가 있다.
- loading/empty/error 표현이 전 화면에서 일관된다.

접근성:

- 키보드만으로 주요 플로우 수행 가능
- 색상 외 보조 신호(아이콘/텍스트) 제공
- `prefers-reduced-motion` 환경에서 과도한 애니메이션 없음

품질:

- `pnpm --filter @leakwatch/web lint`
- `pnpm --filter @leakwatch/web typecheck`
- `pnpm --filter @leakwatch/web test`

## 13. 운영 지표 제안

UI 개선 효과 확인을 위해 아래 프론트 이벤트를 추적한다.

- `dashboard_quick_action_clicked` (action path 포함)
- `upload_started`, `upload_completed`, `upload_failed`
- `finding_detail_viewed`, `finding_dismissed`
- `action_draft_saved`, `action_approved_sent`
- `report_generate_clicked`, `report_detail_viewed`

핵심 관찰 지표:

- 첫 유효 액션까지 시간(TTFA, Time To First Action)
- 업로드 성공률
- finding detail -> action draft 전환율
- action draft -> approve 전환율

## 14. 우선 수정 파일 맵

- 디자인 토큰/유틸: `apps/web/src/app/globals.css`
- 대시보드 엔트리: `apps/web/src/components/embedded-shell.tsx`
- 업로드: `apps/web/src/components/uploads-panel.tsx`

라우트 페이지 파일:

- `apps/web/src/app/(embedded)/app/leaks/page.tsx`
- `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`
- `apps/web/src/app/(embedded)/app/actions/page.tsx`
- `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
- `apps/web/src/app/(embedded)/app/reports/page.tsx`
- `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`
- `apps/web/src/app/(embedded)/app/agency/page.tsx`
- `apps/web/src/app/(embedded)/app/settings/billing/page.tsx`

## 15. 결정이 필요한 항목

- `framer-motion` 도입 여부 (번들 예산 vs 개발 속도)
- 대시보드 배경 강도(시각 임팩트)와 Shopify Admin 내 가독성 밸런스
- 테이블 중심 UI를 카드 중심 UI로 전환할 화면 범위
- 다국어(i18n) 확장 시점 (현재 영어 라벨 중심)

## 16. 롤백 전략

- 토큰 변경은 커밋 단위를 분리해 즉시 되돌릴 수 있게 유지
- 대시보드 개편은 feature flag 또는 브랜치 단위로 점진 적용
- 페이지별 revamp 중 장애 발생 시 해당 라우트만 기존 스타일 클래스로 복원

---

이 문서는 `frontend-only revamp`를 위한 기준 문서다.  
개발 시 본 문서와 함께 `docs/engineering/UI_UX.md`, `apps/web/AGENTS.md`를 함께 준수한다.
