import React, { useMemo, useState } from 'react';
import {
  Search,
  Receipt,
  Users,
  Plus,
  Pencil,
  DollarSign,
  Eye,
  RotateCcw,
  Upload,
  Award,
  ScanBarcode,
} from 'lucide-react';
import { Customer, ExpensePaymentMethod, PaymentMethod, Sale } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatCurrency, formatDateTime, isSameDay } from '../../utils/format';
import {
  tr,
  translateChannel,
  translatePaymentMethod,
  translateSaleStatus,
} from '../../utils/i18n';
import { Modal } from '../ui/Modal';
import { ReceiptModal } from '../ui/ReceiptModal';
import { DataImportModal } from '../ui/DataImportModal';

const EMPTY_CUSTOMER = {
  id: undefined as string | undefined,
  name: '',
  phone: '',
  email: '',
  address: '',
  creditBalance: '0',
  loyaltyPoints: '0',
  customFields: {} as Record<string, string>,
};

export const CustomersSalesModule: React.FC = () => {
  const { state, saveCustomer, recordCustomerPayment, addToast } = useStore();
  const sym = state.settings.currencySymbol;
  const lang = state.settings.language;
  const customerSchema = state.moduleSchemas.customers ?? [];
  const tiers = [...state.settings.loyalty.tiers].sort(
    (a, b) => b.pointsRequired - a.pointsRequired
  );

  const [activeTab, setActiveTab] = useState<'sales' | 'customers'>('sales');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Completed' | 'Refunded'>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Invoice detail / receipt modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Add/Edit customer modal
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER);

  // Record Customer Payment modal
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<ExpensePaymentMethod>('Cash');
  const [payNotes, setPayNotes] = useState('');

  const summary = useMemo(() => {
    const completed = state.sales.filter((s) => s.status === 'Completed');
    const revenue = completed.reduce((sum, s) => sum + s.total, 0);
    const totalCredit = state.customers.reduce((sum, c) => sum + c.creditBalance, 0);
    const totalLoyaltyPoints = state.customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
    return {
      completedCount: completed.length,
      revenue,
      totalCredit,
      totalLoyaltyPoints,
    };
  }, [state.sales, state.customers]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return state.sales.filter((sale) => {
      if (paymentFilter !== 'all' && sale.paymentMethod !== paymentFilter) return false;
      if (statusFilter !== 'all' && sale.status !== statusFilter) return false;

      if (dateFilter === 'today' && !isSameDay(sale.date)) return false;
      if (dateFilter === '7d') {
        const diffDays = (now - new Date(sale.date).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      }
      if (dateFilter === '30d') {
        const diffDays = (now - new Date(sale.date).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) return false;
      }

      if (!q) return true;
      return (
        sale.invoiceNumber.toLowerCase().includes(q) ||
        sale.customerName.toLowerCase().includes(q) ||
        sale.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            (i.barcode || '').toLowerCase().includes(q)
        )
      );
    });
  }, [state.sales, search, dateFilter, paymentFilter, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.customers;
    return state.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [state.customers, search]);

  const handleInvoiceScanEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      const match = state.sales.find(
        (s) => s.invoiceNumber.toLowerCase() === search.trim().toLowerCase()
      );
      if (match) {
        setSelectedSale(match);
        addToast({
          type: 'info',
          title: tr(
            lang,
            `Invoice barcode matched · ${match.invoiceNumber}`,
            `تمت مطابقة باركود الفاتورة · ${match.invoiceNumber}`
          ),
          description: tr(
            lang,
            'Opened receipt for inspection or refund.',
            'تم فتح الإيصال للمراجعة أو المرتجع.'
          ),
        });
      }
    }
  };

  const openAddCustomer = () => {
    setCustomerForm({ ...EMPTY_CUSTOMER, customFields: {} });
    setCustomerModalOpen(true);
  };

  const openEditCustomer = (c: Customer) => {
    setCustomerForm({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      creditBalance: c.creditBalance.toString(),
      loyaltyPoints: c.loyaltyPoints.toString(),
      customFields: { ...(c.customFields ?? {}) },
    });
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) return;
    saveCustomer({
      id: customerForm.id,
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      email: customerForm.email.trim(),
      address: customerForm.address.trim(),
      creditBalance: Math.max(0, parseFloat(customerForm.creditBalance) || 0),
      loyaltyPoints: Math.max(0, parseInt(customerForm.loyaltyPoints, 10) || 0),
      customFields: customerForm.customFields,
    });
    setCustomerModalOpen(false);
  };

  const openRecordPayment = (customer: Customer) => {
    setPayCustomer(customer);
    setPayAmount(customer.creditBalance.toFixed(2));
    setPayMethod('Cash');
    setPayNotes('');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustomer) return;
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) return;
    recordCustomerPayment(payCustomer.id, amt, payMethod, payNotes);
    setPayCustomer(null);
  };

  const getEligibleTierLabel = (pts: number) => {
    const matched = tiers.find((t) => pts >= t.pointsRequired);
    return matched
      ? tr(lang, `Up to ${matched.discountPercent}% off`, `خصم حتى ${matched.discountPercent}%`)
      : tr(lang, 'Accumulating', 'قيد التجميع');
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Completed Sales Revenue', 'إيرادات المبيعات المكتملة')}
          </p>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1.5">
            {formatCurrency(summary.revenue, sym)}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Completed Invoices', 'الفواتير المكتملة')}
          </p>
          <p className="text-xl font-bold font-mono text-emerald-700 tabular-nums mt-1.5">
            {summary.completedCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Active Loyalty Points', 'نقاط الولاء النشطة')}
          </p>
          <p className="text-xl font-bold font-mono text-teal-700 tabular-nums mt-1.5">
            {summary.totalLoyaltyPoints.toLocaleString()} {tr(lang, 'pts', 'نقطة')}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Outstanding Customer Credit', 'الذمم المدينة (الآجل)')}
          </p>
          <p
            className={`text-xl font-bold font-mono tabular-nums mt-1.5 ${
              summary.totalCredit > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {formatCurrency(summary.totalCredit, sym)}
          </p>
        </div>
      </div>

      {/* Sub-navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'sales'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            {tr(lang, 'Sales History', 'سجل الفواتير')} ({state.sales.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'customers'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {tr(lang, 'Customer & Loyalty Directory', 'دليل العملاء والولاء')} (
            {state.customers.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200/85 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            {tr(lang, 'Import / Format', 'استيراد / تنسيق')}
          </button>
          <button
            type="button"
            onClick={openAddCustomer}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {tr(lang, 'Add Customer', 'إضافة عميل')}
          </button>
        </div>
      </div>

      {/* Sales History Tab */}
      {activeTab === 'sales' ? (
        <div className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <ScanBarcode className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleInvoiceScanEnter}
                placeholder={tr(
                  lang,
                  'Scan receipt invoice barcode, or search customer / item barcode...',
                  'امسح باركود الفاتورة أو ابحث بالعميل أو باركود الصنف...'
                )}
                className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
              />
            </div>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">{tr(lang, 'All Dates', 'كل التواريخ')}</option>
              <option value="today">{tr(lang, 'Today', 'اليوم')}</option>
              <option value="7d">{tr(lang, 'Last 7 Days', 'آخر 7 أيام')}</option>
              <option value="30d">{tr(lang, 'Last 30 Days', 'آخر 30 يوماً')}</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">{tr(lang, 'All Payments', 'كل طرق الدفع')}</option>
              <option value="Cash">{translatePaymentMethod('Cash', lang)}</option>
              <option value="Card">{translatePaymentMethod('Card', lang)}</option>
              <option value="Split/Credit">{translatePaymentMethod('Split/Credit', lang)}</option>
              <option value="BNPL">{translatePaymentMethod('BNPL', lang)}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">{tr(lang, 'All Statuses', 'كل الحالات')}</option>
              <option value="Completed">{translateSaleStatus('Completed', lang)}</option>
              <option value="Refunded">{translateSaleStatus('Refunded', lang)}</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            {filteredSales.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {tr(
                  lang,
                  'No invoices match your filter criteria.',
                  'لا توجد فواتير مطابقة لمعايير التصفية.'
                )}
              </div>
            ) : (
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4 text-start">{tr(lang, 'Invoice', 'الفاتورة')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Date', 'التاريخ')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Customer', 'العميل')}</th>
                    <th className="py-3 px-4 text-start">
                      {tr(lang, 'Payment / Loyalty', 'الدفع / الولاء')}
                    </th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Items', 'القطع')}</th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Total', 'الإجمالي')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Status', 'الحالة')}</th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Actions', 'إجراءات')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <div>{sale.invoiceNumber}</div>
                        <div className="font-sans text-[10px] font-normal text-slate-500">
                          {translateChannel(sale.channel, lang)}
                          {sale.syncStatus === 'offline_queued' && (
                            <span className="text-amber-700 font-medium ms-1.5">
                              · {tr(lang, 'Offline Queued', 'بانتظار المزامنة')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                        {formatDateTime(sale.date, lang)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{sale.customerName}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div>
                          {translatePaymentMethod(sale.paymentMethod, lang)}
                          {sale.bnplDetails
                            ? ` · ${sale.bnplDetails.provider} (${sale.bnplDetails.months}${tr(
                                lang,
                                'm',
                                ' ش'
                              )})`
                            : ''}
                        </div>
                        {sale.creditAmount > 0 && (
                          <div className="text-[11px] text-amber-700 font-mono">
                            {tr(lang, 'Credit', 'آجل')} {formatCurrency(sale.creditAmount, sym)}
                          </div>
                        )}
                        {sale.loyaltyPointsEarned > 0 && (
                          <div className="text-[11px] text-teal-700 font-mono">
                            +{sale.loyaltyPointsEarned} {tr(lang, 'pts', 'نقطة')}
                            {sale.loyaltyPointsRedeemed > 0
                              ? ` / -${sale.loyaltyPointsRedeemed} ${tr(lang, 'pts', 'نقطة')}`
                              : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end font-mono text-slate-600 tabular-nums">
                        {sale.items.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td className="py-3 px-4 text-end font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(sale.total, sym)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold text-xs ${
                            sale.status === 'Completed' ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {translateSaleStatus(sale.status, lang)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSale(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded-md whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {tr(lang, 'Receipt', 'الإيصال')}
                          </button>
                          {sale.status === 'Completed' && (
                            <button
                              type="button"
                              onClick={() => setSelectedSale(sale)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md whitespace-nowrap"
                            >
                              <RotateCcw className="w-3 h-3" />
                              {tr(lang, 'Refund', 'مرتجع')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Customer & Loyalty Directory Tab */
        <div className="space-y-5">
          <div className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="p-4 border-b border-slate-200/80">
              <div className="relative max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr(
                    lang,
                    'Search customers by name, phone, or email...',
                    'ابحث عن عميل بالاسم أو الهاتف أو البريد...'
                  )}
                  className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4 text-start">{tr(lang, 'Customer', 'العميل')}</th>
                    <th className="py-3 px-4 text-start">
                      {tr(lang, 'Contact', 'بيانات التواصل')}
                    </th>
                    {customerSchema.slice(0, 1).map((cf) => (
                      <th key={cf.id} className="py-3 px-3 text-start whitespace-nowrap">
                        {cf.label}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-end">{tr(lang, 'Orders', 'الطلبات')}</th>
                    <th className="py-3 px-4 text-end">
                      {tr(lang, 'Total Spent', 'إجمالي المشتريات')}
                    </th>
                    <th className="py-3 px-4 text-end">
                      {tr(lang, 'Loyalty Points', 'نقاط الولاء')}
                    </th>
                    <th className="py-3 px-4 text-end">
                      {tr(lang, 'Credit Balance', 'رصيد الآجل')}
                    </th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Actions', 'إجراءات')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {customer.isWalkIn
                            ? tr(lang, 'Walk-in Customer', 'عميل نقدي (عابر)')
                            : customer.name}
                        </div>
                        {customer.address && (
                          <div className="text-[11px] text-slate-500">{customer.address}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div dir="ltr" className="text-start">
                          {customer.phone || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">{customer.email}</div>
                      </td>
                      {customerSchema.slice(0, 1).map((cf) => (
                        <td key={cf.id} className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {customer.customFields?.[cf.key] || '—'}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-end font-mono text-slate-700 tabular-nums">
                        {customer.orderCount}
                      </td>
                      <td className="py-3 px-4 text-end font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(customer.totalSpent, sym)}
                      </td>
                      <td className="py-3 px-4 text-end whitespace-nowrap">
                        {customer.isWalkIn ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div>
                            <span className="font-mono font-semibold text-teal-800 tabular-nums">
                              {customer.loyaltyPoints} {tr(lang, 'pts', 'نقطة')}
                            </span>
                            <div className="text-[10px] text-slate-500">
                              {getEligibleTierLabel(customer.loyaltyPoints)}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end font-mono font-semibold tabular-nums whitespace-nowrap">
                        {customer.creditBalance > 0 ? (
                          <span className="text-amber-700">
                            {formatCurrency(customer.creditBalance, sym)}
                          </span>
                        ) : (
                          <span className="text-emerald-700">{tr(lang, 'Paid', 'مسدد')}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {customer.creditBalance > 0 && (
                            <button
                              type="button"
                              onClick={() => openRecordPayment(customer)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md whitespace-nowrap"
                            >
                              <DollarSign className="w-3 h-3" />
                              {tr(lang, 'Record Payment', 'تحصيل دفعة')}
                            </button>
                          )}
                          {!customer.isWalkIn && (
                            <button
                              type="button"
                              onClick={() => openEditCustomer(customer)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                              aria-label={tr(lang, `Edit ${customer.name}`, `تعديل ${customer.name}`)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Loyalty Points & Credit Ledgers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {state.loyaltyTransactions.length > 0 && (
              <div className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center gap-2">
                  <Award className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    {tr(lang, 'Loyalty Points Activity', 'حركات نقاط الولاء')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                        <th className="py-2.5 px-4 text-start">{tr(lang, 'Customer', 'العميل')}</th>
                        <th className="py-2.5 px-3 text-start">{tr(lang, 'Detail', 'التفاصيل')}</th>
                        <th className="py-2.5 px-4 text-end">{tr(lang, 'Points', 'النقاط')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.loyaltyTransactions.slice(0, 8).map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900">{tx.customerName}</div>
                            <div className="text-[11px] text-slate-500">
                              {formatDateTime(tx.date, lang)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <div>{tx.note}</div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {tx.reference}
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-4 text-end font-mono font-semibold tabular-nums whitespace-nowrap ${
                              tx.pointsDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {tx.pointsDelta >= 0 ? `+${tx.pointsDelta}` : tx.pointsDelta}{' '}
                            {tr(lang, 'pts', 'نقطة')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {state.customerPayments.length > 0 && (
              <div className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="px-5 py-3.5 border-b border-slate-200/80">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {tr(lang, 'Recent Credit Settlements', 'أحدث تحصيلات الآجل')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                        <th className="py-2.5 px-4 text-start">{tr(lang, 'Customer', 'العميل')}</th>
                        <th className="py-2.5 px-3 text-start">
                          {tr(lang, 'Method & Notes', 'الطريقة والملاحظات')}
                        </th>
                        <th className="py-2.5 px-4 text-end">{tr(lang, 'Amount', 'المبلغ')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.customerPayments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900">{p.customerName}</div>
                            <div className="text-[11px] text-slate-500">
                              {formatDateTime(p.date, lang)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <div>{translatePaymentMethod(p.method, lang)}</div>
                            <div className="text-[11px] text-slate-500">{p.notes}</div>
                          </td>
                          <td className="py-2.5 px-4 text-end font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                            +{formatCurrency(p.amount, sym)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Receipt & Refund Modal */}
      <ReceiptModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        allowRefund
      />

      {/* Add / Edit Customer Modal */}
      <Modal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title={
          customerForm.id
            ? tr(lang, 'Edit Customer', 'تعديل بيانات العميل')
            : tr(lang, 'Add Customer', 'إضافة عميل جديد')
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setCustomerModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="customer-form"
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Save Customer', 'حفظ العميل')}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSaveCustomer} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Customer / Business Name *', 'اسم العميل أو المؤسسة *')}
            </label>
            <input
              type="text"
              required
              value={customerForm.name}
              onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Phone', 'رقم الهاتف')}
              </label>
              <input
                type="text"
                dir="ltr"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Email', 'البريد الإلكتروني')}
              </label>
              <input
                type="email"
                dir="ltr"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Address', 'العنوان')}
              </label>
              <input
                type="text"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Loyalty Points Balance', 'رصيد نقاط الولاء')}
              </label>
              <input
                type="number"
                min={0}
                value={customerForm.loyaltyPoints}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, loyaltyPoints: e.target.value })
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>
          {customerSchema.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customerSchema.map((cf) => (
                <div key={cf.id}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {cf.label}
                  </label>
                  <input
                    type={cf.type}
                    value={customerForm.customFields[cf.key] ?? ''}
                    onChange={(e) =>
                      setCustomerForm((prev) => ({
                        ...prev,
                        customFields: { ...prev.customFields, [cf.key]: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}
        </form>
      </Modal>

      {/* Record Customer Credit Payment Modal */}
      <Modal
        open={Boolean(payCustomer)}
        onClose={() => setPayCustomer(null)}
        title={tr(lang, 'Record Customer Payment', 'تحصيل دفعة من عميل')}
        subtitle={payCustomer?.name}
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPayCustomer(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="cust-pay-form"
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Apply Payment', 'تأكيد التحصيل')}
            </button>
          </>
        }
      >
        <form id="cust-pay-form" onSubmit={handleConfirmPayment} className="space-y-4">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex justify-between text-xs">
            <span className="text-slate-700">
              {tr(lang, 'Outstanding Credit', 'الرصيد الآجل المستحق')}
            </span>
            <span className="font-mono font-bold text-amber-800 tabular-nums">
              {formatCurrency(payCustomer?.creditBalance ?? 0, sym)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Payment Amount', 'مبلغ التحصيل')} ({sym.trim()})
            </label>
            <input
              type="number"
              min={0.01}
              max={payCustomer?.creditBalance ?? undefined}
              step="0.01"
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Payment Method', 'طريقة الدفع')}
            </label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as ExpensePaymentMethod)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="Cash">{translatePaymentMethod('Cash', lang)}</option>
              <option value="Card">{translatePaymentMethod('Card', lang)}</option>
              <option value="Bank Transfer">{translatePaymentMethod('Bank Transfer', lang)}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Notes', 'ملاحظات')}
            </label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder={tr(lang, 'Reference number or note...', 'رقم مرجع الحوالة أو ملاحظة...')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </form>
      </Modal>

      {/* Universal Import & Schema Modal */}
      <DataImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        moduleKey={activeTab === 'sales' ? 'sales' : 'customers'}
        moduleLabel={
          activeTab === 'sales'
            ? tr(lang, 'Sales History', 'سجل المبيعات')
            : tr(lang, 'Customers', 'العملاء')
        }
      />
    </div>
  );
};
