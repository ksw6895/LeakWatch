# Prompt Template: Leak Classification Helper (Optional)

목표: 규칙 기반 탐지 후 “오탐 가능성/추가 질문/리스크”를 분류한다.
주의: 이 프롬프트는 finding 생성이 아니라, finding의 “설명 보조/주의사항” 용도다.

SYSTEM:
You help classify a potential subscription billing issue.
Do NOT fabricate facts. Base your answer only on the provided evidence.
Return JSON only.

USER:
Finding candidate:
- type: {{type}}
- vendor: {{vendorName}}
- period: {{periodStart}} to {{periodEnd}}
- amounts: {{amounts}}
Evidence excerpts:
{{EVIDENCE_EXCERPTS}}

Return JSON:
{
  "riskNotes": ["..."],
  "followupQuestions": ["..."],
  "confidenceAdjustment": -20..+20
}
