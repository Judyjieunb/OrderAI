/**
 * SizeAssortment 컴포넌트 사용 예시
 *
 * 이 파일은 SizeAssortment.jsx 사용법을 보여주는 예시입니다.
 * 실제 사용 시 데이터를 외부에서 로드하여 props로 전달하면 됩니다.
 */

import React, { useState, useEffect } from 'react';
import SizeAssortment from './SizeAssortment';

// ============================================================
// 방법 1: JSON 파일에서 데이터 import
// ============================================================
// import salesData from '../data/salesData.json';
// import mappingData from '../data/mappingData.json';
//
// function App() {
//   return (
//     <SizeAssortment
//       salesData={salesData}
//       mappingData={mappingData}
//     />
//   );
// }

// ============================================================
// 방법 2: API에서 데이터 fetch
// ============================================================
// function App() {
//   const [salesData, setSalesData] = useState([]);
//   const [mappingData, setMappingData] = useState([]);
//   const [loading, setLoading] = useState(true);
//
//   useEffect(() => {
//     Promise.all([
//       fetch('/api/sales-data').then(res => res.json()),
//       fetch('/api/mapping-data').then(res => res.json())
//     ]).then(([sales, mapping]) => {
//       setSalesData(sales);
//       setMappingData(mapping);
//       setLoading(false);
//     });
//   }, []);
//
//   if (loading) return <div>Loading...</div>;
//
//   return (
//     <SizeAssortment
//       salesData={salesData}
//       mappingData={mappingData}
//     />
//   );
// }

// ============================================================
// 방법 3: 샘플 데이터로 테스트
// ============================================================
const SAMPLE_SALES_DATA = [
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
];

const SAMPLE_MAPPING_DATA = [
  {"컬러코드": "BKS", "컬러명": "블랙", "ColorRange": "Black"},
  {"컬러코드": "BKD", "컬러명": "제트블랙", "ColorRange": "Black"},
  {"컬러코드": "WHM", "컬러명": "화이트 멜란지", "ColorRange": "White"},
  {"컬러코드": "WHN", "컬러명": "네온 화이트", "ColorRange": "White"},
];

function SizeAssortmentExample() {
  return (
    <SizeAssortment
      salesData={SAMPLE_SALES_DATA}
      mappingData={SAMPLE_MAPPING_DATA}
      title="사이즈 배분율 분석 (예시)"
      subtitle="샘플 데이터를 사용한 데모입니다."
    />
  );
}

export default SizeAssortmentExample;

// ============================================================
// Props 상세 설명
// ============================================================
/**
 * @typedef {Object} SalesDataItem
 * @property {string} CAT - 카테고리 (예: "신발", "아동화")
 * @property {string} SUB_CAT - 서브카테고리 (예: "운동화", "썸머", "윈터")
 * @property {string} ColorRange - 컬러 그룹 (예: "Black", "White", "Beige/Ivory")
 * @property {number} SIZE_CD - 사이즈 코드 (예: 230, 235, 240...)
 * @property {number} SALE_QTY_CNS - 판매 수량
 */

/**
 * @typedef {Object} MappingDataItem
 * @property {string} 컬러코드 - 컬러 코드 (예: "BKS", "WHM")
 * @property {string} 컬러명 - 컬러명 (예: "블랙", "화이트 멜란지")
 * @property {string} ColorRange - 컬러 그룹 (예: "Black", "White")
 */

/**
 * SizeAssortment Props
 * @param {SalesDataItem[]} salesData - 판매 데이터 배열 (필수)
 * @param {MappingDataItem[]} mappingData - 컬러 매핑 데이터 배열 (선택)
 * @param {string} title - 대시보드 제목 (선택, 기본값: "신발 사이즈 최적 배분율 분석")
 * @param {string} subtitle - 대시보드 부제목 (선택)
 */
