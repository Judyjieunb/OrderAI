import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  FileSpreadsheet,
  Database,
  Settings,
  TrendingUp,
  BarChart2,
  LineChart,
  Shirt,
  ShoppingCart,
  FileJson,
  User,
  HelpCircle,
  Target
} from 'lucide-react';

// 워크플로우 단계 데이터
const getWorkflowSteps = (currentSeason, targetSeason) => [
  {
    id: 0,
    title: 'KPI + Index Setup',
    subtitle: 'Index Configuration',
    role: '팀장급',
    icon: <Target className="w-5 h-5" />,
    input: {
      files: ['브랜드 설정'],
      data: ['분석 시즌', '발주 시즌', '목표 판매율']
    },
    process: {
      content: '분석 대상 시즌과 발주 대상 시즌을 지정하고, 등급 산정 기준(S/A/B/C/D)을 설정',
      logic: '사용자가 브랜드 내부기준을 직접 설정'
    },
    output: {
      files: ['index_config.json'],
      target: 'STEP 1~5 전체 분석/발주 기준으로 활용'
    },
    actions: [
      `분석할 과거 시즌 선택 (예: ${currentSeason})`,
      `발주할 차기 시즌 선택 (예: ${targetSeason})`,
      '목표 판매율 입력 (기본 60%)'
    ],
    result: '시즌 인덱스 및 KPI 기준 설정 완료'
  },
  {
    id: 1,
    title: 'Budget Setup',
    subtitle: '시즌 마감 분석 + 예산 확정',
    role: '팀장급',
    icon: <TrendingUp className="w-5 h-5" />,
    input: {
      files: ['sql_result_raw.xlsx'],
      data: ['입고수량', '판매수량', '복종', '아이템명', '스타일코드']
    },
    process: {
      content: '전년 동시즌 마감 분석 : 단계별 Drill-down 진단 (시즌종합→복종→아이템→스타일) +AI 예산 제안',
      logic: 'S(≥75%) / A(≥65%) / B(≥55%) / C(≥40%) / D(<40%)'
    },
    output: {
      files: ['Analysis_Result.xlsx', 'season_closing_data.json', 'budget_config.json'],
      target: '최종 발주 스케일링의 예산 한도로 활용'
    },
    actions: [
      '시즌 요약 카드에서 종합실적 확인',
      '밸런스 차트로 확대/축소 필요 카테고리 파악',
      'BCG 매트릭스로 아이템별 효율성 진단',
      '"AI 예산 제안" 클릭 → 목표 매출/성장률 조정',
      '카테고리별 비중(%) 및 목표 판매율(%) 조정',
      '"Budget Ceiling 확정" 클릭'
    ],
    result: '차기 시즌 카테고리별 예산 천장 확정 (budget_config.json)'
  },
  {
    id: 2,
    title: 'Case Study',
    subtitle: '주간 실적 추이 + 기회손실 분석',
    role: '담당자급',
    icon: <LineChart className="w-5 h-5" />,
    input: {
      files: ['weekly_dx25s.xlsx'],
      data: ['주차별 판매량', '주차별 재고량', '리오더 이벤트']
    },
    process: {
      content: '스타일별 주간 판매/재고 추이 분석 및 AI 진단 (Hit/Normal/Shortage/Risk 분류)',
      logic: '상업적 결품 감지 + AI 기회손실 산출 (Decay Model 자동 적용)'
    },
    output: {
      files: ['TimeSeries_Result.xlsx', 'dashboard_data.json (기회손실 포함)'],
      target: 'STEP3 스타일 매핑 참고 + STEP4 발주 추천의 기초 데이터'
    },
    actions: [
      '케이스별 AI진단 유형 필터링',
      '스타일 선택하여 주차별 시계열 차트 확인',
      '기회손실 영역(빨간 점선) 및 잠재 판매량 확인',
      'AI 패턴 진단 코멘트로 원인 분석'
    ],
    result: '성공/실패 사례 학습 및 기회손실 리뷰 완료'
  },
  {
    id: 3,
    title: 'Style-mapping',
    subtitle: '유사 스타일 매핑',
    role: '담당자급',
    icon: <Shirt className="w-5 h-5" />,
    input: {
      files: ['similarity_mapping.csv (사전 생성된 유사도 매핑)'],
      data: [`${currentSeason} 레퍼런스 스타일`, `${targetSeason} 신규 스타일`, '유사도 점수']
    },
    process: {
      content: `과거-현재의 유사스타일 맵핑 결과를 검토하고 확정`,
      logic: ' 속성데이터(카테고리, 소재, 가격대 등) 기반 유사도 스코어링'
    },
    output: {
      files: ['확정된 스타일 매핑 리스트'],
      target: 'STEP4에서 레퍼런스 스타일의 실적 기반으로 신규 스타일 발주량 산출'
    },
    actions: [
      `과시즌 상품 ↔ 신규 상품 매핑 테이블 확인`,
      '유사도 점수가 낮은 매핑 검토 및 수동 조정',
      '매핑 제외/추가 스타일 처리',
      '최종 매핑 리스트 확정'
    ],
    result: `유사스타일 매핑 확정데이터는 STEP4 발주량 추천의 기준이 됨`
  },
  {
    id: 4,
    title: 'Order Suggest',
    subtitle: 'AI 수요예측 기반 발주 추천',
    role: '담당자급',
    icon: <ShoppingCart className="w-5 h-5" />,
    input: {
      files: ['확정 매핑', 'budget_config.json', 'STEP2 분석 결과'],
      data: ['레퍼런스 스타일 실적', '기회손실 데이터', '카테고리별 예산 한도']
    },
    process: {
      content: '레퍼런스 스타일의 실적 + AI 기회손실을 반영한 발주량 산출, 예산 초과 시 비례 스케일링',
      logic: 'AI추천량 = 실판매+기회손실 → 스케일링 = AI추천량 × (예산한도/카테고리합계)'
    },
    output: {
      files: [`${targetSeason}_Order_Recommendation.xlsx`, `${targetSeason}_Order_Recommendation.json`],
      target: 'STEP5 사이즈 배분의 스타일별 발주 총량으로 활용'
    },
    actions: [
      'AI 추천 발주량 (기회손실 반영) 확인',
      '예산 천장 대비 스케일링 적용 결과 검토',
      '카테고리별/스타일별 발주 수량 조정',
      '최종 발주 대상 스타일 리스트 확정'
    ],
    result: '예산 범위 내 스타일별 발주 수량 확정'
  },
  {
    id: 5,
    title: 'Size-Assortment',
    subtitle: '사이즈 배분 최적화',
    role: '담당자급',
    icon: <BarChart2 className="w-5 h-5" />,
    input: {
      files: ['STEP 4 발주 추천', '과거 사이즈별 판매 비중'],
      data: ['스타일별 총 발주량', '카테고리/서브카테고리/컬러 필터']
    },
    process: {
      content: '총 발주량을 사이즈별 판매 비중에 따라 최적 배분',
      logic: '타겟 범위 외 사이즈 제외 시 Renormalization (비중 재계산)'
    },
    output: {
      files: ['Final_Order_Sheet.xlsx (스타일×사이즈)'],
      target: '최종 발주제안서 다운로드'
    },
    actions: [
      '카테고리/서브카테고리 필터 선택',
      '컬러 범위 지정 (전체 또는 특정 컬러군)',
      '사이즈 단위 선택 (5mm / 10mm)',
      '타겟 사이즈 범위 설정 (최소~최대)',
      '배분율 차트 및 수량 테이블 확인',
      '최종 발주서 엑셀 다운로드'
    ],
    result: '📦 SKU 단위 최종 발주서 완성'
  }
];

// 메인 컴포넌트
const WorkflowGuide = ({ onClose, onNavigate, currentSeason = '25S', targetSeason = '26S' }) => {
  const [activeStep, setActiveStep] = useState(1);
  const steps = getWorkflowSteps(currentSeason, targetSeason);

  const handleNavigate = (stepId) => {
    onNavigate?.(`step${stepId}`);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-50 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">OrderAI 시스템 워크플로우 가이드</h2>
              <p className="text-sm text-slate-500">데이터 입력부터 최종 발주서 생성까지의 단계별 가이드</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Role Legend */}
          <div className="flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-slate-600">팀장급 의사결정: <span className="font-semibold text-violet-600">STEP 0~1</span></span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <span className="text-slate-600">담당자급 실행: <span className="font-semibold text-blue-600">STEP 2~5</span></span>
            </div>
          </div>

          {/* Interactive Flowchart */}
          <section>
            <div className="relative">
              {/* Connecting Line */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 hidden md:block z-0 rounded-full"></div>

              {/* Step Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 relative z-10">
                {steps.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className={`flex flex-col items-center p-4 rounded-xl border transition-all duration-200 ${
                      activeStep === step.id
                        ? 'bg-indigo-600 border-indigo-600 shadow-lg scale-105 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
                      activeStep === step.id ? 'bg-white/20' : 'bg-slate-100'
                    }`}>
                      {step.icon}
                    </div>
                    <span className={`text-[10px] font-bold uppercase mb-1 ${
                      activeStep === step.id ? 'text-indigo-200' : 'text-slate-400'
                    }`}>
                      STEP {step.id}
                    </span>
                    <span className="text-xs font-semibold text-center leading-tight">{step.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Detailed Panel */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Panel Header */}
            <div className="bg-slate-800 text-white px-6 py-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded">
                  STEP {activeStep}
                </span>
                <h4 className="text-lg font-bold">{steps[activeStep].title}</h4>
                <span className="text-slate-400 text-sm">/ {steps[activeStep].subtitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">{steps[activeStep].role}</span>
              </div>
            </div>

            {/* Panel Content */}
            <div className="p-8">
              <div className="grid md:grid-cols-4 gap-6">

                {/* DATA */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600 font-bold border-b border-blue-100 pb-2 text-sm">
                    <Database className="w-4 h-4" /> DATA
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">data/files</div>
                      {steps[activeStep].input.files.map((f, i) => (
                        <div key={i} className="mb-1.5 flex items-center gap-2 text-xs text-slate-700">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">데이터</div>
                      {steps[activeStep].input.data.map((d, i) => (
                        <div key={i} className="mb-1 text-xs text-slate-500">{d}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PROCESS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-orange-600 font-bold border-b border-orange-100 pb-2 text-sm">
                    <Settings className="w-4 h-4" /> PROCESS
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {steps[activeStep].process.content}
                    </p>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                      <div className="text-[10px] font-bold text-orange-400 mb-1 uppercase tracking-wider">핵심 로직</div>
                      <p className="text-xs text-orange-700 font-mono">{steps[activeStep].process.logic}</p>
                    </div>
                  </div>
                </div>

                {/* USER ACTION */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-violet-600 font-bold border-b border-violet-100 pb-2 text-sm">
                    <User className="w-4 h-4" /> USER ACTION
                  </div>
                  <div className="space-y-3">
                    <ul className="space-y-2">
                      {steps[activeStep].actions.map((action, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-700">
                          <span className="text-violet-400 font-bold">{i + 1}.</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                    {steps[activeStep].result && (
                      <div className="bg-violet-50 p-3 rounded-lg border border-violet-100">
                        <div className="text-[10px] font-bold text-violet-400 mb-1 uppercase tracking-wider">결과</div>
                        <p className="text-xs text-violet-700 font-medium">{steps[activeStep].result}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* OUTPUT */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold border-b border-emerald-100 pb-2 text-sm">
                    <FileJson className="w-4 h-4" /> OUTPUT
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">생성 파일</div>
                      {steps[activeStep].output.files.map((f, i) => (
                        <div key={i} className="mb-1.5 flex items-center gap-2 text-xs text-slate-700">
                          <FileJson className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                      <div className="text-[10px] font-bold text-emerald-400 mb-1 uppercase tracking-wider">다음 연결</div>
                      <p className="text-xs text-emerald-700">{steps[activeStep].output.target}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigate Button */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => handleNavigate(activeStep)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200"
                >
                  해당 화면 이동
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default WorkflowGuide;
