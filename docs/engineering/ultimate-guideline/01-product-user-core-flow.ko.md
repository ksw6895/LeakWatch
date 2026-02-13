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

## 에이전트 프롬프트 템플릿

- 문서 범위: 제품 문제 정의, 사용자 페르소나, 핵심 사용자 여정 정렬

```text
TASK
- docs/engineering/ultimate-guideline/01-product-user-core-flow.ko.md를 기준으로
  현재 구현이 핵심 사용자 여정(온보딩→업로드→탐지→액션→리포트)을 어떻게 충족하는지
  갭을 식별하고 우선순위(P0/P1) 제안까지 완료한다.

EXPECTED OUTCOME
- 갭 목록(파일 경로 포함), 우선순위, 즉시 실행 가능한 수정 제안
- 사용자 여정 단계별 성공/실패 시나리오 1개 이상

MUST DO
- 관련 코드/문서 근거 경로를 반드시 명시한다.
- 역할(OWNER/MEMBER/VIEWER/AGENCY)별 영향 차이를 분리해 기록한다.
- 가정이 있으면 "ASSUMPTION"으로 태그한다.

MUST NOT DO
- 근거 없는 추측으로 기능 존재를 단정하지 않는다.
- 문서 범위를 벗어난 대규모 리팩터링 계획을 섞지 않는다.

CONTEXT
- Product: docs/product/PRD.md, docs/product/ROADMAP.md
- Architecture: docs/architecture/DATA_MODEL.md
- Current gap baseline: docs/steps/step-13-non-step-gap-closure.md

VALIDATION
- 제안한 갭 항목이 실제 파일/라우트/API와 매핑되는지 교차 확인한다.
```

## 1) 제품/사용자/핵심 플로우 정의 (레포 기반)

### 1.1 이 제품이 해결하는 “사용자 문제” (1~3문장)

Shopify 스토어가 성장할수록 앱/SaaS 구독·청구서가 여러 채널(Shopify invoice, 카드명세, SaaS 인보이스, 이메일 등)로 파편화되어 “중복 결제/해지 후 과금/급등” 같은 비용 누수를 놓치고 반복 손실이 발생한다.  
LeakWatch는 인보이스 파일(PDF/CSV/이미지)을 업로드하면 AI가 표준화(JSON)하고 누수 후보를 “근거(Evidence) 포함”으로 탐지하며, 환불/해지/다운그레이드 요청 이메일 초안과 증빙 패키지를 만들어 “승인 1번”으로 실행·추적까지 연결한다. (근거: `docs/product/PRD.md`, `docs/architecture/INGESTION.md`, `docs/architecture/DETECTION_RULES.md`, `docs/architecture/ACTIONS_AUTOMATION.md`)

### 1.2 핵심 사용자 페르소나(ICP) + 목표/고통점

근거: `docs/product/PRD.md`, `docs/architecture/DATA_MODEL.md`, `docs/operations/SECURITY_PRIVACY.md`

1. **D2C 운영 Owner(=OrgRole OWNER)**

- 목표: 앱/툴 지출을 빠르게 줄이고(절감액), 팀의 리소스(시간)를 아끼며, “무엇을 해지/환불 요청해야 하는지” 확신을 얻는다.
- 고통점: 인보이스가 흩어져 있고(메일/카드/Shopify), 근거 정리/대조가 번거롭고, 벤더 커뮤니케이션(메일)과 증빙 첨부가 귀찮다.
- 기대 UX: “첫 세션에서 가치(TTV)”, 다음 행동이 명확, 실수(잘못 발송/잘못 무시) 방지.

2. **운영/재무 담당 Member(=OrgRole MEMBER)**

- 목표: 업로드/정리/추적을 운영 업무 루틴으로 만들고, 벤더에 정확한 근거를 포함해 커뮤니케이션.
- 고통점: 파일 업로드 실패/파싱 실패 시 원인 불명, 누수 탐지의 신뢰도/설명 부족, 액션 발송 이후 상태 추적이 산발적.
- 기대 UX: “상태(Processing, Failed) 불안 제거”, 실패 복구 경로 명확, 액션 상태 전이(QUEUED→SENT→DELIVERED/FAILED) 한 눈에.

3. **에이전시/컨설턴트(=OrgRole AGENCY_ADMIN / AGENCY_VIEWER)**

- 목표: 여러 스토어를 묶어 누수/절감 기회를 롤업 보고(클라이언트별 Top 5), 반복 업무 자동화.
- 고통점: 스토어 컨텍스트 혼동, 권한·책임 범위 불명확(발송 권한), 리포트 출력/공유가 부족.
- 기대 UX: 멀티샵 컨텍스트 고정, 롤업과 개별샵 Drill-down 연결, 읽기/쓰기 권한 경계가 UI에서 분명.

4. **읽기 전용 Viewer(=OrgRole AGENCY_VIEWER 또는 VIEWER)**

- 목표: 리포트/누수 목록을 확인하고 의사결정(승인/거절) 근거를 얻는다.
- 고통점: 버튼이 왜 비활성인지 이해 못함, 데이터/근거 탐색이 어렵다.
- 기대 UX: “비활성 + 이유” 표준, 읽기 중심 정보 구조.

> 주의: 프론트 권한 유틸(`apps/web/src/lib/auth/roles.ts`)은 현재 `OWNER/MEMBER/VIEWER`만 적극 처리하며, 데이터모델/보안 문서의 `AGENCY_ADMIN/AGENCY_VIEWER`와 불일치 가능성이 큼(개선 항목 P0로 다룸). (근거: `docs/architecture/DATA_MODEL.md`, `docs/operations/SECURITY_PRIVACY.md`, `apps/web/src/lib/auth/roles.ts`)

### 1.3 핵심 사용자 여정(온보딩→연동→업로드/수집→분석→액션→리포트/알림→재방문 루프)

근거: `docs/product/PRD.md`, `docs/engineering/UI_UX.md`, `apps/web/src/app/page.tsx`, `apps/web/src/app/(embedded)/app/**`

1. **온보딩/연동**

- Shopify에서 앱 설치 → embedded 앱 오픈
- 세션/host 컨텍스트 확보(Shopify App Bridge session token 기반) → `GET /v1/auth/me`로 org/shop/user/roles 식별
- (가정/확인 필요) 초기 설정(통화/타임존/contactEmail) 입력 (`docs/product/PRD.md` US-03)
  - 현재 UI에는 `/app/settings` 루트가 미구현(파일 404 확인) → “갭”으로 처리

2. **데이터 업로드/수집**

- `/app/uploads`: 파일 선택/드롭 → `POST /v1/shops/{shopId}/documents` → presigned PUT → `POST /v1/documents/{documentId}/versions/{versionId}/complete`
- 업로드/처리 상태 확인(문서 버전 status: CREATED→UPLOADED→EXTRACTION_RUNNING→...→DONE)
  - 상태 정의 근거: `docs/architecture/DATA_MODEL.md`의 `DocStatus` enum, `docs/architecture/INGESTION.md`

3. **분석/탐지**

- Worker 파이프라인: EXTRACT→NORMALIZE→DETECTION
- `/app/leaks`: 누수 후보 리스트(OPEN/DISMISSED/RESOLVED/REOPENED) + savings/confidence + evidence 존재
- `/app/leaks/[id]`: 상세에서 “왜 누수인지(템플릿)” + evidence pointer/excerpt 확인

4. **액션(메일/증빙/승인/추적)**

- Finding 상세에서 액션 draft 생성 → `/v1/findings/{findingId}/actions`
- `/app/actions/[id]`: 이메일 편집 후 승인(Approve & Send) → `/v1/action-requests/{id}/approve`
- Mailgun webhook으로 delivered/failed 추적

5. **리포트/알림**

- `/app/reports`: 주간/월간 리포트 목록(현재 구현은 월간 버튼 중심)
- `/app/reports/[id]`: 리포트 상세(현재는 summary 일부 + raw JSON 출력)

6. **재방문 루프**

- 월간/주간 리포트 확인 → 신규 누수/재발(REOPENED) 대응 → 추가 업로드/액션 수행
- (권장) 대시보드에서 “즉시 할 일(Processing, Quota, Draft actions)”을 10초 내 파악하는 루프

---
