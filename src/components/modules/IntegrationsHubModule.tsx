import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Webhook,
  ShoppingBag,
  Copy,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  Settings2,
  KeyRound,
  ArrowUpRight,
} from 'lucide-react';
import { EcommerceConnector, ModuleKey, WebhookLog } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatDateTime } from '../../utils/format';
import { AuditReportModal } from '../ui/AuditReportModal';
import { DataImportModal } from '../ui/DataImportModal';
import { Modal } from '../ui/Modal';

const SAMPLE_WEBHOOKS: {
  label: string;
  labelAr: string;
  endpoint: WebhookLog['endpoint'];
  source: string;
  json: string;
}[] = [
  {
    label: 'Foodics Daily Sales Push',
    labelAr: 'دفع مبيعات فودكس اليومية',
    endpoint: '/api/v1/webhooks/sales',
    source: 'Foodics POS',
    json: JSON.stringify(
      {
        orders: [
          {
            invoiceNumber: 'FDX-LIVE-301',
            customerName: 'Foodics Branch #1',
            sku: 'BEV-1001',
            quantity: 2,
            unitPrice: 17.5,
          },
          {
            invoiceNumber: 'FDX-LIVE-302',
            customerName: 'Foodics Branch #1',
            sku: 'BEV-1003',
            quantity: 1,
            unitPrice: 28.0,
          },
        ],
      },
      null,
      2
    ),
  },
  {
    label: 'Odoo Stock & Cost Sync',
    labelAr: 'مزامنة أرصدة وتكلفة Odoo',
    endpoint: '/api/v1/webhooks/inventory',
    source: 'Odoo ERP',
    json: JSON.stringify(
      {
        items: [
          { sku: 'BEV-1002', stock: 24, costPrice: 11.4 },
          { sku: 'PNT-2002', stock: 18, costPrice: 12.6 },
        ],
      },
      null,
      2
    ),
  },
  {
    label: 'Daftra Invoice Webhook',
    labelAr: 'فاتورة مبيعات من دفترة',
    endpoint: '/api/v1/webhooks/sales',
    source: 'Daftra (دفترة)',
    json: JSON.stringify(
      {
        invoiceNumber: 'DAF-WEB-778',
        customerName: 'شركة المدار للتوريد',
        sku: 'HOM-4001',
        quantity: 2,
        unitPrice: 36.0,
      },
      null,
      2
    ),
  },
];

export const IntegrationsHubModule: React.FC = () => {
  const {
    state,
    regenerateWebhookKey,
    toggleWebhookDailySync,
    ingestWebhookPayload,
    updateEcommerceConnector,
    syncEcommerceConnector,
    addToast,
  } = useStore();

  const isAr = state.settings.language === 'ar';

  const [activeTab, setActiveTab] = useState<'addon' | 'webhooks' | 'ecommerce'>('addon');
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<{ key: ModuleKey; label: string } | null>(null);

  // Webhook console state
  const [whEndpoint, setWhEndpoint] = useState<WebhookLog['endpoint']>('/api/v1/webhooks/sales');
  const [whSource, setWhSource] = useState('Foodics POS');
  const [whJson, setWhJson] = useState(SAMPLE_WEBHOOKS[0].json);
  const [whResponse, setWhResponse] = useState<{ ok: boolean; message: string } | null>(null);

  // Connector configuration modal
  const [configConnector, setConfigConnector] = useState<EcommerceConnector | null>(null);
  const [connUrl, setConnUrl] = useState('');
  const [connToken, setConnToken] = useState('');
  const [connAutoInv, setConnAutoInv] = useState(true);
  const [connAutoOrders, setConnAutoOrders] = useState(true);

  const handleCopy = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    addToast({
      type: 'info',
      title: isAr ? 'تم النسخ' : 'Copied to clipboard',
      description: label,
    });
  };

  const handleSendWebhook = () => {
    const result = ingestWebhookPayload(whEndpoint, whSource.trim() || 'External ERP', whJson);
    setWhResponse(result);
  };

  const openConnectorConfig = (conn: EcommerceConnector) => {
    setConfigConnector(conn);
    setConnUrl(conn.storeUrl);
    setConnToken(conn.apiToken);
    setConnAutoInv(conn.autoSyncInventory);
    setConnAutoOrders(conn.autoPullOrders);
  };

  const handleSaveConnector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configConnector) return;
    updateEcommerceConnector(configConnector.id, {
      storeUrl: connUrl.trim(),
      apiToken: connToken.trim(),
      connected: Boolean(connUrl.trim() && connToken.trim()),
      autoSyncInventory: connAutoInv,
      autoPullOrders: connAutoOrders,
    });
    setConfigConnector(null);
  };

  const curlSnippet = `curl -X POST https://api.ledgerflow.app${whEndpoint} \\
  -H "Authorization: Bearer ${state.settings.webhookApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${whJson.replace(/\s+/g, ' ').slice(0, 140)}'`;

  return (
    <div className="space-y-5">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('addon')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'addon'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {isAr ? 'نموذج الإضافة الذكية والتدقيق' : 'Smart Add-on & Audit PDF'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhooks')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'webhooks'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            {isAr ? 'بوابة Webhook / REST API' : 'Webhook & REST API'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ecommerce')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'ecommerce'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {isAr ? 'المتاجر الإلكترونية (سلة · زد · شوبيفاي)' : 'Salla · Zid · Shopify'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAuditModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <FileText className="w-3.5 h-3.5" />
          {isAr ? 'توليد تقرير التدقيق المجاني PDF' : 'Generate Instant Audit PDF'}
        </button>
      </div>

      {/* TAB 1: Smart Add-on Mode */}
      {activeTab === 'addon' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Instant Waste & Cash Audit Card */}
          <section className="lg:col-span-5 bg-white border border-slate-200/85 rounded-xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-5">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                {isAr ? 'أداة البيع الفوري (Demo)' : 'Instant Merchant Sales Demo'}
              </p>
              <h2 className="text-lg font-bold text-slate-900">
                {isAr
                  ? 'تقرير التدقيق المجاني الفوري للكاش والهدر (PDF)'
                  : 'Instant Waste & Cash Audit Report (PDF)'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? 'ارفع ملفات العميل من نظامه الحالي ثم ولّد تقريراً تنفيذياً بضغطة زر يكشف حجم الكاش المحبوس في المخزون الراكد، أرباح النفاد المفقودة، خسائر الهدر والتالف، وفارق تقييم FIFO مقابل المتوسط المرجح.'
                  : 'Upload a merchant’s existing CSV/Excel export and generate a one-click executive PDF quantifying locked working capital, stockout leakage, shrinkage losses, and FIFO vs Weighted Average impact.'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setAuditModalOpen(true)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4" />
                {isAr ? 'فتح ومعاينة تقرير التدقيق PDF' : 'Open & Export Audit PDF Report'}
              </button>
            </div>
          </section>

          {/* Smart CSV/Excel Importer */}
          <section className="lg:col-span-7 bg-white border border-slate-200/85 rounded-xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                {isAr ? 'الاستيراد الذكي ومطابقة الأعمدة تلقائياً' : 'Smart CSV / Excel Auto-Mapper'}
              </p>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                {isAr
                  ? 'اربط بيانات نظامك الحالي خلال ثوانٍ بدون استبداله'
                  : 'Import from Odoo, Daftra (دفترة), Foodics (فودكس), Salla, Zid & Shopify'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {isAr
                  ? 'يدعم الأعمدة العربية والإنجليزية مع مطابقة تلقائية للأصناف، المقاسات، الألوان، والمبيعات.'
                  : 'Automatically recognizes Arabic & English column schemas across major MENA retail & F&B ERPs.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 border border-slate-200 rounded-xl space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-900">
                  {isAr ? 'استيراد المخزون والأصناف' : 'Inventory & Variant Catalog Import'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isAr
                    ? 'قوالب جاهزة: Odoo · دفترة (عربي) · سلة · شوبيفاي'
                    : 'Auto-mapping presets: Odoo · Daftra (AR) · Salla · Shopify'}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setImportTarget({
                      key: 'inventory',
                      label: isAr ? 'المخزون والأصناف' : 'Inventory & Stock',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isAr ? 'رفع ملف مخزون' : 'Launch Inventory Importer'}
                </button>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-900">
                  {isAr ? 'استيراد فواتير المبيعات' : 'Sales & Order History Import'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isAr
                    ? 'قوالب جاهزة: فودكس (Foodics) · زد (Zid) · ملفات Excel/CSV'
                    : 'Auto-mapping presets: Foodics · Zid · Custom POS exports'}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setImportTarget({
                      key: 'sales',
                      label: isAr ? 'سجل المبيعات' : 'Sales History',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isAr ? 'رفع ملف مبيعات' : 'Launch Sales Importer'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Webhook / REST API Gateway */}
      {activeTab === 'webhooks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* API Credentials & Endpoints */}
          <section className="lg:col-span-5 bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {isAr ? 'بيانات الربط البرمجي (REST API / Webhooks)' : 'Webhook & REST API Gateway'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? 'استقبال بيانات المبيعات والأرصدة يومياً بشكل آلي بدون تدخل بشري'
                    : 'Receive automated daily or real-time sales & stock pushes from any ERP'}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 inline-flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                    {isAr ? 'مفتاح الربط (Bearer API Key)' : 'Bearer API Key'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          state.settings.webhookApiKey,
                          isAr ? 'تم نسخ مفتاح API بنجاح' : 'API Key copied'
                        )
                      }
                      className="text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 font-medium"
                    >
                      <Copy className="w-3 h-3" />
                      {isAr ? 'نسخ' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={regenerateWebhookKey}
                      className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {isAr ? 'تدوير' : 'Rotate'}
                    </button>
                  </div>
                </div>
                <p
                  dir="ltr"
                  className="font-mono text-[11px] text-slate-900 bg-white border border-slate-200 rounded px-2.5 py-1.5 truncate"
                >
                  {state.settings.webhookApiKey}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <p className="font-medium text-slate-700">
                  {isAr ? 'نقاط الاستقبال النشطة' : 'Active Ingestion Endpoints'}
                </p>
                <div className="font-mono text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-teal-700 font-semibold">POST</span>
                    <span className="flex-1 truncate text-slate-800">/api/v1/webhooks/sales</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-teal-700 font-semibold">POST</span>
                    <span className="flex-1 truncate text-slate-800">/api/v1/webhooks/inventory</span>
                  </div>
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer">
                <div>
                  <span className="font-medium text-slate-900 block">
                    {isAr ? 'تفعيل المزامنة اليومية التلقائية (11:55 مساءً)' : 'Automated Daily Nightly Sync (23:55)'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {isAr ? 'استقبال تقارير الإغلاق اليومي آلياً' : 'Auto-ingest end-of-day sales & inventory batches'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={state.settings.webhookAutoDailySync}
                  onChange={toggleWebhookDailySync}
                  className="w-4 h-4 accent-teal-700"
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">
                    {isAr ? 'مثال طلب cURL' : 'cURL Example'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        curlSnippet,
                        isAr ? 'تم نسخ أمر cURL' : 'cURL command copied'
                      )
                    }
                    className="text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {isAr ? 'نسخ الأمر' : 'Copy cURL'}
                  </button>
                </div>
                <pre
                  dir="ltr"
                  className="p-2.5 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono overflow-x-auto leading-relaxed"
                >
                  {curlSnippet}
                </pre>
              </div>
            </div>
          </section>

          {/* Interactive Live Webhook Simulator & Delivery Logs */}
          <section className="lg:col-span-7 space-y-5">
            <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {isAr ? 'اختبار استقبال Webhook مباشر' : 'Live Webhook Ingestion Console'}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_WEBHOOKS.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => {
                        setWhEndpoint(sample.endpoint);
                        setWhSource(sample.source);
                        setWhJson(sample.json);
                        setWhResponse(null);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
                    >
                      {isAr ? sample.labelAr : sample.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isAr ? 'مسار الاستقبال (Endpoint)' : 'Endpoint'}
                  </label>
                  <select
                    dir="ltr"
                    value={whEndpoint}
                    onChange={(e) => setWhEndpoint(e.target.value as WebhookLog['endpoint'])}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="/api/v1/webhooks/sales">POST /api/v1/webhooks/sales</option>
                    <option value="/api/v1/webhooks/inventory">POST /api/v1/webhooks/inventory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isAr ? 'النظام المصدر' : 'Source ERP System'}
                  </label>
                  <input
                    type="text"
                    value={whSource}
                    onChange={(e) => setWhSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <textarea
                rows={6}
                value={whJson}
                onChange={(e) => setWhJson(e.target.value)}
                className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                {whResponse ? (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      whResponse.ok ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {whResponse.ok ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {whResponse.message}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    {isAr
                      ? 'سيتم تحديث المبيعات والمخزون ومحرك القرارات فوراً.'
                      : 'Updates live sales, inventory balances, and Decision Engine immediately.'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSendWebhook}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isAr ? 'إرسال واستقبال البيانات' : 'Send Webhook Push'}
                </button>
              </div>
            </div>

            {/* Delivery Log Table */}
            <div className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="px-5 py-3.5 border-b border-slate-200/80">
                <h3 className="text-sm font-semibold text-slate-900">
                  {isAr ? 'سجل استقبال Webhooks' : 'Recent Webhook Deliveries'}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2.5 px-4 text-start">{isAr ? 'الوقت' : 'Timestamp'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'المصدر' : 'Source'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'المسار' : 'Endpoint'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'الملخص' : 'Summary'}</th>
                      <th className="py-2.5 px-4 text-end">{isAr ? 'الحالة' : 'HTTP'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.webhookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/75">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                          {formatDateTime(log.timestamp, state.settings.language)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {log.sourceSystem}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {log.endpoint}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{log.summary}</td>
                        <td className="py-2.5 px-4 text-end font-mono font-semibold whitespace-nowrap">
                          <span className={log.status === 200 ? 'text-emerald-700' : 'text-red-600'}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: E-Commerce Storefront Connectors (Salla, Zid, Shopify) */}
      {activeTab === 'ecommerce' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {state.ecommerceConnectors.map((conn) => (
              <div
                key={conn.id}
                className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {isAr ? conn.nameAr : `${conn.name} (${conn.nameAr})`}
                      </h3>
                      <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-[220px]">
                        {conn.storeUrl || (isAr ? 'غير مهيأ بعد' : 'Not configured')}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        conn.connected ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {conn.connected
                        ? isAr
                          ? 'متصل'
                          : 'Connected'
                        : isAr
                        ? 'غير متصل'
                        : 'Disconnected'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {isAr ? 'مزامنة المخزون التلقائية' : 'Auto-Sync Stock'}
                      </span>
                      <span className="font-medium text-slate-800">
                        {conn.autoSyncInventory ? (isAr ? 'مفعل' : 'On') : isAr ? 'معطل' : 'Off'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {isAr ? 'سحب الطلبات آلياً' : 'Auto-Pull Orders'}
                      </span>
                      <span className="font-medium text-slate-800">
                        {conn.autoPullOrders ? (isAr ? 'مفعل' : 'On') : isAr ? 'معطل' : 'Off'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {isAr ? 'الطلبات المتزامنة' : 'Synced Orders'}
                      </span>
                      <span className="font-mono font-semibold text-slate-900">
                        {conn.syncedOrdersCount}
                      </span>
                    </div>
                    {conn.lastSyncAt && (
                      <div className="flex justify-between pt-1 border-t border-slate-200/70">
                        <span className="text-slate-500">{isAr ? 'آخر مزامنة' : 'Last Sync'}</span>
                        <span className="text-[11px] text-slate-700">
                          {formatDateTime(conn.lastSyncAt, state.settings.language)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openConnectorConfig(conn)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    {isAr ? 'إعداد الربط' : 'Configure'}
                  </button>
                  <button
                    type="button"
                    onClick={() => syncEcommerceConnector(conn.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isAr ? 'مزامنة وسحب طلب' : 'Sync Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              {isAr
                ? 'عند الضغط على "مزامنة وسحب طلب"، يتم تحديث أرصدة المخزون الفعلي وسحب أحدث طلب إلكتروني مباشرة إلى سجل المبيعات وتحديث محرك القرارات.'
                : 'Clicking "Sync Now" pushes live inventory counts to the storefront and imports the latest online order directly into Sales History.'}
            </span>
            <span className="inline-flex items-center gap-1 text-teal-700 font-medium whitespace-nowrap">
              {isAr ? 'المزامنة متعددة القنوات نشطة' : 'Omnichannel Stock Sync Active'}
              <ArrowUpRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
            </span>
          </div>
        </div>
      )}

      {/* Storefront Config Modal */}
      <Modal
        open={Boolean(configConnector)}
        onClose={() => setConfigConnector(null)}
        title={
          configConnector
            ? `${isAr ? 'إعداد ربط' : 'Configure'} ${configConnector.name} (${configConnector.nameAr})`
            : ''
        }
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfigConnector(null)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              form="connector-form"
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              {isAr ? 'حفظ الاتصال' : 'Save Connection'}
            </button>
          </>
        }
      >
        <form id="connector-form" onSubmit={handleSaveConnector} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {isAr ? 'رابط المتجر' : 'Store URL'}
            </label>
            <input
              type="url"
              required
              value={connUrl}
              onChange={(e) => setConnUrl(e.target.value)}
              placeholder="https://store.salla.sa"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {isAr ? 'مفتاح API / Token' : 'Store API Access Token'}
            </label>
            <input
              type="text"
              required
              value={connToken}
              onChange={(e) => setConnToken(e.target.value)}
              placeholder="token_live_..."
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={connAutoInv}
              onChange={(e) => setConnAutoInv(e.target.checked)}
              className="w-4 h-4 accent-teal-700"
            />
            {isAr ? 'تحديث المخزون تلقائياً عند كل عملية بيع في الكاشير' : 'Auto-push stock updates on every POS sale'}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={connAutoOrders}
              onChange={(e) => setConnAutoOrders(e.target.checked)}
              className="w-4 h-4 accent-teal-700"
            />
            {isAr ? 'سحب الطلبات الجديدة وخصمها من المخزون تلقائياً' : 'Auto-pull incoming storefront orders & deduct stock'}
          </label>
        </form>
      </Modal>

      <AuditReportModal open={auditModalOpen} onClose={() => setAuditModalOpen(false)} />

      {importTarget && (
        <DataImportModal
          open={Boolean(importTarget)}
          onClose={() => setImportTarget(null)}
          moduleKey={importTarget.key}
          moduleLabel={importTarget.label}
        />
      )}
    </div>
  );
};
