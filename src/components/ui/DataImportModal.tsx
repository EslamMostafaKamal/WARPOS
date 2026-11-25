import React, { useMemo, useState } from 'react';
import {
  Upload,
  Sliders,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  BookmarkPlus,
  FileSpreadsheet,
} from 'lucide-react';
import { CustomFieldDefinition, ModuleKey } from '../../types';
import { useStore } from '../../context/StoreContext';
import {
  autoMapColumns,
  ERP_IMPORT_PRESETS,
  generateModuleCsvTemplate,
  MODULE_SYSTEM_FIELDS,
  parseCsvOrJson,
} from '../../utils/csv';
import { generateId } from '../../utils/format';
import { tr } from '../../utils/i18n';
import { Modal } from './Modal';

interface DataImportModalProps {
  open: boolean;
  onClose: () => void;
  moduleKey: ModuleKey;
  moduleLabel: string;
}

const SYSTEM_FIELD_AR: Record<string, string> = {
  sku: 'رمز الصنف (SKU)',
  barcode: 'الباركود',
  name: 'الاسم',
  category: 'التصنيف',
  costPrice: 'سعر التكلفة',
  sellingPrice: 'سعر البيع',
  stock: 'الكمية بالمخزون',
  reorderLevel: 'حد إعادة الطلب',
  color: 'اللون',
  size: 'المقاس',
  invoiceNumber: 'رقم الفاتورة',
  date: 'التاريخ',
  customerName: 'اسم العميل',
  productSku: 'رمز الصنف',
  productName: 'اسم الصنف',
  quantity: 'الكمية',
  unitPrice: 'سعر الوحدة',
  paymentMethod: 'طريقة الدفع',
  phone: 'رقم الهاتف',
  email: 'البريد الإلكتروني',
  address: 'العنوان',
  loyaltyPoints: 'نقاط الولاء',
  creditBalance: 'رصيد الآجل',
  contactPerson: 'مسؤول التواصل',
  balanceOwed: 'الرصيد المستحق',
  poNumber: 'رقم أمر الشراء',
  supplierName: 'اسم المورد',
  unitCost: 'تكلفة الوحدة',
  status: 'الحالة',
  vendor: 'المستفيد / الجهة',
  amount: 'المبلغ',
  notes: 'ملاحظات',
};

export const DataImportModal: React.FC<DataImportModalProps> = ({
  open,
  onClose,
  moduleKey,
  moduleLabel,
}) => {
  const {
    state,
    applyBulkImport,
    saveModuleCustomFields,
    saveImportProfile,
    deleteImportProfile,
  } = useStore();
  const lang = state.settings.language;
  const isAr = lang === 'ar';

  const [tab, setTab] = useState<'import' | 'schema'>('import');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [profileName, setProfileName] = useState('');

  // Schema customization state
  const currentCustomFields = state.moduleSchemas[moduleKey] ?? [];
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');

  const systemFields = MODULE_SYSTEM_FIELDS[moduleKey];
  const savedProfiles = state.importProfiles.filter((p) => p.module === moduleKey);

  const parsed = useMemo(() => parseCsvOrJson(rawText), [rawText]);

  const handleLoadData = (text: string, name: string) => {
    setRawText(text);
    setFileName(name);
    const result = parseCsvOrJson(text);
    setMapping(autoMapColumns(result.headers, moduleKey, currentCustomFields));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleLoadData(String(reader.result ?? ''), file.name);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csv = generateModuleCsvTemplate(moduleKey, currentCustomFields);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleKey}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadSampleCsv = () => {
    const sample = generateModuleCsvTemplate(moduleKey, currentCustomFields);
    handleLoadData(sample, `${moduleKey}-sample.csv`);
  };

  // Validate rows against required system fields
  const validation = useMemo(() => {
    const requiredKeys = systemFields.filter((f) => f.required).map((f) => f.key);
    const validRows: { system: Record<string, string>; custom: Record<string, string> }[] = [];
    const invalidCount: { rowIdx: number; missing: string[] }[] = [];

    parsed.rows.forEach((rawRow, idx) => {
      const system: Record<string, string> = {};
      const custom: Record<string, string> = {};

      for (const f of systemFields) {
        const srcCol = mapping[f.key];
        system[f.key] = srcCol ? (rawRow[srcCol] ?? '').trim() : '';
      }
      for (const cf of currentCustomFields) {
        const srcCol = mapping[`custom:${cf.key}`];
        if (srcCol && rawRow[srcCol]) {
          custom[cf.key] = rawRow[srcCol].trim();
        }
      }

      const missing = requiredKeys.filter((rk) => !system[rk]);
      if (missing.length > 0) {
        invalidCount.push({ rowIdx: idx + 2, missing });
      } else {
        validRows.push({ system, custom });
      }
    });

    return { validRows, invalidRows: invalidCount };
  }, [parsed.rows, mapping, systemFields, currentCustomFields]);

  const handleRunImport = () => {
    if (validation.validRows.length === 0) return;
    applyBulkImport(moduleKey, validation.validRows);
    setRawText('');
    setFileName('');
    setMapping({});
    onClose();
  };

  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newFieldLabel.trim();
    if (!label) return;
    let key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!key) {
      key = `field_${Date.now().toString(36).slice(-4)}`;
    }
    if (currentCustomFields.some((f) => f.key === key)) return;

    const updated: CustomFieldDefinition[] = [
      ...currentCustomFields,
      { id: generateId('cf'), key, label, type: newFieldType },
    ];
    saveModuleCustomFields(moduleKey, updated);
    setNewFieldLabel('');
  };

  const handleRemoveCustomField = (id: string) => {
    saveModuleCustomFields(
      moduleKey,
      currentCustomFields.filter((f) => f.id !== id)
    );
  };

  const handleSaveProfile = () => {
    if (!profileName.trim() || Object.keys(mapping).length === 0) return;
    saveImportProfile({
      name: profileName.trim(),
      module: moduleKey,
      mapping,
    });
    setProfileName('');
  };

  const translateTypeLabel = (type: 'text' | 'number' | 'date') => {
    if (!isAr) return type;
    if (type === 'number') return 'رقم';
    if (type === 'date') return 'تاريخ';
    return 'نص';
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${moduleLabel} — ${tr(lang, 'Data Upload & Format Schema', 'رفع البيانات وتخصيص التنسيق')}`}
      subtitle={tr(
        lang,
        'Migrate legacy CSV/JSON files, save custom column mappings, or add business-specific fields',
        'استورد ملفات CSV أو JSON من أنظمتك السابقة، احفظ مطابقة الأعمدة، أو أضف حقولاً مخصصة لنشاطك'
      )}
      maxWidthClass="max-w-3xl"
      footer={
        tab === 'import' ? (
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {tr(lang, 'Download Custom CSV Template', 'تنزيل قالب CSV مخصص')}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
              >
                {tr(lang, 'Cancel', 'إلغاء')}
              </button>
              <button
                type="button"
                disabled={validation.validRows.length === 0}
                onClick={handleRunImport}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg whitespace-nowrap"
              >
                {isAr
                  ? `استيراد ${validation.validRows.length} سجل صالح`
                  : `Import ${validation.validRows.length} Valid Row${
                      validation.validRows.length === 1 ? '' : 's'
                    }`}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
          >
            {tr(lang, 'Done', 'تم')}
          </button>
        )
      }
    >
      <div className="space-y-5">
        {/* Tabs */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'import'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            {tr(lang, 'Upload & Map Columns', 'رفع ومطابقة الأعمدة')}
          </button>
          <button
            type="button"
            onClick={() => setTab('schema')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'schema'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {tr(lang, 'Customize Fields', 'تخصيص الحقول')} ({currentCustomFields.length})
          </button>
        </div>

        {tab === 'import' ? (
          <div className="space-y-4">
            {/* Smart Add-on ERP Auto-Mapping Presets */}
            {ERP_IMPORT_PRESETS.some((p) => p.module === moduleKey) && (
              <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-teal-900">
                    {tr(
                      lang,
                      'Smart Add-on Presets — Load Sample Export & Auto-Map Columns',
                      'استيراد ذكي تلقائي من أنظمة السوق (Odoo · دفترة · فودكس · سلة · زد · شوبيفاي)'
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ERP_IMPORT_PRESETS.filter((p) => p.module === moduleKey).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleLoadData(preset.csv, `${preset.id}-export.csv`)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-white border border-teal-200 hover:border-teal-600 text-slate-800 rounded-md transition-colors"
                    >
                      {isAr ? preset.nameAr : preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Upload or Paste */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-xl bg-slate-50/70 cursor-pointer transition-colors text-center">
                <FileSpreadsheet className="w-6 h-6 text-teal-700 mb-2" />
                <span className="text-xs font-semibold text-slate-900">
                  {fileName
                    ? fileName
                    : tr(lang, 'Select CSV, TSV, or JSON File', 'اختر ملف CSV أو TSV أو JSON')}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  {tr(
                    lang,
                    'Exported from Excel, Google Sheets, or legacy POS',
                    'مُصدّر من Excel أو Google Sheets أو نظامك السابق'
                  )}
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">
                    {tr(lang, 'Or Paste CSV / JSON', 'أو الصق بيانات CSV / JSON')}
                  </span>
                  <button
                    type="button"
                    onClick={handleLoadSampleCsv}
                    className="text-[11px] font-medium text-teal-700 hover:text-teal-900"
                  >
                    {tr(lang, 'Load Sample Format', 'تحميل نموذج تجريبي')}
                  </button>
                </div>
                <textarea
                  rows={4}
                  dir="ltr"
                  value={rawText}
                  onChange={(e) =>
                    handleLoadData(e.target.value, tr(lang, 'Pasted Data', 'بيانات ملصقة'))
                  }
                  placeholder={tr(
                    lang,
                    'Paste header row and data rows from any spreadsheet...',
                    'الصق صف العناوين والبيانات من أي جدول...'
                  )}
                  className="flex-1 w-full p-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Saved Import Profiles */}
            {savedProfiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">
                  {tr(lang, 'Saved Formats:', 'التنسيقات المحفوظة:')}
                </span>
                {savedProfiles.map((prof) => (
                  <div
                    key={prof.id}
                    className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => setMapping(prof.mapping)}
                      className="font-medium text-slate-800 hover:text-teal-700"
                    >
                      {prof.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteImportProfile(prof.id)}
                      className="text-slate-400 hover:text-red-600 ms-1"
                      aria-label={tr(lang, `Delete profile ${prof.name}`, `حذف التنسيق ${prof.name}`)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Column Mapper */}
            {parsed.headers.length > 0 && (
              <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">
                      {tr(
                        lang,
                        `Map Your File Columns to ${moduleLabel} Fields`,
                        `مطابقة أعمدة ملفك مع حقول ${moduleLabel}`
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isAr
                        ? `تم التعرف على ${parsed.headers.length} أعمدة و ${parsed.rows.length} صفوف بيانات`
                        : `Detected ${parsed.headers.length} columns and ${parsed.rows.length} data rows`}
                    </p>
                  </div>

                  {/* Save current mapping profile */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder={tr(lang, 'Profile name...', 'اسم التنسيق...')}
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md w-36 focus:outline-none focus:border-teal-600"
                    />
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={!profileName.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-md whitespace-nowrap"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      {tr(lang, 'Save Format', 'حفظ التنسيق')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[210px] overflow-y-auto pe-1">
                  {systemFields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <span className="text-xs font-medium text-slate-800 truncate">
                        {isAr ? SYSTEM_FIELD_AR[field.key] ?? field.label : field.label}
                        {field.required && <span className="text-red-600 ms-0.5">*</span>}
                      </span>
                      <select
                        value={mapping[field.key] ?? ''}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md max-w-[160px]"
                      >
                        <option value="">{tr(lang, '— Skip —', '— تجاهل —')}</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {currentCustomFields.map((cf) => (
                    <div
                      key={cf.id}
                      className="flex items-center justify-between gap-2 bg-teal-50/40 border border-teal-200 rounded-lg px-3 py-2"
                    >
                      <span className="text-xs font-medium text-teal-900 truncate">
                        {cf.label}{' '}
                        <span className="text-[10px] text-teal-700">
                          ({tr(lang, 'Custom', 'مخصص')})
                        </span>
                      </span>
                      <select
                        value={mapping[`custom:${cf.key}`] ?? ''}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [`custom:${cf.key}`]: e.target.value,
                          }))
                        }
                        className="px-2 py-1 text-xs bg-white border border-teal-200 rounded-md max-w-[160px]"
                      >
                        <option value="">{tr(lang, '— Skip —', '— تجاهل —')}</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Validation Summary */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium tabular-nums">
                    <CheckCircle2 className="w-4 h-4" />
                    {isAr
                      ? `${validation.validRows.length} صف صالح وجاهز للاستيراد`
                      : `${validation.validRows.length} valid row${
                          validation.validRows.length === 1 ? '' : 's'
                        } ready to import`}
                  </span>
                  {validation.invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium tabular-nums">
                      <AlertTriangle className="w-4 h-4" />
                      {isAr
                        ? `${validation.invalidRows.length} صف ينقصه حقول إلزامية (سيتم تجاهله)`
                        : `${validation.invalidRows.length} row${
                            validation.invalidRows.length === 1 ? '' : 's'
                          } missing required fields (skipped)`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Customize Schema Tab */
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {isAr ? (
                <>
                  أضف حقولاً مخصصة تناسب طبيعة نشاطك (مثل: العلامة التجارية، الخامة، رقم التشغيلة،
                  تاريخ الانتهاء، مدة الضمان، أو الفرع). تظهر الحقول المخصصة فوراً في نماذج الإدخال
                  والجداول وقوالب CSV الخاصة بقسم{' '}
                  <strong className="text-slate-900">{moduleLabel}</strong>.
                </>
              ) : (
                <>
                  Define custom fields tailored to your business activity (for example: Brand,
                  Material, Batch Number, Expiry Date, Warranty Months, or Branch). Custom fields
                  immediately appear in data-entry forms, tables, and downloadable CSV templates for{' '}
                  <strong className="text-slate-900">{moduleLabel}</strong>.
                </>
              )}
            </p>

            <form
              onSubmit={handleAddCustomField}
              className="flex flex-wrap items-end gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'New Field Name', 'اسم الحقل الجديد')}
                </label>
                <input
                  type="text"
                  required
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder={tr(
                    lang,
                    'e.g., Brand, Material, Expiry Date, Branch',
                    'مثال: العلامة التجارية، تاريخ الانتهاء، الفرع'
                  )}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Type', 'النوع')}
                </label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as 'text' | 'number' | 'date')}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="text">{tr(lang, 'Text', 'نص')}</option>
                  <option value="number">{tr(lang, 'Number', 'رقم')}</option>
                  <option value="date">{tr(lang, 'Date', 'تاريخ')}</option>
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                {tr(lang, 'Add Field', 'إضافة حقل')}
              </button>
            </form>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {currentCustomFields.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {tr(
                    lang,
                    `No custom fields defined yet for ${moduleLabel}. Add one above to customize your format.`,
                    `لم تتم إضافة حقول مخصصة بعد لقسم ${moduleLabel}. أضف حقلاً بالأعلى لتخصيص تنسيق بياناتك.`
                  )}
                </div>
              ) : (
                currentCustomFields.map((cf) => (
                  <div
                    key={cf.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{cf.label}</span>
                      <span className="text-slate-400 mx-2">·</span>
                      <span className="font-mono text-slate-500">{cf.key}</span>
                      <span className="text-slate-400 mx-2">·</span>
                      <span className="capitalize text-slate-600">
                        {translateTypeLabel(cf.type)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(cf.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      aria-label={tr(lang, `Remove ${cf.label}`, `حذف ${cf.label}`)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
