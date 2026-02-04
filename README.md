# 25S 시즌 판매 효율 분석 대시보드

25S 시즌 판매 데이터를 분석하고 시각화하는 대시보드 프로젝트입니다.

## 프로젝트 구조

- **프론트엔드**: React + Vite + TailwindCSS
- **백엔드**: Python (데이터 분석 스크립트)
- **데이터**: Excel 파일 기반

## 기능

1. **시즌 마감 분석** (`main.py`)
   - 전체 시즌 건강도 진단
   - 복종별 밸런스 분석
   - 아이템별 효율 분석 (BCG 매트릭스)
   - 스타일 상세 분석

2. **시계열 분석** (`weekly_analysis.py`)
   - 주별 판매 패턴 분석

3. **AI 수요 예측** (`ai_sales_loss.py`)
   - AI 기반 판매 손실 분석

4. **인터랙티브 대시보드**
   - React 기반 웹 대시보드
   - 차트 및 시각화

## 설치 및 실행

### 필요 사항

- Node.js 18+ 
- Python 3.8+
- npm 또는 yarn

### 1. 저장소 클론

```bash
git clone <your-repository-url>
cd Order
```

### 2. 프론트엔드 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (포트 3000)
npm run dev

# 프로덕션 빌드
npm run build
```

### 3. 백엔드 설정

```bash
# Python 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 메인 분석 실행
python main.py

# 시계열 분석 실행
python weekly_analysis.py
```

## 배포

### Vercel 배포 (프론트엔드)

1. [Vercel](https://vercel.com)에 가입
2. GitHub 저장소 연결
3. 프로젝트 설정:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. 환경 변수 설정 (필요시)

Vercel은 자동으로 GitHub 푸시 시 배포됩니다.

### GitHub Pages 배포 (대안)

```bash
# 빌드
npm run build

# GitHub Pages에 배포 (gh-pages 사용)
npm install -g gh-pages
gh-pages -d dist
```

### 로컬 개발

```bash
# 프론트엔드 개발 서버 (포트 3000)
npm run dev

# Python 분석 스크립트 실행
python main.py
python weekly_analysis.py
```

## 데이터 파일

- `sql_result_raw.xlsx`: 원본 데이터
- `dashboard_data.json`: 대시보드용 JSON 데이터
- `25S_Analysis_Result.xlsx`: 분석 결과

## 프로젝트 구조

```
Order/
├── src/                  # React 소스 코드
├── public/              # 정적 파일
│   └── dashboard_data.json
├── main.py             # 메인 분석 스크립트
├── weekly_analysis.py  # 시계열 분석
├── ai_sales_loss.py    # AI 예측
├── requirements.txt    # Python 의존성
├── package.json        # Node.js 의존성
└── vite.config.js      # Vite 설정
```

## 맥북에서 설정하기

1. **Git 클론**
   ```bash
   git clone <your-repository-url>
   cd Order
   ```

2. **Node.js 설치** (Homebrew 사용)
   ```bash
   brew install node
   ```

3. **Python 설치** (Homebrew 사용)
   ```bash
   brew install python3
   ```

4. **의존성 설치**
   ```bash
   # 프론트엔드
   npm install
   
   # 백엔드
   pip3 install -r requirements.txt
   ```

5. **실행**
   ```bash
   # 프론트엔드
   npm run dev
   
   # 백엔드
   python3 main.py
   ```

## 문제 해결

### 한글 폰트 문제 (Python 차트)
- macOS의 경우 `'AppleGothic'` 또는 `'NanumGothic'` 사용
- `main.py`의 폰트 설정을 수정하세요

### Excel 파일 읽기 오류
- `openpyxl` 라이브러리가 설치되어 있는지 확인
- Python 버전이 3.8 이상인지 확인

## 라이선스

MIT
