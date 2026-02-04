# PRD: AI기반 초도발주 자동화 도구개발

## 1. Product Overview

| 항목 | 내용 |
|------|------|
| 제품명 | Initial Order Simulator |
| 버전 | v1.0 |
| 목적 | 전 시즌(25S) 판매 데이터를 분석하여 차시즌(26S) 초도 발주를 최적화 |
| 사용자 | 패션 리테일 MD(머천다이저), 팀장급 의사결정자 |
| 기술 스택 | React + Vite + TailwindCSS, Python(Pandas/Matplotlib), FastAPI, Claude API |
| GitHub | https://github.com/Judyjieunb/OrderAI |
| 개발 방식 | Vibe Coding (Claude Code 활용) |
| 개발 범위 | 1인 개발 — 로직 설계, UI/UX 화면 설계, 프론트엔드/백엔드 코드 개발, 배포까지 전 과정 수행 |
| 협업 | 유사 스타일 매핑 ML 모델(Step 3)은 머신러닝 전공 엔지니어와 협업 |

## 2. Problem Statement

패션 리테일에서 초도 발주는 시즌 수익성을 좌우하는 핵심 의사결정이다.
기존 프로세스는 담당자의 경험과 감에 의존하며, 다음 문제가 반복된다:

- 전 시즌 실적 분석이 수작업(Excel)으로 이루어져 시간 소요가 크고 일관성이 없음
- 카테고리/아이템별 효율 진단 없이 전년 대비 ±% 방식으로 예산을 배분
- 스타일별 판매 추이와 기회비용(재고 소진 후 놓친 매출)을 정량화하지 못함
- 유사 스타일 매핑이 주관적이며, 발주 수량 산출에 체계적으로 활용되지 않음

## 3. Solution

6단계 워크플로우로 구성된 AI 기반 초도 발주 시뮬레이터를 구축한다.
Python 분석 파이프라인이 데이터를 처리하고, React 대시보드에서 시각화와 의사결정을 지원하며,
Claude API가 예산 배분 전략을 제안한다.

## 4. User Flow

```
Step 0: KPI/기준 설정
    ↓
Step 1: 시즌 마감 분석 → AI 예산 제안 → 예산 확정
    ↓
Step 2: 스타일별 판매 추이 분석 (기회비용 점검)
    ↓
Step 3: 유사 스타일 매핑 확인/확정
    ↓
Step 4: AI 발주 추천 수량 검토
    ↓
Step 5: 사이즈 아소트 최적화 → 최종 발주 수량 산출
```

## 5. Feature Specification

### Step 0: KPI + Index Setup `개발예정`

| 항목 | 내용 |
|------|------|
| 목적 | 브랜드별 목표 판매율 기준과 핵심 성과지표(KPI) 설정 |
| 주요 기능 | 등급 기준(S/A/B/C/D) 커스텀 설정, 목표 판매율 임계치 조정, KPI 가중치 설정 |
| 현재 상태 | 등급 기준은 main.py에 하드코딩(75%/65%/55%/40%) |

---

### Step 1: Budget Setup `개발완료`

| 항목 | 내용 |
|------|------|
| 목적 | 전 시즌 마감 분석 + AI 기반 차시즌 예산 수립 |
| 담당 | 팀장급 의사결정자 |

#### Step 1-A: 시즌 마감 대시보드

| 기능 | 설명 | 상태 |
|------|------|------|
| KPI 카드 | 총입고, 총판매, 판매율, 재고리스크 4개 지표 | `개발완료` |
| 복종 밸런스 분석 | 물량비중 vs 판매비중 Grouped Bar Chart + 비중차이(±%p) 판정 | `개발완료` |
| BCG 매트릭스 | 아이템별 Scatter Chart (X: 물량비중, Y: 판매율, 버블: 판매비중) | `개발완료` |
| 등급 분포 | S/A/B/C/D 스타일 수 Bar Chart | `개발완료` |
| AI 종합 코멘트 | 시즌 실적 요약 텍스트 | `개발완료` |

#### Step 1-B: AI 예산 컨트롤 (모달)

| 기능 | 설명 | 상태 |
|------|------|------|
| AI 목표매출 제안 | Claude/GPT API가 전 시즌 실적 기반으로 차시즌 목표매출 + 카테고리 비중 제안 | `개발완료` |
| 목표매출 조정 | 억원 단위 직접 입력 또는 성장률(%) 입력 (양방향 연동) | `개발완료` |
| 카테고리 비중/판매율 조정 | 카테고리별 비중(%), 목표 판매율(%) 입력 → 발주예산 실시간 계산 | `개발완료` |
| 예산 확정 | budget_config.json 저장 → Step 4 발주 추천 시 예산 천장으로 적용 | `개발완료` |
| Rule-based Fallback | API 키 없을 때 판매율 기반 규칙으로 자동 제안 | `개발완료` |

**핵심 계산식:**
```
카테고리 매출목표 = 총 목표매출 × 비중(%)
발주예산(금액) = 매출목표 ÷ 목표판매율(%)
발주예산(수량) = 발주예산(금액) ÷ 평균단가
```

---

### Step 2: Case Study `개발완료`

| 항목 | 내용 |
|------|------|
| 목적 | 전 시즌 스타일별 주차 판매 추이 분석, 기회비용 점검 |
| 담당 | 담당자급 |

| 기능 | 설명 | 상태 |
|------|------|------|
| 듀얼 레이아웃 | 좌측(Success: Hit/Normal) vs 우측(Failure: Early Shortage/Shortage/Risk) | `개발완료` |
| 시계열 차트 | 재고 Area + 주간판매 Bar + 잠재판매 Line(점선) + 재발주 마커 + 재고소진일 기준선 | `개발완료` |
| 컬러별 필터 | 전체/Color1/Color2... 탭 전환 | `개발완료` |
| 누적 통계 | 누적판매, 누적입고, 최종판매율, AI 진단 | `개발완료` |
| 기회비용 카드 | 놓친 판매수량 × 판매단가 = 추정 손실금액 | `개발완료` |

**AI 진단 분류:**
| 카테고리 | 기준 |
|----------|------|
| Hit | 판매율 70%+ & 재발주 이력 있음 |
| Normal | 판매율 40~70% & 정상 소진 |
| Early Shortage | 시즌 초반(8주 이내) 재고 소진 |
| Shortage | 시즌 중반 이후 재고 소진 |
| Risk | 판매율 40% 미만 & 과잉 재고 |

**AI 수요 예측 모델 (적응형 감쇠):**
```
감쇠율 r = (10 / P_avg) ^ (1/W)
  P_avg = 최근 4주 평균 판매속도
  W = 잔여 주수
  10 = 시즌 말 목표 잔여재고
잠재판매 = 실판매 + max(0, 예측판매 - 실판매)
기회비용 = 잠재판매 - 실판매
```

---

### Step 3: Style-mapping `개발예정`

| 항목 | 내용 |
|------|------|
| 목적 | 과거 스타일 ↔ 신규 스타일 유사도 매핑 확인 및 확정 |
| 담당 | 담당자급 |

| 기능 | 설명 | 상태 |
|------|------|------|
| 유사도 매핑 테이블 | 25S 스타일 → 26S 신규 스타일 매핑 결과 표시 | `개발예정` |
| 수동 매핑 수정 | 담당자가 매핑을 수정/확정 | `개발예정` |
| 매핑 확정 | 확정된 매핑이 Step 4 발주 추천에 반영 | `개발예정` |

**백엔드 로직 (step0_integration.py 존재):**
- 속성 기반 유사도: 카테고리, 성별, 시즌 하드필터 + 동적 가중치 스코어링
- Phase 2(이미지 기반) 확장 예정

---

### Step 4: Order Suggest `개발예정`

| 항목 | 내용 |
|------|------|
| 목적 | AI 수요 예측과 예산 한도를 반영한 스타일별 발주 추천 수량 검토 |
| 담당 | 담당자급 |

| 기능 | 설명 | 상태 |
|------|------|------|
| 발주 추천 테이블 | 스타일별 추천 발주수량 + 근거(유사스타일 실적, 기회비용) | `개발예정` |
| 예산 천장 스케일링 | 카테고리 합계가 예산 초과 시 비례 축소 | `개발예정` |
| 수동 조정 | 담당자가 수량 수정 가능 | `개발예정` |

**백엔드 로직 (step4_integration.py 완료):**
- 유사스타일 매핑 기반 발주수량 산출
- budget_config.json의 카테고리별 예산 천장 적용
- 초과 시 카테고리 내 비례 스케일링
- 출력: 26S_Order_Recommendation.xlsx / .json

---

### Step 5: Size-Assortment `개발완료`

| 항목 | 내용 |
|------|------|
| 목적 | 컬러별 사이즈 아소트 최적화 → 최종 사이즈별 발주 수량 산출 |
| 담당 | 담당자급 |

| 기능 | 설명 | 상태 |
|------|------|------|
| 필터 패널 | 카테고리/서브카테고리/컬러레인지 3단 필터 | `개발완료` |
| 사이즈 분포 차트 | 사이즈별 판매수량 Bar Chart (주력 사이즈 하이라이트) | `개발완료` |
| 상세 테이블 | 사이즈(mm), 판매수량, 비중(%), 비고(주력 여부) | `개발완료` |
| 시뮬레이션 모드 | 5mm↔10mm 단위 전환, 타겟 범위(min~max) 설정 | `개발완료` |
| 미러링 로직 | 5mm → 10mm 변환 시 참조 분포 기반 보간 | `개발완료` |
| 컬러 그룹핑 모달 | 컬러코드 ↔ 컬러그룹 매핑 테이블 | `개발완료` |

---

## 6. System Architecture

### 데이터 흐름

```
STEP 1 (팀장급 의사결정)
sql_result_raw.xlsx ─→ main.py ─→ 25S_Analysis_Result.xlsx
                                 └─→ season_closing_data.json ─→ SeasonClosing.jsx
                                                                      │
                                      [AI 예산 제안] ←─ server/api.py ←┘
                                            ▼
                                      budget_config.json (카테고리별 천장)
                                            │
STEP 2~4 (담당자급)                          ▼
weekly_dx25s.xlsx ─→ weekly_analysis.py ─→ dashboard_data.json ─→ Dashboard.jsx
                            │
                            └─→ ai_sales_loss_v2.py ─→ Updates Excel & JSON
                                                            │
similarity_mapping.csv ─→ step4_integration.py ─→ 26S_Order_Recommendation.*
                          (예산 천장 자동 스케일링)
```

### 기술 구성

| 레이어 | 기술 | 역할 |
|--------|------|------|
| Frontend | React 18 + Vite + TailwindCSS | SPA 대시보드 |
| Charts | Recharts | 시계열/바/스캐터 차트 |
| Icons | Lucide React | UI 아이콘 |
| Backend | FastAPI (Python) | AI 예산 프록시 API |
| AI | Claude API / GPT-4o | 예산 전략 제안 |
| Analysis | Python (Pandas, Matplotlib, OpenPyXL) | 4단계 분석 파이프라인 |
| Deploy | Vercel (프론트엔드) | 자동 배포 |

### API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/budget-proposal` | AI 목표매출/카테고리 비중 제안 |
| POST | `/api/budget-config` | 확정된 예산 저장 (budget_config.json) |
| GET | `/api/health` | 헬스체크 |

## 7. Development Status

| Step | 기능 | Frontend | Backend/Pipeline | 상태 |
|------|------|----------|------------------|------|
| 0 | KPI + Index Setup | - | - | `개발예정` |
| 1 | Budget Setup | SeasonClosing + BudgetControl | main.py + api.py | `개발완료` |
| 2 | Case Study | Dashboard | weekly_analysis.py + ai_sales_loss_v2.py | `개발완료` |
| 3 | Style-mapping | - | step0_integration.py (부분) | `개발예정` |
| 4 | Order Suggest | - | step4_integration.py | `개발예정` (프론트엔드) |
| 5 | Size-Assortment | SizeAssortment | - | `개발완료` |

**전체 진행률: 4/6 Steps 완료 (67%)**

## 8. Key Metrics & Success Criteria

| 지표 | 설명 |
|------|------|
| 분석 자동화율 | 시즌 마감 분석 수작업 → 원클릭 자동화 (STEP 1~3) |
| 기회비용 가시화 | 재고 소진 후 놓친 매출을 정량적으로 산출 |
| 예산 배분 합리성 | AI 제안 기반 카테고리별 예산 배분 (감 → 데이터) |
| 발주 정확도 | 유사스타일 실적 + AI 수요 예측 기반 발주 수량 산출 |
| 사이즈 최적화 | 판매 데이터 기반 사이즈 아소트 → 사이즈 미스매치 감소 |
