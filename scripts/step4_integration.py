"""
STEP 4: 유사스타일 맵핑 → 당시즌(26S) 발주 제안

전시즌(25S) STEP2/3 분석 결과를 기반으로, ML 유사스타일 맵핑을 통해
26S 신규 스타일의 추천 발주량을 산출합니다.

실행 순서: STEP1 → STEP2 → STEP3 → STEP4 (마지막)
"""

import os
import sys
import json
import math
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, List, Optional

import pandas as pd
import numpy as np

# ── 경로 설정 ───────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

ANALYSIS_RESULT_FILE = os.path.join(OUTPUT_DIR, "25S_TimeSeries_Analysis_Result.xlsx")
DEFAULT_MAPPING_FILE = os.path.join(DATA_DIR, "similarity_mapping.csv")
SAMPLE_MAPPING_FILE = os.path.join(DATA_DIR, "similarity_mapping_sample.csv")

OUTPUT_EXCEL = os.path.join(OUTPUT_DIR, "26S_Order_Recommendation.xlsx")
OUTPUT_JSON = os.path.join(OUTPUT_DIR, "26S_Order_Recommendation.json")

# ── 상수 ────────────────────────────────────────────────────
MIN_SCORE = 0.50          # 최소 유사도 임계값
NEW_SEASON = "26S"
REF_SEASON = "25S"

# STEP2/3 결과 컬럼명 (실제 Excel 기준)
COL_PART_CD = "PART_CD"
COL_ITEM_NM = "ITEM_NM"
COL_PRICE = "판매가"
COL_COLOR_CD = "COLOR_CD"
COL_TOTAL_ORDER = "총발주"
COL_TOTAL_INBOUND = "총입고"
COL_TOTAL_SALE = "총판매"
COL_SELL_RATE = "최종판매율"
COL_AI_DIAG = "AI_진단"
COL_AI_OPP_COST = "AI 계산 기회비용"
COL_AI_ORDER = "AI제안 발주량"


# ═══════════════════════════════════════════════════════════════
# 데이터 소스 추상화
# ═══════════════════════════════════════════════════════════════

class MappingDataSource(ABC):
    """ML 맵핑 데이터 소스 인터페이스"""
    @abstractmethod
    def load_mappings(self) -> pd.DataFrame:
        """맵핑 데이터를 DataFrame으로 반환.

        필수 컬럼: NEW_PART_CD, NEW_ITEM_NM, NEW_CLASS2,
                   REF_PART_CD_1~3, REF_SCORE_1~3, MATCHED_ATTRS
        """
        ...


class CSVMappingSource(MappingDataSource):
    """CSV 파일에서 맵핑 로드"""
    def __init__(self, filepath: str):
        self.filepath = filepath

    def load_mappings(self) -> pd.DataFrame:
        df = pd.read_csv(self.filepath, encoding="utf-8-sig")
        return df


class DBMappingSource(MappingDataSource):
    """향후 Snowflake 등 DB 연동용 (미구현)"""
    def __init__(self, **kwargs):
        self.config = kwargs

    def load_mappings(self) -> pd.DataFrame:
        raise NotImplementedError("DB 맵핑 소스는 아직 구현되지 않았습니다.")


class APIMappingSource(MappingDataSource):
    """향후 API 연동용 (미구현)"""
    def __init__(self, **kwargs):
        self.config = kwargs

    def load_mappings(self) -> pd.DataFrame:
        raise NotImplementedError("API 맵핑 소스는 아직 구현되지 않았습니다.")


def get_mapping_source(source_type: str = "csv", **kwargs) -> MappingDataSource:
    """팩토리 함수: 소스 타입에 따라 적절한 MappingDataSource 반환"""
    sources = {
        "csv": CSVMappingSource,
        "db": DBMappingSource,
        "api": APIMappingSource,
    }
    cls = sources.get(source_type)
    if cls is None:
        raise ValueError(f"알 수 없는 소스 타입: {source_type}")
    return cls(**kwargs)


# ═══════════════════════════════════════════════════════════════
# 핵심 로직
# ═══════════════════════════════════════════════════════════════

def ceil_10(x):
    """10단위 올림"""
    if pd.isna(x) or x <= 0:
        return 0
    return int(math.ceil(x / 10) * 10)


def load_analysis_result() -> pd.DataFrame:
    """STEP2/3 분석 결과 로드 및 스타일 레벨 집계"""
    print(f"  ▸ STEP2/3 결과 로드: {os.path.basename(ANALYSIS_RESULT_FILE)}")
    df = pd.read_excel(ANALYSIS_RESULT_FILE)
    print(f"    - 원본 행 수 (컬러별): {len(df)}")

    # 중복 컬럼 처리: 'AI계산 기회비용' (공백 없음) 이 있으면 'AI 계산 기회비용' (공백 있음) 우선 사용
    if "AI계산 기회비용" in df.columns and COL_AI_OPP_COST in df.columns:
        # 공백 있는 버전 사용, 없는 버전은 무시
        pass

    # 수치 컬럼 안전 변환
    for col in [COL_TOTAL_ORDER, COL_TOTAL_INBOUND, COL_TOTAL_SALE,
                COL_AI_OPP_COST, COL_AI_ORDER, COL_SELL_RATE]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # AI_진단에서 대표 진단 결정을 위한 우선순위
    diag_priority = {
        "🟢Hit (적기 소진)": 1,
        "🚨Early Shortage (5월전 품절)": 2,
        "⚠️Shortage (시즌중 품절)": 3,
        "⚪Normal": 4,
        "🔴Risk (부진)": 5,
    }

    def representative_diag(series):
        """가장 심각한(우선순위 높은) 진단을 대표 진단으로 선택"""
        vals = series.dropna().unique()
        if len(vals) == 0:
            return "-"
        return min(vals, key=lambda x: diag_priority.get(x, 99))

    # 스타일 레벨(PART_CD)로 집계
    agg_dict = {
        COL_TOTAL_ORDER: "sum",
        COL_TOTAL_INBOUND: "sum",
        COL_TOTAL_SALE: "sum",
        COL_AI_OPP_COST: "sum",
        COL_AI_ORDER: "sum",
        COL_PRICE: "first",
        COL_ITEM_NM: "first",
        COL_SELL_RATE: "mean",
    }

    # 존재하는 컬럼만 집계
    agg_dict = {k: v for k, v in agg_dict.items() if k in df.columns}

    style_summary = df.groupby(COL_PART_CD).agg(agg_dict).reset_index()

    # 대표 진단 별도 처리
    if COL_AI_DIAG in df.columns:
        diag_series = df.groupby(COL_PART_CD)[COL_AI_DIAG].apply(representative_diag)
        style_summary = style_summary.merge(diag_series.reset_index(), on=COL_PART_CD, how="left")

    # 판매율 반올림
    if COL_SELL_RATE in style_summary.columns:
        style_summary[COL_SELL_RATE] = style_summary[COL_SELL_RATE].round(1)

    print(f"    - 스타일 수 (PART_CD별): {len(style_summary)}")
    return style_summary


def get_reference_info(ref_part_cd: str, ref_score: float, style_summary: pd.DataFrame) -> Optional[dict]:
    """단일 유사스타일의 실적 정보 조회"""
    if pd.isna(ref_part_cd) or pd.isna(ref_score) or ref_score < MIN_SCORE:
        return None

    ref_part_cd = str(ref_part_cd).strip()
    match = style_summary[style_summary[COL_PART_CD] == ref_part_cd]
    if match.empty:
        return None

    row = match.iloc[0]
    return {
        "part_cd": ref_part_cd,
        "score": float(ref_score),
        "총판매": int(row.get(COL_TOTAL_SALE, 0)),
        "총발주": int(row.get(COL_TOTAL_ORDER, 0)),
        "총입고": int(row.get(COL_TOTAL_INBOUND, 0)),
        "판매율": float(row.get(COL_SELL_RATE, 0)),
        "기회비용": int(row.get(COL_AI_OPP_COST, 0)),
        "AI발주량": int(row.get(COL_AI_ORDER, 0)),
        "진단": str(row.get(COL_AI_DIAG, "-")),
        "판매가": int(row.get(COL_PRICE, 0)),
        "아이템명": str(row.get(COL_ITEM_NM, "-")),
    }


def get_top3_references(mapping_row: pd.Series, style_summary: pd.DataFrame) -> List[dict]:
    """맵핑 행에서 Top 3 유사스타일의 실적 정보 조회"""
    refs = []
    for i in range(1, 4):
        part_col = f"REF_PART_CD_{i}"
        score_col = f"REF_SCORE_{i}"
        ref_part_cd = mapping_row.get(part_col)
        ref_score = mapping_row.get(score_col, 0)
        info = get_reference_info(ref_part_cd, ref_score, style_summary)
        if info is not None:
            info["rank"] = i
            refs.append(info)
    return refs


def determine_confidence(refs: List[dict]) -> str:
    """유사스타일 매칭 신뢰도 판정"""
    if not refs:
        return "none"
    top_score = max(r["score"] for r in refs)
    valid_count = len(refs)

    if top_score >= 0.85 and valid_count >= 2:
        return "high"
    elif top_score >= 0.70 and valid_count >= 1:
        return "medium"
    elif top_score >= 0.50:
        return "low"
    return "none"


def calculate_weighted_baseline(refs: List[dict]) -> dict:
    """Top 3 유사스타일의 유사도 점수 기반 가중평균 산출"""
    if not refs:
        return {
            "가중_판매량": 0,
            "가중_판매율": 0,
            "가중_기회비용": 0,
            "가중_AI발주량": 0,
            "추천발주량": 0,
        }

    total_weight = sum(r["score"] for r in refs)
    if total_weight == 0:
        return {
            "가중_판매량": 0,
            "가중_판매율": 0,
            "가중_기회비용": 0,
            "가중_AI발주량": 0,
            "추천발주량": 0,
        }

    weighted_sale = sum(r["score"] * r["총판매"] for r in refs) / total_weight
    weighted_rate = sum(r["score"] * r["판매율"] for r in refs) / total_weight
    weighted_cost = sum(r["score"] * r["기회비용"] for r in refs) / total_weight
    weighted_ai_order = sum(r["score"] * r["AI발주량"] for r in refs) / total_weight

    return {
        "가중_판매량": round(weighted_sale),
        "가중_판매율": round(weighted_rate, 1),
        "가중_기회비용": round(weighted_cost),
        "가중_AI발주량": round(weighted_ai_order),
        "추천발주량": ceil_10(weighted_ai_order),
    }


def process_recommendations(mapping_df: pd.DataFrame, style_summary: pd.DataFrame) -> List[dict]:
    """전체 26S 스타일에 대한 추천 발주량 산출"""
    results = []
    matched = 0
    unmatched = 0

    for _, row in mapping_df.iterrows():
        new_part_cd = str(row.get("NEW_PART_CD", "")).strip()
        new_item_nm = str(row.get("NEW_ITEM_NM", "")).strip()
        new_class2 = str(row.get("NEW_CLASS2", "")).strip()

        refs = get_top3_references(row, style_summary)
        confidence = determine_confidence(refs)
        baseline = calculate_weighted_baseline(refs)

        if confidence == "none":
            unmatched += 1
        else:
            matched += 1

        rec = {
            "NEW_PART_CD": new_part_cd,
            "NEW_ITEM_NM": new_item_nm,
            "NEW_CLASS2": new_class2,
            "references": refs,
            "confidence": confidence,
            **baseline,
        }
        results.append(rec)

    print(f"    - 매칭 성공: {matched}, 매칭 불가: {unmatched}")
    return results


def save_excel(results: List[dict], output_path: str):
    """추천 결과를 Excel로 저장"""
    rows = []
    for rec in results:
        row = {
            "NEW_PART_CD": rec["NEW_PART_CD"],
            "NEW_ITEM_NM": rec["NEW_ITEM_NM"],
            "NEW_CLASS2": rec["NEW_CLASS2"],
        }

        # Top 1~3 유사스타일 상세
        for i in range(1, 4):
            prefix = f"유사스타일{i}"
            ref = next((r for r in rec["references"] if r["rank"] == i), None)
            if ref:
                row[f"{prefix}_품번"] = ref["part_cd"]
                row[f"{prefix}_유사도"] = ref["score"]
                row[f"{prefix}_총판매"] = ref["총판매"]
                row[f"{prefix}_판매율"] = ref["판매율"]
                row[f"{prefix}_진단"] = ref["진단"]
                row[f"{prefix}_AI발주량"] = ref["AI발주량"]
            else:
                row[f"{prefix}_품번"] = "-"
                row[f"{prefix}_유사도"] = "-"
                row[f"{prefix}_총판매"] = "-"
                row[f"{prefix}_판매율"] = "-"
                row[f"{prefix}_진단"] = "-"
                row[f"{prefix}_AI발주량"] = "-"

        # 가중 기준값
        row["가중_전시즌_판매량"] = rec["가중_판매량"] if rec["confidence"] != "none" else "-"
        row["가중_전시즌_판매율"] = rec["가중_판매율"] if rec["confidence"] != "none" else "-"
        row["가중_전시즌_기회비용"] = rec["가중_기회비용"] if rec["confidence"] != "none" else "-"
        row["가중_전시즌_AI발주량"] = rec["가중_AI발주량"] if rec["confidence"] != "none" else "-"
        row["26S_추천발주량"] = rec["추천발주량"] if rec["confidence"] != "none" else "-"
        row["confidence"] = rec["confidence"]
        if rec.get("budget_scaled"):
            row["budget_scaled"] = True
            row["original_recommendation"] = rec.get("original_recommendation", "-")

        rows.append(row)

    df = pd.DataFrame(rows)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="26S 발주 추천")

        # 컬럼 너비 자동 조정
        ws = writer.sheets["26S 발주 추천"]
        for col_idx, col_name in enumerate(df.columns, 1):
            max_len = max(
                len(str(col_name)),
                df[col_name].astype(str).str.len().max() if len(df) > 0 else 0
            )
            ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26
                                  else chr(64 + (col_idx - 1) // 26) + chr(65 + (col_idx - 1) % 26)
                                  ].width = min(max_len + 3, 30)

    print(f"  ▸ Excel 저장 완료: {os.path.basename(output_path)}")


def save_json(results: List[dict], output_path: str):
    """추천 결과를 JSON으로 저장"""
    total = len(results)
    matched = sum(1 for r in results if r["confidence"] != "none")

    output = {
        "metadata": {
            "new_season": NEW_SEASON,
            "ref_season": REF_SEASON,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_styles": total,
            "matched_styles": matched,
            "unmatched_styles": total - matched,
        },
        "recommendations": [],
    }

    for rec in results:
        item = {
            "new_part_cd": rec["NEW_PART_CD"],
            "new_item_nm": rec["NEW_ITEM_NM"],
            "new_class2": rec["NEW_CLASS2"],
            "references": [
                {
                    "rank": r["rank"],
                    "part_cd": r["part_cd"],
                    "score": r["score"],
                    "총판매": r["총판매"],
                    "판매율": r["판매율"],
                    "진단": r["진단"],
                    "AI발주량": r["AI발주량"],
                }
                for r in rec["references"]
            ],
            "weighted_baseline": {
                "가중_판매량": rec["가중_판매량"],
                "가중_판매율": rec["가중_판매율"],
                "가중_기회비용": rec["가중_기회비용"],
                "가중_AI발주량": rec["가중_AI발주량"],
            },
            "추천발주량": rec["추천발주량"],
            "confidence": rec["confidence"],
            "budget_scaled": rec.get("budget_scaled", False),
        }
        if rec.get("budget_scaled"):
            item["original_recommendation"] = rec.get("original_recommendation", 0)
        output["recommendations"].append(item)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  ▸ JSON 저장 완료: {os.path.basename(output_path)}")


# ═══════════════════════════════════════════════════════════════
# 예산 천장(Budget Ceiling) 자동 스케일링
# ═══════════════════════════════════════════════════════════════

BUDGET_CONFIG_FILE = os.path.join(OUTPUT_DIR, "budget_config.json")


def apply_budget_ceiling(results: List[dict]) -> List[dict]:
    """
    budget_config.json이 존재하면, 카테고리별 추천 발주량 합계가
    예산 천장을 초과할 때 비례 축소합니다.

    - 천장 이하면 스케일링 없음
    - budget_config.json이 없으면 제약 없이 기존 로직 유지
    - 스케일링된 항목에 budget_scaled=True, original_recommendation 필드 추가
    """
    if not os.path.exists(BUDGET_CONFIG_FILE):
        print("  ▸ budget_config.json 없음 → 예산 제약 없이 진행")
        return results

    with open(BUDGET_CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    # 카테고리별 예산 천장 매핑
    ceiling_map = {}
    for cat in config.get("category_budgets", []):
        ceiling_map[cat["class2"]] = cat["budget_qty"]

    if not ceiling_map:
        print("  ▸ budget_config.json에 카테고리 예산 없음 → 스킵")
        return results

    print(f"  ▸ 예산 천장 적용 중 (총 {config.get('total_budget', 0):,}장)")

    # 카테고리별 추천 발주량 합산
    cat_totals = {}
    for rec in results:
        class2 = rec.get("NEW_CLASS2", "")
        qty = rec.get("추천발주량", 0)
        if class2 and qty > 0:
            cat_totals[class2] = cat_totals.get(class2, 0) + qty

    # 카테고리별 스케일링 비율 계산
    scale_ratios = {}
    for class2, total_qty in cat_totals.items():
        ceiling = ceiling_map.get(class2)
        if ceiling is not None and total_qty > ceiling and total_qty > 0:
            scale_ratios[class2] = ceiling / total_qty
            print(f"    - {class2}: {total_qty:,} → {ceiling:,} (스케일 {scale_ratios[class2]:.2f})")
        else:
            if ceiling is not None:
                print(f"    - {class2}: {total_qty:,} ≤ {ceiling:,} (스케일링 불필요)")

    # 스케일링 적용
    scaled_count = 0
    for rec in results:
        class2 = rec.get("NEW_CLASS2", "")
        ratio = scale_ratios.get(class2)
        if ratio is not None and rec.get("추천발주량", 0) > 0:
            original = rec["추천발주량"]
            rec["original_recommendation"] = original
            rec["추천발주량"] = ceil_10(original * ratio)
            rec["budget_scaled"] = True
            scaled_count += 1
        else:
            rec["budget_scaled"] = False

    if scaled_count > 0:
        print(f"    - 스케일링된 스타일: {scaled_count}건")
    else:
        print("    - 모든 카테고리가 예산 이내 (스케일링 불필요)")

    return results


# ═══════════════════════════════════════════════════════════════
# 메인 실행
# ═══════════════════════════════════════════════════════════════

def main():
    print("\n◆ STEP 4: 유사스타일 맵핑 → 26S 발주 제안\n")

    # 1. ML 맵핑 파일 탐색
    mapping_file = None
    if os.path.exists(DEFAULT_MAPPING_FILE):
        mapping_file = DEFAULT_MAPPING_FILE
    elif os.path.exists(SAMPLE_MAPPING_FILE):
        mapping_file = SAMPLE_MAPPING_FILE
        print("  ⚠ 정식 맵핑 파일 없음 → 샘플 맵핑 파일 사용")

    if mapping_file is None:
        print("  ⚠ 맵핑 파일이 없습니다 (data/similarity_mapping.csv)")
        print("    → STEP 4를 건너뜁니다. 나머지 분석은 정상 완료되었습니다.")
        return

    # 2. STEP2/3 분석 결과 확인
    if not os.path.exists(ANALYSIS_RESULT_FILE):
        print(f"  ✗ STEP2/3 분석 결과 파일이 없습니다: {os.path.basename(ANALYSIS_RESULT_FILE)}")
        print("    → STEP 1~3을 먼저 실행해주세요.")
        sys.exit(1)

    # 3. 맵핑 로드
    print(f"  ▸ 맵핑 파일 로드: {os.path.basename(mapping_file)}")
    source = get_mapping_source("csv", filepath=mapping_file)
    mapping_df = source.load_mappings()
    print(f"    - 26S 신규 스타일 수: {len(mapping_df)}")

    # 4. STEP2/3 분석 결과 로드 & 스타일 집계
    style_summary = load_analysis_result()

    # 5. 추천 발주량 산출
    print("  ▸ 추천 발주량 산출 중...")
    results = process_recommendations(mapping_df, style_summary)

    # 5.5 예산 천장 적용 (budget_config.json이 있는 경우)
    results = apply_budget_ceiling(results)

    # 6. 출력 저장
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    save_excel(results, OUTPUT_EXCEL)
    save_json(results, OUTPUT_JSON)

    # 7. 요약 출력
    total = len(results)
    by_conf = {}
    for r in results:
        by_conf[r["confidence"]] = by_conf.get(r["confidence"], 0) + 1

    print(f"\n  ◆ 결과 요약:")
    print(f"    - 전체 스타일: {total}")
    for conf in ["high", "medium", "low", "none"]:
        cnt = by_conf.get(conf, 0)
        if cnt > 0:
            print(f"    - {conf}: {cnt}건")


if __name__ == "__main__":
    main()
