# LeakWatch UX 개선 브레인스토밍 -> 선별안 (2026-02-15)

문서 목적: 현재 구현된 기능을 기준으로, 사용자가 실제로 갈증을 느낄 확률이 높은 UX 문제를 선별하고 즉시 실행 가능한 개선안으로 정리한다.

## 1) 현재 제품 의도와 실제 플로우(코드 기준)

LeakWatch의 핵심 의도는 "증빙 업로드 -> 누수 탐지 -> 벤더 액션 실행/추적 -> 리포트"를 하나의 운영 루프로 만드는 것이다.

- 온보딩/임베디드 진입: `apps/web/src/components/embedded-shell.tsx`, `apps/api/src/modules/shopify/shopify.controller.ts`
- 업로드/처리: `apps/web/src/components/uploads-panel.tsx`, `apps/api/src/modules/documents/documents.service.ts`
- 탐지 파이프라인: `apps/worker/src/jobs/ingest.ts`, `apps/worker/src/jobs/normalize.ts`, `apps/worker/src/jobs/detection.ts`
- 액션/증빙팩/발송: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`, `apps/worker/src/jobs/evidence-pack.ts`, `apps/worker/src/jobs/send-email.ts`
- 리포트/공유: `apps/web/src/app/(embedded)/app/reports/page.tsx`, `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`, `apps/api/src/modules/reports/reports.controller.ts`

## 2) 브레인스토밍 프로세스

### 2.1 Divergent(넓게 발산)

아래 관점으로 후보 문제를 먼저 넓게 수집했다.

- 사용자 불안: "지금 시스템이 무엇을 하고 있는지"가 불명확한 지점
- 비가역 행동: 이메일 발송/상태 변경처럼 실수 비용이 큰 지점
- 컨텍스트 혼선: 임베디드 host/shop, 멀티 스토어 전환 지점
- 운영 반복성: 하루에 여러 번 반복되는 화면(uploads/leaks/actions)의 마찰
- 신뢰성 신호: 오류/실패/복구 경로의 명확성

### 2.2 Convergent(실제 갈증 선별)

후보를 아래 기준으로 점수화해 선별했다.

- 빈도(매일/매주 반복 접점인지)
- 불안도(사용자가 상태를 확신하기 어려운지)
- 비용(실수 시 금전/시간/신뢰 손실이 큰지)
- 구현 레버리지(짧은 주기로 개선 가능한지)
- 계측 가능성(개선 전/후를 데이터로 확인 가능한지)

## 3) 수집된 후보(요약)

1. 업로드 "완료"와 분석 "완료" 의미가 혼재
2. 누수/액션/리포트 목록이 백그라운드 변경을 즉시 반영하지 않음
3. 증빙팩 생성 전에도 Approve and send가 눌릴 수 있음
4. 스토어 스위처 전환 후 실제 데이터 컨텍스트 체감이 약함
5. host 파라미터 누락 시 복구 경로가 사실상 재진입만 안내
6. 리포트 상세가 의사결정형 요약보다 raw JSON 탐색에 가까움
7. 쿼터 초과/권한 부족 에러가 행동 직전에만 노출됨
8. 액션 상태 축(ActionRequest vs ActionRun)이 초보 사용자에게 난해함
9. 문서 상세의 처리 단계 설명은 좋지만 다음 행동 추천이 약함
10. 공유 링크 생성/복사 실패에 대한 보조 피드백이 약함

## 4) 최종 선별(사용자 갈증 확률 높은 6개)

## A. 업로드 "완료" 오해: 사용자는 파일 업로드와 분석 완료를 동일하게 인지함

### 현재 관찰

- `uploads-panel`은 `POST /complete` 직후 `Upload complete`를 노출한다: `apps/web/src/components/uploads-panel.tsx`
- 실제 탐지 완료는 worker 파이프라인 이후다: `apps/worker/src/jobs/ingest.ts` -> `apps/worker/src/jobs/normalize.ts` -> `apps/worker/src/jobs/detection.ts`

### 사용자 갈증

- "업로드 완료됐는데 왜 누수가 안 뜨지?"라는 불신이 바로 생긴다.

### 개선안

- 업로드 완료 문구를 "파일 수집 완료, 분석 진행 중"으로 분리
- uploads 리스트에 단계형 배지(Extracting/Normalizing/Detecting/Ready) 고정 노출
- 완료 후 자동으로 문서 상세(`app/documents/[documentId]`)로 deep-link 제시

### 측정 지표

- 업로드 후 10분 내 재시도 업로드 비율
- 업로드 후 leaks 페이지 즉시 이탈률

## B. 증빙팩 준비 전 발송 가능성: 신뢰/법적 리스크가 큰 행동 보호가 약함

### 현재 관찰

- 액션 초안 생성 시 증빙팩 생성 job이 비동기로 돈다: `apps/api/src/modules/findings/findings.controller.ts`, `apps/worker/src/jobs/evidence-pack.ts`
- 액션 상세에서 Approve and send는 attachment 준비 상태와 직접 강결합되어 있지 않다: `apps/web/src/app/(embedded)/app/actions/[id]/page.tsx`, `apps/worker/src/jobs/send-email.ts`

### 사용자 갈증

- "증빙 붙어서 나갔는지"를 확신하기 어렵다.

### 개선안

- Approve and send 버튼 선행조건에 `attachmentKey` 준비 상태를 명시적으로 포함
- 증빙팩 준비 중에는 상태 패널(예: Generating evidence pack...) 고정
- 준비 실패 시 즉시 재시도 버튼 + 원인 코드 표시

### 측정 지표

- 발송 후 "첨부 누락" 관련 수동 수정 비율
- 액션 상세 내 증빙팩 다운로드 클릭률

## C. 리스트 실시간성 부족: 사용자 행동과 시스템 상태가 어긋나 보임

### 현재 관찰

- uploads는 폴링이 있으나, leaks/actions/reports는 초기 로드 중심이다:
  - 폴링 있음: `apps/web/src/components/uploads-panel.tsx`
  - 폴링 약함: `apps/web/src/app/(embedded)/app/leaks/page.tsx`, `apps/web/src/app/(embedded)/app/actions/page.tsx`, `apps/web/src/app/(embedded)/app/reports/page.tsx`

### 사용자 갈증

- 방금 처리된 결과가 안 보이면 "실패했다"고 추정한다.

### 개선안

- 공통 polling/revalidate 훅 도입(상태 변화가 잦은 화면만)
- 서버 상태 변화 시에만 갱신 주기를 짧게, 안정 상태에서는 길게(적응형)

### 측정 지표

- 수동 새로고침/재접속 빈도
- "결과 안 보임" 지원 문의 건수

## D. 스토어 전환 체감 약함: 멀티 스토어 운영자가 컨텍스트를 헷갈리기 쉬움

### 현재 관찰

- 스위처는 query 파라미터를 갱신한다: `apps/web/src/components/StoreSwitcher.tsx`
- 다수 화면에서 실제 조회 키는 `/v1/auth/me` 기반 `shopId`다: 예) `apps/web/src/app/(embedded)/app/leaks/page.tsx`

### 사용자 갈증

- "지금 어느 스토어 데이터를 보는지"가 즉각적으로 확정되지 않는다.

### 개선안

- 상단 고정 컨텍스트 바(Shop domain + org + switched at)
- 전환 직후 데이터 소스 확인 토스트("Now viewing: {shopDomain}")
- 주요 API 호출 직전의 shop context를 dev-safe 로그로 추적

### 측정 지표

- 스토어 전환 직후 back/forward 반복 행동
- 잘못된 스토어에서 액션 생성 후 취소 비율

## E. host 누락 복구 UX 부족: 임베디드 세션 깨짐 시 사용자가 막힘

### 현재 관찰

- 여러 페이지에서 host 누락 시 재진입 안내만 보여준다:
  - `apps/web/src/components/embedded-shell.tsx`
  - `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx`

### 사용자 갈증

- "왜 깨졌는지"와 "어떻게 즉시 복구하는지"를 이해하기 어렵다.

### 개선안

- 세션 복구 패널에 2가지 경로를 분리
  - Shopify Admin에서 다시 열기
  - 재인증 시작(`/v1/shopify/auth/start`) 직접 실행
- 운영 로그용 requestId를 화면에 함께 노출(지원 대응 속도 향상)

### 측정 지표

- host missing 이후 정상 세션 복귀 시간
- 동일 사용자 재발 비율

## F. 리포트의 실행 연결성 부족: "읽고 끝"이 되기 쉬움

### 현재 관찰

- 리포트 상세는 요약 + export/share를 제공하지만, 누수/액션으로의 실행 CTA는 약하다: `apps/web/src/app/(embedded)/app/reports/[id]/page.tsx`

### 사용자 갈증

- 리포트는 봤지만 다음 행동이 막막해진다.

### 개선안

- 리포트 상세에 "Top findings -> 바로 액션 생성" CTA 추가
- 요약 카드 하단에 "이번 기간 즉시 조치 3건" 자동 추천 블록 제공

### 측정 지표

- report detail -> leaks/actions 전환률
- 리포트 조회 후 24시간 내 액션 생성률

## 5) 2주 실행 우선순위 제안

Week 1

- A(업로드 상태 문구/배지), B(증빙팩 준비 게이팅), E(host 복구 패널)

Week 2

- C(적응형 갱신), D(스토어 컨텍스트 강화), F(리포트 실행 CTA)

## 6) 외부 가이드 반영 포인트

- Shopify App Store/임베디드 UX 가이드: 설치/온보딩/내비게이션 마찰 최소화
  - https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
  - https://shopify.dev/docs/apps/design/navigation
- 상태 가시성/진행 안내(사용자 불안 감소)
  - https://www.nngroup.com/articles/visibility-system-status/
  - https://www.nngroup.com/articles/progress-indicators/
  - https://www.nngroup.com/articles/status-tracker-progress-update/
- 파일 업로드 오류/접근성 패턴
  - https://carbondesignsystem.com/components/file-uploader/usage/
  - https://carbondesignsystem.com/components/file-uploader/accessibility/

### 6.1 업로드형 SaaS 벤치마크에서 직접 가져온 실행 규칙

- 제약을 업로드 전 노출(형식/용량/개수):
  - https://design-system.service.gov.uk/components/file-upload/
  - https://designsystem.digital.gov/components/file-input/
- 진행률을 수치로 노출(퍼센트 + 바이트 + 단계):
  - https://uppy.io/docs/status-bar/
  - https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequestEventTarget/progress_event
- 중단/재시도 전제 설계(재개 가능 업로드):
  - https://tus.io/protocols/resumable-upload
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html
  - https://cloud.google.com/storage/docs/resumable-uploads
- 오류는 원인+해결을 함께 제시(일반 실패 문구 금지):
  - https://design-system.service.gov.uk/patterns/validation/
  - https://github.com/react-dropzone/react-dropzone
- 보안/신뢰 메시지를 업로드 순간에 배치:
  - https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- 입력 품질 가이드(가독성/DPI/방향)를 선제 제공:
  - https://docs.aws.amazon.com/textract/latest/dg/textract-best-practices.html

## 7) 바로 백로그로 옮길 수 있는 작업 항목

1. Uploads 완료 문구/단계 배지 개선 (A)
2. Action 상세에서 증빙팩 준비 전 Approve 차단 (B)
3. Leaks/Actions/Reports 공통 적응형 갱신 훅 도입 (C)
4. Store context 고정 바 + 전환 토스트 추가 (D)
5. Host missing 복구 패널 개선 + requestId 노출 (E)
6. Report detail 실행 CTA 블록 추가 (F)
