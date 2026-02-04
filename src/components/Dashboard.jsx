import React, { useState, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { TrendingUp, AlertTriangle, Package, ShoppingCart, ArrowRight, Loader2, Percent, TrendingDown } from 'lucide-react';

// --- 1. 툴팁 컴포넌트 (기회비용 표시 로직 포함) ---
const CustomTooltip = ({ active, payload, label, isSuccess }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-lg text-sm z-50">
        <p className="font-bold mb-2 text-gray-700">{label} 주차</p>

        {/* 잠재 판매량 (기회비용 발생 시에만 표시 - 실패 케이스만) */}
        {!isSuccess && data.potential_sale > data.sale && (
          <p className="text-red-500 flex items-center font-bold mb-1">
            <TrendingUp size={14} className="mr-1" /> 잠재수요: {data.potential_sale.toLocaleString()}
            <span className="text-xs ml-1 font-normal">(Loss: -{(data.potential_sale - data.sale).toLocaleString()})</span>
          </p>
        )}

        <p className="text-blue-600 flex items-center">
          <ShoppingCart size={14} className="mr-1" /> 실판매: {data.sale.toLocaleString()}
        </p>
        <p className="text-gray-500 flex items-center">
          <Package size={14} className="mr-1" /> 재고량: {data.stock.toLocaleString()}
        </p>
        <p className="text-gray-600 flex items-center">
          <Percent size={14} className="mr-1" /> 판매율: {data.sellThrough ? `${data.sellThrough}%` : '-'}
        </p>
        {data.in > 0 && (
          <div className="mt-2 p-1 bg-green-100 text-green-800 rounded font-bold text-center">
            +{data.in.toLocaleString()} 입고
          </div>
        )}
        {data.label && !data.label.includes('리오더') && (
          <div className={`mt-2 p-1 rounded font-bold text-center ${data.label.includes('품절') || data.label.includes('재고부족')
            ? 'bg-red-100 text-red-800'
            : 'bg-gray-100 text-gray-800'
            }`}>
            {data.label.includes('품절') ? '⚠️ ' : ''}
            {data.label}
          </div>
        )}
      </div>
    );
  }
  return null;
};

// --- 2. 범례 컴포넌트 ---
const CustomLegend = ({ payload }) => {
  return (
    <div className="flex justify-end gap-3 mb-2 flex-wrap">
      {payload.map((entry, index) => {
        if (entry.dataKey === 'potential_sale') {
          return (
            <div key={index} className="flex items-center gap-1">
              <div style={{ width: '20px', height: '0px', borderTop: '2px dashed #ef4444', marginTop: '2px' }}></div>
              <span className="text-xs text-red-600 font-bold">{entry.value}</span>
            </div>
          );
        } else if (entry.dataKey === 'in' || entry.value === '추가입고') {
          return (
            <div key={index} className="flex items-center gap-1">
              <svg width="10" height="10" className="flex-shrink-0">
                <circle cx="5" cy="5" r="4" fill="#2563eb" stroke="white" strokeWidth="1" />
              </svg>
              <span className="text-xs text-gray-700">{entry.value}</span>
            </div>
          );
        } else {
          return (
            <div key={index} className="flex items-center gap-1">
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: entry.color,
                  borderRadius: entry.type === 'monotone' ? '0' : '2px'
                }}
              />
              <span className="text-xs text-gray-700">{entry.value}</span>
            </div>
          );
        }
      })}
    </div>
  );
};

// --- 3. 메인 차트 섹션 (핵심 로직 수정됨) ---
const ChartSection = ({ title, subTitle, totalData, colorsData, type }) => {
  const isSuccess = type === 'success';
  const titleColor = isSuccess ? 'text-green-700' : 'text-red-700';

  // [수정] 탭 초기값은 항상 'total' (강제 이동 로직 제거)
  const [activeTab, setActiveTab] = useState('total');

  const colorList = colorsData ? Object.keys(colorsData) : [];

  const getCurrentData = () => {
    if (activeTab === 'total' && totalData) {
      return totalData;
    } else if (activeTab !== 'total' && colorsData && colorsData[activeTab]) {
      return colorsData[activeTab];
    }
    return null;
  };

  const currentData = getCurrentData();
  const rawData = currentData?.chartData || [];
  const itemInfo = currentData?.itemInfo || {};
  const analysis = currentData?.analysis || {};

  let cumSale = 0;
  let cumIn = 0;

  // 데이터 가공 및 '잠재 수요' 필드 확보 (Python에서 이미 필터링됨)
  const data = rawData.map(item => {
    const sale = Math.max(0, item.sale || 0);
    const stock = Math.max(0, item.stock || 0);
    const inQty = Math.max(0, item.in || 0);
    cumSale += sale;
    cumIn += inQty;
    const sellThrough = cumIn > 0 ? (cumSale / cumIn * 100) : 0;

    // 잠재 판매량 (없으면 predicted_sale 혹은 0 사용)
    const potential_sale = item.potential_sale !== undefined ? item.potential_sale : (item.predicted_sale || 0);

    return {
      ...item,
      sale,
      stock,
      in: inQty,
      cumSale,
      cumIn,
      potential_sale,
      sellThrough: Math.round(sellThrough * 10) / 10
    };
  });

  const areaColor = isSuccess ? '#dcfce7' : '#fee2e2';
  const stockStroke = isSuccess ? '#16a34a' : '#dc2626';

  const stockOutDate = analysis && analysis['결품시점'] && analysis['결품시점'] !== '-'
    ? (() => {
      const dateParts = analysis['결품시점'].split('-');
      if (dateParts.length === 3) {
        return `${dateParts[1]}/${dateParts[2]}`;
      }
      return null;
    })()
    : null;

  // [수정] 단가 하드코딩 제거 (데이터에서 가져오거나 없으면 0)
  const price = itemInfo.price || totalData?.itemInfo?.price || 0;

  // 총 기회비용 수량 및 금액 계산
  // Python에서 이미 계산된 loss 필드를 사용
  const totalLossQty = rawData.reduce((acc, cur) => {
    // 데이터에 loss 필드가 있으면 사용, 없으면 직접 계산
    if (cur.loss !== undefined && cur.loss !== null) {
      return acc + cur.loss;
    }
    // loss 필드가 없는 경우 직접 계산
    const p = cur.potential_sale || 0;
    const s = cur.sale || 0;
    const loss = p > s ? p - s : 0;
    return acc + loss;
  }, 0);

  const estimatedLossAmount = totalLossQty * price;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 min-w-0 flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isSuccess ? <TrendingUp className="text-green-600" /> : <AlertTriangle className="text-red-600" />}
            <h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3>
          </div>
          <p className="text-gray-500 text-sm">{subTitle}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-bold text-gray-800">{itemInfo.name || totalData?.itemInfo?.name || ''}</p>
          <p className="text-gray-500">
            {itemInfo.code || totalData?.itemInfo?.code || ''}
            {itemInfo.color && itemInfo.color !== '전체' ? ` / ${itemInfo.color}` : ''}
          </p>
          {/* 가격 정보가 있으면 표시 */}
          {price > 0 && <p className="text-gray-400 mt-1">￦{price.toLocaleString()}</p>}
        </div>
      </div>

      {/* 탭 버튼 영역 */}
      <div className="mb-2 border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('total')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'total'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            스타일 전체
          </button>
          {colorList.map(color => (
            <button
              key={color}
              onClick={() => setActiveTab(color)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${activeTab === color
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={2} />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" domain={[0, 'auto']} tick={{ fontSize: 11 }} width={35} />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={[0, 'auto']} tick={{ fontSize: 11 }} width={35} />
            <Tooltip content={<CustomTooltip isSuccess={isSuccess} />} />
            <Legend content={<CustomLegend />} verticalAlign="top" height={24} />

            <Area yAxisId="left" type="monotone" dataKey="stock" fill={areaColor} stroke={stockStroke} name="Stock" fillOpacity={0.6} />

            {/* 잠재 판매량 (기회비용) - 붉은색 점선 (실패 케이스만) */}
            {!isSuccess && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="potential_sale"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="AI Predicted Demand"
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}

            <Bar yAxisId="right" dataKey="sale" barSize={12} fill="#94a3b8" name="WeeklySales" radius={[2, 2, 0, 0]} />

            <Line yAxisId="left" type="step" dataKey="in" stroke="none"
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.in > 0) {
                  return (
                    <g key={`dot-${payload.date}`}>
                      <circle cx={cx} cy={cy} r={4} fill="#2563eb" stroke="white" strokeWidth={1} />
                      <text x={cx} y={cy - 10} textAnchor="middle" fill="#2563eb" fontSize={10} fontWeight="bold">입고</text>
                    </g>
                  );
                }
                return <></>;
              }}
              name="InStock"
            />

            {!isSuccess && stockOutDate && (
              <ReferenceLine yAxisId="left" x={stockOutDate} stroke="red" strokeDasharray="3 3" label={{ value: '재고소진', position: 'insideTop', fill: 'red', fontSize: 10, fontWeight: 'bold' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto flex gap-0 rounded-lg overflow-hidden text-xs bg-gray-50 border border-gray-200">
        <div className="p-3 border-r border-gray-200" style={{ width: '30%' }}>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-gray-500">누계발주</span>
              <span className="font-bold">{analysis['총발주']?.toLocaleString() || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">누계입고</span>
              <span className="font-bold">{analysis['총입고']?.toLocaleString() || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">누계판매</span>
              <span className="font-bold">{analysis['총판매']?.toLocaleString() || '-'}</span>
            </div>
            <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200">
              <span className="text-gray-600 font-bold">마감 ST%</span>
              <span className={`font-bold ${analysis['최종판매율'] >= 80 ? 'text-green-600' : analysis['최종판매율'] <= 40 ? 'text-red-600' : 'text-gray-800'}`}>
                {analysis['최종판매율']}%
              </span>
            </div>
          </div>
        </div>

        <div className="p-3" style={{ width: '70%' }}>
          <h4 className="font-bold mb-1 flex items-center text-gray-800">
            <ArrowRight size={12} className="mr-1" /> AI 패턴 진단
          </h4>

          {isSuccess ? (
            <p className="leading-tight text-green-700">
              초도 발주 적중율이 높았거나 시즌 중 적시 리오더 투입으로 판매 모멘텀을 유지한 Best Practice입니다.
            </p>
          ) : (
            totalLossQty > 0 ? (
              <div className="space-y-2">
                <p className="text-red-600 leading-tight">
                  시즌 중 물량 공백으로 매출로스가 발생되었습니다.
                </p>
                <div className="bg-white border border-red-200 rounded p-2 flex items-center justify-between shadow-sm">
                  <div className="flex items-center text-red-600">
                    <TrendingDown size={14} className="mr-1" />
                    <span className="font-bold">기회비용</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600">-{totalLossQty.toLocaleString()}장</div>
                    <div className="text-[10px] text-red-400">약 {estimatedLossAmount.toLocaleString()}원</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="leading-tight text-gray-600">
                판매 추이가 정상적이나 재고 운영 효율화가 필요합니다.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

// --- 4. 진단명 필터 옵션 정의 ---
const DIAGNOSIS_OPTIONS = {
  success: [
    { key: 'hit', label: '🟢 Hit (적기 소진)', description: '시즌 후반 적시 소진 혹은 적정 판매율을 달성한 케이스입니다.' },
    { key: 'normal', label: '⚪ Normal', description: '정상 판매 (55~80%)' }
  ],
  failure: [
    { key: 'early_shortage', label: '🚨 Early Shortage', description: '시즌 중 품절되었거나 판매 부진했던 케이스입니다.' },
    { key: 'shortage', label: '⚠️ Shortage (시즌중)', description: '시즌중 품절' },
    { key: 'risk', label: '🔴 Risk (부진)', description: '판매율 55% 미만' }
  ]
};

// --- 5. 최상위 앱 컴포넌트 ---
const App = () => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState({ success: {}, failure: {} });

  // 진단명 필터 상태
  const [selectedSuccessDiagnosis, setSelectedSuccessDiagnosis] = useState('hit');
  const [selectedFailureDiagnosis, setSelectedFailureDiagnosis] = useState('early_shortage');

  // 스타일 선택 상태
  const [selectedSuccessIdx, setSelectedSuccessIdx] = useState(0);
  const [selectedFailureIdx, setSelectedFailureIdx] = useState(0);

  useEffect(() => {
    // 실제 데이터 파일 로드
    const loadDashboardData = async () => {
      try {
        const response = await fetch('./dashboard_data.json'); // Vite public 폴더 기준
        if (!response.ok) {
          throw new Error('데이터 파일을 찾을 수 없습니다.');
        }
        const data = await response.json();

        // 새로운 데이터 구조: success/failure 하위에 진단별 배열
        setRawData({
          success: data.success || {},
          failure: data.failure || {}
        });
        setLoading(false);
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // 진단 변경 시 스타일 인덱스 초기화
  useEffect(() => {
    setSelectedSuccessIdx(0);
  }, [selectedSuccessDiagnosis]);

  useEffect(() => {
    setSelectedFailureIdx(0);
  }, [selectedFailureDiagnosis]);

  // 현재 선택된 진단의 데이터 배열
  const successData = rawData.success[selectedSuccessDiagnosis] || [];
  const failureData = rawData.failure[selectedFailureDiagnosis] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={48} />
          <p className="text-gray-600">AI 분석 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (successData.length === 0 && failureData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center bg-white p-8 rounded-xl shadow-md">
          <AlertTriangle className="mx-auto mb-4 text-yellow-600" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">데이터가 없습니다</h2>
          <p className="text-gray-600 mb-4">분석된 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  const currentSuccessData = successData[selectedSuccessIdx];
  const currentFailureData = failureData[selectedFailureIdx];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 성공 사례 */}
          <div className="h-full flex flex-col gap-3">
            {/* 2개 드롭다운: 진단 필터 + 스타일 선택 */}
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
              <div className="flex gap-3">
                {/* 진단 필터 */}
                <div className="flex-1">
                  <label className="block text-xs font-bold text-green-600 mb-2">
                    AI 진단
                  </label>
                  <select
                    value={selectedSuccessDiagnosis}
                    onChange={(e) => setSelectedSuccessDiagnosis(e.target.value)}
                    className="w-full px-3 py-2 border border-green-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                  >
                    {DIAGNOSIS_OPTIONS.success.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 스타일 선택 */}
                <div className="flex-[2]">
                  <label className="block text-xs font-bold text-gray-600 mb-2">
                    PRODUCT ({successData.length}sty)
                  </label>
                  <select
                    value={selectedSuccessIdx}
                    onChange={(e) => setSelectedSuccessIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={successData.length === 0}
                  >
                    {successData.length === 0 ? (
                      <option>해당 진단 데이터 없음</option>
                    ) : (
                      successData.map((item, idx) => {
                        const code = item.total.itemInfo.code;
                        const prdtNm = item.total.itemInfo.prdt_nm || item.total.itemInfo.name;
                        return (
                          <option key={idx} value={idx}>
                            {code} - {prdtNm}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>
            </div>

            {successData.length > 0 ? (
              <ChartSection
                type="success"
                title="Success Case"
                subTitle={DIAGNOSIS_OPTIONS.success.find(o => o.key === selectedSuccessDiagnosis)?.description || ''}
                totalData={currentSuccessData?.total}
                colorsData={currentSuccessData?.colors}
              />
            ) : (
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center justify-center h-64">
                <p className="text-gray-400">선택한 진단에 해당하는 데이터가 없습니다.</p>
              </div>
            )}
          </div>

          {/* 실패 사례 */}
          <div className="h-full flex flex-col gap-3">
            {/* 2개 드롭다운: 진단 필터 + 스타일 선택 */}
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
              <div className="flex gap-3">
                {/* 진단 필터 */}
                <div className="flex-1">
                  <label className="block text-xs font-bold text-red-600 mb-2">
                    AI 진단
                  </label>
                  <select
                    value={selectedFailureDiagnosis}
                    onChange={(e) => setSelectedFailureDiagnosis(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50"
                  >
                    {DIAGNOSIS_OPTIONS.failure.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 스타일 선택 */}
                <div className="flex-[2]">
                  <label className="block text-xs font-bold text-gray-600 mb-2">
                    PRODUCT ({failureData.length}sty)
                  </label>
                  <select
                    value={selectedFailureIdx}
                    onChange={(e) => setSelectedFailureIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={failureData.length === 0}
                  >
                    {failureData.length === 0 ? (
                      <option>해당 진단 데이터 없음</option>
                    ) : (
                      failureData.map((item, idx) => {
                        const code = item.total.itemInfo.code;
                        const prdtNm = item.total.itemInfo.prdt_nm || item.total.itemInfo.name;
                        return (
                          <option key={idx} value={idx}>
                            {code} - {prdtNm}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>
            </div>

            {failureData.length > 0 ? (
              <ChartSection
                type="failure"
                title="Failure Case"
                subTitle={DIAGNOSIS_OPTIONS.failure.find(o => o.key === selectedFailureDiagnosis)?.description || ''}
                totalData={currentFailureData?.total}
                colorsData={currentFailureData?.colors}
              />
            ) : (
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center justify-center h-64">
                <p className="text-gray-400">선택한 진단에 해당하는 데이터가 없습니다.</p>
              </div>
            )}
          </div>
    </div>
  );
};

export default App;