import React, { useMemo } from 'react';
import { Printer, FileSpreadsheet, AlertTriangle, TrendingUp, Layers, Wallet } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatCurrency, formatDateTime, roundMoney } from '../../utils/format';
import { Modal } from './Modal';

interface AuditReportModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({ open, onClose }) => {
  const { state, decisionReport } = useStore();
  const { settings } = state;
  const sym = settings.currencySymbol;
  const isAr = settings.language === 'ar';

  const audit = useMemo(() => {
    // 1. Locked Cash in Slow / Overstocked SKUs (Class C or DOI > 45 days)
    const slowItems = decisionReport.productProfiles
      .filter((p) => p.product.stock > 0 && (p.daysOfInventory >= 45 || p.abcClass === 'C'))
      .map((p) => {
        const unitCost = p.product.costPrice;
        const lockedValue = roundMoney(p.product.stock * unitCost);
        return {
          productId: p.product.id,
          name: p.product.name,
          sku: p.product.sku,
          stock: p.product.stock,
          abcClass: p.abcClass,
          daysOfInventory: p.daysOfInventory,
          unitCost,
          lockedValue,
        };
      })
      .sort((a, b) => b.lockedValue - a.lockedValue);

    const lockedCashTotal = roundMoney(slowItems.reduce((sum, i) => sum + i.lockedValue, 0));

    // 2. Stockout & Critical Below-ROP Profit Leakage (projected 14-day lost gross profit)
    const criticalSkus = decisionReport.productProfiles.filter(
      (p) => p.product.stock === 0 || p.product.stock <= p.rop
    );
    const stockoutLoss14d = roundMoney(
      criticalSkus.reduce((sum, p) => {
        const unitProfit = Math.max(0, p.product.sellingPrice - p.product.costPrice);
        const dailyDemand = Math.max(0.35, p.dailyDemand);
        const shortfallDays = Math.max(0, 14 - p.daysOfInventory);
        return sum + dailyDemand * shortfallDays * unitProfit;
      }, 0)
    );

    // 3. Shrinkage / Damaged / Expired Waste from Stock Adjustments
    const wasteLogs = state.stockAdjustments.filter(
      (a) =>
        a.delta < 0 &&
        (a.reason === 'Damaged' || a.reason === 'Expired' || a.reason === 'Shrinkage')
    );
    const wasteValue = roundMoney(
      wasteLogs.reduce((sum, adj) => {
        const prod = state.products.find((p) => p.id === adj.productId);
        return sum + Math.abs(adj.delta) * (prod?.costPrice ?? 8);
      }, 0)
    );

    // 4. Uncollected Receivables (Customer Credit Exposure)
    const receivables = roundMoney(
      state.customers.reduce((sum, c) => sum + c.creditBalance, 0)
    );

    // 5. FIFO vs Weighted Average Inventory Valuation Comparison
    const weightedAvgInventoryValue = roundMoney(
      state.products.reduce((sum, p) => sum + p.stock * p.costPrice, 0)
    );
    const fifoInventoryValue = roundMoney(
      state.products.reduce((sum, p) => {
        if (p.costLayers && p.costLayers.length > 0) {
          const layerVal = p.costLayers.reduce(
            (ls, l) => ls + l.quantityRemaining * l.unitCost,
            0
          );
          return sum + layerVal;
        }
        return sum + p.stock * p.costPrice;
      }, 0)
    );
    const valuationSpread = roundMoney(fifoInventoryValue - weightedAvgInventoryValue);

    const totalRecoverableCash = roundMoney(
      lockedCashTotal * 0.45 + receivables + stockoutLoss14d + wasteValue
    );

    return {
      slowItems,
      lockedCashTotal,
      criticalSkus,
      stockoutLoss14d,
      wasteLogs,
      wasteValue,
      receivables,
      weightedAvgInventoryValue,
      fifoInventoryValue,
      valuationSpread,
      totalRecoverableCash,
    };
  }, [state, decisionReport]);

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isAr
          ? 'تقرير التدقيق المجاني الفوري — الكاش المحبوس والهدر'
          : 'Instant Waste & Cash Audit Report (Executive PDF)'
      }
      subtitle={
        isAr
          ? 'تشخيص فوري لحجم الكاش المحبوس، العجز المكتشف، وخطة الاسترداد — جاهز للطباعة أو الحفظ كـ PDF'
          : 'Live diagnostic quantifying locked working capital, stockout leakage, and shrinkage — ready for PDF export'
      }
      maxWidthClass="max-w-4xl"
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {isAr
              ? 'نصيحة: اختر "Save as PDF" من نافذة الطباعة لحفظ التقرير وإرساله للعميل.'
              : 'Tip: Select "Save as PDF" in your browser print dialog to share with stakeholders.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              {isAr ? 'طباعة / حفظ كـ PDF' : 'Print / Save as PDF'}
            </button>
          </div>
        </div>
      }
    >
      <div
        id="printable-audit-report"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 text-slate-900"
      >
        {/* Audit Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
              {isAr
                ? 'تقرير التدقيق المالي والمخزني الفوري · الإضافة الذكية'
                : 'Smart Add-on Diagnostic · Instant Cash & Waste Audit'}
            </p>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{settings.storeName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {settings.address} · {settings.phone}
            </p>
          </div>
          <div className="text-xs text-slate-500 space-y-0.5 sm:text-end tabular-nums">
            <p className="font-mono font-semibold text-slate-800">
              {isAr ? 'تاريخ التقرير:' : 'Generated:'} {formatDateTime(new Date().toISOString())}
            </p>
            <p>
              {isAr ? 'مؤشر الكفاءة التشغيلية:' : 'Optimization Score:'}{' '}
              <strong className="font-mono text-teal-700">{decisionReport.healthScore}/100</strong>
            </p>
            <p>
              {isAr ? 'طريقة تقييم التكلفة:' : 'Costing Method:'}{' '}
              <strong className="text-slate-800">
                {settings.costingMethod === 'fifo'
                  ? isAr
                    ? 'FIFO (الوارد أولاً يصرف أولاً)'
                    : 'FIFO'
                  : isAr
                  ? 'المتوسط المرجح'
                  : 'Weighted Average'}
              </strong>
            </p>
          </div>
        </div>

        {/* Executive Hero Banner */}
        <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">
              {isAr
                ? 'إجمالي الفرص المالية القابلة للاسترداد والتسريع'
                : 'Total Recoverable Cash & Preventable Profit Leakage'}
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums mt-1">
              {formatCurrency(audit.totalRecoverableCash, sym)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400">
                {isAr ? 'أصناف تحت حد الطلب' : 'SKUs Below ROP'}
              </p>
              <p className="font-mono font-bold text-amber-400 text-base tabular-nums">
                {audit.criticalSkus.length}
              </p>
            </div>
            <div>
              <p className="text-slate-400">
                {isAr ? 'أصناف بطيئة الحركة' : 'Slow-Moving SKUs'}
              </p>
              <p className="font-mono font-bold text-teal-300 text-base tabular-nums">
                {audit.slowItems.length}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Core Leakage Buckets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{isAr ? 'كاش محبوس في المخزون الراكد' : 'Locked Cash (Slow Stock)'}</span>
              <Layers className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1.5">
              {formatCurrency(audit.lockedCashTotal, sym)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isAr
                ? `${audit.slowItems.length} صنف بدوران أبطأ من 45 يوم`
                : `${audit.slowItems.length} Class C / >45d DOI SKUs`}
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{isAr ? 'عجز وفقد أرباح نفاد المخزون' : 'Stockout Profit Loss (14d)'}</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-red-600 mt-1.5">
              {formatCurrency(audit.stockoutLoss14d, sym)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isAr
                ? `${audit.criticalSkus.length} صنف مهدد بالنفاد الفوري`
                : `${audit.criticalSkus.length} SKUs at stockout risk`}
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{isAr ? 'خسائر التالف والهدر والعجز' : 'Shrinkage & Waste Loss'}</span>
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-1.5">
              {formatCurrency(audit.wasteValue, sym)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isAr
                ? `${audit.wasteLogs.length} حالة تالف أو منتهي الصلاحية`
                : `${audit.wasteLogs.length} damaged / expired write-offs`}
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{isAr ? 'مديونيات عملاء غير محصّلة' : 'Uncollected Credit (AR)'}</span>
              <Wallet className="w-4 h-4 text-teal-700" />
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-teal-800 mt-1.5">
              {formatCurrency(audit.receivables, sym)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isAr ? 'سيولة جاهزة للتحصيل الفوري' : 'Immediate cash collection target'}
            </p>
          </div>
        </div>

        {/* Inflation & Inventory Costing Comparison (FIFO vs Weighted Avg) */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-xs font-semibold text-slate-900">
              {isAr
                ? 'أثر التضخم وطريقة التقييم (FIFO مقابل متوسط التكلفة المرجح)'
                : 'Inflation Costing Impact (FIFO vs Weighted Average)'}
            </h3>
            <p className="text-[11px] text-slate-600">
              {isAr
                ? 'يقارن قيمة المخزون الحالية بطبقات الشراء الفعلية (FIFO) مقابل المتوسط المرجح لحماية هامش الربح.'
                : 'Compares active FIFO batch cost layers against weighted average inventory valuation.'}
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs tabular-nums">
            <div>
              <span className="text-slate-500 block">
                {isAr ? 'قيمة المتوسط المرجح' : 'Weighted Avg'}
              </span>
              <strong className="font-mono text-slate-900">
                {formatCurrency(audit.weightedAvgInventoryValue, sym)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">
                {isAr ? 'قيمة طبقات FIFO' : 'FIFO Layers'}
              </span>
              <strong className="font-mono text-slate-900">
                {formatCurrency(audit.fifoInventoryValue, sym)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">{isAr ? 'الفارق' : 'Spread'}</span>
              <strong
                className={`font-mono ${
                  audit.valuationSpread >= 0 ? 'text-teal-700' : 'text-amber-700'
                }`}
              >
                {audit.valuationSpread >= 0 ? '+' : ''}
                {formatCurrency(audit.valuationSpread, sym)}
              </strong>
            </div>
          </div>
        </div>

        {/* Top Locked Cash SKUs Table */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            {isAr
              ? 'أعلى الأصناف التي تحبس السيولة النقدية (مقترح تصفية / عروض)'
              : 'Top Locked-Cash SKUs (Liquidation & Bundle Candidates)'}
          </h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2 px-3 text-start">{isAr ? 'الصنف' : 'Product'}</th>
                  <th className="py-2 px-3 text-start">{isAr ? 'التصنيف ABC' : 'ABC'}</th>
                  <th className="py-2 px-3 text-end">{isAr ? 'الكمية' : 'Stock'}</th>
                  <th className="py-2 px-3 text-end">{isAr ? 'أيام التغطية' : 'Days Cover'}</th>
                  <th className="py-2 px-3 text-end">{isAr ? 'الكاش المحبوس' : 'Locked Cash'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {audit.slowItems.slice(0, 6).map((item) => (
                  <tr key={item.productId}>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {item.name}{' '}
                      <span className="font-mono text-[11px] text-slate-400">({item.sku})</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{item.abcClass}</td>
                    <td className="py-2 px-3 text-end font-mono">{item.stock}</td>
                    <td className="py-2 px-3 text-end font-mono text-amber-700">
                      {item.daysOfInventory >= 999 ? '90+' : `${Math.round(item.daysOfInventory)}d`}
                    </td>
                    <td className="py-2 px-3 text-end font-mono font-semibold text-slate-900">
                      {formatCurrency(item.lockedValue, sym)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prioritized Mathematical Action Plan */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-teal-700" />
            {isAr
              ? 'خطة العمل الرياضية ذات الأولوية الفورية'
              : 'Prioritized Mathematical Recovery Actions'}
          </h3>
          <div className="space-y-2">
            {decisionReport.decisions.slice(0, 4).map((dec, idx) => (
              <div
                key={dec.id}
                className="p-3 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {idx + 1}. {dec.title}
                  </p>
                  <p className="text-slate-500 mt-0.5">{dec.summary}</p>
                </div>
                <span className="font-mono font-semibold text-emerald-700 shrink-0 tabular-nums">
                  {dec.impactLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
