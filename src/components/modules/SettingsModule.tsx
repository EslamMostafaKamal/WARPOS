import React, { useEffect, useState } from 'react';
import {
  Save,
  RotateCcw,
  Download,
  Award,
  Plus,
  Trash2,
  Sliders,
  Globe,
  ShieldCheck,
  Layers,
  Users,
  Building2,
} from 'lucide-react';
import { BusinessSettings, CostingMethod, LoyaltyTier, ModuleKey } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, generateId } from '../../utils/format';
import { MODULE_KEY_LABELS, REGIONAL_PRESETS, tr } from '../../utils/i18n';
import { Modal } from '../ui/Modal';
import { BarcodeSvg } from '../ui/BarcodeSvg';
import { ZatcaQrSvg } from '../ui/ZatcaQrSvg';
import { DataImportModal } from '../ui/DataImportModal';
import { UserAccessManager } from './UserAccessManager';

const CURRENCY_PRESETS = ['SAR ', 'EGP ', 'AED ', '$', '€', '£'];

const MODULE_KEYS: ModuleKey[] = [
  'inventory',
  'sales',
  'customers',
  'suppliers',
  'purchases',
  'expenses',
];

export const SettingsModule: React.FC = () => {
  const { state, updateSettings, setLanguage, applyRegionalPreset, resetDemoData, addToast } =
    useStore();
  const { hasPermission } = useAuth();
  const canManageUsers = hasPermission('canManageUsers');
  const [settingsTab, setSettingsTab] = useState<'general' | 'access'>('general');
  const [form, setForm] = useState<BusinessSettings>(state.settings);
  const lang = state.settings.language;
  const isAr = lang === 'ar';
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [schemaModalTarget, setSchemaModalTarget] = useState<{
    key: ModuleKey;
    label: string;
  } | null>(null);

  useEffect(() => {
    setForm(state.settings);
  }, [state.settings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTiers = [...form.loyalty.tiers]
      .filter((t) => t.pointsRequired > 0 && t.discountPercent > 0)
      .sort((a, b) => a.pointsRequired - b.pointsRequired);

    updateSettings({
      ...form,
      storeName: form.storeName.trim() || tr(lang, 'My Store', 'متجري'),
      taxRate: Math.max(0, Math.min(100, Number(form.taxRate) || 0)),
      currencySymbol: form.currencySymbol || '$',
      loyalty: {
        ...form.loyalty,
        spendUnit: Math.max(1, Number(form.loyalty.spendUnit) || 1),
        pointsPerUnit: Math.max(1, Number(form.loyalty.pointsPerUnit) || 1),
        tiers: cleanTiers,
      },
    });
  };

  const updateTier = (id: string, patch: Partial<LoyaltyTier>) => {
    setForm((prev) => ({
      ...prev,
      loyalty: {
        ...prev.loyalty,
        tiers: prev.loyalty.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    }));
  };

  const addTier = () => {
    const highestPts = Math.max(0, ...form.loyalty.tiers.map((t) => t.pointsRequired));
    const highestPct = Math.max(0, ...form.loyalty.tiers.map((t) => t.discountPercent));
    setForm((prev) => ({
      ...prev,
      loyalty: {
        ...prev.loyalty,
        tiers: [
          ...prev.loyalty.tiers,
          {
            id: generateId('tier'),
            label: tr(
              lang,
              `Tier ${prev.loyalty.tiers.length + 1}`,
              `شريحة ${prev.loyalty.tiers.length + 1}`
            ),
            pointsRequired: highestPts + 200,
            discountPercent: Math.min(80, highestPct + 10),
          },
        ],
      },
    }));
  };

  const removeTier = (id: string) => {
    setForm((prev) => ({
      ...prev,
      loyalty: {
        ...prev.loyalty,
        tiers: prev.loyalty.tiers.filter((t) => t.id !== id),
      },
    }));
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledgerflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      type: 'info',
      title: tr(lang, 'Backup exported', 'تم تصدير النسخة الاحتياطية'),
      description: tr(
        lang,
        'Downloaded full ERP dataset as JSON.',
        'تم تنزيل قاعدة بيانات النظام الكاملة بصيغة JSON.'
      ),
    });
  };

  const handleConfirmReset = () => {
    resetDemoData();
    setResetModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {canManageUsers && (
        <div className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg">
          <button
            type="button"
            onClick={() => setSettingsTab('general')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              settingsTab === 'general'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            {tr(lang, 'Store, Tax & Loyalty', 'المتجر، الضريبة والولاء')}
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('access')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              settingsTab === 'access'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {tr(lang, 'Access Control & Passwords', 'الصلاحيات وحسابات الموظفين')}
          </button>
        </div>
      )}

      {settingsTab === 'access' && canManageUsers ? (
        <UserAccessManager />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: MENA Localization + Business Profile + Loyalty Program Rules */}
      <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
        {/* MENA Localization, ZATCA E-Invoicing & Inventory Costing */}
        <section className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-teal-700 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {tr(
                  lang,
                  'MENA Localization, ZATCA E-Invoicing & Costing',
                  'التوطين العربي، الفوترة الإلكترونية (ZATCA) وطريقة التكلفة'
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tr(
                  lang,
                  'Arabic RTL / English LTR, SAR/EGP/AED VAT presets, ZATCA Phase-1 QR, and FIFO vs Weighted Average costing',
                  'اللغة العربية RTL، العملات العربية (ر.س، ج.م، د.إ)، رمز ZATCA QR، وطريقة تقييم المخزون FIFO'
                )}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Language & Direction */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  {tr(lang, 'Interface Language & Direction', 'لغة واتجاه الواجهة')}
                </span>
                <span className="text-[11px] text-slate-500">
                  {tr(
                    lang,
                    'Switch instantly between English LTR and Arabic RTL',
                    'تبديل فوري لكامل النظام بين العربية (RTL) والإنجليزية (LTR)'
                  )}
                </span>
              </div>
              <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    state.settings.language === 'en'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  English (LTR)
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    state.settings.language === 'ar'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  العربية (RTL)
                </button>
              </div>
            </div>

            {/* Regional Currency & VAT Quick Presets */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-800 block">
                {tr(
                  lang,
                  'Quick MENA Market & Currency Presets',
                  'إعدادات الأسواق العربية السريعة (العملة والضريبة)'
                )}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REGIONAL_PRESETS.map((preset) => {
                  const active = form.currencyCode === preset.code;
                  return (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => applyRegionalPreset(preset.code)}
                      className={`text-start p-3 rounded-lg border text-xs transition-colors ${
                        active
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isAr ? preset.labelAr : preset.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ZATCA Compliance Controls */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                  <span className="text-xs font-semibold text-slate-900">
                    {tr(
                      lang,
                      'ZATCA Simplified E-Invoice QR (Phase 1 TLV)',
                      'الفوترة الإلكترونية (هيئة الزكاة والضريبة ZATCA QR)'
                    )}
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form.zatcaEnabled}
                    onChange={(e) => setForm({ ...form, zatcaEnabled: e.target.checked })}
                    className="w-4 h-4 accent-teal-700"
                  />
                  {tr(lang, 'Enable QR', 'تفعيل QR')}
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(
                    lang,
                    'VAT Registration Number (15 digits for ZATCA)',
                    'الرقم الضريبي (VAT Number — 15 رقماً لهيئة الزكاة)'
                  )}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.vatNumber}
                  onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                  placeholder="310122393500003"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Inventory Costing Method: FIFO vs Weighted Average */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-slate-800">
                  {tr(
                    lang,
                    'Inventory Costing Valuation Method',
                    'طريقة تقييم تكلفة المخزون (لمواكبة التضخم)'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: 'fifo',
                      titleEn: 'FIFO (First-In, First-Out)',
                      titleAr: 'FIFO (الوارد أولاً يصرف أولاً)',
                      descEn: 'Consumes oldest purchase batch layers first — ideal under inflation.',
                      descAr:
                        'يخصم من أقدم دفعة شراء أولاً — مثالي لمواكبة تغيرات الأسعار والتضخم.',
                    },
                    {
                      id: 'weighted_average',
                      titleEn: 'Weighted Average Cost',
                      titleAr: 'متوسط التكلفة المرجح',
                      descEn: 'Smooths unit cost continuously across all received POs.',
                      descAr: 'يحسب متوسطاً مرجحاً للتكلفة تلقائياً مع كل أمر شراء مستلم.',
                    },
                  ] as const
                ).map((opt) => {
                  const active = form.costingMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, costingMethod: opt.id as CostingMethod })
                      }
                      className={`text-start p-3 rounded-lg border transition-colors ${
                        active
                          ? 'bg-teal-50 border-teal-600 text-teal-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold">
                        {isAr ? opt.titleAr : opt.titleEn}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {isAr ? opt.descAr : opt.descEn}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Business Profile & Tax */}
        <section className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-6 py-4 border-b border-slate-200/80">
            <h2 className="text-base font-semibold text-slate-900">
              {tr(lang, 'Business Profile & Tax', 'ملف النشاط التجاري والضريبة')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr(
                lang,
                'Changes immediately update POS tax calculations, currency labels, and printed receipts',
                'تُحدث التعديلات فوراً حسابات ضريبة الكاشير، رمز العملة، والفواتير المطبوعة'
              )}
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Store Name *', 'اسم المتجر / المنشأة *')}
              </label>
              <input
                type="text"
                required
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Business Address', 'عنوان النشاط التجاري')}
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Phone Number', 'رقم الهاتف')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Billing Email', 'البريد الإلكتروني للفواتير')}
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Tax ID / CR', 'السجل التجاري / المعرف الضريبي')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Currency Symbol', 'رمز العملة')}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={form.currencySymbol}
                  onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {CURRENCY_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, currencySymbol: c })}
                      className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                        form.currencySymbol === c
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.trim()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Default Tax Rate (%)', 'نسبة الضريبة الافتراضية (%)')}
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.taxRate}
                  onChange={(e) =>
                    setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Receipt Footer Note', 'ملاحظة أسفل الإيصال')}
              </label>
              <textarea
                rows={2}
                value={form.receiptFooter}
                onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>
        </section>

        {/* Loyalty Program Rules Section */}
        <section className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-teal-700 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {tr(lang, 'Customer Loyalty Program', 'برنامج ولاء العملاء والنقاط')}
                </h2>
                <p className="text-xs text-slate-500">
                  {tr(
                    lang,
                    'Configure spend-to-points earning rate and redemption discount tiers',
                    'حدد معدل اكتساب النقاط مقابل الإنفاق وشرائح خصم الاستبدال للمشتريات القادمة'
                  )}
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={form.loyalty.enabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    loyalty: { ...form.loyalty, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 accent-teal-700 rounded"
              />
              {tr(lang, 'Enabled', 'مفعّل')}
            </label>
          </div>

          <div className="p-6 space-y-5">
            {/* Spend-to-Points Earning Rate */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-medium text-slate-700">
                {tr(lang, 'Earning Formula: Every', 'معادلة الاكتساب: كل')}
              </span>
              <div className="inline-flex items-center gap-1">
                <span className="font-mono text-slate-500">{form.currencySymbol}</span>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.loyalty.spendUnit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      loyalty: {
                        ...form.loyalty,
                        spendUnit: Math.max(1, parseFloat(e.target.value) || 1),
                      },
                    })
                  }
                  className="w-20 px-2.5 py-1.5 font-mono text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <span className="font-medium text-slate-700">
                {tr(lang, 'spent earns', 'مشتريات تمنح')}
              </span>
              <div className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.loyalty.pointsPerUnit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      loyalty: {
                        ...form.loyalty,
                        pointsPerUnit: Math.max(1, parseInt(e.target.value, 10) || 1),
                      },
                    })
                  }
                  className="w-20 px-2.5 py-1.5 font-mono text-xs bg-white border border-slate-300 rounded-lg"
                />
                <span className="font-medium text-slate-700">
                  {tr(lang, 'points', 'نقطة')}
                </span>
              </div>
            </div>

            {/* Discount Tiers */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  {tr(
                    lang,
                    'Redemption Discount Tiers (Next Purchase)',
                    'شرائح خصم استبدال النقاط (للمشتريات القادمة)'
                  )}
                </span>
                <button
                  type="button"
                  onClick={addTier}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {tr(lang, 'Add Tier', 'إضافة شريحة')}
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {form.loyalty.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <input
                      type="text"
                      value={tier.label}
                      onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                      placeholder={tr(lang, 'Tier Name', 'اسم الشريحة')}
                      className="sm:col-span-5 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                    <div className="sm:col-span-3 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={tier.pointsRequired}
                        onChange={(e) =>
                          updateTier(tier.id, {
                            pointsRequired: Math.max(1, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
                      />
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        {tr(lang, 'pts', 'نقطة')}
                      </span>
                    </div>
                    <div className="sm:col-span-3 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={tier.discountPercent}
                        onChange={(e) =>
                          updateTier(tier.id, {
                            discountPercent: Math.max(
                              1,
                              Math.min(100, parseFloat(e.target.value) || 0)
                            ),
                          })
                        }
                        className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
                      />
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        {tr(lang, '% off', '% خصم')}
                      </span>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeTier(tier.id)}
                        disabled={form.loyalty.tiers.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded"
                        aria-label={tr(lang, 'Remove tier', 'حذف الشريحة')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {tr(lang, 'Save All Settings', 'حفظ جميع الإعدادات')}
            </button>
          </div>
        </section>
      </form>

      {/* Right Column: Live Receipt Preview + Custom Module Schemas + Reset */}
      <div className="lg:col-span-5 space-y-5">
        <section className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <h3 className="text-sm font-semibold text-slate-900">
            {tr(lang, 'Live Receipt & Barcode Preview', 'معاينة حية للفاتورة والباركود')}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {tr(
              lang,
              'Preview of store branding, tax rate, and scannable receipt barcode',
              'معاينة ترويسة المتجر ونسبة الضريبة ورمز ZATCA QR والباركود القابل للمسح'
            )}
          </p>

          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-700 space-y-3">
            <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-0.5">
              <p className="font-sans text-sm font-bold text-slate-900">
                {form.storeName || tr(lang, 'Store Name', 'اسم المتجر')}
              </p>
              <p className="text-[11px] text-slate-500">{form.address}</p>
              <p className="text-[11px] text-slate-500">
                {form.phone} {form.taxId ? `· ${form.taxId}` : ''}
              </p>
            </div>
            <div className="space-y-1 tabular-nums text-[11px]">
              <div className="flex justify-between">
                <span>{tr(lang, 'Sample Subtotal', 'المجموع الفرعي (تجريبي)')}</span>
                <span>{formatCurrency(100, form.currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>
                  {tr(lang, 'Tax', 'الضريبة')} ({form.taxRate}%)
                </span>
                <span>{formatCurrency(form.taxRate, form.currencySymbol)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>{tr(lang, 'Sample Total', 'الإجمالي (تجريبي)')}</span>
                <span>{formatCurrency(100 + form.taxRate, form.currencySymbol)}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-300 flex flex-col items-center gap-2.5">
              {form.zatcaEnabled && (
                <ZatcaQrSvg
                  sellerName={form.storeName || 'Store'}
                  vatNumber={form.vatNumber || '310122393500003'}
                  timestampIso={new Date().toISOString()}
                  invoiceTotal={100 + form.taxRate}
                  vatTotal={form.taxRate}
                  size={96}
                  showTlvLabel
                />
              )}
              <BarcodeSvg value="INV-2026-1049" height={28} showText />
            </div>
          </div>
        </section>

        {/* Per-Module Custom Data Schema Hub */}
        <section className="bg-white border border-slate-200/85 rounded-xl p-5 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-700 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {tr(lang, 'Custom Data Formats & Bulk Migration', 'تخصيص تنسيق البيانات والاستيراد')}
              </h3>
              <p className="text-xs text-slate-500">
                {tr(
                  lang,
                  'Tailor fields and upload legacy CSV/JSON files for each section',
                  'خصّص الحقول وارفع ملفات CSV أو JSON من أنظمتك السابقة لكل قسم'
                )}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {MODULE_KEYS.map((key) => {
              const count = (state.moduleSchemas[key] ?? []).length;
              const label = MODULE_KEY_LABELS[key][lang];
              return (
                <div
                  key={key}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-medium text-slate-900">{label}</span>
                    <span className="text-slate-400 ms-2 font-mono text-[11px]">
                      {isAr
                        ? `${count} حقل مخصص`
                        : `${count} custom field${count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSchemaModalTarget({ key, label })}
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap"
                  >
                    {tr(lang, 'Configure / Import', 'تخصيص / استيراد')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Storage & Demo Data Controls */}
        <section className="bg-white border border-slate-200/85 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {tr(lang, 'Workspace Data & Reset', 'بيانات مساحة العمل وإعادة التعيين')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr(
                lang,
                'All changes persist automatically in browser localStorage across tabs.',
                'يتم حفظ كافة التغييرات تلقائياً في ذاكرة المتصفح المحلية عبر جميع الأقسام.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {tr(lang, 'Export JSON Backup', 'تصدير نسخة احتياطية JSON')}
            </button>

            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {tr(lang, 'Reset Demo Data', 'استعادة البيانات التجريبية')}
            </button>
          </div>
        </section>
      </div>

      {/* Confirm Reset Modal */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={tr(lang, 'Reset All Demo Data?', 'استعادة جميع البيانات التجريبية؟')}
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Restore Sample Data', 'استعادة البيانات الافتراضية')}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          {tr(
            lang,
            'This will replace your current localStorage inventory, variants, loyalty tiers, custom schemas, sales history, purchase orders, and store settings with the sample dataset.',
            'سيؤدي هذا إلى استبدال المخزون الحالي، المقاسات، شرائح الولاء، الحقول المخصصة، سجل المبيعات، أوامر الشراء، وإعدادات المتجر بالبيانات الافتراضية.'
          )}
        </p>
      </Modal>

      {schemaModalTarget && (
        <DataImportModal
          open={Boolean(schemaModalTarget)}
          onClose={() => setSchemaModalTarget(null)}
          moduleKey={schemaModalTarget.key}
          moduleLabel={schemaModalTarget.label}
        />
      )}
    </div>
      )}
    </div>
  );
};
