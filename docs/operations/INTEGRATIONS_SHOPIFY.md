# Shopify 통합 가이드

## 0) 목표

- Shopify Embedded App으로 설치/실행 가능
- OAuth로 shop offline token 저장
- App Bridge session token으로 API 호출 인증
- Uninstall webhook 처리
- (가능 범위) 설치 앱 목록 동기화

## 1) Shopify Partner/앱 생성

1. Shopify Partner 계정 생성
2. Apps → Create app → Public app(앱스토어 배포 전제)
3. App setup:
   - App URL: https://app.leakwatch.io (prod) / https://staging.leakwatch.io (staging)
   - Allowed redirection URL(s):
     - https://app.leakwatch.io/v1/shopify/auth/callback
     - https://staging.leakwatch.io/v1/shopify/auth/callback
     - 로컬 개발: https://<ngrok-domain>/v1/shopify/auth/callback
   - Embedded app: ON
4. API credentials:
   - API key, API secret key 저장(비밀)
5. Webhooks:
   - app/uninstalled: https://app.leakwatch.io/v1/shopify/webhooks/app-uninstalled
   - shop/update(선택): https://app.leakwatch.io/v1/shopify/webhooks/shop-update

## 2) OAuth 플로우(서버)

### 2.1 엔드포인트

- GET /v1/shopify/auth/start?shop={shop}.myshopify.com
- GET /v1/shopify/auth/callback?code=...&shop=...&state=...&hmac=...

### 2.2 필수 검증

- state(Nonce) 검증(세션/쿠키)
- hmac 검증(쿼리스트링 정렬 후 secret으로 서명 비교)
- shop 도메인 검증(정규식: ^[a-z0-9][a-z0-9-]\*\.myshopify\.com$)

### 2.3 토큰 저장

- offline access token 발급 후 shopify_tokens.accessTokenEnc에 AES-256-GCM으로 암호화 저장
- scopes 저장(문자열)

암호화 요구:

- 마스터 키: LW_ENCRYPTION_KEY_32B(32바이트 base64) (환경변수/시크릿)
- 알고리즘: AES-256-GCM
- 저장 포맷: base64(iv).base64(ciphertext).base64(tag)

## 3) 최소 스코프(권장)

ASSUMPTION: LeakWatch는 “다른 앱의 결제 데이터”를 조회하지 않으므로 최소 스코프 원칙을 따른다.

- 필수:
  - read_shopify_payments? 필요 없음 (미사용)
  - read_orders? 필요 없음 (미사용)
  - read_products: 현재 기본 환경변수(`SHOPIFY_SCOPES`)에 포함됨

현실적으로 embedded 앱에서 “shop 메타” 조회를 위해 다음 중 하나가 필요할 수 있다:

- ASSUMPTION S1: GraphQL로 shop { name, currencyCode, ianaTimezone } 조회는 기본적으로 가능
  - 검증: 개발 스토어에서 Admin API GraphQL 호출 테스트
  - 대안: UI에서 통화/타임존을 사용자 입력으로 받는다(기본값 USD/Asia/Seoul)

설치 앱 목록 동기화(옵션):

- ASSUMPTION S2: Admin API로 설치된 앱 목록 조회가 가능한 스코프가 존재하며, 승인받을 수 있다.
  - 검증: Shopify API 문서에서 “installed apps / app installations” 조회 스코프/쿼리 확인
  - 대안: 앱 목록은 “사용자 업로드(스크린샷/CSV)” 또는 “Shopify Admin → Apps 목록 복사-붙여넣기”로 입력받는다.
  - MVP 정책: S2가 불명확하면 “설치 앱 목록 동기화”는 옵션 기능으로 두고, 탐지 L-05는 confidence 낮춤

## 4) Embedded App 인증(App Bridge session token)

- Web(Next.js)에서 App Bridge를 초기화하고 session token(JWT)을 획득
- API 호출 시:
  - Authorization: Bearer <shopify_session_token>
- API(NestJS)는 다음을 검증:
  - JWT 서명/issuer/audience(=Shopify API key)
  - exp 만료
  - dest(=shop domain) 기반으로 shopId lookup

현재 구현: API는 `jose` 기반 JWT 검증(`jwtVerify`)으로 Shopify session token을 확인한다.

- 검증: 로컬 dev store에서 token verify 통과 확인
- 대안: Shopify의 공개키(JWKS) 기반 직접 검증 구현(보안 위험 낮으나 구현 부담)

## 5) Shopify Webhooks

### 5.1 app/uninstalled

- 수신 시 처리:
  - Shop.uninstalledAt = now
  - ShopifyToken 무효화(삭제 또는 status 처리)
  - 관련 repeatable jobs(리포트) 중지
  - AuditLog 기록

### 5.2 shop/update(선택)

- shop 메타(이름/타임존/통화) 갱신

Webhooks 검증:

- HMAC header 검증
- topic/path 매핑

## 6) App Store 배포 흐름(요약)

1. 앱 심사 요구사항 충족(개인정보/데이터 정책/지원 URL)
2. Pricing plans 설정(Shopify Billing과 연동되는 유료 플랜)
3. 스크린샷/설명 등록
4. Review 제출

## 7) Shopify Billing(자사 앱 과금)

- LeakWatch는 Shopify 앱 과금으로 “월 구독”을 청구한다.
- API: /v1/billing/subscribe?plan=PRO → Shopify confirmation URL 반환 → 프론트에서 redirect
- Webhook(또는 폴링)로 subscription 활성화 확인 후 Organization.plan 업데이트

ASSUMPTION: Shopify Billing API(appSubscription) 사용 가능

- 검증: 개발 스토어에서 test charge 생성/확인
- 대안: Stripe로 외부 결제(단, Shopify 앱스토어 배포/정책 고려 필요)
