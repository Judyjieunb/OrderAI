import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  LabelList,
  ReferenceLine
} from 'recharts';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Package, ShoppingCart, Sparkles, DollarSign, HelpCircle, X } from 'lucide-react';
import BudgetControl from './BudgetControl.jsx';

// BCG 색상 매핑
const BCG_COLORS = {
  'Star': '#FFD700',
  'Cash Cow': '#32CD32',
  'Problem Child': '#FF6B6B',
  'Question Mark': '#87CEEB'
};

// 등급 색상 매핑
const GRADE_COLORS = {
  'S': '#EF4444',
  'A': '#F97316',
  'B': '#22C55E',
  'C': '#EAB308',
  'D': '#9CA3AF'
};

// 액션 색상 매핑
const ACTION_COLORS = {
  'Aggressive': '#EF4444',
  'Expand': '#F97316',
  'Maintain': '#22C55E',
  'Observation': '#EAB308',
  'Cut/Drop': '#9CA3AF'
};

// KPI 카드 컴포넌트
const KPICard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon size={18} className={color || 'text-gray-500'} />}
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
  </div>
);

// 복종 밸런스 커스텀 툴팁
const BalanceTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm max-w-xs">
        <p className="font-bold mb-1 text-gray-700">{data.class2}</p>
        <p className="text-gray-500">물량비중: {data.volume_share}%</p>
        <p className="text-blue-600">판매비중: {data.sales_share}%</p>
        <p className={`font-bold ${data.balance_delta > 0 ? 'text-green-600' : data.balance_delta < -5 ? 'text-red-600' : 'text-gray-600'}`}>
          비중차이: {data.balance_delta > 0 ? '+' : ''}{data.balance_delta}%p
        </p>
        <p className="text-gray-400 text-xs mt-1">판매율: {data.sell_through_rate}%</p>
        {data.ai_comment && (
          <p className="text-gray-600 text-xs mt-2 pt-2 border-t border-gray-100 leading-relaxed">{data.ai_comment}</p>
        )}
      </div>
    );
  }
  return null;
};

// BCG 툴팁
const BCGTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm max-w-sm">
        <p className="font-bold mb-1 text-gray-700">{data.item_nm}</p>
        <p className="text-gray-500">복종: {data.class2}</p>
        <p className="text-gray-500">물량비중: {data.volume_share}%</p>
        <p className="text-gray-500">판매율: {data.sell_through_rate}%</p>
        <p className="text-gray-500">판매비중: {data.sales_share}%</p>
        <p className={`font-bold mt-1`} style={{ color: BCG_COLORS[data.bcg_class] || '#808080' }}>
          {data.bcg_class} ({data.grade})
        </p>
        {data.ai_comment && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles size={12} className="text-violet-500" />
              <span className="text-violet-600 text-xs font-medium">AI 코멘트</span>
            </div>
            <p className="text-gray-600 text-xs leading-relaxed">{data.ai_comment}</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// 액션 탭 설정
const ACTION_TABS = [
  { key: 'Aggressive', label: 'Aggressive', color: '#EF4444', desc: '물량 30%+ 확대' },
  { key: 'Expand', label: 'Expand', color: '#F97316', desc: '물량 확대 검토' },
  { key: 'Maintain', label: 'Maintain', color: '#22C55E', desc: '현행 유지' },
  { key: 'Observation', label: 'Observation', color: '#EAB308', desc: '관찰 필요' },
  { key: 'Cut/Drop', label: 'Cut/Drop', color: '#9CA3AF', desc: '축소/Drop' }
];

const SeasonClosing = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showBudget, setShowBudget] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState('Aggressive');
  const [showBCGGuide, setShowBCGGuide] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('./season_closing_data.json');
        if (!response.ok) throw new Error('데이터 파일을 찾을 수 없습니다.');
        const json = await response.json();
        setData(json);
        setLoading(false);
      } catch (error) {
        console.error('시즌 마감 데이터 로드 실패:', error);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={48} />
          <p className="text-gray-600">시즌 마감 분석 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center bg-white p-8 rounded-xl shadow-md">
          <AlertTriangle className="mx-auto mb-4 text-yellow-600" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">데이터가 없습니다</h2>
          <p className="text-gray-600">python scripts/main.py 를 먼저 실행해주세요.</p>
        </div>
      </div>
    );
  }

  const { summary, class_analysis, item_analysis, style_summary, metadata } = data;

  // 등급 분포 차트 데이터
  const gradeData = ['S', 'A', 'B', 'C', 'D'].map(g => ({
    grade: g,
    count: style_summary?.grade_distribution?.[g] || 0,
    fill: GRADE_COLORS[g]
  }));

  // 액션별 스타일 데이터
  const actionStyles = style_summary?.action_styles || {};

  // Top/Bottom 아이템 데이터 (item_analysis 기준)
  const sortedItems = [...(item_analysis || [])].sort((a, b) => b.sell_through_rate - a.sell_through_rate);
  const topItems = sortedItems.slice(0, 5);
  const bottomItems = sortedItems.slice(-5).reverse();

  // 복종 밸런스 그룹드바 데이터
  const balanceData = (class_analysis || []).map(c => ({
    ...c,
    class2: c.class2,
    volume_share: c.volume_share,
    sales_share: c.sales_share,
    balance_delta: c.balance_delta
  })).sort((a, b) => b.sales_share - a.sales_share);

  // BCG 스캐터 데이터
  const bcgData = (item_analysis || []).map(item => ({
    ...item,
    z: Math.max(item.sales_share * 8, 40)
  }));

  // 판매율에 따른 배지 색상
  const getSTRColor = (rate) => {
    if (rate >= 60) return 'text-green-600 bg-green-50 border-green-200';
    if (rate >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <>
      {/* AI 종합 코멘트 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800 mb-2">AI 종합 코멘트</h2>
              <p className="text-gray-600 leading-relaxed">{summary.ai_comment}</p>
            </div>
            <button
              onClick={() => setShowBudget(true)}
              className="ml-4 px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm whitespace-nowrap flex items-center gap-2"
            >
              <Sparkles size={16} /> AI 예산 제안 →
            </button>
          </div>
        </div>

        {/* AI 버짓 컨트롤 패널 */}
        {showBudget && (
          <BudgetControl
            classAnalysis={class_analysis}
            summary={summary}
            season={metadata?.season || '25S'}
            onClose={() => setShowBudget(false)}
          />
        )}

      {/* KPI 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <KPICard
            label="총매출액"
            value={`${(summary.total_sale_amt / 100000000).toFixed(1)}억`}
            sub={`입고 ${(summary.total_in_amt / 100000000).toFixed(1)}억`}
            icon={DollarSign}
            color="text-violet-500"
          />
          <KPICard
            label="총입고"
            value={summary.total_inbound?.toLocaleString()}
            icon={Package}
            color="text-blue-500"
          />
          <KPICard
            label="총판매"
            value={summary.total_sales?.toLocaleString()}
            icon={ShoppingCart}
            color="text-green-500"
          />
          <KPICard
            label="판매율"
            value={`${summary.sell_through_rate}%`}
            sub={summary.target_achievement === '달성' ? '목표 달성' : '목표 미달성'}
            icon={TrendingUp}
            color={summary.sell_through_rate >= 60 ? 'text-green-500' : 'text-amber-500'}
          />
          <KPICard
            label="재고리스크"
            value={`${summary.stock_risk}%`}
            sub={`재고 ${summary.total_stock?.toLocaleString()}장`}
            icon={TrendingDown}
            color={summary.stock_risk > 50 ? 'text-red-500' : 'text-blue-500'}
          />
        </div>

        {/* 복종 밸런스 (Grouped Bar) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">복종 밸런스 분석</h2>
          <p className="text-xs text-gray-400 mb-4">물량비중 vs 판매비중 비교 (차이 &plusmn;5%p 이상 시 조정 필요)</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={balanceData}
                layout="vertical"
                margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="class2" width={80} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip content={<BalanceTooltip />} />
                <Legend
                  formatter={(value) => <span className="text-xs">{value}</span>}
                  verticalAlign="top"
                  height={28}
                />
                <Bar dataKey="volume_share" name="물량비중" fill="#d1d5db" barSize={16} radius={[0, 4, 4, 0]} />
                <Bar dataKey="sales_share" name="판매비중" fill="#3b82f6" barSize={16} radius={[0, 4, 4, 0]}>
                  <LabelList
                    content={({ x, y, width, height, value, index }) => {
                      const item = balanceData[index];
                      if (!item) return null;
                      const delta = item.balance_delta;
                      const color = delta > 5 ? '#16a34a' : delta < -5 ? '#dc2626' : '#6b7280';
                      return (
                        <text
                          x={x + width + 8}
                          y={y + height / 2}
                          fill={color}
                          fontSize={11}
                          fontWeight="bold"
                          dominantBaseline="middle"
                        >
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%p
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 밸런스 판정 태그 */}
          <div className="flex flex-wrap gap-2 mt-3">
            {balanceData.map(item => (
              <span
                key={item.class2}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                  item.balance_judgment === '확대필요'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : item.balance_judgment === '축소필요'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {item.class2}: {item.balance_judgment}
              </span>
            ))}
          </div>
        </div>

        {/* Top/Bottom 아이템 테이블 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top 5 아이템 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-500" /> Top 5 아이템
            </h2>
            <p className="text-xs text-gray-400 mb-3">판매율 기준 상위 아이템</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">아이템</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">복종</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">판매율</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium">등급</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium text-gray-900">{item.item_nm}</td>
                      <td className="py-2 px-2 text-gray-600">{item.class2}</td>
                      <td className="py-2 px-2 text-right font-bold text-green-600">{item.sell_through_rate}%</td>
                      <td className="py-2 px-2 text-center">
                        <span className="inline-block w-6 h-6 rounded-full text-white text-xs font-bold leading-6" style={{ backgroundColor: GRADE_COLORS[item.grade] || '#9CA3AF' }}>
                          {item.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom 5 아이템 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
              <TrendingDown size={18} className="text-red-500" /> Bottom 5 아이템
            </h2>
            <p className="text-xs text-gray-400 mb-3">판매율 기준 하위 아이템</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">아이템</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">복종</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">판매율</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium">등급</th>
                  </tr>
                </thead>
                <tbody>
                  {bottomItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium text-gray-900">{item.item_nm}</td>
                      <td className="py-2 px-2 text-gray-600">{item.class2}</td>
                      <td className="py-2 px-2 text-right font-bold text-red-600">{item.sell_through_rate}%</td>
                      <td className="py-2 px-2 text-center">
                        <span className="inline-block w-6 h-6 rounded-full text-white text-xs font-bold leading-6" style={{ backgroundColor: GRADE_COLORS[item.grade] || '#9CA3AF' }}>
                          {item.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BCG 매트릭스 */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-lg font-bold text-gray-800">BCG 매트릭스</h2>
                <p className="text-xs text-gray-400">X: 물량비중, Y: 판매율, 버블크기: 판매비중</p>
              </div>
              <button
                onClick={() => setShowBCGGuide(!showBCGGuide)}
                className="p-1.5 rounded-full hover:bg-violet-50 text-violet-500 transition-colors"
                title="BCG 해석 가이드"
              >
                <HelpCircle size={20} />
              </button>
            </div>

            {/* AI 가이드 팝오버 */}
            {showBCGGuide && (
              <div className="absolute top-16 right-4 z-10 w-96 bg-violet-50 border border-violet-200 rounded-xl shadow-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-violet-600" />
                    <span className="font-bold text-violet-800 text-sm">BCG Matrix 활용가이드</span>
                  </div>
                  <button onClick={() => setShowBCGGuide(false)} className="text-violet-400 hover:text-violet-600">
                    <X size={16} />
                  </button>
                </div>
                <div className="text-xs text-violet-900 space-y-2">
                  <p className="leading-relaxed">BCG 매트릭스는 아이템별 <b>효율성</b>과 <b>규모</b>를 한눈에 파악하는 도구입니다.</p>
                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-start gap-2">
                      <span className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: '#FFD700', border: '1px solid #333' }} />
                      <span><b>Star</b>: 판매율↑ 물량↓ → <span className="text-green-700 font-medium">공격적 확대</span> 권장</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: '#32CD32', border: '1px solid #333' }} />
                      <span><b>Cash Cow</b>: 판매율↑ 물량↑ → <span className="text-blue-700 font-medium">현행 유지</span>, 매출 방어</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: '#FF6B6B', border: '1px solid #333' }} />
                      <span><b>Problem Child</b>: 판매율↓ 물량↑ → <span className="text-red-700 font-medium">물량 축소</span> 검토</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: '#87CEEB', border: '1px solid #333' }} />
                      <span><b>Question Mark</b>: 판매율↓ 물량↓ → <span className="text-gray-700 font-medium">관찰 후 결정</span></span>
                    </div>
                  </div>
                  <p className="text-violet-600 mt-3 pt-2 border-t border-violet-200">💡 Star 아이템에 물량을 집중하고, Problem Child는 과감히 줄이세요!</p>
                </div>
              </div>
            )}

            <div className="h-96 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="volume_share"
                    name="물량비중"
                    unit="%"
                    domain={[0, 'auto']}
                    tick={{ fontSize: 11 }}
                    label={{ value: '물량비중 (%)', position: 'insideBottom', offset: -10, fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="sell_through_rate"
                    name="판매율"
                    unit="%"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    label={{ value: '판매율 (%)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[60, 500]} />
                  {/* BCG 사분면 기준선 */}
                  <ReferenceLine x={5} stroke="#9CA3AF" strokeDasharray="5 5" label={{ value: '물량 5%', position: 'top', fontSize: 10, fill: '#9CA3AF' }} />
                  <ReferenceLine y={50} stroke="#9CA3AF" strokeDasharray="5 5" label={{ value: '판매율 50%', position: 'right', fontSize: 10, fill: '#9CA3AF' }} />
                  <Tooltip content={<BCGTooltip />} />
                  <Scatter data={bcgData} name="아이템">
                    {bcgData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={BCG_COLORS[entry.bcg_class] || '#808080'}
                        stroke="#333"
                        strokeWidth={1}
                        fillOpacity={0.75}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {/* BCG 범례 */}
            <div className="flex flex-wrap gap-4 mt-3 justify-center items-center">
              {Object.entries(BCG_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, border: '1px solid #333' }} />
                  <span className="text-xs text-gray-600">{key}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 26S 액션 플랜 (탭) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">26S 시즌 액션 플랜</h2>
          <p className="text-xs text-gray-400 mb-4">스타일별 AI 권장 액션 및 코멘트</p>

          {/* 액션 탭 */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {ACTION_TABS.map(tab => {
              const count = actionStyles[tab.key]?.length || 0;
              const isActive = activeActionTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveActionTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={isActive ? { backgroundColor: tab.color } : {}}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-gray-200'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 액션 설명 */}
          <div className="mb-4 px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-600">
            {ACTION_TABS.find(t => t.key === activeActionTab)?.desc}
          </div>

          {/* 스타일 목록 */}
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium" style={{ width: '8%' }}>복종</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium" style={{ width: '8%' }}>스타일코드</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium" style={{ width: '8%' }}>발주</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium" style={{ width: '8%' }}>판매</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium" style={{ width: '12%' }}>판매율</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium" style={{ width: '10%' }}>등급</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium" style={{ width: '45%' }}>AI 코멘트</th>
                </tr>
              </thead>
              <tbody>
                {(actionStyles[activeActionTab] || []).map((style, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">{style.class2}</td>
                    <td className="py-2 px-3 font-mono text-xs text-gray-700">{style.style_cd}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{style.in_qty?.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{style.sale_qty?.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: ACTION_TABS.find(t => t.key === activeActionTab)?.color }}>
                      {style.sell_through_rate}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block w-6 h-6 rounded-full text-white text-xs font-bold leading-6" style={{ backgroundColor: GRADE_COLORS[style.grade] || '#9CA3AF' }}>
                        {style.grade}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs leading-relaxed whitespace-pre-line">
                      {style.ai_comment?.replace(/(🔥|💪|⭐|📈|✅|📊|🔄|🟡|👀|📉|✂️|⚠️|❌|💰|❓)/g, '\n$1').trim()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      <p className="text-sm text-gray-400 mt-2">
        {metadata?.total_styles || 0}개 스타일 | 생성: {metadata?.generated_at || '-'}
      </p>
    </>
  );
};

export default SeasonClosing;
