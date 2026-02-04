# 배포 및 맥북 이전 가이드

## 추천 배포 방법

이 프로젝트는 **하이브리드 구조**이므로 다음과 같이 배포하는 것을 추천합니다:

### ✅ 추천: GitHub + Vercel 조합

1. **GitHub**: 전체 코드 저장 및 버전 관리
2. **Vercel**: 프론트엔드 자동 배포 (무료)

이 방법의 장점:
- 코드를 어디서나 접근 가능 (맥북 포함)
- Vercel이 자동으로 프론트엔드 배포 (GitHub 푸시 시 자동)
- 무료 플랜으로 충분
- 맥북에서 `git clone`으로 쉽게 가져오기 가능

---

## 1단계: GitHub에 프로젝트 업로드

### 1.1 GitHub 저장소 생성

1. [GitHub](https://github.com)에 로그인
2. 우측 상단 `+` → `New repository` 클릭
3. 저장소 이름 입력 (예: `order_ai_judy`)
4. `Public` 또는 `Private` 선택
5. **"Initialize with README" 체크 해제** (이미 README.md가 있음)
6. `Create repository` 클릭

### 1.2 로컬에서 Git 초기화 및 푸시

```bash
# 현재 프로젝트 디렉토리에서 실행

# Git 초기화 (이미 되어있다면 스킵)
git init

# 원격 저장소 추가
# 예시: GitHub 사용자명이 "johndoe"이고 저장소 이름이 "25s-analysis-dashboard"인 경우
# git remote add origin https://github.com/johndoe/25s-analysis-dashboard.git
# 
# YOUR_USERNAME: 본인의 GitHub 사용자명 (예: johndoe)
# REPO_NAME: 위에서 만든 저장소 이름 (예: 25s-analysis-dashboard 또는 Order)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# 파일 추가
git add .

# 첫 커밋 (커밋 메시지는 자유롭게 변경 가능)
git commit -m "Initial commit: 25S analysis dashboard"

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

**실제 예시:**
- GitHub 사용자명: `YOUR_USERNAME` (본인의 GitHub 사용자명)
- 저장소 이름: `order_ai_judy`
- 명령어: `git remote add origin https://github.com/YOUR_USERNAME/order_ai_judy.git`
  - 예: `git remote add origin https://github.com/ac1001/order_ai_judy.git`

### 1.3 큰 파일 처리 (Excel 파일이 큰 경우)

Excel 파일이 100MB 이상이면 Git LFS 사용 권장:

```bash
# Git LFS 설치 (https://git-lfs.github.com)
# Windows: Chocolatey로 설치 가능

# Git LFS 초기화
git lfs install

# Excel 파일을 LFS로 추적
git lfs track "*.xlsx"
git lfs track "*.xls"

# .gitattributes 파일 커밋
git add .gitattributes
git commit -m "Add Git LFS tracking for Excel files"
```

---

## 2단계: Vercel에 프론트엔드 배포

### 2.1 Vercel 가입 및 연결

1. [Vercel](https://vercel.com)에 가입 (GitHub 계정으로 로그인 권장)
2. 대시보드에서 `Add New Project` 클릭
3. 방금 만든 GitHub 저장소 선택
4. `Import` 클릭

### 2.2 프로젝트 설정

Vercel이 자동으로 Vite 프로젝트를 감지합니다. 설정 확인:

- **Framework Preset**: `Vite` (자동 감지)
- **Root Directory**: `./` (기본값)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 2.3 배포

1. `Deploy` 버튼 클릭
2. 약 1-2분 후 배포 완료
3. 제공되는 URL로 접속 가능 (예: `https://your-project.vercel.app`)

### 2.4 자동 배포 설정

기본적으로 GitHub에 푸시할 때마다 자동 배포됩니다:
- `main` 브랜치에 푸시 → 프로덕션 배포
- 다른 브랜치에 푸시 → 프리뷰 배포

---

## 3단계: 맥북에서 프로젝트 가져오기

### 3.1 필수 도구 설치

```bash
# Homebrew 설치 (없는 경우)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node

# Python 설치
brew install python3

# Git 설치 (보통 기본 설치됨)
# 확인: git --version
```

### 3.2 프로젝트 클론

```bash
# 원하는 디렉토리로 이동
cd ~/Documents  # 또는 원하는 위치

# 저장소 클론 (저장소 이름: order_ai_judy)
git clone https://github.com/YOUR_USERNAME/order_ai_judy.git
cd order_ai_judy

# 또는 SSH 사용 (SSH 키가 설정된 경우)
# git clone git@github.com:YOUR_USERNAME/order_ai_judy.git

# 실제 예시:
# git clone https://github.com/ac1001/order_ai_judy.git
# cd order_ai_judy
```

### 3.3 의존성 설치

```bash
# 프론트엔드 의존성
npm install

# 백엔드 의존성
pip3 install -r requirements.txt

# 또는 가상환경 사용 (권장)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3.4 실행

```bash
# 프론트엔드 개발 서버 (터미널 1)
npm run dev

# 브라우저에서 http://localhost:3000 접속

# 백엔드 스크립트 실행 (터미널 2)
python3 main.py
# 또는 가상환경 활성화 후
source venv/bin/activate
python main.py
```

---

## 대안: GitHub만 사용하기

Vercel 배포 없이 GitHub만 사용하려면:

1. **GitHub에 코드 저장** (위 1단계)
2. **맥북에서 클론** (위 3단계)
3. **로컬에서 실행**

장점: 간단, 비용 없음
단점: 웹에서 접근 불가, 로컬 환경 설정 필요

---

## 대안: GitHub Pages 배포

Vercel 대신 GitHub Pages 사용:

```bash
# 빌드
npm run build

# gh-pages 설치
npm install --save-dev gh-pages

# package.json에 스크립트 추가
# "scripts": {
#   "deploy": "gh-pages -d dist"
# }

# 배포
npm run deploy
```

그 후 GitHub 저장소 Settings → Pages에서 설정

---

## 문제 해결

### 맥북에서 한글 폰트 문제 (Python 차트)

`main.py`의 폰트 설정을 macOS에 맞게 수정:

```python
# Windows
plt.rcParams['font.family'] = 'Malgun Gothic'

# macOS (수정 필요)
plt.rcParams['font.family'] = 'AppleGothic'
# 또는
plt.rcParams['font.family'] = 'NanumGothic'
```

### Excel 파일이 너무 큰 경우

- Git LFS 사용 (위 1.3 참조)
- 또는 `.gitignore`에 큰 파일 추가
- 또는 클라우드 스토리지 (Google Drive, Dropbox) 사용

### Vercel 빌드 오류

- `vercel.json` 확인
- 빌드 로그 확인 (Vercel 대시보드)
- 로컬에서 `npm run build` 테스트

---

## 요약: 어떤 방법을 선택할까?

| 방법 | 장점 | 단점 | 추천 대상 |
|------|------|------|----------|
| **GitHub + Vercel** | 자동 배포, 웹 접근 가능, 무료 | Python 스크립트는 로컬 실행 필요 | ✅ **가장 추천** |
| **GitHub만** | 간단, 비용 없음 | 웹 접근 불가, 설정 필요 | 로컬만 사용 |
| **GitHub Pages** | GitHub 통합, 무료 | 설정 복잡, 정적 파일만 | Vercel 대안 |

**추천**: GitHub + Vercel 조합을 사용하세요!
