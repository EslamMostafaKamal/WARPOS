import { CustomFieldDefinition, ModuleKey } from '../types';

export interface SystemFieldSpec {
  key: string;
  label: string;
  required?: boolean;
  example: string;
  aliases: string[];
}

export interface ErpImportPreset {
  id: 'odoo' | 'daftra' | 'foodics' | 'salla' | 'zid' | 'shopify';
  name: string;
  nameAr: string;
  module: ModuleKey;
  csv: string;
}

export const MODULE_SYSTEM_FIELDS: Record<ModuleKey, SystemFieldSpec[]> = {
  inventory: [
    {
      key: 'sku',
      label: 'SKU',
      required: true,
      example: 'APP-101',
      aliases: [
        'sku',
        'code',
        'item_code',
        'product_code',
        'default_code',
        'internal_reference',
        'variant_sku',
        'كود',
        'كود الصنف',
        'رمز المنتج',
        'الرمز',
      ],
    },
    {
      key: 'barcode',
      label: 'Barcode',
      example: 'APP101-BLK-M',
      aliases: ['barcode', 'ean', 'upc', 'gtin', 'variant_barcode', 'باركود', 'الباركود'],
    },
    {
      key: 'name',
      label: 'Product Name',
      required: true,
      example: 'Heavyweight Cotton Hoodie',
      aliases: [
        'name',
        'product',
        'product_name',
        'title',
        'item',
        'item_name',
        'اسم الصنف',
        'اسم المنتج',
        'المنتج',
        'الصنف',
      ],
    },
    {
      key: 'category',
      label: 'Category',
      example: 'Apparel',
      aliases: [
        'category',
        'dept',
        'department',
        'group',
        'categ_id',
        'product_type',
        'التصنيف',
        'الفئة',
        'القسم',
      ],
    },
    {
      key: 'costPrice',
      label: 'Cost Price',
      required: true,
      example: '18.50',
      aliases: [
        'cost',
        'cost_price',
        'unit_cost',
        'buy_price',
        'standard_price',
        'purchase_price',
        'التكلفة',
        'سعر الشراء',
        'سعر التكلفة',
      ],
    },
    {
      key: 'sellingPrice',
      label: 'Selling Price',
      required: true,
      example: '42.00',
      aliases: [
        'price',
        'selling_price',
        'retail_price',
        'sale_price',
        'list_price',
        'variant_price',
        'السعر',
        'سعر البيع',
      ],
    },
    {
      key: 'stock',
      label: 'Current Stock',
      required: true,
      example: '25',
      aliases: [
        'stock',
        'qty',
        'quantity',
        'on_hand',
        'qty_available',
        'inventory',
        'variant_inventory_qty',
        'الكمية',
        'الرصيد',
        'المخزون',
      ],
    },
    {
      key: 'reorderLevel',
      label: 'Reorder Level',
      example: '8',
      aliases: ['reorder', 'reorder_level', 'min_stock', 'threshold', 'حد الطلب', 'الحد الأدنى'],
    },
    { key: 'unit', label: 'Unit', example: 'each', aliases: ['unit', 'uom', 'الوحدة'] },
    {
      key: 'color',
      label: 'Variant Color (optional)',
      example: 'Black',
      aliases: ['color', 'colour', 'variant_color', 'option1_value', 'اللون'],
    },
    {
      key: 'size',
      label: 'Variant Size (optional)',
      example: 'M',
      aliases: ['size', 'variant_size', 'option2_value', 'المقاس', 'الحجم'],
    },
  ],
  customers: [
    {
      key: 'name',
      label: 'Customer Name',
      required: true,
      example: 'Maya Patel',
      aliases: ['name', 'customer', 'customer_name', 'full_name', 'العميل', 'اسم العميل'],
    },
    {
      key: 'phone',
      label: 'Phone Number',
      example: '+966 55 123 4567',
      aliases: ['phone', 'mobile', 'tel', 'phone_number', 'الجوال', 'الهاتف', 'رقم الهاتف'],
    },
    {
      key: 'email',
      label: 'Email',
      example: 'maya@example.com',
      aliases: ['email', 'email_address', 'البريد', 'البريد الإلكتروني'],
    },
    {
      key: 'address',
      label: 'Address',
      example: 'Riyadh, Olaya District',
      aliases: ['address', 'location', 'street', 'العنوان'],
    },
    {
      key: 'creditBalance',
      label: 'Credit Balance',
      example: '0',
      aliases: ['credit', 'credit_balance', 'balance', 'due', 'الرصيد المستحق', 'الآجل'],
    },
    {
      key: 'loyaltyPoints',
      label: 'Loyalty Points',
      example: '150',
      aliases: ['points', 'loyalty_points', 'rewards', 'النقاط', 'نقاط الولاء'],
    },
  ],
  suppliers: [
    {
      key: 'name',
      label: 'Supplier Name',
      required: true,
      example: 'Al-Riyadh Textile Mill',
      aliases: ['name', 'supplier', 'supplier_name', 'vendor', 'company', 'المورد', 'اسم المورد'],
    },
    {
      key: 'contactPerson',
      label: 'Contact Person',
      example: 'Khalid Al-Harbi',
      aliases: ['contact', 'contact_person', 'rep', 'المسؤول'],
    },
    {
      key: 'phone',
      label: 'Phone',
      example: '+966 11 455 0190',
      aliases: ['phone', 'tel', 'mobile', 'الهاتف', 'الجوال'],
    },
    { key: 'email', label: 'Email', example: 'orders@supplier.sa', aliases: ['email', 'البريد'] },
    { key: 'address', label: 'Address', example: 'Jeddah Industrial City', aliases: ['address', 'location', 'العنوان'] },
    {
      key: 'balanceOwed',
      label: 'Balance Owed',
      example: '250.00',
      aliases: ['balance', 'balance_owed', 'payable', 'owed', 'المستحق', 'الرصيد'],
    },
  ],
  expenses: [
    {
      key: 'date',
      label: 'Date (YYYY-MM-DD)',
      required: true,
      example: '2026-11-20',
      aliases: ['date', 'expense_date', 'day', 'التاريخ'],
    },
    {
      key: 'category',
      label: 'Category',
      required: true,
      example: 'Utilities',
      aliases: ['category', 'type', 'expense_category', 'التصنيف', 'البند'],
    },
    {
      key: 'vendor',
      label: 'Vendor / Payee',
      required: true,
      example: 'Saudi Electricity Co.',
      aliases: ['vendor', 'payee', 'merchant', 'name', 'المستفيد', 'الجهة'],
    },
    {
      key: 'amount',
      label: 'Amount',
      required: true,
      example: '145.50',
      aliases: ['amount', 'total', 'cost', 'value', 'المبلغ', 'القيمة'],
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      example: 'Bank Transfer',
      aliases: ['payment_method', 'method', 'payment', 'طريقة الدفع'],
    },
    {
      key: 'notes',
      label: 'Notes',
      example: 'Monthly store power bill',
      aliases: ['notes', 'memo', 'description', 'ملاحظات', 'الوصف'],
    },
  ],
  sales: [
    {
      key: 'invoiceNumber',
      label: 'Invoice Number',
      example: 'INV-ODOO-901',
      aliases: ['invoice', 'invoice_number', 'order_id', 'order_reference', 'receipt', 'رقم الفاتورة', 'رقم الطلب'],
    },
    {
      key: 'date',
      label: 'Date (YYYY-MM-DD)',
      required: true,
      example: '2026-11-18',
      aliases: ['date', 'sale_date', 'order_date', 'business_date', 'التاريخ', 'تاريخ الفاتورة'],
    },
    {
      key: 'customerName',
      label: 'Customer Name',
      example: 'Walk-in Customer',
      aliases: ['customer', 'customer_name', 'client', 'partner_id', 'العميل', 'اسم العميل'],
    },
    {
      key: 'sku',
      label: 'Product SKU',
      required: true,
      example: 'BEV-1001',
      aliases: ['sku', 'item_sku', 'product_sku', 'code', 'default_code', 'كود الصنف', 'رمز المنتج'],
    },
    {
      key: 'quantity',
      label: 'Quantity',
      required: true,
      example: '2',
      aliases: ['quantity', 'qty', 'units', 'product_uom_qty', 'الكمية'],
    },
    {
      key: 'unitPrice',
      label: 'Unit Price',
      required: true,
      example: '17.50',
      aliases: ['unit_price', 'price', 'rate', 'price_unit', 'سعر الوحدة', 'السعر'],
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      example: 'Card',
      aliases: ['payment_method', 'payment', 'method', 'طريقة الدفع'],
    },
  ],
  purchases: [
    {
      key: 'poNumber',
      label: 'PO Number',
      example: 'PO-OLD-12',
      aliases: ['po', 'po_number', 'order_number', 'رقم أمر الشراء'],
    },
    {
      key: 'date',
      label: 'Date (YYYY-MM-DD)',
      required: true,
      example: '2026-11-15',
      aliases: ['date', 'order_date', 'التاريخ'],
    },
    {
      key: 'supplierName',
      label: 'Supplier Name',
      required: true,
      example: 'Cascade Roasters Co.',
      aliases: ['supplier', 'supplier_name', 'vendor', 'المورد'],
    },
    {
      key: 'sku',
      label: 'Product SKU',
      required: true,
      example: 'BEV-1001',
      aliases: ['sku', 'product_sku', 'code', 'كود الصنف'],
    },
    {
      key: 'quantity',
      label: 'Quantity',
      required: true,
      example: '20',
      aliases: ['quantity', 'qty', 'units', 'الكمية'],
    },
    {
      key: 'unitCost',
      label: 'Unit Cost',
      required: true,
      example: '8.20',
      aliases: ['unit_cost', 'cost', 'price', 'التكلفة'],
    },
    {
      key: 'status',
      label: 'Status (Pending/Received)',
      example: 'Received',
      aliases: ['status', 'state', 'الحالة'],
    },
    { key: 'notes', label: 'Notes', example: 'Historical PO import', aliases: ['notes', 'memo', 'ملاحظات'] },
  ],
};

// Ready-to-test MENA & Global ERP Export Samples for Smart Add-on Mode
export const ERP_IMPORT_PRESETS: ErpImportPreset[] = [
  {
    id: 'odoo',
    name: 'Odoo Inventory',
    nameAr: 'أودو (Odoo) مخزون',
    module: 'inventory',
    csv: [
      'default_code,name,categ_id,standard_price,list_price,qty_available,barcode,color,size',
      'ODO-701,Premium Linen Abaya,Apparel,110,245,18,ODO701-BLK-M,Black,M',
      'ODO-701,Premium Linen Abaya,Apparel,110,245,14,ODO701-SND-L,Sand,L',
      'ODO-702,Saudi Qahwa Blend (500g),Coffee & Tea,28,62,40,ODO702,,',
    ].join('\n'),
  },
  {
    id: 'daftra',
    name: 'Daftra (دفترة) Arabic',
    nameAr: 'دفترة (Daftra) عربي',
    module: 'inventory',
    csv: [
      'كود الصنف,اسم الصنف,التصنيف,سعر الشراء,سعر البيع,الكمية,الباركود,اللون,المقاس',
      'DAF-801,ثوب صيفي قطن مصري,ملابس,95,210,22,DAF801-WHT-56,أبيض,56',
      'DAF-801,ثوب صيفي قطن مصري,ملابس,95,210,15,DAF801-CRM-58,كريمي,58',
      'DAF-802,حقيبة جلد طبيعي,إكسسوارات,140,320,9,DAF802-TAN-STD,بني,قياسي',
    ].join('\n'),
  },
  {
    id: 'foodics',
    name: 'Foodics (فودكس) Sales',
    nameAr: 'فودكس (Foodics) مبيعات',
    module: 'sales',
    csv: [
      'order_reference,business_date,customer_name,item_sku,quantity,unit_price,payment_method',
      'FDX-9901,2026-11-23,Walk-in Customer,BEV-1001,3,17.50,Card',
      'FDX-9902,2026-11-23,Elena Rostova,BEV-1003,2,28.00,Cash',
      'FDX-9903,2026-11-24,Nadia Al-Mansoor,PNT-2002,2,24.50,Card',
    ].join('\n'),
  },
  {
    id: 'salla',
    name: 'Salla (سلة) Catalog',
    nameAr: 'سلة (Salla) منتجات',
    module: 'inventory',
    csv: [
      'رمز المنتج,اسم المنتج,الفئة,سعر التكلفة,سعر البيع,المخزون,اللون,المقاس',
      'SAL-301,شال كشمير فاخر,إكسسوارات,65,165,16,كحلي,L',
      'SAL-302,مبخرة سيراميك يدوية,منزلية,42,115,24,رمادي,قياسي',
    ].join('\n'),
  },
  {
    id: 'zid',
    name: 'Zid (زد) Orders',
    nameAr: 'زد (Zid) طلبات',
    module: 'sales',
    csv: [
      'رقم الطلب,التاريخ,اسم العميل,رمز المنتج,الكمية,السعر,طريقة الدفع',
      'ZID-4410,2026-11-23,فهد القحطاني,HOM-4001,2,36.00,Card',
      'ZID-4411,2026-11-24,سارة العتيبي,ACC-5003,3,18.00,Card',
    ].join('\n'),
  },
  {
    id: 'shopify',
    name: 'Shopify Products',
    nameAr: 'شوبيفاي (Shopify) منتجات',
    module: 'inventory',
    csv: [
      'Variant SKU,Title,Product Type,Cost,Variant Price,Variant Inventory Qty,Option1 Value,Option2 Value',
      'SHP-501,Minimalist Oversized Tee,Apparel,32,89,28,Charcoal,M',
      'SHP-501,Minimalist Oversized Tee,Apparel,32,89,19,Ivory,L',
    ].join('\n'),
  },
];

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvOrJson(rawText: string): ParsedTable {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { headers: [], rows: [] };

  // JSON array support
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const headerSet = new Set<string>();
      for (const obj of arr) {
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach((k) => headerSet.add(k));
        }
      }
      const headers = Array.from(headerSet);
      const rows = arr
        .filter((obj) => obj && typeof obj === 'object')
        .map((obj) => {
          const rec: Record<string, string> = {};
          for (const h of headers) {
            const val = (obj as Record<string, unknown>)[h];
            rec[h] = val === undefined || val === null ? '' : String(val);
          }
          return rec;
        });
      return { headers, rows };
    } catch {
      // Fall through to CSV parser
    }
  }

  // RFC-4180 CSV parser supporting quotes, commas, tabs, semicolons, and Arabic UTF-8
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const next = trimmed[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === '\t' || ch === ';') {
      if (ch === ',' || (matrix.length === 0 && !trimmed.split('\n')[0].includes(','))) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      matrix.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      matrix.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    matrix.push(row);
  }

  const nonEmpty = matrix.filter((r) => r.some((c) => c.length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h, i) => h || `Column_${i + 1}`);
  const rows = nonEmpty.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = r[i] ?? '';
    });
    return rec;
  });

  return { headers, rows };
}

function normalizeHeaderToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

export function autoMapColumns(
  sourceHeaders: string[],
  moduleKey: ModuleKey,
  customFields: CustomFieldDefinition[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedSource = sourceHeaders.map((h) => ({
    raw: h,
    norm: normalizeHeaderToken(h),
  }));

  for (const field of MODULE_SYSTEM_FIELDS[moduleKey]) {
    const targets = [field.key, field.label, ...field.aliases].map(normalizeHeaderToken);
    const match = normalizedSource.find((s) => targets.includes(s.norm));
    if (match) {
      mapping[field.key] = match.raw;
    }
  }

  for (const cf of customFields) {
    const targets = [cf.key, cf.label].map(normalizeHeaderToken);
    const match = normalizedSource.find((s) => targets.includes(s.norm));
    if (match) {
      mapping[`custom:${cf.key}`] = match.raw;
    }
  }

  return mapping;
}

export function generateModuleCsvTemplate(
  moduleKey: ModuleKey,
  customFields: CustomFieldDefinition[]
): string {
  const systemFields = MODULE_SYSTEM_FIELDS[moduleKey];
  const headers = [
    ...systemFields.map((f) => f.label),
    ...customFields.map((cf) => cf.label),
  ];
  const sampleRow = [
    ...systemFields.map((f) => f.example),
    ...customFields.map((cf) =>
      cf.type === 'number' ? '100' : cf.type === 'date' ? '2026-12-31' : `Sample ${cf.label}`
    ),
  ];
  const escape = (val: string) =>
    val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;

  return `${headers.map(escape).join(',')}\n${sampleRow.map(escape).join(',')}\n`;
}
