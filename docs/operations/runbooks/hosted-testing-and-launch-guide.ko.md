# 로컬 탈출 가이드 (초상세): Vercel + Render로 LeakWatch 운영하기

이 문서는 "로컬에서 `pnpm dev`, `ngrok`, `export`를 반복하지 않고" 바로 서버 환경에서 테스트/검증/출시까지 가는 **실행 매뉴얼**이다.

중요: 이 문서는 **Vercel(Web) + Render(API/Worker/DB/Redis) + R2 + Mailgun** 조합을 기준으로 작성했다.

---

## 0) 이 문서대로만 하면 되는 범위

- 로컬 임시 실행이 아니라, staging/prod 서버를 상시 운영
- 환경변수를 "어디에" 넣어야 하는지 서비스별로 완전히 분리
- Shopify 앱 URL/Redirect/Webhook 설정
- Mailgun/R2 실제 연결
- 배포 후 실패 지점까지 빠르게 찾는 검증 커맨드

---

## 1) 3줄 요약 (진짜 핵심)

1. Web는 Vercel, API/Worker/DB/Redis는 Render에 둔다.
2. 브라우저에서 보는 도메인(`app.yourdomain.com`)의 `/v1/*` 요청이 API로 가야 한다.
3. 환경변수는 서비스별로 분리해서 넣고, 아래 체크리스트 순서대로 검증하면 끝난다.

---

## 2) 현재 코드 기준 절대 규칙

### 2.1 API 경로 규칙

- API는 전역 prefix가 `v1`이다: `apps/api/src/main.ts`
- 즉, 공식 경로는 `/v1/...` 이다.

주의:

- 일부 오래된 문서에는 `/api/v1/...`가 남아있지만, 현재 코드 기준은 `/v1/...`다.

### 2.2 `/v1` 라우팅이 반드시 살아야 하는 이유

- 프론트 OAuth 시작 URL이 `/v1/shopify/auth/start`를 사용한다: `apps/web/src/components/embedded-shell.tsx`
- 세션 확인도 `/v1/auth/me`를 호출한다: `apps/web/src/components/embedded-shell.tsx`

따라서 운영 환경에서:

- `https://app.yourdomain.com/v1/*` -> API로 정상 전달

이게 안 되면 거의 모든 기능이 깨진다.

---

## 3) 최종 아키텍처 (권장)

- Vercel
  - `apps/web`
  - 사용자 접속 도메인: `https://app.yourdomain.com`
- Render
  - Web Service: `apps/api`
  - Background Worker: `apps/worker`
  - Postgres
  - Key Value(Valkey/Redis 호환)
- Cloudflare R2
  - 문서/증빙 파일 저장
- Mailgun
  - 메일 발송 + 이벤트/인바운드 웹훅

도메인 예시:

- 앱: `app.yourdomain.com` (Vercel)
- API: `api.yourdomain.com` (Render)

---

## 4) 사전 준비물 체크리스트

아래가 준비되지 않으면 중간에 반드시 멈춘다.

- [ ] GitHub 저장소 접근 권한
- [ ] Vercel 계정/팀
- [ ] Render 계정/워크스페이스
- [ ] Cloudflare(R2) 계정
- [ ] Mailgun 계정
- [ ] Shopify Partner 계정 + 앱
- [ ] 앱 도메인 DNS 수정 권한

---

## 5) 먼저 채워두는 값 시트 (복붙용)

이 값은 문서 아래 단계에서 반복해서 쓴다.

```text
# Domain
APP_DOMAIN=app.yourdomain.com
API_DOMAIN=api.yourdomain.com
APP_ORIGIN=https://app.yourdomain.com
API_ORIGIN=https://api.yourdomain.com

# Shopify
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_SCOPES=read_products

# Render Postgres/Key Value
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# R2
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=leakwatch-prod
R2_REGION=auto

# Security
LW_ENCRYPTION_KEY_32B=...

# Mailgun
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_WEBHOOK_SIGNING_KEY=...

# OpenAI (worker)
OPENAI_API_KEY=...
OPENAI_MODEL_NORMALIZE=gpt-4o-mini
OPENAI_MODEL_VISION=gpt-4o-mini
OPENAI_MAX_RETRIES=3
```

`LW_ENCRYPTION_KEY_32B` 생성:

```bash
openssl rand -base64 32
```

---

## 6) 환경변수 배치표 (서비스별로 어디에 넣는지)

아래 표만 정확히 따르면 된다.

### 6.1 Vercel(Web) 프로젝트에 넣는 값

| 키                            | 필수   | 권장 값                                 | 메모                       |
| ----------------------------- | ------ | --------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | 예     | `SHOPIFY_API_KEY`와 동일 값             | 프론트 App Bridge에서 사용 |
| `NEXT_PUBLIC_API_URL`         | 아니오 | 비워두거나 `https://app.yourdomain.com` | 비우면 현재 origin 사용    |

중요:

- `NEXT_PUBLIC_*`는 브라우저에 노출된다. 절대 secret 넣지 말 것.

### 6.2 Render API 서비스에 넣는 값

| 키                            | 필수           | 예시                                            |
| ----------------------------- | -------------- | ----------------------------------------------- |
| `NODE_ENV`                    | 예             | `production`                                    |
| `PORT`                        | 아니오         | `10000` (Render 기본값 사용 가능)               |
| `DATABASE_URL`                | 예             | Postgres Internal URL                           |
| `SHOPIFY_API_KEY`             | 예             | Shopify 앱 키                                   |
| `SHOPIFY_API_SECRET`          | 예             | Shopify 앱 시크릿                               |
| `SHOPIFY_SCOPES`              | 아니오         | `read_products`                                 |
| `SHOPIFY_APP_URL`             | 예             | `https://app.yourdomain.com`                    |
| `API_BASE_URL`                | 예             | `https://app.yourdomain.com`                    |
| `REDIS_URL`                   | 예             | Key Value Internal URL                          |
| `R2_ENDPOINT`                 | 예             | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID`            | 예             | R2 Access Key                                   |
| `R2_SECRET_ACCESS_KEY`        | 예             | R2 Secret                                       |
| `R2_BUCKET`                   | 예             | `leakwatch-prod`                                |
| `R2_REGION`                   | 아니오         | `auto`                                          |
| `LW_ENCRYPTION_KEY_32B`       | 예             | 32바이트 base64 키                              |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | 예(웹훅 쓸 때) | Mailgun Signing Key                             |
| `LOG_LEVEL`                   | 아니오         | `info`                                          |

### 6.3 Render Worker 서비스에 넣는 값

| 키                         | 필수            | 예시                         |
| -------------------------- | --------------- | ---------------------------- |
| `NODE_ENV`                 | 예              | `production`                 |
| `DATABASE_URL`             | 예              | API와 동일                   |
| `REDIS_URL`                | 예              | API와 동일                   |
| `R2_ENDPOINT`              | 예              | API와 동일                   |
| `R2_ACCESS_KEY_ID`         | 예              | API와 동일                   |
| `R2_SECRET_ACCESS_KEY`     | 예              | API와 동일                   |
| `R2_BUCKET`                | 예              | API와 동일                   |
| `R2_REGION`                | 아니오          | `auto`                       |
| `SHOPIFY_APP_URL`          | 예(권장 강제)   | `https://app.yourdomain.com` |
| `OPENAI_API_KEY`           | 예(정규화 쓰면) | OpenAI key                   |
| `OPENAI_MODEL_NORMALIZE`   | 아니오          | `gpt-4o-mini`                |
| `OPENAI_MODEL_VISION`      | 아니오          | `gpt-4o-mini`                |
| `OPENAI_MODEL_EMAIL_DRAFT` | 아니오          | `gpt-4o-mini`                |
| `OPENAI_MAX_RETRIES`       | 아니오          | `3`                          |
| `MAILGUN_API_KEY`          | 예(발송 쓰면)   | Mailgun API key              |
| `MAILGUN_DOMAIN`           | 예(발송 쓰면)   | `mg.yourdomain.com`          |
| `LOG_LEVEL`                | 아니오          | `info`                       |

Render 주의(중요):

- Render에 직접 입력한 환경변수는 build 단계에도 적용된다.
- `NODE_ENV=production` 상태에서 `pnpm install` 기본값을 쓰면 devDependencies가 생략되어 `husky: not found`, `tsc: not found`, `tsx: not found`가 날 수 있다.
- 이 문서의 Step 7 Build Command(`pnpm install --frozen-lockfile --prod=false`)를 그대로 사용해야 한다.

### 6.4 꼭 맞춰야 하는 "동일값" 규칙

다르면 바로 장애나는 조합:

- `SHOPIFY_API_KEY`(API) == `NEXT_PUBLIC_SHOPIFY_API_KEY`(Web)
- `DATABASE_URL`(API) == `DATABASE_URL`(Worker)
- `REDIS_URL`(API) == `REDIS_URL`(Worker)
- `R2_ENDPOINT/KEY/SECRET/BUCKET`(API) == Worker 동일 값
- `SHOPIFY_APP_URL`(API/Worker) == 실제 앱 도메인

---

## 7) Render 설정 (클릭 경로까지)

## Step 7-1. Render Postgres 생성

1. Render Dashboard -> `New` -> `Postgres`
2. Name: `leakwatch-prod-db` (원하는 이름)
3. Region: API/Worker와 같은 리전 선택
4. Plan 선택(초기 최소 스펙)
5. 생성 완료 후 Internal connection string 복사
6. 이 값을 `DATABASE_URL`로 사용

팁:

- staging/prod DB는 반드시 분리

## Step 7-2. Render Key Value 생성

1. Render Dashboard -> `New` -> `Key Value`
2. Name: `leakwatch-prod-kv`
3. Region: API/Worker와 동일
4. `Maxmemory policy`: **`noeviction`** 권장(큐 유실 방지)
5. 생성 후 Internal URL 복사
6. 이 값을 `REDIS_URL`로 사용

## Step 7-3. Render API 서비스 생성

1. Render Dashboard -> `New` -> `Web Service`
2. Git repo 연결
3. 설정:
   - Runtime: Node
   - Branch: `main`
   - Root Directory: `.` (권장)
   - Build Command:

```bash
corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @leakwatch/api build
```

- 중요: `--prod=false`를 빼면 `NODE_ENV=production` 환경에서 빌드 중 devDependencies가 빠져 실패할 수 있다.

- Start Command:

```bash
pnpm --filter @leakwatch/api start
```

- Health Check Path: `/v1/health`

4. Environment 페이지에서 6.2 표 값 입력
5. Save + Deploy

왜 Root Directory를 `.` 권장하냐:

- 이 저장소는 workspace 의존(`@leakwatch/shared`)이 있어서 루트 기준 빌드가 안전하다.

## Step 7-4. Render Worker 서비스 생성

1. Render Dashboard -> `New` -> `Background Worker`
2. 같은 Git repo 연결
3. 설정:
   - Runtime: Node
   - Branch: `main`
   - Root Directory: `.`
   - Build Command:

```bash
corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @leakwatch/worker build
```

- 중요: Worker도 동일하게 `--prod=false`를 유지해야 루트 workspace 빌드 의존(devDependencies) 누락을 막을 수 있다.

- Start Command:

```bash
pnpm --filter @leakwatch/worker start
```

4. Environment 페이지에서 6.3 표 값 입력
5. Save + Deploy

주의:

- Worker는 HTTP 헬스체크 대상이 아니다.

---

## 8) Vercel 설정 (클릭 경로까지)

## Step 8-1. 프로젝트 생성

1. Vercel Dashboard -> `Add New` -> `Project`
2. 저장소 Import
3. Build 설정:
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
4. Deploy

## Step 8-2. 환경변수 입력

Vercel Project -> Settings -> Environment Variables

- `NEXT_PUBLIC_SHOPIFY_API_KEY`
- `NEXT_PUBLIC_API_URL` (비우거나 `https://app.yourdomain.com`)

환경 선택:

- Production, Preview 모두 넣기 권장

## Step 8-3. 도메인 연결

Vercel Project -> Settings -> Domains

1. `app.yourdomain.com` 추가
2. 안내되는 DNS 레코드 적용
3. TLS Ready 상태 확인

---

## 9) `/v1` 프록시 설정 (필수)

이 단계 누락하면 앱이 거의 무조건 깨진다.

현재 코드에는 로컬용 rewrite(`http://localhost:4000`)가 있으므로, 운영에서는 `/v1`이 실제 API로 가도록 정리해야 한다.

### 권장 방식: `apps/web/vercel.json` 추가

`apps/web/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/v1/:path*",
      "destination": "https://api.yourdomain.com/v1/:path*"
    }
  ]
}
```

그리고 Vercel 재배포.

운영 체크:

- `https://app.yourdomain.com/v1/health`가 200 + `{ "ok": true }` 응답해야 함

---

## 10) Shopify 설정 (dev -> staging/prod)

## Step 10-1. Partner Dashboard 값 입력

최소 값:

- App URL: `https://app.yourdomain.com`
- Redirect URL:
  - `https://app.yourdomain.com/v1/shopify/auth/callback`
- Webhooks:
  - `https://app.yourdomain.com/v1/shopify/webhooks/app-uninstalled`
  - `https://app.yourdomain.com/v1/shopify/webhooks/shop-update`

## Step 10-2. `shopify.app.toml` 운영 분리

권장:

- dev용 TOML과 prod용 TOML 분리
- 운영 반영은 `shopify app deploy`로 적용

중요:

- TOML만 바꾸고 deploy 안 하면 운영 스토어에는 반영되지 않는다.

## Step 10-3. 출시 질문에 대한 답

"dev에서 prod 갈 때 프로그램을 새로 만들어야 하나?"

- 아니오. **같은 코드베이스**를 써도 된다.
- 단, 앱 키/시크릿/도메인/DB는 환경별로 분리해서 운영해야 안전하다.

---

## 11) Mailgun 초상세 설정

## Step 11-1. 테스트 시작

1. Mailgun 가입
2. Sandbox domain 확인
3. Authorized recipients 등록

주의:

- Sandbox는 운영 발송용 아님

## Step 11-2. 운영 도메인 전환

1. Sending domain 생성(`mg.yourdomain.com` 등)
2. DNS 등록:
   - SPF TXT
   - DKIM TXT
   - Tracking CNAME
   - (수신 시) MX
3. Verify 완료
4. API key 발급

## Step 11-3. LeakWatch 연결

- Worker env:
  - `MAILGUN_API_KEY`
  - `MAILGUN_DOMAIN`
- API env:
  - `MAILGUN_WEBHOOK_SIGNING_KEY`

웹훅 엔드포인트:

- `POST /v1/mailgun/webhooks/events`
- `POST /v1/mailgun/webhooks/inbound`

## Step 11-4. 꼭 확인할 장애 포인트

- `MAILGUN_NOT_CONFIGURED` -> Worker에 키/도메인 누락
- 이벤트 웹훅 401 -> signing key 불일치

---

## 12) Cloudflare R2 초상세 설정

## Step 12-1. API 토큰/버킷

1. R2 bucket 생성 (private 권장)
2. API token 생성
3. Access key/secret 저장(Secret 재조회 불가)

## Step 12-2. LeakWatch env

- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_REGION=auto`

API와 Worker 모두 동일 값 사용.

## Step 12-3. CORS

브라우저 업로드(presigned PUT) 쓰려면 CORS 필요:

```json
[
  {
    "AllowedOrigins": ["https://app-staging.yourdomain.com", "https://app.yourdomain.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 13) 배포 후 검증 (복붙 커맨드)

아래 8개는 순서대로 실행.

```bash
APP="https://app.yourdomain.com"
API="https://api.yourdomain.com"
SHOP="your-store.myshopify.com"
```

### 13-1. API 직접 헬스

```bash
curl -si "$API/v1/health"
```

기대값:

- HTTP 200
- body에 `{"ok":true}` 포함

### 13-2. 앱 도메인 프록시 헬스

```bash
curl -si "$APP/v1/health"
```

기대값:

- HTTP 200 + 동일 body

실패하면:

- `/v1` 프록시 설정 오류

### 13-3. OAuth 시작 리다이렉트 검사

```bash
curl -si "$APP/v1/shopify/auth/start?shop=$SHOP"
```

기대값:

- 302
- Location에 Shopify authorize URL

### 13-4. 인증 없는 `/auth/me` 가드 확인

```bash
curl -si "$APP/v1/auth/me"
```

기대값:

- 401

### 13-5. Shopify webhook 서명 가드 확인

```bash
curl -si -X POST "$APP/v1/shopify/webhooks/shop-update" \
  -H "content-type: application/json" \
  -d '{}'
```

기대값:

- 401 (signature/header missing)

### 13-6. 실제 설치 URL 호출

브라우저에서:

```text
https://app.yourdomain.com/v1/shopify/auth/start?shop=your-store.myshopify.com
```

기대값:

- Shopify 승인 -> `/app?shop=...&host=...`로 복귀

### 13-7. 업로드 스모크

1. `/app/uploads` 진입
2. 작은 PDF/PNG 업로드
3. create -> PUT -> complete 흐름 확인

### 13-8. 메일 스모크

1. 액션 전송
2. Worker 로그에서 Mailgun 성공 확인
3. API에서 mailgun webhook 수신 확인

---

## 14) 실패 증상별 즉시 대응

### 증상 A: OAuth redirect mismatch

원인:

- Dashboard의 Redirect URL과 실제 URL이 다름

대응:

- `https://app.yourdomain.com/v1/shopify/auth/callback` 정확 일치

### 증상 B: `/v1/auth/me` 404/502

원인:

- Vercel `/v1` 프록시 누락 또는 오타

대응:

- `apps/web/vercel.json` rewrite 재확인 후 재배포

### 증상 C: CORS 에러(업로드)

원인:

- R2 CORS Origin 누락

대응:

- 현재 앱 도메인(staging/prod) 모두 등록

### 증상 D: `MAILGUN_NOT_CONFIGURED`

원인:

- Worker env에 `MAILGUN_API_KEY`/`MAILGUN_DOMAIN` 없음

대응:

- Worker 환경변수 입력 후 재배포

### 증상 E: `LW_ENCRYPTION_KEY_32B must decode to 32 bytes`

원인:

- 키 포맷 불량

대응:

- `openssl rand -base64 32`로 재생성

### 증상 F: 이메일 링크가 localhost

원인:

- Worker에 `SHOPIFY_APP_URL` 누락

대응:

- Worker env에 `SHOPIFY_APP_URL=https://app.yourdomain.com` 추가

### 증상 G: Render 빌드에서 `husky: not found` / `tsc: not found` / `tsx: not found`

원인:

- Render env에 `NODE_ENV=production`이 들어간 상태에서 `pnpm install`을 기본값으로 실행해 devDependencies가 생략됨

대응:

- Build Command를 `pnpm install --frozen-lockfile --prod=false` 형태로 수정 후 재배포
- 이 문서 Step 7-3/7-4 커맨드를 그대로 복사해 사용

---

## 15) 비용 폭주 방지 (초기 운영값)

- staging는 최소 인스턴스
- prod도 초기는 최소로 시작
- Worker concurrency 과도하게 올리지 않기
- R2 버킷 lifecycle/보관 정책 설정
- Preview 배포 남발 금지(배포 수/빌드 시간 관리)

Render 무료 플랜 주의:

- Free Web: 유휴 시 스핀다운
- Free Postgres: 만료 제한
- Free Key Value: 영속성 제약

운영 서비스는 무료 의존을 피하는 게 안전하다.

---

## 16) staging -> prod 승격 절차

1. staging에서 13장 검증 8개 전부 통과
2. prod 리소스 별도 생성(DB/Redis 분리)
3. prod env 값 입력
4. Shopify prod 설정(App URL/Redirect/Webhook) 반영
5. `shopify app deploy`로 config 반영
6. prod에서 13장 검증 재실행
7. 통과 후 실제 스토어 범위 확장

---

## 17) "진짜로 프로그램을 새로 만들어야 하나?" 최종 답변

아니오.

- 같은 코드베이스로 dev/staging/prod 모두 운영 가능
- 바뀌는 것은 연결값(키/URL/DB/도메인)과 운영 환경

다만 안정성 때문에 아래는 반드시 분리:

- DB (staging/prod)
- Redis (staging/prod)
- Shopify 앱 설정(dev용/prod용)
- 도메인(staging/prod)

---

## 18) 운영 전에 꼭 읽을 "보완 필요" 항목

현재 코드 기준으로 런칭 전 점검 권장:

- OAuth state 저장소가 in-memory 기반이라 다중 인스턴스 환경에서 콜백 실패 가능
- Billing webhook 보안 정책(서명/인증) 명시 강화 필요
- Billing 권한을 서버에서 더 강하게 검증할 필요
- Shopify mandatory compliance webhook(`customers/data_request`, `customers/redact`, `shop/redact`) 구현/운영 확인 필요

---

## 19) 운영자가 빠르게 찾을 파일 경로

- API env 스키마: `apps/api/src/config/env.ts`
- Worker env 스키마: `apps/worker/src/env.ts`
- API prefix: `apps/api/src/main.ts`
- Shopify 라우트: `apps/api/src/modules/shopify/shopify.controller.ts`
- OAuth callback 생성: `apps/api/src/modules/shopify/shopify-auth.service.ts`
- Mailgun 웹훅 검증: `apps/api/src/modules/mailgun/mailgun.service.ts`
- Web API base 로직: `apps/web/src/lib/api/fetcher.ts`
- Session token: `apps/web/src/lib/shopify/session-token.ts`
- Web rewrite(로컬 기준): `apps/web/next.config.mjs`
- 환경변수 예시: `.env.example`

---

## 20) 공식 문서 링크

- Vercel monorepo: `https://vercel.com/docs/monorepos`
- Vercel env: `https://vercel.com/docs/environment-variables`
- Vercel rewrites: `https://vercel.com/docs/rewrites`
- Vercel domain: `https://vercel.com/docs/domains/working-with-domains/add-a-domain`
- Render monorepo: `https://render.com/docs/monorepo-support`
- Render env: `https://render.com/docs/configure-environment-variables`
- Render web services: `https://render.com/docs/web-services`
- Render background workers: `https://render.com/docs/background-workers`
- Render health checks: `https://render.com/docs/health-checks`
- Render key value: `https://render.com/docs/key-value`
- Shopify app config: `https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration`
- Shopify deploy hosting: `https://shopify.dev/docs/apps/launch/deployment/deploy-to-hosting-service`
- Shopify distribution: `https://shopify.dev/docs/apps/launch/distribution`
- Mailgun webhooks: `https://documentation.mailgun.com/docs/mailgun/user-manual/events/webhooks`
- Mailgun domain verify: `https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-verify`
- Cloudflare R2 tokens: `https://developers.cloudflare.com/r2/api/tokens/`
- Cloudflare R2 presigned URLs: `https://developers.cloudflare.com/r2/api/s3/presigned-urls/`
- Cloudflare R2 CORS: `https://developers.cloudflare.com/r2/buckets/cors/`

---

## 21) 마지막 한 줄

이 문서대로 순서만 지키면, 로컬 터널/수동 export 반복 없이도 **서버에서 안정적으로 테스트 -> 운영 -> 출시**까지 갈 수 있다.
