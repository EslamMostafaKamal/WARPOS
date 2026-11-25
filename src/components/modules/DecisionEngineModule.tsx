import React, { useState } from 'react';
import {
  Calculator,
  Sigma,
  TrendingUp,
  Layers,
  Wallet,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { AppModule } from '../../types';
import { useStore } from '../../context/StoreContext';
import { BusinessDecision, EngineDomain } from '../../engines/decisionEngine';
import { formatCurrency } from '../../utils/format';
import { tr } from '../../utils/i18n';

interface DecisionEngineModuleProps {
  onNavigate: (module: AppModule) => void;
}

export const DecisionEngineModule: React.FC<DecisionEngineModuleProps> = ({ onNavigate }) => {
  const {
    state,
    decisionReport,
    updateProductPrice,
    receivePurchaseOrder,
    setPendingRestockBatch,
  } = useStore();
  const sym = state.settings.currencySymbol;
  const lang = state.settings.language;

  const [domainFilter, setDomainFilter] = useState<'all' | EngineDomain>('all');
  const [expandedProofId, setExpandedProofId] = useState<string | null>(
    decisionReport.decisions[0]?.id ?? null
  );

  const visibleDecisions = decisionReport.decisions.filter(
    (d) => domainFilter === 'all' || d.domain === domainFilter
  );

  const handleExecuteDecision = (decision: BusinessDecision) => {
    const act = decision.action;
    if (act.type === 'create_eoq_po') {
      setPendingRestockBatch(act.items);
      onNavigate('purchases');
    } else if (act.type === 'update_price') {
      updateProductPrice(act.productId, act.newPrice);
    } else if (act.type === 'receive_po') {
      receivePurchaseOrder(act.poId);
    } else if (act.type === 'navigate_customers') {
      onNavigate('customers');
    } else if (act.type === 'navigate_expenses') {
      onNavigate('expenses');
    }
  };

  const priorityLabel = (p: BusinessDecision['priority']) => {
    if (lang === 'ar') {
      return p === 'high' ? 'أولوية قصوى' : p === 'medium' ? 'متوسطة' : 'تحسينية';
    }
    return p === 'high' ? 'High Priority' : p === 'medium' ? 'Medium Priority' : 'Advisory';
  };

  return (
    <div className="space-y-6">
      {/* Whole-Business Mathematical Health Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              {tr(lang, 'Whole-Business Index', 'مؤشر كفاءة المنشأة')}
            </span>
            <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-3">
            {decisionReport.healthScore}
            <span className="text-sm font-normal text-slate-400"> / 100</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {tr(
              lang,
              `${decisionReport.activeEnginesCount} deterministic math engines active`,
              `${decisionReport.activeEnginesCount} محركات رياضية حتمية تعمل بالخلفية`
            )}
          </p>
        </div>

        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              {tr(lang, 'Break-Even Revenue (BEP)', 'إيراد نقطة التعادل (BEP)')}
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Sigma className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-3">
            {formatCurrency(decisionReport.breakEvenRevenue, sym)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {tr(lang, 'CMR', 'هامش المساهمة')} {decisionReport.contributionMarginRatio}% ·{' '}
            <span
              className={
                decisionReport.marginOfSafetyPct >= 20
                  ? 'text-emerald-700 font-semibold'
                  : 'text-amber-700 font-semibold'
              }
            >
              {tr(lang, 'Safety', 'هامش أمان')} {decisionReport.marginOfSafetyPct}%
            </span>
          </p>
        </div>

        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              {tr(lang, 'Net Working Capital', 'صافي رأس المال العامل')}
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p
            className={`text-2xl font-bold font-mono tabular-nums mt-3 ${
              decisionReport.workingCapitalNet >= 0 ? 'text-slate-900' : 'text-red-600'
            }`}
          >
            {formatCurrency(decisionReport.workingCapitalNet, sym)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {tr(lang, 'AR', 'ذمم')} {formatCurrency(decisionReport.receivablesTotal, sym)} ·{' '}
            {tr(lang, 'AP', 'موردون')} {formatCurrency(decisionReport.payablesTotal, sym)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              {tr(lang, 'ABC Pareto Mix', 'توزيع باريتو ABC للأصناف')}
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-3">
            {decisionReport.abcBreakdown.classA}A · {decisionReport.abcBreakdown.classB}B ·{' '}
            {decisionReport.abcBreakdown.classC}C
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {tr(lang, 'Inventory cost basis', 'تكلفة المخزون')}{' '}
            {formatCurrency(decisionReport.inventoryValuationCost, sym)}
          </p>
        </div>
      </div>

      {/* Filter Bar & Proved Mathematical Decisions */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {tr(
                lang,
                `Verified Business Decisions (${visibleDecisions.length})`,
                `القرارات التجارية المبرهنة رياضياً (${visibleDecisions.length})`
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr(
                lang,
                'Continuously computed from live sales, stock velocity, supplier payables, and operating overhead',
                'تُحسب لحظياً من المبيعات الفعلية، سرعة دوران المخزون، التزامات الموردين، والمصروفات التشغيلية'
              )}
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg">
            {(
              [
                { id: 'all', label: tr(lang, 'All Engines', 'جميع المحركات') },
                { id: 'inventory', label: tr(lang, 'EOQ / Inventory', 'المخزون EOQ') },
                { id: 'pricing', label: tr(lang, 'Pricing / Margin', 'التسعير والهامش') },
                { id: 'cashflow', label: tr(lang, 'Cash Flow / BEP', 'السيولة والتعادل') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDomainFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  domainFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {visibleDecisions.length === 0 ? (
          <div className="bg-white border border-slate-200/85 rounded-xl p-10 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">
              {tr(lang, 'All mathematical thresholds balanced', 'جميع المؤشرات الرياضية متوازنة')}
            </p>
            <p className="text-xs text-slate-500">
              {tr(
                lang,
                'No immediate optimization actions triggered in this domain.',
                'لا توجد إجراءات تحسين عاجلة مطلوبة في هذا النطاق حالياً.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleDecisions.map((dec) => {
              const isProofOpen = expandedProofId === dec.id;
              return (
                <article
                  key={dec.id}
                  className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            dec.priority === 'high'
                              ? 'text-red-700'
                              : dec.priority === 'medium'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {priorityLabel(dec.priority)}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-medium text-teal-800">{dec.proof.engineName}</span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-slate-500">{dec.confidenceLabel}</span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{dec.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                        {dec.summary}
                      </p>

                      <div className="pt-1.5 flex flex-wrap items-center gap-4 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-emerald-700 tabular-nums">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {dec.impactLabel}
                        </span>

                        <button
                          type="button"
                          onClick={() => setExpandedProofId(isProofOpen ? null : dec.id)}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                        >
                          <Sigma className="w-3.5 h-3.5" />
                          {isProofOpen
                            ? tr(lang, 'Hide Mathematical Proof', 'إخفاء البرهان الرياضي')
                            : tr(lang, 'Inspect Mathematical Proof', 'عرض البرهان الرياضي')}
                          {isProofOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleExecuteDecision(dec)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {dec.actionLabel}
                        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      </button>
                    </div>
                  </div>

                  {/* Mathematical Proof Drawer */}
                  {isProofOpen && (
                    <div className="px-5 py-4 bg-slate-50/90 border-t border-slate-200/80 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {tr(lang, 'Applied Mathematical Model', 'النموذج الرياضي المطبّق')}
                        </span>
                        <code
                          dir="ltr"
                          className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-xs text-slate-900"
                        >
                          {dec.proof.formula}
                        </code>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {dec.proof.inputs.map((inp) => (
                          <div
                            key={inp.label}
                            className="bg-white border border-slate-200/85 rounded-lg p-3"
                          >
                            <p className="text-[11px] text-slate-500">{inp.label}</p>
                            <p className="text-xs font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                              {inp.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-200/85 rounded-lg p-3">
                        <strong className="text-slate-900">
                          {tr(lang, 'Derivation:', 'الاشتقاق الرياضي:')}
                        </strong>{' '}
                        {dec.proof.derivation}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* SKU-Level Quantitative Matrix (EOQ, ROP, Safety Stock, ABC) */}
      <section className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-4 border-b border-slate-200/80">
          <h2 className="text-[15px] font-bold text-slate-900">
            {tr(
              lang,
              'Live SKU Optimization Matrix (EOQ · Dynamic ROP · ABC Class)',
              'مصفوفة تحسين الأصناف المباشرة (EOQ · نقطة إعادة الطلب ROP · تصنيف ABC)'
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {tr(
              lang,
              'Calculated dynamically using 7-day rolling demand mean, standard deviation, 95% service level (Z = 1.645), and 22% holding cost rate',
              'تُحسب آلياً من متوسط الطلب اليومي لآخر 7 أيام، الانحراف المعياري، مستوى خدمة 95% (Z = 1.645)، ومعدل تكلفة التخزين 22%'
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-slate-500 font-semibold">
                <th className="py-3 px-4 text-start">{tr(lang, 'SKU / Product', 'الصنف / الرمز')}</th>
                <th className="py-3 px-3 text-center">{tr(lang, 'ABC', 'تصنيف ABC')}</th>
                <th className="py-3 px-3 text-end">{tr(lang, 'Daily Demand', 'الطلب اليومي')}</th>
                <th className="py-3 px-3 text-end">{tr(lang, 'Stock', 'الرصيد')}</th>
                <th className="py-3 px-3 text-end">{tr(lang, 'Safety Stock', 'مخزون الأمان')}</th>
                <th className="py-3 px-3 text-end">{tr(lang, 'Dynamic ROP', 'نقطة ROP')}</th>
                <th className="py-3 px-3 text-end">{tr(lang, 'Optimal EOQ', 'كمية EOQ')}</th>
                <th className="py-3 px-3 text-end">{tr(lang, 'Days Cover', 'أيام التغطية')}</th>
                <th className="py-3 px-4 text-end">{tr(lang, 'Gross Margin', 'هامش الربح')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {decisionReport.productProfiles.map((prof) => {
                const belowRop = prof.product.stock <= prof.rop;
                return (
                  <tr key={prof.product.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{prof.product.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{prof.product.sku}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      <span
                        className={
                          prof.abcClass === 'A'
                            ? 'text-teal-700'
                            : prof.abcClass === 'B'
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }
                      >
                        {prof.abcClass}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-end font-mono text-slate-700">
                      {prof.dailyDemand.toFixed(2)}/{tr(lang, 'd', 'ي')}
                    </td>
                    <td
                      className={`py-3 px-3 text-end font-mono font-semibold ${
                        belowRop ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {prof.product.stock}
                    </td>
                    <td className="py-3 px-3 text-end font-mono text-slate-600">
                      +{prof.safetyStock}
                    </td>
                    <td className="py-3 px-3 text-end font-mono font-semibold text-slate-900">
                      {prof.rop}
                    </td>
                    <td className="py-3 px-3 text-end font-mono font-semibold text-teal-800">
                      {prof.eoq}
                    </td>
                    <td className="py-3 px-3 text-end font-mono text-slate-600">
                      {prof.daysOfInventory >= 120
                        ? '120+'
                        : `${Math.round(prof.daysOfInventory)}${tr(lang, 'd', 'ي')}`}
                    </td>
                    <td
                      className={`py-3 px-4 text-end font-mono font-semibold ${
                        prof.grossMarginPct < 52 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {prof.grossMarginPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
