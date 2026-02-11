# Step 02 — Shopify Auth & Embedded App Skeleton

## 목표(사용자 가치)
- Shopify Admin에서 LeakWatch를 열면 안전하게 인증되고, 스토어 컨텍스트(shop)가 확정된다.

## 범위/비범위
- 범위:
  - Shopify OAuth start/callback
  - shop/offline token 저장(암호화)
  - Embedded UI(Polaris/App Bridge) 부팅
  - uninstall webhook
- 비범위:
  - 설치 앱 목록 동기화(옵션은 스텝 09/10에서)

## 선행 조건(필요 계정/키/설정)
- Shopify Partner 앱 생성
- SHOPIFY_API_KEY/SECRET, redirect URL 등록
- ngrok(로컬 개발 시)
- LW_ENCRYPTION_KEY_32B 준비

## 구현 체크리스트(세부 태스크)
1) API: OAuth start
- GET /v1/shopify/auth/start
- shop param 검증 → state 생성 → Shopify authorize URL로 redirect

2) API: OAuth callback
- GET /v1/shopify/auth/callback
- state 검증
- hmac 검증
- code로 access token 교환
- Shop upsert + ShopifyToken upsert(encrypted)
- installedAt 업데이트

3) Web: Embedded bootstrap
- Next.js에서 Shopify App Bridge Provider 설정
- URL 파라미터 host, shop 처리
- 인증 필요 시 App Bridge redirect to /auth/start

4) Session token 기반 API 호출
- web에서 session token 획득 → api fetch wrapper에 자동 주입

5) Webhook: app/uninstalled
- POST /v1/shopify/webhooks/app-uninstalled
- HMAC header 검증
- Shop.uninstalledAt set, token revoke(delete)

## 파일/디렉토리 구조(추가/변경 파일 명시)
- apps/api/src/modules/shopify/*
- apps/web/src/app/(embedded)/app/*
- packages/shared/src/shopify/* (helpers)

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)
- ShopifyAuthService
  - startAuth(shopDomain) → redirectUrl
  - handleCallback(query) → {shopId}
- ShopifyWebhookService
  - verifyWebhook(signature, rawBody)
  - handleUninstalled(payload)
- AuthGuard (API)
  - verifyShopifySessionToken(jwt) → AuthContext

## API/DB 변경사항
- Shop, ShopifyToken 테이블 사용 시작
- AuditLog: auth.install_completed 기록

## 테스트(케이스 + 실행 커맨드)
- Unit:
  - hmac verify 함수 테스트
- Integration:
  - callback handler에 대해 잘못된 hmac/state 시 401/400
- 실행:
  - pnpm test:api

## Definition of Done(정량 기준)
- dev store에서 설치 → 앱 열기 → dashboard skeleton 렌더
- uninstall webhook 호출 시 token 삭제 및 shop uninstalledAt 저장

## 흔한 함정/디버깅 팁
- Next.js embedded에서 redirect가 iframe 때문에 막히는 경우: App Bridge Redirect 사용
- webhook raw body가 body parser로 변형되면 서명검증 실패 → rawBody 확보 필수

## 롤백/마이그레이션 주의사항
- token 암호화 포맷 변경 시 기존 데이터 복호화 실패 가능 → 버전 필드 고려
