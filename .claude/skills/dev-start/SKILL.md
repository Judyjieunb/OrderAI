---
name: dev-start
description: Start frontend dev server and FastAPI backend together
disable-model-invocation: true
allowed-tools: Bash
---

## 개발 서버 동시 실행

프론트엔드(Vite)와 백엔드(FastAPI)를 동시에 실행합니다.

### 실행 절차

1. FastAPI 백엔드를 백그라운드로 실행: `uvicorn server.api:app --port 8000 --reload`
2. Vite 프론트엔드를 백그라운드로 실행: `npm run dev`
3. 두 서버가 정상 기동되었는지 확인 후 사용자에게 보고
   - 프론트엔드: http://localhost:3000
   - 백엔드 API: http://localhost:8000

### 주의사항

- 이미 해당 포트를 사용 중인 프로세스가 있으면 알려줄 것
- ANTHROPIC_API_KEY 환경변수가 없으면 백엔드는 규칙 기반 fallback으로 동작 (정상)
