# 로컬 탈출 가이드: LeakWatch 서버 배포/테스트/출시 실전 문서

이 문서는 "이제 로컬에서 `pnpm dev`, `ngrok`, `export` 반복하지 않고" LeakWatch를 **항상 켜져 있는 서버 환경**에서 편하게 테스트하고, 나중에 Shopify 앱을 실제 출시까지 이어가는 실전 가이드다.

대상:

- 기술 용어가 너무 많은 문서는 힘든 사람
- 하지만 개발자 관점의 정확한 설정도 필요한 사람
- 비용이 과하게 나가는 구조는 피하고 싶은 사람

---

## 0) 먼저 결론 (짧게)

### 0.1 Render vs Vercel, 뭐가 더 낫나?

이 저장소 기준으로는 **"둘 중 하나만" 고르기보다 역할 분담**이 가장 현실적이다.

- Web(Next.js): Vercel이 배포/미리보기/관리 편의가 좋다.
- API + Worker(백그라운드 잡): Render가 맞다. (항상 켜진 worker 운영에 유리)

즉, 권장 1순위:

- **Vercel(Web) + Render(API/Worker/DB/Redis) + R2 + Mailgun**

"나는 플랫폼 하나만 쓰고 싶다"면:

- **Render 단일 플랫폼**으로도 가능하지만, 라우팅(`/v1`) 구성은 한 번 더 신경 써야 한다.

### 0.2 지금 코드베이스 특성에서 핵심 포인트

- API는 전역 prefix가 `/v1`이다 (`apps/api/src/main.ts`).
- 프론트에서 Shopify 설치 시작 URL도 `/v1/shopify/auth/start`를 사용한다 (`apps/web/src/components/embedded-shell.tsx`).
- 즉, 운영에서도 최종 사용자 도메인에서 **`/v1/*`가 API로 정확히 전달**되어야 한다.
- 일부 기존 문서에 `/api/v1` 예시가 남아있지만, 현재 코드 기준 canonical 경로는 `/v1`이다.

이 문서는 이 제약을 기준으로 "안 깨지게" 구성한다.

---

## 1) 이 문서에서 다루는 범위

다룸:

- staging/prod 환경 설계
- Render vs Vercel 선택 기준
- Mailgun API 키/도메인/웹훅 설정
- Cloudflare R2 운영 세팅(이미 했어도 재검증 가능)
- Shopify dev -> 실제 출시 시 무엇을 분리해야 하는지
- 비용 최소화 기준

안 다룸:

- 코드 리팩터링 자체
- 앱 스토어 마케팅 문구 작성

---

## 2) 아키텍처 선택지 (이 저장소 기준)

## 옵션 A (권장): Vercel + Render 하이브리드

- Vercel: `apps/web`
- Render Web Service: `apps/api`
- Render Background Worker: `apps/worker`
- Render Postgres / Render Key Value(또는 외부 DB/Redis)
- Cloudflare R2: 파일 저장
- Mailgun: 메일 발송/이벤트 웹훅

장점:

- web 배포 UX가 편함
- worker 상시 실행 구조가 명확함
- 운영 시 역할 분리가 깔끔함

주의:

- 사용자 도메인에서 `/v1/*`를 API로 프록시해야 함

## 옵션 B: Render 단일 플랫폼

- web/api/worker를 모두 Render에서 운영

장점:

- 플랫폼 하나라서 계정/권한/청구가 단순

주의:

- 프론트와 API 라우팅 구조(`/v1`)를 도메인 레벨에서 정리해야 함

## 옵션 C: Vercel 단독

현재 구조에서는 비권장.

이유:

- 이 프로젝트는 BullMQ worker 상시 실행이 핵심이다.
- Vercel Function은 요청 기반 실행/제한 시간이 있어 장기 큐 처리 운영 모델과 맞지 않는다.

### 2.1 Render vs Vercel 현실 비교표 (2026-02 기준)

| 항목                  | Render                          | Vercel                                      | LeakWatch 관점                             |
| --------------------- | ------------------------------- | ------------------------------------------- | ------------------------------------------ |
| Next.js 프론트 DX     | 좋음                            | 매우 강함                                   | 프론트만 보면 Vercel 우세                  |
| 상시 Worker 운영      | 1급 기능(Background Worker)     | 함수/워크플로우 중심                        | Worker 파이프라인은 Render 우세            |
| DB/Redis 결합         | 플랫폼 내 결합 쉬움             | 외부/Marketplace 결합 중심                  | 백엔드 운영 단순성은 Render 우세           |
| 무료 티어 운영성      | 무료 웹은 15분 유휴 시 스핀다운 | Hobby로 시작 쉬우나 함수/스토리지 한도 주의 | 둘 다 "운영 서비스"로는 무료 의존 비권장   |
| 전체 스택 단일 플랫폼 | 가능                            | 가능하지만 구조 조정 필요                   | 현재 구조는 Render 단일 또는 혼합이 현실적 |

### 2.2 비용 관점 최소 시작선 (예시)

아래는 "실제 과금 전 감 잡기"용 예시다. 최종 결제 전에는 공식 가격 페이지를 꼭 재확인해야 한다.

- Render 올인원 최소 유료 시작선(예시):
  - API Starter 약 `$7`
  - Worker Starter 약 `$7`
  - Postgres Basic-256MB 약 `$6`
  - Key Value Starter 약 `$10`
  - 대략 `$30` 내외 + 스토리지/트래픽
- 혼합(Vercel Web + Render Backend) 시작선(예시):
  - 위 Render 비용 + Vercel Pro(팀/상업 운영 시) 비용
  - 대략 `$50+`부터 시작하는 경우가 많음

운영에서 자주 놓치는 포인트:

- Render Free Web은 15분 유휴 시 스핀다운이 발생
- Render Free Postgres는 30일 만료 제약이 있음
- Vercel은 함수/스토리지 사용량이 늘면 예측이 어려워질 수 있음

---

## 3) dev/staging/prod를 어떻게 나누는가

핵심 원칙 한 줄:

- **코드는 하나**, **환경은 최소 2개(staging/prod)**, **비밀키/DB/도메인은 분리**

권장 분리표:

- dev: 로컬 + 테스트용 키
- staging: 실제 서버, dev store 대상, 출시 전 최종 검증
- prod: 실제 고객 대상

"출시하면 완전히 다른 프로그램 새로 짜야 하나?"에 대한 답:

- 아니오. 보통은 **같은 코드**를 쓰고 연결값(키/URL/DB)만 바꾼다.
- 다만 운영 안정성을 위해 staging/prod는 **서버 인스턴스와 데이터 저장소를 분리**하는 것이 정석이다.

---

## 4) 단계별 실행 (처음부터 끝까지)

## Step 1. 도메인 전략 먼저 확정

예시:

- 앱 사용자 진입: `https://app.yourdomain.com`
- API: `https://api.yourdomain.com`

중요:

- 최종적으로 `app.yourdomain.com/v1/*` 요청이 API로 전달되어야 함
- 그래야 Shopify 설치/콜백/웹훅 흐름이 현재 코드와 맞게 동작함

## Step 2. Render에 API/Worker/DB/Redis 준비

### 2.1 API 서비스 (`apps/api`)

- Service Type: Web Service
- Root Directory: `apps/api`
- Build Command 예시:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @leakwatch/api build
```

- Start Command:

```bash
pnpm --filter @leakwatch/api start
```

- Health Check Path: `/v1/health`

### 2.2 Worker 서비스 (`apps/worker`)

- Service Type: Background Worker
- Root Directory: `apps/worker`
- Build Command 예시:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @leakwatch/worker build
```

- Start Command:

```bash
pnpm --filter @leakwatch/worker start
```

### 2.3 DB/Redis

- Postgres와 Redis는 staging/prod 분리 권장
- API/Worker가 같은 DB/Redis를 참조해야 큐와 상태가 맞음

## Step 3. Vercel에 Web 준비 (`apps/web`)

- Project Root: `apps/web`
- Framework: Next.js
- Build/Start는 기본값 사용 가능

중요:

- 사용자 도메인에서 `/v1/*`를 API로 프록시하도록 설정
- 방법은 다음 중 하나:
  - Vercel Project Rewrites
  - `vercel.json` rewrite

예시 개념:

```json
{
  "rewrites": [{ "source": "/v1/:path*", "destination": "https://api.yourdomain.com/v1/:path*" }]
}
```

## Step 4. 환경변수 주입 (이 단계가 핵심)

로컬 `export` 반복 대신:

- Render/Vercel 환경변수 UI에 고정 저장
- 배포 시 자동 주입

필수 키(요약):

- API
  - `DATABASE_URL`
  - `SHOPIFY_API_KEY`
  - `SHOPIFY_API_SECRET`
  - `SHOPIFY_APP_URL`
  - `API_BASE_URL`
  - `REDIS_URL`
  - `R2_ENDPOINT`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET`
  - `LW_ENCRYPTION_KEY_32B`
  - `MAILGUN_API_KEY` (운영 메일 사용 시)
  - `MAILGUN_DOMAIN` (운영 메일 사용 시)
  - `MAILGUN_WEBHOOK_SIGNING_KEY` (웹훅 검증)

- Worker
  - `DATABASE_URL`
  - `REDIS_URL`
  - `R2_*`
  - `OPENAI_*`
  - `MAILGUN_API_KEY`
  - `MAILGUN_DOMAIN`

- Web
  - `NEXT_PUBLIC_SHOPIFY_API_KEY`
  - `NEXT_PUBLIC_API_URL` (필요 시)

참조:

- API env schema: `apps/api/src/config/env.ts`
- Worker env schema: `apps/worker/src/env.ts`
- 기본 예시: `.env.example`

## Step 5. DB 마이그레이션

배포 직후 1회 실행:

```bash
pnpm db:deploy
```

이 프로젝트는 root 스크립트가 `.env`를 자동 로드하도록 되어 있어 로컬에서도 export 반복이 줄어든다 (`scripts/with-root-env.mjs`).

## Step 6. 도메인/DNS 연결

- `app.yourdomain.com` -> Vercel
- `api.yourdomain.com` -> Render API
- TLS 인증서 상태 확인(둘 다 HTTPS 정상)

## Step 7. Shopify 앱 URL/Redirect/Webhook 연결

Partner Dashboard(또는 Dev Dashboard)에서 다음 값 일치:

- App URL: `https://app.yourdomain.com`
- Redirect URL: `https://app.yourdomain.com/v1/shopify/auth/callback` (프록시 경유)
- Webhook URL:
  - `https://app.yourdomain.com/v1/shopify/webhooks/app-uninstalled`
  - `https://app.yourdomain.com/v1/shopify/webhooks/shop-update`

코드 기준 canonical 경로는 `/v1/*`다.

---

## 5) Mailgun: 정말 실무형으로 설정하기

## 5.1 최소 동작 (테스트 시작)

1. Mailgun 계정 생성
2. Sandbox domain으로 1차 테스트
3. Authorized Recipients 등록 (sandbox 제약)

주의:

- sandbox는 운영용이 아니다.
- 실제 발송은 custom domain 검증 후 진행.

## 5.2 운영 세팅 (반드시)

1. Sending domain 추가 (예: `mg.yourdomain.com`)
2. DNS 레코드 등록
   - SPF TXT
   - DKIM TXT
   - Tracking CNAME
   - (수신 필요 시) MX
3. Mailgun에서 Verify
4. API key 발급 후 보관

## 5.3 LeakWatch에 연결

- Worker 발송 로직: `apps/worker/src/jobs/send-email.ts`
- 환경변수:
  - `MAILGUN_API_KEY`
  - `MAILGUN_DOMAIN`
- API 웹훅 엔드포인트:
  - `POST /v1/mailgun/webhooks/events`
  - `POST /v1/mailgun/webhooks/inbound`
  - 코드: `apps/api/src/modules/mailgun/mailgun.controller.ts`

## 5.4 보안 체크 (중요)

- `MAILGUN_WEBHOOK_SIGNING_KEY`로 HMAC 검증 필수
- 현재 코드에서 검증 수행: `apps/api/src/modules/mailgun/mailgun.service.ts`
- 웹훅은 재시도될 수 있으므로 idempotent 처리 권장

## 5.5 자주 막히는 포인트

- DNS 전파 전 검증 시도 -> 실패
- sandbox로 운영 발송 시도 -> 제한
- 웹훅 URL은 등록했지만 서명 검증 미구현 -> 운영 리스크

---

## 6) Cloudflare R2: 이미 해뒀어도 운영 기준 재확인

## 6.1 최소 동작

1. 버킷 생성(기본 private 권장)
2. R2 API token 생성
3. Access Key/Secret 저장(Secret은 재조회 불가)
4. S3 endpoint 확인: `https://<account_id>.r2.cloudflarestorage.com`

## 6.2 LeakWatch 연결

- API/Worker 모두 R2 사용
- 필수 env:
  - `R2_ENDPOINT`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET`
  - `R2_REGION=auto`

코드:

- API storage client: `apps/api/src/modules/documents/storage/storage.client.ts`
- Worker storage client: `apps/worker/src/storage/r2.client.ts`

## 6.3 CORS (브라우저 업로드에 필수)

Presigned PUT을 브라우저에서 쓰려면 버킷 CORS가 필요하다.

예시:

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

## 6.4 보안/비용 포인트

- presigned URL은 bearer token처럼 취급 (짧은 만료시간)
- bucket 공개는 꼭 필요한 경우만
- 비용은 저장량 + Class A/B 요청수 기준
- egress가 무료인 구조라 다운로드 트래픽이 큰 경우 유리

---

## 7) Shopify: dev에서 실제 출시로 갈 때 무엇이 달라지나

## 7.1 같은 코드 vs 다른 서버

정리:

- 코드(프로그램)는 같은 코드베이스 사용 가능
- 서버 환경은 staging/prod 분리 권장
- Shopify 앱 설정(키/URL/웹훅)도 환경별로 분리해야 안전

## 7.2 추천 운영 방식

- dev 앱: 개발 스토어 전용
- prod 앱: 실제 출시용

이유:

- 배포/실험 중에 실제 상점에 영향 주는 사고를 방지

## 7.3 App Store 제출 전 필수 체크

- TLS/HTTPS 완전 정상
- OAuth 즉시 동작
- uninstall webhook 동작
- session token 인증 흐름 정상
- billing/plan 제한 정책 검증
- 개인정보/삭제 처리 대응

특히 공식 요구사항 기준으로 mandatory compliance webhooks(`customers/data_request`, `customers/redact`, `shop/redact`) 대응 여부는 제출 전에 반드시 확인해야 한다.

---

## 8) 비용 가이드 (과금 폭주 방지)

## 8.1 월 고정비를 낮추는 기본 원칙

- staging는 최소 스펙
- prod도 초기에는 최소 인스턴스
- worker concurrency 과도 설정 금지
- R2 lifecycle/보관 정책 적용
- OpenAI 호출 캐시/재시도 제한 유지

프로젝트 내 비용 가드레일 참고:

- `docs/operations/runbooks/cost-guardrails.md`

## 8.2 현실적인 시작 추정 (예시)

실제 요금은 시점/플랜/지역에 따라 바뀌니 반드시 공식 가격 페이지로 확인해야 한다.

대략적 감:

- Render: API + Worker + DB + Redis 구성 시 월 수십 달러대부터 시작 가능
- Vercel: Hobby로 시작 후 트래픽/팀 증가 시 Pro 전환
- R2: 저장량과 요청 수 중심 과금
- Mailgun: sandbox -> verified domain 전환 후 발송량 기반 과금

---

## 9) 지금 바로 실행할 수 있는 "실전 순서" (권장)

1. staging 도메인/서비스 먼저 구성 (prod 먼저 하지 말기)
2. API/Worker를 Render에 올리고 `/v1/health` 확인
3. Web를 Vercel에 올리고 `/v1/*` 프록시 설정
4. R2 연결 -> 업로드(create -> PUT -> complete) 검증
5. Mailgun 연결 -> 테스트 발송 + webhook 이벤트 수신 검증
6. Shopify dev store 설치/OAuth/embedded 전 흐름 검증
7. staging에서 E2E 스모크 통과 후 prod 복제
8. Shopify production 설정 및 출시 체크리스트 수행

---

## 10) 트러블슈팅 빠른 표

- OAuth redirect mismatch
  - 원인: Dashboard URL과 실제 URL 불일치
  - 조치: `/v1/shopify/auth/callback` 경로 정확히 맞춤

- Embedded에서 인증 루프
  - 원인: `NEXT_PUBLIC_SHOPIFY_API_KEY` 불일치 또는 host/session 문제
  - 조치: Web/API 키 페어 재검증

- 업로드 CORS 실패
  - 원인: R2 CORS Origin 누락
  - 조치: staging/prod origin 모두 등록

- MAILGUN_NOT_CONFIGURED
  - 원인: `MAILGUN_API_KEY`/`MAILGUN_DOMAIN` 미설정
  - 조치: worker env 확인 후 재배포

- worker가 안 도는 것처럼 보임
  - 원인: worker 서비스 미배포 또는 Redis 연결 문제
  - 조치: worker 로그 + Redis URL 점검

---

## 11) 이 저장소에서 반드시 참고할 파일

- `apps/api/src/config/env.ts`
- `apps/worker/src/env.ts`
- `apps/api/src/main.ts`
- `apps/api/src/modules/shopify/shopify.controller.ts`
- `apps/api/src/modules/shopify/shopify-auth.service.ts`
- `apps/web/src/components/embedded-shell.tsx`
- `apps/web/src/lib/api/fetcher.ts`
- `.env.example`
- `docs/operations/DEPLOYMENT_OPS.md`
- `docs/operations/runbooks/shopify-production-launch-checklist.ko.md`

---

## 12) 마지막 정리 (중요한 한 문단)

당신이 원하는 상태는 "로컬 임시 테스트"가 아니라 "항상 살아있는 staging/prod"다.

이를 위해 필요한 것은 복잡한 새 프로그램이 아니라:

- 환경 분리(staging/prod)
- 올바른 라우팅(`/v1` 프록시)
- 비밀키/외부서비스(Mailgun/R2/Shopify) 고정 세팅

이 세 가지만 제대로 잡으면, 더 이상 매번 터미널에서 `export`와 `ngrok`를 반복하지 않아도 된다.

---

## 13) 출시 전 코드 레벨 보완 체크 (중요)

인프라 설정만으로 끝나지 않고, 현재 코드 기준으로 아래 항목은 출시 전에 점검/보완을 권장한다.

- OAuth state 저장소
  - 현재는 in-memory state store라 다중 인스턴스/재시작 환경에서 callback 실패 가능성이 있다.
- Billing webhook 보호
  - `/v1/billing/webhooks`는 공개 엔드포인트이므로 서명 검증/인증 정책을 명확히 두는 것을 권장한다.
- Billing 권한 서버 강제
  - UI 레벨 뿐 아니라 서버에서도 소유자 권한 검증이 확실히 들어가야 한다.
- Shopify mandatory compliance webhooks
  - `customers/data_request`, `customers/redact`, `shop/redact` 대응 라우트/처리 확인이 필요하다.

---

## 14) 공식 참고 링크

- Render Pricing: `https://render.com/pricing`
- Render Free 제한: `https://render.com/docs/free`
- Render Background Workers: `https://render.com/docs/background-workers`
- Vercel Pricing: `https://vercel.com/pricing`
- Vercel Functions Limits: `https://vercel.com/docs/functions/limitations`
- Mailgun Sandbox Domain: `https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-sandbox`
- Mailgun Domain Verification: `https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-verify`
- Mailgun Webhooks: `https://documentation.mailgun.com/docs/mailgun/user-manual/events/webhooks`
- Cloudflare R2 Pricing: `https://developers.cloudflare.com/r2/pricing/`
- Cloudflare R2 Tokens: `https://developers.cloudflare.com/r2/api/tokens/`
- Cloudflare R2 Presigned URLs: `https://developers.cloudflare.com/r2/api/s3/presigned-urls/`
- Cloudflare R2 CORS: `https://developers.cloudflare.com/r2/buckets/cors/`
- Shopify App Store Requirements: `https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements`
- Shopify Privacy Law Compliance Webhooks: `https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance`
