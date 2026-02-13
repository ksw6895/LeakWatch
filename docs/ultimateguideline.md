# LeakWatch — UI/UX 진단 + 개선 설계 + 실행 문서 (개발팀용 Ultimate Comprehensive)
문서 기준일: 2026-02-13 (KST)  
레포 스냅샷 근거: `AGENTS.md`에 기록된 commit `00d1a20`, branch `main` (레포 내 `AGENTS.md`)  
주요 근거 문서/코드(핵심):
- 제품/요구: `docs/product/PRD.md`, `docs/product/ROADMAP.md`, `docs/product/PRICING_AND_UNIT_ECONOMICS.md`
- UX 설계/가이드: `docs/engineering/UI_UX.md`, `docs/engineering/FRONTEND_REVAMP_HYPER_VISOR.md`
- 데이터모델/상태: `docs/architecture/DATA_MODEL.md`, `docs/architecture/INGESTION.md`, `docs/architecture/DETECTION_RULES.md`, `docs/architecture/ACTIONS_AUTOMATION.md`
- 운영/보안/Shopify: `docs/operations/SECURITY_PRIVACY.md`, `docs/operations/INTEGRATIONS_SHOPIFY.md`
- 웹 구현(Next.js/Polaris/App Bridge):
  - 라우팅: `apps/web/src/app/page.tsx`, `apps/web/src/app/(embedded)/app/**/page.tsx`
  - 공통 쉘: `apps/web/src/components/embedded-shell.tsx`
  - 업로드 UI: `apps/web/src/components/uploads-panel.tsx`
  - 공통 상태 패널: `apps/web/src/components/common/StatePanel.tsx`
  - 대시보드 위젯: `apps/web/src/components/dashboard/*`
  - 스토어 전환: `apps/web/src/components/StoreSwitcher.tsx`
  - API fetch: `apps/web/src/lib/api/fetcher.ts`
  - embedded 네비: `apps/web/src/lib/navigation/embedded.ts`
  - 권한 유틸: `apps/web/src/lib/auth/roles.ts`
  - 전역 스타일: `apps/web/src/app/globals.css`
- 구현 갭/우선순위: `docs/audits/AUDIT_2026-02-13.ko.md`, `docs/steps/step-13-non-step-gap-closure.md`
- CI/품질 게이트: `.github/workflows/ci.yml`, `docs/engineering/TESTING_QA.md`

---

## 1) 제품/사용자/핵심 플로우 정의 (레포 기반)

### 1.1 이 제품이 해결하는 “사용자 문제” (1~3문장)
Shopify 스토어가 성장할수록 앱/SaaS 구독·청구서가 여러 채널(Shopify invoice, 카드명세, SaaS 인보이스, 이메일 등)로 파편화되어 “중복 결제/해지 후 과금/급등” 같은 비용 누수를 놓치고 반복 손실이 발생한다.  
LeakWatch는 인보이스 파일(PDF/CSV/이미지)을 업로드하면 AI가 표준화(JSON)하고 누수 후보를 “근거(Evidence) 포함”으로 탐지하며, 환불/해지/다운그레이드 요청 이메일 초안과 증빙 패키지를 만들어 “승인 1번”으로 실행·추적까지 연결한다. (근거: `docs/product/PRD.md`, `docs/architecture/INGESTION.md`, `docs/architecture/DETECTION_RULES.md`, `docs/architecture/ACTIONS_AUTOMATION.md`)

### 1.2 핵심 사용자 페르소나(ICP) + 목표/고통점
근거: `docs/product/PRD.md`, `docs/architecture/DATA_MODEL.md`, `docs/operations/SECURITY_PRIVACY.md`

1) **D2C 운영 Owner(=OrgRole OWNER)**
- 목표: 앱/툴 지출을 빠르게 줄이고(절감액), 팀의 리소스(시간)를 아끼며, “무엇을 해지/환불 요청해야 하는지” 확신을 얻는다.
- 고통점: 인보이스가 흩어져 있고(메일/카드/Shopify), 근거 정리/대조가 번거롭고, 벤더 커뮤니케이션(메일)과 증빙 첨부가 귀찮다.
- 기대 UX: “첫 세션에서 가치(TTV)”, 다음 행동이 명확, 실수(잘못 발송/잘못 무시) 방지.

2) **운영/재무 담당 Member(=OrgRole MEMBER)**
- 목표: 업로드/정리/추적을 운영 업무 루틴으로 만들고, 벤더에 정확한 근거를 포함해 커뮤니케이션.
- 고통점: 파일 업로드 실패/파싱 실패 시 원인 불명, 누수 탐지의 신뢰도/설명 부족, 액션 발송 이후 상태 추적이 산발적.
- 기대 UX: “상태(Processing, Failed) 불안 제거”, 실패 복구 경로 명확, 액션 상태 전이(QUEUED→SENT→DELIVERED/FAILED) 한 눈에.

3) **에이전시/컨설턴트(=OrgRole AGENCY_ADMIN / AGENCY_VIEWER)**
- 목표: 여러 스토어를 묶어 누수/절감 기회를 롤업 보고(클라이언트별 Top 5), 반복 업무 자동화.
- 고통점: 스토어 컨텍스트 혼동, 권한·책임 범위 불명확(발송 권한), 리포트 출력/공유가 부족.
- 기대 UX: 멀티샵 컨텍스트 고정, 롤업과 개별샵 Drill-down 연결, 읽기/쓰기 권한 경계가 UI에서 분명.

4) **읽기 전용 Viewer(=OrgRole AGENCY_VIEWER 또는 VIEWER)**
- 목표: 리포트/누수 목록을 확인하고 의사결정(승인/거절) 근거를 얻는다.
- 고통점: 버튼이 왜 비활성인지 이해 못함, 데이터/근거 탐색이 어렵다.
- 기대 UX: “비활성 + 이유” 표준, 읽기 중심 정보 구조.

> 주의: 프론트 권한 유틸(`apps/web/src/lib/auth/roles.ts`)은 현재 `OWNER/MEMBER/VIEWER`만 적극 처리하며, 데이터모델/보안 문서의 `AGENCY_ADMIN/AGENCY_VIEWER`와 불일치 가능성이 큼(개선 항목 P0로 다룸). (근거: `docs/architecture/DATA_MODEL.md`, `docs/operations/SECURITY_PRIVACY.md`, `apps/web/src/lib/auth/roles.ts`)

### 1.3 핵심 사용자 여정(온보딩→연동→업로드/수집→분석→액션→리포트/알림→재방문 루프)
근거: `docs/product/PRD.md`, `docs/engineering/UI_UX.md`, `apps/web/src/app/page.tsx`, `apps/web/src/app/(embedded)/app/**`

1) **온보딩/연동**
- Shopify에서 앱 설치 → embedded 앱 오픈
- 세션/host 컨텍스트 확보(Shopify App Bridge session token 기반) → `GET /v1/auth/me`로 org/shop/user/roles 식별
- (가정/확인 필요) 초기 설정(통화/타임존/contactEmail) 입력 (`docs/product/PRD.md` US-03)  
  - 현재 UI에는 `/app/settings` 루트가 미구현(파일 404 확인) → “갭”으로 처리

2) **데이터 업로드/수집**
- `/app/uploads`: 파일 선택/드롭 → `POST /v1/shops/{shopId}/documents` → presigned PUT → `POST /v1/documents/{documentId}/versions/{versionId}/complete`
- 업로드/처리 상태 확인(문서 버전 status: CREATED→UPLOADED→EXTRACTION_RUNNING→...→DONE)  
  - 상태 정의 근거: `docs/architecture/DATA_MODEL.md`의 `DocStatus` enum, `docs/architecture/INGESTION.md`

3) **분석/탐지**
- Worker 파이프라인: EXTRACT→NORMALIZE→DETECTION
- `/app/leaks`: 누수 후보 리스트(OPEN/DISMISSED/RESOLVED/REOPENED) + savings/confidence + evidence 존재
- `/app/leaks/[id]`: 상세에서 “왜 누수인지(템플릿)” + evidence pointer/excerpt 확인

4) **액션(메일/증빙/승인/추적)**
- Finding 상세에서 액션 draft 생성 → `/v1/findings/{findingId}/actions`  
- `/app/actions/[id]`: 이메일 편집 후 승인(Approve & Send) → `/v1/action-requests/{id}/approve`  
- Mailgun webhook으로 delivered/failed 추적

5) **리포트/알림**
- `/app/reports`: 주간/월간 리포트 목록(현재 구현은 월간 버튼 중심)  
- `/app/reports/[id]`: 리포트 상세(현재는 summary 일부 + raw JSON 출력)

6) **재방문 루프**
- 월간/주간 리포트 확인 → 신규 누수/재발(REOPENED) 대응 → 추가 업로드/액션 수행  
- (권장) 대시보드에서 “즉시 할 일(Processing, Quota, Draft actions)”을 10초 내 파악하는 루프

---

## 2) 현재 UI/UX “문제 리스트” (집요하게) + 개선 설계
형식: 각 항목에 (관찰 / 왜 문제 / 영향도+빈도+리스크 / 최소 개선안 / 이상적 개선안 / 검증 방법) 포함  
우선순위 표기: P0(즉시), P1(중요), P2(개선), P3(후순위)

### 2.0 빠른 인덱스(요약)
- 앱 쉘/네비/컨텍스트: P0-01~P0-05
- 업로드/문서 파이프라인: P0-06~P1-10
- 누수 목록/상세/신뢰: P0-11~P1-15
- 액션(메일/증빙/추적): P0-16~P1-21
- 리포트/빌링/설정: P0-22~P1-26
- 권한/보안/접근성/관측: P0-27~P2-35
- 모바일/퍼포먼스/일관성: P1-36~P2-40

---

### P0-01) “공통 App Shell” 부재로 페이지별 Provider/레이아웃이 중복되고 UX 일관성이 깨짐
- 관찰(어디서): 대부분의 페이지가 `AppProvider` + `AppBridgeProvider` + `Suspense` 래핑을 각 `page.tsx`에서 반복  
  - 예: `apps/web/src/app/(embedded)/app/leaks/page.tsx`, `.../actions/page.tsx`, `.../reports/page.tsx`, `.../settings/billing/page.tsx`, `.../agency/page.tsx` 등
  - 반면 대시보드는 `apps/web/src/components/embedded-shell.tsx`에서 별도 쉘 조합
- 왜 문제인가:
  - 네비/헤더/스토어 컨텍스트/권한 배너 등 “공통 요소”가 페이지마다 다르게 보이며, UX 신뢰를 훼손
  - 네트워크 호출(특히 `/v1/auth/me`)이 중복되어 체감 성능·로딩 깜빡임 증가
- 영향도: High / 빈도: High / 리스크:  
  - 회귀 리스크: 레이아웃을 바꿀 때 페이지별 버그 파편화  
  - 임베디드 제약(host/shop 유실) 대응이 분산됨
- 최소 개선안(0~2주):
  - `apps/web/src/app/(embedded)/app/layout.tsx` 신설(서버 layout) + 내부에서 `EmbeddedProviders`(클라이언트 컴포넌트)를 사용해 모든 `/app/*` 페이지를 공통 래핑
  - `EmbeddedProviders`에서:
    - `@shopify/polaris`의 `AppProvider` (translations 포함)
    - `@shopify/app-bridge-react`의 `Provider`(config 생성)
    - 공통 `NavigationMenu`(App Bridge) 또는 상단 헤더(Polaris) 제공
    - 공통 “host missing / auth error” 가드 패널 제공
  - 각 페이지에서는 Provider 제거하고 “콘텐츠만” 렌더링하도록 리팩터링
- 이상적 개선안(2~6주):
  - `EmbeddedShell`을 “Dashboard 전용 위젯 컨테이너”로 축소하고, App Shell의 책임(헤더/네비/컨텍스트/권한/배너)을 모두 `layout.tsx`로 승격
  - 공통 데이터(`AuthMe`, `BillingCurrent`)를 Layout 레벨에서 preload/caching하여 페이지들에서 hook으로 재사용
- 검증 방법:
  - 시각 회귀: 주요 페이지 스냅샷(대시보드/업로드/누수/액션/리포트/빌링) 비교
  - 성능: 한 세션에서 `/v1/auth/me` 호출 횟수 감소(목표: 페이지 이동당 0~1회)
  - 버그 방지: `host` 파라미터 유실 케이스 재현 테스트(네비 메뉴 클릭/스토어 전환/직접 URL 입력)

---

### P0-02) 전역 네비게이션/정보 구조(IA)가 약해 “다음 행동” 탐색 비용이 큼
- 관찰:
  - 현재는 대시보드의 Quick actions(추정: `embedded-shell.tsx`) 중심이며, 다른 페이지로 이동하는 일관된 메뉴/탭이 없음(혹은 페이지마다 다름)
  - `docs/engineering/UI_UX.md`는 페이지 맵을 정의하지만, 실제 UI에서 항상 접근 가능하다는 보장이 없음
- 왜 문제인가:
  - Shopify 운영자는 “앱 안에서도 Admin과 동일한 탐색 안정감”을 기대(Polaris + App Bridge 관례)
  - 특히 누수 탐지 앱은 “업로드→결과→액션” 퍼널이 길어, 네비가 곧 전환율
- 영향도: High / 빈도: High / 리스크:  
  - 기능이 있어도 못 찾음(Activation/TTV 하락)
- 최소 개선안:
  - App Bridge `NavigationMenu` 도입(권장: `EmbeddedProviders` 내부)
  - 메뉴 항목 고정:
    - Dashboard(`/app`)
    - Uploads(`/app/uploads`)
    - Leaks(`/app/leaks`)
    - Actions(`/app/actions`)
    - Reports(`/app/reports`)
    - Billing(`/app/settings/billing`)
    - Agency(`/app/agency`) — 멀티샵 권한/플랜에 따라 조건부 노출
  - 각 링크는 `host`/`shop` 파라미터 유지: `apps/web/src/lib/navigation/embedded.ts`의 `buildEmbeddedUrl()` 사용
- 이상적 개선안:
  - 메뉴 외에도 “현재 컨텍스트(Shop)”를 항상 헤더에 고정(스토어 배지 + Switcher)
  - 페이지 헤더에 breadcrumb/Back 링크 표준화(예: leaks 목록→상세)
- 검증 방법:
  - 퍼널 지표: `app.opened → uploads` 이동률 상승, `leaks list → leak detail` CTR 상승
  - UX 테스트: “대시보드에서 리포트 찾기” 10초 내 성공률 목표 90%+

---

### P0-03) 멀티스토어 컨텍스트가 페이지 전반에 고정되지 않아 “내가 어느 스토어를 보고 있는지” 혼동
- 관찰:
  - `StoreSwitcher`는 존재(`apps/web/src/components/StoreSwitcher.tsx`)하지만, 실제로 모든 페이지에 노출되는 구조가 아님(대시보드 외 페이지에는 import 흔적 없음)
  - Agency/Org-level 롤업(`/app/agency/page.tsx`)는 “합산/개별” 혼동 가능성이 높음
- 왜 문제인가:
  - 멀티샵(에이전시/멀티 브랜드)에서는 “컨텍스트 혼동”이 가장 위험(잘못된 벤더에 잘못된 메일 발송, 잘못된 누수 dismiss 등)
- 영향도: High / 빈도: Med~High(멀티샵일수록) / 리스크: High
- 최소 개선안:
  - App Shell 헤더에 항상 “현재 Shop 표시 + Switcher” 고정
  - 페이지 상단(Polaris Page title 영역)에 Shop badge를 항상 노출(예: `[shopDomain] Leaks`)
  - `/app/agency`는 “Org Rollup View”임을 배너로 강조(합산값/개별값)
- 이상적 개선안:
  - “Shop pinning” UX: Switcher에서 선택한 shop을 localStorage에 저장(단, host/session token과 충돌하지 않도록 주의)  
    - ASSUMPTION: 한 org에서 여러 shop을 볼 수 있는 세션 컨텍스트가 존재(검증: `/v1/shops` 응답과 session token의 shopId가 어떻게 연동되는지 확인)
  - 잘못된 컨텍스트 위험 액션(Approve & Send, Dismiss)에는 “Shop 확인 1회” 모달 제공
- 검증 방법:
  - 사용자 테스트: 멀티샵 상황에서 “A shop finding을 B shop에서 처리” 실수율 0% 목표
  - 로그: `finding.dismissed` 이벤트에 shopId 포함, shop mismatch 탐지 룰(서버)

---

### P0-04) `/app/settings` 및 `/app/documents/[documentId]` 등 문서/PRD 상 핵심 라우트가 실제로는 미구현(404) → 제품 신뢰 하락
- 관찰:
  - `docs/engineering/UI_UX.md`에 `/app/documents/[documentId]`, `/app/settings`가 정의
  - 그러나 실제 파일이 없음(404 확인):
    - `apps/web/src/app/(embedded)/app/settings/page.tsx` → 404
    - `apps/web/src/app/(embedded)/app/documents/[documentId]/page.tsx` 류 → 404
  - 또한 `docs/steps/step-13-non-step-gap-closure.md`에서도 settings/agency 라우트 확장을 “갭”으로 명시
- 왜 문제인가:
  - 업로드 실패/정규화 결과를 “문서 단위”로 디버깅/검증할 경로가 없어 신뢰/설명가능성(Explainability)이 떨어짐
  - 설정(통화/타임존/contactEmail) 미구현은 리포트/메일 품질과 직결
- 영향도: High / 빈도: High / 리스크: High(심사/유료전환/신뢰)
- 최소 개선안:
  - 라우트가 당장 구현이 어렵다면:
    - 네비/Quick action에서 해당 링크를 제거하거나 “Coming soon(why)” 페이지를 제공(404 방지)
  - 업로드 페이지(`/app/uploads`)에서 최소한의 “문서 상세 Drawer/Modal” 제공:
    - status, errorCode, errorMessage, documentVersionId, createdAt
- 이상적 개선안(2~6주):
  - `/app/documents/[documentId]` 구현:
    - 최신 version + 이전 versions 리스트
    - status 타임라인(Extract/Normalize/Detect)
    - rawJson(정규화) / lineItems 테이블
    - 오류 시 errorCode 기반 재시도/재업로드 가이드
    - 원본 다운로드(권한 체크 + presigned GET)
  - `/app/settings` 구현:
    - currency/timezone/contactEmail 편집 + 저장
- 검증 방법:
  - 업로드 실패 시 “원인 파악→재업로드” 성공률(실패 반복률 감소)
  - CS 문의 감소(“왜 실패했나요?”)
  - 설정 저장 후 리포트 통화/타임존 반영 확인

---

### P0-05) host/session 컨텍스트 누락 시 페이지별 대응이 분산되어 빈 화면/무반응 위험
- 관찰:
  - 일부 페이지는 `host`가 없으면 `StatePanel`을 보여주지만, 패턴이 페이지마다 다름(각 page.tsx에 구현)
  - `embedded-shell.tsx`에서도 host missing 처리 존재
- 왜 문제인가:
  - Shopify embedded 앱은 “host 파라미터 유지”가 절대 조건인데, 실제 사용자 상황에서는 새 탭/북마크/리다이렉트 등으로 host가 빠질 수 있음
  - 이 때 “왜 안 되는지” 안내가 없으면 앱이 고장 난 것으로 인식
- 영향도: High / 빈도: Med / 리스크: High
- 최소 개선안:
  - App Shell 레벨에서 `useEmbeddedContext()` 훅을 제공하고, host 없을 때는 모든 페이지에서 동일한 “Recover Panel”을 노출
  - Recover Panel 필수 내용:
    - “Shopify Admin에서 LeakWatch 앱을 다시 열어주세요”
    - “URL에 host 파라미터가 필요합니다” (단, 기술 용어는 보조 텍스트)
    - “Reload” 버튼 + “Go to Shopify Admin Apps” 안내(가능하면 deep link)
- 이상적 개선안:
  - host missing을 단순 안내가 아니라 “자동 복구 시도”:
    - App Bridge `Redirect`로 앱 재로딩(가능한 범위)
    - ASSUMPTION: App Bridge Redirect가 이 컨텍스트에서 항상 동작(검증: 실제 embedded iframe)
- 검증 방법:
  - host 없는 URL로 접근 시, 사용자 테스트에서 복구 성공률 90%+
  - 이벤트: `app.context_missing` 발생률 추적(추후 감소)

---

### P0-06) 업로드 UX: 파일 제한/지원 포맷/프라이버시 안내가 약하고 실패 복구가 “불안”을 유발
- 관찰:
  - 업로드 UI는 `apps/web/src/components/uploads-panel.tsx`에 구현(드롭존/리스트/상태)
  - `docs/architecture/INGESTION.md`는 파일 제한(20MB/20pages 등 ASSUMPTION)과 실패 복구 UX를 명시
  - `docs/api/ERROR_CODES.md`는 실패 사유(UNSUPPORTED_MIME, FILE_TOO_LARGE, PDF_TEXT_EXTRACTION_EMPTY 등)를 정의
  - 현재 UI는 error message를 보여주지만(InlineError 등), “무엇을 하면 해결되는지”가 코드/문서만큼 구체적이지 않음
- 왜 문제인가:
  - 업로드 실패는 Activation을 직접 깨는 핵심 지점
  - 인보이스에는 민감정보가 있어 “안전”에 대한 명시가 없으면 업로드 자체를 회피
- 영향도: High / 빈도: High / 리스크: High
- 최소 개선안:
  - 드롭존 아래에 고정 텍스트(항상 노출):
    - 지원 포맷: PDF/CSV/JPG/PNG
    - 최대 크기: 20MB(ASSUMPTION이므로 실제 제한을 API/worker와 맞춘 값으로 확정해야 함)
    - 개인정보 보호: “파일은 private storage에 저장되며(링크: Security/Privacy), 이메일/카드번호 등은 LLM 전송 전 마스킹”(근거: `docs/operations/SECURITY_PRIVACY.md`)
  - 실패 row에 “Re-upload(새 버전)” CTA 제공(문서: `docs/architecture/INGESTION.md`)
  - errorCode가 존재하면 함께 표기 + 해결 가이드(예: FILE_TOO_LARGE → “20MB 이하로 압축/분할”)
- 이상적 개선안:
  - “업로드 전 체크” 인터랙션:
    - 파일 크기/확장자 검증(프론트)
    - PDF 페이지 수(가능하면) 사전 체크
  - 실패 유형별 가이드 모달:
    - PDF_TEXT_EXTRACTION_EMPTY: “스캔본일 가능성이 있어요. 더 선명한 파일/이미지로 업로드”
    - NORMALIZATION_SCHEMA_INVALID: “표준화 실패. CSV 템플릿 입력” 옵션 제공(ASSUMPTION: CSV 템플릿 제공 정책 수립 필요)
- 검증 방법:
  - Activation(A1): 설치 후 24h 내 업로드 1건 이상 비율(근거: `docs/engineering/ANALYTICS_METRICS.md`)
  - 업로드 실패율, 실패→재시도→성공 전환율
  - 파일 업로드 전 이탈률(드롭존 뷰 대비 upload_initiated 이벤트)

---

### P0-07) 문서 처리 상태(Extract/Normalize/Detect)가 “자동 갱신/추적”되지 않아 사용자가 새로고침/불신
- 관찰:
  - 문서 status는 `DocStatus`로 단계가 많음(근거: `docs/architecture/DATA_MODEL.md`)
  - 업로드 페이지는 목록을 한 번 fetch하고, 완료 직후 한 번 refresh하는 패턴으로 보임(`uploads-panel.tsx`)
- 왜 문제인가:
  - 실제 처리 파이프라인은 비동기이며(최대 몇 분), 사용자는 “지금 진행 중인지/멈췄는지”를 알고 싶어함
- 영향도: High / 빈도: High / 리스크: Med
- 최소 개선안:
  - `/app/uploads`에서 running 상태가 있는 동안 자동 폴링(예: 5초 간격, 최대 2분 또는 running이 없어질 때까지)
  - 폴링 중에는 상단에 “Processing… 자동 업데이트 중” 배너/스피너
  - running 단계별 친화적 라벨:
    - EXTRACTION_RUNNING → “Extracting text”
    - NORMALIZATION_RUNNING → “Normalizing invoice”
    - DETECTION_RUNNING → “Detecting leaks”
- 이상적 개선안:
  - status 타임라인 UI(단일 문서 row 확장) + 예상 소요시간(과장 금지)
  - 백엔드에서 “stageProgress(0~1)”를 제공하면 더 정교(ASSUMPTION: worker가 진행률을 저장하도록 확장 가능)
- 검증 방법:
  - 업로드 후 “페이지 새로고침” 비율 감소
  - TTV: 첫 업로드 후 30분 내 finding 생성률(T1) 상승(근거: `docs/engineering/ANALYTICS_METRICS.md`)

---

### P0-08) 업로드 시 `vendorHint` 입력 경로 부재로 정규화/탐지 정확도 및 사용자 통제력이 낮음
- 관찰:
  - API 요청 스키마에 `vendorHint` 존재(근거: `docs/api/OPENAPI.yaml`의 CreateDocumentUploadRequest, `docs/architecture/DATA_MODEL.md`의 Document.vendorHint)
  - 그러나 업로드 UI(`uploads-panel.tsx`)에서 vendorHint 입력/전송이 확인되지 않음(코드 상 request body에 fileName/mimeType/byteSize/sha256 중심)
- 왜 문제인가:
  - 벤더명이 애매한 인보이스/카드명세에서 vendorHint는 탐지 품질을 끌어올리는 “사용자 제공 신호”
  - 사용자에게 “내가 무엇을 올렸는지/어느 벤더인지” 통제감을 준다
- 영향도: Med~High / 빈도: High / 리스크: Med
- 최소 개선안:
  - 업로드 폼에 `Vendor (optional)` 입력 추가(기본값 빈값, placeholder 예: “Klaviyo, Recharge…”)
  - `POST /v1/shops/{shopId}/documents` body에 `vendorHint` 포함
  - 목록 테이블에 vendorHint 컬럼 추가(문서: `docs/engineering/UI_UX.md`에서도 vendorHint 표기)
- 이상적 개선안:
  - 자동 제안: 파일명에서 vendor 후보 추출 + 기존 Vendor registry(vendors) 기반 autosuggest(ASSUMPTION: vendor list endpoint가 있거나 추가 가능)
- 검증 방법:
  - NORMALIZATION_FAILED 비율 감소
  - vendor canonicalization 정확도(벤더별 alias 매칭 성공률) 개선

---

### P0-09) 문서 목록에서 “실패 원인 + 재업로드”가 즉시 보이지 않아 복구 경로가 길다
- 관찰:
  - `docs/architecture/INGESTION.md`: 실패 시 UI에서 “재시도(새 version 업로드) 버튼 + 실패 사유” 권장
  - 현재는 상태 뱃지/에러 텍스트가 있어도 “행동(CTA)” 연결이 약함(정확한 UI는 구현 확인 필요)
- 왜 문제인가:
  - 사용자는 실패 후 “다음 클릭”을 바로 해야 하는데, 어디서 해야 할지 모르거나 다시 파일 선택부터 헤매게 됨
- 영향도: High / 빈도: Med / 리스크: Med
- 최소 개선안:
  - 실패 상태 row에 `Re-upload` 버튼(파일 선택 창 열기) 제공  
  - 실패 사유는 `errorCode` + 한 줄 해결법(예: “FILE_TOO_MANY_PAGES: 20p 이하로 분할 업로드”)
- 이상적 개선안:
  - “같은 Document에 새 version 업로드” 흐름 제공(현재 API가 DocumentVersion 개념을 갖고 있으므로 UI로 expose)
- 검증 방법:
  - 실패 문서 중 “재업로드 성공” 비율
  - 실패 후 이탈률 감소

---

### P1-10) `/app/documents/[documentId]` 미구현으로 “설명가능성(Explainability)”이 누수/액션 품질에서 끊김
- 관찰:
  - Leak detail에서 evidence는 documentVersionId 기반 pointer를 갖지만(근거: `docs/architecture/DETECTION_RULES.md`, `docs/architecture/DATA_MODEL.md`), 원본 문서로의 자연스러운 탐색 경로가 약함
  - 보고서/누수 상세에서 “근거의 출처(원본 파일/버전)”를 사용자가 재검증하기 어렵다
- 왜 문제인가:
  - 재무/비용 절감은 “감사 가능성(auditability)”이 핵심이며, 근거→원본 연결은 신뢰의 기반
- 영향도: High / 빈도: Med / 리스크: High(신뢰·법적·CS)
- 최소 개선안:
  - Leak detail에서 evidence card에 “View document version” 링크 제공(문서 상세가 없으면 임시 페이지라도)
- 이상적 개선안:
  - Document detail 페이지 구현(항목 P0-04 참조)
- 검증 방법:
  - finding 상세→액션 생성률(F1) 상승
  - 사용자 인터뷰에서 “근거 신뢰” 점수 개선

---

### P0-11) Leaks 목록: 필터/정렬/스캔 최적화가 부족(벤더 필터, 정렬, 우선순위)
- 관찰:
  - `apps/web/src/app/(embedded)/app/leaks/page.tsx`: status/type/min savings 필터는 존재
  - 그러나 `docs/engineering/UI_UX.md`에는 Vendor 필터, Bulk dismiss, 표준 컬럼 정렬 등이 명시
- 왜 문제인가:
  - 누수 탐지 제품에서 목록은 “결정의 시작점”이며, 우선순위(금액/신뢰도/긴급도)를 빠르게 정렬해야 한다
- 영향도: High / 빈도: High / 리스크: Med
- 최소 개선안:
  - Vendor 필터 추가(가능한 데이터: finding.vendor.canonicalName)
  - 정렬 옵션 추가:
    - savings desc (default)
    - confidence desc
    - createdAt desc
  - OPEN/REOPENED 강조(배지 + 행 강조)
- 이상적 개선안:
  - “우선순위 점수” 도입(예: savings * confidence 가중) + 설명(과장 금지)
  - Bulk actions: 다건 dismiss(권한 필요)
- 검증 방법:
  - leaks list에서 상위 5개 finding 상세 진입률 상승
  - 사용자가 “원하는 finding 찾는 시간” 단축(UX test)

---

### P0-12) Leak 상세: “왜 누수인지”가 1스크롤 내 설득되지 않으면 행동(액션/해결)로 이어지지 않음
- 관찰:
  - `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`: evidence는 excerpt+pointerJson을 노출 (좋음)
  - 다만 UI 구조상 “요약→근거→액션”의 정보 계층이 더 명확해야 함(근거: `docs/engineering/FRONTEND_REVAMP_HYPER_VISOR.md`, `docs/engineering/UI_UX.md`)
- 왜 문제인가:
  - 사용자는 “결정”을 해야 한다(메일 발송/무시/해결). 설득 구조가 약하면 “나중에”가 된다.
- 영향도: High / 빈도: High / 리스크: Med
- 최소 개선안:
  - Leak detail 상단 고정 정보:
    - Title, Status badge, Confidence(0~100), Estimated savings(통화)
    - “Rule explanation”(템플릿 문장 2~3줄)
  - Evidence 섹션은 “사람이 읽는 excerpt”와 “감사용 pointer JSON”을 시각적으로 분리(코드블록 vs 카드)
- 이상적 개선안:
  - Evidence를 “중요도 순”으로 정렬(예: 2개 핵심 evidence를 먼저)
  - 원본 파일 다운로드/열람 링크 제공(문서 상세 + presigned GET)
- 검증 방법:
  - finding detail → action request 생성률(F1) 상승
  - dismiss 비율과 resolve 비율의 균형(오탐 감소) 추적

---

### P0-13) Leak 상세 액션 생성: 기본 수신자(toEmail) 하드코딩은 위험하고 사용자 신뢰를 깨뜨림
- 관찰:
  - `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`에서 `toEmail` 기본값이 `finance@example.com` (하드코딩)으로 보임
- 왜 문제인가:
  - 실제 벤더 지원 메일이 아닌 임의 값은 사용자에게 “테스트용/미완성” 인상을 주며, 잘못 발송 위험을 만든다
- 영향도: High / 빈도: High / 리스크: High(오발송/CS/신뢰)
- 최소 개선안:
  - 기본값을 빈 문자열로 변경
  - 입력 필수 안내: “Vendor support email을 입력하세요”
  - (가능하면) vendor registry의 supportEmail 자동 채움:
    - 데이터모델상 `Vendor.supportEmail` 존재(근거: `docs/architecture/DATA_MODEL.md`)
    - API가 finding에 vendor.supportEmail을 포함하지 않으면 추가 필요(아래 API 요구사항 참조)
- 이상적 개선안:
  - Vendor contact 관리 UX:
    - Settings에서 vendor별 supportEmail 저장/수정
    - Finding에서 자동 제안 + “저장” 체크박스
- 검증 방법:
  - action draft 생성 실패율(잘못된 이메일 형식) 감소
  - 사용자 테스트에서 “수신자 입력” 혼란 감소

---

### P1-14) Finding 상태 체계(OPEN/DISMISSED/RESOLVED/REOPENED)와 UI 액션(Dismiss/Resolve/Reopen)이 불완전
- 관찰:
  - 데이터모델: `FindingStatus`에 REOPENED 포함(근거: `docs/architecture/DATA_MODEL.md`)
  - API: dismiss endpoint 존재(`/v1/findings/{findingId}/dismiss`, 근거: `docs/api/OPENAPI.yaml`)
  - step-13에서 “재오픈 규칙(US-32)”이 갭으로 명시(`docs/steps/step-13-non-step-gap-closure.md`)
  - UI에서는 dismiss는 있으나 resolve/재오픈 표시는 제한적(현재 코드 상 목록에서 status 노출은 있음)
- 왜 문제인가:
  - “Dismiss=오탐/무시”와 “Resolved=해결”은 의미가 다름. UX에서 구분이 흐리면 데이터 품질(학습/보고)이 나빠진다.
- 영향도: Med~High / 빈도: Med / 리스크: Med
- 최소 개선안:
  - 목록에서 REOPENED 배지/강조(OPEN보다 더 강하게)
  - Dismiss 버튼에 confirm + “다음부터 리포트에서 제외” 설명
- 이상적 개선안:
  - Resolve 액션 추가(백엔드 endpoint 필요 시 명세)
  - 재오픈 시 “재발” 배너 + 이전 dismiss/resolved 타임스탬프 표시(감사)
- 검증 방법:
  - REOPENED 발생 시 “상세 진입률” 상승
  - 오탐 dismiss 이후 재발 대응률 측정

---

### P1-15) 금액/통화/타임존 표기가 화면마다 일관되지 않음(신뢰 하락)
- 관찰:
  - Shop 모델에 currency/timezone이 존재(근거: `docs/architecture/DATA_MODEL.md`)
  - 일부 화면은 `Intl.DateTimeFormat('en-CA', timeZone: 'UTC')` 등으로 날짜를 출력(`apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`)
  - leaks/actions에서는 createdAt을 toLocaleString으로 출력하는 패턴이 보임
- 왜 문제인가:
  - 재무 UX에서 “금액/기간/타임존”은 핵심이며, 일관성 없으면 계산/해석 오류 가능
- 영향도: Med / 빈도: High / 리스크: Med
- 최소 개선안:
  - `apps/web/src/lib/format/*` 유틸 신설:
    - `formatMoney(amount, currency, locale)`
    - `formatDateTime(value, timezone)` (기본: shop.timezone)
  - 모든 페이지에서 동일 유틸 사용
- 이상적 개선안:
  - Settings에서 timezone/currency 수정하면 전 화면 반영(US-03)
- 검증 방법:
  - 사용자 피드백(“왜 날짜가 다르죠?”) 감소
  - 리포트 기간 인지 오류 감소

---

### P0-16) Actions: “위험 액션(Approve & Send)”에 대한 안전장치(확인/검증/권한/플랜)가 부족
- 관찰:
  - `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`: Approve & Send 실행
  - 권한 체크는 프론트에서 `canApproveSend`로 추정(`apps/web/src/lib/auth/roles.ts`), 그러나:
    - billing/settings는 OWNER만이어야 하는데 현재 `canManageBilling`도 OWNER/MEMBER로 처리(문서 불일치)
    - 플랜/쿼터 기반 차단은 UI에 없음(빌링 정보는 `/app/settings/billing`에서만 조회)
- 왜 문제인가:
  - 잘못된 메일 발송은 “돌이킬 수 없는 행동”이며, 신뢰·법적·스팸 리스크가 있다
  - 권한 부족/쿼터 초과로 서버에서 막히면 UX는 “왜 안 되지?”가 됨
- 영향도: High / 빈도: Med / 리스크: High
- 최소 개선안:
  - Approve & Send 클릭 시 confirm modal(Polaris Modal) 필수:
    - To/CC/Subject 요약
    - 현재 shop 표시
    - “지금 발송됩니다” 경고
  - 이메일 필드 검증:
    - toEmail: required + email format
    - ccEmails: 쉼표 분리 후 각 email format
  - API 실패 시 errorCode 표시(예: RATE_LIMIT_EXCEEDED)
- 이상적 개선안:
  - 플랜/쿼터 gating:
    - Layout에서 BillingCurrent를 로드하고, emails quota 초과 시 Approve 버튼 비활성 + Upgrade CTA
  - “Send test email to myself” 옵션(ASSUMPTION: Mailgun sandbox 또는 internal test 모드 필요)
- 검증 방법:
  - action.approved → action.sent → action.delivered 전환율(F2/F3) 개선
  - 발송 실패율/오발송 CS 감소

---

### P0-17) Actions 상태 표기/필터가 데이터모델과 사용자 언어 사이에서 혼란 가능
- 관찰:
  - 데이터모델은 ActionRequestStatus(DRAFT/APPROVED/CANCELED) + ActionRunStatus(QUEUED/SENDING/SENT/DELIVERED/FAILED/RESOLVED) 2단계(근거: `docs/architecture/DATA_MODEL.md`)
  - UI 목록(`apps/web/src/app/(embedded)/app/actions/page.tsx`)은 status 탭에 SENT 등을 포함(요청 status인지 run status인지 혼재 가능)
- 왜 문제인가:
  - 사용자는 “지금 뭐가 진행 중인지(queued/sent/delivered/failed)”를 단일 축으로 이해한다
  - 내부 모델이 2단계면 UI에서 명확히 합성해야 혼란이 없다
- 영향도: High / 빈도: High / 리스크: Med
- 최소 개선안:
  - UI 표준 상태(1축) 정의:
    - DRAFT
    - APPROVED(QUEUED/SENDING 포함)
    - SENT
    - DELIVERED
    - FAILED
    - RESOLVED(사용자 수동/정산 완료)
    - CANCELED
  - API 응답에 `displayStatus`(또는 `latestRunStatus`)를 포함시키고 UI는 그 값을 사용  
    - ASSUMPTION: 현재 API가 이미 합성 상태를 주고 있을 수 있음(검증: `/v1/action-requests` 응답 스키마 확인)
- 이상적 개선안:
  - 상태 타임라인을 목록에서도 “mini timeline”으로 요약(아이콘/툴팁)
- 검증 방법:
  - 사용자 테스트: “메일이 실제로 나갔나?” 질문 감소
  - 액션 목록에서 상세 진입률 상승(상태 확인 목적)

---

### P1-18) Action detail: Markdown 편집 UX(미리보기/템플릿/금칙어 가이드)가 부족
- 관찰:
  - `docs/architecture/ACTIONS_AUTOMATION.md`는 안전장치(협박/법적 위협 금지, 사실 기반)를 명시
  - UI는 TextField multi-line 기반으로 보이며(문서/코드에서 언급), 미리보기/템플릿 가이드는 제한적
- 왜 문제인가:
  - 이메일 품질은 환불/해지 성공률을 직접 좌우
  - 사용자는 “어떻게 써야 하지?”에 시간을 씀
- 영향도: Med / 빈도: High / 리스크: Med
- 최소 개선안:
  - Body 입력 아래에:
    - 간단한 템플릿 버튼(Refund/Cancel/Downgrade)
    - “톤 가이드” 한 줄(공격적 표현 금지)
  - Markdown preview 토글 제공(Polaris 탭/토글)
- 이상적 개선안:
  - Evidence pack 요약을 자동 삽입하는 “Insert evidence summary” 버튼(중복 삽입 방지)
- 검증 방법:
  - 발송된 이메일의 vendor 응답률(장기 지표)
  - 사용자가 edit 없이 승인하는 비율(템플릿 품질)

---

### P1-19) “Reply-To = contactEmail” 정책(문서)과 UI/설정 미구현으로 커뮤니케이션 회신 경로가 불명확
- 관찰:
  - `docs/architecture/ACTIONS_AUTOMATION.md`: Reply-To는 사용자 contactEmail 권장, 현재 코드 미구현이라고 명시
  - settings에서 contactEmail 관리 기능도 미구현(현재 `/app/settings` 404)
- 왜 문제인가:
  - 벤더가 답장하면 어디로 가는지(누가 처리하는지)가 운영상 매우 중요
- 영향도: Med / 빈도: Med / 리스크: Med
- 최소 개선안:
  - action detail 화면에 “Reply handling 안내” 텍스트 + 권장 contactEmail 설정 CTA(설정이 없으면 billing/settings로라도 유도)
- 이상적 개선안:
  - `/app/settings` 구현 + backend에서 reply-to 적용
- 검증 방법:
  - 사용자 인터뷰: “회신이 어디로 오나요?” 질문 감소

---

### P1-20) Action 수동 상태 업데이트(WaitingReply/Resolved) UX/엔드포인트 갭
- 관찰:
  - PRD US-43: 수동 상태 업데이트(MVP) 명시 (`docs/product/PRD.md`)
  - step-13에서 API/UI 보강 항목으로 명시 (`docs/steps/step-13-non-step-gap-closure.md`)
- 왜 문제인가:
  - 실제 운영은 “발송 이후”가 더 길다. 추적이 없으면 제품이 “메일 보내는 도구”로 축소됨
- 영향도: Med~High / 빈도: Med / 리스크: Med
- 최소 개선안:
  - action detail에 “Mark as WaitingReply / Mark as Resolved” 버튼(권한 필요)  
  - 단, 백엔드 미구현이면 버튼을 숨기지 말고 disabled + “Coming soon + 이유”로 노출(신뢰 유지)
- 이상적 개선안:
  - `POST /v1/action-requests/:id/status`(또는 동등) 구현 + 감사로그
- 검증 방법:
  - 액션의 최종 “Resolved” 전환율(운영 성과) 추적

---

### P0-22) Billing: 권한 정책(OWNER-only)과 UI 유틸 불일치 → 잘못된 노출/실패 경험
- 관찰:
  - `docs/operations/SECURITY_PRIVACY.md`: billing/settings는 OWNER
  - 프론트 `apps/web/src/lib/auth/roles.ts`: `canManageBilling`이 OWNER/MEMBER 모두 true
  - billing 페이지(`apps/web/src/app/(embedded)/app/settings/billing/page.tsx`)는 canManageBilling로 gating
- 왜 문제인가:
  - MEMBER가 업그레이드 버튼을 보고 클릭 → 403 실패(서버가 막으면) = 불필요한 마찰
  - “누가 결제를 관리하는지”는 민감하며, UI에서 명확해야 함
- 영향도: High / 빈도: Med / 리스크: Med
- 최소 개선안:
  - `canManageBilling(roles)`를 OWNER-only로 변경
  - `writeAccessReason()`를 액션별로 분리:
    - billing: “Requires OWNER role”
    - upload/send: “Requires OWNER or MEMBER role”
- 이상적 개선안:
  - roles 타입을 데이터모델에 맞춰 확장:
    - 'AGENCY_ADMIN', 'AGENCY_VIEWER' 포함
  - 권한 매트릭스 표를 UI에도 반영(설정 페이지)
- 검증 방법:
  - billing 페이지에서 403 발생률 감소
  - 권한 관련 CS 감소

---

### P0-23) Billing 업그레이드 플로우: Shopify confirmation(결제 승인) UX가 명시되지 않으면 “안 되는 것처럼” 보임
- 관찰:
  - billing 페이지는 `/v1/billing/subscribe?plan=...` 호출 후 refresh만 수행(코드 상 response 처리 최소)
  - `docs/operations/INTEGRATIONS_SHOPIFY.md`는 “Shopify confirmation URL 반환 → 프론트 redirect”를 명시
- 왜 문제인가:
  - Shopify billing은 사용자 승인이 필요한 UX가 일반적. 승인 화면으로 넘어가지 않으면 사용자는 업그레이드가 실패했다고 인식
- 영향도: High / 빈도: Med / 리스크: High(수익)
- 최소 개선안:
  - subscribe API 응답이 `{ confirmationUrl }`이라면 즉시 redirect(App Bridge Redirect 권장)
  - 로딩 상태: “Shopify billing confirmation으로 이동합니다…”
  - 실패 시 오류 메시지 + 재시도 + “Shopify Billing에서 상태 확인” 안내
- 이상적 개선안:
  - Plan comparison 카드(Free/Starter/Pro) + 현재 사용량에 근거한 추천(“uploads quota 90% 사용 중”)
- 검증 방법:
  - 업그레이드 클릭→결제 승인 화면 도달률
  - 유료 전환율 상승

---

### P1-24) Reports: 목록/상세가 “raw JSON 중심”이라 경영/운영 의사결정에 바로 쓰기 어려움
- 관찰:
  - `apps/web/src/app/(embedded)/app/reports/page.tsx`: Report Hub, generate monthly 버튼, 테이블
  - `.../reports/[id]/page.tsx`: summaryJson 일부 + raw JSON 출력
  - 데이터모델: ReportPeriod WEEKLY/MONTHLY(근거: `docs/architecture/DATA_MODEL.md`), UI는 월간 중심
- 왜 문제인가:
  - 리포트는 “재방문”의 핵심. 사람이 읽기 쉬운 요약이 없으면 제품 가치가 떨어짐
- 영향도: Med / 빈도: High / 리스크: Med
- 최소 개선안:
  - report detail에서 raw JSON은 “토글(Advanced)”로 숨기고, 기본은 카드형 요약:
    - total spend
    - potential savings
    - top findings (title/vendor/savings/confidence)
  - reports 목록에 weekly/monthly 탭 추가(기간 필터)
- 이상적 개선안:
  - PDF/CSV export(데이터모델에 storageKey 존재) + 클라이언트 공유 UX
- 검증 방법:
  - report.viewed 비율, report 재방문율(R2)
  - 리포트에서 leaks/actions로 이어지는 클릭률

---

### P1-25) Agency view(`/app/agency`): 롤업은 있으나 “drill down”이 없어 실무 연결이 약함
- 관찰:
  - `apps/web/src/app/(embedded)/app/agency/page.tsx`: org summary(shopsCount/totalSpend/potentialSavings/topFindingsAcrossShops) 표시
  - top findings에는 shopId만 텍스트로 표시(명확한 shop identity/링크 부족)
- 왜 문제인가:
  - 롤업은 “요약”일 뿐, 실제 행동은 개별 shop의 finding/action에서 일어난다. Drill down이 없으면 장식 대시보드가 된다.
- 영향도: Med / 빈도: Med / 리스크: Med
- 최소 개선안:
  - top finding row 클릭 시 해당 shop context로 leaks detail로 이동
  - shopId 대신 shop domain/displayName 표시(가능하면)
- 이상적 개선안:
  - `/agency` 외부 포털 라우트(`/agency/login`, `/agency/shops/[shopId]`, `/agency/reports`) 구현(문서/step-13에 명시)  
    - 단, 이 문서의 범위가 “UI/UX”이므로, 외부 포털은 6주+ 확장으로 배치
- 검증 방법:
  - agency view에서 leaks detail로 이어지는 CTR

---

### P0-27) RBAC/역할 불일치: 프론트 권한 유틸이 문서/데이터모델과 불일치하여 기능 차단/오노출 위험
- 관찰:
  - 데이터모델 OrgRole: OWNER, MEMBER, AGENCY_ADMIN, AGENCY_VIEWER (근거: `docs/architecture/DATA_MODEL.md`)
  - 보안 문서도 동일(근거: `docs/operations/SECURITY_PRIVACY.md`)
  - 프론트 roles util: `apps/web/src/lib/auth/roles.ts`는 OWNER/MEMBER만 write로 처리, billing도 write로 처리(OWNER-only 아님)
- 왜 문제인가:
  - UI는 “가능/불가”를 정확히 보여야 한다. 불일치면 클릭 실패/업무 혼란
- 영향도: High / 빈도: High / 리스크: High
- 최소 개선안:
  - 역할 타입 확장: `UserRole = 'OWNER' | 'MEMBER' | 'AGENCY_ADMIN' | 'AGENCY_VIEWER' | 'VIEWER' | string`
  - 권한 함수 재정의(문서 기준):
    - canUpload: OWNER | MEMBER
    - canApproveSend: OWNER | MEMBER | (ASSUMPTION: AGENCY_ADMIN 포함 여부는 보안 정책 확정 필요 → 아래 “확인 방법” 제공)
    - canManageBilling: OWNER only
  - 액션별 blockedReason 제공(문구 차별화)
- 이상적 개선안:
  - 백엔드 `/v1/auth/me` 응답에 `permissions: { upload: boolean, send: boolean, billing: boolean }`를 포함해 프론트는 서버를 source-of-truth로 사용(권장)
- 확인 불가(가정) 및 검증 방법:
  - ASSUMPTION A: AGENCY_ADMIN이 실제로 send 권한이 있는지  
    - 검증: API guard(예: `apps/api/src/common/guards/*`)에서 approve endpoint 권한 조건 확인
    - 대안: UI에서는 AGENCY_ADMIN을 read-only로 처리하되, 기능 요구 시 정책 문서 갱신 후 enable
- 검증 방법:
  - 권한 부족(403) 에러율 감소
  - UI에서 disabled 이유가 명확하다는 사용자 피드백

---

### P0-28) 에러/빈 상태/로딩 상태가 화면마다 표현 일관성이 부족(기본은 있으나 표준화 필요)
- 관찰:
  - `StatePanel` 컴포넌트가 존재(`apps/web/src/components/common/StatePanel.tsx`)
  - 그러나 페이지/컴포넌트별로 로딩/에러 표기가 분산(각 page.tsx에 조건문)
- 왜 문제인가:
  - 재무 도구는 “항상 정확히 동작하는 느낌”이 중요. 로딩/에러의 통일감은 신뢰와 직결
- 영향도: Med / 빈도: High / 리스크: Med
- 최소 개선안:
  - StatePanel 표준 스펙 확정:
    - loading: skeleton(Polaris SkeletonPage/SkeletonBodyText 등) 또는 최소 spinner
    - empty: 무엇이 비어있는지 + next action CTA
    - error: 실패 원인 + retry + support link
  - 각 페이지는 StatePanel만 사용(직접 문자열/버튼 난립 금지)
- 이상적 개선안:
  - “Error code dictionary” 연결(에러 코드별 해결법)
- 검증 방법:
  - UX QA 체크리스트(모든 화면에서 loading/empty/error 일관)

---

### P0-29) 프라이버시/보안 신뢰 신호가 UI 표면에 부족(인보이스 업로드 제품의 치명적 약점)
- 관찰:
  - 보안/마스킹/보관 정책은 문서에 상세(`docs/operations/SECURITY_PRIVACY.md`)
  - 그러나 UI 상에서 업로드/액션/리포트 화면에 이러한 안내가 “상시 노출”되는 구조는 확인되지 않음
- 왜 문제인가:
  - 인보이스 업로드는 심리적 장벽이 크며, 신뢰 신호 없으면 Activation이 죽는다
- 영향도: High / 빈도: High / 리스크: High
- 최소 개선안:
  - 업로드 화면 상단에 Polaris `Banner`:
    - “Files stored privately; sensitive fields are masked before AI processing”
    - “Retention: 365 days (MVP fixed)” (근거/정책)
  - Settings(추후)에서 데이터 삭제/정책 링크 제공
- 이상적 개선안:
  - “Security & Privacy” 전용 페이지/모달(요약 + 링크)
- 검증 방법:
  - 업로드 시작률(uploads initiated) 상승
  - 설치 후 업로드까지의 시간 단축

---

### P0-30) 이벤트/로그(분석) 계측이 제품/UX 개선의 근거를 만들지 못하는 상태
- 관찰:
  - 이벤트 설계 문서는 존재(`docs/engineering/ANALYTICS_METRICS.md`)
  - step-13에서 “핵심 이벤트 4종” 최소 도입을 요구(`docs/steps/step-13-non-step-gap-closure.md`)
  - 프론트에는 공통 track 유틸/이벤트 전송 코드가 존재하지 않는 것으로 보임(파일 경로 제안만 존재)
- 왜 문제인가:
  - UX 개선은 “측정 가능한 변화”가 없으면 우선순위/ROI 판단이 불가
- 영향도: High / 빈도: High / 리스크: Med
- 최소 개선안(0~2주):
  - `apps/web/src/lib/analytics/track.ts` 신설:
    - `track(name, properties)`; 실패 시 no-op(UX 방해 금지)
    - 전송은 우선 API endpoint `/v1/events`(가정) 또는 console fallback  
      - ASSUMPTION: 이벤트 수집 endpoint가 아직 없을 수 있음 → 아래 API 요구사항에 명세
  - 최소 이벤트 4종(문서 기준):
    - `dashboard_quick_action_clicked`
    - `finding_detail_viewed`
    - `finding_dismissed`
    - `action_approved_sent`
- 이상적 개선안:
  - PostHog 등 도구 연동(문서에서 추천) 또는 DB events 테이블
- 검증 방법:
  - 이벤트 누락률(전송 실패) < 1%
  - 주요 퍼널(Activation/TTV/Action) 대시보드 구축

---

### P1-31) 접근성(A11y): 일부는 신경 썼으나(키보드 row 클릭 등), Dropzone/커스텀 타일의 표준화 필요
- 관찰:
  - leaks list에서 row 클릭에 keydown 핸들러를 둔 흔적(좋음)
  - ActionTile/Dropzone 등 커스텀 클릭 영역은 ARIA/포커스 처리가 필요(구현 확인 필요)
- 왜 문제인가:
  - Shopify Polaris는 접근성 기반. 앱 심사/신뢰에도 영향
- 영향도: Med / 빈도: Med / 리스크: Med
- 최소 개선안:
  - 모든 클릭 가능한 div를 버튼/링크로 교체 또는 role/aria 적용
  - focus ring을 전 화면에서 일관 적용(`globals.css`의 focus-visible 정책과 연동)
  - Dropzone에:
    - 키보드로 Enter/Space 시 파일 선택 열기
    - aria-label, 설명 텍스트 연결
- 이상적 개선안:
  - 간단한 a11y 자동 검사(Playwright + axe-core) 도입
- 검증 방법:
  - 키보드만으로 업로드→누수 상세→액션 승인 플로우 수행 가능
  - Lighthouse accessibility 점수(목표 90+)

---

### P1-36) 모바일/반응형: 테이블 중심 화면에서 overflow/가독성 저하 가능
- 관찰:
  - UI는 테이블을 많이 사용(uploads/leaks/actions/reports)
  - `docs/engineering/FRONTEND_REVAMP_HYPER_VISOR.md`는 모바일에서 표를 카드형 또는 가로 스크롤 명시 지원 권장
- 왜 문제인가:
  - Shopify 운영자는 모바일로도 간단 확인을 한다(특히 리포트/알림)
- 영향도: Med / 빈도: Med / 리스크: Low~Med
- 최소 개선안:
  - 테이블 컨테이너에 명시적 horizontal scroll + “Swipe to view” 힌트
  - 중요한 열만 모바일에서 노출(예: title/savings/status)
- 이상적 개선안:
  - 모바일 전용 카드 리스트 컴포넌트 제공(공통 Table-to-Card)
- 검증 방법:
  - 모바일 뷰포트 QA, 클릭 타겟 사이즈(44px+) 확보

---

## 3) 개선안 로드맵 (실행 가능 형태)
원칙: “API 계약을 최대한 유지”하되, UX에 필수인 경우만 API 확장(문서에 명시).  
단계: 0~2주(퀵윈), 2~6주(MVP 고도화), 6주+(확장)

---

### Phase 0 (0~2주) — 퀵윈: “길 잃지 않게” + “불안 제거” + “안전장치”
목표:
- 탐색(네비)과 컨텍스트(Shop/권한)를 고정해 사용자가 길을 잃지 않게 한다
- 업로드/액션의 실패/불안을 줄여 Activation/TTV를 올린다
- 위험 액션(메일 발송)의 실수 가능성을 낮춘다
- 최소 이벤트 계측으로 이후 개선의 근거를 만든다

범위(에픽 → 태스크):
1) Epic A: Embedded App Shell 통합
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

2) Epic B: RBAC 정합성 + Billing 권한 수정
- Task B1: `apps/web/src/lib/auth/roles.ts` 수정
  - 결정(명시):
    - canManageBilling = OWNER only
    - canUpload = OWNER/MEMBER
    - canApproveSend = OWNER/MEMBER (AGENCY_ADMIN 포함 여부는 백엔드 정책 확인 후 결정)
  - 수용 기준:
    - MEMBER로 billing 페이지에서 업그레이드 버튼이 비활성 + 이유가 표시됨(또는 페이지 진입은 가능하나 action이 막힘)
    - 버튼 비활성 시 “Requires OWNER role” 문구가 정확

3) Epic C: Uploads UX 강화(안내/복구/폴링)
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

4) Epic D: Leak detail 안전/신뢰 강화
- Task D1: dismiss confirm modal + 설명 문구 추가
  - 파일: `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`
  - 수용 기준:
    - dismiss 클릭 시 확인 모달
    - dismiss 후 목록/상세 상태 즉시 반영
- Task D2: toEmail 기본값 제거(빈값) + 입력 검증
  - 수용 기준: 빈 값이면 Create action 버튼 비활성 + 이유 표시

5) Epic E: Actions send 안전장치
- Task E1: Approve & Send confirm modal + 이메일 검증
  - 파일: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
  - 수용 기준:
    - toEmail이 invalid면 승인 불가
    - confirm 모달에 shop 표시
- Task E2: Action 상태 표기 통일(최소한 FAILED 강조)
  - 파일: `apps/web/src/app/(embedded)/app/actions/page.tsx`, `.../actions/[id]/page.tsx`

6) Epic F: 최소 이벤트 계측 도입(4개)
- Task F1: `apps/web/src/lib/analytics/track.ts` 추가 + no-op fallback
- Task F2: 4개 이벤트 호출 삽입
  - dashboard quick action: `apps/web/src/components/embedded-shell.tsx`
  - finding detail view/dismiss: `apps/web/src/app/(embedded)/app/leaks/*`
  - action approved: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
- 수용 기준:
  - 실패 시 UX 영향 없음
  - name/properties 스키마가 문서(`docs/engineering/ANALYTICS_METRICS.md`)와 충돌하지 않음

필요 디자인 시스템/컴포넌트 정리(기존 Polaris + lw-*)
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
1) Epic G: `/app/settings` 구현(US-03)
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

2) Epic H: Documents detail 라우트 구현
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

3) Epic I: Action 수동 상태 업데이트(US-43)
- Task I1: UI 버튼 추가(WaitingReply/Resolved)
  - 파일: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`
  - 수용 기준:
    - 버튼 클릭 시 즉시 상태 반영
    - 감사로그/권한 에러 시 명확한 메시지
- API 요구:
  - `POST /v1/action-requests/:id/status` body: { status: "WAITING_REPLY"|"RESOLVED" } (정확한 enum은 팀에서 확정)
  - 또는 `PATCH /v1/action-requests/:id`로 확장(문서와 일치시키기)

4) Epic J: 리포트 UX 개선(weekly/monthly + 읽기 쉬운 요약)
- Task J1: reports 목록에 탭(Weekly/Monthly)
  - 데이터모델: ReportPeriod WEEKLY/MONTHLY(근거: `docs/architecture/DATA_MODEL.md`)
- Task J2: report detail 요약 카드 + raw JSON 토글
- API 요구(확인 필요):
  - `/v1/reports?period=WEEKLY|MONTHLY` 필터 지원(없으면 추가)

5) Epic K: 플랜/쿼터 UX 전면화
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
1) Epic L: Agency 외부 포털 라우트 구현(문서/step-13 기반)
- `/agency/login`, `/agency`, `/agency/shops/[shopId]`, `/agency/reports`
- 권한: AGENCY_VIEWER read-only, AGENCY_ADMIN 제한적 write(정책 확정)
- 근거: `docs/engineering/UI_UX.md`, `docs/steps/step-13-non-step-gap-closure.md`, `docs/operations/SECURITY_PRIVACY.md`

2) Epic M: 설치 앱 목록 동기화 + UNINSTALLED_APP_CHARGE 강화
- 근거: `docs/product/PRD.md`(L-05), `docs/operations/INTEGRATIONS_SHOPIFY.md`

3) Epic N: Report export (PDF/CSV) + sharing
- 근거: `docs/architecture/DATA_MODEL.md` report.storageKey

4) Epic O: Inbound email parsing (V1)
- 근거: `docs/product/PRD.md`, `docs/product/ROADMAP.md`

---

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

1) Embedded 제약
- [ ] 페이지 이동 시 `host`/`shop` 파라미터 유실 없음
- [ ] host missing 시 “빈 화면” 없이 Recover Panel 노출
- [ ] apiFetch 사용(직접 fetch 난립 금지): `apps/web/src/lib/api/fetcher.ts`

2) 권한/RBAC/플랜
- [ ] billing/settings는 OWNER-only로 UI 차단 + 이유 표시
- [ ] write 기능(upload/send 등)에서 disabled 시 이유가 사용자 언어로 명확
- [ ] (가능하면) quota 초과 시 사전 차단 + 업그레이드 유도

3) 에러/상태
- [ ] loading/empty/error가 StatePanel/Banner로 일관
- [ ] errorCode가 있으면 코드 + 해결법 표시(사용자에게 actionable)

4) 위험 액션(Approve & Send, Dismiss)
- [ ] confirm modal 존재
- [ ] 이메일 입력 검증(to/cc)
- [ ] 클릭 후 로딩/중복 클릭 방지
- [ ] 실패 시 재시도 경로 제공

5) 접근성/반응형
- [ ] 키보드 내비게이션 가능
- [ ] 클릭 영역이 button/link로 구현되었거나 role/aria 제공
- [ ] 모바일에서 테이블 overflow 처리

6) 관측/로그
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

## 5) API/데이터 변경 요구사항 명세(UX 개선에 필요한 것만, 최소화)
아래는 “프론트 UX를 완성”하기 위해 필요한 최소 API 요구사항이다. 이미 존재하면 “확인 후 재사용”하고, 없다면 추가한다.

### 5.1 Shop Settings (US-03) — 필수(Phase 1)
- GET `/v1/shops/:shopId/settings`
  - response: { currency: string, timezone: string, contactEmail: string }
- PATCH `/v1/shops/:shopId/settings`
  - body: { currency, timezone, contactEmail }
  - response: 동일
- RBAC:
  - read: OWNER/MEMBER/VIEWER/AGENCY_VIEWER (정책 확정)
  - write: OWNER only (권장, 보안 문서 기준)
- 이벤트:
  - `settings.updated { shopId, fieldsChanged[] }`

### 5.2 Documents download (Explainability) — 권장(Phase 1)
- GET `/v1/documents/:documentId/versions/:versionId/download`
  - response: { url: string, expiresAt: ISO }
- 보안:
  - tenant scope 강제(orgId/shopId)
  - presigned TTL 짧게(5분)
- UI:
  - Document detail / Evidence에서 사용

### 5.3 Action manual status update (US-43) — Phase 1
- POST `/v1/action-requests/:id/status`
  - body: { status: "WAITING_REPLY" | "RESOLVED" }
  - response: updated action
- 감사로그:
  - `action.status_updated { actionRequestId, from, to }`

### 5.4 Event ingest endpoint — Phase 0(선택) / Phase 1(권장)
- POST `/v1/events`
  - body: { name: string, properties?: json, occurredAt?: ISO }
  - server inject: orgId, shopId, userId from auth context
- 실패 시: 200/201로 무시 가능(분석이 UX를 방해하면 안 됨)

---

## 6) “확인 불가(가정)” 목록 + 검증 방법
이 문서는 레포 코드/문서를 근거로 작성했지만, 다음은 환경/응답 스키마에 따라 달라질 수 있다.

1) ASSUMPTION: `/v1/action-requests` 응답이 displayStatus/latestRunStatus를 제공하는지
- 검증: 로컬/스테이징에서 API 호출, 실제 JSON 확인
- 대안: 프론트에서 requestStatus + latestRunStatus를 합성(단, latestRunStatus를 가져올 수 있어야 함)

2) ASSUMPTION: 에러 응답이 `{ errorCode, message }` 형태인지
- 검증: 의도적으로 실패 케이스 발생(큰 파일, 미지원 mime) 후 응답 확인
- 대안: 에러 메시지 문자열만으로 우선 표시, 다음 단계에서 API 표준화

3) ASSUMPTION: AGENCY_ADMIN write 권한 범위(특히 approve/send)
- 검증: API guard 및 보안 정책 문서(SECURITY_PRIVACY) 최신 합의
- 대안: 프론트는 보수적으로 read-only로 두고, 정책 확정 후 확장

4) ASSUMPTION: Shopify Billing subscribe API가 confirmationUrl을 반환하는지
- 검증: `/v1/billing/subscribe` 응답 확인
- 대안: API가 302 redirect를 직접 반환하는 방식이면, 프론트는 fetch 대신 window.location로 이동하는 방식으로 조정

---

끝.
