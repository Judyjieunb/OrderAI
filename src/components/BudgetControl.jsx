import React, { useState } from 'react';
import { Loader2, Check, AlertTriangle, TrendingUp, Info, ArrowRight, X, Sparkles } from 'lucide-react';

// 금액 포맷 헬퍼
const formatRevenue = (amt) => {
  if (amt >= 100000000) return `${(amt / 100000000).toFixed(1)}억`;
  if (amt >= 10000000) return `${Math.round(amt / 10000).toLocaleString()}만`;
  return `${amt.toLocaleString()}원`;
};

const BudgetControl = ({ classAnalysis, summary, season, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [aiCommentary, setAiCommentary] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(null);

  // 목표매출 (금액 기반)
  const [targetTotalRevenue, setTargetTotalRevenue] = useState(0);
  const [prevTotalRevenue, setPrevTotalRevenue] = useState(0);
  const [prevTotalSales, setPrevTotalSales] = useState(0);

  // 카테고리별 상태
  const [categories, setCategories] = useState({});

  const nextSeason = '26S';

  // AI 예산 제안 요청
  const requestProposal = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/budget-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || '예산 제안 요청 실패');
      }

      const data = await response.json();
      setProposal(data);
      setAiCommentary(data.ai_commentary || '');
      setTargetTotalRevenue(data.target_total_revenue || 0);
      setPrevTotalRevenue(data.prev_total_revenue || 0);
      setPrevTotalSales(data.prev_total_sales || 0);

      // 카테고리 초기화
      const cats = {};
      (data.category_targets || []).forEach(cat => {
        const inAmt = classAnalysis?.find(c => c.class2 === cat.class2)?.in_amt || 0;
        cats[cat.class2] = {
          share: cat.share_pct || 0,
          targetSTR: cat.prev_sell_through_rate || 50,
          prevSales: cat.prev_sales || 0,
          prevRevenue: cat.prev_revenue || 0,
          avgPrice: cat.avg_price || 0,
          prevSTR: cat.prev_sell_through_rate || 0,
          aiTargetRevenue: cat.target_revenue || 0,
          prevInAmt: inAmt,
        };
      });
      setCategories(cats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 목표매출 변경 (억원 단위 입력)
  const handleTargetRevenueChange = (value) => {
    const eok = parseFloat(value) || 0;
    setTargetTotalRevenue(Math.round(eok * 100000000));
  };

  // 성장률로 목표매출 조정
  const growthRate = prevTotalRevenue > 0
    ? ((targetTotalRevenue - prevTotalRevenue) / prevTotalRevenue * 100)
    : 0;

  const handleGrowthChange = (value) => {
    const rate = parseFloat(value) || 0;
    setTargetTotalRevenue(Math.round(prevTotalRevenue * (1 + rate / 100)));
  };

  // 비중 변경
  const handleShareChange = (class2, value) => {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setCategories(prev => ({
      ...prev,
      [class2]: { ...prev[class2], share: num }
    }));
  };

  // 목표판매율 변경
  const handleSTRChange = (class2, value) => {
    const num = Math.max(1, Math.min(100, parseFloat(value) || 1));
    setCategories(prev => ({
      ...prev,
      [class2]: { ...prev[class2], targetSTR: num }
    }));
  };

  // 계산 로직
  const categoryList = Object.keys(categories);
  const totalShare = categoryList.reduce((acc, k) => acc + (categories[k].share || 0), 0);

  const computed = categoryList.map(class2 => {
    const cat = categories[class2];
    const adjustedRevenue = Math.round(targetTotalRevenue * cat.share / 100);
    const orderBudgetAmt = cat.targetSTR > 0
      ? Math.round(adjustedRevenue / (cat.targetSTR / 100))
      : 0;
    const orderBudgetQty = cat.avgPrice > 0
      ? Math.round(orderBudgetAmt / cat.avgPrice)
      : 0;
    const prevInAmt = cat.prevInAmt || 0;
    const vsPrevBudget = prevInAmt > 0 ? ((orderBudgetAmt - prevInAmt) / prevInAmt * 100) : 0;
    const vsPrevRevenue = cat.prevRevenue > 0 ? ((adjustedRevenue - cat.prevRevenue) / cat.prevRevenue * 100) : 0;

    return {
      class2,
      prevInAmt,
      prevRevenue: cat.prevRevenue,
      aiTargetRevenue: cat.aiTargetRevenue,
      avgPrice: cat.avgPrice,
      share: cat.share,
      adjustedRevenue,
      vsPrevRevenue,
      targetSTR: cat.targetSTR,
      orderBudgetAmt,
      orderBudgetQty,
      vsPrevBudget,
    };
  });

  const totalAdjustedRevenue = computed.reduce((a, c) => a + c.adjustedRevenue, 0);
  const totalOrderBudgetAmt = computed.reduce((a, c) => a + c.orderBudgetAmt, 0);
  const totalOrderBudgetQty = computed.reduce((a, c) => a + c.orderBudgetQty, 0);
  const totalPrevInAmt = computed.reduce((a, c) => a + c.prevInAmt, 0);
  const totalPrevRevenue = computed.reduce((a, c) => a + c.prevRevenue, 0);
  const totalVsPrevRevenue = totalPrevRevenue > 0 ? ((totalAdjustedRevenue - totalPrevRevenue) / totalPrevRevenue * 100) : 0;
  const totalVsPrevBudget = totalPrevInAmt > 0 ? ((totalOrderBudgetAmt - totalPrevInAmt) / totalPrevInAmt * 100) : 0;

  // 확정
  const confirmBudget = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/budget-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: nextSeason,
          target_total_revenue: targetTotalRevenue,
          total_order_budget_amt: totalOrderBudgetAmt,
          total_order_budget_qty: totalOrderBudgetQty,
          category_budgets: computed.map(c => ({
            class2: c.class2,
            budget_amt: c.orderBudgetAmt,
            budget_qty: c.orderBudgetQty,
            avg_price: c.avgPrice,
          }))
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || '예산 확정 실패');
      }
      setConfirmed(true);
      setTimeout(() => onClose?.(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── 아직 AI 제안 전 ──
  if (!proposal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-[1280px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6 mx-4 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
          <h2 className="text-lg font-bold text-violet-800 mb-2">{nextSeason} AI 목표매출 제안</h2>
          <p className="text-sm text-violet-600 mb-4">
            {season} 실적 데이터를 기반으로 AI가 차시즌 목표 매출금액과 카테고리 비중을 제안합니다.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}
          <button
            onClick={requestProposal}
            disabled={loading}
            className="px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> AI 분석 중...</>
            ) : (
              <><Sparkles size={16} /> AI 목표매출 제안 받기</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── 확정 완료 ──
  if (confirmed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-[1280px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6 mx-4 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <Check size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-800">{nextSeason} 발주예산 확정 완료</h2>
              <p className="text-sm text-green-600">
                목표매출 {formatRevenue(targetTotalRevenue)} | 총 발주예산 {formatRevenue(totalOrderBudgetAmt)} ({totalOrderBudgetQty.toLocaleString()}장) | output/budget_config.json 저장 완료
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 메인 UI ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-[1280px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-8 mx-4 relative">

        {/* 헤더 영역 */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{nextSeason} 발주 버짓 컨트롤</h2>
            <p className="text-sm text-gray-500 mt-1">AI 제안을 기반으로 카테고리별 목표와 예산을 확정하세요.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 1. Insight & Summary (상단 KPI) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

          {/* 좌측: AI 코멘터리 */}
          <div className="lg:col-span-7 bg-gray-50/80 rounded-xl p-5">
            <div className="flex gap-3">
              <div className="shrink-0">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                  <Info size={16} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-1">AI Strategy Insight</h4>
                <p className="text-sm text-gray-600 leading-relaxed text-pretty">
                  {aiCommentary || "AI 코멘터리가 없습니다."}
                </p>
              </div>
            </div>
          </div>

          {/* 우측: 핵심 지표 컨트롤 */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            {/* 상단: 비교군 */}
            <div className="flex items-center justify-between px-2">
              <div className="text-right">
                <span className="block text-xs text-gray-400 mb-1">{season} 실적</span>
                <span className="text-lg font-semibold text-gray-500">{formatRevenue(prevTotalRevenue)}</span>
              </div>
              <ArrowRight size={16} className="text-gray-300 mx-2" />
              <div className="text-left">
                <span className="block text-xs text-violet-500 mb-1 font-medium">AI 제안</span>
                <span className="text-lg font-bold text-violet-600">{formatRevenue(proposal.target_total_revenue)}</span>
              </div>
            </div>

            {/* 하단: 실제 입력 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">목표 매출 (억원)</label>
                <input
                  type="number"
                  value={(targetTotalRevenue / 100000000).toFixed(1)}
                  onChange={(e) => handleTargetRevenueChange(e.target.value)}
                  className="w-full pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-right"
                  step={1}
                />
              </div>
              <div className="w-px h-10 bg-gray-200"></div>
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">목표 성장률 (%)</label>
                <input
                  type="number"
                  value={growthRate.toFixed(1)}
                  onChange={(e) => handleGrowthChange(e.target.value)}
                  className={`w-full pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-right ${growthRate < 0 ? 'text-red-500' : 'text-green-600'}`}
                  step={1}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-6 flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* 2. Main Data Grid (테이블) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* 그룹 헤더 */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-2 px-4 bg-white"></th>
                <th colSpan={3} className="py-2 px-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest border-r border-gray-100">
                  Reference (참고)
                </th>
                <th colSpan={4} className="py-2 px-4 text-center text-xs font-bold text-blue-600 uppercase tracking-widest border-r border-gray-100 bg-blue-50/30">
                  Target Control (조정)
                </th>
                <th colSpan={2} className="py-2 px-4 text-center text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50/30">
                  Budget Simulator (결과)
                </th>
              </tr>
              {/* 컬럼 헤더 */}
              <tr className="border-b border-gray-200 bg-white">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-800 w-24">카테고리</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-400">전년입고</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-400">전년매출</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 border-r border-gray-100">AI제안</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-blue-700 bg-blue-50/10 w-28">비중(%)</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-600 bg-blue-50/10">매출목표</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-400 bg-blue-50/10">YoY</th>
                <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 bg-blue-50/10 border-r border-gray-100 w-28">판매율(%)</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-emerald-700 bg-emerald-50/10">발주예산</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-400 bg-emerald-50/10">YoY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {computed.map((row) => (
                <tr key={row.class2} className="hover:bg-gray-50 transition-colors group">
                  <td className="py-4 px-4 font-bold text-gray-800">{row.class2}</td>
                  <td className="py-4 px-4 text-right text-gray-400 tabular-nums font-light">{formatRevenue(row.prevInAmt)}</td>
                  <td className="py-4 px-4 text-right text-gray-400 tabular-nums font-light">{formatRevenue(row.prevRevenue)}</td>
                  <td className="py-4 px-4 text-right text-gray-500 tabular-nums border-r border-gray-100 bg-gray-50/30 font-medium">{formatRevenue(row.aiTargetRevenue)}</td>

                  {/* 입력 필드들 */}
                  <td className="py-3 px-2 bg-blue-50/5">
                    <div className="flex items-center justify-center">
                      <input
                        type="number"
                        value={categories[row.class2]?.share ?? 0}
                        onChange={(e) => handleShareChange(row.class2, e.target.value)}
                        className="w-24 px-3 py-2 text-right text-sm font-bold text-blue-700 bg-white border border-blue-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all tabular-nums"
                        step={0.5}
                        min={0}
                        max={100}
                      />
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-700 tabular-nums font-medium bg-blue-50/5">{formatRevenue(row.adjustedRevenue)}</td>
                  <td className={`py-4 px-4 text-right text-xs tabular-nums bg-blue-50/5 ${row.vsPrevRevenue >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {row.vsPrevRevenue > 0 ? '+' : ''}{row.vsPrevRevenue.toFixed(1)}%
                  </td>
                  <td className="py-3 px-2 border-r border-gray-100 bg-blue-50/5">
                    <div className="flex items-center justify-center">
                      <input
                        type="number"
                        value={categories[row.class2]?.targetSTR ?? 50}
                        onChange={(e) => handleSTRChange(row.class2, e.target.value)}
                        className="w-24 px-3 py-2 text-right text-sm font-bold text-blue-700 bg-white border border-blue-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all tabular-nums"
                        step={1}
                        min={1}
                        max={100}
                      />
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right text-gray-900 font-bold tabular-nums text-[15px] bg-emerald-50/10 group-hover:bg-emerald-50/20 transition-colors">
                    {formatRevenue(row.orderBudgetAmt)}
                  </td>
                  <td className={`py-4 px-4 text-right text-xs tabular-nums bg-emerald-50/10 group-hover:bg-emerald-50/20 ${row.vsPrevBudget >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {row.vsPrevBudget > 0 ? '+' : ''}{row.vsPrevBudget.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            {/* 합계 행 */}
            <tfoot className="bg-gray-100 border-t border-gray-200">
              <tr>
                <td className="py-4 px-4 font-bold text-gray-900">Total</td>
                <td className="py-4 px-4 text-right text-gray-500 tabular-nums">{formatRevenue(totalPrevInAmt)}</td>
                <td className="py-4 px-4 text-right text-gray-500 tabular-nums">{formatRevenue(prevTotalRevenue)}</td>
                <td className="py-4 px-4 text-right text-gray-600 tabular-nums border-r border-gray-200">{formatRevenue(proposal.target_total_revenue)}</td>

                <td className="py-4 px-4 text-center font-bold tabular-nums">
                  <span className={`inline-block px-2 py-1 rounded ${Math.abs(totalShare - 100) > 0.5 ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700'}`}>
                    {totalShare.toFixed(1)}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right font-bold text-gray-800 tabular-nums">{formatRevenue(totalAdjustedRevenue)}</td>
                <td className={`py-4 px-4 text-right text-xs font-bold tabular-nums ${totalVsPrevRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalVsPrevRevenue > 0 ? '+' : ''}{totalVsPrevRevenue.toFixed(1)}%
                </td>
                <td className="py-4 px-4 text-center font-bold text-gray-700 tabular-nums border-r border-gray-200">
                  {totalOrderBudgetAmt > 0 ? (totalAdjustedRevenue / totalOrderBudgetAmt * 100).toFixed(1) : '-'}%
                </td>

                <td className="py-4 px-4 text-right font-black text-emerald-800 text-lg tabular-nums bg-emerald-50/30 border-t border-emerald-200">
                  {formatRevenue(totalOrderBudgetAmt)}
                </td>
                <td className={`py-4 px-4 text-right text-xs font-bold tabular-nums bg-emerald-50/30 border-t border-emerald-200 ${totalVsPrevBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalVsPrevBudget > 0 ? '+' : ''}{totalVsPrevBudget.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 하단 액션 바 */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
          <div className="flex-1">
            {Math.abs(totalShare - 100) > 0.5 && (
              <div className="inline-flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg text-sm font-medium animate-pulse">
                <AlertTriangle size={16} />
                <span>비중 합계가 {totalShare.toFixed(1)}%입니다. 100%를 맞춰주세요.</span>
              </div>
            )}
          </div>

          <button
            onClick={confirmBudget}
            disabled={loading || totalOrderBudgetAmt === 0 || Math.abs(totalShare - 100) > 0.5}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-gray-200 transform hover:-translate-y-0.5"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> 저장 중...</>
            ) : (
              <><Check size={18} /> Budget Ceiling 확정</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BudgetControl;
