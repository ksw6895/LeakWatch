# Error Codes (API/Worker 공통)

## 문서 처리(DocumentVersion)
- FILE_DOWNLOAD_FAILED: 스토리지에서 파일 다운로드 실패
- UNSUPPORTED_MIME: 지원하지 않는 파일 타입
- PDF_TEXT_EXTRACTION_EMPTY: PDF에서 텍스트 추출 결과가 비어있음
- IMAGE_TEXT_EXTRACTION_FAILED: 이미지/스캔 PDF 텍스트 추출 실패
- NORMALIZATION_SCHEMA_INVALID: LLM 출력이 스키마 검증 실패
- NORMALIZATION_REPAIR_FAILED: repair 시도 후에도 실패
- DETECTION_FAILED: 탐지 엔진 실행 실패

## 권한/인증
- AUTH_INVALID_TOKEN: 토큰 검증 실패
- AUTH_FORBIDDEN: 권한 부족
- TENANT_MISMATCH: org/shop 경계 위반

## 이메일/액션
- ACTION_INVALID_EMAIL: 수신자 이메일 형식 오류
- MAIL_SEND_FAILED: 메일 발송 실패
- MAIL_WEBHOOK_INVALID: webhook 서명 검증 실패

## 레이트리밋/가드레일
- RATE_LIMIT_EXCEEDED: 요청/메일 발송 제한 초과
- FILE_TOO_LARGE: 업로드 파일 크기 제한 초과
- FILE_TOO_MANY_PAGES: PDF 페이지 제한 초과
