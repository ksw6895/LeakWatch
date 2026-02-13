# Step 04 — Ingestion: Upload + Storage + Versioning

## 목표(사용자 가치)

- 사용자가 인보이스를 업로드하면 “저장/버전관리/처리 시작”까지 끝난다.

## 범위/비범위

- 범위:
  - Document/DocumentVersion 생성
  - Presigned URL로 R2 업로드
  - complete endpoint로 ingestion job enqueue
  - UI 업로드 화면/상태표시
- 비범위:
  - 실제 텍스트 추출/정규화(다음 스텝)

## 선행 조건(필요 계정/키/설정)

- R2 bucket + access keys
- Redis/BullMQ 연결
- Shop 연결 완료(step-02)

## 구현 체크리스트(세부 태스크)

1. StorageClient(R2 S3 호환)

- presignPut(key, contentType, maxBytes, expiresSec)
- presignGet(key, expiresSec)
- head/getObject (worker용)

2. API: create document

- POST /v1/shops/{shopId}/documents
- 입력: fileName, mimeType, byteSize, sha256, vendorHint?
- 처리:
  - Document 생성(또는 vendorHint 기반 그룹핑)
  - DocumentVersion 생성(status=CREATED)
  - storageKey 생성
  - presigned PUT 반환

3. API: complete upload

- POST /v1/documents/{documentId}/versions/{versionId}/complete
- status=UPLOADED
- queue.add("INGEST_DOCUMENT", {documentVersionId})

4. Web UI

- Dropzone + progress
- 업로드 완료 후 documents list refresh
- status badge 표시

5. Guardrails

- byteSize > 20MB → 413 FILE_TOO_LARGE
- mimeType whitelist

## 파일/디렉토리 구조(추가/변경 파일 명시)

- apps/api/src/modules/documents/\*
- apps/worker/src/queue/\*
- apps/web/src/app/(embedded)/app/uploads/\*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)

- DocumentsService
  - createDocumentVersion(shopId, meta) → {documentVersionId, presignedUrl}
  - completeUpload(documentVersionId)
- QueueService
  - enqueueIngest(documentVersionId)

## API/DB 변경사항

- Document, DocumentVersion 사용
- usage_counters.uploads_bytes 업데이트(옵션)

## 테스트(케이스 + 실행 커맨드)

- API integration:
  - create→complete 후 documentVersion.status=UPLOADED
  - 잘못된 mimeType 차단
- UI:
  - 업로드 성공 시 테이블에 row 생성
- pnpm test:api, pnpm --filter @leakwatch/web test

## Definition of Done(정량 기준)

- 업로드 1건이 R2에 저장되고, DB에 메타가 남으며, 큐에 job이 들어간다.
- 업로드 실패(용량/타입) 시 사용자에게 명확한 에러가 뜬다.

## 흔한 함정/디버깅 팁

- presigned URL로 업로드 시 CORS 설정 필요(R2 bucket CORS)
- sha256는 브라우저에서 계산하면 비용이 크므로:
  - MVP는 서버에서 계산(업로드 후 worker에서)로 대체 가능
  - 단, 문서 요구사항상 sha256가 필요 → 초기엔 클라이언트 계산 옵션

## 롤백/마이그레이션 주의사항

- storageKey 포맷 변경 시 기존 파일 접근 경로 깨짐 → versioning 정책 유지

## 완료 상태 (2026-02-12, 실제 구현 기준)

### 구현 완료

- [x] `StorageClient` 구현 (`apps/api/src/modules/documents/storage/storage.client.ts`)
  - `presignPut`, `presignGet`, `headObject`, `getObject`
- [x] 문서 생성 API 구현
  - `POST /v1/shops/{shopId}/documents`
  - 입력: `fileName`, `mimeType`, `byteSize`, `sha256`, `vendorHint?`
  - 처리: `Document` + `DocumentVersion(status=CREATED)` + `storageKey` + presigned PUT 반환
- [x] 업로드 완료 API 구현
  - `POST /v1/documents/{documentId}/versions/{versionId}/complete`
  - 처리: `status=UPLOADED` + `INGEST_DOCUMENT` 큐 enqueue
- [x] 업로드 UI 추가
  - 경로: `/app/uploads`
  - 파일 선택/드래그 앤 드롭, 진행률 표시, 에러 표시, 최신 문서/상태 배지 표시
- [x] Guardrails 적용
  - 파일 크기 20MB 초과 시 `413`
  - MIME 화이트리스트 외 타입 `415`

### 검증 완료

- [x] API 통합 테스트 추가 (`apps/api/test/documents-upload.spec.ts`)
  - create → complete 후 `UPLOADED` 상태 확인
  - 큐에 `INGEST_DOCUMENT` job enqueue 확인
  - unsupported mime `415` 확인
  - oversized file `413` 확인
- [x] 전체 스모크 통과
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

### 아직 안 한 것(의도적으로 다음 step으로 이월)

- [x] INGEST_DOCUMENT 실제 텍스트 추출 파이프라인 (step-05에서 구현 완료)
- [x] NORMALIZE 단계 연결 (step-05에서 구현 완료)
- [x] RUN_DETECTION 실제 탐지 엔진 구현(step-06 구현 완료)
- [ ] R2 실계정 CORS 설정 기반 브라우저 업로드 실환경 검증(로컬 코드 경로는 구현 완료)
