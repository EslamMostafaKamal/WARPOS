import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  PackagePlus,
  Receipt,
  AlertTriangle,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Calculator,
  FileText,
} from 'lucide-react';
import { AppModule, Sale } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatCurrency,
  formatDateTime,
  getStockStatus,
  isSameDay,
  toDateKey,
} from '../../utils/format';
import {
  t,
  tr,
  translatePaymentMethod,
  translateSaleStatus,
} from '../../utils/i18n';
import { ReceiptModal } from '../ui/ReceiptModal';
import { AuditReportModal } from '../ui/AuditReportModal';

interface DashboardModuleProps {
  onNavigate: (module: AppModule) => void;
}

interface DayPoint {
  dateKey: string;
  label: string;
  fullDate: string;
  sales: number;
  cogs: number;
  expenses: number;
  net: number;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { state, decisionReport, setPendingRestockProductId } = useStore();
  const { canAccessModule, hasPermission } = useAuth();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  const sym = state.settings.currencySymbol;
  const lang = state.settings.language;

  const metrics = useMemo(() => {
    const completedSales = state.sales.filter((s) => s.status === 'Completed');
    const todaySalesList = completedSales.filter((s) => isSameDay(s.date));
    const todaysSales = todaySalesList.reduce((sum, s) => sum + s.total, 0);

    const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0);
    const totalCogs = completedSales.reduce((sum, s) => sum + s.totalCost, 0);
    const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalCogs - totalExpenses;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const totalOrders = completedSales.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const lowStockItems = state.products
      .filter((p) => p.stock <= p.reorderLevel)
      .sort((a, b) => a.stock - b.stock);
    const outOfStockCount = lowStockItems.filter((p) => p.stock === 0).length;

    return {
      todaysSales,
      todayOrderCount: todaySalesList.length,
      netProfit,
      netMargin,
      totalOrders,
      avgOrderValue,
      lowStockItems,
      outOfStockCount,
    };
  }, [state.sales, state.expenses, state.products]);

  const chartData = useMemo<DayPoint[]>(() => {
    const days: DayPoint[] = [];
    const now = new Date();
    const locale = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toDateKey(d);
      const daySales = state.sales.filter(
        (s) => s.status === 'Completed' && toDateKey(s.date) === key
      );
      const dayExpenses = state.expenses.filter((e) => toDateKey(e.date) === key);

      const salesSum = daySales.reduce((acc, s) => acc + s.total, 0);
      const cogsSum = daySales.reduce((acc, s) => acc + s.totalCost, 0);
      const expSum = dayExpenses.reduce((acc, e) => acc + e.amount, 0);

      days.push({
        dateKey: key,
        label: d.toLocaleDateString(locale, { weekday: 'short' }),
        fullDate: d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
        sales: salesSum,
        cogs: cogsSum,
        expenses: expSum,
        net: salesSum - cogsSum - expSum,
      });
    }
    return days;
  }, [state.sales, state.expenses, lang]);

  const maxChartVal = useMemo(() => {
    const peak = Math.max(
      100,
      ...chartData.map((d) => Math.max(d.sales, d.expenses, Math.abs(d.net)))
    );
    return Math.ceil(peak / 50) * 50;
  }, [chartData]);

  const handleRestockShortcut = (productId: string) => {
    setPendingRestockProductId(productId);
    onNavigate('purchases');
  };

  const recentSales = state.sales.slice(0, 6);

  // SVG chart dimensions
  const svgW = 680;
  const svgH = 232;
  const padL = 56;
  const padR = 16;
  const padT = 18;
  const padB = 36;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const groupW = plotW / chartData.length;

  const yPos = (val: number) => padT + plotH - (Math.max(0, val) / maxChartVal) * plotH;

  const linePath = chartData
    .map((d, i) => {
      const cx = padL + i * groupW + groupW / 2;
      const cy = yPos(Math.max(0, d.net));
      return `${i === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
    })
    .join(' ');

  const priorityLabel = (p: 'high' | 'medium' | 'low') => {
    if (lang === 'ar') {
      return p === 'high' ? 'أولوية قصوى' : p === 'medium' ? 'متوسطة' : 'تحسينية';
    }
    return p.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">{t('todaysSales', lang)}</span>
            <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrency(metrics.todaysSales, sym)}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {tr(
                lang,
                `${metrics.todayOrderCount} ${metrics.todayOrderCount === 1 ? 'order' : 'orders'} completed today`,
                `${metrics.todayOrderCount} فاتورة مكتملة اليوم`
              )}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">{t('netProfit', lang)}</span>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                metrics.netProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <p
              className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
                metrics.netProfit >= 0 ? 'text-slate-900' : 'text-red-600'
              }`}
            >
              {formatCurrency(metrics.netProfit, sym)}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              <span
                className={
                  metrics.netMargin >= 0
                    ? 'text-emerald-700 font-semibold'
                    : 'text-red-600 font-semibold'
                }
              >
                {metrics.netMargin.toFixed(1)}% {tr(lang, 'margin', 'هامش صافي')}
              </span>{' '}
              {tr(lang, 'after COGS & expenses', 'بعد التكلفة والمصروفات')}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">{t('totalOrders', lang)}</span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {metrics.totalOrders}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {tr(lang, 'Avg ticket', 'متوسط الفاتورة')}{' '}
              <span className="font-mono font-medium text-slate-700">
                {formatCurrency(metrics.avgOrderValue, sym)}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">{t('lowStockAlerts', lang)}</span>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                metrics.lowStockItems.length > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <p
              className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
                metrics.outOfStockCount > 0
                  ? 'text-red-600'
                  : metrics.lowStockItems.length > 0
                  ? 'text-amber-600'
                  : 'text-emerald-700'
              }`}
            >
              {metrics.lowStockItems.length}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {tr(
                lang,
                `${metrics.outOfStockCount} out of stock · ${metrics.lowStockItems.length - metrics.outOfStockCount} low stock`,
                `${metrics.outOfStockCount} نفد بالكامل · ${metrics.lowStockItems.length - metrics.outOfStockCount} منخفض`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Background Mathematical Decision Engine Summary Strip */}
      <section className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-teal-300 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">
                {tr(
                  lang,
                  `Background Decision Engine · Optimization Index ${decisionReport.healthScore}/100`,
                  `محرك القرارات الرياضي · مؤشر كفاءة المنشأة ${decisionReport.healthScore}/100`
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tr(
                  lang,
                  'Top mathematically verified actions across EOQ/ROP inventory, margin elasticity, and working capital',
                  'أعلى القرارات المبرهنة رياضياً لإعادة التوريد EOQ/ROP، مرونة التسعير، وتحرير رأس المال العامل'
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {hasPermission('canViewReports') && (
              <button
                type="button"
                onClick={() => setAuditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                {t('auditReport', lang)}
              </button>
            )}
            {canAccessModule('decisions') && (
              <button
                type="button"
                onClick={() => onNavigate('decisions')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 px-2 py-1.5 whitespace-nowrap"
              >
                {tr(
                  lang,
                  `Open Decision Engine (${decisionReport.decisions.length})`,
                  `فتح محرك القرارات (${decisionReport.decisions.length})`
                )}
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {decisionReport.decisions.slice(0, 3).map((dec) => (
            <button
              key={dec.id}
              type="button"
              onClick={() => onNavigate('decisions')}
              className="text-start p-4 rounded-xl border border-slate-200/90 hover:border-teal-600 hover:bg-teal-50/20 transition-all duration-150 flex flex-col justify-between gap-2.5"
            >
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  <span
                    className={
                      dec.priority === 'high' ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold'
                    }
                  >
                    {priorityLabel(dec.priority)}
                  </span>{' '}
                  · {dec.proof.engineName}
                </p>
                <p className="text-xs font-bold text-slate-900 mt-1.5 leading-snug line-clamp-2">
                  {dec.title}
                </p>
              </div>
              <p className="text-[11px] font-mono font-semibold text-emerald-700 tabular-nums">
                {dec.impactLabel}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 7-Day Sales & Expenses Chart */}
      <section className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">
              {tr(lang, 'Sales & Expenses — Last 7 Days', 'المبيعات والمصروفات — آخر 7 أيام')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr(
                lang,
                'Daily gross sales, operating expenses, and net profit trend',
                'حركة المبيعات اليومية والمصروفات التشغيلية واتجاه صافي الربح'
              )}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" />
              {tr(lang, 'Sales', 'المبيعات')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              {tr(lang, 'Expenses', 'المصروفات')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-900 inline-block" />
              {tr(lang, 'Net Profit', 'صافي الربح')}
            </span>
          </div>
        </div>

        <div className="relative w-full overflow-x-auto" dir="ltr">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-auto min-w-[520px] select-none"
            role="img"
            aria-label={tr(
              lang,
              'Sales and expenses bar and line chart for the last 7 days',
              'مخطط المبيعات والمصروفات لآخر 7 أيام'
            )}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const val = Math.round(maxChartVal * ratio);
              const y = padT + plotH - ratio * plotH;
              return (
                <g key={ratio}>
                  <line
                    x1={padL}
                    x2={svgW - padR}
                    y1={y}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={ratio === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-mono"
                  >
                    {sym}
                    {val}
                  </text>
                </g>
              );
            })}

            {chartData.map((d, i) => {
              const cx = padL + i * groupW + groupW / 2;
              const barW = Math.min(22, groupW * 0.28);
              const salesH = (d.sales / maxChartVal) * plotH;
              const expH = (d.expenses / maxChartVal) * plotH;
              const isHovered = hoveredDayIdx === i;

              return (
                <g
                  key={d.dateKey}
                  onMouseEnter={() => setHoveredDayIdx(i)}
                  onMouseLeave={() => setHoveredDayIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={padL + i * groupW + 2}
                    y={padT}
                    width={groupW - 4}
                    height={plotH}
                    fill={isHovered ? '#f1f5f9' : 'transparent'}
                    rx={6}
                  />
                  <rect
                    x={cx - barW - 2}
                    y={padT + plotH - salesH}
                    width={barW}
                    height={Math.max(0, salesH)}
                    fill={isHovered ? '#0f766e' : '#0d9488'}
                    rx={3}
                  />
                  <rect
                    x={cx + 2}
                    y={padT + plotH - expH}
                    width={barW}
                    height={Math.max(0, expH)}
                    fill={isHovered ? '#d97706' : '#f59e0b'}
                    rx={3}
                  />
                  <text
                    x={cx}
                    y={svgH - 16}
                    textAnchor="middle"
                    className="fill-slate-700 text-[11px] font-medium"
                  >
                    {d.label}
                  </text>
                  <text
                    x={cx}
                    y={svgH - 2}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px] font-mono"
                  >
                    {d.fullDate}
                  </text>
                </g>
              );
            })}

            <path
              d={linePath}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="pointer-events-none"
            />
            {chartData.map((d, i) => {
              const cx = padL + i * groupW + groupW / 2;
              const cy = yPos(Math.max(0, d.net));
              return (
                <circle
                  key={`dot-${d.dateKey}`}
                  cx={cx}
                  cy={cy}
                  r={hoveredDayIdx === i ? 4.5 : 3}
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth={2}
                  className="pointer-events-none"
                />
              );
            })}
          </svg>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          {hoveredDayIdx !== null ? (
            <div className="flex flex-wrap items-center gap-4 tabular-nums">
              <span className="font-semibold text-slate-900">
                {chartData[hoveredDayIdx].label} · {chartData[hoveredDayIdx].fullDate}
              </span>
              <span>
                {tr(lang, 'Sales', 'المبيعات')}:{' '}
                <strong className="font-mono text-teal-700">
                  {formatCurrency(chartData[hoveredDayIdx].sales, sym)}
                </strong>
              </span>
              <span>
                {tr(lang, 'Expenses', 'المصروفات')}:{' '}
                <strong className="font-mono text-amber-700">
                  {formatCurrency(chartData[hoveredDayIdx].expenses, sym)}
                </strong>
              </span>
              <span>
                {tr(lang, 'Net', 'الصافي')}:{' '}
                <strong
                  className={`font-mono ${
                    chartData[hoveredDayIdx].net >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(chartData[hoveredDayIdx].net, sym)}
                </strong>
              </span>
            </div>
          ) : (
            <span className="text-slate-500">
              {tr(
                lang,
                'Hover any day column to inspect exact daily sales, expenses, and net profit.',
                'مرّر المؤشر فوق أي عمود يومي لاستعراض المبيعات والمصروفات وصافي الربح بدقة.'
              )}
            </span>
          )}
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-1 whitespace-nowrap"
          >
            {tr(lang, 'Open P&L Statement', 'فتح قائمة الأرباح والخسائر')}
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </section>

      {/* Bottom 2-Column Workspace: Recent Transactions + Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-white border border-slate-200/85 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">
                {t('recentTransactions', lang)}
              </h2>
              <p className="text-xs text-slate-500">
                {tr(
                  lang,
                  'Click an invoice to preview receipt or refund',
                  'انقر على أي فاتورة لمعاينة الإيصال أو الاسترجاع'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              {t('viewAll', lang)}
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            {recentSales.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                {tr(
                  lang,
                  'No sales recorded yet. Start a checkout in the POS Terminal.',
                  'لا توجد مبيعات مسجلة بعد. ابدأ أول عملية بيع من نقطة البيع.'
                )}
              </div>
            ) : (
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 text-xs font-semibold text-slate-500 bg-slate-50/80">
                    <th className="py-2.5 px-5 text-start">{tr(lang, 'Invoice', 'الفاتورة')}</th>
                    <th className="py-2.5 px-3 text-start">{tr(lang, 'Customer', 'العميل')}</th>
                    <th className="py-2.5 px-3 text-start">{tr(lang, 'Payment', 'الدفع')}</th>
                    <th className="py-2.5 px-3 text-start">{tr(lang, 'Status', 'الحالة')}</th>
                    <th className="py-2.5 px-5 text-end">{tr(lang, 'Total', 'الإجمالي')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-5">
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {sale.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateTime(sale.date, lang)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-800 max-w-[160px] truncate text-xs font-medium">
                        {sale.customerName}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                        {translatePaymentMethod(sale.paymentMethod, lang)}
                      </td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            sale.status === 'Completed' ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {translateSaleStatus(sale.status, lang)}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-end font-mono text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(sale.total, sym)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200/85 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">{t('lowStockItems', lang)}</h2>
              <p className="text-xs text-slate-500">
                {tr(
                  lang,
                  'Items at or below reorder threshold',
                  'أصناف وصلت أو قلت عن حد إعادة الطلب'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              {t('inventory', lang)}
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {metrics.lowStockItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-emerald-700">
                  {tr(lang, 'All products stocked', 'جميع الأصناف متوفرة بشكل آمن')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {tr(
                    lang,
                    'Every SKU is currently above its reorder level.',
                    'كل صنف حالياً أعلى من حد إعادة الطلب المحدد.'
                  )}
                </p>
              </div>
            ) : (
              metrics.lowStockItems.slice(0, 6).map((item) => {
                const status = getStockStatus(item.stock, item.reorderLevel);
                return (
                  <div
                    key={item.id}
                    className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 tabular-nums">
                        <span className="font-mono">{item.sku}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            status === 'out' ? 'text-red-600' : 'text-amber-700'
                          }`}
                        >
                          {item.stock === 0
                            ? tr(lang, 'Out of stock', 'نفد المخزون')
                            : tr(lang, `${item.stock} left`, `متبقي ${item.stock}`)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {tr(lang, `Min ${item.reorderLevel}`, `الحد ${item.reorderLevel}`)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestockShortcut(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      {t('restock', lang)}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between">
            <span className="text-xs text-slate-500 tabular-nums">
              {tr(
                lang,
                `${state.purchaseOrders.filter((p) => p.status === 'Pending').length} pending purchase orders`,
                `${state.purchaseOrders.filter((p) => p.status === 'Pending').length} أمر شراء قيد الانتظار`
              )}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('pos')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap"
            >
              <Receipt className="w-3.5 h-3.5" />
              {t('newPosSale', lang)}
            </button>
          </div>
        </section>
      </div>

      <ReceiptModal sale={selectedSale} onClose={() => setSelectedSale(null)} allowRefund />
      <AuditReportModal open={auditModalOpen} onClose={() => setAuditModalOpen(false)} />
    </div>
  );
};
