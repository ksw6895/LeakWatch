# Ultimate Guideline 분할 인덱스 (무손실)

원본 문서 `docs/ultimateguideline.md`를 코드 에이전트 오케스트레이션에 맞춰 단계별로 분할했다.
초기 분할 시 원본을 라인 범위 기준으로 복제했으며, 이후 구현 동기화는 분할 문서를 우선 기준으로 유지한다.

## 원본-분할 매핑

- `docs/engineering/ultimate-guideline/01-product-user-core-flow.ko.md`
  - source: `docs/ultimateguideline.md:1`
  - 범위: 문서 헤더 + `## 1) 제품/사용자/핵심 플로우 정의`
- `docs/engineering/ultimate-guideline/02-uiux-problem-list-and-improvements.ko.md`
  - source: `docs/ultimateguideline.md:90`
  - 범위: `## 2) 현재 UI/UX 문제 리스트 + 개선 설계`
- `docs/engineering/ultimate-guideline/03-improvement-roadmap-phases.ko.md`
  - source: `docs/ultimateguideline.md:780`
  - 범위: `## 3) 개선안 로드맵`
- `docs/engineering/ultimate-guideline/04-multi-agent-orchestration-playbook.ko.md`
  - source: `docs/ultimateguideline.md:973`
  - 범위: `## 4) 초고성능 코딩 에이전트 다수 오케스트레이션 지시서`
- `docs/engineering/ultimate-guideline/05-api-data-change-requirements.ko.md`
  - source: `docs/ultimateguideline.md:1089`
  - 범위: `## 5) API/데이터 변경 요구사항 명세`
- `docs/engineering/ultimate-guideline/06-assumptions-and-validation.ko.md`
  - source: `docs/ultimateguideline.md:1128`
  - 범위: `## 6) 확인 불가(가정) 목록 + 검증 방법`

## 실행 순서 (오케스트레이터 기준)

1. `01-product-user-core-flow.ko.md`
2. `02-uiux-problem-list-and-improvements.ko.md`
3. `03-improvement-roadmap-phases.ko.md`
4. `04-multi-agent-orchestration-playbook.ko.md`
5. `05-api-data-change-requirements.ko.md`
6. `06-assumptions-and-validation.ko.md`

## 함께 읽을 메타 가이드

- `docs/engineering/ultimate-guideline/07-meta-orchestration-guideline.ko.md`
- `docs/engineering/ultimate-guideline/08-p0-execution-checklist.ko.md`
- `docs/engineering/ultimate-guideline/09-post-step13-p1-p2-backlog.ko.md`

## 운영 메모

- `01`~`06` 문서는 원본 분할 본문에 더해, 파일 하단에 "에이전트 프롬프트 템플릿" 섹션이 추가되어 있다.
