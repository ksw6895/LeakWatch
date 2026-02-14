# LeakWatch

## Figma Export (One Command)

1. Run the exporter:

```bash
pnpm figma:export
```

2. Drag the `figma-export/png` folder directly into your Figma canvas.

- Capture targets are auto-collected from `apps/web/src/app/**/page.tsx` and can be overridden in `snap.config.ts`.
- Output artifacts are always written to `figma-export/manifest.json`, `figma-export/png/`, and `figma-export/report.md`.
- Rendering/mocking failures do not crash the run; skipped/failed items are listed in `figma-export/report.md`.

LeakWatch는 Shopify 스토어의 구독/앱 비용 누수를 탐지하기 위한 SaaS입니다.
현재 저장소는 monorepo(`web`/`api`/`worker`) 구조로 되어 있고, Step 0-13(Shopify OAuth + Embedded + 업로드 + 정규화 파이프라인 + 탐지 엔진 v1 + 증빙팩 + 액션 발송 추적 + 대시보드/리포트 + agency multi-store + billing/plans + hardening + non-step gap closure)까지 구현되어 있습니다.

## Quick Start (로컬)

1. 요구사항

- Node 20.x
- pnpm 9.x
- Docker

2. 인프라 실행

```bash
docker compose up -d postgres redis
```

※ `pnpm test`/`pnpm build` 실행 전에는 위 명령으로 `localhost:5433`의 PostgreSQL이 기동되어 있어야 합니다.

3. 환경변수 준비

```bash
cp .env.example .env
```

- `.env`에서 `SHOPIFY_*`, `NEXT_PUBLIC_SHOPIFY_API_KEY`, `R2_*`, `LW_ENCRYPTION_KEY_32B`, `OPENAI_*`를 실제 값으로 교체합니다.
- `MAILGUN_*`는 선택값입니다. 비어 있으면 이메일 발송 잡은 `MAILGUN_NOT_CONFIGURED` 상태로 실패 처리됩니다.
- ngrok 단일 도메인 모드에서는 `SHOPIFY_APP_URL`/`API_BASE_URL`을 같은 HTTPS 도메인으로 설정합니다.
- `NEXT_PUBLIC_API_URL`은 비워도 동작(같은 origin 자동 사용)하지만, 명시하려면 같은 도메인 값으로 설정하면 됩니다.

4. 의존성/DB

```bash
pnpm install
pnpm db:migrate -- --name init
pnpm db:deploy
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

### 프론트 수동 E2E 단축 실행 (Mailgun 제외)

export 여러 줄을 매번 입력하지 않도록 단축 스크립트를 추가했다.

1. 기본 부트스트랩 (한 번 실행)

```bash
pnpm e2e:frontend:bootstrap
```

- 내부적으로 `docker compose up -d postgres redis`, `pnpm install`, `pnpm db:deploy`를 실행한다.
- 마지막에 `pnpm dev`는 별도 터미널에서 실행하면 된다(장시간 실행 프로세스).

2. ngrok 실행 (별도 터미널)

```bash
ngrok http --domain=<reserved-domain> 3000
```

실제 공개 URL 확인(placeholder 없이):

```bash
curl -s "http://127.0.0.1:4040/api/tunnels" | jq -r '.tunnels[] | select(.proto=="https") | .public_url'
```

3. `.env` URL 3종 동기화 + OAuth 시작 URL 자동 준비

```bash
pnpm e2e:frontend:prep -- --shop-domain=leakwatch-dev-01.myshopify.com
```

- `--public-url`를 생략하면 ngrok API(`127.0.0.1:4040`)에서 HTTPS URL을 자동 감지한다.
- `.env`의 `SHOPIFY_APP_URL`, `API_BASE_URL`, `NEXT_PUBLIC_API_URL`를 같은 값으로 맞춘다.
- Shopify Partner Dashboard에 넣을 App URL/Redirect/Webhook URL도 함께 출력한다.

4. OAuth 완료 후 콜백 URL 그대로 붙여넣어 프론트 페이지 일괄 오픈

```bash
pnpm e2e:frontend:open -- --callback-url="https://<actual-domain>/app?shop=leakwatch-dev-01.myshopify.com&host=<actual-host>"
```

- `/app`, `/app/uploads`, `/app/leaks`, `/app/actions`, `/app/reports`, `/app/settings`, `/app/settings/billing`, `/app/agency`, `/agency/login`, `/agency/reports`를 연다.

참고:

- `pnpm build`는 로컬 프론트 체험용 수동 E2E에 필수는 아니다(CI/릴리스 검증용).
- `MAILGUN_*`가 비어 있으면 Approve-and-send는 `MAILGUN_NOT_CONFIGURED`로 실패할 수 있고, 이 저장소에서는 정상 동작이다.

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
- Step 13: 문서-구현 갭 클로저(settings/action status/reopened/agency routes/analytics)

## 문서

- 전체 문서 인덱스: `docs/README.md`
- Step 0-4 실전 가이드: `docs/operations/runbooks/step-00-04-setup-playbook.ko.md`
- 단계별 구현: `docs/steps/`
