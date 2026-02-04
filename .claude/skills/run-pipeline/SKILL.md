---
name: run-pipeline
description: Run the 4-step Python analysis pipeline for season closing analysis, time series, AI demand forecasting, and order recommendation
disable-model-invocation: true
allowed-tools: Bash, Read
argument-hint: "[all | 1 | 2 | 3 | 4]"
---

## 25S 분석 파이프라인 실행

인자에 따라 전체 또는 개별 스텝을 실행합니다.

- `$0` = `all` 또는 생략 → 전체 파이프라인 (`scripts/run_all.py`)
- `$0` = `1` → STEP 1: 시즌 마감 분석 (`scripts/main.py`)
- `$0` = `2` → STEP 2: 시계열 패턴 분석 (`scripts/weekly_analysis.py`)
- `$0` = `3` → STEP 3: AI 수요 예측 (`scripts/ai_sales_loss_v2.py`)
- `$0` = `4` → STEP 4: 유사 스타일 매핑 → 발주 추천 (`scripts/step4_integration.py`)

### 실행 절차

1. 프로젝트 루트에서 해당 Python 스크립트 실행
2. 실행 결과(성공/실패) 확인 후 사용자에게 보고
3. 에러 발생 시 로그를 분석하여 원인과 해결 방안 제시

### 주의사항

- 스텝 간 의존성: STEP 1 → 2 → 3 → 4 순서로 실행해야 함
- STEP 1 출력물(`public/season_closing_data.json`)이 있어야 STEP 2 이후 진행 가능
- STEP 4는 `data/similarity_mapping.csv`와 `output/budget_config.json`(선택) 필요
- Python 가상환경이 활성화되어 있는지 확인할 것
