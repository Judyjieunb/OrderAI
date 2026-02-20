import React, { useState } from 'react';
import { Building2, Clock, Target, Award, Settings, Save, AlertTriangle, Download } from 'lucide-react';

// 브랜드 옵션
const brandOptions = [
  { id: 'MLB', label: 'MLB', color: 'bg-red-500' },
  { id: 'Discovery', label: 'Discovery', color: 'bg-orange-500' },
  { id: 'Duvetica', label: 'Duvetica', color: 'bg-blue-500' },
  { id: 'MLBKids', label: 'MLB Kids', color: 'bg-pink-500' },
  { id: 'Sergio', label: 'Sergio Tacchini', color: 'bg-emerald-500' },
];

// 시즌 옵션
const seasonYears = [24, 25, 26, 27];

// 등급 프리셋
const gradePresets = {
  conservative: { label: '보수적', desc: '재고 리스크 최소화', thresholds: { S: 80, A: 70, B: 60, C: 50 } },
  standard: { label: '표준', desc: '균형 잡힌 기준', thresholds: { S: 75, A: 65, B: 55, C: 40 } },
  aggressive: { label: '공격적', desc: '판매 기회 극대화', thresholds: { S: 70, A: 60, B: 50, C: 35 } },
  custom: { label: '커스텀', desc: '직접 설정', thresholds: null },
};

// 기본값
const defaultConfig = {
  brand: 'MLB',
  baseSeason: '25S',
  targetSeason: '26S',
  seasonType: 'SS',
  startDate: { month: '03', day: '01' },
  endDate: { month: '08', day: '31' },
  targetSellThrough: 70,
  gradeThresholds: { S: 75, A: 65, B: 55, C: 40 },
  commercialStockoutThreshold: 50,
  earlyStockoutDate: { month: '04', day: '30' },
};

export default function BrandIndexSetup() {
  const [config, setConfig] = useState(defaultConfig);
  const [isSaved, setIsSaved] = useState(false);
  const [gradePreset, setGradePreset] = useState('standard');

  const handlePresetChange = (presetKey) => {
    setGradePreset(presetKey);
    if (presetKey !== 'custom' && gradePresets[presetKey].thresholds) {
      setConfig(prev => ({
        ...prev,
        gradeThresholds: { ...gradePresets[presetKey].thresholds }
      }));
    }
  };

  const handleSave = () => {
    localStorage.setItem('brandIndexConfig', JSON.stringify(config));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brand_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateGradeThreshold = (grade, value) => {
    const newValue = Math.max(0, Math.min(100, parseInt(value) || 0));
    setConfig(prev => ({
      ...prev,
      gradeThresholds: { ...prev.gradeThresholds, [grade]: newValue }
    }));
  };

  return (
    <div className="space-y-6">
      {/* 섹션 1: 브랜드 및 시즌 환경 설정 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-800">브랜드 및 시즌 환경 설정</h3>
        </div>

        {/* 브랜드 선택 - 텍스트 버튼 그리드 */}
        <div className="mb-10">
          <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
            BRAND IDENTITY
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {brandOptions.map((brand) => (
              <button
                key={brand.id}
                onClick={() => updateConfig('brand', brand.id)}
                className={`py-4 px-3 rounded-xl text-sm font-semibold transition-all ${
                  config.brand === brand.id
                    ? 'bg-slate-800 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {brand.label}
              </button>
            ))}
          </div>
        </div>

        {/* 목표 판매율 - 슬라이더 + 게이지 */}
        <div className="mb-10">
          <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
            TARGET SELL-THROUGH RATE
          </label>
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <svg className="w-40 h-20" viewBox="0 0 160 80">
                  {/* 배경 호 */}
                  <path
                    d="M 10 75 A 70 70 0 0 1 150 75"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  {/* 값 호 */}
                  <path
                    d="M 10 75 A 70 70 0 0 1 150 75"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${((config.targetSellThrough - 50) / 45) * 220} 220`}
                  />
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-end justify-center pb-1">
                  <span className="text-4xl font-bold text-slate-800">{config.targetSellThrough}</span>
                  <span className="text-lg text-slate-400 ml-1 mb-1">%</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={config.targetSellThrough}
              onChange={(e) => updateConfig('targetSellThrough', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
            />
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span>보수적 50%</span>
              <span>공격적 95%</span>
            </div>
          </div>
        </div>

        {/* 시즌 선택 - 드롭다운 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 기준 시즌 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
              REFERENCE SEASON
            </label>
            <select
              value={config.baseSeason}
              onChange={(e) => updateConfig('baseSeason', e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:border-slate-400"
            >
              {seasonYears.flatMap(year =>
                ['S', 'F'].map(type => {
                  const seasonId = `${year}${type}`;
                  return <option key={seasonId} value={seasonId}>{seasonId}</option>;
                })
              )}
            </select>
          </div>

          {/* 기획 시즌 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
              PLANNING SEASON
            </label>
            <select
              value={config.targetSeason}
              onChange={(e) => updateConfig('targetSeason', e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:border-slate-400"
            >
              {seasonYears.flatMap(year =>
                ['S', 'F'].map(type => {
                  const seasonId = `${year}${type}`;
                  return <option key={seasonId} value={seasonId}>{seasonId}</option>;
                })
              )}
            </select>
          </div>
        </div>
      </div>

      {/* 섹션 2: 시즌 타임라인 기준 설정 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-8">
          <Clock className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-800">시즌 타임라인 기준 설정</h3>
        </div>

        {/* 시즌 타입 토글 */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-8">
          <button
            onClick={() => updateConfig('seasonType', 'SS')}
            className={`flex-1 py-4 text-sm font-semibold transition-all ${
              config.seasonType === 'SS'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            Spring / Summer (03월 ~ 08월)
          </button>
          <button
            onClick={() => updateConfig('seasonType', 'FW')}
            className={`flex-1 py-4 text-sm font-semibold transition-all ${
              config.seasonType === 'FW'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            Fall / Winter (09월 ~ 02월)
          </button>
        </div>

        {/* 날짜 선택 - 월/일 드롭다운 조합 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
              START DATE
            </label>
            <div className="flex gap-3">
              <select
                value={config.startDate.month}
                onChange={(e) => updateConfig('startDate', { ...config.startDate, month: e.target.value })}
                className="flex-1 p-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:border-slate-400"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return <option key={month} value={month}>{month}월</option>;
                })}
              </select>
              <select
                value={config.startDate.day}
                onChange={(e) => updateConfig('startDate', { ...config.startDate, day: e.target.value })}
                className="flex-1 p-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:border-slate-400"
              >
                {Array.from({ length: 31 }, (_, i) => {
                  const day = String(i + 1).padStart(2, '0');
                  return <option key={day} value={day}>{day}일</option>;
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
              END DATE
            </label>
            <div className="flex gap-3">
              <select
                value={config.endDate.month}
                onChange={(e) => updateConfig('endDate', { ...config.endDate, month: e.target.value })}
                className="flex-1 p-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:border-slate-400"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return <option key={month} value={month}>{month}월</option>;
                })}
              </select>
              <select
                value={config.endDate.day}
                onChange={(e) => updateConfig('endDate', { ...config.endDate, day: e.target.value })}
                className="flex-1 p-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:border-slate-400"
              >
                {Array.from({ length: 31 }, (_, i) => {
                  const day = String(i + 1).padStart(2, '0');
                  return <option key={day} value={day}>{day}일</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 섹션 3: 등급 기준 설정 - 프리셋 + 커스텀 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-8">
          <Award className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-800">등급 기준 설정</h3>
        </div>

        {/* 프리셋 선택 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Object.entries(gradePresets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                gradePreset === key
                  ? 'border-slate-800 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`text-sm font-semibold mb-1 ${gradePreset === key ? 'text-slate-800' : 'text-slate-600'}`}>
                {preset.label}
              </div>
              <div className="text-xs text-slate-400">{preset.desc}</div>
            </button>
          ))}
        </div>

        {/* 등급 테이블 */}
        <div className="bg-slate-50 rounded-xl p-6">
          <div className="flex items-center gap-2 justify-center">
            {['S', 'A', 'B', 'C', 'D'].map((grade) => {
              const colors = {
                S: 'bg-emerald-500',
                A: 'bg-blue-500',
                B: 'bg-amber-500',
                C: 'bg-orange-500',
                D: 'bg-red-500'
              };
              const isD = grade === 'D';
              return (
                <div key={grade} className="flex-1 text-center">
                  <div className={`w-10 h-10 mx-auto mb-3 rounded-full ${colors[grade]} text-white font-bold flex items-center justify-center shadow-lg`}>
                    {grade}
                  </div>
                  {isD ? (
                    <div className="text-sm text-slate-500 py-2">
                      &lt; {config.gradeThresholds.C}%
                    </div>
                  ) : gradePreset === 'custom' ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-slate-400 text-sm">≥</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.gradeThresholds[grade]}
                        onChange={(e) => updateGradeThreshold(grade, e.target.value)}
                        className="w-14 p-2 rounded-lg border border-slate-200 text-center text-sm font-semibold bg-white focus:outline-none focus:border-slate-400"
                      />
                      <span className="text-slate-400 text-sm">%</span>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-700 py-2">
                      ≥ {config.gradeThresholds[grade]}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 섹션 4: 고급 설정 - 반원 게이지 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-800">고급 설정</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 상업적 결품 감지 기준 - 반원 게이지 */}
          <div className="text-center">
            <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
              COMMERCIAL STOCKOUT
            </label>
            <div className="relative inline-block">
              <svg className="w-36 h-20" viewBox="0 0 144 72">
                <path
                  d="M 8 68 A 60 60 0 0 1 136 68"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d="M 8 68 A 60 60 0 0 1 136 68"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${((config.commercialStockoutThreshold - 30) / 50) * 188} 188`}
                />
              </svg>
              <div className="absolute inset-0 flex items-end justify-center pb-0">
                <span className="text-2xl font-bold text-slate-800">{config.commercialStockoutThreshold}%</span>
              </div>
            </div>
            <input
              type="range"
              min="30"
              max="80"
              value={config.commercialStockoutThreshold}
              onChange={(e) => updateConfig('commercialStockoutThreshold', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500 mt-4"
            />
            <p className="mt-3 text-xs text-slate-400">
              사이즈 불균형 결품 기준
            </p>
          </div>

          {/* 조기 결품 기준일 */}
          <div className="text-center">
            <label className="block text-xs font-semibold text-slate-400 tracking-wider mb-4">
              EARLY STOCKOUT DATE
            </label>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-lg font-bold text-slate-800">
                  {config.earlyStockoutDate.month}월 {config.earlyStockoutDate.day}일
                </span>
              </div>
              <div className="flex gap-2">
                <select
                  value={config.earlyStockoutDate.month}
                  onChange={(e) => updateConfig('earlyStockoutDate', { ...config.earlyStockoutDate, month: e.target.value })}
                  className="flex-1 p-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = String(i + 1).padStart(2, '0');
                    return <option key={month} value={month}>{month}월</option>;
                  })}
                </select>
                <select
                  value={config.earlyStockoutDate.day}
                  onChange={(e) => updateConfig('earlyStockoutDate', { ...config.earlyStockoutDate, day: e.target.value })}
                  className="flex-1 p-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => {
                    const day = String(i + 1).padStart(2, '0');
                    return <option key={day} value={day}>{day}일</option>;
                  })}
                </select>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              이 날짜 이전 결품 시 조기결품
            </p>
          </div>
        </div>
      </div>

      {/* 저장 / Export 버튼 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleExportConfig}
          className="px-8 py-4 rounded-xl font-semibold transition-all flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          <Download className="w-4 h-4" />
          Export Config
        </button>
        <button
          onClick={handleSave}
          className={`px-8 py-4 rounded-xl font-semibold transition-all flex items-center gap-2 ${
            isSaved
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaved ? '저장 완료!' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}
