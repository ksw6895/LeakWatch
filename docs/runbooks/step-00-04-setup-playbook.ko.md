# Step 0-4 실전 셋업 플레이북 (로컬 개발 기준)

이 문서는 `step-00`부터 `step-04`까지를 실제로 실행하기 위한 운영 체크리스트다.
코드 구현 내용이 아니라, 계정/콘솔/환경변수/외부 리소스 설정과 검증 절차를 다룬다.

## 0. 이 문서의 목적

- 목적: 오늘 바로 `Shopify OAuth + Embedded App + R2 업로드`까지 동작시키기
- 범위: 계정 생성, 콘솔 설정, `.env` 작성, 로컬 실행, 설치/업로드 검증
- 비범위: step-05 이후(OpenAI 정규화, 메일 발송, Sentry 등)

## 1. 먼저 알아둘 핵심 사실

- Shopify 앱을 생성해도 즉시 App Store에 공개되지 않는다.
- 공개는 별도 `listing 작성 + review 제출 + 승인` 이후다.
- 단, `Distribution method` 선택은 신중히 해야 한다(변경 불가 정책이 있을 수 있음).
- step-04까지는 `dev store 설치`만 성공하면 충분하다.

## 2. 준비물 체크리스트

아래가 없으면 중간에 막힌다.

1. 필수 계정/리소스
- Shopify Partner 계정
- Shopify dev store 1개
- Cloudflare 계정(R2 사용)
- Postgres(로컬 docker 또는 Supabase/Neon)
- Redis(로컬 docker 또는 Upstash)

2. 로컬 도구
- Node.js 20.x
- pnpm 9.x
- Docker
- ngrok 또는 cloudflared(HTTPS 터널)

3. 코드 기준 확인 파일
- `docs/steps/step-00-assumptions-and-decisions.md`
- `docs/steps/step-01-repo-bootstrap.md`
- `docs/steps/step-02-shopify-auth-and-embedded-app.md`
- `docs/steps/step-03-core-db-and-multitenancy.md`
- `docs/steps/step-04-ingestion-upload-and-storage.md`
- `.env.example`
- `apps/api/src/config/env.ts`

## 3. 순서 요약(빠른 버전)

1. 로컬 infra(Postgres/Redis) 실행
2. Shopify Partner에서 앱 생성 + Redirect/Webhook URL 등록
3. Cloudflare R2 bucket/access key/CORS 설정
4. `.env` 실값 입력
5. `pnpm install`, `pnpm db:migrate`, `pnpm dev`
6. dev store에 앱 설치(OAuth)
7. `/app/uploads`에서 파일 업로드(create -> PUT to R2 -> complete) 검증

아래부터는 상세 절차다.

## 4. Step-by-step 상세 절차

### Step A. 로컬 infra 띄우기

1. 프로젝트 루트로 이동

```bash
cd /home/ksw6895/Projects/LeakWatch
```

2. Postgres/Redis 컨테이너 실행

```bash
docker compose up -d postgres redis
```

3. 실행 확인

```bash
docker compose ps
```

성공 기준:
- postgres: `localhost:5433`
- redis: `localhost:6379`

### Step B. Shopify 앱 생성(중요)

주의: 아래 UI 명칭은 Shopify Admin/Partner UI 업데이트에 따라 약간 다를 수 있다.

1. Partner Dashboard 접속 -> `Apps` -> `Create app`
2. 앱 타입 결정
- App Store 배포 가능성을 열어둘 거면 `Public app`
- 내부/특정 스토어 전용이면 `Custom distribution`

3. App setup에서 값 입력
- `App URL`: 웹 앱 주소(예: `https://<public-domain>`)
- `Allowed redirection URL(s)`: API callback 주소
  - `https://<public-domain>/v1/shopify/auth/callback`
- `Embedded app`: ON

4. API credentials에서 값 복사
- `API key` -> `SHOPIFY_API_KEY`, `NEXT_PUBLIC_SHOPIFY_API_KEY`
- `API secret key` -> `SHOPIFY_API_SECRET`

5. Webhook 등록
- topic: `app/uninstalled`
- URL: `https://<public-domain>/v1/shopify/webhooks/app-uninstalled`

6. Dev store install 테스트
- 설치 URL로 dev store에 앱 설치
- 성공 시 OAuth callback 후 `/app?shop=...`로 리다이렉트

#### Shopify URL 구성 실무 팁

- 현재 코드에서 OAuth callback 생성은 `API_BASE_URL`을 사용한다.
- callback 후 웹으로 보내는 URL은 `SHOPIFY_APP_URL`을 사용한다.
- 즉, 웹/API가 서로 다른 도메인이어도 가능하지만 둘 다 외부에서 접근 가능해야 한다.

참고 코드:
- `apps/api/src/modules/shopify/shopify-auth.service.ts`
- `apps/api/src/modules/shopify/shopify.controller.ts`

### Step C. Cloudflare R2 설정

1. R2 bucket 생성
- bucket 이름 예시: `leakwatch-dev`
- 권장: private bucket

2. S3 API용 access key 발급
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

3. Account endpoint 확인
- 형식: `https://<accountid>.r2.cloudflarestorage.com`
- 이 값을 `R2_ENDPOINT`로 사용

4. CORS 설정(브라우저 presigned PUT 업로드용)

예시:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://<public-domain>"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

5. 버킷/키 최소 검증
- presigned URL 발급은 API 서버가 수행
- 브라우저가 PUT 업로드할 때 CORS 에러가 없어야 함

참고 코드:
- `apps/api/src/modules/documents/storage/storage.client.ts`
- `apps/web/src/components/uploads-panel.tsx`

### Step D. 암호화 키 준비

`LW_ENCRYPTION_KEY_32B`는 base64 디코드 기준 정확히 32바이트여야 한다.

생성 예시:

```bash
openssl rand -base64 32
```

주의:
- 길이가 아니라 디코드 결과가 32바이트여야 함
- 이 값은 Git에 커밋 금지

검증 기준은 아래 env 스키마에 이미 정의되어 있다.
- `apps/api/src/config/env.ts`

### Step E. `.env` 채우기

`.env.example`을 기준으로 `.env` 값을 실값으로 바꾼다.

필수 치환 항목:
- `SHOPIFY_API_KEY=...`
- `SHOPIFY_API_SECRET=...`
- `NEXT_PUBLIC_SHOPIFY_API_KEY=...`
- `R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID=...`
- `R2_SECRET_ACCESS_KEY=...`
- `LW_ENCRYPTION_KEY_32B=...`

Shopify Embedded 검증(ngrok 1개 사용) 시 아래 3개를 같은 값으로 맞춘다:
- `SHOPIFY_APP_URL=https://<public-domain>`
- `API_BASE_URL=https://<public-domain>`
- `NEXT_PUBLIC_API_URL=https://<public-domain>`

로컬 기본값 사용 가능:
- `DATABASE_URL=postgresql://leakwatch:leakwatch@localhost:5433/leakwatch?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `R2_BUCKET=leakwatch-dev`
- `R2_REGION=auto`

### Step F. 의존성/DB 준비

1. 패키지 설치

```bash
pnpm install
```

2. DB migration 실행

```bash
pnpm db:migrate -- --name init
```

3. (선택) seed 실행

```bash
pnpm db:seed
```

### Step G. 앱 실행

```bash
pnpm dev
```

기본 포트:
- web: `http://localhost:3000`
- api: `http://localhost:4000`

### Step H. 설치/OAuth 검증

1. 브라우저에서 OAuth start 호출
- `https://<public-domain>/v1/shopify/auth/start?shop=<your-shop>.myshopify.com`

2. Shopify 권한 승인
3. callback 성공 확인
- API callback -> 웹 `/app?shop=...`로 이동

실패 시 먼저 확인:
- redirect URL이 Partner Dashboard에 정확히 등록됐는지
- `.env`의 `API_BASE_URL`, `SHOPIFY_APP_URL`이 실제 공개 URL인지
- `SHOPIFY_API_KEY/SECRET`이 정확한 앱의 값인지

`shop`만 있고 `host`가 missing으로 뜨면:
- 최신 코드 기준으로 callback에서 `host`를 자동 복구하도록 반영되어 있다.
- 설치 플로우를 한 번 다시 타면 `/app?...&host=...` 형태로 진입된다.

### Step I. step-04 업로드 검증

1. Embedded 앱에서 업로드 화면 진입
- `/app/uploads?shop=<shop>.myshopify.com&host=<host>`

2. 허용 타입 파일 업로드
- PDF/CSV/PNG/JPG
- 20MB 이하

3. 기대 흐름
- `POST /v1/shops/{shopId}/documents`
- 브라우저 -> presigned `PUT` to R2
- `POST /v1/documents/{documentId}/versions/{versionId}/complete`
- DB status `UPLOADED`
- 큐 `INGEST_DOCUMENT` enqueue

실패 케이스 기준:
- 413: 용량 초과
- 415: MIME 미지원
- CORS 에러: R2 CORS 설정/Origin 불일치

## 5. Done 판정 체크리스트(step 0-4)

1. 계정/리소스
- [ ] Shopify app/dev store 준비 완료
- [ ] R2 bucket + access key + CORS 완료
- [ ] Postgres/Redis 연결 정상

2. 보안/환경변수
- [ ] `LW_ENCRYPTION_KEY_32B` 유효
- [ ] `.env`의 placeholder(`replace_me`, `accountid`) 제거

3. 실행/검증
- [ ] `pnpm dev`로 web/api/worker 구동
- [ ] OAuth 설치 후 Embedded 진입 성공
- [ ] 업로드 create/complete 성공, R2 object 저장 확인

## 6. 지금 안 해도 되는 것(step-05+)

아래는 step-04까지는 불필수다.

- OpenAI API key/model 설정
- Mailgun 도메인/키/웹훅
- Sentry DSN
- Shopify Billing/App Store listing 리뷰 제출

## 7. 자주 막히는 포인트와 즉시 대응

1. OAuth redirect mismatch
- 원인: Partner Dashboard redirect URL과 실제 callback URL 불일치
- 조치: `https://<public-domain>/v1/shopify/auth/callback` 정확히 일치시킴

2. Embedded 화면에서 인증 루프
- 원인: `NEXT_PUBLIC_SHOPIFY_API_KEY` 또는 세션 토큰 흐름 오류
- 조치: `.env`의 공개키 값 재확인, 브라우저 콘솔/네트워크에서 `/v1/auth/me` 응답 확인

3. R2 PUT 실패(403/SignatureDoesNotMatch)
- 원인: `R2_ENDPOINT`, access key/secret, 버킷명 불일치
- 조치: endpoint/account/bucket 재검증 후 재시도

4. R2 CORS 오류
- 원인: AllowedOrigins에 현재 웹 도메인 누락
- 조치: 로컬/터널 도메인을 CORS에 추가

5. `LW_ENCRYPTION_KEY_32B must decode to 32 bytes`
- 원인: 키 포맷 불량
- 조치: `openssl rand -base64 32`로 재생성

## 8. 다른 AI에게 물어볼 때 쓰는 핸드오프 템플릿

아래 템플릿을 그대로 복사해서, 민감정보를 마스킹한 뒤 질문하면 된다.

```text
프로젝트: LeakWatch (monorepo)
목표: step-00~04 완료 (Shopify OAuth + Embedded + R2 업로드)

현재 상태:
- 로컬: Node 20, pnpm 9, docker compose postgres/redis 실행 여부: <yes/no>
- Shopify app: <created/not>, distribution: <public/custom>
- Redirect URL 등록값:
  - <value1>
- Webhook(app/uninstalled) 등록값:
  - <value2>
- R2:
  - bucket: <name>
  - endpoint: <masked>
  - CORS: <설정 내용 요약>

환경변수(민감정보 마스킹):
- SHOPIFY_API_KEY=****
- SHOPIFY_API_SECRET=****
- NEXT_PUBLIC_SHOPIFY_API_KEY=****
- SHOPIFY_APP_URL=<value>
- API_BASE_URL=<value>
- R2_ENDPOINT=<value>
- R2_ACCESS_KEY_ID=****
- R2_SECRET_ACCESS_KEY=****
- R2_BUCKET=<value>
- LW_ENCRYPTION_KEY_32B=****
- DATABASE_URL=<masked>
- REDIS_URL=<masked>

증상:
- 어떤 화면/요청에서 실패하는지:
- HTTP status / 에러 메시지:
- 브라우저 콘솔 에러:
- 서버 로그:

이미 확인한 것:
- redirect URL 오탈자 확인 여부
- CORS origin 포함 여부
- .env placeholder 제거 여부

도움 받고 싶은 것:
- 원인 추정 1~3순위
- 정확한 수정 위치(파일/콘솔 경로)
- 수정 후 재검증 순서
```

## 9. 관련 소스 맵(빠른 참조)

- step 문서:
  - `docs/steps/step-00-assumptions-and-decisions.md`
  - `docs/steps/step-01-repo-bootstrap.md`
  - `docs/steps/step-02-shopify-auth-and-embedded-app.md`
  - `docs/steps/step-03-core-db-and-multitenancy.md`
  - `docs/steps/step-04-ingestion-upload-and-storage.md`
- Shopify 통합 상세:
  - `docs/INTEGRATIONS_SHOPIFY.md`
- 업로드/파이프라인 상세:
  - `docs/INGESTION.md`
- env 강제 스키마:
  - `apps/api/src/config/env.ts`
- 업로드 UI/로직:
  - `apps/web/src/components/uploads-panel.tsx`
  - `apps/api/src/modules/documents/documents.service.ts`
  - `apps/api/src/modules/documents/storage/storage.client.ts`

## 10. 마지막 점검 명령어

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

위 네 개가 통과하고, OAuth 설치 및 업로드 1건이 성공하면 step-04까지 실무 기준 완료다.

## 11. 진행 상태 업데이트 (2026-02-12)

아래 항목은 실제 세션에서 검증 완료된 상태다.

1. 실행 환경/기반
- WSL2에서 Docker Engine 정상 동작 확인(`hello-world` 실행 성공)
- `docker compose`로 postgres/redis 구동 확인
- Node 20 + pnpm 9 실행 확인

2. Shopify 연동
- Dev Dashboard 앱 생성 및 OAuth 설치 플로우 통과
- `leakwatch-dev-01.myshopify.com` 대상으로 설치/승인 확인
- Embedded 진입 시 `host` 누락 케이스 해결

3. 코드 변경사항(핵심)
- `apps/web/src`에서 API 프록시를 위해 Next rewrite 추가
- `apps/api/src/main.ts`, `apps/worker/src/main.ts`에서 루트 `.env` 자동 로드
- `apps/api/src/modules/shopify/*`에서 callback 리다이렉트 시 `host` 전달/복구 로직 추가

4. 남은 작업
- R2 실계정 값으로 `.env` 교체(`R2_*`)
- R2 CORS 설정 완료 후 `/app/uploads` 실제 업로드 검증

5. 보안 주의
- 대화/로그에 노출된 `SHOPIFY_API_SECRET`은 작업 종료 후 반드시 rotate
