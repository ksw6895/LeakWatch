# Cost Guardrails Runbook (LLM/스토리지/메일 비용 통제)

## 1) 기본 제한(서버 강제)
- 업로드:
  - 20MB/file
  - 20 pages/pdf
  - 월 업로드 제한: plan별(/docs/PRICING...)
- LLM:
  - 문서당 normalize 1회 + repair 1회(최대 2회)
  - evidence line selection 단계로 긴 문서 요약 후 normalize
  - 캐시: sha256(text) 기준 30일
- 이메일:
  - org/day 50
  - plan별 월 발송 제한

## 2) 비용 경보
- usage_counters에서 org/day openai_tokens_out > threshold → 알림 + 추가 처리 차단(soft)
- 스토리지 GB 급증 → 오래된 원본 정리(보관정책)

## 3) 최적화 체크리스트
- normalize 모델을 mini로 유지
- 이메일 생성은 사용자가 버튼을 눌렀을 때만(자동 생성 금지)
- 월간 리포트는 저장된 snapshot 사용
