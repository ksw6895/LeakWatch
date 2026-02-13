# LeakWatch

LeakWatch는 Shopify 스토어의 구독/앱 비용 누수를 탐지하기 위한 SaaS입니다.
현재 저장소는 monorepo(`web`/`api`/`worker`) 구조로 되어 있고, Step 0-12(Shopify OAuth + Embedded + 업로드 + 정규화 파이프라인 + 탐지 엔진 v1 + 증빙팩 + 액션 발송 추적 + 대시보드/리포트 + agency multi-store + billing/plans + hardening)까지 구현되어 있습니다.

## Quick Start (로컬)

1. 요구사항

- Node 20.x
- pnpm 9.x
- Docker

2. 인프라 실행

```bash
docker compose up -d postgres redis
```

3. 환경변수 준비

```bash
cp .env.example .env
```

- `.env`에서 `SHOPIFY_*`, `NEXT_PUBLIC_SHOPIFY_API_KEY`, `R2_*`, `LW_ENCRYPTION_KEY_32B`, `OPENAI_*`, `MAILGUN_*`를 실제 값으로 교체합니다.
- ngrok 단일 도메인 모드에서는 `SHOPIFY_APP_URL`/`API_BASE_URL`을 같은 HTTPS 도메인으로 설정합니다.
- `NEXT_PUBLIC_API_URL`은 비워도 동작(같은 origin 자동 사용)하지만, 명시하려면 같은 도메인 값으로 설정하면 됩니다.

4. 의존성/DB

```bash
pnpm install
pnpm db:migrate -- --name init
```

5. 실행

```bash
pnpm dev
```

## Shopify Embedded 검증(ngrok 1개 모드)

1. ngrok 실행

```bash
ngrok http --domain=<your-reserved-ngrok-domain> 3000
```

- 유료 플랜에서는 Reserved Domain을 쓰면 URL이 고정됩니다(매번 `.env`/Shopify URL 교체 불필요).

2. `.env` 값 설정

- `SHOPIFY_APP_URL`
- `API_BASE_URL`
- `NEXT_PUBLIC_API_URL`(선택, 필요 시 설정)

3. Shopify Dev Dashboard 설정

- App URL: `SHOPIFY_APP_URL`
- Redirect URL: `${API_BASE_URL}/v1/shopify/auth/callback`
- Webhook URL: `${API_BASE_URL}/v1/shopify/webhooks/app-uninstalled`

4. 설치 시작 URL(브라우저)

```text
https://<ngrok-domain>/v1/shopify/auth/start?shop=<your-shop>.myshopify.com
```

## 현재 구현 범위

- Step 00: 가정/결정 문서화
- Step 01: 모노레포/CI/로컬 인프라
- Step 02: Shopify OAuth + Embedded bootstrap + uninstall webhook
- Step 03: core DB + 멀티테넌시/권한
- Step 04: 업로드 API + Presigned URL + queue enqueue + 업로드 UI
- Step 05: Worker ingestion(extractors) + LLM normalize + Ajv schema validation/repair + normalized 저장 + RUN_DETECTION enqueue
- Step 06: Detection Engine v1(5 leak types) + findings 저장/evidence 연결 + findings API + leaks UI
- Step 07: Evidence pack zip 생성 + R2 저장 + 다운로드 presigned URL
- Step 08: Action center(드래프트/수정/승인) + SEND_EMAIL worker + Mailgun webhook 추적 + actions UI
- Step 09: Dashboard summary + reports 생성/목록/상세 + REPORT_GENERATE worker + 주간/월간 스케줄 등록
- Step 10: Org-level summary/shops + connect code shop linking + store switcher + agency dashboard
- Step 11: Billing current/subscribe/webhook + entitlement enforcement + billing settings UI
- Step 12: Request ID/latency logging + rate limiting + LLM cache + CSP headers + Dependabot

## 문서

- 전체 문서 인덱스: `docs/README.md`
- Step 0-4 실전 가이드: `docs/runbooks/step-00-04-setup-playbook.ko.md`
- 단계별 구현: `docs/steps/`

## 지금 남은 핵심 작업(네 상태 기준)

1. OpenAI 실키 설정(`OPENAI_API_KEY`) + 샘플 문서로 `/app/uploads` E2E 확인(create -> PUT -> complete -> EXTRACTED/NORMALIZED)
2. 운영용 정확도 검증(샘플 10건 기준 normalize 성공률/누락률 측정)
3. 실운영 키 설정 후 E2E smoke 및 운영 튜닝
