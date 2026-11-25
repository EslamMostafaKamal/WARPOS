import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ClipboardList,
  Package,
  Upload,
  Barcode,
  Layers,
} from 'lucide-react';
import { Product, ProductVariant, StockAdjustmentReason } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatCurrency, formatDateTime, generateId, getStockStatus } from '../../utils/format';
import {
  tr,
  translateAdjustmentReason,
  translateStockStatus,
} from '../../utils/i18n';
import { generateBaseBarcode, generateVariantBarcode } from '../../utils/barcode';
import { Modal } from '../ui/Modal';
import { BarcodeSvg } from '../ui/BarcodeSvg';
import { DataImportModal } from '../ui/DataImportModal';

const ADJUSTMENT_REASONS: StockAdjustmentReason[] = [
  'Stock Count Correction',
  'Damaged',
  'Expired',
  'Shrinkage',
  'Other',
];

const EMPTY_PRODUCT_FORM = {
  id: undefined as string | undefined,
  name: '',
  sku: '',
  barcode: '',
  category: 'Coffee & Tea',
  unit: 'each',
  costPrice: '',
  sellingPrice: '',
  stock: '',
  reorderLevel: '5',
  variants: [] as ProductVariant[],
  customFields: {} as Record<string, string>,
};

export const InventoryModule: React.FC = () => {
  const { state, saveProduct, deleteProduct, adjustStock } = useStore();
  const sym = state.settings.currencySymbol;
  const lang = state.settings.language;
  const customSchema = state.moduleSchemas.inventory ?? [];

  const [activeTab, setActiveTab] = useState<'catalog' | 'audit'>('catalog');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [formError, setFormError] = useState('');

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustVariantId, setAdjustVariantId] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'increase' | 'decrease'>('decrease');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState<StockAdjustmentReason>('Damaged');
  const [adjustNotes, setAdjustNotes] = useState('');

  const [barcodeTarget, setBarcodeTarget] = useState<Product | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(state.products.map((p) => p.category))).sort();
    return ['All', ...unique];
  }, [state.products]);

  const inventoryStats = useMemo(() => {
    let costValuation = 0;
    let lowCount = 0;
    let outCount = 0;
    let variantCount = 0;
    for (const p of state.products) {
      costValuation += p.costPrice * p.stock;
      variantCount += p.variants?.length ?? 0;
      const st = getStockStatus(p.stock, p.reorderLevel);
      if (st === 'out') outCount++;
      else if (st === 'low') lowCount++;
    }
    return {
      totalSkus: state.products.length,
      variantCount,
      costValuation,
      lowCount,
      outCount,
    };
  }, [state.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.products.filter((p) => {
      const catOk = categoryFilter === 'All' || p.category === categoryFilter;
      if (!catOk) return false;
      const status = getStockStatus(p.stock, p.reorderLevel);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!q) return true;
      const customMatch = Object.values(p.customFields ?? {}).some((v) =>
        v.toLowerCase().includes(q)
      );
      const variantMatch = p.variants?.some(
        (v) =>
          v.barcode.toLowerCase().includes(q) ||
          v.color.toLowerCase().includes(q) ||
          v.size.toLowerCase().includes(q)
      );
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        customMatch ||
        Boolean(variantMatch)
      );
    });
  }, [state.products, search, categoryFilter, statusFilter]);

  const openAddProduct = () => {
    setFormError('');
    const sku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    setProductForm({
      ...EMPTY_PRODUCT_FORM,
      sku,
      barcode: generateBaseBarcode(sku),
      variants: [],
      customFields: {},
    });
    setProductModalOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setFormError('');
    setProductForm({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || generateBaseBarcode(product.sku),
      category: product.category,
      unit: product.unit,
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      stock: product.stock.toString(),
      reorderLevel: product.reorderLevel.toString(),
      variants: product.variants ? product.variants.map((v) => ({ ...v })) : [],
      customFields: { ...(product.customFields ?? {}) },
    });
    setProductModalOpen(true);
  };

  const addVariantRow = () => {
    const baseSku = productForm.sku.trim().toUpperCase() || 'ITEM';
    const color = 'Black';
    const size = 'M';
    const next: ProductVariant = {
      id: generateId('var'),
      color,
      size,
      sku: `${baseSku}-BLK-M`,
      barcode: generateVariantBarcode(baseSku, color, size),
      stock: 5,
    };
    setProductForm((prev) => ({ ...prev, variants: [...prev.variants, next] }));
  };

  const updateVariantRow = (idx: number, patch: Partial<ProductVariant>) => {
    setProductForm((prev) => {
      const baseSku = prev.sku.trim().toUpperCase() || 'ITEM';
      const updated = prev.variants.map((v, i) => {
        if (i !== idx) return v;
        const merged = { ...v, ...patch };
        if (patch.color !== undefined || patch.size !== undefined) {
          merged.barcode = generateVariantBarcode(baseSku, merged.color, merged.size);
          merged.sku = merged.barcode;
        }
        return merged;
      });
      return { ...prev, variants: updated };
    });
  };

  const removeVariantRow = (idx: number) => {
    setProductForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const name = productForm.name.trim();
    const sku = productForm.sku.trim().toUpperCase();
    const category = productForm.category.trim() || 'General';
    const costPrice = parseFloat(productForm.costPrice);
    const sellingPrice = parseFloat(productForm.sellingPrice);
    const hasVariants = productForm.variants.length > 0;
    const stock = hasVariants
      ? productForm.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0)
      : parseInt(productForm.stock, 10);
    const reorderLevel = parseInt(productForm.reorderLevel, 10);

    if (!name || !sku) {
      setFormError(tr(lang, 'Product name and SKU are required.', 'اسم المنتج والرمز SKU مطلوبان.'));
      return;
    }
    if (isNaN(costPrice) || costPrice < 0 || isNaN(sellingPrice) || sellingPrice < 0) {
      setFormError(
        tr(lang, 'Please enter valid cost and selling prices.', 'يرجى إدخال أسعار تكلفة وبيع صحيحة.')
      );
      return;
    }
    if (isNaN(stock) || stock < 0 || isNaN(reorderLevel) || reorderLevel < 0) {
      setFormError(
        tr(
          lang,
          'Stock and reorder level must be 0 or greater.',
          'الرصيد وحد إعادة الطلب يجب أن يكونا صفراً أو أكبر.'
        )
      );
      return;
    }

    saveProduct({
      id: productForm.id,
      name,
      sku,
      barcode: productForm.barcode.trim() || generateBaseBarcode(sku),
      category,
      unit: productForm.unit.trim() || 'each',
      costPrice,
      sellingPrice,
      stock,
      reorderLevel,
      variants: hasVariants ? productForm.variants : undefined,
      customFields: productForm.customFields,
    });
    setProductModalOpen(false);
  };

  const openAdjustModal = (product?: Product) => {
    const target = product ?? state.products[0];
    if (!target) return;
    setAdjustProductId(target.id);
    setAdjustVariantId(target.variants?.[0]?.id ?? '');
    setAdjustDirection('decrease');
    setAdjustQty('1');
    setAdjustReason('Damaged');
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  const selectedAdjustProduct = state.products.find((p) => p.id === adjustProductId);
  const selectedAdjustVariant = selectedAdjustProduct?.variants?.find(
    (v) => v.id === adjustVariantId
  );
  const currentAdjustBaseStock = selectedAdjustVariant
    ? selectedAdjustVariant.stock
    : selectedAdjustProduct?.stock ?? 0;
  const parsedAdjustQty = Math.max(0, parseInt(adjustQty, 10) || 0);
  const signedDelta = adjustDirection === 'increase' ? parsedAdjustQty : -parsedAdjustQty;
  const projectedStock = Math.max(0, currentAdjustBaseStock + signedDelta);

  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustProduct || parsedAdjustQty <= 0) return;
    adjustStock(
      selectedAdjustProduct.id,
      signedDelta,
      adjustReason,
      adjustNotes,
      selectedAdjustVariant?.id
    );
    setAdjustModalOpen(false);
  };

  const liveMargin = (() => {
    const c = parseFloat(productForm.costPrice);
    const s = parseFloat(productForm.sellingPrice);
    if (!isNaN(c) && !isNaN(s) && s > 0) {
      return (((s - c) / s) * 100).toFixed(1);
    }
    return null;
  })();

  return (
    <div className="space-y-5">
      {/* Top Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Products & Variants', 'الأصناف والمتغيرات')}
          </p>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1.5">
            {inventoryStats.totalSkus}{' '}
            <span className="text-xs font-normal text-slate-500 font-sans">
              ({inventoryStats.variantCount} {tr(lang, 'variants', 'مقاس/لون')})
            </span>
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 font-medium">
              {tr(lang, 'Inventory Value (Cost)', 'قيمة المخزون بالتكلفة')}
            </p>
            <span className="text-[11px] font-mono font-semibold text-teal-700">
              {state.settings.costingMethod === 'fifo' ? 'FIFO' : tr(lang, 'W-AVG', 'متوسط مرجح')}
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1.5">
            {formatCurrency(inventoryStats.costValuation, sym)}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Low Stock SKUs', 'أصناف منخفضة الرصيد')}
          </p>
          <p className="text-xl font-bold font-mono text-amber-600 tabular-nums mt-1.5">
            {inventoryStats.lowCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Out of Stock SKUs', 'أصناف نافدة')}
          </p>
          <p className="text-xl font-bold font-mono text-red-600 tabular-nums mt-1.5">
            {inventoryStats.outCount}
          </p>
        </div>
      </div>

      {/* Sub-navigation & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            {tr(lang, 'Product Catalog', 'دليل المنتجات')} ({state.products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {tr(lang, 'Stock Audit Log', 'سجل حركات المخزون')} ({state.stockAdjustments.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            {tr(lang, 'Import / Format', 'استيراد / تخصيص')}
          </button>
          <button
            type="button"
            onClick={() => openAdjustModal()}
            disabled={state.products.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {tr(lang, 'Adjust Stock', 'تسوية المخزون')}
          </button>
          <button
            type="button"
            onClick={openAddProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            {tr(lang, 'Add Product', 'إضافة منتج')}
          </button>
        </div>
      </div>

      {activeTab === 'catalog' ? (
        <div className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr(
                  lang,
                  'Search SKU, barcode, product, variant color/size, or custom field...',
                  'ابحث بالرمز SKU، الباركود، اسم المنتج، اللون/المقاس، أو الحقول المخصصة...'
                )}
                className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-600"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? tr(lang, 'All Categories', 'جميع التصنيفات') : cat}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: tr(lang, 'All', 'الكل') },
                  { id: 'in', label: tr(lang, 'In Stock', 'متوفر') },
                  { id: 'low', label: tr(lang, 'Low Stock', 'منخفض') },
                  { id: 'out', label: tr(lang, 'Out of Stock', 'نافد') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatusFilter(opt.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === opt.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredProducts.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {tr(lang, 'No products match your current filter.', 'لا توجد منتجات تطابق التصفية الحالية.')}
              </div>
            ) : (
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-4 text-start">{tr(lang, 'SKU / Barcode', 'الرمز / الباركود')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Product Name', 'اسم المنتج')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Category', 'التصنيف')}</th>
                    {customSchema.slice(0, 2).map((cf) => (
                      <th key={cf.id} className="py-3 px-3 text-start whitespace-nowrap">
                        {cf.label}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-end">{tr(lang, 'Cost', 'التكلفة')}</th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Price', 'سعر البيع')}</th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Stock', 'الرصيد')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Status', 'الحالة')}</th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Actions', 'إجراءات')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product.stock, product.reorderLevel);
                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-800">
                            {product.sku}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {product.barcode}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 text-sm">
                            {product.name}
                          </div>
                          {product.variants && product.variants.length > 0 && (
                            <div className="text-[11px] text-teal-800 mt-0.5 flex items-center gap-1">
                              <Layers className="w-3 h-3 shrink-0" />
                              {product.variants
                                .map((v) => `${v.color}/${v.size} (${v.stock})`)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {product.category}
                        </td>
                        {customSchema.slice(0, 2).map((cf) => (
                          <td
                            key={cf.id}
                            className="py-3 px-3 text-slate-600 whitespace-nowrap"
                          >
                            {product.customFields?.[cf.key] || '—'}
                          </td>
                        ))}
                        <td className="py-3 px-4 text-end font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {formatCurrency(product.costPrice, sym)}
                        </td>
                        <td className="py-3 px-4 text-end font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(product.sellingPrice, sym)}
                        </td>
                        <td className="py-3 px-4 text-end font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {product.stock}
                          <span className="text-[10px] text-slate-400 font-normal ms-1">
                            /{product.reorderLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold text-xs ${
                              status === 'out'
                                ? 'text-red-600'
                                : status === 'low'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {translateStockStatus(status, lang)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-end whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setBarcodeTarget(product)}
                              title={tr(lang, 'View Barcodes & FIFO Layers', 'عرض الباركود وطبقات FIFO')}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                              aria-label={`${tr(lang, 'View barcodes for', 'عرض باركود')} ${product.name}`}
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openAdjustModal(product)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            >
                              {tr(lang, 'Adjust', 'تسوية')}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditProduct(product)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              aria-label={`${tr(lang, 'Edit', 'تعديل')} ${product.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(product)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              aria-label={`${tr(lang, 'Delete', 'حذف')} ${product.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-4 border-b border-slate-200/80">
            <h2 className="text-sm font-bold text-slate-900">
              {tr(lang, 'Stock Adjustment Audit Log', 'سجل تدقيق حركات المخزون')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr(
                lang,
                'Chronological record of manual stock adjustments, imports, PO receipts, and refund restorations',
                'سجل زمني كامل لتسويات المخزون اليدوية، الاستيراد، استلام أوامر الشراء، ومرتجعات العملاء'
              )}
            </p>
          </div>
          <div className="overflow-x-auto">
            {state.stockAdjustments.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {tr(lang, 'No stock adjustments logged yet.', 'لا توجد حركات تسوية مسجلة بعد.')}
              </div>
            ) : (
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-4 text-start">{tr(lang, 'Date & Time', 'التاريخ والوقت')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Product', 'المنتج')}</th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Change', 'التغيير')}</th>
                    <th className="py-3 px-4 text-end">{tr(lang, 'Stock Level', 'تغيّر الرصيد')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Reason', 'السبب')}</th>
                    <th className="py-3 px-4 text-start">{tr(lang, 'Notes', 'ملاحظات')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {state.stockAdjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                        {formatDateTime(adj.date, lang)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{adj.productName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{adj.sku}</div>
                      </td>
                      <td
                        className={`py-3 px-4 text-end font-mono font-semibold tabular-nums whitespace-nowrap ${
                          adj.delta >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {adj.delta >= 0 ? `+${adj.delta}` : adj.delta}
                      </td>
                      <td className="py-3 px-4 text-end font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {adj.previousStock} → {adj.newStock}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                        {translateAdjustmentReason(adj.reason, lang)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">{adj.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={
          productForm.id
            ? tr(lang, 'Edit Product & Variants', 'تعديل المنتج والمتغيرات')
            : tr(lang, 'Add New Product', 'إضافة منتج جديد')
        }
        subtitle={tr(
          lang,
          'Configure base SKU, Color/Size variant barcodes, pricing, and custom fields',
          'إعداد الرمز الأساسي، باركود الألوان والمقاسات، الأسعار، والحقول المخصصة'
        )}
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setProductModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="product-form"
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              {productForm.id
                ? tr(lang, 'Save Changes', 'حفظ التعديلات')
                : tr(lang, 'Create Product', 'إنشاء المنتج')}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSaveProduct} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Product Name *', 'اسم المنتج *')}
            </label>
            <input
              type="text"
              required
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'SKU *', 'الرمز SKU *')}
              </label>
              <input
                type="text"
                required
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Base Barcode', 'الباركود الأساسي')}
              </label>
              <input
                type="text"
                value={productForm.barcode}
                onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Category *', 'التصنيف *')}
              </label>
              <input
                type="text"
                list="category-suggestions"
                required
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
              <datalist id="category-suggestions">
                {categories
                  .filter((c) => c !== 'All')
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, `Cost Price (${sym}) *`, `سعر التكلفة (${sym.trim()}) *`)}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={productForm.costPrice}
                onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">
                  {tr(lang, `Selling Price (${sym}) *`, `سعر البيع (${sym.trim()}) *`)}
                </label>
                {liveMargin !== null && (
                  <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                    {tr(lang, 'Margin', 'الهامش')} {liveMargin}%
                  </span>
                )}
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={productForm.sellingPrice}
                onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {productForm.variants.length > 0
                  ? tr(lang, 'Total Stock (Auto)', 'إجمالي الرصيد (تلقائي)')
                  : tr(lang, 'Stock *', 'الرصيد *')}
              </label>
              <input
                type="number"
                min={0}
                required={productForm.variants.length === 0}
                disabled={productForm.variants.length > 0}
                value={
                  productForm.variants.length > 0
                    ? productForm.variants.reduce((s, v) => s + v.stock, 0)
                    : productForm.stock
                }
                onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Reorder Level *', 'حد إعادة الطلب *')}
              </label>
              <input
                type="number"
                min={0}
                required
                value={productForm.reorderLevel}
                onChange={(e) => setProductForm({ ...productForm, reorderLevel: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Unit', 'الوحدة')}
              </label>
              <input
                type="text"
                value={productForm.unit}
                onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Color & Size Variants Section */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/60">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  {tr(lang, 'Color & Size Variants (Unique Barcodes)', 'الألوان والمقاسات (باركود مستقل لكل متغير)')}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {tr(
                    lang,
                    'Each variant generates a unique barcode printed on receipts & scannable at POS',
                    'كل لون ومقاس يحصل على باركود مستقل يُطبع على الفاتورة ويُمسح في الكاشير'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={addVariantRow}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                {tr(lang, 'Add Variant', 'إضافة مقاس/لون')}
              </button>
            </div>

            {productForm.variants.length > 0 && (
              <div className="space-y-2">
                {productForm.variants.map((v, idx) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white border border-slate-200 rounded-lg p-2.5"
                  >
                    <input
                      type="text"
                      value={v.color}
                      onChange={(e) => updateVariantRow(idx, { color: e.target.value })}
                      placeholder={tr(lang, 'Color', 'اللون')}
                      className="sm:col-span-3 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={v.size}
                      onChange={(e) => updateVariantRow(idx, { size: e.target.value })}
                      placeholder={tr(lang, 'Size', 'المقاس')}
                      className="sm:col-span-2 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={v.barcode}
                      onChange={(e) => updateVariantRow(idx, { barcode: e.target.value })}
                      placeholder={tr(lang, 'Unique Barcode', 'الباركود')}
                      className="sm:col-span-4 px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                    />
                    <input
                      type="number"
                      min={0}
                      value={v.stock}
                      onChange={(e) =>
                        updateVariantRow(idx, { stock: Math.max(0, parseInt(e.target.value, 10) || 0) })
                      }
                      placeholder={tr(lang, 'Qty', 'الكمية')}
                      className="sm:col-span-2 px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariantRow(idx)}
                      className="sm:col-span-1 p-1 text-slate-400 hover:text-red-600 justify-self-end"
                      aria-label={tr(lang, 'Remove variant', 'حذف المتغير')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Business Fields */}
          {customSchema.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {customSchema.map((cf) => (
                <div key={cf.id}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {cf.label}
                  </label>
                  <input
                    type={cf.type}
                    value={productForm.customFields[cf.key] ?? ''}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        customFields: { ...prev.customFields, [cf.key]: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              ))}
            </div>
          )}
        </form>
      </Modal>

      {/* Barcode Labels & Cost Layers Modal */}
      <Modal
        open={Boolean(barcodeTarget)}
        onClose={() => setBarcodeTarget(null)}
        title={`${tr(lang, 'Barcode Labels', 'ملصقات الباركود')} · ${barcodeTarget?.name ?? ''}`}
        subtitle={tr(
          lang,
          'Unique Code128 scannable barcodes and active FIFO/W-AVG cost batches',
          'باركود Code128 مستقل للمسح وطبقات التكلفة الفعلية (FIFO / متوسط مرجح)'
        )}
        maxWidthClass="max-w-lg"
        footer={
          <button
            type="button"
            onClick={() => setBarcodeTarget(null)}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
          >
            {tr(lang, 'Close', 'إغلاق')}
          </button>
        }
      >
        {barcodeTarget && (
          <div className="space-y-3">
            {barcodeTarget.variants && barcodeTarget.variants.length > 0 ? (
              barcodeTarget.variants.map((v) => (
                <div
                  key={v.id}
                  className="p-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {v.color} / {v.size}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {formatCurrency(v.priceOverride ?? barcodeTarget.sellingPrice, sym)} ·{' '}
                      {tr(lang, 'Stock', 'الرصيد')} {v.stock}
                    </p>
                  </div>
                  <BarcodeSvg value={v.barcode} height={36} showText />
                </div>
              ))
            ) : (
              <div className="p-5 border border-slate-200 rounded-xl flex flex-col items-center gap-2 bg-white">
                <p className="text-sm font-semibold text-slate-900">{barcodeTarget.name}</p>
                <p className="text-xs text-slate-500 font-mono">
                  {formatCurrency(barcodeTarget.sellingPrice, sym)}
                </p>
                <BarcodeSvg value={barcodeTarget.barcode || barcodeTarget.sku} height={44} showText />
              </div>
            )}

            {/* FIFO Cost Layers Breakdown */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900">
                  {tr(lang, 'Cost Layers', 'طبقات التكلفة')} (
                  {state.settings.costingMethod === 'fifo'
                    ? tr(lang, 'FIFO Active', 'نظام FIFO نشط')
                    : tr(lang, 'Weighted Average Active', 'المتوسط المرجح نشط')}
                  )
                </span>
                <span className="font-mono text-slate-500">
                  {tr(lang, 'W-Avg:', 'المتوسط:')} {formatCurrency(barcodeTarget.costPrice, sym)}
                </span>
              </div>
              {barcodeTarget.costLayers && barcodeTarget.costLayers.length > 0 ? (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs tabular-nums">
                  {barcodeTarget.costLayers.map((layer, idx) => (
                    <div
                      key={layer.id}
                      className="px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-medium text-slate-800">
                          {tr(lang, 'Batch', 'دفعة')} #{idx + 1} · {layer.sourceRef}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          {formatDateTime(layer.date, lang)}
                        </span>
                      </div>
                      <div className="text-end font-mono">
                        <span className="font-semibold text-slate-900">
                          {layer.quantityRemaining} × {formatCurrency(layer.unitCost, sym)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {tr(lang, 'No active stock cost layers (0 units).', 'لا توجد طبقات تكلفة نشطة (الرصيد 0).')}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title={tr(lang, 'Manual Stock Adjustment', 'تسوية المخزون اليدوية')}
        subtitle={tr(
          lang,
          'Log damaged, expired, or cycle-count stock corrections with audit trail',
          'تسجيل التالف أو المنتهي الصلاحية أو فروقات الجرد مع توثيق كامل في سجل التدقيق'
        )}
        footer={
          <>
            <button
              type="button"
              onClick={() => setAdjustModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="adjust-form"
              disabled={!selectedAdjustProduct || parsedAdjustQty <= 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg"
            >
              {tr(lang, 'Apply Adjustment', 'اعتماد التسوية')}
            </button>
          </>
        }
      >
        <form id="adjust-form" onSubmit={handleConfirmAdjustment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Product', 'المنتج')}
            </label>
            <select
              value={adjustProductId}
              onChange={(e) => {
                const nextProd = state.products.find((p) => p.id === e.target.value);
                setAdjustProductId(e.target.value);
                setAdjustVariantId(nextProd?.variants?.[0]?.id ?? '');
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            >
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} ({tr(lang, 'Stock', 'الرصيد')}: {p.stock})
                </option>
              ))}
            </select>
          </div>

          {selectedAdjustProduct?.variants && selectedAdjustProduct.variants.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Color / Size Variant', 'المتغير (اللون / المقاس)')}
              </label>
              <select
                value={adjustVariantId}
                onChange={(e) => setAdjustVariantId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              >
                {selectedAdjustProduct.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.color} / {v.size} ({v.barcode}) — {tr(lang, 'Stock', 'الرصيد')}: {v.stock}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Adjustment Type', 'نوع الحركة')}
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAdjustDirection('decrease')}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    adjustDirection === 'decrease'
                      ? 'bg-white text-red-700 shadow-xs font-semibold'
                      : 'text-slate-600'
                  }`}
                >
                  {tr(lang, 'Decrease (-)', 'خصم (-)')}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustDirection('increase')}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    adjustDirection === 'increase'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-slate-600'
                  }`}
                >
                  {tr(lang, 'Increase (+)', 'إضافة (+)')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Quantity', 'الكمية')}
              </label>
              <input
                type="number"
                min={1}
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          {selectedAdjustProduct && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs tabular-nums">
              <span className="text-slate-600">{tr(lang, 'Resulting Stock', 'الرصيد بعد التسوية')}</span>
              <span className="font-mono font-semibold text-slate-900">
                {currentAdjustBaseStock} → {projectedStock}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Reason', 'السبب')}
            </label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value as StockAdjustmentReason)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {translateAdjustmentReason(r, lang)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Notes', 'ملاحظات')}
            </label>
            <textarea
              rows={2}
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder={tr(lang, 'Explain why stock is being adjusted...', 'اذكر سبب تسوية المخزون...')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={tr(lang, 'Remove Product', 'حذف المنتج')}
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteTarget) deleteProduct(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
            >
              {tr(lang, 'Delete Product', 'تأكيد الحذف')}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          {tr(lang, 'Are you sure you want to delete', 'هل أنت متأكد من حذف المنتج')}{' '}
          <strong className="text-slate-900">{deleteTarget?.name}</strong> ({deleteTarget?.sku})؟{' '}
          {tr(
            lang,
            'Past invoices will retain their historical line items.',
            'ستحتفظ الفواتير السابقة بسجل البنود التاريخي.'
          )}
        </p>
      </Modal>

      {/* Universal Import & Schema Modal */}
      <DataImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        moduleKey="inventory"
        moduleLabel={tr(lang, 'Inventory & Stock', 'المخزون والأصناف')}
      />
    </div>
  );
};
