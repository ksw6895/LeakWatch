# Step 03 — Core DB & Multitenancy Enforcement

## 목표(사용자 가치)
- 데이터가 org/shop 경계를 절대 넘어가지 않고, 권한에 따라 기능이 제한된다.

## 범위/비범위
- 범위:
  - Prisma 스키마 구현(Org/User/Membership/Shop/Document 등)
  - AuthContext 확정(orgId/shopId/userId/roles)
  - API guard/tenant filter helper
- 비범위:
  - 실제 업로드/LLM 처리

## 선행 조건(필요 계정/키/설정)
- DATABASE_URL
- Prisma migration 준비

## 구현 체크리스트(세부 태스크)
1) Prisma schema 작성(/docs/DATA_MODEL.md 기반)
2) Migration 실행
3) AuthContext 생성 로직
- Shopify session token에서:
  - shop domain 추출 → shopId lookup
  - userId는 shopifyUserId(sub)로 upsert
  - membership 없으면 org의 첫 사용자로 OWNER 생성
4) TenantGuard 구현
- request마다 orgId/shopId 확인
- 쿼리는 반드시 where: { orgId } 포함하도록 helper 제공
5) AuditLog middleware
- write endpoint에서 AuditLog 생성

## 파일/디렉토리 구조(추가/변경 파일 명시)
- apps/api/prisma/schema.prisma
- apps/api/src/modules/auth/*
- apps/api/src/modules/audit/*

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)
- AuthContextProvider
  - fromShopifySessionToken(token) → context
  - fromEmailJwt(token) → context
- TenantPrisma
  - tenant(orgId).shop(shopId).documents.findMany(...)
  - 실수 방지용 wrapper

## API/DB 변경사항
- Org/User/Membership/Shop 테이블 활성화
- 모든 existing endpoint에 auth 적용

## 테스트(케이스 + 실행 커맨드)
- 멀티테넌시 테스트:
  - orgA의 finding을 orgB token으로 조회하면 404 또는 403
- 권한 테스트:
  - VIEWER가 action approve 시 403
- pnpm test:api

## Definition of Done(정량 기준)
- 최소 10개 API가 auth/tenant guard를 통과
- 테넌시 위반 테스트가 모두 실패(차단)한다

## 흔한 함정/디버깅 팁
- Prisma에서 include를 잘못 사용하면 orgId 조건이 누락될 수 있음 → wrapper 강제
- shopifyUserId(sub)가 환경별로 달라질 수 있어 unique 처리 주의

## 롤백/마이그레이션 주의사항
- role enum 추가/변경은 backward-compatible하게

## 완료 상태 (2026-02-11)
- [x] Prisma core schema 구현 (`apps/api/prisma/schema.prisma`)
  - Org/User/Membership/Shop/ShopifyToken/Document/LeakFinding/Action/Audit 등 핵심 모델 반영
- [x] 초기 migration 생성 및 적용
- [x] AuthContext 생성 로직 구현
  - Shopify session token(`dest`,`sub`) 검증
  - shop domain → shop/org resolve
  - user upsert + membership 자동 생성(최초 OWNER)
- [x] TenantGuard + tenant helper(`TenantPrismaService`) 구현
- [x] AuditLog write middleware(interceptor) 구현
- [x] 최소 10개 인증/테넌시 적용 API 확보
  - `/v1/auth/me`
  - `/v1/shops`
  - `/v1/shops/:shopId`
  - `/v1/documents`
  - `/v1/documents/:id`
  - `/v1/documents` (POST)
  - `/v1/documents/:id/complete` (POST)
  - `/v1/findings`
  - `/v1/findings/:id`
  - `/v1/actions/:findingId/approve` (POST, RBAC)
  - `/v1/reports`

## 테스트 결과
- [x] 멀티테넌시 차단 테스트: orgB token으로 orgA finding 접근 차단
- [x] 권한 테스트: VIEWER가 action approve 시 403
