## 6) “확인 불가(가정)” 목록 + 검증 방법

이 문서는 레포 코드/테스트를 근거로 가정 항목의 검증 상태를 기록한다.

1. ASSUMPTION: `/v1/action-requests` 응답이 displayStatus/latestRunStatus를 제공하는지

- 상태: 검증 완료
- 코드 근거: `apps/api/src/modules/auth/tenant-prisma.service.ts` (`listActionRequests`, `getActionRequest`)
- 테스트 근거: `apps/api/test/actions-flow.spec.ts` (`displayStatus`, `latestRunStatus` 검증)

2. ASSUMPTION: 에러 응답이 `{ errorCode, message }` 형태인지

- 상태: 명시적 deferred
- 현재 구현: 일부 도메인(예: 문서 버전 상태)은 `errorCode`를 저장/노출하지만, 전역 HTTP 에러 응답 스키마는 단일 표준으로 고정되지 않음
- 후속 액션: 전역 exception filter + `docs/api/ERROR_CODES.md`/`docs/api/OPENAPI.yaml` 동기화 배치에서 통합 표준 확정

3. ASSUMPTION: AGENCY_ADMIN write 권한 범위(특히 approve/send)

- 상태: 검증 완료
- 정책: AGENCY_ADMIN은 tenant 내부 액션/파인딩/agency connect-code write 허용, billing write는 OWNER-only 유지
- 코드 근거: `apps/api/src/modules/actions/actions.controller.ts`, `apps/api/src/modules/findings/findings.controller.ts`, `apps/api/src/modules/agency/agency.controller.ts`, `apps/api/src/modules/shops/shops.controller.ts`
- 테스트 근거: `apps/api/test/actions-flow.spec.ts` (AGENCY_ADMIN approve 허용)

4. ASSUMPTION: Shopify Billing subscribe API가 confirmationUrl을 반환하는지

- 상태: 검증 완료
- 코드 근거: `apps/api/src/modules/billing/billing.service.ts`
- 테스트 근거: `apps/api/test/billing.spec.ts` (`confirmationUrl` 포함 여부 검증)

---

끝.

## 에이전트 프롬프트 템플릿

- 문서 범위: "확인 불가(가정)" 항목의 검증/해소

```text
TASK
- docs/engineering/ultimate-guideline/06-assumptions-and-validation.ko.md에 있는
  ASSUMPTION 항목을 실제 API/가드/응답으로 검증하고 결과를 기록한다.

EXPECTED OUTCOME
- 가정별 상태(검증 완료/부분 확인/미해결)
- 미해결 시 임시 운영 정책과 후속 액션

MUST DO
- 검증 근거(엔드포인트 응답/코드 경로/로그)를 명시한다.
- 가정이 해소되면 관련 문서(로드맵/API/오케스트레이션) 동기화 항목을 남긴다.

MUST NOT DO
- 근거 없이 가정을 "확정"으로 바꾸지 않는다.
- 검증 실패를 숨기지 않는다.

CONTEXT
- API requirements: docs/engineering/ultimate-guideline/05-api-data-change-requirements.ko.md
- Phase plan: docs/engineering/ultimate-guideline/03-improvement-roadmap-phases.ko.md

VALIDATION
- ASSUMPTION 1~4 각각에 대해 증거 기반 결론을 기록한다.
```
