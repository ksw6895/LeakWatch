# 보안/개인정보/권한 설계

## 0) 위협 모델(요약)
- OAuth 토큰 유출 → Shopify Admin API 악용
- 업로드된 인보이스(PII 포함) 유출
- 멀티테넌시 취약점 → 다른 고객 데이터 접근
- LLM 프롬프트로 민감정보 전송/로그 노출
- 이메일 발송 악용(스팸/피싱)

## 1) 인증/권한
### 1.1 인증 방식 2종
- Embedded(Shopify): Shopify session token(JWT) 검증
- Agency Portal: Magic link(email) → LW JWT 발급

### 1.2 RBAC
OrgRole:
- OWNER: 모든 권한(결제/설정/발송)
- MEMBER: 업로드/탐지/액션 발송 가능(결제 변경 불가)
- AGENCY_ADMIN: 여러 Shop 읽기+리포트 생성, (옵션) 발송 가능
- AGENCY_VIEWER: 읽기만

권한 체크는 API guard에서 강제:
- 모든 write endpoint는 최소 MEMBER
- billing/settings는 OWNER

## 2) Shopify OAuth 토큰 저장(암호화)
- shopify_tokens.accessTokenEnc에 AES-256-GCM으로 저장
- 마스터키 LW_ENCRYPTION_KEY_32B는 KMS 또는 Fly/Vercel secret으로 저장
- 키 회전:
  - keyVersion 컬럼 추가(옵션)
  - 회전 시 백그라운드에서 재암호화

## 3) 업로드 파일/PII 보호
- R2 bucket은 private
- presigned URL:
  - PUT: 10분 만료, content-length 제한(서명에 포함)
  - GET: 5분 만료
- Object key는 추측 불가능(cuid + sha256 포함)

## 4) LLM 프롬프트 전송 전 마스킹 정책
목표: 누수 탐지에 불필요한 PII 제거

마스킹 대상(전송 전):
- 이메일 주소(벤더 support email 제외) → [EMAIL_1]
- 전화번호 → [PHONE_1]
- 주소 → [ADDR_1]
- 카드 번호(전체/부분) → [CARD_x]
- 개인 이름(고객명) → [NAME_x] (가능하면)

보존 대상:
- 벤더명, 금액, 통화, 날짜, 인보이스 번호(탐지/근거에 필요)
- 상점 도메인(tenant context; 다만 모델 입력에는 최소화)

구현:
- 정규식 기반 1차 마스킹 + LLM에 “개인정보 포함 금지” 지시
- 마스킹 로그는 저장하지 않음(원문은 extracted_artifacts에만 존재)

## 5) 로그/감사로그
- 모든 요청에 request_id, org_id, shop_id(가능한 경우) 포함
- 민감정보는 로그 금지:
  - Authorization 헤더, access token, presigned URL query string
- 감사로그(AuditLog):
  - upload created/complete
  - finding dismissed/resolved
  - action approved/sent
  - settings changed
  - billing changes

## 6) 데이터 보관/삭제(GDPR 기본 준수)
ASSUMPTION: MVP는 기본 보관기간 365일로 고정(설정은 V1)
- Document 원본: 365일
- extracted text/normalized json: 365일
- audit logs: 365일(법적/운영 목적)
- 삭제 요청 처리(runbook 참고):
  - org 단위 삭제: 모든 shop/doc/findings/actions/reports 삭제 + R2 객체 삭제
  - 증적 필요 시: 최소 메타만 익명화(옵션)

## 7) 이메일 발송 보안
- 발송은 반드시 사용자 승인 필요
- Rate limit:
  - org/day max 50 emails (ASSUMPTION)
  - 초과 시 차단 + 지원 문의
- Abuse 탐지:
  - 동일 수신자 대량 발송 차단
  - domain blocklist(스팸 도메인)
