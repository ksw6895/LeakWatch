# Error Codes (API/Worker 공통)

## API Error Envelope (HTTP)

- 모든 HTTP 에러 응답은 `{ statusCode, errorCode, message, path, timestamp }` 형태를 사용한다.
- 전역 표준화 구현: `apps/api/src/filters/http-exception.filter.ts`
- `errorCode` 우선순위:
  1. 명시적 코드(`FILE_TOO_LARGE` 같은 도메인 상수)
  2. 검증 실패 시 `VALIDATION_ERROR`
  3. 자유 문구 메시지의 SNAKE_CASE 변환

## 문서 처리(DocumentVersion)

- FILE_DOWNLOAD_FAILED: 스토리지에서 파일 다운로드 실패
- UNSUPPORTED_MIME_TYPE: 지원하지 않는 파일 타입
- PDF_TEXT_EXTRACTION_EMPTY: PDF에서 텍스트 추출 결과가 비어있음
- IMAGE_TEXT_EXTRACTION_FAILED: 이미지/스캔 PDF 텍스트 추출 실패
- NORMALIZATION_SCHEMA_INVALID: LLM 출력이 스키마 검증 실패
- NORMALIZATION_REPAIR_FAILED: repair 시도 후에도 실패
- DETECTION_FAILED: 탐지 엔진 실행 실패
- INVALID_SHA256: 업로드 checksum 형식이 유효하지 않음

## 권한/인증

- AUTH_INVALID_TOKEN: 토큰 검증 실패
- AUTH_FORBIDDEN: 권한 부족
- TENANT_MISMATCH: org/shop 경계 위반
- INVALID_OR_EXPIRED_OAUTH_STATE: OAuth state 만료/불일치

## 이메일/액션

- ACTION_INVALID_EMAIL: 수신자 이메일 형식 오류
- MAIL_SEND_FAILED: 메일 발송 실패
- MAIL_WEBHOOK_INVALID: webhook 서명 검증 실패
- EMAIL_LIMIT_EXCEEDED: 일일 이메일 발송 한도 초과

## 레이트리밋/가드레일

- RATE_LIMIT_EXCEEDED: 요청/메일 발송 제한 초과
- RATE_LIMIT_EXCEEDED_UPLOAD: 업로드 API rate limit 초과
- RATE_LIMIT_EXCEEDED_ACTION_APPROVE: 액션 승인/발송 rate limit 초과
- FILE_TOO_LARGE: 업로드 파일 크기 제한 초과
- FILE_TOO_MANY_PAGES: PDF 페이지 제한 초과
- UPLOAD_LIMIT_EXCEEDED: 플랜 업로드 quota 초과
- REPORT_LIMIT_EXCEEDED: 플랜 리포트 생성 quota 초과

## 공유/리포트

- INVALID_SHARE_TOKEN: 공유 토큰이 유효하지 않음
- INVALID_SHARE_TOKEN_PURPOSE: 공유 토큰 목적이 일치하지 않음
- SHARE_TOKEN_REVOKED: 공유 토큰이 회수되었거나 최신 토큰이 아님

## 공통/검증

- VALIDATION_ERROR: DTO/class-validator 검증 실패
