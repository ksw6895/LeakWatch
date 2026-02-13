# Shopify 앱 실서비스 출시 체크리스트 (한국 개발자용)

목표: `dev` 환경을 넘어, 실제 Shopify App Store 제출/운영 가능한 상태까지 필요한 기술/운영 조치를 빠짐없이 수행한다.

대상: LeakWatch 같은 Embedded Public App을 Shopify 파트너가 실서비스로 출시하는 팀.

## 0) 빠른 결론 (출시 전 필수 12개)

- [ ] 프로덕션 URL/리다이렉트 URL/웹훅 URL을 Partner Dashboard에 등록
- [ ] Embedded + App Bridge + Session Token 인증을 실제 프로덕션 트래픽에서 검증
- [ ] OAuth state/hmac/shop 도메인 검증 및 토큰 암호화 저장(AES-256-GCM) 확인
- [ ] Mandatory compliance webhooks 3종(`customers/data_request`, `customers/redact`, `shop/redact`) 구독/검증
- [ ] `app/uninstalled` 처리(토큰 무효화, 스케줄 잡 정리, 감사로그) 검증
- [ ] 최소 권한 스코프 재검토(불필요 scope 제거)
- [ ] Billing 플랜/업그레이드/웹훅 반영/권한(entitlement) 차단 로직 검증
- [ ] 개인정보처리방침/지원 URL/앱 설명/스크린샷 등 심사 메타데이터 준비
- [ ] 장애 추적(Sentry), 구조화 로그(request_id/job_id), 알림 룰 설정
- [ ] 데이터 보관/삭제 runbook과 실제 삭제 절차 리허설
- [ ] 스테이징/프로덕션 E2E 스모크(업로드 -> 정규화 -> 탐지 -> 액션 발송 -> 리포트)
- [ ] App Store 요구사항 체크리스트 자체 점검 후 제출

## 1) 환경 승격 전략 (dev -> staging -> prod)

### 1.1 권장 환경

- `dev`: 로컬 개발 + ngrok
- `staging`: 실제 Shopify dev store 연결, 실제 R2/Redis/Postgres, Mailgun sandbox
- `prod`: 실서비스 도메인/실제 결제/실제 알림

LeakWatch 기준 인프라 매핑:

- Web: Vercel
- API/Worker: Fly.io(process group 분리)
- DB: Supabase/Neon Postgres
- Queue: Upstash Redis
- Storage: Cloudflare R2(private)
- Email: Mailgun
- Observability: Sentry + Pino JSON 로그

참고: `docs/operations/DEPLOYMENT_OPS.md`

### 1.2 환경변수 분리 원칙

- `.env` 단일 파일 운용을 피하고 환경별 secret manager 사용
- 절대 git 커밋 금지: `SHOPIFY_API_SECRET`, `OPENAI_API_KEY`, `MAILGUN_API_KEY`, `R2_SECRET_ACCESS_KEY`
- 키 교체(runbook) 포함: 유출/퇴사/권한 변경 시 즉시 회전 가능해야 함

## 2) Shopify 파트너/앱 설정 (출시 전)

### 2.1 Partner Dashboard 설정

- [ ] App URL = 프로덕션 웹 URL
- [ ] Allowed redirection URL(s) = 프로덕션 콜백 URL
- [ ] Webhook URL(app/uninstalled) = 프로덕션 API URL
- [ ] Embedded app = ON
- [ ] 배포 채널(공개/제한 공개) 전략 결정

참고: `docs/operations/INTEGRATIONS_SHOPIFY.md`

### 2.2 OAuth 보안 체크

- [ ] `state` nonce 검증
- [ ] `hmac` 검증
- [ ] `shop` 도메인 정규식 검증
- [ ] offline access token 암호화 저장(AES-256-GCM)

코드 위치(LeakWatch):

- `apps/api/src/modules/shopify/shopify-auth.service.ts`
- `apps/api/src/modules/shopify/shopify.controller.ts`

## 3) Embedded 인증/세션 토큰 (심사 핵심)

- [ ] 브라우저 쿠키 의존이 아닌 session token 기반 인증
- [ ] 프론트 -> API 호출 시 토큰 전달/검증 일관성 확인
- [ ] 실제 Shopify Admin 내부 사용 텔레메트리 기준으로 동작 검증

코드 위치(LeakWatch):

- `apps/web/src/lib/shopify/session-token.ts`
- `apps/web/src/lib/api/fetcher.ts`
- `apps/api/src/modules/auth/shopify-session.guard.ts`

## 4) Mandatory Compliance Webhooks (App Store 제출 전 필수)

Public App은 개인정보를 저장하지 않더라도 아래 3개 웹훅 대응이 필요하다.

- `customers/data_request`
- `customers/redact`
- `shop/redact`

실행 체크:

- [ ] 웹훅 구독 등록
- [ ] HMAC 검증(strict)
- [ ] 삭제/제공 처리 runbook 보유
- [ ] 처리 결과 감사로그 보관

연계 문서:

- `docs/operations/SECURITY_PRIVACY.md`
- `docs/operations/runbooks/data-deletion.md`

## 5) Billing/플랜/권한 차단 검증

- [ ] FREE/STARTER/PRO 제한치가 API에서 강제되는지 확인
- [ ] 업로드/이메일 발송 제한 초과 시 명확한 오류 + 업그레이드 유도
- [ ] Shopify Billing confirmation URL -> 구독 상태 반영까지 E2E 검증

코드 위치(LeakWatch):

- `apps/api/src/modules/billing/billing.controller.ts`
- `apps/api/src/modules/billing/billing.service.ts`
- `apps/web/src/app/(embedded)/app/settings/billing/page.tsx`

## 6) 데이터 보안/개인정보/감사 추적

- [ ] R2 bucket private + presigned URL 만료시간 준수
- [ ] 로그에서 민감정보(토큰/서명 쿼리) 마스킹
- [ ] 감사로그(업로드/액션 승인/설정 변경/결제 변경) 누락 없음
- [ ] 데이터 보관기간 및 삭제 요청 처리 기준 확정

참고:

- `docs/operations/SECURITY_PRIVACY.md`
- `docs/operations/runbooks/incident.md`
- `docs/operations/runbooks/data-deletion.md`

## 7) 관측성/운영 안정성 (릴리즈 가드레일)

- [ ] request_id/correlation_id가 API/Worker 전 구간에서 추적 가능
- [ ] Sentry(Web/API/Worker) 연결 및 알림 룰 설정
- [ ] 업로드/정규화/발송 실패율 모니터링 지표 정의
- [ ] rate limit 정책 동작 검증(429)

코드 위치(LeakWatch):

- `apps/api/src/middleware/request-id.middleware.ts`
- `apps/api/src/common/rate-limiter.service.ts`
- `apps/worker/src/jobs/normalize.ts`

## 8) App Store 제출 패키지 준비

- [ ] 앱 설명(무엇을 자동화하는지, 제한사항 포함)
- [ ] 가격 정책/플랜 설명(오해 없는 표현)
- [ ] 설치/온보딩 가이드
- [ ] 지원 연락 채널(이메일/문서/응답 SLA)
- [ ] Privacy Policy URL, Terms URL
- [ ] 스크린샷/데모 영상/테스트 계정 준비

실무 팁:

- 심사자는 "작동 여부"보다 "신뢰성/정책 위반 여부"를 먼저 본다.
- 기능이 덜 되어도 에러 없이 끝까지 플로우가 완결되면 통과 확률이 높다.

## 9) 출시 직전 리허설 (권장 1~2일)

### 9.1 E2E 시나리오

1. 앱 설치 -> OAuth 완료
2. 업로드(PDF/CSV/IMG) -> complete
3. Worker ingestion/normalize/detection 완료
4. 누수 상세 확인 -> 액션 draft 생성/수정
5. approve/send -> webhook 이벤트 반영
6. 주간/월간 리포트 생성 확인

### 9.2 실패 복구 시나리오

- [ ] R2 업로드 실패 시 재시도 UX 확인
- [ ] Mailgun 미설정/실패 시 상태 추적 확인
- [ ] Shopify uninstall webhook 수신 후 접근 차단 확인

## 10) 한국 팀 운영 관점 체크포인트

- [ ] 장애 대응 시간대(한국 업무시간 + 주말) 정의
- [ ] 고객 문의 템플릿(한국어/영어) 준비
- [ ] 환율/통화 표기 정책(USD/KRW 혼재 시) 명확화
- [ ] 개인정보 삭제 요청 SLA(예: 영업일 기준) 명시

## 11) 권장 제출 전 최종 명령어

```bash
docker compose up -d postgres redis
pnpm db:deploy
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

추가로 스테이징에서 실제 Shopify dev store를 붙여 아래 수동 검증까지 완료해야 한다.

- Embedded 인증
- Billing 업그레이드
- Webhook 수신/검증
- 액션 이메일 발송/트래킹

## 12) 공식 참고 링크 (우선순위 높은 순)

- Shopify Launch Hub: https://shopify.dev/docs/apps/launch
- App Store Requirements: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- App Requirements Checklist: https://shopify.dev/docs/apps/launch/app-requirements-checklist
- Pass App Review: https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review
- Session Tokens: https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
- Set Embedded App Authorization: https://shopify.dev/docs/apps/build/authentication-authorization/set-embedded-app-authorization
- Privacy Law Compliance: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance

---

이 문서는 "개발 완료"가 아니라 "출시 가능 상태"를 만들기 위한 체크리스트다.
팀 운영에 맞춰 각 항목에 담당자/기한/증빙 링크(스크린샷, 로그, PR)를 붙여 운영 문서로 승격해 사용할 것을 권장한다.
