"""
STEP 2: 배치 예산 제안
- public/season_closing_data.json 읽기 (main.py 산출물)
- 룰 기반 예산 제안 생성 (server/api.py _fallback_proposal 로직 포팅)
- output/budget_config.json 저장 (step4_integration.py가 읽는 형식)
"""

import json
import os
import math
from datetime import datetime, timezone

SEASON_CLOSING_PATH = '../public/season_closing_data.json'
BUDGET_CONFIG_PATH = '../output/budget_config.json'


def load_season_closing():
    if not os.path.exists(SEASON_CLOSING_PATH):
        print(f"  [오류] {SEASON_CLOSING_PATH} 파일을 찾을 수 없습니다.")
        return None
    with open(SEASON_CLOSING_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def rule_based_proposal(summary, class_analysis):
    """룰 기반 예산 제안 (server/api.py _fallback_proposal 로직 포팅)"""
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

        # 발주수량 역산: 목표매출 / 평균단가 / 목표판매율(0.75)
        budget_qty = 0
        if avg_price > 0:
            budget_qty = math.ceil(target_revenue / avg_price / 0.75 / 10) * 10

        category_targets.append({
            "class2": class2,
            "budget_amt": target_revenue,
            "budget_qty": budget_qty,
            "avg_price": avg_price,
        })

    # 비중 계산
    total_target_rev = sum(c["budget_amt"] for c in category_targets)
    if total_target_rev > 0:
        for c in category_targets:
            c["share_pct"] = round(c["budget_amt"] / total_target_rev * 100, 1)

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

    total_budget_qty = sum(c["budget_qty"] for c in category_targets)

    return {
        "season": "26S",
        "confirmed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ai_commentary": ai_commentary,
        "target_total_revenue": target_total_revenue,
        "total_budget_amt": target_total_revenue,
        "total_budget_qty": total_budget_qty,
        "category_budgets": category_targets,
    }


def main():
    print("=" * 60)
    print("Step 2: AI 예산 제안 (Budget Proposal)")
    print("=" * 60)

    data = load_season_closing()
    if data is None:
        return

    summary = data.get("summary", {})
    class_analysis = data.get("class_analysis", [])

    print(f"  * 전시즌 총판매금액: {summary.get('total_sale_amt', 0):,}원")
    print(f"  * 전시즌 판매율: {summary.get('sell_through_rate', 0)}%")
    print(f"  * 카테고리 수: {len(class_analysis)}개")

    result = rule_based_proposal(summary, class_analysis)

    print(f"\n  [제안 결과]")
    print(f"  * {result['ai_commentary']}")
    print(f"  * 목표 총매출: {result['target_total_revenue']:,}원")
    print(f"  * 총 발주수량: {result['total_budget_qty']:,}장")
    for cat in result["category_budgets"]:
        print(f"    - {cat['class2']}: {cat['budget_amt']:,}원 / {cat['budget_qty']:,}장")

    # 저장
    os.makedirs(os.path.dirname(BUDGET_CONFIG_PATH), exist_ok=True)
    with open(BUDGET_CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n  * 예산 설정 저장 완료: {BUDGET_CONFIG_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
