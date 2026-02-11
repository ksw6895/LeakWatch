# 데이터 모델(Postgres + Prisma)

## 0) 멀티테넌시 전략
- 테넌시 경계: Organization(org_id)
- Shopify store 단위: Shop(shop_id) — Org는 여러 Shop을 가질 수 있음(에이전시)
- 데이터 접근은 항상 (org_id, shop_id)로 필터링
- 구현: API 레이어에서 `AuthContext { orgId, shopId?, userId, roles[] }`를 강제 주입하고, Prisma 쿼리 helper에서 orgId 필수

## 1) 핵심 엔티티
- organizations: 요금제/결제/소유권
- users: Shopify user 또는 email user
- memberships: user↔org 역할
- shops: Shopify store 메타 + 설치상태
- shopify_tokens: offline token(암호화)
- documents: 문서 그룹(같은 벤더/같은 계정의 반복 인보이스 묶음 가능)
- document_versions: 업로드 버전 + 스토리지 키 + 상태
- extracted_artifacts: 추출 결과(텍스트/구조/메타)
- normalized_invoices: 표준 인보이스 JSON
- normalized_line_items: 라인아이템(탐지의 핵심)
- vendors: canonical vendor 레지스트리(벤더명 정규화)
- leak_findings: 탐지 결과
- evidence_refs: 근거 포인터
- action_requests: 이메일/티켓 초안(승인 전)
- action_runs: 실제 발송/실행 기록
- mail_events: mailgun webhook 이벤트
- reports: 주간/월간 리포트 스냅샷
- audit_logs: 감사로그(최소)
- usage_counters: LLM/업로드 사용량(비용 관리)

## 2) Prisma 스키마(핵심만 발췌)
(실제 구현은 apps/api/prisma/schema.prisma)

  model Organization {
    id            String   @id @default(cuid())
    name          String
    plan          Plan     @default(FREE)
    planStatus    PlanStatus @default(ACTIVE)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    memberships   Membership[]
    shops         Shop[]
  }

  enum Plan { FREE STARTER PRO AGENCY }
  enum PlanStatus { ACTIVE PAST_DUE CANCELED }

  model User {
    id             String   @id @default(cuid())
    email          String?  @unique
    shopifyUserId  String?  @unique
    displayName    String?
    createdAt      DateTime @default(now())
    updatedAt      DateTime @updatedAt

    memberships    Membership[]
  }

  model Membership {
    id        String @id @default(cuid())
    orgId     String
    userId    String
    role      OrgRole @default(OWNER)
    createdAt DateTime @default(now())

    org       Organization @relation(fields: [orgId], references: [id])
    user      User @relation(fields: [userId], references: [id])

    @@unique([orgId, userId])
    @@index([userId])
  }

  enum OrgRole { OWNER MEMBER AGENCY_ADMIN AGENCY_VIEWER }

  model Shop {
    id              String   @id @default(cuid())
    orgId           String
    shopifyDomain   String   @unique
    shopifyShopId   String?  @unique
    displayName     String?
    currency        String   @default("USD")
    timezone        String   @default("Asia/Seoul") // ASSUMPTION: 기본 KST
    installedAt     DateTime?
    uninstalledAt   DateTime?
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    org             Organization @relation(fields: [orgId], references: [id])
    token           ShopifyToken?
    documents       Document[]
    vendors         VendorOnShop[]
    findings        LeakFinding[]
    reports         Report[]
  }

  model ShopifyToken {
    id          String @id @default(cuid())
    shopId      String @unique
    accessTokenEnc String // AES-GCM encrypted
    scopes      String
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    shop        Shop @relation(fields: [shopId], references: [id])
  }

  model Document {
    id          String @id @default(cuid())
    orgId       String
    shopId      String
    source      DocumentSource @default(UPLOAD)
    vendorHint  String?
    createdByUserId String?
    createdAt   DateTime @default(now())

    versions    DocumentVersion[]
    shop        Shop @relation(fields: [shopId], references: [id])
    @@index([shopId, createdAt])
    @@index([orgId])
  }

  enum DocumentSource { UPLOAD EMAIL_FORWARD }

  model DocumentVersion {
    id            String @id @default(cuid())
    documentId    String
    version       Int
    mimeType      String
    fileName      String
    byteSize      Int
    sha256        String
    storageKey    String
    status        DocStatus @default(CREATED)
    errorCode     String?
    errorMessage  String?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    document      Document @relation(fields: [documentId], references: [id])
    extracted     ExtractedArtifact?
    normalized    NormalizedInvoice?
    @@unique([documentId, version])
    @@index([status, createdAt])
  }

  enum DocStatus {
    CREATED UPLOADED
    EXTRACTION_RUNNING EXTRACTED EXTRACTION_FAILED
    NORMALIZATION_RUNNING NORMALIZED NORMALIZATION_FAILED
    DETECTION_RUNNING DETECTED DETECTION_FAILED
    DONE
  }

  model ExtractedArtifact {
    id               String @id @default(cuid())
    documentVersionId String @unique
    textContent      String // plain text, page breaks preserved
    metaJson         Json
    createdAt        DateTime @default(now())

    documentVersion  DocumentVersion @relation(fields: [documentVersionId], references: [id])
  }

  model NormalizedInvoice {
    id               String @id @default(cuid())
    documentVersionId String @unique
    vendorId         String?
    currency         String
    invoiceNumber    String?
    invoiceDate      DateTime?
    billingPeriodStart DateTime?
    billingPeriodEnd DateTime?
    totalAmount      Decimal @db.Decimal(18,6)
    rawJson          Json // full schema object
    createdAt        DateTime @default(now())

    lineItems        NormalizedLineItem[]
    documentVersion  DocumentVersion @relation(fields: [documentVersionId], references: [id])
    vendor           Vendor? @relation(fields: [vendorId], references: [id])
    @@index([vendorId, invoiceDate])
  }

  model NormalizedLineItem {
    id               String @id @default(cuid())
    invoiceId        String
    shopId           String
    vendorId         String?
    itemType         LineItemType
    description      String?
    quantity         Decimal? @db.Decimal(18,6)
    unitPrice        Decimal? @db.Decimal(18,6)
    amount           Decimal @db.Decimal(18,6)
    currency         String
    periodStart      DateTime?
    periodEnd        DateTime?
    isRecurring      Boolean @default(false)
    recurringCadence Cadence?
    planName         String?
    productCode      String?
    taxAmount        Decimal? @db.Decimal(18,6)
    createdAt        DateTime @default(now())

    invoice          NormalizedInvoice @relation(fields: [invoiceId], references: [id])
    @@index([shopId, vendorId, periodStart])
    @@index([shopId, periodStart, amount])
  }

  enum LineItemType { CHARGE REFUND CREDIT }
  enum Cadence { MONTHLY YEARLY WEEKLY ONE_TIME }

  model Vendor {
    id               String @id @default(cuid())
    canonicalName    String @unique
    aliases          String[] // Postgres text[]
    supportEmail     String?
    website          String?
    category         VendorCategory @default(UNKNOWN)
    createdAt        DateTime @default(now())
  }

  enum VendorCategory { SHOPIFY_APP SAAS PAYMENT SHIPPING MARKETING ANALYTICS UNKNOWN }

  model VendorOnShop {
    id        String @id @default(cuid())
    shopId    String
    vendorId  String
    status    VendorStatus @default(ACTIVE)
    lastSeenAt DateTime?
    notes     String?

    shop      Shop @relation(fields: [shopId], references: [id])
    vendor    Vendor @relation(fields: [vendorId], references: [id])

    @@unique([shopId, vendorId])
    @@index([shopId, status])
  }

  enum VendorStatus { ACTIVE CANCELED SUSPECTED_UNUSED }

  model LeakFinding {
    id          String @id @default(cuid())
    orgId       String
    shopId      String
    type        LeakType
    status      FindingStatus @default(OPEN)
    title       String
    summary     String
    confidence  Int // 0-100
    estimatedSavingsAmount Decimal @db.Decimal(18,6)
    currency    String
    vendorId    String?
    periodStart DateTime?
    periodEnd   DateTime?
    primaryLineItemId String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    evidence    EvidenceRef[]
    actions     ActionRequest[]
    @@index([shopId, status, createdAt])
    @@index([shopId, type, createdAt])
  }

  enum LeakType {
    MOM_SPIKE DUPLICATE_CHARGE POST_CANCELLATION TRIAL_TO_PAID UNINSTALLED_APP_CHARGE UPCOMING_RENEWAL
  }

  enum FindingStatus { OPEN DISMISSED RESOLVED REOPENED }

  model EvidenceRef {
    id          String @id @default(cuid())
    findingId   String
    documentVersionId String?
    kind        EvidenceKind
    pointerJson Json // {page, lineStart, lineEnd, row?, col?}
    excerpt     String // max 500 chars
    createdAt   DateTime @default(now())

    finding     LeakFinding @relation(fields: [findingId], references: [id])
    @@index([findingId])
  }

  enum EvidenceKind { PDF_TEXT_SPAN CSV_ROW IMAGE_OCR_LINE MANUAL_NOTE }

  model ActionRequest {
    id          String @id @default(cuid())
    findingId   String
    orgId       String
    shopId      String
    type        ActionType
    status      ActionRequestStatus @default(DRAFT)
    toEmail     String
    ccEmails    String[]
    subject     String
    bodyMarkdown String
    attachmentKey String?
    createdByUserId String?
    approvedByUserId String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    runs        ActionRun[]
    finding     LeakFinding @relation(fields: [findingId], references: [id])
    @@index([shopId, status, createdAt])
  }

  enum ActionType { REFUND_REQUEST CANCEL_REQUEST DOWNGRADE_REQUEST CLARIFICATION }
  enum ActionRequestStatus { DRAFT APPROVED CANCELED }

  model ActionRun {
    id            String @id @default(cuid())
    actionRequestId String
    status        ActionRunStatus @default(QUEUED)
    mailgunMessageId String?
    lastError     String?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    actionRequest ActionRequest @relation(fields: [actionRequestId], references: [id])
    @@index([status, createdAt])
  }

  enum ActionRunStatus { QUEUED SENDING SENT DELIVERED FAILED RESOLVED }

  model MailEvent {
    id          String @id @default(cuid())
    actionRunId String?
    mailgunMessageId String
    event       String
    payloadJson Json
    occurredAt  DateTime
    createdAt   DateTime @default(now())
    @@index([mailgunMessageId, occurredAt])
  }

  model Report {
    id        String @id @default(cuid())
    orgId     String
    shopId    String
    period    ReportPeriod
    periodStart DateTime
    periodEnd   DateTime
    summaryJson Json
    storageKey String? // optional PDF/HTML snapshot
    createdAt DateTime @default(now())
    @@unique([shopId, period, periodStart, periodEnd])
  }

  enum ReportPeriod { WEEKLY MONTHLY }

  model AuditLog {
    id        String @id @default(cuid())
    orgId     String
    shopId    String?
    userId    String?
    action    String
    targetType String
    targetId  String?
    ip        String?
    userAgent String?
    metaJson  Json
    createdAt DateTime @default(now())
    @@index([orgId, createdAt])
  }

  model UsageCounter {
    id        String @id @default(cuid())
    orgId     String
    shopId    String?
    day       DateTime // date truncated
    metric    String // e.g. "openai_tokens_in", "openai_tokens_out", "uploads_bytes"
    value     BigInt
    createdAt DateTime @default(now())
    @@unique([orgId, shopId, day, metric])
  }

## 3) 인덱스/성능 주의
- 탐지 핵심 쿼리: shopId + vendorId + periodStart range
  - normalized_line_items에 (shopId, vendorId, periodStart) index 필수
- finding list: (shopId, status, createdAt) index
- 문서 처리 큐: document_versions에 (status, createdAt) index

## 4) 데이터 보관/삭제
- Document 파일(R2)은 org/shop 경로에 저장
- 삭제 요청 시:
  - DB soft-delete 금지(감사/회복) 대신, PII 포함 데이터는 hard-delete 가능
  - 정책은 /docs/SECURITY_PRIVACY.md 준수
