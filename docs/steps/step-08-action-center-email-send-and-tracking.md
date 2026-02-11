# Step 08 — Action Center: Email Draft → Approve → Send → Tracking

## 목표(사용자 가치)
- “승인 클릭 1번”으로 벤더에 환불/해지 요청 메일이 발송되고, 상태가 추적된다.

## 범위/비범위
- 범위:
  - ActionRequest 생성(LLM로 body 생성)
  - 편집/승인
  - Mailgun 발송
  - webhook로 delivered/failed 업데이트
  - Actions UI(리스트/상세)
- 비범위:
  - 인바운드 응답 자동 파싱(V1로 확장 가능)

## 선행 조건(필요 계정/키/설정)
- Mailgun domain + API key + webhook signing key
- contactEmail 설정(UI)
- evidence pack 생성(step-07)

## 구현 체크리스트(세부 태스크)
1) ActionRequest 생성 API
- POST /v1/findings/{id}/actions
- 입력: type, toEmail, ccEmails?
- 처리:
  - finding + evidence 조회
  - email body 생성:
    - 템플릿 + LLM(/docs/prompts/email_draft.md)
  - ActionRequest(DRAFT) 저장
  - evidence pack job enqueue

2) Action detail API
- GET /v1/action-requests/{id}

3) Approve & Send API
- POST /v1/action-requests/{id}/approve
- 권한 체크
- ActionRequest.status=APPROVED
- ActionRun 생성 + SEND_EMAIL job enqueue

4) Worker: SEND_EMAIL
- attachmentKey 있으면 R2에서 파일 다운로드 후 첨부
- Mailgun send
- mailgun_message_id 저장

5) Mailgun webhook endpoint
- POST /v1/mailgun/webhooks/events
- signature 검증
- delivered/failed 이벤트 처리 → ActionRun 업데이트

6) UI
- /app/actions 리스트
- /app/actions/[id] 편집 + Approve 버튼 + 상태 타임라인

## 파일/디렉토리 구조(추가/변경 파일 명시)
- apps/api/src/modules/actions/*
- apps/api/src/modules/mailgun/*
- apps/worker/src/jobs/send-email.ts
- apps/web/src/app/(embedded)/app/actions/*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)
- ActionDraftService
  - buildEvidenceTable(finding) → markdown table
  - draftEmail(actionType, context) → subject/body
- EmailSender(MailgunClient)
  - send({to, cc, subject, body, attachments[]}) → messageId
- MailgunWebhookHandler
  - verify(signature, timestamp, token)
  - handleEvent(payload)

## API/DB 변경사항
- action_requests, action_runs, mail_events 사용
- audit_logs:
  - action.request_created
  - action.approved
  - action.sent

## 테스트(케이스 + 실행 커맨드)
- Action draft 생성 테스트(LLM mock)
- Approve 시 권한 없는 유저 403
- webhook 서명 실패 401
- pnpm test:api, pnpm test:worker

## Definition of Done(정량 기준)
- finding → action draft 생성이 5초 내(가정) 완료
- approve 후 1분 내 delivered/failed 상태가 UI에 표시
- 이메일 본문에 금칙어(법적 위협/민감정보)가 포함되지 않음(간단한 regex 검사)

## 흔한 함정/디버깅 팁
- Mailgun webhook raw body 처리 주의(서명 검증)
- 첨부 파일 크기 제한(메일건 제한) → evidence pack zip 크기를 10MB 이하 유지(가정)

## 롤백/마이그레이션 주의사항
- 메일 발송 정책 변경 시, 기존 ActionRequest 재발송 처리 규칙 필요(재발송은 새 ActionRun 생성)
