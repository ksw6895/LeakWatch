# Step 09 — Dashboard & Weekly/Monthly Reporting

## 목표(사용자 가치)

- 사용자가 매주/매월 비용 누수를 “루틴”으로 관리할 수 있다.

## 범위/비범위

- 범위:
  - Dashboard KPI/Top leaks UI
  - Reports 생성(주간/월간)
  - 이메일 리포트 발송(요금제에 따라)
- 비범위:
  - 에이전시 멀티 스토어(다음 스텝)

## 선행 조건(필요 계정/키/설정)

- findings 생성 가능
- contactEmail 설정
- Mailgun 발송 가능

## 구현 체크리스트(세부 태스크)

1. Dashboard API

- /v1/shops/{shopId}/summary
  - thisMonthSpend
  - potentialSavings
  - openActions
  - topFindings(5)

2. Reports 생성 워커

- REPORT_GENERATE job:
  - period=weekly/monthly, date range 계산(shop.timezone)
  - summaryJson 생성:
    - totalSpend, delta vs prev, top vendors, top findings
  - report row upsert
  - (옵션) HTML/PDF snapshot 저장

3. 스케줄링

- BullMQ repeatable job:
  - weekly: 월요일 09:00 shop.timezone (ASSUMPTION)
  - monthly: 1일 10:00 shop.timezone
- plan에 따라:
  - FREE: 생성만, 이메일 발송 없음
  - STARTER/PRO: 이메일 발송

4. Reports UI

- /app/reports 목록/상세
- “Generate now”(관리자 버튼)

5. Report email

- 간단한 HTML 템플릿
- 링크 포함(앱으로 이동)

## 파일/디렉토리 구조(추가/변경 파일 명시)

- apps/api/src/modules/reports/\*
- apps/worker/src/jobs/report-generate.ts
- apps/web/src/app/(embedded)/app/page.tsx (dashboard)
- apps/web/src/app/(embedded)/app/reports/\*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)

- SummaryService
  - computeMonthlySpend(shopId, month)
  - computePotentialSavings(shopId)
- ReportService
  - generate(shopId, period, range) → report
  - sendEmail(report, contactEmail)

## API/DB 변경사항

- reports 테이블 사용
- usage_counters: report_emails_sent

## 테스트(케이스 + 실행 커맨드)

- 주간 range 계산 테스트(타임존)
- report 생성 후 report row upsert 확인
- pnpm test:worker

## Definition of Done(정량 기준)

- dashboard가 실제 데이터로 렌더
- 주간 리포트 job이 자동 실행되고 reports 화면에서 확인 가능
- STARTER 이상이면 이메일 수신 가능

## 흔한 함정/디버깅 팁

- 타임존 기준 week/month 경계 계산 오류가 흔함 → date-fns-tz 사용 권장
- 리포트가 많아지면 조회 비용 증가 → report snapshot 저장

## 롤백/마이그레이션 주의사항

- repeatable job key 변경 시 중복 스케줄 생성 가능 → 기존 repeatable 제거 후 재등록

## 완료 상태(코드 반영)

- [x] Dashboard API 구현: `GET /v1/shops/:shopId/summary`
- [x] Reports 목록/상세/수동 생성 API 구현: `GET /v1/reports`, `GET /v1/reports/:id`, `POST /v1/reports/generate`
- [x] Worker `REPORT_GENERATE` job 구현: `apps/worker/src/jobs/report-generate.ts`
- [x] Worker 스케줄 등록(weekly/monthly) 구현: `apps/worker/src/main.ts`
- [x] Embedded dashboard snapshot 반영: `apps/web/src/components/embedded-shell.tsx`
- [x] Reports UI 구현: `apps/web/src/app/(embedded)/app/reports/*`
- [x] 테스트 추가: `apps/api/test/reports.spec.ts`, `apps/worker/test/report-generate.test.ts`
