import {
  AppModule,
  CurrencyCode,
  ExpenseCategory,
  ExpensePaymentMethod,
  Language,
  ModuleKey,
  PaymentMethod,
  SaleChannel,
  StockAdjustmentReason,
} from '../types';

export interface RegionalPreset {
  code: CurrencyCode;
  symbolEn: string;
  symbolAr: string;
  labelEn: string;
  labelAr: string;
  defaultVat: number;
  zatcaDefault: boolean;
}

export const REGIONAL_PRESETS: RegionalPreset[] = [
  {
    code: 'SAR',
    symbolEn: 'SAR ',
    symbolAr: 'ر.س ',
    labelEn: 'Saudi Riyal (SAR · 15% ZATCA VAT)',
    labelAr: 'ريال سعودي (ر.س · ضريبة 15% ZATCA)',
    defaultVat: 15,
    zatcaDefault: true,
  },
  {
    code: 'EGP',
    symbolEn: 'EGP ',
    symbolAr: 'ج.م ',
    labelEn: 'Egyptian Pound (EGP · 14% VAT)',
    labelAr: 'جنيه مصري (ج.م · ضريبة 14%)',
    defaultVat: 14,
    zatcaDefault: false,
  },
  {
    code: 'AED',
    symbolEn: 'AED ',
    symbolAr: 'د.إ ',
    labelEn: 'UAE Dirham (AED · 5% VAT)',
    labelAr: 'درهم إماراتي (د.إ · ضريبة 5%)',
    defaultVat: 5,
    zatcaDefault: false,
  },
  {
    code: 'USD',
    symbolEn: '$',
    symbolAr: '$',
    labelEn: 'US Dollar ($ · 8.5% Tax)',
    labelAr: 'دولار أمريكي ($ · ضريبة 8.5%)',
    defaultVat: 8.5,
    zatcaDefault: false,
  },
];

export const MODULE_TITLES: Record<AppModule, { en: string; ar: string }> = {
  dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
  pos: { en: 'POS Terminal', ar: 'نقطة البيع (الكاشير)' },
  inventory: { en: 'Inventory & Stock', ar: 'المخزون والأصناف' },
  purchases: { en: 'Purchases & Suppliers', ar: 'المشتريات والموردون' },
  customers: { en: 'Customers & Sales', ar: 'العملاء والمبيعات' },
  expenses: { en: 'Expenses & Accounting', ar: 'المصروفات والمحاسبة' },
  decisions: { en: 'Decision Engine', ar: 'محرك القرارات الرياضي' },
  integrations: { en: 'Smart Add-on & Integrations', ar: 'الإضافة الذكية والربط' },
  settings: { en: 'Settings', ar: 'الإعدادات والامتثال' },
};

export const MODULE_KEY_LABELS: Record<ModuleKey, { en: string; ar: string }> = {
  inventory: { en: 'Inventory & Stock', ar: 'المخزون والأصناف' },
  sales: { en: 'Sales History', ar: 'سجل المبيعات' },
  customers: { en: 'Customers', ar: 'العملاء' },
  suppliers: { en: 'Suppliers', ar: 'الموردون' },
  purchases: { en: 'Purchase Orders', ar: 'أوامر الشراء' },
  expenses: { en: 'Expenses', ar: 'المصروفات' },
};

const DICT: Record<string, { en: string; ar: string }> = {
  brand: { en: 'LedgerFlow', ar: 'ليدجر فلو' },
  brandTag: { en: 'Retail ERP & POS', ar: 'نظام التجزئة والمبيعات' },
  today: { en: 'Today', ar: 'اليوم' },
  decisions: { en: 'Decisions', ar: 'قرارات' },
  openPos: { en: 'Open POS', ar: 'فتح الكاشير' },
  salesHistory: { en: 'Sales History', ar: 'سجل المبيعات' },
  offlineMode: { en: 'Offline Mode', ar: 'وضع عدم الاتصال' },
  onlineMode: { en: 'Online', ar: 'متصل' },
  queuedInvoices: { en: 'queued', ar: 'بانتظار المزامنة' },
  syncNow: { en: 'Sync Now', ar: 'مزامنة الآن' },
  auditReport: { en: 'Free Cash & Waste Audit PDF', ar: 'تقرير تدقيق الكاش والهدر PDF' },
  todaysSales: { en: "Today's Sales", ar: 'مبيعات اليوم' },
  netProfit: { en: 'Net Profit', ar: 'صافي الربح' },
  totalOrders: { en: 'Total Orders', ar: 'إجمالي الطلبات' },
  lowStockAlerts: { en: 'Low-Stock Alerts', ar: 'تنبيهات نقص المخزون' },
  recentTransactions: { en: 'Recent Transactions', ar: 'أحدث الفواتير' },
  lowStockItems: { en: 'Low Stock Items', ar: 'أصناف قاربت على النفاد' },
  restock: { en: 'Restock', ar: 'إعادة توريد' },
  viewAll: { en: 'View All', ar: 'عرض الكل' },
  inventory: { en: 'Inventory', ar: 'المخزون' },
  newPosSale: { en: 'New POS Sale', ar: 'بيع جديد' },
  checkout: { en: 'Checkout', ar: 'إتمام الدفع' },
  cash: { en: 'Cash', ar: 'نقدي' },
  card: { en: 'Card', ar: 'بطاقة' },
  splitCredit: { en: 'Split / Credit', ar: 'آجل / مقسم' },
  bnpl: { en: 'BNPL / Installments', ar: 'تقسيط (BNPL)' },
  subtotal: { en: 'Subtotal', ar: 'المجموع الفرعي' },
  discounts: { en: 'Discounts', ar: 'الخصومات' },
  vat: { en: 'VAT', ar: 'ضريبة القيمة المضافة' },
  total: { en: 'Total', ar: 'الإجمالي' },
  printReceipt: { en: 'Print Receipt', ar: 'طباعة الفاتورة' },
  close: { en: 'Close', ar: 'إغلاق' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  save: { en: 'Save', ar: 'حفظ' },
  costingFifo: { en: 'FIFO (First-In, First-Out)', ar: 'الوارد أولاً يصرف أولاً (FIFO)' },
  costingAvg: { en: 'Weighted Average Cost', ar: 'متوسط التكلفة المرجح' },
  zatcaBadge: { en: 'ZATCA E-Invoice QR (Phase 1 TLV)', ar: 'فاتورة ضريبية مبسطة · ZATCA QR' },
};

export function t(key: string, lang: Language): string {
  const entry = DICT[key];
  if (!entry) return key;
  return lang === 'ar' ? entry.ar : entry.en;
}

export function tr(lang: Language, en: string, ar: string): string {
  return lang === 'ar' ? ar : en;
}

export function translatePaymentMethod(
  method: PaymentMethod | ExpensePaymentMethod | string,
  lang: Language
): string {
  if (lang !== 'ar') return method;
  switch (method) {
    case 'Cash':
      return 'نقدي';
    case 'Card':
      return 'بطاقة';
    case 'Split/Credit':
      return 'آجل / مقسم';
    case 'BNPL':
      return 'تقسيط BNPL';
    case 'Bank Transfer':
      return 'تحويل بنكي';
    default:
      return method;
  }
}

export function translateExpenseCategory(cat: ExpenseCategory | string, lang: Language): string {
  if (lang !== 'ar') return cat;
  switch (cat) {
    case 'Rent':
      return 'الإيجار';
    case 'Utilities':
      return 'المرافق والكهرباء';
    case 'Salaries':
      return 'الرواتب والأجور';
    case 'Supplies':
      return 'المستلزمات التشغيلية';
    case 'Marketing':
      return 'التسويق والإعلان';
    case 'Maintenance':
      return 'الصيانة';
    case 'Other':
      return 'مصروفات أخرى';
    default:
      return cat;
  }
}

export function translateSaleStatus(status: 'Completed' | 'Refunded' | string, lang: Language): string {
  if (lang !== 'ar') return status;
  if (status === 'Completed') return 'مكتملة';
  if (status === 'Refunded') return 'مسترجعة';
  return status;
}

export function translatePOStatus(status: 'Pending' | 'Received' | string, lang: Language): string {
  if (lang !== 'ar') return status;
  if (status === 'Pending') return 'قيد الانتظار';
  if (status === 'Received') return 'تم الاستلام';
  return status;
}

export function translateAdjustmentReason(
  reason: StockAdjustmentReason | string,
  lang: Language
): string {
  if (lang !== 'ar') return reason;
  switch (reason) {
    case 'Damaged':
      return 'تالف';
    case 'Expired':
      return 'منتهي الصلاحية';
    case 'Stock Count Correction':
      return 'تسوية جرد مخزون';
    case 'Shrinkage':
      return 'عجز / فقدان';
    case 'Purchase Order':
      return 'استلام أمر شراء';
    case 'Customer Refund':
      return 'مرتجع عميل';
    case 'Data Import':
      return 'استيراد بيانات';
    case 'Other':
      return 'أخرى';
    default:
      return reason;
  }
}

export function translateStockStatus(status: 'in' | 'low' | 'out', lang: Language): string {
  if (lang === 'ar') {
    if (status === 'out') return 'نفد المخزون';
    if (status === 'low') return 'مخزون منخفض';
    return 'متوفر';
  }
  if (status === 'out') return 'Out of Stock';
  if (status === 'low') return 'Low Stock';
  return 'In Stock';
}

export function translateChannel(channel: SaleChannel | string | undefined, lang: Language): string {
  if (!channel || channel === 'POS') return lang === 'ar' ? 'نقطة البيع' : 'POS';
  if (lang !== 'ar') return channel;
  switch (channel) {
    case 'Salla':
      return 'سلة';
    case 'Zid':
      return 'زد';
    case 'Shopify':
      return 'شوبيفاي';
    case 'Webhook API':
      return 'بوابة API';
    default:
      return channel;
  }
}
