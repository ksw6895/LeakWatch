# LeakWatch

LeakWatch는 Shopify 스토어의 구독/앱 비용 누수를 탐지하기 위한 SaaS입니다.
현재 저장소는 monorepo(`web`/`api`/`worker`) 구조로 되어 있고, Step 0-4(Shopify OAuth + Embedded + 업로드 준비)까지 구현되어 있습니다.

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
- `.env`에서 `SHOPIFY_*`, `NEXT_PUBLIC_SHOPIFY_API_KEY`, `R2_*`, `LW_ENCRYPTION_KEY_32B`를 실제 값으로 교체합니다.

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
ngrok http 3000
```

2. `.env` 값 3개를 동일한 ngrok HTTPS 주소로 설정
- `SHOPIFY_APP_URL`
- `API_BASE_URL`
- `NEXT_PUBLIC_API_URL`

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

## 문서

- 전체 문서 인덱스: `docs/README.md`
- Step 0-4 실전 가이드: `docs/runbooks/step-00-04-setup-playbook.ko.md`
- 단계별 구현: `docs/steps/`
