# Step 10 — Agency Multi-Store Mode

## 목표(사용자 가치)

- 에이전시/멀티스토어 사용자가 여러 Shop의 누수를 한 곳에서 보고 리포트를 만들 수 있다.

## 범위/비범위

- 범위:
  - Org에 여러 Shop 연결
  - Store switcher UI
  - Org-level dashboard(/agency) + shop-level drilldown
  - 역할(AGENCY_ADMIN/VIEWER) 적용
- 비범위:
  - 클라이언트별 맞춤 PDF 브랜딩(옵션)

## 선행 조건(필요 계정/키/설정)

- Org/Shop 모델 완성(step-03)
- email login(agency portal용) 구현 필요
  - ASSUMPTION: agency는 Shopify 밖에서 접속하는 경우가 많다 → magic link 도입

## 구현 체크리스트(세부 태스크)

1. Email magic link auth 구현(간단)

- /agency/login: email 입력
- API: send magic link(email, token)
- /agency/callback: token verify → LW JWT cookie 설정

2. Org-level endpoints

- GET /v1/orgs/{orgId}/shops
- GET /v1/orgs/{orgId}/summary
  - shopsCount, totalSpend, potentialSavings, topFindingsAcrossShops

3. Store linking UX

- 방법 A(권장, 구현 쉬움):
  - 동일 Org에 shop을 자동으로 묶는 규칙:
    - (ASSUMPTION) Owner가 settings에서 “Org name” 설정하고, 새 shop 설치 시 같은 email을 가진 user가 있으면 동일 org에 귀속
  - 검증: Shopify user email을 얻기 어렵다면 실패
- 방법 B(현실적 대안, MVP):
  - Org에 “Connect code” 생성(6자리)
  - 다른 shop에서 앱 열고 code 입력 → 해당 shop을 org에 연결
  - 이때 권한: AGENCY_ADMIN만 code 생성/사용 가능

4. UI

- Embedded header에 Store Switcher(Org 내 shops)
- /agency dashboard:
  - shop별 top leak 1개씩
  - total potential savings
  - report export 버튼(옵션)

## 파일/디렉토리 구조(추가/변경 파일 명시)

- apps/api/src/modules/agency/\*
- apps/web/src/app/agency/\*
- apps/web/src/components/StoreSwitcher.tsx

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)

- AgencyAuthService
  - requestMagicLink(email)
  - verifyMagicLink(token) → userId/orgId
- OrgLinkService
  - createConnectCode(orgId)
  - attachShopToOrg(code, shopId)

## API/DB 변경사항

- User.email nullable → agency login 시 필수로 채움
- connect_codes 테이블 추가(옵션):
  - code, orgId, expiresAt, usedAt

## 테스트(케이스 + 실행 커맨드)

- connect code로 shop 연결 성공/실패
- agency viewer 권한으로 write 차단
- pnpm test:api

## Definition of Done(정량 기준)

- 하나의 org에 shop 2개를 연결하고 org summary가 합산을 보여준다.
- agency portal에서 shops list/summary가 렌더된다.

## 흔한 함정/디버깅 팁

- embedded(Shopify)와 agency portal(auth)가 충돌하지 않게 cookie/토큰 구분
- 멀티샵 합산 시 통화가 다르면 환율 이슈 → MVP는 “통화별 분리 표시”로 해결(환율 변환은 V1)

## 롤백/마이그레이션 주의사항

- org 귀속 규칙 변경 시 기존 shop 이동 필요 → connect code 기반이 안전

## 완료 상태(코드 반영)

- [x] Org-level endpoints 구현: `GET /v1/orgs/:orgId/shops`, `GET /v1/orgs/:orgId/summary`
- [x] Connect code 생성/연결 API 구현: `POST /v1/orgs/:orgId/connect-codes`, `POST /v1/shops/:shopId/connect-code`
- [x] `connect_codes` 테이블 추가: `ConnectCode` 모델 + migration
- [x] Store switcher UI 구현: `apps/web/src/components/StoreSwitcher.tsx`
- [x] Agency dashboard UI 구현: `apps/web/src/app/(embedded)/app/agency/page.tsx`
- [x] API 테스트 추가: `apps/api/test/agency.spec.ts`
