# Step 05 — Normalization: Extraction + LLM + Schema Validation

## 목표(사용자 가치)

- 업로드한 인보이스가 표준 JSON으로 변환되어, 탐지 가능한 라인아이템 데이터가 생성된다.

## 범위/비범위

- 범위:
  - Worker ingestion: pdf/csv/image 텍스트 추출
  - LLM normalize 호출 + strict schema validation(Ajv)
  - repair 1회
  - normalized_invoices + normalized_line_items 저장
- 비범위:
  - 누수 탐지(다음 스텝)

## 선행 조건(필요 계정/키/설정)

- OpenAI API key
- Worker 이미지에 poppler-utils 설치
- Ajv schema 준비(/docs/NORMALIZATION_SCHEMA.md)

## 구현 체크리스트(세부 태스크)

1. Extractors

- pdf:
  - run pdftotext → text
  - text empty면 pdftoppm으로 이미지 생성 → vision extract
- csv:
  - parse rows
  - header mapping + amount/currency/date 추정
  - “텍스트 형태”로 변환(라인 번호 포함) 또는 직접 JSON으로 normalize(권장: 텍스트로 통일)
- image:
  - vision extract → line list
  - 라인 번호 부여

2. text line numbering

- LLM에 보내기 전:
  - 페이지 구분 유지
  - 각 줄에 line number 붙이기(근거 pointer 만들기 위해)

3. PII masking 적용(/docs/SECURITY_PRIVACY.md)
4. Evidence line selection(옵션)

- 텍스트가 너무 길면 evidence_extraction 프롬프트로 관련 라인만 추려 normalize 비용 절감

5. LLMClient 구현

- normalizeInvoice(extractedText, meta) → NormalizedInvoice JSON
- retry: 3회, backoff
- response_format: strict json (가능하면 json_schema)

6. Ajv validation

- fail 시 missingFields/warnings 기록
- repair prompt 1회
- 그래도 실패 시 DocumentVersion.status=NORMALIZATION_FAILED

7. Persist

- NormalizedInvoice.rawJson 저장
- LineItem 테이블로 펼쳐 저장
- vendor canonicalization(초기엔 vendor.name 기반 Vendor upsert)

8. 상태 업데이트

- DocumentVersion: NORMALIZED
- enqueue RUN_DETECTION

## 파일/디렉토리 구조(추가/변경 파일 명시)

- apps/worker/src/extractors/pdf.ts, csv.ts, image.ts
- apps/worker/src/llm/client.ts
- apps/worker/src/jobs/normalize.ts
- apps/api/src/modules/normalization/schema.ts (Ajv)
- packages/shared/src/schemas/normalizedInvoice.schema.json (권장)

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)

- ExtractionService
  - extract(documentVersionId) → { text, meta }
- LLMClient
  - call(model, messages, options) → json
  - normalizeInvoice(...)
- NormalizationService
  - validate(json) → {ok, errors}
  - persist(invoiceJson) → {invoiceId, lineItemIds}

## API/DB 변경사항

- ExtractedArtifact, NormalizedInvoice, NormalizedLineItem 저장
- UsageCounter(openai_tokens_in/out) upsert

## 테스트(케이스 + 실행 커맨드)

- fixtures 3개로:
  - normalize 성공 + schema pass
- schema invalid 출력에 대해 repair 성공 케이스
- openai mock으로 deterministic 테스트
- pnpm test:worker

## Definition of Done(정량 기준)

- 샘플 10개 인보이스에서 normalize 성공률 >= 90%
- 각 lineItem에 evidence pointer + excerpt가 채워진다
- 실패 시 errorCode가 명확하다

## 흔한 함정/디버깅 팁

- PDF 텍스트 추출 결과가 순서가 뒤섞일 수 있음 → line selection 단계에서 금액/날짜 패턴 위주로 추린다
- LLM이 통화를 추론할 때 오류 → invoice에 통화 기호($/€) 근거가 없으면 currency를 null로 두고 warning

## 롤백/마이그레이션 주의사항

- schemaVersion 변경 시 이전 rawJson 호환 고려

## 완료 상태 (2026-02-12, 실제 구현 기준)

### 구현 완료

- [x] Extractor 구현 (`apps/worker/src/extractors/*`)
  - PDF: `pdftotext` 우선, 비어 있으면 `pdftoppm` + vision fallback
  - CSV: delimiter 감지 + row 텍스트화
  - 이미지: vision 기반 라인 추출
- [x] 라인 번호/페이지 구분 + PII 마스킹 + 긴 문서 라인 축약 로직
  - `apps/worker/src/normalization/text.ts`
- [x] LLM Client 구현 (`apps/worker/src/llm/client.ts`)
  - normalize + repair(1회) + retry/backoff
  - vision OCR 추출
- [x] Ajv strict schema validator 구현
  - 공유 스키마: `packages/shared/src/schemas/normalizedInvoice.schema.json`
  - API validator: `apps/api/src/modules/normalization/schema.ts`
  - Worker validator: `apps/worker/src/normalization/validator.ts`
- [x] Persist 구현
  - `NormalizedInvoice.rawJson` 저장
  - `NormalizedLineItem` 펼침 저장
  - vendor upsert/canonicalization + `VendorOnShop` 업데이트
  - `UsageCounter(openai_tokens_in/out)` upsert
- [x] 상태 전이 + 큐 연결
  - `INGEST_DOCUMENT` 성공 시 `NORMALIZE_INVOICE` enqueue
  - normalize 성공 시 `DocumentVersion.status=NORMALIZED`
  - 이후 `RUN_DETECTION` enqueue

### 테스트/검증 완료

- [x] Worker schema validator 테스트 추가
  - `apps/worker/test/normalization-validator.test.ts`
- [x] Worker 큐 테스트 업데이트
  - `apps/worker/test/queue.test.ts`
- [x] 통과 확인
  - `pnpm --filter @leakwatch/worker test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`

### 다음 step으로 이월

- [x] Step 06 탐지 엔진 본체(`RUN_DETECTION` job 실제 탐지/저장 처리)
- [ ] 실운영 샘플 10건 기준 normalize 성공률(>=90%) 계측 리포트
