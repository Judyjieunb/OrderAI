import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle, Package, DollarSign, BarChart2, Filter, Info } from 'lucide-react';

const KPICard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
    <p className="text-xl font-bold text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 90 ? 'bg-amber-400' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-12 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// style_mapping_data.json → Top 1 기준 디폴트 추천 데이터 변환
function buildPreviewFromMapping(mapping) {
  const recs = [];
  for (const style of mapping.styles) {
    const top1 = style.references.find(r => r.rank === 1);
    if (top1) {
      recs.push({
        new_part_cd: style.new_part_cd,
        new_item_nm: style.new_item_nm,
        new_class2: style.new_class2,
        추천발주량: top1.AI발주량,
        판매가: top1.판매가,
        ref_part_cd: top1.part_cd,
        budget_scaled: false,
        colors: [],  // 프리뷰에선 컬러 배분 없음
      });
    } else {
      recs.push({
        new_part_cd: style.new_part_cd,
        new_item_nm: style.new_item_nm,
        new_class2: style.new_class2,
        추천발주량: 0,
        판매가: 0,
        budget_scaled: false,
        manual_input: true,
        colors: [],
      });
    }
  }

  const totalQty = recs.reduce((s, r) => s + (r.추천발주량 || 0), 0);
  return {
    metadata: {
      season: mapping.metadata.new_season,
      total_styles: mapping.metadata.total_styles,
      matched_styles: mapping.metadata.matched_styles,
      total_recommendation_qty: totalQty,
      scaled_count: 0,
      category_budgets: [],
    },
    recommendations: recs,
  };
}

export default function OrderSuggest() {
  const [data, setData] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    // 1차: 확정 데이터 시도 → 없으면 2차: 맵핑 데이터로 프리뷰
    fetch('/order_recommendation_data.json')
      .then(res => {
        if (!res.ok) throw new Error('no confirmed');
        return res.json();
      })
      .then(json => {
        setData(json);
        setIsPreview(false);
        setLoading(false);
      })
      .catch(() => {
        // 확정 데이터 없음 → 맵핑 데이터로 프리뷰
        fetch('/style_mapping_data.json')
          .then(res => {
            if (!res.ok) throw new Error('style_mapping_data.json이 없습니다. 파이프라인을 먼저 실행하세요.');
            return res.json();
          })
          .then(mapping => {
            setData(buildPreviewFromMapping(mapping));
            setIsPreview(true);
            setLoading(false);
          })
          .catch(err => {
            setError(err.message);
            setLoading(false);
          });
      });
  }, []);

  const categories = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.recommendations.map(r => r.new_class2));
    return [...set].sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (categoryFilter === 'all') return data.recommendations;
    return data.recommendations.filter(r => r.new_class2 === categoryFilter);
  }, [data, categoryFilter]);

  const kpis = useMemo(() => {
    if (!data) return {};
    const recs = data.recommendations;
    const totalQty = data.metadata.total_recommendation_qty || 0;
    const totalAmt = recs.reduce((sum, r) => sum + (r.추천발주량 || 0) * (r.판매가 || 0), 0);
    const scaledCount = data.metadata.scaled_count || 0;
    return { totalQty, totalAmt, scaledCount, totalStyles: data.metadata.total_styles };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>발주 추천 데이터 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500 gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const catBudgets = data.metadata.category_budgets || [];

  return (
    <div className="space-y-6">
      {/* 프리뷰 안내 배너 */}
      {isPreview && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            Top 1 유사스타일 기준 예상 추천입니다. Step 3에서 확정 저장하면 컬러별 배분 및 예산 스케일링이 적용됩니다.
          </p>
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          label="총 AI추천수량"
          value={`${kpis.totalQty?.toLocaleString()}장`}
          sub={`${kpis.totalStyles}개 스타일`}
          icon={Package}
          color="bg-blue-500"
        />
        <KPICard
          label="추정 발주금액"
          value={kpis.totalAmt >= 100000000
            ? `${(kpis.totalAmt / 100000000).toFixed(1)}억원`
            : `${Math.round(kpis.totalAmt / 10000).toLocaleString()}만원`
          }
          sub="AI추천수량 x 판매가"
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <KPICard
          label="예산 스케일링"
          value={isPreview ? '미적용' : `${kpis.scaledCount}건 적용`}
          sub={isPreview ? '확정 저장 후 적용' : kpis.scaledCount > 0 ? `${kpis.totalStyles}건 중 축소 적용` : '전 스타일 예산 이내'}
          icon={BarChart2}
          color="bg-violet-500"
        />
      </div>

      {/* 카테고리별 예산 대비 */}
      {catBudgets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">카테고리별 예산 대비 추천</h3>
          <div className="space-y-3">
            {catBudgets.map(cat => {
              const scaleDown = cat.pre_scale_qty > cat.recommended_qty;
              const scalePct = cat.pre_scale_qty > 0
                ? ((cat.pre_scale_qty - cat.recommended_qty) / cat.pre_scale_qty * 100).toFixed(1)
                : 0;
              return (
                <div key={cat.class2} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700 w-16">{cat.class2}</span>
                  <span className="text-xs text-gray-500 w-40">
                    추천 {cat.recommended_qty.toLocaleString()} / 천장 {cat.budget_qty.toLocaleString()}
                  </span>
                  <ProgressBar value={cat.recommended_qty} max={cat.budget_qty} />
                  {scaleDown && (
                    <span className="text-xs text-red-500 w-20 text-right">↓{scalePct}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 스타일별 발주추천 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            스타일별 발주추천 {!isPreview && '(컬러 배분)'}
          </h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 카테고리</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="max-h-[calc(100vh-500px)] overflow-y-auto">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="w-[3%] px-2 py-3 text-center text-xs font-semibold text-gray-500">#</th>
                <th className="w-[14%] px-3 py-3 text-left text-xs font-semibold text-gray-500">품번</th>
                <th className="w-[10%] px-3 py-3 text-left text-xs font-semibold text-gray-500">품명</th>
                <th className="w-[7%] px-3 py-3 text-left text-xs font-semibold text-gray-500">복종</th>
                <th className="w-[8%] px-3 py-3 text-center text-xs font-semibold text-gray-500">컬러</th>
                <th className="w-[7%] px-3 py-3 text-right text-xs font-semibold text-gray-500">비중</th>
                <th className="w-[10%] px-3 py-3 text-right text-xs font-semibold text-gray-500">AI추천수량</th>
                <th className="w-[12%] px-3 py-3 text-right text-xs font-semibold text-gray-500">비고</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec, idx) => {
                const colors = rec.colors || [];
                const hasColors = colors.length > 0;
                const totalRows = hasColors ? 1 + colors.length : 1;
                const isScaled = rec.budget_scaled;
                const isManual = rec.manual_input;

                return (
                  <React.Fragment key={rec.new_part_cd}>
                    {/* 스타일 소계 행 */}
                    <tr className={`border-b ${hasColors ? 'border-gray-100' : 'border-gray-200'} bg-gray-50/60`}>
                      <td rowSpan={totalRows} className="px-2 py-2.5 text-center text-xs text-gray-400 align-top border-r border-gray-100">
                        {idx + 1}
                      </td>
                      <td rowSpan={totalRows} className="px-3 py-2.5 text-xs font-mono text-gray-800 align-top border-r border-gray-100">
                        {rec.new_part_cd}
                      </td>
                      <td rowSpan={totalRows} className="px-3 py-2.5 text-xs text-gray-700 align-top border-r border-gray-100">
                        {rec.new_item_nm}
                      </td>
                      <td rowSpan={totalRows} className="px-3 py-2.5 text-xs text-gray-500 align-top border-r border-gray-100">
                        {rec.new_class2}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600">
                        {hasColors ? '합계' : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">
                        {hasColors ? '100%' : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">
                        {(rec.추천발주량 || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                        {isScaled && (
                          <span className="text-red-500">원본 {rec.original_recommendation?.toLocaleString()}</span>
                        )}
                        {isManual && rec.추천발주량 === 0 && (
                          <span className="text-gray-300">매칭 불가</span>
                        )}
                        {isManual && rec.추천발주량 > 0 && (
                          <span className="text-amber-500">수동입력</span>
                        )}
                      </td>
                    </tr>
                    {/* 컬러별 행 */}
                    {colors.map((c, ci) => (
                      <tr
                        key={`${rec.new_part_cd}-${c.color_cd}`}
                        className={`${ci === colors.length - 1 ? 'border-b border-gray-200' : 'border-b border-gray-50'}`}
                      >
                        <td className="px-3 py-1.5 text-center text-xs text-gray-500">
                          {c.color_cd === '-' ? (
                            <span className="text-gray-300 italic">미정</span>
                          ) : (
                            <span className="font-mono">{c.color_cd}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs text-gray-500">{c.ratio}%</td>
                        <td className="px-3 py-1.5 text-right text-xs text-gray-700">{c.qty.toLocaleString()}</td>
                        <td />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
