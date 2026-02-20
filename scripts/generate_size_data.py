"""
STEP 6: 사이즈 배분 데이터 생성
- SizeAssortment.example.jsx의 샘플 데이터를 JSON으로 출력
- 실데이터 확보 시 이 스크립트만 교체하면 됨
"""

import json
import os

OUTPUT_PATH = '../public/size_assortment_data.json'

SAMPLE_SALES_DATA = [
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 230, "SALE_QTY_CNS": 294},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 235, "SALE_QTY_CNS": 283},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 240, "SALE_QTY_CNS": 722},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 245, "SALE_QTY_CNS": 424},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 250, "SALE_QTY_CNS": 782},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 255, "SALE_QTY_CNS": 335},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 260, "SALE_QTY_CNS": 1129},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 265, "SALE_QTY_CNS": 968},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 270, "SALE_QTY_CNS": 1194},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 275, "SALE_QTY_CNS": 234},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "Black", "SIZE_CD": 280, "SALE_QTY_CNS": 551},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "White", "SIZE_CD": 230, "SALE_QTY_CNS": 410},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "White", "SIZE_CD": 235, "SALE_QTY_CNS": 516},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "White", "SIZE_CD": 240, "SALE_QTY_CNS": 890},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "White", "SIZE_CD": 245, "SALE_QTY_CNS": 682},
    {"CAT": "신발", "SUB_CAT": "운동화", "ColorRange": "White", "SIZE_CD": 250, "SALE_QTY_CNS": 700},
]

SAMPLE_MAPPING_DATA = [
    {"컬러코드": "BKS", "컬러명": "블랙", "ColorRange": "Black"},
    {"컬러코드": "BKD", "컬러명": "제트블랙", "ColorRange": "Black"},
    {"컬러코드": "WHM", "컬러명": "화이트 멜란지", "ColorRange": "White"},
    {"컬러코드": "WHN", "컬러명": "네온 화이트", "ColorRange": "White"},
]


def main():
    print("=" * 60)
    print("Step 6: 사이즈 배분 데이터 생성")
    print("=" * 60)

    output = {
        "salesData": SAMPLE_SALES_DATA,
        "mappingData": SAMPLE_MAPPING_DATA,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  * 판매 데이터: {len(SAMPLE_SALES_DATA)}건")
    print(f"  * 매핑 데이터: {len(SAMPLE_MAPPING_DATA)}건")
    print(f"  * 저장 완료: {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
