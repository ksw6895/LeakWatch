# 배포/운영(DevOps) 가이드

## 0) 환경 구성

- dev: 로컬 + docker compose
- staging: 실제 Shopify dev store 연결, 실제 R2 bucket(스테이징), 실제 Mailgun sandbox
- prod: app.leakwatch.io, production DB, production Mailgun

## 1) 인프라 선택(고정)

- Vercel: Next.js web
- Fly.io: api, worker(프로세스 그룹)
- Supabase Postgres: DB
- Upstash Redis: BullMQ backend
- Cloudflare R2: file storage
- Sentry: 에러/트레이싱
- Mailgun: outbound email + webhook

## 2) CI/CD (GitHub Actions)

파이프라인(권장):

- on PR:
  - pnpm install
  - lint, typecheck, unit tests
  - build (web/api/worker)
- on main merge:
  - deploy web → Vercel
  - deploy api/worker → Fly.io
  - run Prisma migrate deploy

배포 원칙:

- DB migration은 backward-compatible 먼저
- worker는 API보다 먼저 배포해도 안전하도록(큐 처리 버전 호환) 계약 유지

## 3) 환경변수(필수)

### 공통

- NODE_ENV=production|staging|development
- DATABASE_URL=postgresql://...
- REDIS_URL=rediss://...
- LW_ENCRYPTION_KEY_32B=base64(32bytes)
- LW_BASE_URL=https://app.leakwatch.io

### Shopify

- SHOPIFY_API_KEY=...
- SHOPIFY_API_SECRET=...
- SHOPIFY_SCOPES=comma-separated
- SHOPIFY_APP_URL=https://app.leakwatch.io
- SHOPIFY_WEBHOOK_SECRET=... (또는 API secret reuse)

### R2(S3)

- R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
- R2_ACCESS_KEY_ID=...
- R2_SECRET_ACCESS_KEY=...
- R2_BUCKET=leakwatch-prod
- R2_PUBLIC_BASE_URL= (비공개면 불필요)

### OpenAI

- OPENAI_API_KEY=...
- OPENAI_MODEL_NORMALIZE=gpt-4o-mini (ASSUMPTION)
- OPENAI_MODEL_WRITE=gpt-4o (ASSUMPTION)
- OPENAI_MAX_RETRIES=3

### Mailgun

- MAILGUN_API_KEY=...
- MAILGUN_DOMAIN=actions.leakwatch.io
- MAILGUN_WEBHOOK_SIGNING_KEY=...
- MAIL_FROM=LeakWatch Actions <actions@leakwatch.io>

### Sentry

- SENTRY_DSN_WEB=...
- SENTRY_DSN_API=...
- SENTRY_DSN_WORKER=...

## 4) 배포 구성(Fly.io)

- app: leakwatch-api
  - process group: api (port 4000)
  - process group: worker (no public port)
- scale:
  - api: 1~2 instances
  - worker: 1 instance(초기), concurrency=2~4
- secrets: fly secrets set ...

## 5) 관측성(Observability)

### 5.1 로그

- Pino JSON
- request_id/correlation_id(job_id) 포함
- 민감정보 마스킹(Authorization, tokens, presigned URL)

### 5.2 Sentry

- API: NestJS integration + performance tracing
- Worker: job processor wrapper로 error capture
- Web: Next.js integration

### 5.3 알림(Alerting)

- Sentry alert:
  - error rate spike
  - job 실패율 > 5% (worker가 metric을 Sentry breadcrumb로 보낼 수 있음)
- 운영 이메일/Slack webhook(선택)

## 6) 롤백 전략

- Web(Vercel): 이전 배포로 revert
- Fly:
  - fly releases list
  - fly deploy --image <previous>
- DB:
  - destructive migration 금지
  - rollback은 “새 migration으로 되돌리는 방식”을 기본으로

## 7) 비용 최소화 가드레일(MVP)

- 업로드 크기/페이지 제한
- LLM 호출:
  - 캐시(동일 sha256 text 입력이면 재사용)
  - 요약 후 정규화(긴 문서는 먼저 “invoice-relevant lines” 추출)
  - 모델 분리: normalize는 mini, write는 big
- 주간 리포트는 batch job으로 1회 생성 후 저장(매 조회마다 생성 금지)
