import React, { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Upload } from 'lucide-react';
import { Expense, ExpenseCategory, ExpensePaymentMethod } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatCurrency, formatDateShort, toDateKey } from '../../utils/format';
import { tr, translateExpenseCategory, translatePaymentMethod } from '../../utils/i18n';
import { Modal } from '../ui/Modal';
import { DataImportModal } from '../ui/DataImportModal';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Utilities',
  'Salaries',
  'Supplies',
  'Marketing',
  'Maintenance',
  'Other',
];

const PAYMENT_METHODS: ExpensePaymentMethod[] = ['Cash', 'Card', 'Bank Transfer'];

const EMPTY_EXPENSE = {
  id: undefined as string | undefined,
  date: toDateKey(new Date()),
  category: 'Supplies' as ExpenseCategory,
  vendor: '',
  amount: '',
  paymentMethod: 'Card' as ExpensePaymentMethod,
  notes: '',
  customFields: {} as Record<string, string>,
};

export const ExpensesAccountingModule: React.FC = () => {
  const { state, saveExpense, deleteExpense } = useStore();
  const sym = state.settings.currencySymbol;
  const lang = state.settings.language;
  const expenseSchema = state.moduleSchemas.expenses ?? [];

  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ExpenseCategory>('All');
  const [search, setSearch] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);

  const isInPeriod = (isoDate: string) => {
    if (period === 'all') return true;
    const diffDays = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
    return period === '7d' ? diffDays <= 7 : diffDays <= 30;
  };

  const pnl = useMemo(() => {
    const completedSales = state.sales.filter(
      (s) => s.status === 'Completed' && isInPeriod(s.date)
    );
    const periodExpenses = state.expenses.filter((e) => isInPeriod(e.date));

    const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0);
    const totalTaxCollected = completedSales.reduce((sum, s) => sum + s.taxAmount, 0);
    const cogs = completedSales.reduce((sum, s) => sum + s.totalCost, 0);
    const grossProfit = totalRevenue - cogs;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const byCategory = EXPENSE_CATEGORIES.map((cat) => {
      const amount = periodExpenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      return { category: cat, amount };
    })
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      totalRevenue,
      totalTaxCollected,
      cogs,
      grossProfit,
      grossMargin,
      totalExpenses,
      netProfit,
      netMargin,
      byCategory,
    };
  }, [state.sales, state.expenses, period]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.expenses.filter((e) => {
      if (!isInPeriod(e.date)) return false;
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.vendor.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        translateExpenseCategory(e.category, lang).toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q)
      );
    });
  }, [state.expenses, period, categoryFilter, search, lang]);

  const openAddExpense = () => {
    setExpenseForm({
      ...EMPTY_EXPENSE,
      date: toDateKey(new Date()),
      customFields: {},
    });
    setExpenseModalOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setExpenseForm({
      id: expense.id,
      date: toDateKey(expense.date),
      category: expense.category,
      vendor: expense.vendor,
      amount: expense.amount.toString(),
      paymentMethod: expense.paymentMethod,
      notes: expense.notes,
      customFields: { ...(expense.customFields ?? {}) },
    });
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0 || !expenseForm.vendor.trim()) return;

    const isoDate = new Date(`${expenseForm.date}T12:00:00`).toISOString();
    saveExpense({
      id: expenseForm.id,
      date: isoDate,
      category: expenseForm.category,
      vendor: expenseForm.vendor.trim(),
      amount,
      paymentMethod: expenseForm.paymentMethod,
      notes: expenseForm.notes.trim(),
      customFields: expenseForm.customFields,
    });
    setExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Period Selector & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg">
          {(
            [
              { id: '7d', label: tr(lang, 'Last 7 Days', 'آخر 7 أيام') },
              { id: '30d', label: tr(lang, 'Last 30 Days', 'آخر 30 يوماً') },
              { id: 'all', label: tr(lang, 'All Time', 'كامل الفترة') },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                period === opt.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
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
            onClick={openAddExpense}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {tr(lang, 'Log Expense', 'تسجيل مصروف')}
          </button>
        </div>
      </div>

      {/* Profit & Loss Statement + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <section className="lg:col-span-7 bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {tr(lang, 'Profit & Loss Summary', 'قائمة الأرباح والخسائر (P&L)')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr(
                lang,
                'Live comparison of completed sales revenue, COGS, and recorded operating expenses',
                'مقارنة لحظية بين إيرادات المبيعات المكتملة وتكلفة البضاعة المباعة والمصروفات التشغيلية'
              )}
            </p>
          </div>

          <div className="mt-5 divide-y divide-slate-100 text-sm tabular-nums">
            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">
                  {tr(lang, 'Total Revenue', 'إجمالي الإيرادات')}
                </p>
                <p className="text-xs text-slate-500">
                  {tr(lang, 'Includes', 'يشمل')} {formatCurrency(pnl.totalTaxCollected, sym)}{' '}
                  {tr(lang, 'tax collected', 'ضريبة محصّلة')}
                </p>
              </div>
              <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">
                {formatCurrency(pnl.totalRevenue, sym)}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-700">
                  {tr(lang, 'Cost of Goods Sold (COGS)', 'تكلفة البضاعة المباعة (COGS)')}
                </p>
                <p className="text-xs text-slate-500">
                  {tr(lang, 'Unit cost basis of sold inventory', 'تكلفة الوحدات المباعة من المخزون')}
                </p>
              </div>
              <span className="font-mono text-slate-700 whitespace-nowrap">
                -{formatCurrency(pnl.cogs, sym)}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between gap-4 bg-slate-50/80 -mx-5 px-5">
              <div>
                <p className="font-semibold text-slate-900">
                  {tr(lang, 'Gross Profit', 'مجمل الربح')}
                </p>
                <p className="text-xs text-slate-500">
                  {tr(lang, 'Gross margin', 'هامش مجمل الربح')} {pnl.grossMargin.toFixed(1)}%
                </p>
              </div>
              <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                {formatCurrency(pnl.grossProfit, sym)}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-700">
                  {tr(lang, 'Total Operating Expenses', 'إجمالي المصروفات التشغيلية')}
                </p>
                <p className="text-xs text-slate-500">
                  {tr(
                    lang,
                    'Rent, utilities, salaries, supplies & more',
                    'الإيجار، المرافق، الرواتب، المستلزمات وغيرها'
                  )}
                </p>
              </div>
              <span className="font-mono text-amber-700 whitespace-nowrap">
                -{formatCurrency(pnl.totalExpenses, sym)}
              </span>
            </div>

            <div className="pt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-bold text-slate-900">
                  {tr(lang, 'Net Profit', 'صافي الربح')}
                </p>
                <p className="text-xs text-slate-500">
                  {tr(lang, 'Net margin', 'صافي هامش الربح')} {pnl.netMargin.toFixed(1)}%
                </p>
              </div>
              <span
                className={`text-xl font-bold font-mono whitespace-nowrap ${
                  pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {formatCurrency(pnl.netProfit, sym)}
              </span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col">
          <h2 className="text-base font-semibold text-slate-900">
            {tr(lang, 'Expenses by Category', 'توزيع المصروفات حسب البند')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {tr(
              lang,
              'Distribution of operating costs in selected timeframe',
              'نسب التكاليف التشغيلية خلال الفترة المحددة'
            )}
          </p>

          <div className="mt-5 space-y-3.5 flex-1">
            {pnl.byCategory.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                {tr(
                  lang,
                  'No operating expenses logged for this timeframe.',
                  'لا توجد مصروفات تشغيلية مسجلة في هذه الفترة.'
                )}
              </div>
            ) : (
              pnl.byCategory.map((item) => {
                const pct =
                  pnl.totalExpenses > 0 ? (item.amount / pnl.totalExpenses) * 100 : 0;
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="font-medium text-slate-800">
                        {translateExpenseCategory(item.category, lang)}
                      </span>
                      <span className="font-mono text-slate-700">
                        {formatCurrency(item.amount, sym)}{' '}
                        <span className="text-slate-400">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full"
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Expense Ledger Table */}
      <section className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr(
                lang,
                'Search expenses by vendor, category, or notes...',
                'ابحث في المصروفات بالجهة أو التصنيف أو الملاحظات...'
              )}
              className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="All">{tr(lang, 'All Categories', 'كل التصنيفات')}</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {translateExpenseCategory(c, lang)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          {filteredExpenses.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {tr(
                lang,
                'No expenses found matching your filter.',
                'لا توجد مصروفات مطابقة لبحثك.'
              )}
            </div>
          ) : (
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 text-start">{tr(lang, 'Date', 'التاريخ')}</th>
                  <th className="py-3 px-4 text-start">{tr(lang, 'Category', 'التصنيف')}</th>
                  <th className="py-3 px-4 text-start">
                    {tr(lang, 'Vendor / Payee', 'المستفيد / الجهة')}
                  </th>
                  <th className="py-3 px-4 text-start">{tr(lang, 'Method', 'طريقة الدفع')}</th>
                  {expenseSchema.slice(0, 2).map((cf) => (
                    <th key={cf.id} className="py-3 px-3 text-start whitespace-nowrap">
                      {cf.label}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-start">{tr(lang, 'Notes', 'ملاحظات')}</th>
                  <th className="py-3 px-4 text-end">{tr(lang, 'Amount', 'المبلغ')}</th>
                  <th className="py-3 px-4 text-end">{tr(lang, 'Actions', 'إجراءات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateShort(exp.date, lang)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {translateExpenseCategory(exp.category, lang)}
                    </td>
                    <td className="py-3 px-4 text-slate-800">{exp.vendor}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {translatePaymentMethod(exp.paymentMethod, lang)}
                    </td>
                    {expenseSchema.slice(0, 2).map((cf) => (
                      <td key={cf.id} className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {exp.customFields?.[cf.key] || '—'}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {exp.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(exp.amount, sym)}
                    </td>
                    <td className="py-3 px-4 text-end whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditExpense(exp)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                          aria-label={tr(lang, 'Edit expense', 'تعديل المصروف')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExpense(exp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          aria-label={tr(lang, 'Delete expense', 'حذف المصروف')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Add / Edit Expense Modal */}
      <Modal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title={
          expenseForm.id
            ? tr(lang, 'Edit Expense', 'تعديل مصروف')
            : tr(lang, 'Log Business Expense', 'تسجيل مصروف تشغيلي')
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setExpenseModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="expense-form"
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
            >
              {expenseForm.id
                ? tr(lang, 'Save Changes', 'حفظ التغييرات')
                : tr(lang, 'Record Expense', 'تسجيل المصروف')}
            </button>
          </>
        }
      >
        <form id="expense-form" onSubmit={handleSaveExpense} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Date *', 'التاريخ *')}
              </label>
              <input
                type="date"
                required
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Category *', 'التصنيف *')}
              </label>
              <select
                value={expenseForm.category}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {translateExpenseCategory(c, lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Vendor / Payee *', 'المستفيد / الجهة *')}
            </label>
            <input
              type="text"
              required
              value={expenseForm.vendor}
              onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              placeholder={tr(lang, 'e.g., Pacific Power & Water', 'مثال: شركة الكهرباء والمياه')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Amount', 'المبلغ')} ({sym.trim()}) *
              </label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Payment Method', 'طريقة الدفع')}
              </label>
              <select
                value={expenseForm.paymentMethod}
                onChange={(e) =>
                  setExpenseForm({
                    ...expenseForm,
                    paymentMethod: e.target.value as ExpensePaymentMethod,
                  })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {translatePaymentMethod(m, lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Notes', 'ملاحظات')}
            </label>
            <textarea
              rows={2}
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
              placeholder={tr(
                lang,
                'Receipt number or expense description...',
                'رقم الإيصال أو وصف المصروف...'
              )}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          {expenseSchema.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {expenseSchema.map((cf) => (
                <div key={cf.id}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {cf.label}
                  </label>
                  <input
                    type={cf.type}
                    value={expenseForm.customFields[cf.key] ?? ''}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
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

      <DataImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        moduleKey="expenses"
        moduleLabel={tr(lang, 'Expenses', 'المصروفات')}
      />
    </div>
  );
};
