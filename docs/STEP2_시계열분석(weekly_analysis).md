# 📊 25S 시즌 시계열 분석 및 인터랙티브 대시보드 개발 기획서

## 1. 프로젝트 개요
* **목표:** `weekly_dx25s.xlsx` (주차별 시계열 데이터)를 분석하여 **'물량 공급 타이밍'**의 적절성을 진단하고, React 대시보드로 시각화함.
* **핵심 산출물:**
    1.  **Excel 리포트:** 전체 스타일의 타이밍 진단 결과 (성공/실패/보통 등급 부여)
    2.  **Dashboard Code:** 대표적인 성공/실패 사례를 비교 분석하는 리액트 웹 앱

---

## 2. 상세 분석 로직 (Python Logic)

### 2.1. 데이터 전처리
* **소스:** `weekly_dx25s.xlsx` (Sheet: `Data`)
* **필터링:** `PERIOD == '당해'` 데이터만 사용.
* **날짜 변환:** `END_DT`를 시계열 정렬 키로 사용.

### 2.2. 시계열 패턴 감지 알고리즘
각 스타일(`PART_CD` + `COLOR_CD`)별로 아래 지표를 계산한다.

1.  **누적 흐름 재구성 (Cumulative Flow):**
    * `Cum_In` (누적 입고): `STOR_QTY_KR`의 누적합 (기초 재고 보정 포함)
    * `Cum_Sale` (누적 판매): `SALE_QTY_CNS`의 누적합
    * `Sell_Through` (판매율): `Cum_Sale / Cum_In`

2.  **이벤트 시점 추출 (Event Detection):**
    * **최초 입고일:** 재고가 처음 발생한 날짜.
    * **리오더(Reorder) 입고일:** 최초 입고일 + 14일 이후, `STOR_QTY_KR > 0`인 모든 날짜.
    * **결품(Stock-out) 시점:** 판매율이 **70%를 최초 돌파**한 날짜.

3.  **AI 진단 및 코멘트 생성 (Diagnosis Rule):**
    * **🟢 Success (성공):** 리오더가 1회 이상 있고, 결품 없이 시즌 종료 시점까지 판매가 지속된 경우.
        * *Comment:* "적기 리오더(N회)를 통해 재고를 확충하여, 시즌 내내 판매 호조세 유지."
    * **🚨 Early Shortage (조기 품절):** 4월 30일 이전에 결품(70%) 도달.
        * *Comment:* "4월 조기 품절로 인한 매출 절벽 발생. 초도 물량 과소 및 리오더 실기(失期)."
    * **🔴 Risk (부진):** 시즌 종료 시 판매율 40% 미만.
        * *Comment:* "판매 부진 지속. 시즌 초반 반응 생산(QR) 전환 실패로 재고 부담 가중."

---

## 3. 대시보드 구현 가이드 (React & Recharts)

### 3.1. 차트 구성 (Composed Chart)
* **X축:** 날짜 (주차별)
* **좌측 Y축 (Quantity):**
    * `Area` (면적): 재고 수량 (Stock) - 성공은 초록색, 실패는 붉은색 계열 배경.
    * `Line` (선): 입고 수량 (In) - 리오더 시점에만 점(Dot)을 찍어 강조.
* **우측 Y축 (Sales):**
    * `Bar` (막대): 주간 판매량 (Sale) - 회색조로 깔아주어 추세 확인.
* **Reference Line:** 조기 품절 시점에 붉은 점선 표시.

### 3.2. AI Insight Section
* 차트 하단에 분석된 **'AI Action Guide'** 텍스트를 카드 형태로 배치.
* 성공/실패 여부에 따라 아이콘과 텍스트 색상(Green/Red)을 동적으로 변경.

---

## 4. 실행 환경 및 파일 저장
* **Python Output:** `25S_TimeSeries_Analysis.xlsx` (분석 결과)
* **JSON Output:** 대시보드용 데이터 (`successData.json`, `failureData.json`)