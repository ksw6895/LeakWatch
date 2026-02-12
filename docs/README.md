# LeakWatch 개발 문서 세트

LeakWatch는 Shopify 스토어의 앱/SaaS 구독 비용을 **문서 업로드/이메일 인보이스 수집 → AI 표준화(JSON) → 누수 탐지 → 근거 포함 설명 → 해지/환불 액션 준비(메일/증빙 자동 생성) → 승인 후 발송/추적**까지 연결하는 솔루션이다.

## 단일 기술 스택 (문서 전체에서 고정)
- Frontend: **Next.js 14(App Router) + TypeScript + Shopify Polaris + App Bridge**
- Backend API: **NestJS(Node 20) + TypeScript**
- ORM/DB: **Postgres + Prisma**
- Queue/Worker: **BullMQ + Redis(Upstash Redis 권장)**
- File Storage: **Cloudflare R2(S3 호환) + Presigned URL**
- Email (발송/추적): **Mailgun(Outbound + Webhook)**
- LLM: **OpenAI API**
  - 기본: 구조화 추출/분류 = `gpt-4o-mini` (ASSUMPTION: 저비용/충분한 품질)
  - 고품질 생성(이메일/요약) = `gpt-4o` (ASSUMPTION)
  - 임베딩(옵션/RAG) = `text-embedding-3-small` (ASSUMPTION)
  - 검증 방법: 실제 30개 인보이스로 정규화 정확도(필수 필드 누락률<2%) 측정 후 모델 교체
- Hosting:
  - Web: **Vercel**
  - API/Worker: **Fly.io** (프로세스 그룹으로 api/worker 분리)
  - DB: **Supabase Postgres** 또는 **Neon Postgres** (여기서는 Supabase 권장)
- Observability:
  - Error/Trace: **Sentry**
  - Logs: **Pino(JSON) → Fly/Vercel 로그**
  - Metrics(선택): Sentry + DB/Redis provider metrics 대시보드

## Shopify 데이터 전략 (현실적 제약 포함)
Shopify Admin API로 **“다른 앱들의 과금/청구 내역”을 직접 조회하는 것은 일반적으로 불가능**하다(앱별 결제는 Shopify 청구/카드/Stripe/PayPal/이메일 인보이스로 파편화).

따라서 LeakWatch MVP는 아래 조합으로 동작한다:
- (A) **업로드 기반(필수/MVP)**: Shopify Invoice PDF / SaaS 인보이스 PDF / CSV / 이미지 업로드
- (B) **이메일 포워딩(선택/V1)**: 인보이스 메일을 LeakWatch 인바운드 주소로 자동 포워딩
- (C) **Shopify 설치 앱 목록/메타데이터(가능한 범위/MVP)**: “설치되어 있지 않은 앱인데 청구가 발생” 같은 강력한 누수 신호를 만들기 위해 설치 앱 목록을 동기화 (가능 범위는 스코프/Shopify API 정책에 따라 다를 수 있음)

## 로컬 개발 Quickstart(권장)
ASSUMPTION: 모노레포(pnpm + turborepo), docker compose로 로컬 Postgres/Redis 사용.

1) 사전 설치
- Node.js 20.x, pnpm 9.x
- Docker Desktop

2) 로컬 인프라 실행
- docker compose up -d postgres redis
  - 기본 포트 매핑: Postgres `localhost:5433`, Redis `localhost:6379`

3) 환경변수
- 루트 `.env`를 `.env.example` 기준으로 작성한다.
- step-04 업로드 기능까지 쓰려면 R2 관련 값(`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`)이 필수다.
- Shopify Embedded 검증(ngrok 1개 사용) 시 아래 3개를 같은 HTTPS 주소로 맞춘다:
  - `SHOPIFY_APP_URL`
  - `API_BASE_URL`
  - `NEXT_PUBLIC_API_URL`

4) Shopify 앱 URL 등록(Dev Dashboard)
- App URL: `SHOPIFY_APP_URL`
- Redirect URL: `${API_BASE_URL}/v1/shopify/auth/callback`
- Webhook URL: `${API_BASE_URL}/v1/shopify/webhooks/app-uninstalled`

5) 의존성/마이그레이션
- pnpm install
- pnpm db:migrate -- --name init (초기 1회)
- pnpm db:deploy (이미 migration이 있는 환경에서 재실행 시)
- pnpm db:seed

6) 실행
- pnpm dev
  - web: http://localhost:3000
  - api: http://localhost:4000
  - embedded upload UI: http://localhost:3000/app/uploads?shop=<shop>.myshopify.com&host=<host>

7) Shopify 설치 시작 URL(브라우저)
- `https://<domain>/v1/shopify/auth/start?shop=<shop>.myshopify.com`

8) 스모크 테스트
- pnpm lint
- pnpm typecheck
- DATABASE_URL=postgresql://leakwatch:leakwatch@localhost:5433/leakwatch?schema=public pnpm test
- DATABASE_URL=postgresql://leakwatch:leakwatch@localhost:5433/leakwatch?schema=public pnpm build

실전 상세 가이드는 아래 문서를 사용한다.
- `docs/runbooks/step-00-04-setup-playbook.ko.md`

## 개발 순서
- /docs/steps/step-00 → step-12 순으로 구현한다.
- API 변경은 반드시 /docs/api/OPENAPI.yaml 업데이트 후 서버/클라이언트 코드 생성(또는 타입 업데이트)한다.

## 용어
- Organization(Org): 결제/권한의 최상위 단위(에이전시 포함)
- Shop: Shopify 스토어(tenant의 핵심). Org는 여러 Shop을 가질 수 있다.
- Document: 업로드된 파일(인보이스/영수증/명세)
- NormalizedInvoice: LLM이 표준화한 JSON 인보이스
- LineItem: 인보이스의 청구 라인(반복 과금은 여러 달의 LineItem으로 쌓인다)
- LeakFinding: 누수 탐지 결과(근거 포함)
- ActionRequest/ActionRun: 액션(환불요청/해지요청 등) 생성 및 실행(발송/추적)
