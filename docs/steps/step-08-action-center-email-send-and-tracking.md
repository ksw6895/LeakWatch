# Step 08 — Action Center: Email Draft → Approve → Send → Tracking

## 목표(사용자 가치)

- “승인 클릭 1번”으로 벤더에 환불/해지 요청 메일이 발송되고, 상태가 추적된다.

## 범위/비범위

- 범위:
  - ActionRequest 생성(기본 subject/body 자동 채움 + 사용자 편집)
  - 편집/승인
  - Mailgun 발송
  - webhook로 delivered/failed 업데이트
  - Actions UI(리스트/상세)
- 비범위:
  - 인바운드 응답 자동 파싱(V1로 확장 가능)

## 선행 조건(필요 계정/키/설정)

- Mailgun domain + API key + webhook signing key
- toEmail/ccEmails 입력
- evidence pack 생성(step-07)

## 구현 체크리스트(세부 태스크)

1. ActionRequest 생성 API

- POST /v1/findings/{id}/actions
- 입력: type, toEmail, ccEmails?
- 처리:
  - finding 조회 후 기본 subject/body 자동 채움
    - subject: `[LeakWatch] {finding.title}`
    - body: finding.summary (사용자가 편집 가능)
  - ActionRequest(DRAFT) 저장
  - evidence pack job enqueue

2. Action detail API

- GET /v1/action-requests/{id}

3. Approve & Send API

- POST /v1/action-requests/{id}/approve
- 권한 체크
- ActionRequest.status=APPROVED
- ActionRun 생성 + SEND_EMAIL job enqueue

4. Worker: SEND_EMAIL

- attachmentKey 있으면 R2에서 파일 다운로드 후 첨부
- Mailgun send
- mailgun_message_id 저장

5. Mailgun webhook endpoint

- POST /v1/mailgun/webhooks/events
- signature 검증
- delivered/failed 이벤트 처리 → ActionRun 업데이트

6. UI

- /app/actions 리스트
- /app/actions/[id] 편집 + Approve 버튼 + 상태 타임라인

## 파일/디렉토리 구조(추가/변경 파일 명시)

- apps/api/src/modules/actions/\*
- apps/api/src/modules/mailgun/\*
- apps/worker/src/jobs/send-email.ts
- apps/web/src/app/(embedded)/app/actions/\*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)

- Action draft persistence
  - finding 기반 기본 subject/body 채움
  - 사용자 수정 PATCH 지원
- EmailSender(MailgunClient)
  - send({to, cc, subject, body, attachments[]}) → messageId
- MailgunWebhookHandler
  - verify(signature, timestamp, token)
  - handleEvent(payload)

## API/DB 변경사항

- action_requests, action_runs, mail_events 사용
- audit_logs 기록(현재 액션명은 `METHOD routePath` 형식)

## 테스트(케이스 + 실행 커맨드)

- Action draft 생성/수정 테스트
- Approve 시 권한 없는 유저 403
- webhook 서명 실패 401
- pnpm test:api, pnpm test:worker

## Definition of Done(정량 기준)

- finding → action draft 생성이 5초 내(가정) 완료
- approve 후 1분 내 delivered/failed 상태가 UI에 표시
- 이메일 본문 금칙어 자동 필터(regex)는 V1 이월(현재는 사용자 편집/승인 단계로 통제)

## 흔한 함정/디버깅 팁

- Mailgun webhook signature 필드(timestamp/token/signature) 누락 시 즉시 401
- 첨부 파일 크기 제한(메일건 제한) → evidence pack zip 크기를 10MB 이하 유지(가정)

## 롤백/마이그레이션 주의사항

- 메일 발송 정책 변경 시, 기존 ActionRequest 재발송 처리 규칙 필요(재발송은 새 ActionRun 생성)

## 완료 상태 (2026-02-13, 실제 구현 기준)

### 구현 완료

- [x] ActionRequest 생성 API 구현
  - `POST /v1/findings/{id}/actions`
  - draft 생성 + 증빙팩 생성 job enqueue
- [x] Action detail/list/update API 구현
  - `GET /v1/action-requests`
  - `GET /v1/action-requests/{id}`
  - `PATCH /v1/action-requests/{id}` (draft 편집)
- [x] Approve & Send API 구현
  - `POST /v1/action-requests/{id}/approve`
  - status `APPROVED` 전이 + `ActionRun(QUEUED)` 생성 + `SEND_EMAIL` enqueue
- [x] Worker `SEND_EMAIL` job 구현 (`apps/worker/src/jobs/send-email.ts`)
  - Mailgun API 발송
  - attachmentKey가 있으면 evidence zip 첨부
  - `mailgunMessageId` 저장 + `ActionRun` 상태 전이(`SENDING` -> `SENT` / `FAILED`)
- [x] Mailgun webhook endpoint 구현
  - `POST /v1/mailgun/webhooks/events`
  - signature 검증
  - delivered/failed 계열 이벤트를 `ActionRun`에 반영
  - `MailEvent` 저장
- [x] Actions UI 구현
  - `/app/actions` 목록
  - `/app/actions/[id]` 상세(편집/승인/타임라인/증빙 다운로드)

### 테스트/검증 완료

- [x] API 통합 테스트 추가
  - `apps/api/test/actions-flow.spec.ts`
  - draft 생성/수정/승인 + webhook signature/상태 전이 검증
- [x] Worker 테스트 추가
  - `apps/worker/test/send-email.test.ts`
  - send 성공 시 `SENT`/`mailgunMessageId` 반영 검증
- [x] 통과 확인
  - `pnpm --filter @leakwatch/api test`
  - `pnpm --filter @leakwatch/worker test`
  - `pnpm --filter @leakwatch/web test`
  - `pnpm --filter @leakwatch/api typecheck`
  - `pnpm --filter @leakwatch/worker typecheck`
  - `pnpm --filter @leakwatch/web typecheck`
