import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Split,
  Percent,
  Tag,
  User,
  ShoppingCart,
  AlertCircle,
  ScanBarcode,
  Award,
  UserPlus,
  Layers,
  Wifi,
  WifiOff,
  RefreshCw,
  CalendarClock,
} from 'lucide-react';
import {
  BNPLProvider,
  DiscountType,
  LoyaltyTier,
  PaymentMethod,
  Product,
  ProductVariant,
  Sale,
  SaleItem,
} from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, getStockStatus, roundMoney } from '../../utils/format';
import { tr } from '../../utils/i18n';
import { Modal } from '../ui/Modal';
import { ReceiptModal } from '../ui/ReceiptModal';
import { BarcodeSvg } from '../ui/BarcodeSvg';

interface CartEntry {
  key: string;
  productId: string;
  variantId?: string;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
}

export const POSTerminalModule: React.FC = () => {
  const {
    state,
    isOnline,
    offlineQueueCount,
    toggleSimulatedOffline,
    syncOfflineInvoices,
    completeSale,
    quickEnrollCustomer,
    addToast,
  } = useStore();
  const { currentUser, hasPermission } = useAuth();
  const canGiveDiscounts = hasPermission('canGiveDiscounts');
  const sym = state.settings.currencySymbol;
  const taxRate = state.settings.taxRate;
  const loyaltyCfg = state.settings.loyalty;
  const lang = state.settings.language;
  const isAr = lang === 'ar';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customerId, setCustomerId] = useState<string>(
    state.customers.find((c) => c.isWalkIn)?.id ?? state.customers[0]?.id ?? 'cust-walkin'
  );
  const [orderDiscountType, setOrderDiscountType] = useState<DiscountType>('percent');
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0);
  const [expandedItemDiscountKey, setExpandedItemDiscountKey] = useState<string | null>(null);

  // Loyalty lookup & redemption
  const [loyaltyLookup, setLoyaltyLookup] = useState('');
  const [selectedLoyaltyTierId, setSelectedLoyaltyTierId] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollName, setEnrollName] = useState('');
  const [enrollPhone, setEnrollPhone] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');

  // Hardware Barcode Scanner state
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [simScanOpen, setSimScanOpen] = useState(false);
  const scanBufferRef = useRef<{ chars: string; lastTs: number }>({ chars: '', lastTs: 0 });

  // Variant Picker Modal
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTenderedStr, setCashTenderedStr] = useState('');
  const [splitPaidStr, setSplitPaidStr] = useState('');
  const [bnplProvider, setBnplProvider] = useState<BNPLProvider>('Tabby');
  const [bnplMonths, setBnplMonths] = useState<number>(4);
  const [bnplDownPaymentStr, setBnplDownPaymentStr] = useState('');
  const [bnplReference, setBnplReference] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState<Sale | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(state.products.map((p) => p.category))).sort();
    return ['All', ...unique];
  }, [state.products]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of state.products) map.set(p.id, p);
    return map;
  }, [state.products]);

  const barcodeIndex = useMemo(() => {
    const list: { code: string; label: string; product: Product; variant?: ProductVariant }[] = [];
    for (const p of state.products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          list.push({
            code: v.barcode,
            label: `${p.name} — ${v.color} / ${v.size}`,
            product: p,
            variant: v,
          });
        }
      } else {
        list.push({
          code: p.barcode || p.sku,
          label: p.name,
          product: p,
        });
      }
    }
    return list;
  }, [state.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.products.filter((p) => {
      const catMatch = selectedCategory === 'All' || p.category === selectedCategory;
      if (!catMatch) return false;
      if (!q) return true;
      const variantMatch = p.variants?.some(
        (v) =>
          v.barcode.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.color.toLowerCase().includes(q) ||
          v.size.toLowerCase().includes(q)
      );
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        Boolean(variantMatch)
      );
    });
  }, [state.products, search, selectedCategory]);

  const cartQtyByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cart) map.set(c.key, c.quantity);
    return map;
  }, [cart]);

  const addItemToCart = useCallback(
    (product: Product, variant?: ProductVariant) => {
      const availableStock = variant ? variant.stock : product.stock;
      const entryKey = variant ? `${product.id}::${variant.id}` : product.id;
      const displayName = variant
        ? `${product.name} (${variant.color} / ${variant.size})`
        : product.name;

      if (availableStock <= 0) {
        addToast({
          type: 'error',
          title: tr(lang, 'Out of stock', 'نفد من المخزون'),
          description: tr(
            lang,
            `${displayName} has 0 units available.`,
            `${displayName} لا يتوفر منه أي وحدات حالياً.`
          ),
        });
        return;
      }

      const currentQty = cartQtyByKey.get(entryKey) ?? 0;
      if (currentQty >= availableStock) {
        addToast({
          type: 'warning',
          title: tr(lang, 'Maximum stock reached', 'تم الوصول للحد الأقصى بالمخزون'),
          description: tr(
            lang,
            `Only ${availableStock} unit(s) of ${displayName} available.`,
            `يتوفر ${availableStock} وحدة فقط من ${displayName}.`
          ),
        });
        return;
      }

      setCart((prev) => {
        const existing = prev.find((e) => e.key === entryKey);
        if (existing) {
          return prev.map((e) =>
            e.key === entryKey ? { ...e, quantity: e.quantity + 1 } : e
          );
        }
        return [
          ...prev,
          {
            key: entryKey,
            productId: product.id,
            variantId: variant?.id,
            quantity: 1,
            discountType: 'percent',
            discountValue: 0,
          },
        ];
      });
    },
    [cartQtyByKey, addToast, lang]
  );

  const handleBarcodeScan = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim().toLowerCase();
      if (!code) return;

      for (const p of state.products) {
        if (p.variants && p.variants.length > 0) {
          const matchedVar = p.variants.find(
            (v) => v.barcode.toLowerCase() === code || v.sku.toLowerCase() === code
          );
          if (matchedVar) {
            addItemToCart(p, matchedVar);
            setLastScannedCode(matchedVar.barcode);
            addToast({
              type: 'success',
              title: `${tr(lang, 'Scanned', 'تم المسح')} · ${matchedVar.barcode}`,
              description: tr(
                lang,
                `Added ${p.name} (${matchedVar.color} / ${matchedVar.size}) to cart.`,
                `تمت إضافة ${p.name} (${matchedVar.color} / ${matchedVar.size}) إلى السلة.`
              ),
            });
            return;
          }
        }
        if ((p.barcode || '').toLowerCase() === code || p.sku.toLowerCase() === code) {
          if (p.variants && p.variants.length > 0) {
            setVariantPickerProduct(p);
          } else {
            addItemToCart(p);
            setLastScannedCode(p.barcode || p.sku);
            addToast({
              type: 'success',
              title: `${tr(lang, 'Scanned', 'تم المسح')} · ${p.barcode || p.sku}`,
              description: tr(
                lang,
                `Added ${p.name} to cart.`,
                `تمت إضافة ${p.name} إلى السلة.`
              ),
            });
          }
          return;
        }
      }

      addToast({
        type: 'warning',
        title: tr(lang, 'Barcode not recognized', 'لم يتم التعرف على الباركود'),
        description: tr(
          lang,
          `No product or variant matched "${rawCode}".`,
          `لا يوجد صنف أو مقاس يطابق "${rawCode}".`
        ),
      });
    },
    [state.products, addItemToCart, addToast, lang]
  );

  // Hardware USB/Bluetooth keyboard-wedge scanner listener
  useEffect(() => {
    if (!scannerEnabled || paymentModalOpen || Boolean(completedReceipt)) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (isInputFocused) return;

      const now = Date.now();
      const elapsed = now - scanBufferRef.current.lastTs;

      if (e.key === 'Enter') {
        const captured = scanBufferRef.current.chars;
        scanBufferRef.current = { chars: '', lastTs: 0 };
        if (captured.length >= 4) {
          e.preventDefault();
          handleBarcodeScan(captured);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (elapsed > 80) {
          scanBufferRef.current = { chars: e.key, lastTs: now };
        } else {
          scanBufferRef.current = {
            chars: scanBufferRef.current.chars + e.key,
            lastTs: now,
          };
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scannerEnabled, paymentModalOpen, completedReceipt, handleBarcodeScan]);

  const handleProductCardClick = (product: Product) => {
    if (product.stock <= 0) return;
    if (product.variants && product.variants.length > 0) {
      setVariantPickerProduct(product);
    } else {
      addItemToCart(product);
    }
  };

  const updateCartQty = (entryKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry) => {
          if (entry.key !== entryKey) return entry;
          const product = productMap.get(entry.productId);
          if (!product) return entry;
          const variant = entry.variantId
            ? product.variants?.find((v) => v.id === entry.variantId)
            : undefined;
          const maxStock = variant ? variant.stock : product.stock;
          const next = entry.quantity + delta;
          if (next > maxStock) {
            addToast({
              type: 'warning',
              title: tr(lang, 'Stock limit', 'حد المخزون المتاح'),
              description: tr(
                lang,
                `Cannot exceed ${maxStock} available unit(s).`,
                `لا يمكن تجاوز الكمية المتوفرة (${maxStock}).`
              ),
            });
            return entry;
          }
          return { ...entry, quantity: next };
        })
        .filter((entry) => entry.quantity > 0)
    );
  };

  const removeFromCart = (entryKey: string) => {
    setCart((prev) => prev.filter((e) => e.key !== entryKey));
  };

  const updateItemDiscount = (
    entryKey: string,
    discountType: DiscountType,
    discountValue: number
  ) => {
    const safeVal = Math.max(0, Number.isFinite(discountValue) ? discountValue : 0);
    setCart((prev) =>
      prev.map((e) =>
        e.key === entryKey
          ? {
              ...e,
              discountType,
              discountValue: discountType === 'percent' ? Math.min(100, safeVal) : safeVal,
            }
          : e
      )
    );
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      handleBarcodeScan(search.trim());
      setSearch('');
    }
  };

  const selectedCustomer =
    state.customers.find((c) => c.id === customerId) ?? state.customers[0];

  const handleCustomerLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = loyaltyLookup.trim().toLowerCase();
    if (!q) return;
    const digits = q.replace(/\D/g, '');
    const matched = state.customers.find((c) => {
      if (c.isWalkIn) return false;
      const phoneDigits = c.phone.replace(/\D/g, '');
      return (
        c.email.toLowerCase() === q ||
        c.phone.toLowerCase() === q ||
        (digits.length >= 4 && phoneDigits.includes(digits)) ||
        c.name.toLowerCase().includes(q)
      );
    });

    if (matched) {
      setCustomerId(matched.id);
      setSelectedLoyaltyTierId(null);
      setLoyaltyLookup('');
      addToast({
        type: 'success',
        title: `${tr(lang, 'Loyalty member found', 'تم العثور على عضو الولاء')} · ${matched.name}`,
        description: tr(
          lang,
          `Available balance: ${matched.loyaltyPoints} pts`,
          `الرصيد المتاح: ${matched.loyaltyPoints} نقطة`
        ),
      });
    } else {
      if (q.includes('@')) {
        setEnrollEmail(loyaltyLookup.trim());
        setEnrollPhone('');
      } else {
        setEnrollPhone(loyaltyLookup.trim());
        setEnrollEmail('');
      }
      setEnrollName('');
      setEnrollOpen(true);
    }
  };

  const handleQuickEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollName.trim()) return;
    const created = quickEnrollCustomer({
      name: enrollName,
      phone: enrollPhone,
      email: enrollEmail,
    });
    setCustomerId(created.id);
    setSelectedLoyaltyTierId(null);
    setLoyaltyLookup('');
    setEnrollOpen(false);
  };

  const sortedTiers = useMemo(
    () => [...loyaltyCfg.tiers].sort((a, b) => a.pointsRequired - b.pointsRequired),
    [loyaltyCfg.tiers]
  );

  const activeLoyaltyTier: LoyaltyTier | null = useMemo(() => {
    if (!loyaltyCfg.enabled || !selectedCustomer || selectedCustomer.isWalkIn) return null;
    const tier = sortedTiers.find((t) => t.id === selectedLoyaltyTierId) ?? null;
    if (tier && selectedCustomer.loyaltyPoints >= tier.pointsRequired) return tier;
    return null;
  }, [loyaltyCfg.enabled, selectedCustomer, sortedTiers, selectedLoyaltyTierId]);

  const cartSummary = useMemo(() => {
    const items: SaleItem[] = [];
    let rawSubtotal = 0;
    let itemDiscountsTotal = 0;

    for (const entry of cart) {
      const product = productMap.get(entry.productId);
      if (!product) continue;
      const variant = entry.variantId
        ? product.variants?.find((v) => v.id === entry.variantId)
        : undefined;
      const unitPrice = variant?.priceOverride ?? product.sellingPrice;
      const lineGross = roundMoney(unitPrice * entry.quantity);
      const rawDisc =
        entry.discountType === 'percent'
          ? (lineGross * Math.min(100, entry.discountValue)) / 100
          : entry.discountValue;
      const discountAmount = roundMoney(Math.min(lineGross, Math.max(0, rawDisc)));
      const lineTotal = roundMoney(lineGross - discountAmount);

      rawSubtotal += lineGross;
      itemDiscountsTotal += discountAmount;

      items.push({
        productId: product.id,
        productName: product.name,
        sku: variant ? variant.sku : product.sku,
        barcode: variant ? variant.barcode : product.barcode || product.sku,
        variantId: variant?.id,
        variantLabel: variant ? `${variant.color} / ${variant.size}` : undefined,
        quantity: entry.quantity,
        unitPrice,
        costPrice: product.costPrice,
        discountType: entry.discountType,
        discountValue: entry.discountValue,
        discountAmount,
        lineTotal,
      });
    }

    const afterItemDiscounts = roundMoney(rawSubtotal - itemDiscountsTotal);
    const rawOrderDisc =
      orderDiscountType === 'percent'
        ? (afterItemDiscounts * Math.min(100, Math.max(0, orderDiscountValue))) / 100
        : Math.max(0, orderDiscountValue);
    const orderDiscountAmount = roundMoney(Math.min(afterItemDiscounts, rawOrderDisc));
    const afterOrderDisc = roundMoney(afterItemDiscounts - orderDiscountAmount);

    const loyaltyDiscountPercent = activeLoyaltyTier?.discountPercent ?? 0;
    const loyaltyPointsRedeemed = activeLoyaltyTier?.pointsRequired ?? 0;
    const loyaltyDiscountAmount = roundMoney((afterOrderDisc * loyaltyDiscountPercent) / 100);

    const taxableAmount = roundMoney(Math.max(0, afterOrderDisc - loyaltyDiscountAmount));
    const taxAmount = roundMoney((taxableAmount * taxRate) / 100);
    const total = roundMoney(taxableAmount + taxAmount);

    const projectedPointsEarned =
      loyaltyCfg.enabled &&
      selectedCustomer &&
      !selectedCustomer.isWalkIn &&
      loyaltyCfg.spendUnit > 0
        ? Math.floor(total / loyaltyCfg.spendUnit) * loyaltyCfg.pointsPerUnit
        : 0;

    return {
      items,
      subtotal: roundMoney(rawSubtotal),
      itemDiscountsTotal: roundMoney(itemDiscountsTotal),
      orderDiscountAmount,
      loyaltyPointsRedeemed,
      loyaltyDiscountPercent,
      loyaltyDiscountAmount,
      projectedPointsEarned,
      taxAmount,
      total,
    };
  }, [
    cart,
    productMap,
    orderDiscountType,
    orderDiscountValue,
    activeLoyaltyTier,
    taxRate,
    loyaltyCfg,
    selectedCustomer,
  ]);

  const openPaymentModal = () => {
    if (cartSummary.items.length === 0) return;
    setPaymentMethod('Cash');
    setCashTenderedStr(cartSummary.total.toFixed(2));
    setSplitPaidStr((cartSummary.total / 2).toFixed(2));
    setBnplProvider('Tabby');
    setBnplMonths(4);
    setBnplDownPaymentStr((cartSummary.total * 0.25).toFixed(2));
    setBnplReference(`BNPL-${Date.now().toString().slice(-6)}`);
    setPaymentModalOpen(true);
  };

  const cashTendered = parseFloat(cashTenderedStr) || 0;
  const changeDue = roundMoney(cashTendered - cartSummary.total);

  const splitPaidNow = Math.max(
    0,
    Math.min(cartSummary.total, parseFloat(splitPaidStr) || 0)
  );
  const creditAmount = roundMoney(cartSummary.total - splitPaidNow);

  const bnplDownPayment = Math.max(
    0,
    Math.min(cartSummary.total, parseFloat(bnplDownPaymentStr) || 0)
  );
  const bnplFinanced = roundMoney(Math.max(0, cartSummary.total - bnplDownPayment));
  const bnplMonthly = bnplMonths > 0 ? roundMoney(bnplFinanced / bnplMonths) : bnplFinanced;

  const canCompletePayment = (() => {
    if (cartSummary.items.length === 0) return false;
    if (paymentMethod === 'Cash') return cashTendered >= cartSummary.total - 0.001;
    if (paymentMethod === 'Card') return true;
    if (paymentMethod === 'BNPL') return bnplMonths >= 2;
    if (paymentMethod === 'Split/Credit') {
      if (creditAmount > 0 && selectedCustomer?.isWalkIn) return false;
      return splitPaidNow >= 0 && splitPaidNow <= cartSummary.total + 0.001;
    }
    return false;
  })();

  const handleFinalizeSale = () => {
    if (!canCompletePayment) return;

    const sale = completeSale({
      customerId: selectedCustomer?.id ?? 'cust-walkin',
      items: cartSummary.items,
      subtotal: cartSummary.subtotal,
      itemDiscountsTotal: cartSummary.itemDiscountsTotal,
      orderDiscountType,
      orderDiscountValue,
      orderDiscountAmount: cartSummary.orderDiscountAmount,
      loyaltyPointsRedeemed: cartSummary.loyaltyPointsRedeemed,
      loyaltyDiscountPercent: cartSummary.loyaltyDiscountPercent,
      loyaltyDiscountAmount: cartSummary.loyaltyDiscountAmount,
      taxRate,
      taxAmount: cartSummary.taxAmount,
      total: cartSummary.total,
      paymentMethod,
      bnplDetails:
        paymentMethod === 'BNPL'
          ? {
              provider: bnplProvider,
              months: bnplMonths,
              downPayment: bnplDownPayment,
              financedAmount: bnplFinanced,
              monthlyInstallment: bnplMonthly,
              reference: bnplReference.trim() || `BNPL-${Date.now().toString().slice(-6)}`,
            }
          : undefined,
      amountPaid:
        paymentMethod === 'Split/Credit'
          ? splitPaidNow
          : paymentMethod === 'BNPL'
          ? bnplDownPayment
          : cartSummary.total,
      cashTendered: paymentMethod === 'Cash' ? cashTendered : undefined,
      changeDue: paymentMethod === 'Cash' ? Math.max(0, changeDue) : undefined,
      creditAmount: paymentMethod === 'Split/Credit' ? creditAmount : 0,
      channel: 'POS',
    });

    setCart([]);
    setOrderDiscountValue(0);
    setSelectedLoyaltyTierId(null);
    setExpandedItemDiscountKey(null);
    setPaymentModalOpen(false);
    setCompletedReceipt(sale);
  };

  return (
    <div className="space-y-4">
      {/* Offline POS Status & Connectivity Control Bar */}
      <div
        className={`px-4 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
          isOnline
            ? 'bg-white border-slate-200/85 text-slate-700'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
          )}
          <span className="font-semibold">
            {isOnline
              ? tr(
                  lang,
                  'POS Online · Live Sync Active',
                  'الكاشير متصل · المزامنة الفورية نشطة'
                )
              : tr(
                  lang,
                  'Offline POS Mode · Selling uninterrupted — invoices queue locally',
                  'وضع عدم الاتصال (Offline POS) · البيع مستمر والفواتير تُحفظ محلياً'
                )}
          </span>
          {offlineQueueCount > 0 && (
            <span className="font-mono font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded tabular-nums">
              {offlineQueueCount} {tr(lang, 'queued', 'بانتظار المزامنة')}
            </span>
          )}
          {currentUser && (
            <span className="text-slate-500 hidden sm:inline">
              · {tr(lang, 'Operator:', 'المشغّل:')}{' '}
              <strong className="text-slate-800">{currentUser.displayName}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOnline && offlineQueueCount > 0 && (
            <button
              type="button"
              onClick={syncOfflineInvoices}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {tr(lang, 'Sync Now', 'مزامنة الآن')}
            </button>
          )}
          <button
            type="button"
            onClick={toggleSimulatedOffline}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              isOnline
                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-white border-amber-400 text-amber-900 hover:bg-amber-100'
            }`}
          >
            {isOnline
              ? tr(lang, 'Test Offline Mode', 'محاكاة انقطاع الإنترنت')
              : tr(lang, 'Reconnect & Auto-Sync', 'استعادة الاتصال والمزامنة')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Panel: Barcode Scanner + Product Catalog */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200/85 rounded-xl p-4 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={tr(
                    lang,
                    'Scan barcode or search product, SKU, color, or size (Enter to scan)...',
                    'امسح الباركود أو ابحث بالاسم، SKU، اللون، أو المقاس (اضغط Enter للمسح)...'
                  )}
                  className="w-full ps-10 pe-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:bg-white transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => setScannerEnabled((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  scannerEnabled
                    ? 'bg-teal-50 border-teal-200 text-teal-900'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
                title={tr(
                  lang,
                  'Toggle USB/Bluetooth keyboard-wedge barcode scanner listener',
                  'تفعيل أو إيقاف استقبال قارئ الباركود USB/Bluetooth'
                )}
              >
                <ScanBarcode className="w-4 h-4" />
                {scannerEnabled
                  ? tr(lang, 'Scanner Listening', 'القارئ نشط')
                  : tr(lang, 'Scanner Paused', 'القارئ متوقف')}
              </button>

              <button
                type="button"
                onClick={() => setSimScanOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                {tr(lang, 'Simulate Scan', 'محاكاة مسح باركود')}
              </button>
            </div>

            {lastScannedCode && (
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {tr(lang, 'Last scanned barcode:', 'آخر باركود تم مسحه:')}{' '}
                  <strong className="font-mono text-slate-800">{lastScannedCode}</strong>
                </span>
                <span className="text-slate-400">
                  {tr(
                    lang,
                    'USB/Bluetooth wedge scanner active across POS',
                    'قارئ الباركود USB/Bluetooth جاهز للعمل مباشرة'
                  )}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {cat === 'All' ? tr(lang, 'All', 'الكل') : cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-slate-200/85 rounded-xl p-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {tr(lang, 'No matching products found', 'لا توجد منتجات مطابقة')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {tr(
                  lang,
                  'Try a different product name, variant barcode, or clear the category filter.',
                  'جرّب البحث باسم آخر أو باركود مختلف أو إزالة فلتر التصنيف.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredProducts.map((product) => {
                const hasVariants = Boolean(product.variants && product.variants.length > 0);
                const totalInCart = cart
                  .filter((c) => c.productId === product.id)
                  .reduce((s, c) => s + c.quantity, 0);
                const remaining = product.stock - totalInCart;
                const stockStatus = getStockStatus(product.stock, product.reorderLevel);
                const disabled = product.stock <= 0 || (!hasVariants && remaining <= 0);

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleProductCardClick(product)}
                    className={`text-start bg-white border rounded-xl p-4 flex flex-col justify-between transition-all duration-150 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
                      disabled
                        ? 'border-slate-200 opacity-55 cursor-not-allowed bg-slate-50/70'
                        : totalInCart > 0
                        ? 'border-teal-600 ring-1 ring-teal-600/20 hover:bg-teal-50/20 cursor-pointer'
                        : 'border-slate-200/85 hover:border-slate-300 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-mono">{product.sku}</span>
                        <span
                          className={`font-semibold text-[11px] tabular-nums ${
                            stockStatus === 'out'
                              ? 'text-red-600'
                              : stockStatus === 'low'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {product.stock === 0
                            ? tr(lang, 'Out of Stock', 'نفد المخزون')
                            : tr(lang, `${product.stock} in stock`, `${product.stock} متوفر`)}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mt-2 leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <span>{product.category}</span>
                        {hasVariants && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-teal-800 font-medium">
                              <Layers className="w-3 h-3" />
                              {tr(
                                lang,
                                `${product.variants?.length} variants`,
                                `${product.variants?.length} مقاسات/ألوان`
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                        {formatCurrency(product.sellingPrice, sym)}
                      </span>
                      <span className="text-xs font-semibold text-teal-700 tabular-nums">
                        {product.stock <= 0
                          ? tr(lang, 'Unavailable', 'غير متوفر')
                          : hasVariants
                          ? totalInCart > 0
                            ? tr(lang, `${totalInCart} in cart · Pick`, `${totalInCart} بالسلة · اختر`)
                            : tr(lang, 'Pick Color/Size', 'اختر اللون/المقاس')
                          : remaining <= 0
                          ? tr(lang, `Max (${totalInCart})`, `الحد (${totalInCart})`)
                          : totalInCart > 0
                          ? tr(lang, `${totalInCart} in cart · +1`, `${totalInCart} بالسلة · +1`)
                          : tr(lang, '+ Add', '+ إضافة')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart, Loyalty Lookup & Checkout Panel */}
        <aside className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200/85 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col lg:sticky lg:top-20 overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  {tr(lang, 'Current Order', 'الطلب الحالي')}
                </h2>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  ({cart.reduce((s, c) => s + c.quantity, 0)})
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setOrderDiscountValue(0);
                    setSelectedLoyaltyTierId(null);
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors"
                >
                  {tr(lang, 'Clear', 'تفريغ')}
                </button>
              )}
            </div>

            {/* Customer Selector */}
            <div>
              <label className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mb-1">
                <User className="w-3 h-3" />
                {tr(lang, 'Customer', 'العميل')}
              </label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setSelectedLoyaltyTierId(null);
                }}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-600"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isWalkIn ? tr(lang, c.name, 'عميل نقدي عابر') : c.name}
                    {!c.isWalkIn ? ` · ${c.loyaltyPoints} ${tr(lang, 'pts', 'نقطة')}` : ''}
                    {c.creditBalance > 0
                      ? ` (${tr(lang, 'Due', 'آجل')}: ${formatCurrency(c.creditBalance, sym)})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Loyalty Phone / Email Quick Lookup */}
            {loyaltyCfg.enabled && (
              <div className="space-y-2">
                <form onSubmit={handleCustomerLookup} className="flex gap-1.5">
                  <input
                    type="text"
                    value={loyaltyLookup}
                    onChange={(e) => setLoyaltyLookup(e.target.value)}
                    placeholder={tr(
                      lang,
                      'Lookup loyalty by phone or email...',
                      'ابحث عن الولاء برقم الجوال أو البريد...'
                    )}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg whitespace-nowrap"
                  >
                    {tr(lang, 'Find / Join', 'بحث / تسجيل')}
                  </button>
                </form>

                {selectedCustomer && !selectedCustomer.isWalkIn && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <Award className="w-3.5 h-3.5 text-teal-700" />
                        {tr(lang, 'Loyalty Balance', 'رصيد نقاط الولاء')}
                      </span>
                      <span className="font-mono font-bold text-teal-800 tabular-nums">
                        {selectedCustomer.loyaltyPoints} {tr(lang, 'pts', 'نقطة')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {sortedTiers.map((tier) => {
                        const eligible = selectedCustomer.loyaltyPoints >= tier.pointsRequired;
                        const active = selectedLoyaltyTierId === tier.id;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            disabled={!eligible}
                            onClick={() =>
                              setSelectedLoyaltyTierId(active ? null : tier.id)
                            }
                            className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors tabular-nums ${
                              active
                                ? 'bg-teal-700 border-teal-700 text-white'
                                : eligible
                                ? 'bg-white border-teal-300 text-teal-900 hover:bg-teal-50'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {tier.discountPercent}% ({tier.pointsRequired}
                            {tr(lang, 'p', 'ن')})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {cartSummary.items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-slate-600">
                  {tr(lang, 'Cart is empty', 'السلة فارغة حالياً')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {tr(
                    lang,
                    'Scan a variant barcode or click any product to begin checkout.',
                    'امسح باركود الصنف أو انقر على أي منتج للبدء بإصدار الفاتورة.'
                  )}
                </p>
              </div>
            ) : (
              cartSummary.items.map((item) => {
                const entryKey = item.variantId
                  ? `${item.productId}::${item.variantId}`
                  : item.productId;
                const product = productMap.get(item.productId);
                const variant = item.variantId
                  ? product?.variants?.find((v) => v.id === item.variantId)
                  : undefined;
                const maxStock = variant ? variant.stock : product?.stock ?? item.quantity;
                const isDiscountOpen = expandedItemDiscountKey === entryKey;

                return (
                  <div key={entryKey} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 leading-snug">
                          {item.productName}
                        </p>
                        {item.variantLabel && (
                          <p className="text-[11px] font-medium text-teal-800">
                            {item.variantLabel} · <span className="font-mono">{item.barcode}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          {formatCurrency(item.unitPrice, sym)} {tr(lang, 'each', 'للوحدة')}
                          {item.discountAmount > 0 && (
                            <span className="text-amber-700 ms-1.5">
                              (-{formatCurrency(item.discountAmount, sym)})
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-xs font-bold font-mono text-slate-900 tabular-nums shrink-0">
                        {formatCurrency(item.lineTotal, sym)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateCartQty(entryKey, -1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-s-lg transition-colors"
                          aria-label={tr(lang, 'Decrease quantity', 'تقليل الكمية')}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-mono font-semibold text-slate-900 tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= maxStock}
                          onClick={() => updateCartQty(entryKey, 1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-e-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={tr(lang, 'Increase quantity', 'زيادة الكمية')}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canGiveDiscounts && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedItemDiscountKey(isDiscountOpen ? null : entryKey)
                            }
                            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                              item.discountValue > 0 || isDiscountOpen
                                ? 'bg-amber-50 text-amber-800'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                          >
                            <Tag className="w-3 h-3" />
                            {tr(lang, 'Discount', 'خصم')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFromCart(entryKey)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                          aria-label={tr(lang, 'Remove item', 'حذف الصنف')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {canGiveDiscounts && isDiscountOpen && (
                      <div className="flex items-center gap-2 pt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                        <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateItemDiscount(entryKey, 'percent', item.discountValue)
                            }
                            className={`px-2 py-1 text-[11px] font-medium ${
                              item.discountType === 'percent'
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateItemDiscount(entryKey, 'fixed', item.discountValue)
                            }
                            className={`px-2 py-1 text-[11px] font-medium ${
                              item.discountType === 'fixed'
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600'
                            }`}
                          >
                            {sym.trim()}
                          </button>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={item.discountValue || ''}
                          onChange={(e) =>
                            updateItemDiscount(
                              entryKey,
                              item.discountType,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Order-Level Discount & Totals */}
          <div className="p-4 border-t border-slate-200/80 space-y-3 bg-slate-50/60">
            {canGiveDiscounts && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 inline-flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  {tr(lang, 'Order Discount', 'خصم إجمالي الفاتورة')}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOrderDiscountType('percent')}
                      className={`px-2 py-1 text-[11px] font-medium ${
                        orderDiscountType === 'percent'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderDiscountType('fixed')}
                      className={`px-2 py-1 text-[11px] font-medium ${
                        orderDiscountType === 'fixed'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      {sym.trim()}
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={orderDiscountValue || ''}
                    onChange={(e) =>
                      setOrderDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    placeholder="0"
                    className="w-20 px-2 py-1 text-end text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-xs tabular-nums pt-2 border-t border-slate-200/80">
              <div className="flex justify-between text-slate-600">
                <span>{tr(lang, 'Subtotal', 'المجموع الفرعي')}</span>
                <span className="font-mono">{formatCurrency(cartSummary.subtotal, sym)}</span>
              </div>
              {cartSummary.itemDiscountsTotal > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>{tr(lang, 'Item Discounts', 'خصومات الأصناف')}</span>
                  <span className="font-mono">
                    -{formatCurrency(cartSummary.itemDiscountsTotal, sym)}
                  </span>
                </div>
              )}
              {cartSummary.orderDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>{tr(lang, 'Order Discount', 'خصم الفاتورة')}</span>
                  <span className="font-mono">
                    -{formatCurrency(cartSummary.orderDiscountAmount, sym)}
                  </span>
                </div>
              )}
              {cartSummary.loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-teal-700 font-medium">
                  <span>
                    {tr(lang, 'Loyalty Tier', 'مكافأة الولاء')} ({cartSummary.loyaltyDiscountPercent}
                    % · -{cartSummary.loyaltyPointsRedeemed} {tr(lang, 'pts', 'نقطة')})
                  </span>
                  <span className="font-mono">
                    -{formatCurrency(cartSummary.loyaltyDiscountAmount, sym)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>
                  {tr(lang, `Tax (${taxRate}%)`, `ضريبة القيمة المضافة (${taxRate}%)`)}
                </span>
                <span className="font-mono">{formatCurrency(cartSummary.taxAmount, sym)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>{tr(lang, 'Total', 'الإجمالي')}</span>
                <span className="font-mono">{formatCurrency(cartSummary.total, sym)}</span>
              </div>
              {cartSummary.projectedPointsEarned > 0 && (
                <div className="flex justify-between text-[11px] text-emerald-700 font-medium">
                  <span>{tr(lang, 'Points to Earn', 'النقاط المكتسبة')}</span>
                  <span className="font-mono">
                    +{cartSummary.projectedPointsEarned} {tr(lang, 'pts', 'نقطة')}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={cartSummary.items.length === 0}
              onClick={openPaymentModal}
              className="w-full py-3 px-4 text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {tr(lang, 'Checkout', 'إتمام الدفع')} · {formatCurrency(cartSummary.total, sym)}
            </button>
          </div>
        </aside>

        {/* Variant Picker Modal */}
        <Modal
          open={Boolean(variantPickerProduct)}
          onClose={() => setVariantPickerProduct(null)}
          title={variantPickerProduct?.name ?? tr(lang, 'Select Variant', 'اختر المقاس واللون')}
          subtitle={tr(
            lang,
            'Choose Color & Size variant — each has its own unique barcode',
            'اختر اللون والمقاس — لكل متغير باركود مستقل خاص به'
          )}
          maxWidthClass="max-w-lg"
        >
          {variantPickerProduct?.variants && (
            <div className="space-y-2.5">
              {variantPickerProduct.variants.map((variant) => {
                const key = `${variantPickerProduct.id}::${variant.id}`;
                const inCart = cartQtyByKey.get(key) ?? 0;
                const remaining = variant.stock - inCart;
                const price = variant.priceOverride ?? variantPickerProduct.sellingPrice;
                return (
                  <div
                    key={variant.id}
                    className="p-3.5 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {variant.color} / {variant.size}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatCurrency(price, sym)} ·{' '}
                        <span
                          className={
                            variant.stock <= 0 ? 'text-red-600 font-medium' : 'text-emerald-700'
                          }
                        >
                          {variant.stock} {tr(lang, 'in stock', 'متوفر')}
                        </span>
                        {inCart > 0 && ` (${inCart} ${tr(lang, 'in cart', 'بالسلة')})`}
                      </p>
                      <BarcodeSvg value={variant.barcode} height={22} showText />
                    </div>
                    <button
                      type="button"
                      disabled={remaining <= 0}
                      onClick={() => {
                        addItemToCart(variantPickerProduct, variant);
                        setVariantPickerProduct(null);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg whitespace-nowrap"
                    >
                      {remaining <= 0
                        ? tr(lang, 'Unavailable', 'غير متوفر')
                        : tr(lang, 'Add Variant', 'إضافة للسلة')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>

        {/* Simulate Barcode Scan Modal */}
        <Modal
          open={simScanOpen}
          onClose={() => setSimScanOpen(false)}
          title={tr(lang, 'Simulate Hardware Barcode Scan', 'محاكاة مسح قارئ الباركود')}
          subtitle={tr(
            lang,
            'Click any variant or item barcode to simulate a USB/Bluetooth barcode scanner trigger',
            'انقر على أي صنف أو مقاس لمحاكاة قراءة فورية من جهاز الباركود'
          )}
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-2 max-h-[380px] overflow-y-auto pe-1">
            {barcodeIndex.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => {
                  handleBarcodeScan(entry.code);
                  setSimScanOpen(false);
                }}
                className="w-full text-start p-3 border border-slate-200 rounded-lg hover:border-teal-600 hover:bg-teal-50/30 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{entry.label}</p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {tr(lang, 'Barcode:', 'الباركود:')} {entry.code} · {tr(lang, 'Stock:', 'الرصيد:')}{' '}
                    {entry.variant ? entry.variant.stock : entry.product.stock}
                  </p>
                </div>
                <span className="text-xs font-semibold text-teal-700 whitespace-nowrap">
                  {tr(lang, 'Scan Now', 'مسح الآن')}
                </span>
              </button>
            ))}
          </div>
        </Modal>

        {/* Quick Loyalty Member Enroll Modal */}
        <Modal
          open={enrollOpen}
          onClose={() => setEnrollOpen(false)}
          title={tr(lang, 'Enroll New Loyalty Member', 'تسجيل عضو ولاء جديد')}
          subtitle={tr(
            lang,
            'Customer not found — enroll in seconds to earn points on this checkout',
            'لم يتم العثور على العميل — سجّله خلال ثوانٍ لاكتساب نقاط هذه الفاتورة'
          )}
          maxWidthClass="max-w-sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => setEnrollOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
              >
                {tr(lang, 'Cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                form="quick-enroll-form"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {tr(lang, 'Enroll & Select', 'تسجيل واختيار')}
              </button>
            </>
          }
        >
          <form id="quick-enroll-form" onSubmit={handleQuickEnroll} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Full Name *', 'الاسم الكامل *')}
              </label>
              <input
                type="text"
                required
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                placeholder={tr(lang, 'Customer full name', 'اسم العميل')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Phone Number', 'رقم الجوال')}
              </label>
              <input
                type="text"
                value={enrollPhone}
                onChange={(e) => setEnrollPhone(e.target.value)}
                placeholder="055 000 0000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Email', 'البريد الإلكتروني')}
              </label>
              <input
                type="email"
                value={enrollEmail}
                onChange={(e) => setEnrollEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </form>
        </Modal>

        {/* Payment Modal */}
        <Modal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title={tr(lang, 'Complete Payment', 'إتمام عملية الدفع')}
          subtitle={`${tr(lang, 'Total due:', 'المبلغ المستحق:')} ${formatCurrency(cartSummary.total, sym)} · ${
            selectedCustomer?.isWalkIn
              ? tr(lang, 'Walk-in Customer', 'عميل نقدي عابر')
              : selectedCustomer?.name ?? ''
          }`}
          maxWidthClass="max-w-md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                {tr(lang, 'Cancel', 'إلغاء')}
              </button>
              <button
                type="button"
                disabled={!canCompletePayment}
                onClick={handleFinalizeSale}
                className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {tr(lang, 'Confirm & Issue Receipt', 'تأكيد وإصدار الفاتورة')}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                {tr(lang, 'Amount Due', 'المبلغ المستحق')}
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(cartSummary.total, sym)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'Cash', label: isAr ? 'نقدي' : 'Cash', icon: Banknote },
                  { id: 'Card', label: isAr ? 'بطاقة' : 'Card', icon: CreditCard },
                  { id: 'Split/Credit', label: isAr ? 'آجل / مقسم' : 'Split / Credit', icon: Split },
                  { id: 'BNPL', label: isAr ? 'تقسيط BNPL' : 'BNPL', icon: CalendarClock },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = paymentMethod === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                    className={`py-2.5 px-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-teal-50 border-teal-600 text-teal-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === 'Cash' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {tr(lang, `Cash Tendered (${sym})`, `المبلغ المدفوع نقداً (${sym.trim()})`)}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashTenderedStr}
                    onChange={(e) => setCashTenderedStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-base font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: tr(lang, 'Exact', 'المبلغ بالضبط'), value: cartSummary.total },
                    { label: `+${sym.trim()}5`, value: Math.ceil(cartSummary.total / 5) * 5 + 5 },
                    { label: `${sym.trim()}50`, value: 50 },
                    { label: `${sym.trim()}100`, value: 100 },
                    { label: `${sym.trim()}200`, value: 200 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setCashTenderedStr(preset.value.toFixed(2))}
                      className="px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div
                  className={`p-3.5 rounded-lg border flex items-center justify-between ${
                    changeDue >= 0
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-red-50/70 border-red-200'
                  }`}
                >
                  <span className="text-xs font-medium text-slate-700">
                    {changeDue >= 0
                      ? tr(lang, 'Change Due', 'الباقي للعميل')
                      : tr(lang, 'Remaining Shortfall', 'المتبقي الناقص')}
                  </span>
                  <span
                    className={`text-lg font-bold font-mono tabular-nums ${
                      changeDue >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {formatCurrency(Math.abs(changeDue), sym)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'Card' && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-900">
                  {tr(lang, 'Card Terminal Ready', 'جهاز نقاط البيع (مدى / بطاقة) جاهز')}
                </p>
                <p>
                  {tr(lang, 'Full amount of', 'سيتم تسجيل كامل المبلغ وقدره')}{' '}
                  <strong className="font-mono text-slate-900">
                    {formatCurrency(cartSummary.total, sym)}
                  </strong>{' '}
                  {tr(lang, 'will be recorded as settled via Card.', 'كمدفوع بالكامل عبر البطاقة.')}
                </p>
              </div>
            )}

            {paymentMethod === 'Split/Credit' && (
              <div className="space-y-3">
                {selectedCustomer?.isWalkIn && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="font-semibold">
                        {tr(
                          lang,
                          'Select a registered customer to assign credit balance.',
                          'اختر عميلاً مسجلاً لتسجيل الرصيد الآجل على حسابه.'
                        )}
                      </p>
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md text-xs text-slate-900"
                      >
                        {state.customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.isWalkIn ? tr(lang, c.name, 'عميل نقدي عابر') : c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {tr(lang, `Amount Paid Today (${sym})`, `المبلغ المدفوع الآن (${sym.trim()})`)}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={cartSummary.total}
                    step="0.01"
                    value={splitPaidStr}
                    onChange={(e) => setSplitPaidStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-base font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setSplitPaidStr('0.00')}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                    >
                      {tr(lang, '100% Credit', 'آجل بالكامل 100%')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitPaidStr((cartSummary.total * 0.5).toFixed(2))}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                    >
                      {tr(lang, '50% Down', 'دفعة مقدمة 50%')}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">
                    {tr(lang, 'Added to Customer Credit', 'المضاف إلى رصيد العميل الآجل')}
                  </span>
                  <span className="text-lg font-bold font-mono text-amber-800 tabular-nums">
                    {formatCurrency(creditAmount, sym)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'BNPL' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {tr(lang, 'BNPL / Installment Provider (MENA)', 'مزود التقسيط (مصر والخليج)')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'Tabby', label: isAr ? 'تابي (Tabby)' : 'Tabby' },
                        { id: 'Tamara', label: isAr ? 'تمارا (Tamara)' : 'Tamara' },
                        { id: 'ValU', label: isAr ? 'فاليو (ValU)' : 'ValU' },
                        { id: 'Sympl', label: isAr ? 'سيمبل (Sympl)' : 'Sympl' },
                        { id: 'Souhoola', label: isAr ? 'سهولة' : 'Souhoola' },
                        { id: 'Custom', label: isAr ? 'تقسيط مباشر' : 'Custom' },
                      ] as const
                    ).map((prov) => (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => setBnplProvider(prov.id)}
                        className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          bnplProvider === prov.id
                            ? 'bg-teal-50 border-teal-600 text-teal-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {prov.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {tr(lang, 'Installment Months', 'عدد الأقساط (أشهر)')}
                    </label>
                    <select
                      value={bnplMonths}
                      onChange={(e) => setBnplMonths(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    >
                      <option value={3}>3 {tr(lang, 'months', 'أشهر')}</option>
                      <option value={4}>4 {tr(lang, 'months', 'أشهر')}</option>
                      <option value={6}>6 {tr(lang, 'months', 'أشهر')}</option>
                      <option value={12}>12 {tr(lang, 'months', 'شهراً')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {tr(lang, `Down Payment (${sym})`, `الدفعة المقدمة (${sym.trim()})`)}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={cartSummary.total}
                      step="0.01"
                      value={bnplDownPaymentStr}
                      onChange={(e) => setBnplDownPaymentStr(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {tr(lang, 'Provider Approval Reference', 'رقم موافقة التقسيط')}
                  </label>
                  <input
                    type="text"
                    value={bnplReference}
                    onChange={(e) => setBnplReference(e.target.value)}
                    placeholder="TBY-884192"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="p-3.5 rounded-lg bg-teal-50/60 border border-teal-200 flex items-center justify-between text-xs tabular-nums">
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      {tr(
                        lang,
                        `Monthly Installment (${bnplMonths} mo)`,
                        `القسط الشهري (${bnplMonths} أشهر)`
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {tr(lang, 'Financed:', 'المبلغ المموّل:')}{' '}
                      {formatCurrency(bnplFinanced, sym)}
                    </span>
                  </div>
                  <span className="text-lg font-bold font-mono text-teal-900">
                    {formatCurrency(bnplMonthly, sym)}/{tr(lang, 'mo', 'شهر')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Modal>

        <ReceiptModal sale={completedReceipt} onClose={() => setCompletedReceipt(null)} />
      </div>
    </div>
  );
};
