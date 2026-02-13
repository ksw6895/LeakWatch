# Analytics / Metrics 설계

## 0) 목적

- Activation, TTV, Retention, Savings, Action funnel을 정량화
- 비용(LLM/메일/스토리지) 대비 고객 가치(절감액)를 추적해 가격/제한치를 최적화

## 1) 핵심 KPI 정의

### 1.1 Activation

- A1: 설치 후 24시간 내 문서 업로드 1건 이상 비율
  - numerator: orgs with >=1 document_version UPLOADED within 24h of installedAt
  - denominator: installed orgs

### 1.2 Time-to-Value(TTV)

- T1: 첫 업로드 후 30분 내 OPEN finding 1개 이상 생성 비율
- T2: 첫 세션에서 “잠재 절감액” 1개 이상 노출 비율

### 1.3 Action Funnel

- F1: Finding 상세 조회 → ActionRequest 생성률
- F2: ActionRequest 생성 → Approve 비율
- F3: Approve → Mail delivered 비율

### 1.4 Savings

- PotentialSavings(잠재): OPEN findings의 estimatedSavings 합
- ConfirmedSavings(확정):
  - REFUND: 환불/크레딧 문서 업로드(REFUND/CREDIT lineItem)와 매칭된 금액
  - CANCEL: 이후 1~2개월 동일 vendor recurring charge가 사라짐으로 확인된 절감액
  - (MVP) 사용자 “Resolved + amount” 입력으로 확정값 저장(옵션)

### 1.5 Retention

- R1: 주간 리포트 이메일 ON 상태 유지율(4주)
- R2: 월 1회 이상 로그인/보고서 조회율

## 2) 이벤트 트래킹 스키마

도구 선택(권장): PostHog(또는 자체 DB events 테이블)
MVP는 DB events 테이블로 시작해도 됨.

Event {
eventId: cuid,
occurredAt: ISO,
orgId, shopId?, userId?,
name: string,
properties: json
}

필수 이벤트 목록:

- auth.shopify_install_completed { shopDomain }
- app.opened { shopDomain, embedded: true }
- document.upload_initiated { mimeType, byteSize }
- document.upload_completed { documentVersionId }
- document.processing_failed { step, errorCode }
- invoice.normalized { documentVersionId, confidence, missingFieldsCount }
- detection.findings_created { count, types[] }
- finding.viewed { findingId, type }
- finding.dismissed { findingId }
- action.request_created { actionRequestId, type }
- action.approved { actionRequestId }
- action.sent { actionRunId, provider: "mailgun" }
- action.delivered { actionRunId }
- report.generated { period, periodStart }
- report.email_sent { reportId }
- plan.upgraded { from, to }

## 3) 절감액 계산식(구체)

### 3.1 DUPLICATE_CHARGE

- ConfirmedSavings = duplicatedChargeAmount (환불 확인 전에는 Potential)
- PotentialSavings = min(duplicate pair amounts)

### 3.2 MOM_SPIKE

- PotentialSavings = max(0, currentMonth - prevMonth) \* 0.5 (ASSUMPTION)
- ConfirmedSavings = 사용자 입력 또는 다음 달 금액 감소분(보수적으로)

### 3.3 POST_CANCELLATION

- PotentialSavings = lastMonthlyCharge \* 2 (ASSUMPTION: 2개월 방지)
- ConfirmedSavings = cancelSentAt 이후 2개월 내 charge가 없으면 lastMonthlyCharge\*2

### 3.4 UNINSTALLED_APP_CHARGE

- PotentialSavings = lastMonthlyCharge \* 3 (ASSUMPTION)
- ConfirmedSavings = 이후 3개월 charge 없음으로 확인

## 4) 비용 메트릭(원가)

- openai_tokens_in/out per org/day
- openai_requests per org/day
- uploads_bytes per org/day
- emails_sent per org/day
- job_failures per day
- 평균 처리시간:
  - upload→normalized latency
  - normalized→finding latency
