import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Filter, X, List, Calculator } from 'lucide-react';

// ----------------------------------------------------------------------
// Helper Component: Color Mapping Modal
// ----------------------------------------------------------------------
const ColorMappingModal = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <List className="w-5 h-5 text-blue-600" />
            컬러 그룹핑 기준 (Color Mapping)
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
              <tr>
                <th className="px-4 py-2 border-b">컬러코드</th>
                <th className="px-4 py-2 border-b">컬러명</th>
                <th className="px-4 py-2 border-b">분류 그룹 (Range)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.isArray(data) && data.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-600">{item.컬러코드}</td>
                  <td className="px-4 py-2 text-gray-900">{item.컬러명}</td>
                  <td className="px-4 py-2">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold">
                      {item.ColorRange}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Main Component: Size Assortment Dashboard
// ----------------------------------------------------------------------
// Props:
//   salesData: Array<{CAT, SUB_CAT, ColorRange, SIZE_CD, SALE_QTY_CNS}>
//   mappingData: Array<{컬러코드, 컬러명, ColorRange}> (optional)
//   title: string (optional)
//   subtitle: string (optional)
// ----------------------------------------------------------------------
const SizeAssortment = ({
  salesData = [],
  mappingData = [],
  title = "신발 사이즈 최적 배분율 분석",
  subtitle = "스타일별 사이즈 비율을 최적화하여 최종 사이즈 단위 발주 수량을 산출합니다."
}) => {
  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedSubCat, setSelectedSubCat] = useState('All');
  const [selectedColorRange, setSelectedColorRange] = useState('All');
  const [showColorModal, setShowColorModal] = useState(false);

  // Simulation States
  const [isSimMode, setIsSimMode] = useState(false);
  const [simUnit, setSimUnit] = useState('5mm'); // '5mm' or '10mm'
  const [simMinSize, setSimMinSize] = useState(230);
  const [simMaxSize, setSimMaxSize] = useState(250);

  // 1. Extract Unique Options
  const uniqueCats = useMemo(() => {
    const catsWithSales = salesData.reduce((acc, curr) => {
      if (curr.SALE_QTY_CNS > 0) acc.add(curr.CAT);
      return acc;
    }, new Set());
    return ['All', ...Array.from(catsWithSales).sort()];
  }, [salesData]);

  const uniqueSubCats = useMemo(() => {
    const subCatsWithSales = salesData.reduce((acc, curr) => {
      if (curr.SALE_QTY_CNS > 0) acc.add(curr.SUB_CAT);
      return acc;
    }, new Set());
    return ['All', ...Array.from(subCatsWithSales).sort()];
  }, [salesData]);

  const uniqueColorRanges = useMemo(() => {
    return ['All', ...new Set(salesData.map(d => d.ColorRange))].sort();
  }, [salesData]);

  // 2. Main Logic: Calculate & Simulate Data
  const chartData = useMemo(() => {
    // A. Basic Filtering
    let data = salesData;
    if (selectedCat !== 'All') data = data.filter(d => d.CAT === selectedCat);
    if (selectedSubCat !== 'All') data = data.filter(d => d.SUB_CAT === selectedSubCat);

    // Calculate Reference Distribution (For Mirroring) BEFORE filtering by ColorRange
    const referenceDist = {};
    let totalRefSales = 0;
    data.forEach(d => {
        if (!referenceDist[d.SIZE_CD]) referenceDist[d.SIZE_CD] = 0;
        referenceDist[d.SIZE_CD] += d.SALE_QTY_CNS;
        totalRefSales += d.SALE_QTY_CNS;
    });

    // Now filter by Color Range
    if (selectedColorRange !== 'All') data = data.filter(d => d.ColorRange === selectedColorRange);

    // Group by Size (Initial Aggregation)
    let grouped = {};
    data.forEach(d => {
      if (!grouped[d.SIZE_CD]) grouped[d.SIZE_CD] = 0;
      grouped[d.SIZE_CD] += d.SALE_QTY_CNS;
    });

    // --- SIMULATION LOGIC START ---
    if (isSimMode) {
        const start = Number(simMinSize);
        const end = Number(simMaxSize);
        const currentTotal = Object.values(grouped).reduce((a, b) => a + b, 0);

        // Create a list of all necessary sizes (5mm step)
        const simSizes = [];
        for (let s = start; s <= end; s += 5) simSizes.push(s);

        const newGrouped = { ...grouped };

        // Apply Mirroring for missing sizes in range
        simSizes.forEach(size => {
            if (!newGrouped[size] || newGrouped[size] === 0) {
                const refVal = referenceDist[size] || 0;
                if (refVal > 0) {
                    let estimatedVal = 0;
                    if (currentTotal > 0 && totalRefSales > 0) {
                         estimatedVal = totalRefSales > 0 ? (refVal / totalRefSales) * (currentTotal || 1000) : 0;
                    } else if (totalRefSales > 0) {
                        estimatedVal = refVal;
                    }
                    newGrouped[size] = estimatedVal;
                }
            }
        });
        grouped = newGrouped;

        // Unit Conversion (5mm -> 10mm)
        if (simUnit === '10mm') {
            const tenMmGrouped = {};
            Object.keys(grouped).forEach(key => {
                const size = Number(key);
                const val = grouped[key];

                if (size % 10 === 0) {
                    if (!tenMmGrouped[size]) tenMmGrouped[size] = 0;
                    tenMmGrouped[size] += val;
                } else {
                    const down = size - 5;
                    const up = size + 5;
                    if (!tenMmGrouped[down]) tenMmGrouped[down] = 0;
                    if (!tenMmGrouped[up]) tenMmGrouped[up] = 0;
                    tenMmGrouped[down] += val / 2;
                    tenMmGrouped[up] += val / 2;
                }
            });
            grouped = tenMmGrouped;
        }

        // Cut-off (Filter by Range)
        const filteredGrouped = {};
        Object.keys(grouped).forEach(key => {
            const size = Number(key);
            if (size >= simMinSize && size <= simMaxSize) {
                filteredGrouped[size] = grouped[key];
            }
        });
        grouped = filteredGrouped;
    }
    // --- SIMULATION LOGIC END ---

    // Final Calculation: Share Renormalization
    const finalTotal = Object.values(grouped).reduce((a, b) => a + b, 0);

    return Object.keys(grouped).map(size => ({
      size: Number(size),
      sales: grouped[size],
      share: finalTotal > 0 ? (grouped[size] / finalTotal) : 0,
      isSimulated: isSimMode
    })).sort((a, b) => a.size - b.size);

  }, [salesData, selectedCat, selectedSubCat, selectedColorRange, isSimMode, simUnit, simMinSize, simMaxSize]);

  const topSize = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((prev, current) => (prev.sales > current.sales) ? prev : current);
  }, [chartData]);

  // Generate Range Options
  const sizeOptions = [];
  for(let i=180; i<=300; i+=5) sizeOptions.push(i);

  return (
    <>
      {mappingData && mappingData.length > 0 && (
        <ColorMappingModal
          isOpen={showColorModal}
          onClose={() => setShowColorModal(false)}
          data={mappingData}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-6">

          {/* Filters */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4 text-blue-700 font-semibold">
              <Filter className="w-5 h-5" />
              <span>기본 조회 조건</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                  {uniqueCats.map(opt => <option key={opt} value={opt}>{opt === 'All' ? '전체 (All)' : opt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub_Category</label>
                <select value={selectedSubCat} onChange={(e) => setSelectedSubCat(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                  {uniqueSubCats.map(opt => <option key={opt} value={opt}>{opt === 'All' ? '전체 (All)' : opt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color_Range</label>
                <select value={selectedColorRange} onChange={(e) => setSelectedColorRange(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                  {uniqueColorRanges.map(opt => <option key={opt} value={opt}>{opt === 'All' ? '전체 (All)' : opt}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Simulation Settings */}
          <div className={`p-5 rounded-xl shadow-sm border transition-all ${isSimMode ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 font-semibold text-gray-800">
                    <Calculator className="w-5 h-5" />
                    <span>발주 시뮬레이션</span>
                </div>
                <button
                    onClick={() => setIsSimMode(!isSimMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSimMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSimMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {isSimMode && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">사이즈 단위 (Unit)</label>
                        <div className="flex rounded-lg bg-gray-200 p-1">
                            <button
                                onClick={() => setSimUnit('5mm')}
                                className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${simUnit === '5mm' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                            >
                                5mm
                            </button>
                            <button
                                onClick={() => setSimUnit('10mm')}
                                className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${simUnit === '10mm' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                            >
                                10mm
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {simUnit === '10mm' ? '* 5mm 수요를 인접 10mm로 50:50 분할' : '* 원본 5mm 단위 유지'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">타겟 범위 (Target Range)</label>
                        <div className="flex items-center gap-2">
                            <select
                                value={simMinSize}
                                onChange={(e) => setSimMinSize(Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            >
                                {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <span className="text-gray-400">~</span>
                            <select
                                value={simMaxSize}
                                onChange={(e) => setSimMaxSize(Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            >
                                {sizeOptions.filter(s => s >= simMinSize).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            * 선택 범위 내 100% 재계산 (Renormalization) <br/>
                            * 데이터 없는 구간: 유사 분포 참조 (Mirroring)
                        </p>
                    </div>
                </div>
            )}
          </div>

          {mappingData && mappingData.length > 0 && (
            <button
                onClick={() => setShowColorModal(true)}
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <List className="w-4 h-4 text-gray-500" />
                컬러 그룹핑 기준 보기
              </button>
          )}
        </div>

        {/* Right Content */}
        <div className="lg:col-span-3 space-y-6">

          {/* Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 relative">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">
                        {isSimMode ? '🎯 제안 배분율 (Simulated)' : '📊 사이즈별 판매 비중 (Actual)'}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {isSimMode
                            ? `${simUnit} 단위 / 범위 ${simMinSize}~${simMaxSize}mm / 유사분포 참조`
                            : '판매 실적 원본 데이터'}
                    </p>
                </div>
                {topSize && (
                    <div className="text-right">
                        <span className="text-xs text-gray-500">최대 비중 사이즈</span>
                        <div className="font-bold text-blue-600 text-xl">{topSize.size}mm ({ (topSize.share * 100).toFixed(1) }%)</div>
                    </div>
                )}
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="size" tick={{fill: '#6b7280'}} axisLine={{stroke: '#e5e7eb'}} />
                  <YAxis tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} tick={{fill: '#6b7280'}} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{fill: '#f3f4f6'}}
                    content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                                <div className="bg-white p-3 border border-blue-100 shadow-xl rounded-lg text-sm">
                                    <p className="font-bold text-gray-800 mb-2">{label}mm</p>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">배분율:</span>
                                        <span className="font-bold text-blue-600">{(data.share * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between gap-4 mt-1">
                                        <span className="text-gray-500">{isSimMode ? '환산수량:' : '판매수량:'}</span>
                                        <span className="font-medium text-gray-900">{data.sales.toLocaleString()}</span>
                                    </div>
                                    {isSimMode && (
                                        <p className="text-xs text-blue-400 mt-2 pt-2 border-t border-gray-100">
                                            * 시뮬레이션 적용됨
                                        </p>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    }}
                  />
                  <Bar dataKey="share" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.size === topSize?.size ? '#2563eb' : (isSimMode ? '#60a5fa' : '#94a3b8')} />
                    ))}
                    <LabelList dataKey="share" position="top" formatter={(val) => val > 0 ? `${(val * 100).toFixed(1)}%` : ''} style={{fill: '#6b7280', fontSize: '11px'}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {salesData.length === 0 ? '데이터를 로드해주세요.' : '선택된 조건에 해당하는 데이터가 없습니다.'}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">
                  {isSimMode ? '발주 제안 가이드 (Proposal)' : '상세 실적 데이터'}
              </h3>
              {isSimMode && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">Simulation Active</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-3">사이즈 (mm)</th>
                    <th className="px-6 py-3 text-right">{isSimMode ? '환산 기준 수량' : '판매 실적 (Sales)'}</th>
                    <th className="px-6 py-3 text-right">최적 배분율 (%)</th>
                    <th className="px-6 py-3">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chartData.map((row) => (
                    <tr key={row.size} className={`transition-colors ${row.share >= 0.2 ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-3 font-medium text-gray-900">{row.size}</td>
                      <td className="px-6 py-3 text-right text-gray-900 font-medium">
                          {row.sales.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className={`px-2 py-1 rounded-full font-medium ${row.share >= 0.15 ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}>
                          {(row.share * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400">
                        {row.share >= 0.2 ? '★ 주력' : ''}
                      </td>
                    </tr>
                  ))}
                  {chartData.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                        데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default SizeAssortment;
