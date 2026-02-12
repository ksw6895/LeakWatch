# Step 06 — Detection Engine v1 (5 leak types)

## 목표(사용자 가치)

- “누수 후보 Top5”가 생성되어 사용자가 바로 절감 의사결정을 할 수 있다.

## 범위/비범위

- 범위:
  - /docs/DETECTION_RULES.md 의 5종 규칙 구현
  - findings 저장 + evidence_refs 연결
  - findings list/detail API
  - UI leaks list/detail 연결
- 비범위:
  - 액션 자동화(다음 스텝)

## 선행 조건(필요 계정/키/설정)

- normalized_line_items 데이터 존재
- vendor canonicalization 최소 구현

## 구현 체크리스트(세부 태스크)

1. DetectionEngine 구현

- 입력: shopId, periodRange(기본 최근 90일)
- 출력: findings[]

2. 규칙 구현

- MOM_SPIKE
- DUPLICATE_CHARGE
- POST_CANCELLATION
- TRIAL_TO_PAID
- UNINSTALLED_APP_CHARGE (가능하면), 아니면 confidence 낮춰 생성 옵션

3. fingerprint로 중복 방지
4. evidence_refs 생성

- lineItem.evidence에서 pointer/excerpt 복사
- finding에 최소 2개 evidence 목표

5. API endpoints

- GET /v1/shops/{shopId}/findings
- GET /v1/findings/{findingId}
- POST /v1/findings/{findingId}/dismiss

6. UI

- /app/leaks 리스트
- /app/leaks/[id] 상세 + evidence 렌더

## 파일/디렉토리 구조(추가/변경 파일 명시)

- apps/worker/src/detectors/\*
- apps/worker/src/jobs/detect.ts
- apps/api/src/modules/findings/\*
- apps/web/src/app/(embedded)/app/leaks/\*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)

- DetectionEngine
  - run(shopId, from, to) → FindingDraft[]
- FindingRepository
  - upsertByFingerprint(...)
- EvidenceBuilder
  - fromLineItem(lineItem) → EvidenceRef

## API/DB 변경사항

- leak_findings, evidence_refs 테이블 사용
- finding status lifecycle 적용

## 테스트(케이스 + 실행 커맨드)

- fixture:
  - duplicate_charge → DUPLICATE_CHARGE 1개
  - mom_spike → MOM_SPIKE 1개
- 멀티테넌시 테스트(다른 org 접근 불가)
- pnpm test:worker, pnpm test:api

## Definition of Done(정량 기준)

- 업로드→정규화 완료 후 5분 내(가정) findings 생성
- leaks 리스트에 Top savings 순으로 표시
- finding 상세에 근거(excerpt + pointer) 2개 이상 표시

## 흔한 함정/디버깅 팁

- periodStart/End가 없는 lineItem이 많으면 탐지가 약해짐 → LLM normalize에서 period 추출 품질을 최우선으로 튜닝
- MoM 비교는 월 경계(타임존) 이슈 → shop.timezone 기준으로 month bucket 계산

## 롤백/마이그레이션 주의사항

- threshold 변경은 DB migration 없이 config로

## 완료 상태 (2026-02-13, 실제 구현 기준)

### 구현 완료

- [x] Detection engine 구현 (`apps/worker/src/jobs/detection.ts`)
  - MOM_SPIKE
  - DUPLICATE_CHARGE
  - POST_CANCELLATION
  - TRIAL_TO_PAID
  - UNINSTALLED_APP_CHARGE
- [x] finding 저장 + evidence 연결
  - 기존 OPEN/REOPENED finding 갱신(upsert 유사 흐름)
  - evidence_refs 재생성으로 최신 근거 유지
- [x] API endpoint 반영
  - `GET /v1/shops/{shopId}/findings`
  - `GET /v1/findings/{findingId}` (evidence 포함)
  - `POST /v1/findings/{findingId}/dismiss`
- [x] UI route 반영
  - `apps/web/src/app/(embedded)/app/leaks/page.tsx`
  - `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx`

### 테스트/검증

- [x] Worker detection 테스트 추가
  - `apps/worker/test/detection.test.ts`
- [x] API multitenancy 테스트 확장
  - shop findings 정렬 검증
  - dismiss endpoint 검증
