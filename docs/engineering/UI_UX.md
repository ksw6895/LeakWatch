# UI/UX 설계 (임베디드 앱 + 에이전시 포털)

## 0) 디자인 시스템

- Shopify Polaris 사용(일관성/심사 대응)
- Embedded: Shopify App Bridge Provider 필수
- 상태 표준:
  - Loading: Skeleton
  - Empty: 안내 + CTA
  - Error: 재시도 + 지원 링크

## 1) 페이지 맵

### 1.1 Embedded App (Shopify Admin 내부)

- /app (Dashboard)
- /app/uploads
- /app/documents/[documentId]
- /app/leaks
- /app/leaks/[findingId]
- /app/actions
- /app/actions/[actionRequestId]
- /app/reports
- /app/settings

### 1.2 Agency Portal (외부)

- /agency/login (magic link)
- /agency (org-level dashboard)
- /agency/shops/[shopId] (shop-level view)
- /agency/reports

## 2) 핵심 화면별 컴포넌트/상태

### 2.1 Dashboard (/app)

- KPI Cards
  - This month spend (from normalized_line_items)
  - Potential savings (sum of OPEN findings)
  - Open actions count
- “Top Leaks” 리스트(최대 5)
  - title, vendor, type badge, savings, confidence
  - CTA: View details
- Upload CTA
- 상태:
  - 문서 없음: “인보이스를 업로드하세요”
  - 처리 중: “Processing…” + progress

### 2.2 Uploads (/app/uploads)

- Dropzone (PDF/CSV/PNG/JPG)
- 최근 업로드 테이블
  - fileName, vendorHint, status, createdAt, actions(View)
- 실패 row는 “Re-upload” CTA

### 2.3 Leak List (/app/leaks)

- 필터:
  - Status(OPEN/DISMISSED/RESOLVED)
  - Type
  - Vendor
  - Min savings
- 테이블/카드:
  - Title, Vendor, Type, Savings, Confidence, CreatedAt
- Bulk actions:
  - Dismiss selected (MVP optional)

### 2.4 Leak Detail (/app/leaks/[id])

- Header:
  - Title + Status badge + Confidence
  - Estimated savings + currency
- Explanation section(템플릿 기반)
- Evidence viewer:
  - EvidenceRef cards(페이지/라인/행, excerpt)
  - 원본 파일 download 링크
- Recommended actions:
  - Buttons: Refund Email / Cancel Email / Downgrade Email / Ask
- Finding lifecycle:
  - Dismiss, Mark resolved

### 2.5 Action Center (/app/actions)

- Draft/Approved/Sent 필터
- 리스트:
  - type, vendor, toEmail, status, createdAt
- 클릭 → Action detail

### 2.6 Action Detail (/app/actions/[id])

- Email editor:
  - To/CC/Subject
  - Body markdown editor(Polaris TextField multi-line + preview)
- Attachments:
  - evidence pack 다운로드 링크
  - 원본 인보이스 링크
- Approve & Send 버튼(권한 필요)
- Run status timeline:
  - queued → sending → delivered/failed

### 2.7 Reports (/app/reports)

- Weekly/monthly 탭
- 리포트 카드:
  - period, total spend, potential savings, top findings
- “Send to email now” 버튼(MVP optional)
- CSV export(옵션)

### 2.8 Settings (/app/settings)

- Contact email(리포트/CC)
- Default CC 정책(ON/OFF)
- Data retention(30/90/365 days) (MVP: 365 fixed; 설정은 V1)
- “Installed apps sync” 버튼(가능한 경우)
- “Agency connect code” (에이전시 모드 연결)

## 3) 최소 와이어프레임(ASCII)

### 3.1 Dashboard

+------------------------------------------------------+
| LeakWatch |
| [Store Switch ▼] [Settings] |
+------------------------------------------------------+
| This Month Spend | Potential Savings | Open Actions |
| $2,430 | $410 | 3 |
+------------------------------------------------------+
| Top Leaks (5) |
| 1) Duplicate charge - AppX $49 Conf 92 [>] |
| 2) MoM spike - Klaviyo $120 Conf 78 [>] |
| 3) Post-cancellation - ToolY $89 Conf 80 [>] |
+------------------------------------------------------+
| [Upload invoice] Drag & Drop PDF/CSV/PNG |
+------------------------------------------------------+

### 3.2 Leak Detail

+------------------------------------------------------+
| <- Back Duplicate charge: AppX (OPEN) Conf 92 |
| Estimated savings: $49 |
+------------------------------------------------------+
| Why we think it's a leak |
| - Two charges for same period and amount were found. |
| - Period: 2026-01-01 ~ 2026-02-01 |
+------------------------------------------------------+
| Evidence |
| [PDF p1 L32-35] "AppX Monthly Plan ... Total $49.00" |
| [PDF p1 L60-62] "AppX Monthly Plan ... Total $49.00" |
| [Download original invoices] |
+------------------------------------------------------+
| Actions |
| [Generate Refund Email] [Ask Vendor] [Dismiss] |
+------------------------------------------------------+

### 3.3 Action Detail

+------------------------------------------------------+
| Refund Request Email (DRAFT) |
+------------------------------------------------------+
| To: support@appx.com |
| CC: ops@acme.com |
| Subject: Refund request for duplicate charge (Jan 2026)|
|------------------------------------------------------|
| Body (Markdown) |
| [ editor ... ] |
|------------------------------------------------------|
| Attachments: |
| - evidence_pack.zip [Download] |
| - invoice_2026-01.pdf [Download] |
|------------------------------------------------------|
| [Approve & Send] |
+------------------------------------------------------+

## 4) 권한/상태에 따른 UI 제한

- OWNER/MEMBER만:
  - 업로드
  - 액션 승인/발송
  - 설정 변경
- VIEWER(에이전시)만:
  - 읽기 전용(리포트/누수 목록)
- Dismiss/Resolve는 최소 MEMBER 이상
