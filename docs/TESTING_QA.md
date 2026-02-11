# 테스트/QA 전략

## 0) 품질 기준(DoD 요약)
- 모든 API endpoint에 대해:
  - auth/tenant guard 테스트
  - 성공/실패 케이스
- LLM 파이프라인:
  - schema validation pass rate(샘플) >= 95%
  - failure 시 명확한 errorCode 기록
- 탐지 규칙:
  - 최소 5종 누수 케이스 fixture로 회귀 테스트
- E2E:
  - 업로드→대시보드에 finding 생성→액션 draft 생성까지 자동화 테스트

## 1) 테스트 레이어
### 1.1 Unit
- 대상:
  - vendor canonicalization
  - detection rules(입력 lineItems → findings)
  - json schema validation/repair logic
  - masking 함수
- 도구:
  - Vitest (Node/TS)

### 1.2 Integration(API)
- Postgres/Redis를 docker compose로 띄운 상태에서
- NestJS e2e 테스트로 API 호출
- Mailgun/OpenAI는 mock server 또는 nock으로 대체

### 1.3 Worker Integration
- BullMQ queue에 job 넣고 processor가 DB 상태를 변경하는지 검증
- 파일 스토리지는 localstack(S3) 대체 가능하나 MVP는 R2 mock로 단순화
  - ASSUMPTION: storage client는 interface로 분리하여 in-memory mock 가능

### 1.4 E2E(Frontend)
- Playwright로 주요 플로우:
  - Upload 페이지 접근
  - 파일 업로드(프리사인드 URL은 mock API)
  - Findings list 렌더
  - Finding detail에서 ActionRequest 생성
- Embedded Shopify iframe은 로컬에서 복잡하므로:
  - MVP: “embedded wrapper 없이도 페이지가 동작”하도록 dev mode 제공
  - Shopify install/e2e는 staging에서 수동 테스트 케이스로 보완

## 2) 테스트 데이터/픽스처
- /fixtures/invoices/
  - saas_monthly.pdf (텍스트 레이어 포함)
  - annual_prepaid.pdf
  - refund_credit.pdf
  - duplicate_charge.pdf
  - csv_statement.csv
  - scanned_invoice.png
- 각 fixture는 기대 NormalizedInvoice JSON과 매칭:
  - fixtures/expected/*.json

## 3) 핵심 시나리오 테스트(필수)
1) PDF 업로드 → EXTRACTED → NORMALIZED → DETECTED → Finding 생성
2) CSV 업로드 → lineItems 생성(기간/금액/벤더 파싱) → Finding 생성
3) 중복 결제 fixture → DUPLICATE_CHARGE 1개 생성(오탐 없이)
4) 취소 후 과금 fixture:
   - cancel action DELIVERED
   - 이후 charge 업로드
   - POST_CANCELLATION finding 생성
5) ActionRequest 생성 → Approve → Mailgun mock send → status SENT/DELIVERED

## 4) 실행 커맨드(권장)
- pnpm test
- pnpm test:api
- pnpm test:worker
- pnpm test:e2e
- pnpm lint
- pnpm typecheck

## 5) 릴리즈 전 QA 체크리스트(요약)
- Shopify uninstall webhook이 정상 동작(토큰 무효화)
- 멀티테넌시: 다른 org의 finding/doc 접근 불가 확인
- LLM 실패 시 UI에서 “왜 실패했는지” 표시
- 이메일 발송: from/reply-to/첨부/서명 검증
