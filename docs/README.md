# LeakWatch Docs Index

문서가 많아져서 영역별로 재정리했다. 이 파일을 기준으로 필요한 문서만 찾아본다.

## 1) 제품/범위

- `docs/product/PRD.md` - 제품 요구사항/사용자 스토리/수용 기준
- `docs/product/ROADMAP.md` - MVP -> V1 로드맵
- `docs/product/PRICING_AND_UNIT_ECONOMICS.md` - 가격/단위경제성

## 2) 시스템 설계

- `docs/architecture/ARCHITECTURE.md` - 전체 구조/모듈 경계
- `docs/architecture/DATA_MODEL.md` - 도메인 모델/DB 관점
- `docs/architecture/INGESTION.md` - ingestion 설계
- `docs/architecture/NORMALIZATION_SCHEMA.md` - 정규화 스키마
- `docs/architecture/DETECTION_RULES.md` - 탐지 규칙
- `docs/architecture/ACTIONS_AUTOMATION.md` - 액션 자동화 흐름

## 3) 구현/품질(개발팀)

- `docs/engineering/UI_UX.md` - 화면 구조/UX 정책
- `docs/engineering/FRONTEND_REVAMP_HYPER_VISOR.md` - 프론트 리뱀프 가이드
- `docs/engineering/TESTING_QA.md` - 테스트/QA 기준
- `docs/engineering/ANALYTICS_METRICS.md` - 이벤트/지표 설계
- `docs/engineering/ultimate-guideline/README.ko.md` - Ultimate guideline 무손실 분할 인덱스
- `docs/engineering/ultimate-guideline/07-meta-orchestration-guideline.ko.md` - 단계적 코드 에이전트 오케스트레이션 메타 가이드
- `docs/engineering/ultimate-guideline/08-p0-execution-checklist.ko.md` - P0 전용 실행 체크리스트

## 4) 운영/보안/연동

- `docs/operations/DEPLOYMENT_OPS.md` - 배포/운영 표준
- `docs/operations/SECURITY_PRIVACY.md` - 보안/개인정보/권한
- `docs/operations/INTEGRATIONS_SHOPIFY.md` - Shopify 통합 기준
- `docs/operations/runbooks/step-00-04-setup-playbook.ko.md` - 초기 실전 설정
- `docs/operations/runbooks/shopify-production-launch-checklist.ko.md` - 실서비스 출시 점검
- `docs/operations/runbooks/incident.md` - 장애 대응
- `docs/operations/runbooks/data-deletion.md` - 데이터 삭제 처리
- `docs/operations/runbooks/cost-guardrails.md` - 비용 가드레일

## 5) API/프롬프트

- `docs/api/OPENAPI.yaml` - API 계약
- `docs/api/ERROR_CODES.md` - 에러 코드
- `docs/prompts/` - LLM 프롬프트 템플릿

## 6) 단계 문서

- 활성 단계: `docs/steps/step-13-non-step-gap-closure.md`
- 완료/보관 단계: `docs/steps/archive/`

## 7) 감사 리포트

- `docs/audits/AUDIT_2026-02-13.ko.md`

## Quick Start

```bash
docker compose up -d postgres redis
pnpm install
pnpm db:deploy
pnpm dev
```

검증:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
