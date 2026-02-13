# 액션 자동화(승인 → 이메일 발송/증빙 생성/추적)

## 0) 목표

- LeakFinding을 “실제 절감 행동”으로 연결
- 사용자 1회 승인으로 메일 초안 생성, 증빙 패키지 생성, 발송, 발송 상태 추적까지 제공

## 1) 액션 타입 정의

- REFUND_REQUEST: 부당 청구/중복 결제/해지 후 과금에 대한 환불 요청
- CANCEL_REQUEST: 구독 해지 요청(또는 자동 갱신 중단)
- DOWNGRADE_REQUEST: 플랜/좌석/사용량 다운그레이드 요청
- CLARIFICATION: 청구 근거 문의(먼저 확인)

## 2) Action 스키마(공통)

### 2.1 ActionRequest (Draft)

```text
ActionRequest {
id, findingId, shopId, type,
toEmail, ccEmails[], subject, bodyMarkdown,
attachmentKey?, status="DRAFT",
createdByUserId, approvedByUserId?
}
```

### 2.2 ActionRun (Execution)

```text
ActionRun {
id, actionRequestId,
status: "QUEUED"|"SENDING"|"SENT"|"DELIVERED"|"FAILED"|"RESOLVED",
mailgunMessageId?,
lastError?
}
```

## 3) “승인 1번” 플로우

1. 사용자: Finding 상세 → 액션 타입 선택(Refund/Cancel/Downgrade)
2. API:
   - ActionRequest(DRAFT) 생성
   - evidence pack job enqueue (기본 ON)
3. Worker:
   - Evidence pack 생성(Zip) → R2 저장 → attachmentKey 업데이트
4. UI:
   - 이메일 편집기(기본 템플릿/LLM 생성) 표시
   - 첨부 확인
5. 사용자: Approve & Send
6. API:
   - 권한 체크(OrgRole OWNER/MEMBER/AGENCY_ADMIN)
   - ActionRequest.status=APPROVED
   - ActionRun 생성(QUEUED)
   - SEND_EMAIL job enqueue
7. Worker:
   - Mailgun으로 발송
   - status=SENT/FAILED 업데이트
8. Mailgun webhook:
   - delivered → DELIVERED
   - failed → FAILED

MVP 추적 범위:

- 발송 성공/실패/딜리버리
- 응답/환불 완료는 “사용자 수동 상태 업데이트” + “추가 인보이스(크레딧) 업로드로 자동 감지(옵션)”
- V1: 인바운드 메일 파싱으로 응답 자동 수집

## 4) 벤더별 실행 전략(현실적)

### 4.1 Shopify App 벤더

- 직접 해지 자동화(버튼 클릭)는 불가/비권장
- 제공:
  - Shopify Admin deep link: Apps 목록, 해당 앱 uninstall 링크(가능한 경우)
  - 벤더 지원 메일로 해지/환불 요청 이메일 생성
  - “삭제 전 체크리스트” 생성(테마/체크아웃/구독 영향)

### 4.2 일반 SaaS

- 이메일 기반 요청(대부분 지원 가능)
- URL/Help center 링크(사용자 입력 또는 vendor registry에 저장)

### 4.3 카드/Stripe/PayPal 결제

- “환불 요청”은 벤더와 직접 커뮤니케이션 필요
- LeakWatch는 증빙/메일 초안 중심으로 지원

## 5) 이메일 생성 정책(안전장치)

- 자동 발송 금지: 항상 사용자 승인 필요
- 톤 가이드: 공격적/협박 금지, 사실 기반, 근거 포함
- 금칙:
  - 법적 위협(“소송”, “사기”) 자동 삽입 금지
  - 민감정보(카드 전체번호, 고객 개인정보) 포함 금지
- 근거 포함 방식:
  - 인보이스 번호/날짜/금액/기간/중복 라인 항목을 표로 정리
  - 첨부 파일: Evidence pack zip + 원본 인보이스

## 6) 증빙 패키지(Evidence Pack) 생성

포맷: zip
구성:

- 00_case_summary.pdf (또는 .html)
  - Finding 요약, 근거 excerpt, 타임라인(청구/해지)
- 01_invoices/
  - 관련 DocumentVersion 원본 파일(필요 최소)
- 02_excerpts.txt
  - page/line/row 기반 근거 텍스트(사람이 빠르게 찾도록)
- 03_metadata.json
  - findingId, lineItem ids, normalization quality, 생성 시각

MVP 구현 팁:

- PDF 하이라이트는 좌표가 없으면 불가 → 대신 “페이지/라인”으로 안내하고 요약 PDF에 excerpt를 붙인다.

## 7) 메일 발송/추적(Mailgun)

- From: `LeakWatch <noreply@${MAILGUN_DOMAIN}>` (환경변수 기반)
- Reply-To: 사용자 입력 contactEmail(권장, 현재 코드 미구현)
- To: vendor support email(사용자 입력/registry)
- CC: 현재 자동 기본 주입 없음(필요 시 UI에서 직접 입력)
- Mailgun message-id 저장 → webhook에서 상태 업데이트

## 8) 운영상 주의(법/정책)

- LeakWatch는 회계/법률 자문이 아니라 “문서/커뮤니케이션 자동화 도구”임을 UI에 고지
- 환불 정책/약관 링크 제공 시, 자동 추론 금지(가능하면 사용자가 링크 제공)
