# Step 01 — Repo Bootstrap (Monorepo)

## 목표(사용자 가치)
- 개발자들이 같은 규칙/툴로 빠르게 개발/테스트/배포를 반복할 수 있다.

## 범위/비범위
- 범위: 모노레포, lint/test/typecheck, docker-compose, 기본 CI
- 비범위: Shopify OAuth/기능 구현

## 선행 조건(필요 계정/키/설정)
- GitHub repo
- Node 20, pnpm 9, Docker

## 구현 체크리스트(세부 태스크)
1) 모노레포 구성
- pnpm workspace + turborepo
- apps/web (Next.js)
- apps/api (NestJS)
- apps/worker (Node processor)
- packages/shared (공통 타입/유틸)

2) 공통 툴링
- ESLint + Prettier + TypeScript strict
- Vitest setup
- Husky + lint-staged

3) 로컬 인프라
- docker-compose.yml:
  - postgres:15
  - redis:7
- .env.example 작성

4) Prisma setup
- apps/api/prisma/schema.prisma
- migration scripts:
  - pnpm db:migrate (dev)
  - pnpm db:deploy (prod)

5) 기본 CI(GitHub Actions)
- install → lint → typecheck → test → build

## 파일/디렉토리 구조(추가/변경 파일 명시)
- /turbo.json
- /pnpm-workspace.yaml
- /docker-compose.yml
- /apps/web/*
- /apps/api/*
- /apps/worker/*
- /packages/shared/*
- /.github/workflows/ci.yml

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)
- packages/shared:
  - types: OpenAPI generated types(or hand-written DTO)
  - env: zod env validation
  - logger: pino wrapper
- apps/api:
  - ConfigModule: env validation(zod)
- apps/worker:
  - QueueModule: BullMQ init

## API/DB 변경사항
- DB 초기 스키마 migration 생성

## 테스트(케이스 + 실행 커맨드)
- pnpm test (샘플 유닛 테스트 1개)
- pnpm typecheck

## Definition of Done(정량 기준)
- 로컬에서 pnpm dev로 web/api/worker 모두 실행 가능
- CI가 main에 대해 green
- Prisma migrate가 로컬에서 성공

## 흔한 함정/디버깅 팁
- turborepo 캐시로 env 변경이 반영 안 되는 경우: pnpm turbo run dev --force
- Prisma binary target(Fly) 이슈: prisma generate에 linux-musl 포함

## 롤백/마이그레이션 주의사항
- 초기 migration은 변경 가능하나, staging 배포 이후에는 destructive 변경 금지

## 완료 상태 (2026-02-11)
- [x] pnpm workspace + turbo 모노레포 구성
- [x] `apps/web`, `apps/api`, `apps/worker`, `packages/shared` 생성
- [x] ESLint + Prettier + TypeScript strict + Vitest 구성
- [x] Husky + lint-staged(pre-commit) 구성
- [x] `docker-compose.yml` (postgres:15, redis:7) 구성
- [x] `.env.example` 작성
- [x] Prisma 초기 스키마/마이그레이션 생성 (`apps/api/prisma/migrations/20260211184737_init`)
- [x] GitHub Actions CI (`.github/workflows/ci.yml`) 구성

## 실행 검증 커맨드
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

```bash
docker-compose up -d postgres redis
DATABASE_URL=postgresql://leakwatch:leakwatch@localhost:5433/leakwatch?schema=public pnpm db:migrate -- --name init
```
