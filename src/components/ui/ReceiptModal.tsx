import React, { useState } from 'react';
import { Printer, RotateCcw, Check } from 'lucide-react';
import { Sale } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { Modal } from './Modal';
import { BarcodeSvg } from './BarcodeSvg';
import { ZatcaQrSvg } from './ZatcaQrSvg';
import {
  t,
  tr,
  translateChannel,
  translatePaymentMethod,
  translateSaleStatus,
} from '../../utils/i18n';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  allowRefund?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  allowRefund = false,
}) => {
  const { state, refundSale } = useStore();
  const { hasPermission } = useAuth();
  const [confirmingRefund, setConfirmingRefund] = useState(false);

  if (!sale) return null;

  const canRefundAction = allowRefund && hasPermission('canRefund');

  const { settings } = state;
  const lang = settings.language;
  const sym = settings.currencySymbol;
  const totalDiscounts =
    sale.itemDiscountsTotal + sale.orderDiscountAmount + (sale.loyaltyDiscountAmount ?? 0);

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmRefund = () => {
    refundSale(sale.id);
    setConfirmingRefund(false);
    onClose();
  };

  return (
    <Modal
      open={Boolean(sale)}
      onClose={() => {
        setConfirmingRefund(false);
        onClose();
      }}
      title={`${tr(lang, 'Receipt', 'الإيصال')} · ${sale.invoiceNumber}`}
      subtitle={`${formatDateTime(sale.date, lang)} · ${sale.customerName}`}
      maxWidthClass="max-w-md"
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <div>
            {canRefundAction && sale.status === 'Completed' && !confirmingRefund && (
              <button
                type="button"
                onClick={() => setConfirmingRefund(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {tr(lang, 'Refund / Return', 'مرتجع / استرداد')}
              </button>
            )}
            {canRefundAction && confirmingRefund && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmRefund}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  {tr(lang, 'Confirm Refund', 'تأكيد الاسترداد')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRefund(false)}
                  className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                >
                  {tr(lang, 'Cancel', 'إلغاء')}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {t('close', lang)}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              {t('printReceipt', lang)}
            </button>
          </div>
        </div>
      }
    >
      <div
        id="printable-receipt"
        className="bg-white border border-slate-200 rounded-lg p-5 font-mono text-xs text-slate-800 space-y-4"
      >
        {/* Business Header */}
        <div className="text-center border-b border-dashed border-slate-300 pb-3.5 space-y-0.5">
          {settings.zatcaEnabled && (
            <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-teal-800">
              {t('zatcaBadge', lang)}
            </p>
          )}
          <h3 className="font-sans text-base font-bold text-slate-900">{settings.storeName}</h3>
          <p className="text-[11px] text-slate-600">{settings.address}</p>
          <p className="text-[11px] text-slate-600">
            {settings.phone} {settings.taxId ? `· ${settings.taxId}` : ''}
          </p>
          {settings.vatNumber && (
            <p className="text-[11px] text-slate-600">
              {tr(lang, 'VAT No:', 'الرقم الضريبي:')}{' '}
              <strong className="text-slate-900">{settings.vatNumber}</strong>
            </p>
          )}
        </div>

        {/* Invoice Meta */}
        <div className="grid grid-cols-2 gap-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
          <span className="text-slate-500">{tr(lang, 'Invoice', 'رقم الفاتورة')}</span>
          <span className="text-end font-semibold text-slate-900">{sale.invoiceNumber}</span>
          <span className="text-slate-500">{tr(lang, 'Date', 'التاريخ')}</span>
          <span className="text-end">{formatDateTime(sale.date, lang)}</span>
          <span className="text-slate-500">{tr(lang, 'Customer', 'العميل')}</span>
          <span className="text-end truncate">{sale.customerName}</span>
          {sale.channel && (
            <>
              <span className="text-slate-500">{tr(lang, 'Channel', 'القناة')}</span>
              <span className="text-end font-medium text-slate-700">
                {translateChannel(sale.channel, lang)}
              </span>
            </>
          )}
          <span className="text-slate-500">{tr(lang, 'Status', 'الحالة')}</span>
          <span
            className={`text-end font-semibold ${
              sale.status === 'Refunded'
                ? 'text-red-600'
                : sale.syncStatus === 'offline_queued'
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}
          >
            {sale.syncStatus === 'offline_queued'
              ? tr(lang, 'Completed (Offline Queued)', 'محفوظ محلياً (بانتظار المزامنة)')
              : translateSaleStatus(sale.status, lang)}
          </span>
        </div>

        {/* Line Items with Unique Variant Barcodes */}
        <div className="space-y-3 border-b border-dashed border-slate-300 pb-3.5">
          <div className="flex justify-between text-[10px] text-slate-500 pb-1 border-b border-slate-100">
            <span>{tr(lang, 'Item & Variant Barcode', 'الصنف وباركود المقاس/اللون')}</span>
            <span>{tr(lang, 'Amount', 'المبلغ')}</span>
          </div>
          {sale.items.map((item, idx) => (
            <div key={`${item.productId}-${item.variantId ?? idx}`} className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-sans font-medium text-slate-900 text-xs leading-snug block">
                    {item.productName}
                  </span>
                  {item.variantLabel && (
                    <span className="font-sans text-[11px] text-teal-800 font-medium block">
                      {tr(lang, 'Variant:', 'النوع / المقاس:')} {item.variantLabel}
                    </span>
                  )}
                </div>
                <span className="tabular-nums font-medium shrink-0">
                  {formatCurrency(item.lineTotal, sym)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>
                  {item.quantity} × {formatCurrency(item.unitPrice, sym)}
                </span>
                {item.discountAmount > 0 && (
                  <span className="text-amber-700">
                    {tr(lang, 'Disc', 'خصم')} -{formatCurrency(item.discountAmount, sym)}
                  </span>
                )}
              </div>
              <div className="pt-0.5 flex justify-start">
                <BarcodeSvg value={item.barcode || item.sku} height={24} showText />
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-1.5 tabular-nums">
          <div className="flex justify-between text-slate-600">
            <span>{t('subtotal', lang)}</span>
            <span>{formatCurrency(sale.subtotal, sym)}</span>
          </div>
          {sale.itemDiscountsTotal + sale.orderDiscountAmount > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>{t('discounts', lang)}</span>
              <span>
                -{formatCurrency(sale.itemDiscountsTotal + sale.orderDiscountAmount, sym)}
              </span>
            </div>
          )}
          {sale.loyaltyDiscountAmount > 0 && (
            <div className="flex justify-between text-teal-700">
              <span>
                {tr(lang, 'Loyalty Reward', 'مكافأة الولاء')} ({sale.loyaltyDiscountPercent}% ·{' '}
                {sale.loyaltyPointsRedeemed} {tr(lang, 'pts', 'نقطة')})
              </span>
              <span>-{formatCurrency(sale.loyaltyDiscountAmount, sym)}</span>
            </div>
          )}
          {totalDiscounts === 0 && null}
          <div className="flex justify-between text-slate-600">
            <span>
              {t('vat', lang)} ({sale.taxRate}%)
            </span>
            <span>{formatCurrency(sale.taxAmount, sym)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span>{t('total', lang)}</span>
            <span>{formatCurrency(sale.total, sym)}</span>
          </div>
        </div>

        {/* Payment & Loyalty Breakdown */}
        <div className="bg-slate-50 rounded-md p-2.5 space-y-1 text-[11px] tabular-nums">
          <div className="flex justify-between">
            <span className="text-slate-500">{tr(lang, 'Payment Method', 'طريقة الدفع')}</span>
            <span className="font-medium text-slate-900">
              {translatePaymentMethod(sale.paymentMethod, lang)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{tr(lang, 'Amount Paid', 'المبلغ المدفوع')}</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(sale.amountPaid, sym)}
            </span>
          </div>
          {sale.cashTendered !== undefined && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">{tr(lang, 'Cash Tendered', 'النقد المستلم')}</span>
                <span>{formatCurrency(sale.cashTendered, sym)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{tr(lang, 'Change Due', 'الباقي للعميل')}</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(sale.changeDue ?? 0, sym)}
                </span>
              </div>
            </>
          )}
          {sale.bnplDetails && (
            <div className="pt-1.5 mt-1 border-t border-slate-200/80 space-y-1">
              <div className="flex justify-between text-teal-800 font-semibold">
                <span>{tr(lang, 'BNPL Provider', 'شركة التقسيط')}</span>
                <span>
                  {sale.bnplDetails.provider} · {sale.bnplDetails.months}{' '}
                  {tr(lang, 'mo', 'شهر')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {tr(lang, 'Monthly Installment', 'القسط الشهري')}
                </span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(sale.bnplDetails.monthlyInstallment, sym)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{tr(lang, 'Approval Ref', 'رقم الموافقة')}</span>
                <span className="font-mono">{sale.bnplDetails.reference || '—'}</span>
              </div>
            </div>
          )}
          {sale.creditAmount > 0 && (
            <div className="flex justify-between text-amber-700 font-medium">
              <span>{tr(lang, 'Added to Customer Credit', 'مضاف إلى رصيد الآجل')}</span>
              <span>{formatCurrency(sale.creditAmount, sym)}</span>
            </div>
          )}
          {sale.loyaltyPointsEarned > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium pt-1 border-t border-slate-200/80">
              <span>{tr(lang, 'Loyalty Points Earned', 'نقاط الولاء المكتسبة')}</span>
              <span>
                +{sale.loyaltyPointsEarned} {tr(lang, 'pts', 'نقطة')}
              </span>
            </div>
          )}
        </div>

        {/* ZATCA Phase-1 QR Code & Scannable Invoice Barcode */}
        <div className="pt-3 border-t border-dashed border-slate-300 flex flex-col items-center gap-3">
          {settings.zatcaEnabled && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-sans text-[10px] font-semibold text-slate-600">
                {tr(
                  lang,
                  'ZATCA Simplified Tax Invoice QR (TLV)',
                  'رمز الفاتورة الإلكترونية (ZATCA Phase 1)'
                )}
              </span>
              <ZatcaQrSvg
                sellerName={settings.storeName}
                vatNumber={settings.vatNumber}
                timestampIso={sale.date}
                invoiceTotal={sale.total}
                vatTotal={sale.taxAmount}
                size={112}
              />
            </div>
          )}
          <div className="flex flex-col items-center">
            <span className="font-sans text-[10px] text-slate-500 mb-1">
              {tr(
                lang,
                'Scan invoice barcode for quick lookup or return',
                'امسح باركود الفاتورة للاستعلام أو الاسترجاع السريع'
              )}
            </span>
            <BarcodeSvg value={sale.invoiceNumber} height={36} showText />
          </div>
        </div>

        {settings.receiptFooter && (
          <p className="text-center font-sans text-[11px] text-slate-500 pt-1 leading-relaxed">
            {settings.receiptFooter}
          </p>
        )}
      </div>
    </Modal>
  );
};
