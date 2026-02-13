# 누수 탐지 엔진 v1 (규칙/LLM 혼합)

## 0) 목표

- “누수 후보”를 최소 5종 탐지
- 각 Finding에 대해:
  - 근거(evidence_refs)
  - 설명(템플릿 기반)
  - 신뢰도(confidence 0~100)
  - 예상 절감액(estimatedSavingsAmount)
    를 생성한다.

## 1) 출력 스키마: LeakFinding (API/DB 공통)

LeakFinding {
id: string,
shopId: string,
type: "MOM_SPIKE"|"DUPLICATE_CHARGE"|"POST_CANCELLATION"|"TRIAL_TO_PAID"|"UNINSTALLED_APP_CHARGE"|"UPCOMING_RENEWAL",
status: "OPEN"|"DISMISSED"|"RESOLVED"|"REOPENED",
title: string,
summary: string,
confidence: number (0-100),
estimatedSavingsAmount: decimal,
currency: string,
vendor?: { id: string, canonicalName: string },
periodStart?: ISO,
periodEnd?: ISO,
evidence: EvidenceRef[],
recommendedActions: [
{ type: "REFUND_REQUEST"|"CANCEL_REQUEST"|"DOWNGRADE_REQUEST"|"CLARIFICATION", rationale: string }
],
createdAt: ISO
}

EvidenceRef {
kind: "PDF_TEXT_SPAN"|"CSV_ROW"|"IMAGE_OCR_LINE"|"MANUAL_NOTE",
pointer: { documentVersionId: string, page?: number, lineStart?: number, lineEnd?: number, row?: number, col?: string },
excerpt: string
}

## 2) 탐지 입력 데이터

- normalized_line_items (필수)
- vendor canonicalization 결과(vendors, vendor_on_shop)
- (옵션) Shopify 설치 앱 목록(있으면 UNINSTALLED_APP_CHARGE 강화)
- action_requests/action_runs(POST_CANCELLATION용)
- findings history(재발/재오픈 판단)

## 3) 벤더 정규화(canonicalization) 전략

### 3.1 규칙 기반(우선)

- 소문자/공백/특수문자 제거한 `normalizedVendorKey` 생성
- vendors.aliases 배열과 exact match
- 부분 포함 match는 오탐 가능성이 있어 점수 낮춤

### 3.2 LLM 보조(옵션)

- 신규 vendor 등장 시:
  - vendor.name + invoice text header를 입력으로 “known canonical vendor name 후보” 생성
  - 결과는 운영자 승인(또는 자동으로 vendor.aliases에 추가하되 confidence<70이면 보류)

MVP 권장: LLM 보조는 “옵션”으로 두고, 우선 수동 alias 등록 UI 제공

## 4) 누수 유형별 규칙(최소 5개)

모든 규칙은:

- 대상 집합: shopId, vendorId(가능하면), period range
- 산출: finding + evidence + confidence + savings

### L-01 전월 대비 급등(MOM_SPIKE)

정의:

- 동일 vendorId(또는 vendorHint group)에서
- 최근 월(예: 2026-01)의 총 CHARGE 금액이 전월(2025-12) 대비
  - 증가율 >= 50% AND 증가액 >= $50 (ASSUMPTION threshold)
- 단, YEARLY/ONE_TIME 결제는 제외 또는 별도(UPCOMING_RENEWAL)로 분기

계산:

- monthSpend(vendor, month) = sum(amount where type=CHARGE and periodStart within month)
- prevMonthSpend = monthSpend(vendor, prevMonth)
- delta = current - prev
- pct = delta / max(prev, 1)

confidence:

- base 70
- periodStart/End가 명확하면 +10
- lineItems가 2개 이상 동일 month에서 일관되면 +5
- prevMonth 데이터가 1개 문서/라인 뿐이면 -10

evidence:

- currentMonth top line item 1~2개 + prevMonth 대표 line item

estimatedSavings:

- delta의 50%를 “잠재 절감”으로 기본(ASSUMPTION: 전부 줄이기 어려움)
- 또는 “이상 증가분 delta” 전체를 potential로 표기하고, UI에서 “확정/잠재” 구분

권장 액션:

- Clarification 또는 DowngradeRequest

### L-02 중복 결제(DUPLICATE_CHARGE)

정의:

- 동일 vendor + 동일 billingPeriod(±2일 허용) + 동일 amount(±1%) 인 CHARGE가 2개 이상 존재
- invoiceNumber가 다르거나, 같은 invoice를 중복 업로드한 경우는 제외(sha256 기반 dedupe)

confidence:

- base 80
- amount exact match면 +10
- periodStart/End exact match면 +10
- 단, “좌석/사용량”이 분리된 합법적 청구 가능성이 있으면 -15(LLM 분류로 warning)

evidence:

- 두 line item의 excerpt를 나란히 제공

estimatedSavings:

- 중복 중 하나의 금액(최소값) = potential savings

권장 액션:

- RefundRequest

### L-03 해지 이후 과금(POST_CANCELLATION)

정의:

- ActionRun 중 CANCEL_REQUEST가 DELIVERED(또는 SENT) 상태이고,
- cancelSentAt 이후에 동일 vendor의 recurring CHARGE가 계속 발생

confidence:

- base 75
- 동일 planName/recurringCadence면 +10
- cancelSentAt 이후 2회 이상 반복 과금이면 +10
- cancel evidence(메일 발송 기록)가 없고 수동 표기면 -20

evidence:

- cancel mail subject/body excerpt(감사로그)
- 이후 청구 line item excerpt

estimatedSavings:

- 다음 1~2회 청구 예상액(최근 월 금액 기준) \* 1~2 (ASSUMPTION)

권장 액션:

- RefundRequest + Clarification

### L-04 트라이얼 종료 후 자동 결제(TRIAL_TO_PAID)

정의(LLM/규칙 혼합):

- 첫 유료 결제이며 vendor가 “trial” 키워드/0원 line item/“free trial ends” 문구가 이전 문서에 존재
- 또는 첫 결제 invoiceDate가 설치/온보딩(사용자 입력) 14일 이내(ASSUMPTION)

MVP 구현:

- 규칙: vendor의 첫 CHARGE line item이 있고, description/notes/extracted text에 "trial", "free", "14 days" 등이 있으면 flag
- LLM classification으로 “trial-to-paid 가능성” 0~100 score

confidence:

- base 55
- trial 키워드 + evidence 명확하면 +25
- installDate 근거가 없으면 -10

evidence:

- trial 문구 excerpt + 첫 유료 청구 excerpt

estimatedSavings:

- 최근 월 금액(한 달) = potential savings(바로 해지 시)

권장 액션:

- CancelRequest 또는 DowngradeRequest

### L-05 설치되지 않은 앱인데 청구됨(UNINSTALLED_APP_CHARGE)

정의:

- vendor.category=SHOPIFY_APP(또는 사용자가 “Shopify app”로 지정)
- Shopify 설치 앱 목록에 vendor(앱 이름/handle)가 없는데 최근 청구가 존재

ASSUMPTION:

- 설치 앱 목록을 API로 안정적으로 얻지 못할 수 있다.
- 이 경우, 사용자가 “현재 설치 앱 목록”을 수동 입력/업로드하여 비교한다.

confidence:

- 설치 앱 목록이 신뢰 가능(최근 7일 내 sync)하면 base 85
- 목록이 오래되면 -20
- vendor 매칭이 alias fuzzy match면 -10

evidence:

- 청구 line item excerpt
- 설치 앱 목록 스냅샷(텍스트)에서 “없음” 증거는 시스템이 “negative proof”를 직접 인용하기 어려움
  - 대신 “Synced apps list date”와 “not found”를 시스템 설명으로 제공

estimatedSavings:

- 최근 월 금액(정기 결제면 1~3개월치 잠재 절감 표시)

권장 액션:

- RefundRequest + CancelRequest(또는 Clarification)

### (보너스) L-06 연간 갱신 임박(UPCOMING_RENEWAL)

정의:

- recurringCadence=YEARLY 이고 periodEnd가 14일 이내
- “자동 갱신” 가능성이 있으면 경고

confidence:

- base 70 (periodEnd 확실하면 +20)

estimatedSavings:

- 연간 금액 전체(갱신 방지 시)

권장 액션:

- CancelRequest

## 5) 탐지 실행 전략(배치)

- 기본: 문서 정규화 완료 시 해당 vendor/month 범위만 증분 탐지
- 주간 리포트 생성 시: 최근 90일 전체 재탐지(ASSUMPTION: 데이터량 manageable)
- 중복/오탐 방지:
  - finding fingerprint 생성:
    - hash(type, shopId, vendorId, periodStart month, primaryLineItemId or amount)
  - 동일 fingerprint가 OPEN이면 업데이트(금액/근거 추가), 새로 생성하지 않음

## 6) 설명가능성(Explainability) 템플릿

- 규칙 기반 finding은 템플릿으로 설명:
  - “전월 $X → 이번달 $Y (+Z%)로 급등했습니다. 근거: 인보이스 {doc} {page/line}…”
- LLM을 써서 자연어 요약을 만들 수 있으나 MVP에서는 “설명 템플릿 + 근거” 우선
  - 이유: 환각/과장 리스크 최소화
