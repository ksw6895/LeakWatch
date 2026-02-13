# Incident Runbook (운영 장애 대응)

## 1) 분류

- Sev1: 인증 불가/데이터 유출 의심/대규모 메일 오발송
- Sev2: 업로드/정규화가 전면 실패
- Sev3: 탐지 결과 일부 누락/지연

## 2) 공통 초기 대응

1. Sentry 확인(Spike, new release correlation)
2. 최근 배포 롤백 필요 여부 판단
3. 영향 범위(org/shop 수) 산정
4. 고객 커뮤니케이션 템플릿(간단):
   - 어떤 기능이 영향을 받았는지
   - 데이터 안전 여부
   - 다음 액션(임시 우회/재시도)

## 3) 자주 터지는 케이스

- OpenAI rate limit:
  - worker concurrency 낮추기
  - 캐시 hit 여부 확인
  - backoff 증가
- R2 권한 오류:
  - access key rotation 확인
  - presigned URL 생성 로직 점검
- Mailgun webhook 서명 실패:
  - signing key mismatch
  - raw body parsing 확인(Express/Nest body parser)

## 4) 사후 조치

- 재발 방지: alert rule 추가, guardrail 조정
- postmortem 문서화(AuditLog + job logs 참조)
