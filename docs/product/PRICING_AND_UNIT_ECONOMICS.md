# 가격/패키징/단위경제

## 0) 전제(가정)

- LeakWatch의 핵심 가치는 “절감액 + 시간절약 + 분쟁 스트레스 감소”
- Shopify 스토어 앱 15개 이상이면 월 구독($49~$149) WTP가 존재(가정)
- OpenAI 비용은 모델/프롬프트/문서량에 따라 변동 → 단가를 변수로 둔다

검증 방법:

- 인터뷰 15명 + 실제 인보이스 30개로 월 앱/툴 지출 분포 측정
- “절감 후보 1개 이상”을 첫 세션에 보여줬을 때 결제 전환율 비교

---

## 1) 가격 벤치마크 표(경쟁/대안 10개 이상)

주의: 아래 가격은 “문서 작성 시점 가정값”이며, 반드시 각 URL에서 최신 확인 필요.
검증 방법: 아래 출처 URL을 열어 플랜/가격을 업데이트하고, 변경 시 이 문서의 가격 범위를 조정한다.

| 제품/대안                         | 카테고리                  |                        가격(가정) | 주요 제한(가정)                   | 출처                                             |
| --------------------------------- | ------------------------- | --------------------------------: | --------------------------------- | ------------------------------------------------ |
| AppTrim                           | Shopify app spend insight |                       $5 one-time | 인사이트 중심                     | https://apps.shopify.com/apptrim                 |
| CostRadar – AI Profit Tracker     | Profit analytics          | Free / $9.95 / $24.95 / $99.95 월 | 손익/대시보드 중심                | (Shopify App Store 검색)                         |
| SimplyCost – Profit Analytics     | Profit analytics          |        $9.99 / $19.99 / $29.99 월 | 원가/배송비 이슈 리뷰             | https://apps.shopify.com/simplycost              |
| Profit Panel                      | Profit analytics          |        $1.99 / $14.99 / $29.99 월 | 대시보드 중심                     | https://apps.shopify.com/profit-panel            |
| BeProfit                          | Profit analytics          |           $150/월 체감 언급(가정) | 광고비/귀속 커버리지              | https://apps.shopify.com/beprofit-profit-tracker |
| Lifetimely                        | LTV/Profit analytics      |                 $20~$200/월(가정) | 고급 분석은 상위 플랜             | (Shopify App Store 검색)                         |
| TrueProfit                        | Profit analytics          |                 $20~$100/월(가정) | 비용/광고 포함                    | (Shopify App Store 검색)                         |
| QuickBooks Online                 | Accounting SaaS           |                 $30~$200/월(가정) | 회계 중심, 앱 누수 탐지/실행 없음 | https://quickbooks.intuit.com/                   |
| Xero                              | Accounting SaaS           |                  $15~$78/월(가정) | 회계 중심                         | https://www.xero.com/                            |
| 카드/은행 구독관리(예: 은행 알림) | 대안 워크어라운드         |                              무료 | 맥락/증빙/실행 자동화 없음        | (은행 기능)                                      |
| 북키퍼/회계사                     | 서비스                    |              $200~$1000+/월(가정) | 리드타임/ROI 분석 한계            | (시장 일반)                                      |

※ Shopify App Store “검색” 항목은 실제 앱명을 확정하고 URL을 기록해야 한다.

- 대안: /docs/steps/archive/step-11-billing-and-plans.md 에 “가격 리서치 작업”을 릴리즈 체크리스트로 포함한다(문서만으로도 실행 가능).

---

## 2) 추천 가격 전략 2안

### 안 A: 침투(Penetration) — 빠른 설치/확산 목표

- Free: 업로드 3건/월, leak 3개, 이메일 생성만(발송 불가), 리포트 1회
- Starter: $49/월 — 업로드 50건, leak 무제한, 이메일 발송 10회, 주간 리포트
- Pro: $99/월 — 업로드 200건, 이메일 발송 50회, 에이전시/멀티 스토어 3개

장점:

- AppTrim 같은 저가 인사이트 대비 “실행(메일/증빙/추적)” 차별로 업셀 가능
  단점:
- LLM 원가가 높아지면 마진 압박 → 엄격한 사용량 제한 필요

### 안 B: 프리미엄(Premium) — “절감액 기반” 포지셔닝

- Starter: $79/월 — 업로드 50건, 이메일 발송 25회, 월간 리포트
- Pro: $149/월 — 업로드 200건, 이메일 발송 200회, 에이전시 기능 일부 포함
- Agency: $299/월 — 스토어 10개, 리포트 자동화, 클라이언트 PDF export

장점:

- 절감액이 큰 ICP(앱 25~40개)에서 단위경제 안정
  단점:
- 초기 전환 장벽

MVP 권장: 안 A로 시작하되 Pro를 “절감액 5배 이상” 메시지로 판매.

---

## 3) 추천 패키징(3 플랜) + 기능표 + 유료전환 트리거

### 플랜 정의(최종 단일안)

- FREE: $0
- STARTER: $49/월
- PRO: $99/월
- (AGENCY는 V1.5에서 추가 가능하나, 여기서는 PRO에 멀티샵 3개 포함으로 시작)

유료전환 트리거(“돈 내게 만드는 순간”):

- T1: LeakFinding에서 “중복 결제/해지 후 과금”이 발견되어 Refund Email을 발송하려 할 때 → STARTER 이상 필요
- T2: 월간 리포트 자동 이메일 수신을 켜려 할 때 → STARTER 이상
- T3: 스토어 2개 이상 묶어 보고서를 만들려 할 때 → PRO 필요
- T4: 업로드 건수/LLM 처리량 제한 초과 → 업그레이드 필요

기능표:

| 기능                         |  FREE | STARTER($49) | PRO($99) |
| ---------------------------- | ----: | -----------: | -------: |
| Shopify 연결(임베디드)       |     ✓ |            ✓ |        ✓ |
| 문서 업로드/처리(월)         |     3 |           50 |      200 |
| PDF/CSV/이미지 지원          |     ✓ |            ✓ |        ✓ |
| 정규화(JSON) + 스키마 검증   |     ✓ |            ✓ |        ✓ |
| 누수 탐지 5종 + 근거         | 3개만 |       무제한 |   무제한 |
| 대시보드/리포트              |  제한 |            ✓ |        ✓ |
| 이메일 초안 생성             |     ✓ |            ✓ |        ✓ |
| 이메일 발송(Mailgun)         |     ✗ |      10회/월 |  50회/월 |
| 증빙 패키지 생성             |     ✗ |            ✓ |        ✓ |
| 멀티 스토어(Org에 Shop 연결) |     1 |            1 |        3 |
| 에이전시 리포트 템플릿       |     ✗ |            ✗ |  ✓(기본) |
| 감사로그/권한                |  기본 |            ✓ |        ✓ |

---

## 4) 단위경제(Unit Economics) — 3 시나리오

### 4.1 비용 변수 정의

- 문서 1건당 평균 입력 토큰: Tin (텍스트 추출 후)
- 문서 1건당 평균 출력 토큰: Tout (정규화 JSON + 요약)
- 이메일 1건당 입력/출력 토큰: Ein/Eout
- 모델 단가(1M tokens당):
  - Cin_in, Cin_out: normalize 모델 입력/출력 단가
  - Cwr_in, Cwr_out: write 모델(이메일) 입력/출력 단가

OpenAI 비용(월):

- NormalizeCost = Docs _ (Tin/1e6 _ Cin_in + Tout/1e6 \* Cin_out)
- EmailCost = Emails _ (Ein/1e6 _ Cwr_in + Eout/1e6 \* Cwr_out)

추가 비용:

- R2 storage: StorageGB \* R2_GB_PRICE
- R2 operations: PUT/GET 비용(낮음)
- Mailgun: Emails \* mailgun_unit_cost + 기본 요금
- Infra: Fly + DB + Redis

### 4.2 시나리오(가정값)

ASSUMPTION(초기 산정):

- Tin=8,000 tokens, Tout=1,500 tokens (문서 1건)
- Ein=1,200 tokens, Eout=800 tokens (이메일 1건)
- 모델 단가 예시(가정):
  - Cin_in=$0.15 / 1M, Cin_out=$0.60 / 1M (mini급)
  - Cwr_in=$2.50 / 1M, Cwr_out=$10.00 / 1M (고급 생성)
- Mailgun 단가: $0.001/email (가정)
- Infra(고정): $120/월 (Fly + DB + Redis 최소) (가정)
- Storage: 평균 고객당 0.2GB (가정)

시나리오 표(고객 1명 기준, 월):

- Low: Docs=10, Emails=5
- Mid: Docs=50, Emails=20
- High: Docs=200, Emails=50

계산(예시):

- Low NormalizeCost:
  - 10 * (8000/1e6*0.15 + 1500/1e6\*0.60)
  - 10 \* (0.0012 + 0.0009) ≈ $0.021
- Low EmailCost:
  - 5 * (1200/1e6*2.50 + 800/1e6\*10.00)
  - 5 \* (0.0030 + 0.0080) = $0.055
- LLM total ≈ $0.076

- Mid NormalizeCost:
  - 50 \* (0.0021) = $0.105
- Mid EmailCost:
  - 20 \* (0.011) = $0.22
- LLM total ≈ $0.325

- High NormalizeCost:
  - 200 \* (0.0021) = $0.42
- High EmailCost:
  - 50 \* (0.011) = $0.55
- LLM total ≈ $0.97

(위 숫자는 단가/토큰 가정에 매우 민감)

### 4.3 결론(권장 최소 가격)

- LLM 원가는 “고객당 월 <$1~$5 수준”으로 통제 가능(캐시/요약/mini 모델 우선)이라는 가정 하에,
- 가장 큰 비용은 고정 인프라/지원/마케팅이므로,
- **STARTER $49 / PRO $99**는 충분히 마진을 확보할 수 있는 범위로 가정한다.
  검증 방법:
- 실제 문서 30개로 Tin/Tout 측정, 실제 모델 단가로 재계산
- 고객당 월 평균 업로드/이메일 발송량을 analytics로 추적 후 제한치 튜닝
