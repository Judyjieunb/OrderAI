"""
STEP 5: 유사스타일 맵핑 데이터 생성 (프론트엔드용)

전시즌(25S) STEP2/3 분석 결과를 기반으로, ML 유사스타일 맵핑 데이터를
프론트엔드에서 사용할 JSON으로 변환합니다.

유저가 프론트엔드 Step 3에서 유사스타일을 확정하면,
서버 API가 확정 결과를 바탕으로 추천발주량을 산출합니다.

실행 순서: STEP1 → STEP2 → STEP3 → STEP4 → STEP5 (이 스크립트)
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
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

ANALYSIS_RESULT_FILE = os.path.join(OUTPUT_DIR, "25S_TimeSeries_Analysis_Result.xlsx")
DEFAULT_MAPPING_FILE = os.path.join(DATA_DIR, "similarity_mapping.csv")
SAMPLE_MAPPING_FILE = os.path.join(DATA_DIR, "similarity_mapping_sample.csv")

OUTPUT_JSON = os.path.join(PUBLIC_DIR, "style_mapping_data.json")

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

    # 스타일 레벨(PART_CD)로 집계 — 판매율은 mean이 아닌 sum/sum으로 직접 계산
    agg_dict = {
        COL_TOTAL_ORDER: "sum",
        COL_TOTAL_INBOUND: "sum",
        COL_TOTAL_SALE: "sum",
        COL_AI_OPP_COST: "sum",
        COL_AI_ORDER: "sum",
        COL_PRICE: "first",
        COL_ITEM_NM: "first",
    }

    # 존재하는 컬럼만 집계
    agg_dict = {k: v for k, v in agg_dict.items() if k in df.columns}

    style_summary = df.groupby(COL_PART_CD).agg(agg_dict).reset_index()

    # 판매율 = 총판매 / 총입고 * 100 (mean 버그 수정)
    if COL_TOTAL_SALE in style_summary.columns and COL_TOTAL_INBOUND in style_summary.columns:
        style_summary[COL_SELL_RATE] = (
            style_summary[COL_TOTAL_SALE] / style_summary[COL_TOTAL_INBOUND].replace(0, np.nan) * 100
        ).fillna(0).round(1)

    # 대표 진단 별도 처리
    if COL_AI_DIAG in df.columns:
        diag_series = df.groupby(COL_PART_CD)[COL_AI_DIAG].apply(representative_diag)
        style_summary = style_summary.merge(diag_series.reset_index(), on=COL_PART_CD, how="left")

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


def generate_style_mapping_json(mapping_df: pd.DataFrame, style_summary: pd.DataFrame) -> dict:
    """전체 26S 스타일에 대한 맵핑 JSON 생성 (프론트엔드용)"""
    styles = []
    matched = 0
    unmatched = 0

    for _, row in mapping_df.iterrows():
        new_part_cd = str(row.get("NEW_PART_CD", "")).strip()
        new_item_nm = str(row.get("NEW_ITEM_NM", "")).strip()
        new_class2 = str(row.get("NEW_CLASS2", "")).strip()

        refs = get_top3_references(row, style_summary)

        if refs:
            matched += 1
        else:
            unmatched += 1

        styles.append({
            "new_part_cd": new_part_cd,
            "new_item_nm": new_item_nm,
            "new_class2": new_class2,
            "references": [
                {
                    "rank": r["rank"],
                    "part_cd": r["part_cd"],
                    "item_nm": r["아이템명"],
                    "score": r["score"],
                    "총판매": r["총판매"],
                    "총입고": r["총입고"],
                    "판매율": r["판매율"],
                    "진단": r["진단"],
                    "AI발주량": r["AI발주량"],
                    "기회비용": r["기회비용"],
                    "판매가": r["판매가"],
                }
                for r in refs
            ],
        })

    print(f"    - 매칭 성공: {matched}, 매칭 불가: {unmatched}")

    output = {
        "metadata": {
            "new_season": NEW_SEASON,
            "ref_season": REF_SEASON,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_styles": len(styles),
            "matched_styles": matched,
            "unmatched_styles": unmatched,
        },
        "styles": styles,
    }
    return output


# ═══════════════════════════════════════════════════════════════
# 메인 실행
# ═══════════════════════════════════════════════════════════════

def main():
    print("\n◆ STEP 5: 유사스타일 맵핑 데이터 생성 (프론트엔드용)\n")

    # 1. ML 맵핑 파일 탐색
    mapping_file = None
    if os.path.exists(DEFAULT_MAPPING_FILE):
        mapping_file = DEFAULT_MAPPING_FILE
    elif os.path.exists(SAMPLE_MAPPING_FILE):
        mapping_file = SAMPLE_MAPPING_FILE
        print("  ⚠ 정식 맵핑 파일 없음 → 샘플 맵핑 파일 사용")

    if mapping_file is None:
        print("  ⚠ 맵핑 파일이 없습니다 (data/similarity_mapping.csv)")
        print("    → STEP 5를 건너뜁니다. 나머지 분석은 정상 완료되었습니다.")
        return

    # 2. STEP2/3 분석 결과 확인
    if not os.path.exists(ANALYSIS_RESULT_FILE):
        print(f"  ✗ STEP2/3 분석 결과 파일이 없습니다: {os.path.basename(ANALYSIS_RESULT_FILE)}")
        print("    → STEP 1~4를 먼저 실행해주세요.")
        sys.exit(1)

    # 3. 맵핑 로드
    print(f"  ▸ 맵핑 파일 로드: {os.path.basename(mapping_file)}")
    source = get_mapping_source("csv", filepath=mapping_file)
    mapping_df = source.load_mappings()
    print(f"    - 26S 신규 스타일 수: {len(mapping_df)}")

    # 4. STEP2/3 분석 결과 로드 & 스타일 집계
    style_summary = load_analysis_result()

    # 5. 맵핑 JSON 생성
    print("  ▸ 맵핑 데이터 생성 중...")
    output = generate_style_mapping_json(mapping_df, style_summary)

    # 6. JSON 저장
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"  ▸ JSON 저장 완료: {os.path.basename(OUTPUT_JSON)}")

    # 7. 요약 출력
    meta = output["metadata"]
    print(f"\n  ◆ 결과 요약:")
    print(f"    - 전체 스타일: {meta['total_styles']}")
    print(f"    - 매칭 성공: {meta['matched_styles']}")
    print(f"    - 매칭 불가: {meta['unmatched_styles']}")


if __name__ == "__main__":
    main()
