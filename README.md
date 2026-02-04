# OrderAI — Fashion Retail Season Order Optimization

25S 시즌 판매 데이터를 분석하여 26S 시즌 발주를 최적화하는 프로젝트입니다.
Python 분석 파이프라인 + React 대시보드 + AI 예산 컨트롤로 구성됩니다.

## 주요 기능

- **시즌 마감 분석** — 판매율, 재고 밸런스, BCG 매트릭스, 등급(S/A/B/C/D) 산출
- **시계열 패턴 분석** — 주별 판매 추이, 재발주 이벤트, 재고 소진 시점 감지
- **AI 수요 예측** — 적응형 감쇠 모델로 기회비용 및 제안 발주량 산출
- **유사 스타일 매핑** — 25S 실적 기반 26S 발주 추천 + 예산 천장 스케일링
- **AI 예산 컨트롤** — Claude API가 카테고리별 목표매출/발주예산 제안

## 프로젝트 구조

```
order_ai/
├── src/                          # React 프론트엔드
│   ├── App.jsx                   #   메인 앱 (사이드바 3탭)
│   └── components/
│       ├── SeasonClosing.jsx     #   시즌 마감 대시보드
│       ├── BudgetControl.jsx     #   AI 예산 컨트롤 (모달)
│       └── Dashboard.jsx         #   시계열 분석 대시보드
├── scripts/                      # Python 분석 파이프라인
│   ├── run_all.py                #   전체 파이프라인 실행
│   ├── main.py                   #   STEP 1: 시즌 마감 분석
│   ├── weekly_analysis.py        #   STEP 2: 시계열 패턴 분석
│   ├── ai_sales_loss_v2.py       #   STEP 3: AI 수요 예측
│   └── step4_integration.py      #   STEP 4: 유사 스타일 → 발주 추천
├── server/
│   └── api.py                    # FastAPI 백엔드 (AI 예산 프록시)
├── data/                         # 입력 데이터 (xlsx, csv)
├── output/                       # 분석 결과물 (gitignored)
└── public/                       # 프론트엔드 정적 파일
```

## 설치 및 실행

### 필요 사항

- Node.js 18+
- Python 3.8+

### 프론트엔드

```bash
npm install
npm run dev          # http://localhost:3000
```

### Python 분석 파이프라인

```bash
pip install -r requirements.txt

# 전체 실행
cd scripts && python run_all.py

# 또는 개별 실행
python scripts/main.py              # STEP 1
python scripts/weekly_analysis.py   # STEP 2
python scripts/ai_sales_loss_v2.py  # STEP 3
python scripts/step4_integration.py # STEP 4
```

### FastAPI 백엔드

```bash
# ANTHROPIC_API_KEY 환경변수 필요 (없으면 규칙 기반 fallback)
uvicorn server.api:app --port 8000 --reload
```

## 데이터 흐름

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

## 배포

### Vercel (프론트엔드)

1. [Vercel](https://vercel.com)에서 GitHub 저장소 연결
2. Framework Preset: `Vite`, Output Directory: `dist`
3. `main` 브랜치 push 시 자동 배포

## 한글 폰트 (Python 차트)

```python
# macOS
plt.rcParams['font.family'] = 'AppleGothic'
# Windows
plt.rcParams['font.family'] = 'Malgun Gothic'
```
