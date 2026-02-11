# Step 07 — Evidence Pack Generator (Zip/PDF)

## 목표(사용자 가치)
- 사용자가 벤더에 환불/해지 요청 시 “증빙”을 자동으로 첨부해 커뮤니케이션 시간을 줄인다.

## 범위/비범위
- 범위:
  - finding 기반 evidence pack(zip) 생성
  - R2 저장 + 다운로드 링크
  - action draft 화면에서 첨부 표시
- 비범위:
  - PDF 페이지 하이라이트(좌표 없는 MVP에서 제외)

## 선행 조건(필요 계정/키/설정)
- R2 저장/다운로드 가능
- finding/evidence_refs 존재

## 구현 체크리스트(세부 태스크)
1) EvidencePackService
- 입력: findingId
- 출력: attachmentKey(R2)
- zip 구성:
  - 00_case_summary.html (또는 pdf)
  - 01_invoices/ 원본 파일 복사(필요 최소)
  - 02_excerpts.txt
  - 03_metadata.json

2) Case summary 생성
- 템플릿(HTML):
  - finding title/summary/confidence/savings
  - evidence table(page/line/excerpt)
  - timeline(청구/해지/중복 등)
- (옵션) HTML→PDF 변환:
  - Playwright printToPDF 또는 pdf-lib
  - MVP는 HTML로도 충분(메일 첨부 대신 링크 제공 가능)

3) Worker job
- GENERATE_EVIDENCE_PACK enqueue from ActionRequest create
- idempotent: findingId 기준 이미 있으면 재사용

4) API
- GET /v1/evidence-packs/{id}/download (presigned GET)

## 파일/디렉토리 구조(추가/변경 파일 명시)
- apps/worker/src/evidence/pack.ts
- apps/worker/src/jobs/evidence-pack.ts
- apps/api/src/modules/evidence/*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)
- EvidencePackBuilder
  - buildFindingSummaryHtml(finding, evidence, lineItems)
  - buildZip(files[]) → buffer/stream
- StorageClient.putObject(key, stream)

## API/DB 변경사항
- action_requests.attachmentKey 업데이트
- (옵션) evidence_packs 테이블 추가(메타 관리)

## 테스트(케이스 + 실행 커맨드)
- finding fixture로 zip 생성 후:
  - zip에 4개 파일 존재
  - excerpts 내용에 evidence pointer 포함
- pnpm test:worker

## Definition of Done(정량 기준)
- ActionRequest 생성 시 1분 내 evidence pack 생성 완료(가정)
- UI에서 evidence_pack.zip 다운로드 가능
- zip 내에 원본 인보이스가 포함

## 흔한 함정/디버깅 팁
- zip 생성 시 메모리 폭증 → stream 기반 zip 사용(예: yazl/archiver)
- 원본 파일을 무조건 다 넣지 말고 “finding과 관련된 문서만” 포함

## 롤백/마이그레이션 주의사항
- attachmentKey 포맷 변경 시 기존 다운로드 링크 깨짐 → key versioning
