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

## 에이전트 프롬프트 템플릿

- 문서 범위: P0/P1 UI/UX 문제 진단과 최소/이상적 개선안

```text
TASK
- docs/engineering/ultimate-guideline/02-uiux-problem-list-and-improvements.ko.md에서
  지정된 항목 중 이번 스프린트 대상(P0 우선)을 구현 가능한 작업 단위로 분해한다.

EXPECTED OUTCOME
- 작업 단위별 변경 파일, 수용 기준, 검증 방법
- 위험 액션(Approve & Send, Dismiss) 관련 안전장치 반영 계획

MUST DO
- P0 항목 번호(P0-01, P0-02...)를 유지한 채 작업을 매핑한다.
- 각 작업에 사용자 영향(Activation/TTV/신뢰)을 1줄로 기록한다.
- 실패 복구 경로(오류 메시지/재시도/가이드)를 반드시 포함한다.

MUST NOT DO
- P0 구현 중 무관한 UI 전면 개편을 수행하지 않는다.
- 권한 정책이 불명확한 기능을 임의로 enable 하지 않는다.

CONTEXT
- UI baseline: docs/engineering/UI_UX.md
- QA/metrics: docs/engineering/TESTING_QA.md, docs/engineering/ANALYTICS_METRICS.md
- Security: docs/operations/SECURITY_PRIVACY.md

VALIDATION
- 항목별 수용 기준 달성 여부를 체크리스트로 남긴다.
```

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
  - “우선순위 점수” 도입(예: savings \* confidence 가중) + 설명(과장 금지)
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
