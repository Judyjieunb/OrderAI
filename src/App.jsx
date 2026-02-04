import React, { useState } from 'react'
import { Settings, TrendingUp, Search, Filter, Check, BarChart2 } from 'lucide-react'
import Dashboard from './components/Dashboard.jsx'
import SizeAssortmentExample from './components/SizeAssortment.example.jsx'
import SeasonClosing from './components/SeasonClosing.jsx'

const steps = [
  { id: 'step0', label: 'Step 0', title: 'KPI + Index Setup', desc: '우리 브랜드에서 사용할 목표판매율 기준과 핵심 성과지표(KPI)를 설정합니다.', icon: Settings },
  { id: 'step1', label: 'Step 1', title: 'Budget Setup', desc: '전 시즌 마감분석 및 AI제안을 바탕으로 카테고리별 목표 매출과 발주 예산을 설정합니다.', icon: TrendingUp },
  { id: 'step2', label: 'Step 2', title: 'Case Study', desc: '전 시즌 스타일별 실적추이를 주차별로 분석하여, 우리가 놓친 기회비용은 없었는지 점검합니다.', icon: Search },
  { id: 'step3', label: 'Step 3', title: 'Style-mapping', desc: '과거 스타일과 신규 스타일 간 유사도 매핑 결과를 확인 하고 확정해주세요. 다음 Step4 발주수량 제안에 유사스타일 실적이 활용됩니다.', icon: Filter },
  { id: 'step4', label: 'Step 4', title: 'Order Suggest', desc: 'AI 수요 예측과 예산 한도를 반영한 스타일별 발주 추천 수량을 검토합니다.', icon: Check },
  { id: 'step5', label: 'Step 5', title: 'Size-Assortment', desc: '컬러별 사이즈 아소트를 최적화하여 최종 사이즈별 발주 수량을 산출합니다.', icon: BarChart2 },
]

export default function App() {
  const [activeStep, setActiveStep] = useState('step1')

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 py-[34px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center font-bold text-white shadow-inner">
              AI
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-100">
              Initial Order Simulator <span className="text-xs font-normal text-slate-400 ml-1 opacity-70">v1.0</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 sticky top-[64px] z-40 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="flex space-x-6 overflow-x-auto no-scrollbar">
            {steps.map((step) => {
              const isActive = activeStep === step.id
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`relative py-4 text-sm font-medium transition-all duration-200 border-b-2 flex items-center gap-2 whitespace-nowrap
                    ${isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    {step.label}
                  </span>
                  <span>{step.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-8 py-8 min-h-[calc(100vh-130px)]">
        <PageHeader step={steps.find(s => s.id === activeStep)} />
        {activeStep === 'step0' && <Placeholder />}
        {activeStep === 'step1' && <SeasonClosing />}
        {activeStep === 'step2' && <Dashboard />}
        {activeStep === 'step3' && <Placeholder />}
        {activeStep === 'step4' && <Placeholder />}
        {activeStep === 'step5' && <SizeAssortmentExample />}
      </main>
    </div>
  )
}

function PageHeader({ step }) {
  if (!step) return null
  const Icon = step.icon
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">{step.title}</h1>
      </div>
      <p className="text-sm text-gray-500 ml-11">{step.desc}</p>
    </header>
  )
}

function Placeholder() {
  return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      <p className="text-sm">구현 예정</p>
    </div>
  )
}
