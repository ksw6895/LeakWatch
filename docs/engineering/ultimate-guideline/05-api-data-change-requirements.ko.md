## 5) API/데이터 변경 요구사항 명세(UX 개선에 필요한 것만, 최소화)

아래는 “프론트 UX를 완성”하기 위해 필요한 최소 API 요구사항이다. 이미 존재하면 “확인 후 재사용”하고, 없다면 추가한다.

### 5.1 Shop Settings (US-03) — 필수(Phase 1)

- GET `/v1/shops/:shopId/settings`
  - response: { currency: string, timezone: string, contactEmail: string }
- PATCH `/v1/shops/:shopId/settings`
  - body: { currency, timezone, contactEmail }
  - response: 동일
- RBAC:
  - read: OWNER/MEMBER/VIEWER/AGENCY_VIEWER (정책 확정)
  - write: OWNER only (권장, 보안 문서 기준)
- 이벤트:
  - `settings.updated { shopId, fieldsChanged[] }`

### 5.2 Documents download (Explainability) — 권장(Phase 1)

- GET `/v1/documents/:documentId/versions/:versionId/download`
  - response: { url: string, expiresAt: ISO }
- 보안:
  - tenant scope 강제(orgId/shopId)
  - presigned TTL 짧게(5분)
- UI:
  - Document detail / Evidence에서 사용

### 5.3 Action manual status update (US-43) — Phase 1

- POST `/v1/action-requests/:id/status`
  - body: { status: "WAITING_REPLY" | "RESOLVED" }
  - response: updated action
- 감사로그:
  - `action.status_updated { actionRequestId, from, to }`

### 5.4 Event ingest endpoint — Phase 0(선택) / Phase 1(권장)

- POST `/v1/events`
  - body: { name: string, properties?: json, occurredAt?: ISO }
  - server inject: orgId, shopId, userId from auth context
- 실패 시: 200/201로 무시 가능(분석이 UX를 방해하면 안 됨)

---

## 에이전트 프롬프트 템플릿

- 문서 범위: UX 개선에 필요한 최소 API/데이터 변경 요구사항

```text
TASK
- docs/engineering/ultimate-guideline/05-api-data-change-requirements.ko.md 기준으로
  현재 구현과의 계약 갭(API/응답 스키마/RBAC)을 식별하고 반영 계획을 제시한다.

EXPECTED OUTCOME
- 엔드포인트별 상태(이미 존재/수정 필요/신규)
- 프론트 영향 파일과 서버 영향 파일 매핑

MUST DO
- OpenAPI와 실제 구현 간 차이를 명시한다.
- tenant scope, RBAC, presigned TTL 같은 보안 제약을 유지한다.
- 이벤트 수집은 UX 비차단(no-op 가능) 원칙을 명시한다.

MUST NOT DO
- API 계약을 바꾸면서 문서를 미업데이트 상태로 두지 않는다.
- 권한 정책을 프론트 임의 판단으로 확정하지 않는다.

CONTEXT
- API spec: docs/api/OPENAPI.yaml, docs/api/ERROR_CODES.md
- Security: docs/operations/SECURITY_PRIVACY.md

VALIDATION
- 변경/신규 엔드포인트마다 요청/응답/권한 테스트 포인트를 남긴다.
```
