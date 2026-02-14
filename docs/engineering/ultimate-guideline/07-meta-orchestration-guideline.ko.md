# 단계적 작업 메타 가이드라인 (Code Agent Orchestrator)

이 문서는 `docs/engineering/ultimate-guideline/*.md` 분할 문서를 코드 에이전트가 안전하게 순차 실행하기 위한 운영 규칙이다.

## 1) 목표

- 대형 문서를 바로 구현하지 않고, 단계 단위로 분해해 실패 반경을 줄인다.
- 각 단계마다 증거(진단, 테스트, 문서 업데이트)를 남긴다.
- 병렬 작업은 하되 충돌 가능성이 높은 파일 경계는 명시적으로 잠근다.

## 2) 입력 문서와 우선순위

필수 입력(순서 고정):

1. `docs/engineering/ultimate-guideline/01-product-user-core-flow.ko.md`
2. `docs/engineering/ultimate-guideline/02-uiux-problem-list-and-improvements.ko.md`
3. `docs/engineering/ultimate-guideline/03-improvement-roadmap-phases.ko.md`
4. `docs/engineering/ultimate-guideline/04-multi-agent-orchestration-playbook.ko.md`
5. `docs/engineering/ultimate-guideline/05-api-data-change-requirements.ko.md`
6. `docs/engineering/ultimate-guideline/06-assumptions-and-validation.ko.md`

보조 입력:

- `docs/engineering/TESTING_QA.md`
- `docs/engineering/ANALYTICS_METRICS.md`
- `docs/operations/SECURITY_PRIVACY.md`
- `docs/steps/step-13-non-step-gap-closure.md`

## 3) 표준 실행 단위

한 번의 실행 단위는 "Epic 1개 또는 Task 1~3개"로 제한한다.

각 실행 단위는 아래 산출물을 반드시 남긴다.

- 변경 파일 목록
- 수용 기준 충족 여부(Yes/No)
- 검증 로그(테스트/타입체크/수동 검증)
- 미해결 이슈/가정 업데이트

## 4) 페이즈 게이트 규칙

페이즈 전환 전 체크:

- 기능: 해당 페이즈의 최소 수용 기준 충족
- 안정성: lint/typecheck/test 중 최소 관련 검증 통과
- 문서: API/UX 변경이 있으면 관련 문서 동기화
- 보안/권한: OWNER/MEMBER/AGENCY_ADMIN/AGENCY_VIEWER 정책 위반 없음

게이트 실패 시:

- 다음 페이즈로 넘어가지 않는다.
- 실패 원인을 "코드 결함 / 요구 불명확 / API 미지원"으로 분류한다.
- 결함 수정 또는 요구 명확화 후 같은 페이즈를 재실행한다.

## 5) 병렬 처리 규칙

병렬 허용:

- 서로 다른 라우트/컴포넌트 영역 작업
- 문서 보강 + 코드 구현 동시 진행
- UI 개선 + 이벤트 계측 동시 진행

병렬 금지:

- 같은 파일 동시 수정
- RBAC 정책 변경과 해당 정책 의존 기능을 서로 다른 브랜치에서 독립 확정
- API 계약 미확정 상태에서 프론트/백엔드 동시 확정 구현

충돌 방지 규약:

- PR당 핵심 목표 1개
- 변경 파일 15개 초과 시 분리
- 공통 파일(`roles.ts`, layout, fetcher, OpenAPI)은 선행 PR 머지 후 후속 PR 진행

## 6) 권장 단계 시퀀스

1. Shell/Navigation/RBAC 기초 고정
2. Uploads 신뢰성(안내/폴링/실패복구) 강화
3. Leaks/Actions 위험 액션 안전장치 강화
4. Billing/Reports/Agency 흐름 정합성 보강
5. API 요구사항 반영 및 문서 동기화
6. 가정 항목 검증 완료 후 잔여 갭 정리

## 7) 에이전트 프롬프트 템플릿

각 에이전트 프롬프트는 아래를 고정 포함한다.

- TASK: 이번 실행 단위의 단일 목표
- EXPECTED OUTCOME: 산출물/수용 기준
- MUST DO: 수정 파일, 검증 항목, 문서 동기화
- MUST NOT DO: 범위 외 리팩터링, 타입 무시, 정책 우회
- CONTEXT: 관련 경로, 연계 문서, 현재 페이즈

## 8) 완료 정의 (Meta DoD)

아래를 모두 만족하면 전체 작업 완료로 본다.

- 분할 문서 1~6의 P0/P1 항목이 계획대로 반영됨
- 검증 가능한 증거가 PR/문서에 남아 있음
- 권한/보안/운영 가이드와 불일치 없음
- `docs/README.md`와 분할 인덱스(`README.ko.md`)가 최신 상태
