# 인보이스 수집/업로드/파서 파이프라인

## 0) MVP 입력 데이터(필수 2가지 선정)
MVP에 “가치 발생”을 위해 반드시 필요한 입력 2가지:
1) **인보이스/영수증 파일(PDF/CSV/이미지)** — 실제 청구 금액/기간/벤더를 알아야 누수를 잡는다.
2) **Shopify 스토어 컨텍스트(Shop/Org + (가능하면) 설치 앱 목록)** — “설치 안 된 앱 과금” 같은 강력한 신호/리스크 평가에 필요.

이메일 포워딩은 V1에서 추가한다(업로드만으로도 MVP 가치 생성 가능).

## 1) 업로드 UX/흐름
1) 사용자가 Upload 화면에서 파일 선택
2) Web → API: `POST /v1/shops/{shopId}/documents` (metadata 전송)
3) API:
   - Document 생성(또는 vendorHint+기간 기반으로 기존 Document 그룹핑 정책 적용 가능)
   - DocumentVersion(version=1..n) 생성
   - presigned PUT URL(R2) 반환
4) Web: presigned URL로 파일 업로드
5) Web → API: `POST /v1/documents/{documentId}/versions/{versionId}/complete`
6) API: status=UPLOADED, INGEST_DOCUMENT job enqueue

## 2) 파일 타입 지원(MVP)
- PDF:
  - 우선: 텍스트 레이어 추출(poppler `pdftotext`)
  - 실패/빈 텍스트: 페이지를 이미지로 변환(`pdftoppm`) 후 LLM vision으로 텍스트 추출
- CSV:
  - delimiter 자동 감지(, ; \t)
  - 헤더 추정, 통화/금액 컬럼 탐지 후 표준화
- 이미지(PNG/JPG):
  - LLM vision으로 텍스트 추출(라인 단위)
  - (옵션) tesseract OCR은 언어/품질 이슈로 MVP에선 제외

ASSUMPTION: Worker Docker 이미지에 poppler-utils 설치 가능(Fly 배포 이미지)
- 검증: 샘플 PDF로 pdftotext/pdftoppm 실행 테스트
- 대안: AWS Textract 등 외부 OCR(비용 증가)

## 3) 스토리지 설계(R2)
Object key 규칙(단일):
- org/{orgId}/shop/{shopId}/documents/{documentId}/versions/{versionId}/{sha256}/{fileName}

정책:
- 업로드 완료 전에는 object가 존재해도 status=UPLOADED 전까지 처리 금지
- sha256 저장 및 중복 업로드 감지
- presigned URL 만료: 10분(ASSUMPTION)
- 다운로드는 presigned GET(권한 체크 후)

## 4) 처리 파이프라인(워커)
### 4.1 INGEST_DOCUMENT(job)
입력: { documentVersionId }
출력:
- extracted_artifacts.textContent (plain text)
- extracted_artifacts.metaJson: { extractor, pages, warnings, detectedLanguage, ... }
- document_versions.status: EXTRACTED 또는 EXTRACTION_FAILED

실패 처리:
- errorCode:
  - FILE_DOWNLOAD_FAILED
  - UNSUPPORTED_MIME
  - PDF_TEXT_EXTRACTION_EMPTY
  - IMAGE_TEXT_EXTRACTION_FAILED
- 실패 시 UI에 “재시도” 버튼 제공(재시도는 새 version 업로드 권장)

### 4.2 NORMALIZE_INVOICE(job)
입력: { documentVersionId }
1) extracted text를 마스킹(/docs/SECURITY_PRIVACY.md)
2) /docs/prompts/normalization.md 프롬프트로 LLM 호출(Strict JSON)
3) Ajv로 JSON schema validation
4) 실패 시 repair prompt 1회
5) 그래도 실패면 NORMALIZATION_FAILED + 누락필드 리스트 저장
6) 성공이면 normalized_invoices + normalized_line_items 저장
7) RUN_DETECTION(job) enqueue (shopId, period range)

### 4.3 RUN_DETECTION(job)
- /docs/DETECTION_RULES.md 규칙대로 수행
- leak_findings/evidence_refs 저장

## 5) Idempotency/중복 처리
- 각 job은 documentVersionId 단위로 “한 번만 성공”을 보장
- 중복 enqueue 시:
  - status가 이미 다음 단계 이상이면 skip
  - 단, 재처리(force) 옵션은 admin-only(운영툴)로 별도 제공

## 6) 업로드 실패/재시도 UX
- 실패 시 권장 UX:
  - “다시 업로드(새 버전)” 버튼
  - 실패 사유(사람이 이해 가능한 문장)
  - 지원되는 파일 형식/가이드 표시
- 운영자 로그:
  - correlation_id=documentVersionId
  - extractor warnings 저장
