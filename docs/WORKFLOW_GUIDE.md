# OrderAI 시스템 워크플로우 가이드

## 시스템 개요

OrderAI는 패션 리테일 분석 프로젝트로, 25S 시즌 판매 데이터를 분석하여 26S 시즌 발주를 최적화합니다.

### 주요 기능
- 판매율, 재고 밸런스, 기회비용 분석
- BCG 매트릭스를 활용한 아이템 효율성 분류
- AI 기반 수요 예측 (목표 지향적 감쇄 모델)
- 물리적 재고 소진 및 "상업적 재고 소진" (사이즈 불균형으로 인한 품절 효과) 감지
- AI 예산 컨트롤: Claude API가 카테고리별 예산을 제안하고, 이를 발주 추천의 천장으로 적용

### 사용자 역할 구분
- **팀장급**: STEP 0~1 (KPI 설정, 예산 확정)
- **담당자급**: STEP 2~5 (케이스 스터디, 스타일 매핑, 발주 추천, 사이즈 배분)

---

## 워크플로우 다이어그램

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      OrderAI 시스템 워크플로우                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [팀장급 의사결정]                                                          │
│                                                                            │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │ 시즌 데이터  │ ──→ │   STEP 1    │ ──→ │  예산 확정   │                   │
│  │ (Excel)     │     │  시즌마감분석 │     │ (Modal)     │                   │
│  └─────────────┘     └─────────────┘     └──────┬──────┘                   │
│                                                  │                         │
│                                                  ▼                         │
│  [담당자급 실행]                          budget_config.json                 │
│                                                  │                         │
│  ┌─────────────┐     ┌─────────────┐            │                         │
│  │ 주간 데이터  │ ──→ │   STEP 2    │            │                         │
│  │ (Excel)     │     │ 시계열분석   │            │                         │
│  └─────────────┘     └──────┬──────┘            │                         │
│                             │                    │                         │
│                             ▼                    │                         │
│                      ┌─────────────┐            │                         │
│                      │   STEP 3    │            │                         │
│                      │  AI수요예측  │            │                         │
│                      └──────┬──────┘            │                         │
│                             │                    │                         │
│                             ▼                    ▼                         │
│  ┌─────────────┐     ┌─────────────────────────────┐                      │
│  │ 유사스타일   │ ──→ │         STEP 4              │                      │
│  │ 매핑 (CSV)  │     │ 발주추천 (예산천장 적용)      │                      │
│  └─────────────┘     └──────────────┬──────────────┘                      │
│                                      │                                     │
│                                      ▼                                     │
│                              ┌─────────────┐                               │
│                              │   STEP 5    │                               │
│                              │ 사이즈배분   │                               │
│                              └─────────────┘                               │
│                                      │                                     │
│                                      ▼                                     │
│                              📦 26S 발주서                                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 단계별 상세 가이드

### STEP 0: KPI + Index 설정 ✅ 구현됨

| 구분 | 내용 |
|------|------|
| **역할** | 팀장급 |
| **INPUT** | 브랜드 설정 (시즌, 목표, 기준) |
| **PROCESS** | KPI 목표 및 성과 지표 설정, 등급 기준 정의 |
| **OUTPUT** | 설정 저장 (localStorage) → STEP 1~5 전체에 적용 |

**USER ACTION:**
1. 브랜드 선택 (MLB, Discovery, Duvetica, MLB Kids, Sergio Tacchini)
2. 시즌 설정 (Base: 25S → Target: 26S, SS/FW 구분)
3. 등급 기준 프리셋 선택:
   - Conservative: S(80), A(70), B(60), C(50)
   - Standard: S(75), A(65), B(55), C(40) [기본값]
   - Aggressive: S(70), A(60), B(50), C(35)
   - Custom: 직접 입력
4. 추가 KPI 설정 (목표 판매율, 상업적 결품 기준, 조기 결품 일자 등)

---

### STEP 1: 예산 설정 (Budget Setup) ✅ 구현됨

| 구분 | 내용 |
|------|------|
| **역할** | 팀장급 |
| **INPUT** | `data/sql_result_raw.xlsx` (ORDER_QTY, IN_QTY, SALE_QTY, CLASS2, ITEM_NM, STYLE_CD) |
| **PROCESS** | 4-Level 분석 (총계→카테고리→아이템→스타일), BCG 매트릭스, 등급 산정 |
| **OUTPUT** | `output/25S_Analysis_Result.xlsx`, `public/season_closing_data.json`, `output/budget_config.json` |

**등급 기준:**
- S: 75%+ | A: 65%+ | B: 55%+ | C: 40%+ | D: <40%

**USER ACTION:**
1. KPI 카드에서 입고/판매/판매율/재고리스크 확인
2. 복종 밸런스 차트로 확대/축소 필요 카테고리 파악
3. BCG 매트릭스로 아이템 효율성 분석
4. "AI 예산 제안" 버튼 클릭 → 예산 모달 열기
5. AI 제안 수신 후 목표 매출/성장률 조정
6. 카테고리별 비중(%) 및 목표 판매율(%) 편집
7. "Budget Ceiling 확정" 클릭 → `budget_config.json` 저장

---

### STEP 2: 케이스 스터디 (Case Study) ✅ 구현됨

| 구분 | 내용 |
|------|------|
| **역할** | 담당자급 |
| **INPUT** | `data/weekly_dx25s.xlsx` (주차별 판매/재고 데이터) |
| **PROCESS** | 시계열 패턴 분석, 리오더 이벤트 감지, AI 진단 분류 |
| **OUTPUT** | `output/25S_TimeSeries_Analysis_Result.xlsx`, `public/dashboard_data.json` |

**AI 진단 분류:**
- 🟢 Hit (적기 소진): 결품 ≥ 7/30 또는 최종 STR ≥ 80%
- ⚪ Normal: 55% ≤ STR < 80%
- 🚨 Early Shortage: 결품 ≤ 5/30 (조기 소진)
- ⚠️ Shortage: 5/30 < 결품 < 7/30
- 🔴 Risk: STR < 55%

**USER ACTION:**
1. 진단 유형 필터 선택 (Hit/Normal/Early Shortage/Shortage/Risk)
2. 스타일 선택하여 시계열 차트 확인
3. 성공 사례와 실패 사례 비교 분석
4. 기회손실 영역(빨간 점선) 확인
5. AI 패턴 진단 코멘트로 원인 파악

---

### STEP 3: 스타일 매핑 (Style-mapping) (예정)

| 구분 | 내용 |
|------|------|
| **역할** | 담당자급 |
| **INPUT** | `data/similarity_mapping.csv`, STEP 2/3 분석 결과 |
| **PROCESS** | AI 수요예측 (적응형 감쇄 모델), 유사 스타일 매핑 |
| **OUTPUT** | Excel 업데이트: AI계산_기회비용, AI제안_발주량 |

**AI 수요예측 공식:**
```
r = (10 / P_avg)^(1/W)
```
- P_avg: 결품 직전 4주 평균 판매 속도 (최소 5개)
- W: 결품시점 ~ 시즌종료(9/30) 잔여 주수
- 10/30 이후 예측 = 0 (시즌 종료 cutoff)
- AI제안 발주량 = ceil_10((총판매 + 기회비용) / 0.75)

**USER ACTION:**
1. (자동 실행 - 파이프라인 일부)
2. 유사 스타일 매핑 결과 검토
3. 매핑 정확도 확인 및 수정

---

### STEP 4: 발주 추천 (Order Suggest) (예정)

| 구분 | 내용 |
|------|------|
| **역할** | 담당자급 |
| **INPUT** | `data/similarity_mapping.csv`, `output/budget_config.json`, STEP 2/3 분석 결과 |
| **PROCESS** | Top-3 유사스타일 가중 평균, 신뢰도 분류, 예산 천장 비례 축소 |
| **OUTPUT** | `output/26S_Order_Recommendation.xlsx`, `output/26S_Order_Recommendation.json` |

**신뢰도 분류:**
- high: 유사도 ≥ 0.85 + 2개 이상 참조
- medium: 유사도 ≥ 0.70 + 1개 이상 참조
- low: 유사도 ≥ 0.50
- none: 참조 없음 → 추천 불가

**USER ACTION:**
1. 매핑 결과 검토
2. 발주 추천량 확인
3. 수동 조정 (필요 시)

---

### STEP 5: 사이즈 배분 (Size-Assortment) ✅ 구현됨

| 구분 | 내용 |
|------|------|
| **역할** | 담당자급 |
| **INPUT** | 카테고리/서브카테고리/컬러 필터, 판매 실적 데이터 |
| **PROCESS** | 사이즈별 판매 비중 분석, 5mm ↔ 10mm 변환, 범위 재정규화 |
| **OUTPUT** | 사이즈별 최적 배분율 (%), 발주 제안 가이드 테이블 |

**USER ACTION:**
1. 카테고리/서브카테고리/컬러범위 필터 선택
2. 시뮬레이션 모드 활성화 (선택적)
3. 사이즈 단위 선택 (5mm / 10mm)
4. 타겟 범위 설정 (최소~최대 사이즈)
5. 배분율 차트 및 테이블 확인
6. 컬러 그룹핑 참조 모달로 컬러 코드 확인

---

## Quick Reference

### 파이프라인 명령어

```bash
# 전체 파이프라인 실행 (권장)
cd scripts && python run_all.py

# 개별 단계 실행
python scripts/main.py              # STEP 1: 시즌 마감 분석
python scripts/weekly_analysis.py   # STEP 2: 시계열 분석
python scripts/ai_sales_loss_v2.py  # STEP 3: AI 수요예측
python scripts/step4_integration.py # STEP 4: 발주 추천

# 프론트엔드 실행
npm run dev   # 개발 서버 (port 3000)
npm run build # 프로덕션 빌드

# 백엔드 API (AI 예산 제안)
uvicorn server.api:app --port 8000 --reload
```

### 시작 전 체크리스트

1. [ ] `data/sql_result_raw.xlsx` 파일 준비
2. [ ] `data/weekly_dx25s.xlsx` 파일 준비
3. [ ] `data/similarity_mapping.csv` 파일 준비
4. [ ] `python run_all.py` 실행 완료
5. [ ] `npm run dev`로 대시보드 확인

### 주요 파일 경로

| 구분 | 경로 |
|------|------|
| **입력 데이터** | `data/` |
| **Python 스크립트** | `scripts/` |
| **출력 파일** | `output/` |
| **프론트엔드 데이터** | `public/*.json` |
| **React 컴포넌트** | `src/components/` |

### 트러블슈팅

**문제: "데이터가 없습니다" 메시지**
- 해결: `python scripts/main.py` 또는 `python scripts/run_all.py` 실행

**문제: AI 예산 제안이 작동하지 않음**
- 해결: `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY` 환경변수 설정 필요
- 대안: API 키 없이도 규칙 기반 제안이 자동 적용됨

**문제: 한글 폰트가 깨짐**
- 해결: `main.py`에서 폰트 설정 확인 (macOS: 'AppleGothic', Windows: 'Malgun Gothic')

---

## 전체 분석 프로세스 연결 맵

### 원천 데이터 (입력)

```
┌─────────────────────────────────┬──────────────────────────────────────────────┬──────────────────┐
│            파일                  │                  내용                         │      사용처       │
├─────────────────────────────────┼──────────────────────────────────────────────┼──────────────────┤
│ data/sql_result_raw.xlsx        │ 25S 시즌 마감 데이터 (스타일별 발주/판매/재고)    │ STEP 1           │
├─────────────────────────────────┼──────────────────────────────────────────────┼──────────────────┤
│ data/weekly_dx25s.xlsx          │ 주차별 시계열 (스타일×컬러×주차)                 │ STEP 1, 2, 3     │
├─────────────────────────────────┼──────────────────────────────────────────────┼──────────────────┤
│ data/similarity_mapping.csv     │ ML 유사스타일 매핑 (25S↔26S, 유사도 점수)        │ STEP 4           │
└─────────────────────────────────┴──────────────────────────────────────────────┴──────────────────┘
```

---

### STEP 1 → main.py (시즌 마감 분석)

```
data/sql_result_raw.xlsx
data/weekly_dx25s.xlsx   ← TAG_PRICE 추출용
  │
  ▼
main.py
  ├─ Level 1: 전체 시즌 건강도 (판매율, 재고리스크)
  ├─ Level 2: 복종별 밸런스 (물량비중 vs 판매비중, ±5%p 기준)
  ├─ Level 3: 아이템 BCG 매트릭스 (Star/Cash Cow/Problem Child/Question Mark)
  └─ Level 4: 스타일 등급 (S≥75% / A≥65% / B≥55% / C≥40% / D<40%)
  │
  ├──→ output/25S_Analysis_Result.xlsx       ← 오프라인 보고서 (4시트+차트)
  └──→ public/season_closing_data.json       ← 프론트엔드 데이터
```

**season_closing_data.json 소비처:**
- `SeasonClosing.jsx` (Step 1탭) — KPI 카드, 복종 밸런스 바, BCG 스캐터, 등급분포
- `server/api.py` — AI 예산 제안 시 LLM 프롬프트 컨텍스트로 전달

---

### STEP 2 → weekly_analysis.py (시계열 패턴 분석)

```
data/weekly_dx25s.xlsx
  │
  ▼
weekly_analysis.py
  ├─ 스타일×컬러별 주차 시계열 구축 (Cum_In, Cum_Sale, Sell_Through)
  ├─ 리오더 감지 (최초입고 +14일 이후 추가 입고)
  ├─ 결품 시점 판별 (누적 판매율 70% 도달 시점)
  └─ AI 진단 분류 (Hit / Normal / Early Shortage / Shortage / Risk)
  │
  ├──→ output/25S_TimeSeries_Analysis_Result.xlsx   ← STEP 3 입력 + STEP 4 입력
  └──→ public/dashboard_data.json (기초)            ← 프론트엔드 Step 2탭 (기초 데이터)
```

**25S_TimeSeries_Analysis_Result.xlsx 소비처:**
- STEP 3 — 기회비용 계산 대상 품번 추출 (AI_진단 컬럼 참조)
- STEP 4 — 유사스타일 매핑 기준 데이터 (판매율, AI진단, AI제안 발주량)

---

### STEP 3 → ai_sales_loss_v2.py (AI 수요 예측 & 기회비용)

```
output/25S_TimeSeries_Analysis_Result.xlsx  ← STEP 2 산출물
data/weekly_dx25s.xlsx                      ← 원천 (주차 시계열 재참조)
public/dashboard_data.json                  ← STEP 2 산출물
  │
  ▼
ai_sales_loss_v2.py
  ├─ Shortage / Hit 품번 추출 (AI_진단 기반)
  ├─ Base Velocity 계산: P_avg = 결품 직전 4주 평균 판매량 (최소 5개)
  ├─ Adaptive Decay 모델: r = (10 / P_avg)^(1/W)
  │    └─ W = 결품시점 ~ 시즌종료(9/30) 잔여 주수
  ├─ 주차별 잠재수요(potential_sale), 기회손실(loss) 계산
  │    └─ 10/30 이후 예측 = 0 (시즌 종료 cutoff)
  └─ AI제안 발주량 = ceil_10((총판매 + 기회비용) / 0.75)
  │
  ├──→ output/25S_TimeSeries_Analysis_Result.xlsx [갱신]
  │       └─ +AI계산 기회비용, +AI제안 발주량 컬럼 추가
  └──→ public/dashboard_data.json [갱신]
          └─ +potential_sale, +loss 필드 추가 (주차별)
```

**갱신된 dashboard_data.json 소비처:**
- `Dashboard.jsx` (Step 2탭) — 잠재수요 점선, 기회비용 면적 표시

**갱신된 TimeSeries_Analysis_Result.xlsx 소비처:**
- STEP 4 — AI제안 발주량을 참조스타일 실적으로 활용

---

### AI 버짓 컨트롤 (백엔드 + 프론트엔드)

```
public/season_closing_data.json  ← STEP 1 산출물
.env (OPENAI_API_KEY 또는 ANTHROPIC_API_KEY)
  │
  ▼
server/api.py
  ├─ POST /api/budget-proposal
  │    └─ season_closing_data → LLM(GPT-4o/Claude) → 목표매출+카테고리 비중 제안
  │    └─ API 키 없으면 규칙 기반 fallback (STR별 성장률 적용)
  └─ POST /api/budget-config
       └─ 확정된 예산 저장
  │
  └──→ output/budget_config.json     ← STEP 4 입력 (카테고리별 예산 천장)
```

**프론트엔드 흐름:**
```
SeasonClosing.jsx (Step 1탭)
  └─ "AI 예산 제안" 버튼
       ▼
  BudgetControl.jsx (모달)
    ├─ POST /api/budget-proposal → AI 목표매출 수신 + AI 코멘터리
    ├─ 유저가 목표매출(억원), 카테고리 비중(%), 목표판매율(%) 조정
    ├─ 발주예산 = 조정수량 / 목표판매율 (자동 계산)
    └─ "확정" → POST /api/budget-config
              → output/budget_config.json 저장
```

---

### STEP 4 → step4_integration.py (유사스타일 매핑 → 발주 제안)

```
output/25S_TimeSeries_Analysis_Result.xlsx  ← STEP 2+3 산출물 (AI제안 발주량 포함)
data/similarity_mapping.csv                 ← ML 매핑 (26S신규 → 25S참조 Top3, 유사도점수)
output/budget_config.json                   ← 버짓 컨트롤 산출물 (선택)
  │
  ▼
step4_integration.py
  ├─ Top-3 유사스타일 매칭 (유사도 ≥ 0.50 필터)
  ├─ 신뢰도 분류:
  │    high (≥0.85 + 2refs), medium (≥0.70 + 1ref), low (≥0.50), none
  ├─ 가중 평균 추천: Σ(score × ref_metric) / Σ(scores)
  └─ apply_budget_ceiling(): 카테고리별 천장 초과 시 비례 축소
  │
  ├──→ output/26S_Order_Recommendation.xlsx
  └──→ output/26S_Order_Recommendation.json    (→ 향후 Step 3~4탭 연동 예정)
```

---

### 프론트엔드 탭 구성

```
┌──────┬───────────────────┬───────────────────────┬──────────────────────────────┐
│ 탭   │ 컴포넌트           │ 데이터 소스            │ 주요 기능                     │
├──────┼───────────────────┼───────────────────────┼──────────────────────────────┤
│ 0    │ BrandIndexSetup   │ localStorage          │ 브랜드 KPI 기준값 설정          │
├──────┼───────────────────┼───────────────────────┼──────────────────────────────┤
│ 1    │ SeasonClosing     │ season_closing_data    │ 시즌 마감 분석 + AI 예산제안     │
│      │ + BudgetControl   │ + /api/budget-*       │                              │
├──────┼───────────────────┼───────────────────────┼──────────────────────────────┤
│ 2    │ Dashboard         │ dashboard_data.json   │ 시계열 분석 + 기회비용 시각화     │
├──────┼───────────────────┼───────────────────────┼──────────────────────────────┤
│ 3    │ (Placeholder)     │ —                     │ 유사스타일 매핑 (구현 예정)       │
├──────┼───────────────────┼───────────────────────┼──────────────────────────────┤
│ 4    │ (Placeholder)     │ —                     │ 발주 제안 (구현 예정)            │
├──────┼───────────────────┼───────────────────────┼──────────────────────────────┤
│ 5    │ SizeAssortment    │ (내장 데이터)           │ 사이즈 아소트 최적화             │
└──────┴───────────────────┴───────────────────────┴──────────────────────────────┘
```

---

### 전체 연결 요약도

```
[원천 데이터]                  [분석 파이프라인]                [프론트엔드]

sql_result_raw.xlsx ──→ STEP1 main.py
weekly_dx25s.xlsx ──┘      │
                           ├─→ 25S_Analysis_Result.xlsx        (오프라인 보고서)
                           └─→ season_closing_data.json ──────→ Step 1: 시즌 마감 분석
                                       │                            │
                                       └──→ server/api.py ←─────────┘ AI 예산 제안
                                                │                        │
                                                └─→ budget_config.json ──┐
                                                                         │
weekly_dx25s.xlsx ─────→ STEP2 weekly_analysis.py                        │
                           │                                             │
                           ├─→ TimeSeries_Result.xlsx ──┐                │
                           └─→ dashboard_data.json      │                │
                                       │                │                │
                           STEP3 ai_sales_loss_v2.py ←──┘                │
                           │                                             │
                           ├─→ TimeSeries_Result.xlsx [갱신] ──┐         │
                           └─→ dashboard_data.json [갱신] ────→ Step 2: 시계열 분석
                                                               │         │
similarity_mapping.csv ─→ STEP4 step4_integration.py ←─────────┘←────────┘
                           │
                           ├─→ 26S_Order_Recommendation.xlsx
                           └─→ 26S_Order_Recommendation.json   (→ 향후 Step 3~4탭)
```

---

### 핵심 연결 포인트 3가지

1. **STEP 2 → STEP 3:** TimeSeries_Result.xlsx를 STEP 3이 읽고 갱신함 (AI계산 기회비용, AI제안 발주량 추가)
2. **STEP 1 → 백엔드 → STEP 4:** season_closing_data.json → LLM 예산 제안 → budget_config.json → STEP 4 예산 천장
3. **STEP 2+3 → STEP 4:** 갱신된 TimeSeries_Result.xlsx의 AI제안 발주량을 참조스타일 실적으로 사용

---

## JSON 데이터 구조

### season_closing_data.json (STEP 1 산출물)

```json
{
  "metadata": {
    "season": "25S",
    "generated_at": "2026-02-05 18:22:50",
    "total_styles": 530
  },
  "summary": {
    "total_inbound": 1812954,
    "total_sales": 785672,
    "total_stock": 1014965,
    "sell_through_rate": 43.34,
    "stock_risk": 55.98,
    "ai_comment": "⚠️ [주의] 전체 판매율 43.3%로 목표 미달..."
  },
  "class_analysis": [
    {
      "class2": "Inner",
      "volume_share": 57.74,
      "sales_share": 63.54,
      "sell_through_rate": 47.69,
      "balance_delta": 5.8,
      "balance_judgment": "확대필요",
      "ai_comment": "..."
    }
  ],
  "item_analysis": [
    {
      "class2": "Wear_etc",
      "item_nm": "슬리브리스",
      "grade": "A",
      "bcg_class": "Star",
      "sell_through_rate": 69.21,
      "ai_comment": "..."
    }
  ],
  "style_summary": {
    "grade_distribution": { "S": 45, "A": 120, "B": 200, "C": 130, "D": 35 },
    "action_distribution": { "Aggressive": 50, "Expand": 100, "Maintain": 200, "Observation": 150, "Cut/Drop": 30 },
    "action_styles": {
      "Aggressive": [{ "style_cd": "...", "grade": "S", "sell_through_rate": 92.5, "ai_comment": "..." }],
      "Expand": [...],
      "Maintain": [...],
      "Observation": [...],
      "Cut/Drop": [...]
    }
  }
}
```

### dashboard_data.json (STEP 2+3 산출물)

```json
{
  "success": {
    "hit": [
      {
        "total": {
          "chartData": [
            { "date": "12/29", "sale": 84, "stock": 3116, "in": 3200, "label": "", "potential_sale": 19, "loss": 0 }
          ],
          "itemInfo": { "name": "Shirt", "code": "ABC001", "color": "전체", "price": 85000 },
          "analysis": { "최초입고": "2025-01-26", "결품시점": "2025-06-15", "최종판매율": 80.0, "AI_진단": "🟢Hit (적기 소진)" }
        },
        "colors": {
          "BK": { "chartData": [...], "itemInfo": {...}, "analysis": {...} }
        }
      }
    ],
    "normal": [...]
  },
  "failure": {
    "early_shortage": [...],
    "shortage": [...],
    "risk": [...]
  }
}
```

### budget_config.json (유저 확정 예산)

```json
{
  "season": "26S",
  "confirmed_at": "2026-02-03T16:30:00Z",
  "target_total_revenue": 1780000000,
  "total_order_budget_amt": 2500000000,
  "total_order_budget_qty": 980000,
  "category_budgets": [
    { "class2": "Inner", "budget_amt": 1500000000, "budget_qty": 580000, "avg_price": 25862 },
    { "class2": "Outer", "budget_amt": 1000000000, "budget_qty": 400000, "avg_price": 25000 }
  ]
}
```
