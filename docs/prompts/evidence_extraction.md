# Prompt Template: Evidence Line Selection (for long documents)

목표: 너무 긴 텍스트에서 “청구 금액/기간/플랜” 관련 라인만 추려 LLM 비용을 줄인다.

SYSTEM:
Select only invoice-relevant lines from the text. Keep line numbers.
Do not rewrite lines; copy exact lines. Return JSON only.

USER:
Text with line numbers:
{{LONG_TEXT_WITH_LINE_NUMBERS}}

Return JSON:
{
  "selectedLines": [
    { "line": 12, "text": "..." },
    ...
  ],
  "reason": "..."
}
