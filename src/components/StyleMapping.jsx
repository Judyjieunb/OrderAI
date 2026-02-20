import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Filter, Save } from 'lucide-react';

export default function StyleMapping() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selections, setSelections] = useState({});     // { new_part_cd: ref_part_cd }
  const [manualQty, setManualQty] = useState({});       // { new_part_cd: number }
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  // 데이터 로딩
  useEffect(() => {
    fetch('/style_mapping_data.json')
      .then(res => {
        if (!res.ok) throw new Error('style_mapping_data.json을 찾을 수 없습니다. 파이프라인을 먼저 실행하세요.');
        return res.json();
      })
      .then(json => {
        setData(json);
        const defaults = {};
        for (const style of json.styles) {
          if (style.references.length > 0) {
            defaults[style.new_part_cd] = style.references[0].part_cd;
          }
        }
        setSelections(defaults);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 카테고리 목록
  const categories = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.styles.map(s => s.new_class2));
    return [...set].sort();
  }, [data]);

  // 필터링된 스타일
  const filteredStyles = useMemo(() => {
    if (!data) return [];
    if (categoryFilter === 'all') return data.styles;
    return data.styles.filter(s => s.new_class2 === categoryFilter);
  }, [data, categoryFilter]);

  // 확정 진행률: 매칭된 스타일 선택 수 + 수동입력 스타일 수
  const totalStyles = data?.metadata.total_styles || 0;
  const matchedSelections = Object.keys(selections).length;
  const manualEntries = Object.values(manualQty).filter(v => v > 0).length;
  const confirmedCount = matchedSelections + manualEntries;

  // 선택 핸들러
  const handleSelect = (newPartCd, refPartCd) => {
    setSelections(prev => ({ ...prev, [newPartCd]: refPartCd }));
    setSaveResult(null);
  };

  // 수동 발주량 핸들러
  const handleManualQty = (newPartCd, value) => {
    const qty = parseInt(value, 10);
    setManualQty(prev => ({ ...prev, [newPartCd]: isNaN(qty) ? 0 : qty }));
    setSaveResult(null);
  };

  // 확정 저장
  const handleConfirm = async () => {
    setSaving(true);
    setSaveResult(null);

    const mappings = [];

    for (const style of data.styles) {
      if (style.references.length > 0 && selections[style.new_part_cd]) {
        // 매칭된 스타일
        const ref = style.references.find(r => r.part_cd === selections[style.new_part_cd]);
        mappings.push({
          new_part_cd: style.new_part_cd,
          new_item_nm: style.new_item_nm,
          new_class2: style.new_class2,
          selected_ref_part_cd: selections[style.new_part_cd],
          selected_ref_score: ref ? ref.score : 0,
        });
      } else if (style.references.length === 0 && (manualQty[style.new_part_cd] || 0) > 0) {
        // 매칭 불가 → 수동 입력
        mappings.push({
          new_part_cd: style.new_part_cd,
          new_item_nm: style.new_item_nm,
          new_class2: style.new_class2,
          manual_order_qty: manualQty[style.new_part_cd],
        });
      }
    }

    try {
      const res = await fetch('http://localhost:8000/api/confirmed-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: data.metadata.new_season, mappings }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `서버 오류 (${res.status})`);
      }
      const result = await res.json();
      setSaveResult({ success: true, data: result });
    } catch (err) {
      setSaveResult({ success: false, message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>맵핑 데이터 로딩 중...</span>
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

  return (
    <div className="space-y-4">
      {/* 상단 요약 바 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-600">
            총 <strong className="text-gray-900">{totalStyles}</strong> 스타일
          </span>
          <span className="text-sm text-gray-600">
            매칭 <strong className="text-green-600">{data.metadata.matched_styles}</strong> /
            수동입력 <strong className="text-amber-500">{data.metadata.unmatched_styles}</strong>
          </span>
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
        <div className="flex items-center gap-3">
          {categoryFilter !== 'all' && (
            <span className="text-xs text-gray-400">
              {filteredStyles.length}건 표시
            </span>
          )}
          {saveResult && saveResult.success && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              총 {saveResult.data.total_recommendation_qty?.toLocaleString()}장
            </span>
          )}
          {saveResult && !saveResult.success && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              {saveResult.message}
            </span>
          )}
          <span className="text-sm text-gray-500">
            <strong className="text-blue-600">{confirmedCount}</strong>/{totalStyles} 확정 완료
          </span>
          <button
            onClick={handleConfirm}
            disabled={saving || confirmedCount === 0}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            확정 저장
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="w-[3%] px-2 py-3 text-center text-xs font-semibold text-gray-500">#</th>
                <th className="w-[13%] px-3 py-3 text-left text-xs font-semibold text-gray-500">신규 품번</th>
                <th className="w-[9%] px-3 py-3 text-left text-xs font-semibold text-gray-500">품명</th>
                <th className="w-[6%] px-3 py-3 text-left text-xs font-semibold text-gray-500">복종</th>
                <th className="w-[3%] px-2 py-3 text-center text-xs font-semibold text-gray-500">선택</th>
                <th className="w-[13%] px-3 py-3 text-left text-xs font-semibold text-gray-500">유사 품번</th>
                <th className="w-[9%] px-3 py-3 text-left text-xs font-semibold text-gray-500">품명</th>
                <th className="w-[7%] px-3 py-3 text-center text-xs font-semibold text-gray-500">유사도</th>
                <th className="w-[7%] px-3 py-3 text-right text-xs font-semibold text-gray-500">판매율</th>
                <th className="w-[9%] px-3 py-3 text-right text-xs font-semibold text-gray-500">총판매</th>
                <th className="w-[9%] px-3 py-3 text-right text-xs font-semibold text-gray-500">총입고</th>
                <th className="w-[12%] px-3 py-3 text-right text-xs font-semibold text-gray-500">AI발주량</th>
              </tr>
            </thead>
            <tbody>
              {filteredStyles.map((style, idx) => {
                const refs = style.references;
                const rowCount = Math.max(refs.length, 1);

                return refs.length === 0 ? (
                  // 매칭 불가 → 수동 입력 행
                  <tr key={style.new_part_cd} className="border-b border-gray-200 bg-amber-50/40">
                    <td className="px-2 py-2.5 text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{style.new_part_cd}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{style.new_item_nm}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{style.new_class2}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-300">-</td>
                    <td colSpan={4} className="px-3 py-2.5 text-xs text-amber-600 italic">
                      매칭 불가 — 예상 발주량 직접 입력
                    </td>
                    <td colSpan={2} />
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        placeholder="수량 입력"
                        value={manualQty[style.new_part_cd] || ''}
                        onChange={e => handleManualQty(style.new_part_cd, e.target.value)}
                        className="w-24 text-xs text-right border border-amber-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      />
                    </td>
                  </tr>
                ) : (
                  // 유사스타일 행 (Top 1~3)
                  refs.map((ref, refIdx) => {
                    const isSelected = selections[style.new_part_cd] === ref.part_cd;
                    const isFirst = refIdx === 0;
                    const isLast = refIdx === refs.length - 1;

                    return (
                      <tr
                        key={`${style.new_part_cd}-${ref.rank}`}
                        className={`${isLast ? 'border-b border-gray-200' : ''} ${isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50/50'} transition-colors`}
                      >
                        {isFirst && (
                          <>
                            <td rowSpan={rowCount} className="px-2 py-2.5 text-center text-xs text-gray-400 align-top border-r border-gray-100">
                              {idx + 1}
                            </td>
                            <td rowSpan={rowCount} className="px-3 py-2.5 text-xs font-mono text-gray-800 align-top border-r border-gray-100">
                              {style.new_part_cd}
                            </td>
                            <td rowSpan={rowCount} className="px-3 py-2.5 text-xs text-gray-700 align-top border-r border-gray-100">
                              {style.new_item_nm}
                            </td>
                            <td rowSpan={rowCount} className="px-3 py-2.5 text-xs text-gray-500 align-top border-r border-gray-100">
                              {style.new_class2}
                            </td>
                          </>
                        )}

                        <td className="px-2 py-2 text-center">
                          <input
                            type="radio"
                            name={`ref-${style.new_part_cd}`}
                            checked={isSelected}
                            onChange={() => handleSelect(style.new_part_cd, ref.part_cd)}
                            className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-gray-700">{ref.part_cd}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{ref.item_nm}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            ref.score >= 0.85 ? 'bg-green-100 text-green-700' :
                            ref.score >= 0.70 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {ref.score.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-700">{ref.판매율.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-700">{ref.총판매.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-700">{ref.총입고.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-xs font-medium text-gray-800">{ref.AI발주량.toLocaleString()}</td>
                      </tr>
                    );
                  })
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
