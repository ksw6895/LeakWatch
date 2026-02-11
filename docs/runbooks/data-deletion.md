# Data Deletion Runbook (GDPR/삭제 요청)

## 0) 원칙
- org 단위 삭제는 되돌릴 수 없음
- 삭제 요청 티켓에는 orgId, shop domains, 요청자 신원 확인 포함

## 1) 절차
1) 요청자 신원 확인(Owner 권한 + 이메일 확인)
2) “삭제 범위” 확인:
   - 모든 문서 원본(R2)
   - extracted/normalized 데이터
   - findings/actions/reports
   - audit logs (ASSUMPTION: audit는 최소 메타만 남기거나 함께 삭제 정책 선택)
3) 실행:
   - DB 트랜잭션으로 주요 테이블 delete(참조 무결성 고려)
   - R2 prefix(org/{orgId}/) 전체 삭제
4) 검증:
   - orgId로 조회 시 404
   - R2 list prefix 결과 0
5) 완료 통지

## 2) 대안(부분 삭제)
- 특정 shop만 삭제: shopId 기준 동일 절차
- 특정 document만 삭제: documentId 기준 delete + R2 key delete
