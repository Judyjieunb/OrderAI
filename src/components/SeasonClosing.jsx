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
  LabelList
} from 'recharts';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Package, ShoppingCart, Sparkles } from 'lucide-react';
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
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
        <p className="font-bold mb-1 text-gray-700">{data.class2}</p>
        <p className="text-gray-500">물량비중: {data.volume_share}%</p>
        <p className="text-blue-600">판매비중: {data.sales_share}%</p>
        <p className={`font-bold ${data.balance_delta > 0 ? 'text-green-600' : data.balance_delta < -5 ? 'text-red-600' : 'text-gray-600'}`}>
          비중차이: {data.balance_delta > 0 ? '+' : ''}{data.balance_delta}%p
        </p>
        <p className="text-gray-400 text-xs mt-1">판매율: {data.sell_through_rate}%</p>
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
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
        <p className="font-bold mb-1 text-gray-700">{data.item_nm}</p>
        <p className="text-gray-500">복종: {data.class2}</p>
        <p className="text-gray-500">물량비중: {data.volume_share}%</p>
        <p className="text-gray-500">판매율: {data.sell_through_rate}%</p>
        <p className="text-gray-500">판매비중: {data.sales_share}%</p>
        <p className={`font-bold mt-1`} style={{ color: BCG_COLORS[data.bcg_class] || '#808080' }}>
          {data.bcg_class} ({data.grade})
        </p>
      </div>
    );
  }
  return null;
};

const SeasonClosing = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showBudget, setShowBudget] = useState(false);

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        {/* BCG 매트릭스 + 등급 분포 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* BCG 매트릭스 스캐터 (2/3) */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">BCG 매트릭스</h2>
            <p className="text-xs text-gray-400 mb-4">X: 물량비중, Y: 판매율, 버블크기: 판매비중</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="volume_share"
                    name="물량비중"
                    unit="%"
                    tick={{ fontSize: 11 }}
                    label={{ value: '물량비중 (%)', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="sell_through_rate"
                    name="판매율"
                    unit="%"
                    tick={{ fontSize: 11 }}
                    label={{ value: '판매율 (%)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[40, 400]} />
                  <Tooltip content={<BCGTooltip />} />
                  <Scatter data={bcgData} name="아이템">
                    {bcgData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={BCG_COLORS[entry.bcg_class] || '#808080'}
                        stroke="#333"
                        strokeWidth={1}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {/* BCG 범례 */}
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {Object.entries(BCG_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, border: '1px solid #333' }} />
                  <span className="text-xs text-gray-600">{key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 등급 분포 바 차트 (1/3) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">등급 분포</h2>
            <p className="text-xs text-gray-400 mb-4">S/A/B/C/D 스타일 수</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [value, '스타일 수']}
                    labelFormatter={(label) => `등급 ${label}`}
                  />
                  <Bar dataKey="count" name="스타일 수" radius={[4, 4, 0, 0]}>
                    {gradeData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="count" position="top" fontSize={11} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* 등급 기준 설명 */}
            <div className="mt-3 text-xs text-gray-400 space-y-0.5">
              <p>S: 75%+ | A: 65%+ | B: 55%+ | C: 40%+ | D: &lt;40%</p>
            </div>
          </div>
        </div>

      <p className="text-sm text-gray-400 mt-2">
        {metadata?.total_styles || 0}개 스타일 | 생성: {metadata?.generated_at || '-'}
      </p>
    </>
  );
};

export default SeasonClosing;
