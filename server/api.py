"""
FastAPI 백엔드: AI 예산 제안 프록시 (OpenAI / Claude API) + 예산 확정 저장

실행: uvicorn server.api:app --port 8000 --reload
환경변수: OPENAI_API_KEY (우선) 또는 ANTHROPIC_API_KEY
"""

import json
import os
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 프로젝트 루트의 .env 파일 로드
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

app = FastAPI(title="Order AI Budget API")

# CORS 설정 (개발 환경)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
BUDGET_CONFIG_PATH = os.path.join(OUTPUT_DIR, "budget_config.json")
SEASON_CLOSING_PATH = os.path.join(PUBLIC_DIR, "season_closing_data.json")

BUDGET_PROMPT_TEMPLATE = """당신은 패션 리테일 MD(Merchandiser) 전문가입니다.
아래는 {season} 시즌의 마감 분석 데이터입니다.

{context}

이 데이터를 분석하여 차시즌(26S)의 **목표 매출금액(₩)**을 제안해주세요.
전시즌 총 판매금액은 {prev_total_revenue:,}원이며, 총 판매수량은 {prev_total_sales:,}장입니다.

카테고리별 평균단가 참고:
{price_context}

다음 JSON 형식으로 응답해주세요 (반드시 JSON만 출력):
{{
  "ai_commentary": "종합 분석 코멘트 (2-3문장, 한국어, 매출 성장률 근거 포함)",
  "target_total_revenue": 26S목표총매출금액(정수, 원),
  "category_targets": [
    {{
      "class2": "카테고리명",
      "prev_sales": 전시즌판매수량(정수),
      "prev_revenue": 전시즌판매금액(정수, 원),
      "avg_price": 평균단가(정수, 원),
      "prev_sell_through_rate": 전시즌판매율(소수),
      "target_revenue": 제안매출목표(정수, 원),
      "share_pct": 비중(소수, 0~100)
    }}
  ]
}}

규칙:
- 판매 비중이 높고 효율 좋은(확대필요) 카테고리는 비중 확대
- 판매율이 낮은(축소필요) 카테고리는 비중 축소
- 전체 목표 매출금액은 전시즌 대비 합리적 성장률 적용
- 모든 카테고리를 포함해야 함
- share_pct 합계는 100이어야 함
"""


# ── Request / Response Models ─────────────────────────────

class BudgetProposalRequest(BaseModel):
    season: str = "25S"


class CategoryTarget(BaseModel):
    class2: str
    prev_sales: int = 0
    prev_revenue: int = 0
    avg_price: int = 0
    prev_sell_through_rate: float = 0
    target_revenue: int = 0
    share_pct: float = 0


class BudgetProposalResponse(BaseModel):
    ai_commentary: str
    target_total_revenue: int
    prev_total_revenue: int
    prev_total_sales: int
    category_targets: List[CategoryTarget]


class CategoryBudgetConfig(BaseModel):
    class2: str
    budget_amt: int = 0
    budget_qty: int = 0
    avg_price: int = 0


class BudgetConfigRequest(BaseModel):
    season: str
    target_total_revenue: int = 0
    total_order_budget_amt: int = 0
    total_order_budget_qty: int = 0
    category_budgets: List[CategoryBudgetConfig]


# ── LLM 호출 함수들 ──────────────────────────────────────

def _call_openai(prompt: str, api_key: str) -> str:
    """OpenAI GPT-4o 호출"""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def _call_anthropic(prompt: str, api_key: str) -> str:
    """Anthropic Claude 호출"""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


def _parse_llm_response(response_text: str) -> dict:
    """LLM 응답에서 JSON 파싱 (코드블록 제거 포함)"""
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    return json.loads(text)


# ── Endpoints ─────────────────────────────────────────────

@app.post("/api/budget-proposal", response_model=BudgetProposalResponse)
async def budget_proposal(req: BudgetProposalRequest):
    """
    LLM을 호출하여 차시즌 목표매출(판매수량)을 제안받는 엔드포인트.
    """
    if not os.path.exists(SEASON_CLOSING_PATH):
        raise HTTPException(
            status_code=404,
            detail="season_closing_data.json이 없습니다. python scripts/main.py를 먼저 실행하세요."
        )

    with open(SEASON_CLOSING_PATH, "r", encoding="utf-8") as f:
        closing_data = json.load(f)

    summary = closing_data.get("summary", {})
    class_analysis = closing_data.get("class_analysis", [])
    prev_total_sales = summary.get("total_sales", 0)
    prev_total_revenue = summary.get("total_sale_amt", 0)

    # API 키 확인 (OpenAI 우선)
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if not openai_key and not anthropic_key:
        print("[Budget API] API 키 미설정 → 룰 기반 폴백")
        return _fallback_proposal(summary, class_analysis)

    # 카테고리별 평균단가 컨텍스트
    price_lines = []
    for cat in class_analysis:
        price_lines.append(
            f"- {cat.get('class2', '')}: 매출 {cat.get('sale_amt', 0):,}원, "
            f"평균단가 {cat.get('avg_price', 0):,}원"
        )
    price_context = "\n".join(price_lines) if price_lines else "없음"

    # 프롬프트 생성
    context = json.dumps(closing_data, ensure_ascii=False, indent=2)
    prompt = BUDGET_PROMPT_TEMPLATE.format(
        season=req.season,
        context=context,
        prev_total_revenue=prev_total_revenue,
        prev_total_sales=prev_total_sales,
        price_context=price_context,
    )

    # LLM 호출 (OpenAI → Anthropic → 폴백)
    response_text = None

    if openai_key:
        try:
            print(f"[Budget API] OpenAI GPT-4o 호출 시작 (key: ...{openai_key[-6:]})")
            response_text = _call_openai(prompt, openai_key)
            print("[Budget API] OpenAI 호출 성공")
        except Exception as e:
            print(f"[Budget API] OpenAI 호출 실패: {type(e).__name__}: {e}")

    if response_text is None and anthropic_key:
        try:
            print(f"[Budget API] Claude 호출 시작 (key: ...{anthropic_key[-6:]})")
            response_text = _call_anthropic(prompt, anthropic_key)
            print("[Budget API] Claude 호출 성공")
        except Exception as e:
            print(f"[Budget API] Claude 호출 실패: {type(e).__name__}: {e}")

    if response_text is None:
        print("[Budget API] 모든 LLM 실패 → 룰 기반 폴백")
        return _fallback_proposal(summary, class_analysis)

    # 응답 파싱
    try:
        result = _parse_llm_response(response_text)
        return BudgetProposalResponse(
            ai_commentary=result.get("ai_commentary", ""),
            target_total_revenue=result.get("target_total_revenue", 0),
            prev_total_revenue=prev_total_revenue,
            prev_total_sales=prev_total_sales,
            category_targets=[
                CategoryTarget(**cat) for cat in result.get("category_targets", [])
            ]
        )
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"[Budget API] LLM 응답 파싱 실패 → 폴백: {e}")
        print(f"[Budget API] 원본 응답: {response_text[:500]}")
        return _fallback_proposal(summary, class_analysis)


def _fallback_proposal(summary: dict, class_analysis: list) -> BudgetProposalResponse:
    """룰 기반 폴백: 전시즌 실적 기반으로 목표매출(금액) 제안"""
    prev_total_sales = summary.get("total_sales", 0)
    prev_total_revenue = summary.get("total_sale_amt", 0)
    sell_through = summary.get("sell_through_rate", 0)

    # 성장률 결정
    if sell_through >= 60:
        growth = 1.10
    elif sell_through >= 50:
        growth = 1.05
    elif sell_through >= 40:
        growth = 1.03
    else:
        growth = 1.00

    target_total_revenue = int(prev_total_revenue * growth)

    category_targets = []
    commentary_parts = []

    for cat in class_analysis:
        class2 = cat.get("class2", "")
        prev_sales = cat.get("sale_qty", 0)
        prev_revenue = cat.get("sale_amt", 0)
        avg_price = cat.get("avg_price", 0)
        prev_str = cat.get("sell_through_rate", 0)
        delta = cat.get("balance_delta", 0)

        if delta > 5:
            cat_growth = growth * 1.05
            commentary_parts.append(f"{class2}(비중 확대, 판매효율 우수)")
        elif delta < -5:
            cat_growth = growth * 0.95
            commentary_parts.append(f"{class2}(비중 축소, 물량 과다)")
        else:
            cat_growth = growth
            commentary_parts.append(f"{class2}(유지)")

        target_revenue = int(prev_revenue * cat_growth)

        category_targets.append(CategoryTarget(
            class2=class2,
            prev_sales=prev_sales,
            prev_revenue=prev_revenue,
            avg_price=avg_price,
            prev_sell_through_rate=prev_str,
            target_revenue=target_revenue,
            share_pct=0,
        ))

    # 비중 계산
    total_target_rev = sum(c.target_revenue for c in category_targets)
    if total_target_rev > 0:
        for c in category_targets:
            c.share_pct = round(c.target_revenue / total_target_rev * 100, 1)

    growth_pct = ((target_total_revenue - prev_total_revenue) / prev_total_revenue * 100) if prev_total_revenue > 0 else 0

    def _fmt_revenue(amt):
        if amt >= 100000000:
            return f"{amt / 100000000:.1f}억"
        if amt >= 10000000:
            return f"{amt // 10000:,}만"
        return f"{amt:,}원"

    ai_commentary = (
        f"25S 판매율 {sell_through}%를 감안하여, 26S 목표 매출금액을 "
        f"{_fmt_revenue(target_total_revenue)}(전시즌 대비 {growth_pct:+.1f}%)으로 제안합니다. "
        f"카테고리별: {', '.join(commentary_parts)}."
    )

    return BudgetProposalResponse(
        ai_commentary=ai_commentary,
        target_total_revenue=target_total_revenue,
        prev_total_revenue=prev_total_revenue,
        prev_total_sales=prev_total_sales,
        category_targets=category_targets,
    )


@app.post("/api/budget-config")
async def save_budget_config(config: BudgetConfigRequest):
    """확정된 발주예산을 output/budget_config.json에 저장합니다."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    output = {
        "season": config.season,
        "confirmed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "target_total_revenue": config.target_total_revenue,
        "total_budget_amt": config.total_order_budget_amt,
        "total_budget_qty": config.total_order_budget_qty,
        "category_budgets": [
            {
                "class2": cat.class2,
                "budget_amt": cat.budget_amt,
                "budget_qty": cat.budget_qty,
                "avg_price": cat.avg_price,
            }
            for cat in config.category_budgets
        ]
    }

    with open(BUDGET_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    return {"status": "ok", "path": BUDGET_CONFIG_PATH}


@app.get("/api/health")
async def health():
    return {"status": "ok"}
