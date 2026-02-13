# 시스템 아키텍처

## 1) 구성요소(런타임)

- Web (Next.js, Vercel)
  - Embedded App UI(Shopify Admin 안)
  - Agency Portal(외부 접속)
- API (NestJS, Fly.io)
  - Auth(Shopify session token + LW email JWT)
  - Documents/Normalization/Findings/Actions/Reports/Billing API 제공
- Worker (Node + BullMQ, Fly.io)
  - Ingestion(텍스트 추출)
  - LLM Normalization
  - Detection Engine
  - Evidence Pack Generator
  - Report Generator(주간/월간)
  - Email sender(승인 후)
- Postgres (Supabase)
- Redis (Upstash)
- Object Storage (Cloudflare R2)
- Mailgun
  - Outbound + Webhook(Delivery events)
  - (V1) Inbound(Reply parsing)
- OpenAI API

## 2) 모듈 경계(코드 레벨)

- apps/web
  - `src/app/(embedded)/app/uploads`: 업로드 생성/완료 UI
  - `src/app/(embedded)/app/leaks`: finding 목록/상세 + 액션 드래프트 진입점
  - `src/app/(embedded)/app/actions`: 액션 목록/상세(수정/승인/타임라인)
  - `src/lib/api/fetcher.ts`: App Bridge session token 기반 API fetch wrapper
  - `src/lib/shopify`: session token 획득/embedded 헬퍼
- apps/api
  - modules/auth: token verification, org/shop/user auth context
  - modules/shopify: OAuth start/callback, uninstall webhook
  - modules/shops: shop 조회 + shop별 finding 조회
  - modules/documents: 업로드 init/complete, ingest/evidence/send-email enqueue
  - modules/findings: finding 목록/상세/dismiss + action draft 생성
  - modules/actions: action request 목록/상세/수정/승인 API
  - modules/evidence: evidence pack 다운로드 presigned URL
  - modules/mailgun: webhook 서명 검증 + delivery/failure 이벤트 반영
  - modules/reports: report 목록 조회
  - modules/audit: write API audit log interceptor
- apps/worker
  - `jobs/ingest.ts`: 추출 + normalize enqueue
  - `jobs/normalize.ts`: LLM normalize/repair + detection enqueue
  - `jobs/detection.ts`: 누수 탐지 + finding/evidence 저장
  - `jobs/evidence-pack.ts`: 증빙 zip 생성 + R2 업로드
  - `jobs/send-email.ts`: Mailgun 발송 + ActionRun 상태 전이
  - `extractors/*`: pdf/csv/image 텍스트 추출
  - `normalization/*`: schema 검증/저장/usage 카운트
  - `evidence/*`: 증빙 패키지 빌더

## 3) 데이터 흐름(주요 시퀀스)

### 3.1 Shopify 설치/인증

1. 사용자가 Shopify App Store에서 설치 → Shopify가 OAuth 시작
2. /shopify/auth/callback에서 HMAC 검증 후 offline access token 발급
3. DB에 Shop record 생성/갱신 + token 암호화 저장
4. Shopify Admin에서 앱 열기(embedded) → Web이 session token(JWT) 획득
5. Web → API 호출 시 Authorization: Bearer <session token>
6. API는 session token 검증 후 org_id/shop_id/user_id context를 생성

### 3.2 문서 업로드→정규화→탐지

1. Web: “Upload” 클릭 → API `POST /v1/shops/{shopId}/documents` 호출
2. API: Document + DocumentVersion 생성, presigned PUT URL 반환
3. Web: R2에 직접 업로드(브라우저→R2), 완료 후 `POST /v1/documents/{documentId}/versions/{versionId}/complete`
4. API: BullMQ에 INGEST_DOCUMENT job enqueue
5. Worker:
   - 파일 다운로드
   - 타입 감지 + 텍스트 추출
   - NORMALIZE_INVOICE job enqueue
6. Worker:
   - LLM에 표준화 요청(JSON strict)
   - schema validation + repair(필요시)
   - NormalizedInvoice + LineItem 저장
   - RUN_DETECTION job enqueue(해당 shop/month 범위)
7. Worker:
   - 규칙 기반 탐지 실행 → LeakFinding 저장
8. Web Dashboard: Findings list 조회 → 카드 표시

### 3.3 액션 생성/승인/발송

1. Web: Finding 상세 → “Generate Refund Email” 클릭
2. API: ActionRequest 생성 + evidence pack 생성 job(optional) enqueue
3. Worker(옵션): 증빙 zip 생성 완료 → ActionRequest에 attachment_key 업데이트
4. Web: ActionRequest draft 표시(제목/본문/수신자/첨부)
5. 사용자가 “Approve & Send” 클릭
6. API: 승인 권한 검사(OWNER/MEMBER/AGENCY_ADMIN) 후 ActionRun 생성, SEND_EMAIL job enqueue
7. Worker: Mailgun 발송 → `mailgunMessageId` 저장
8. Mailgun webhook: delivered/failed 이벤트 → ActionRun status 업데이트
9. Web: ActionRun 상태 표시

## 4) 상태 머신(핵심 엔티티)

- DocumentVersion.status:
  - CREATED → UPLOADED → EXTRACTED → NORMALIZED → DETECTED → DONE
  - 실패 상태 예시: EXTRACTION_FAILED / NORMALIZATION_FAILED / DETECTION_FAILED
- ActionRequest.status:
  - DRAFT → APPROVED | CANCELED
- ActionRun.status:
  - QUEUED → SENDING → SENT → (DELIVERED | FAILED) → RESOLVED
- LeakFinding.status:
  - OPEN → DISMISSED → RESOLVED(액션 결과로 해결) → REOPENED(재발)

## 5) 신뢰성/재처리

- 모든 job은 idempotent:
  - key: (document_version_id, step)
  - 이미 결과가 있으면 skip 또는 overwrite 정책(명시)
- 재시도:
  - LLM: 3회(지수 백오프 + jitter)
  - Mailgun: 3회
  - Extraction: 2회 (다운로드 실패 등)
