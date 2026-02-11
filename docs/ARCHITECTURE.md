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
  - ui: Polaris 컴포넌트/페이지
  - lib/api-client: OpenAPI 기반 fetch client
  - lib/shopify: App Bridge session token, embedded routing
- apps/api
  - modules/auth: token verification, org/shop context resolution
  - modules/shopify: OAuth callback, webhooks, Shopify Admin API 호출
  - modules/documents: upload init/complete, storage keys, metadata
  - modules/ingestion: job enqueue, 상태 머신
  - modules/normalization: LLM 호출, schema validation, persistence
  - modules/detection: rules engine, findings persistence
  - modules/actions: email draft, approval, mailgun send, evidence pack
  - modules/reports: weekly/monthly 생성 및 발송
  - modules/billing: Shopify Billing subscriptions, entitlements
  - modules/audit: 감사로그
- apps/worker
  - jobs/*: BullMQ processor들
  - llm/*: LLM client wrapper(캐시/리트라이/마스킹)
  - extractors/*: pdf/csv/image 텍스트 추출
  - detectors/*: 규칙 기반 탐지기
  - evidence/*: 증빙 패키지 생성기

## 3) 데이터 흐름(주요 시퀀스)
### 3.1 Shopify 설치/인증
1) 사용자가 Shopify App Store에서 설치 → Shopify가 OAuth 시작
2) /shopify/auth/callback에서 HMAC 검증 후 offline access token 발급
3) DB에 Shop record 생성/갱신 + token 암호화 저장
4) Shopify Admin에서 앱 열기(embedded) → Web이 session token(JWT) 획득
5) Web → API 호출 시 Authorization: Bearer <session token>
6) API는 session token 검증 후 org_id/shop_id/user_id context를 생성

### 3.2 문서 업로드→정규화→탐지
1) Web: “Upload” 클릭 → API `POST /documents` 호출
2) API: Document + DocumentVersion 생성, presigned PUT URL 반환
3) Web: R2에 직접 업로드(브라우저→R2), 완료 후 `POST /documents/{id}/complete`
4) API: BullMQ에 INGEST_DOCUMENT job enqueue
5) Worker:
   - 파일 다운로드
   - 타입 감지 + 텍스트 추출
   - NORMALIZE_INVOICE job enqueue
6) Worker:
   - LLM에 표준화 요청(JSON strict)
   - schema validation + repair(필요시)
   - NormalizedInvoice + LineItem 저장
   - RUN_DETECTION job enqueue(해당 shop/month 범위)
7) Worker:
   - 규칙 기반 탐지 실행 → LeakFinding 저장
8) Web Dashboard: Findings list 조회 → 카드 표시

### 3.3 액션 생성/승인/발송
1) Web: Finding 상세 → “Generate Refund Email” 클릭
2) API: ActionRequest 생성 + evidence pack 생성 job(optional) enqueue
3) Worker(옵션): 증빙 zip 생성 완료 → ActionRequest에 attachment_key 업데이트
4) Web: ActionRequest draft 표시(제목/본문/수신자/첨부)
5) 사용자가 “Approve & Send” 클릭
6) API: 승인 권한 검사 후 ActionRun 생성, SEND_EMAIL job enqueue
7) Worker: Mailgun 발송 → mailgun_message_id 저장
8) Mailgun webhook: delivered/failed 이벤트 → ActionRun status 업데이트
9) Web: ActionRun 상태 표시

## 4) 상태 머신(핵심 엔티티)
- DocumentVersion.status:
  - CREATED → UPLOADED → EXTRACTED → NORMALIZED → DETECTED → DONE
  - 실패: *_FAILED (EXTRACTION_FAILED / NORMALIZATION_FAILED / DETECTION_FAILED)
- ActionRequest.status:
  - DRAFT → APPROVED → SENT(=ActionRun) → (DELIVERED/FAILED) → RESOLVED
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
