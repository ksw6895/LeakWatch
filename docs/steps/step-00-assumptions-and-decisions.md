# Step 00 — Assumptions & Decisions

## 목표(사용자 가치)
- 팀이 “무엇을 만들고/무엇을 안 만드는지” 즉시 합의하고, 구현 중 흔들림을 제거한다.

## 범위/비범위
- 범위: 기술 스택 확정, 가정 목록, 검증 방법, 대안 플랜
- 비범위: 실제 코드 구현

## 선행 조건(필요 계정/키/설정)
- Shopify Partner 계정 + dev store 1개
- OpenAI API Key
- Mailgun 계정(도메인 1개)
- Cloudflare R2 bucket
- Supabase(또는 Neon) Postgres
- Upstash Redis
- Sentry project

## 구현 체크리스트(세부 태스크)
1) 기술 스택 확정(README와 동일)
2) Shopify API 제약 확인:
   - 다른 앱의 과금 내역 조회 불가 가정 확인
   - 설치 앱 목록 조회 가능 여부 테스트
3) 업로드/정규화 샘플 데이터 30개 확보(가능하면 ICP 실제 데이터)
4) LLM 모델/프롬프트 비용 추정:
   - Tin/Tout 측정
   - 캐시 정책 결정
5) 보안 기준:
   - 토큰 암호화 키 관리
   - 데이터 보관 기간 고정(365일)
6) MVP 누수 5종 규칙과 threshold 확정:
   - MoM spike(50%+$50)
   - Duplicate(±1%)
   - Post-cancel(after cancelSentAt)
   - Trial-to-paid(keywords)
   - Uninstalled app mismatch(가능하면)
7) “추적” 범위 확정:
   - MVP: mail delivered + 수동 상태
   - V1: inbound replies 자동

## 파일/디렉토리 구조(추가/변경 파일 명시)
- /docs/* (현재 문서 세트)
- repo 루트에 아래 파일 생성 권장(코드 단계에서):
  - /docker-compose.yml
  - /apps/web
  - /apps/api
  - /apps/worker
  - /packages/shared

## 핵심 코드 설계(클래스/함수 책임, 인터페이스)
- StorageClient: put/get/presign
- LLMClient: normalizeInvoice(), draftEmail(), classifyRisk()
- ExtractionService: extractTextFromPdf(), extractTextFromImage(), parseCsv()
- DetectionEngine: run(shopId, periodRange) → findings[]
- ActionService: createDraft(), approveAndSend()

## API/DB 변경사항
- 없음(설계 단계)

## 테스트(케이스 + 실행 커맨드)
- 없음

## Definition of Done(정량 기준)
- 가정 10개 이하로 정리
- 각 가정에 “검증 방법/대안”이 문서화
- MVP 기능 범위가 PRD/ROADMAP에 일치

## 흔한 함정/디버깅 팁
- Shopify “가능할 것 같은데 안 되는 API”가 많음 → 반드시 dev store에서 먼저 호출해본다.
- 인보이스는 포맷이 제각각 → 초기엔 규칙 + strict schema + repair가 필수

## 롤백/마이그레이션 주의사항
- 없음
