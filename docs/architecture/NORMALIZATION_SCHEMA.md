# 표준화 JSON 스키마 (NormalizedInvoice)

목표: 어떤 형태의 인보이스/영수증이든 **동일한 필드 구조(JSON)** 로 변환해 탐지/리포팅을 가능하게 한다.

## 1) 설계 원칙

- “탐지에 필요한 최소 필드”는 반드시 존재(필수)
- 원문 보존: rawText 일부와 source pointers로 근거 추적
- 금액은 Decimal(문자열로 직렬화 가능), 통화는 ISO 4217 코드
- 기간(periodStart/End)은 가능한 경우 필수(정기결제 탐지 핵심). 불가하면 invoiceDate만.

## 2) JSON Schema (핵심)

아래는 개념적 스키마(실제 Ajv 스키마는 코드에 동기화).

NormalizedInvoice {
schemaVersion: "1.0",
source: {
documentVersionId: string,
sourceType: "UPLOAD" | "EMAIL_FORWARD",
fileName: string,
mimeType: string,
sha256: string
},
merchant: {
shopId: string,
shopifyDomain?: string,
contactEmail?: string
},
vendor: {
name: string, // 원문 표기(필수)
canonicalName?: string, // 시스템 정규화(선택)
supportEmail?: string,
website?: string,
category?: "SHOPIFY_APP"|"SAAS"|"PAYMENT"|"SHIPPING"|"MARKETING"|"ANALYTICS"|"UNKNOWN"
},
invoice: {
invoiceNumber?: string,
invoiceDate?: string, // ISO-8601 date-time
billingPeriodStart?: string, // ISO-8601 date-time
billingPeriodEnd?: string, // ISO-8601 date-time
currency: string, // ISO 4217 (필수)
subtotalAmount?: string, // decimal string
taxAmount?: string,
totalAmount: string, // decimal string (필수)
paymentMethodHint?: string, // "Shopify invoice", "Visa", "PayPal" 등
notes?: string
},
lineItems: [
{
lineId: string, // LLM이 생성(유니크)
type: "CHARGE"|"REFUND"|"CREDIT",
description?: string,
quantity?: string,
unitPrice?: string,
amount: string, // decimal string (필수)
currency: string, // invoice currency default
periodStart?: string,
periodEnd?: string,
isRecurring?: boolean,
recurringCadence?: "MONTHLY"|"YEARLY"|"WEEKLY"|"ONE_TIME",
planName?: string,
productCode?: string,
taxAmount?: string,
evidence: {
kind: "PDF_TEXT_SPAN"|"CSV_ROW"|"IMAGE_OCR_LINE",
pointer: { page?: number, lineStart?: number, lineEnd?: number, row?: number, col?: string },
excerpt: string // 1~300 chars
}
}
],
quality: {
confidence: number, // 0-100, LLM self-check + rule
missingFields: string[], // 누락된 필수/중요 필드명
warnings: string[]
}
}

필수 조건(Validation rules):

- vendor.name 필수
- invoice.currency 필수
- invoice.totalAmount 필수
- lineItems 최소 1개
- 각 lineItem.amount/currency 필수
- 각 lineItem.evidence.excerpt/pointer 필수(근거 없으면 신뢰도 하향 및 warning)

## 3) 예시 1 — SaaS 월구독(월간 반복)

{
"schemaVersion": "1.0",
"source": {
"documentVersionId": "dv_01",
"sourceType": "UPLOAD",
"fileName": "klaviyo_invoice_2026-01.pdf",
"mimeType": "application/pdf",
"sha256": "abc123..."
},
"merchant": {
"shopId": "shop_01",
"shopifyDomain": "acme.myshopify.com",
"contactEmail": "ops@acme.com"
},
"vendor": {
"name": "Klaviyo",
"canonicalName": "Klaviyo",
"supportEmail": "support@klaviyo.com",
"website": "https://www.klaviyo.com",
"category": "MARKETING"
},
"invoice": {
"invoiceNumber": "INV-2026-01-8821",
"invoiceDate": "2026-01-05T00:00:00Z",
"billingPeriodStart": "2026-01-01T00:00:00Z",
"billingPeriodEnd": "2026-02-01T00:00:00Z",
"currency": "USD",
"subtotalAmount": "150.00",
"taxAmount": "0.00",
"totalAmount": "150.00",
"paymentMethodHint": "Credit Card",
"notes": "Email marketing subscription"
},
"lineItems": [
{
"lineId": "li_001",
"type": "CHARGE",
"description": "Email plan - 50k contacts",
"amount": "150.00",
"currency": "USD",
"periodStart": "2026-01-01T00:00:00Z",
"periodEnd": "2026-02-01T00:00:00Z",
"isRecurring": true,
"recurringCadence": "MONTHLY",
"planName": "Email 50k",
"evidence": {
"kind": "PDF_TEXT_SPAN",
"pointer": { "page": 1, "lineStart": 32, "lineEnd": 35 },
"excerpt": "Email plan - 50k contacts ... Total $150.00"
}
}
],
"quality": { "confidence": 86, "missingFields": [], "warnings": [] }
}

## 4) 예시 2 — 연간 선결제(Yearly prepaid)

{
"schemaVersion": "1.0",
"source": {
"documentVersionId": "dv_02",
"sourceType": "UPLOAD",
"fileName": "gorgias_annual_2026.pdf",
"mimeType": "application/pdf",
"sha256": "def456..."
},
"merchant": { "shopId": "shop_01", "shopifyDomain": "acme.myshopify.com" },
"vendor": { "name": "Gorgias", "canonicalName": "Gorgias", "category": "SAAS" },
"invoice": {
"invoiceNumber": "GOR-ANNUAL-2026",
"invoiceDate": "2026-01-10T00:00:00Z",
"billingPeriodStart": "2026-01-10T00:00:00Z",
"billingPeriodEnd": "2027-01-10T00:00:00Z",
"currency": "USD",
"totalAmount": "1200.00",
"paymentMethodHint": "Shopify invoice",
"notes": "Annual subscription prepaid"
},
"lineItems": [
{
"lineId": "li_010",
"type": "CHARGE",
"description": "Annual Support Plan",
"amount": "1200.00",
"currency": "USD",
"periodStart": "2026-01-10T00:00:00Z",
"periodEnd": "2027-01-10T00:00:00Z",
"isRecurring": true,
"recurringCadence": "YEARLY",
"planName": "Annual",
"evidence": {
"kind": "PDF_TEXT_SPAN",
"pointer": { "page": 0, "lineStart": 18, "lineEnd": 22 },
"excerpt": "Annual Support Plan ... $1,200.00 ... Billing period 2026-01-10 to 2027-01-10"
}
}
],
"quality": { "confidence": 82, "missingFields": [], "warnings": [] }
}

## 5) 예시 3 — 환불/크레딧(Refund/Credit)

{
"schemaVersion": "1.0",
"source": {
"documentVersionId": "dv_03",
"sourceType": "UPLOAD",
"fileName": "aftership_refund_2026-01.pdf",
"mimeType": "application/pdf",
"sha256": "789abc..."
},
"merchant": { "shopId": "shop_01" },
"vendor": { "name": "AfterShip", "canonicalName": "AfterShip", "category": "SHIPPING" },
"invoice": {
"invoiceNumber": "AS-CM-1020",
"invoiceDate": "2026-01-20T00:00:00Z",
"currency": "USD",
"totalAmount": "-49.00",
"notes": "Credit memo / refund"
},
"lineItems": [
{
"lineId": "li_100",
"type": "REFUND",
"description": "Refund for unused seats",
"amount": "-49.00",
"currency": "USD",
"isRecurring": false,
"recurringCadence": "ONE_TIME",
"evidence": {
"kind": "PDF_TEXT_SPAN",
"pointer": { "page": 1, "lineStart": 40, "lineEnd": 44 },
"excerpt": "Refund ... -$49.00"
}
}
],
"quality": { "confidence": 78, "missingFields": ["billingPeriodStart","billingPeriodEnd"], "warnings": ["No billing period found; treated as one-time refund"] }
}
