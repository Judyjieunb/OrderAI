"""
FastAPI 백엔드: AI 예산 제안 프록시 (OpenAI / Claude API) + 예산 확정 저장 + 유사스타일 확정

실행: uvicorn server.api:app --port 8000 --reload
환경변수: OPENAI_API_KEY (우선) 또는 ANTHROPIC_API_KEY
"""

import json
import math
import os
from datetime import datetime, timezone
from typing import List, Optional

import pandas as pd
import numpy as np
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


# ── 유사스타일 확정 → 발주추천 ────────────────────────────

CONFIRMED_MAPPING_PATH = os.path.join(OUTPUT_DIR, "confirmed_mapping.json")
ANALYSIS_RESULT_PATH = os.path.join(OUTPUT_DIR, "25S_TimeSeries_Analysis_Result.xlsx")
ORDER_REC_JSON = os.path.join(OUTPUT_DIR, "26S_Order_Recommendation.json")
ORDER_REC_EXCEL = os.path.join(OUTPUT_DIR, "26S_Order_Recommendation.xlsx")
ORDER_REC_PUBLIC_JSON = os.path.join(PUBLIC_DIR, "order_recommendation_data.json")

# STEP2/3 결과 컬럼명
_COL_PART_CD = "PART_CD"
_COL_ITEM_NM = "ITEM_NM"
_COL_PRICE = "판매가"
_COL_TOTAL_ORDER = "총발주"
_COL_TOTAL_INBOUND = "총입고"
_COL_TOTAL_SALE = "총판매"
_COL_SELL_RATE = "최종판매율"
_COL_AI_DIAG = "AI_진단"
_COL_AI_OPP_COST = "AI 계산 기회비용"
_COL_AI_ORDER = "AI제안 발주량"


def _ceil_10(x):
    """10단위 올림"""
    if x is None or x != x or x <= 0:  # NaN check without pandas
        return 0
    return int(math.ceil(x / 10) * 10)


def _load_style_summary() -> pd.DataFrame:
    """STEP2/3 분석 결과를 스타일 레벨로 집계하여 반환"""
    df = pd.read_excel(ANALYSIS_RESULT_PATH)

    for col in [_COL_TOTAL_ORDER, _COL_TOTAL_INBOUND, _COL_TOTAL_SALE,
                _COL_AI_OPP_COST, _COL_AI_ORDER, _COL_SELL_RATE]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    agg_dict = {
        _COL_TOTAL_ORDER: "sum",
        _COL_TOTAL_INBOUND: "sum",
        _COL_TOTAL_SALE: "sum",
        _COL_AI_OPP_COST: "sum",
        _COL_AI_ORDER: "sum",
        _COL_PRICE: "first",
        _COL_ITEM_NM: "first",
    }
    agg_dict = {k: v for k, v in agg_dict.items() if k in df.columns}

    style_summary = df.groupby(_COL_PART_CD).agg(agg_dict).reset_index()

    # 판매율 = 총판매/총입고*100
    if _COL_TOTAL_SALE in style_summary.columns and _COL_TOTAL_INBOUND in style_summary.columns:
        style_summary[_COL_SELL_RATE] = (
            style_summary[_COL_TOTAL_SALE] / style_summary[_COL_TOTAL_INBOUND].replace(0, np.nan) * 100
        ).fillna(0).round(1)

    # 대표 진단
    diag_priority = {
        "🟢Hit (적기 소진)": 1,
        "🚨Early Shortage (5월전 품절)": 2,
        "⚠️Shortage (시즌중 품절)": 3,
        "⚪Normal": 4,
        "🔴Risk (부진)": 5,
    }
    if _COL_AI_DIAG in df.columns:
        def _rep_diag(series):
            vals = series.dropna().unique()
            if len(vals) == 0:
                return "-"
            return min(vals, key=lambda x: diag_priority.get(x, 99))
        diag_series = df.groupby(_COL_PART_CD)[_COL_AI_DIAG].apply(_rep_diag)
        style_summary = style_summary.merge(diag_series.reset_index(), on=_COL_PART_CD, how="left")

    return style_summary


def _load_color_detail() -> pd.DataFrame:
    """STEP2/3 분석 결과를 컬러 레벨 그대로 반환 (배분용)"""
    df = pd.read_excel(ANALYSIS_RESULT_PATH)
    for col in [_COL_AI_ORDER, _COL_PRICE]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def _get_color_breakdown(ref_part_cd: str, color_df: pd.DataFrame, total_qty: int) -> list:
    """ref 스타일의 컬러별 AI발주량 비중으로 total_qty를 배분"""
    rows = color_df[color_df[_COL_PART_CD] == ref_part_cd]
    if rows.empty or _COL_AI_ORDER not in rows.columns:
        return []

    color_orders = []
    for _, r in rows.iterrows():
        color_orders.append({
            "color_cd": str(r.get("COLOR_CD", "")),
            "ai_order": float(r.get(_COL_AI_ORDER, 0)),
        })

    total_ai = sum(c["ai_order"] for c in color_orders)
    if total_ai <= 0:
        return []

    colors = []
    distributed = 0
    for i, c in enumerate(color_orders):
        ratio = c["ai_order"] / total_ai
        if i == len(color_orders) - 1:
            # 마지막 컬러: 나머지 배분 (10단위 올림 오차 보정)
            qty = total_qty - distributed
        else:
            qty = _ceil_10(total_qty * ratio)
            distributed += qty
        colors.append({
            "color_cd": c["color_cd"],
            "ratio": round(ratio * 100, 1),
            "qty": max(qty, 0),
        })

    return colors


class ConfirmedMappingItem(BaseModel):
    new_part_cd: str
    new_item_nm: str
    new_class2: str
    selected_ref_part_cd: Optional[str] = None
    selected_ref_score: Optional[float] = None
    manual_order_qty: Optional[int] = None  # 매칭 불가 스타일의 수동 입력 발주량


class ConfirmedMappingRequest(BaseModel):
    season: str = "26S"
    mappings: List[ConfirmedMappingItem]


@app.post("/api/confirmed-mapping")
async def save_confirmed_mapping(req: ConfirmedMappingRequest):
    """
    유사스타일 확정 저장 + 추천발주량 계산 + 결과 저장
    1. confirmed_mapping.json 저장
    2. 확정 ref의 AI제안 발주량 조회 → 추천발주량
    3. budget_config.json 예산 천장 스케일링
    4. 26S_Order_Recommendation.json + .xlsx 저장
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. confirmed_mapping.json 저장
    confirmed = {
        "season": req.season,
        "confirmed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mappings": [m.model_dump() for m in req.mappings],
    }
    with open(CONFIRMED_MAPPING_PATH, "w", encoding="utf-8") as f:
        json.dump(confirmed, f, ensure_ascii=False, indent=2)

    # 2. 분석 결과 로드
    if not os.path.exists(ANALYSIS_RESULT_PATH):
        raise HTTPException(
            status_code=404,
            detail="25S_TimeSeries_Analysis_Result.xlsx가 없습니다. 파이프라인을 먼저 실행하세요."
        )

    style_summary = _load_style_summary()
    color_df = _load_color_detail()

    # 3. 각 확정 스타일의 추천발주량 산출
    results = []
    for m in req.mappings:
        # 수동 입력 발주량 (매칭 불가 스타일)
        if m.manual_order_qty is not None:
            results.append({
                "new_part_cd": m.new_part_cd,
                "new_item_nm": m.new_item_nm,
                "new_class2": m.new_class2,
                "추천발주량": _ceil_10(m.manual_order_qty),
                "budget_scaled": False,
                "manual_input": True,
            })
            continue

        # 유사스타일 기반 발주량
        ref_info = {}
        ai_order = 0
        if m.selected_ref_part_cd:
            ref_match = style_summary[style_summary[_COL_PART_CD] == m.selected_ref_part_cd]
            if not ref_match.empty:
                row = ref_match.iloc[0]
                ai_order = int(row.get(_COL_AI_ORDER, 0))
                ref_info = {
                    "ref_part_cd": m.selected_ref_part_cd,
                    "ref_score": m.selected_ref_score,
                    "ref_총판매": int(row.get(_COL_TOTAL_SALE, 0)),
                    "ref_총입고": int(row.get(_COL_TOTAL_INBOUND, 0)),
                    "ref_판매율": float(row.get(_COL_SELL_RATE, 0)),
                    "ref_진단": str(row.get(_COL_AI_DIAG, "-")),
                    "ref_AI발주량": ai_order,
                    "판매가": int(row.get(_COL_PRICE, 0)),
                }

        results.append({
            "new_part_cd": m.new_part_cd,
            "new_item_nm": m.new_item_nm,
            "new_class2": m.new_class2,
            "추천발주량": _ceil_10(ai_order),
            "budget_scaled": False,
            **ref_info,
        })

    # 4. 예산 천장 스케일링
    if os.path.exists(BUDGET_CONFIG_PATH):
        with open(BUDGET_CONFIG_PATH, "r", encoding="utf-8") as f:
            budget_config = json.load(f)

        ceiling_map = {}
        for cat in budget_config.get("category_budgets", []):
            ceiling_map[cat["class2"]] = cat["budget_qty"]

        if ceiling_map:
            # 카테고리별 합산
            cat_totals = {}
            for rec in results:
                cls2 = rec.get("new_class2", "")
                qty = rec.get("추천발주량", 0)
                if cls2 and qty > 0:
                    cat_totals[cls2] = cat_totals.get(cls2, 0) + qty

            # 스케일링 비율
            scale_ratios = {}
            for cls2, total_qty in cat_totals.items():
                ceiling = ceiling_map.get(cls2)
                if ceiling is not None and total_qty > ceiling and total_qty > 0:
                    scale_ratios[cls2] = ceiling / total_qty

            # 적용
            for rec in results:
                cls2 = rec.get("new_class2", "")
                ratio = scale_ratios.get(cls2)
                if ratio is not None and rec.get("추천발주량", 0) > 0:
                    rec["original_recommendation"] = rec["추천발주량"]
                    rec["추천발주량"] = _ceil_10(rec["추천발주량"] * ratio)
                    rec["budget_scaled"] = True

    # 5. 컬러별 배분
    for rec in results:
        ref_cd = rec.get("ref_part_cd")
        qty = rec.get("추천발주량", 0)
        if ref_cd and qty > 0:
            rec["colors"] = _get_color_breakdown(ref_cd, color_df, qty)
        elif rec.get("manual_input") and qty > 0:
            rec["colors"] = [{"color_cd": "-", "ratio": 100.0, "qty": qty}]
        else:
            rec["colors"] = []

    # 6. 예산 천장 정보 수집 (프론트엔드용)
    budget_info = None
    if os.path.exists(BUDGET_CONFIG_PATH):
        with open(BUDGET_CONFIG_PATH, "r", encoding="utf-8") as f:
            budget_info = json.load(f)

    # 카테고리별 합산 (프론트엔드 표시용)
    cat_summary = {}
    for rec in results:
        cls2 = rec.get("new_class2", "")
        qty = rec.get("추천발주량", 0)
        orig = rec.get("original_recommendation", qty)
        price = rec.get("ref_AI발주량", 0)  # 판매가 조회 필요
        if cls2:
            if cls2 not in cat_summary:
                cat_summary[cls2] = {"추천합계": 0, "스케일링전합계": 0}
            cat_summary[cls2]["추천합계"] += qty
            cat_summary[cls2]["스케일링전합계"] += orig

    category_budgets = []
    if budget_info:
        for cat in budget_info.get("category_budgets", []):
            cls2 = cat["class2"]
            cs = cat_summary.get(cls2, {"추천합계": 0, "스케일링전합계": 0})
            category_budgets.append({
                "class2": cls2,
                "budget_qty": cat["budget_qty"],
                "recommended_qty": cs["추천합계"],
                "pre_scale_qty": cs["스케일링전합계"],
            })

    # 7. JSON 저장
    total = len(results)
    matched = sum(1 for r in results if r.get("추천발주량", 0) > 0)
    total_qty = sum(r.get("추천발주량", 0) for r in results)
    scaled_count = sum(1 for r in results if r.get("budget_scaled"))

    output_json = {
        "metadata": {
            "season": req.season,
            "confirmed_at": confirmed["confirmed_at"],
            "total_styles": total,
            "matched_styles": matched,
            "total_recommendation_qty": total_qty,
            "scaled_count": scaled_count,
            "category_budgets": category_budgets,
        },
        "recommendations": results,
    }

    with open(ORDER_REC_JSON, "w", encoding="utf-8") as f:
        json.dump(output_json, f, ensure_ascii=False, indent=2)

    # 프론트엔드용 public JSON
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(ORDER_REC_PUBLIC_JSON, "w", encoding="utf-8") as f:
        json.dump(output_json, f, ensure_ascii=False, indent=2)

    # 8. Excel 저장 (컬러별 전개)
    if results:
        excel_rows = []
        for rec in results:
            for c in rec.get("colors", []):
                excel_rows.append({
                    "NEW_PART_CD": rec["new_part_cd"],
                    "NEW_ITEM_NM": rec["new_item_nm"],
                    "NEW_CLASS2": rec["new_class2"],
                    "COLOR_CD": c["color_cd"],
                    "비중(%)": c["ratio"],
                    "AI추천수량": c["qty"],
                    "스타일합계": rec["추천발주량"],
                    "budget_scaled": rec.get("budget_scaled", False),
                })
        if not excel_rows:
            excel_rows = [{"message": "추천 데이터 없음"}]
        edf = pd.DataFrame(excel_rows)
        with pd.ExcelWriter(ORDER_REC_EXCEL, engine="openpyxl") as writer:
            edf.to_excel(writer, index=False, sheet_name="26S 발주 추천")

    return {
        "status": "ok",
        "total_styles": total,
        "matched_styles": matched,
        "total_recommendation_qty": total_qty,
        "results": results,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
