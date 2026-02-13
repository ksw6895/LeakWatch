## 6) “확인 불가(가정)” 목록 + 검증 방법

이 문서는 레포 코드/문서를 근거로 작성했지만, 다음은 환경/응답 스키마에 따라 달라질 수 있다.

1. ASSUMPTION: `/v1/action-requests` 응답이 displayStatus/latestRunStatus를 제공하는지

- 검증: 로컬/스테이징에서 API 호출, 실제 JSON 확인
- 대안: 프론트에서 requestStatus + latestRunStatus를 합성(단, latestRunStatus를 가져올 수 있어야 함)

2. ASSUMPTION: 에러 응답이 `{ errorCode, message }` 형태인지

- 검증: 의도적으로 실패 케이스 발생(큰 파일, 미지원 mime) 후 응답 확인
- 대안: 에러 메시지 문자열만으로 우선 표시, 다음 단계에서 API 표준화

3. ASSUMPTION: AGENCY_ADMIN write 권한 범위(특히 approve/send)

- 검증: API guard 및 보안 정책 문서(SECURITY_PRIVACY) 최신 합의
- 대안: 프론트는 보수적으로 read-only로 두고, 정책 확정 후 확장

4. ASSUMPTION: Shopify Billing subscribe API가 confirmationUrl을 반환하는지

- 검증: `/v1/billing/subscribe` 응답 확인
- 대안: API가 302 redirect를 직접 반환하는 방식이면, 프론트는 fetch 대신 window.location로 이동하는 방식으로 조정

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
