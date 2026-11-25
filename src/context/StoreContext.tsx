import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  BNPLDetails,
  BusinessSettings,
  CostLayer,
  CurrencyCode,
  Customer,
  CustomerPayment,
  CustomFieldDefinition,
  EcommerceConnector,
  ERPState,
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  ImportProfile,
  Language,
  LoyaltyTransaction,
  ModuleKey,
  PaymentMethod,
  Product,
  ProductVariant,
  PurchaseOrder,
  PurchaseOrderItem,
  Sale,
  SaleChannel,
  StockAdjustment,
  StockAdjustmentReason,
  Supplier,
  ToastMessage,
  WebhookLog,
} from '../types';
import { createSeedState } from '../data/seedData';
import { generateId, roundMoney } from '../utils/format';
import { generateBaseBarcode, generateVariantBarcode } from '../utils/barcode';
import { REGIONAL_PRESETS } from '../utils/i18n';
import { HolisticEngineReport, runDecisionEngine } from '../engines/decisionEngine';

const STORAGE_KEY = 'ledgerflow_erp_state_v2';
const LEGACY_KEY = 'ledgerflow_erp_state_v1';

interface CompleteSaleInput {
  customerId: string;
  items: Sale['items'];
  subtotal: number;
  itemDiscountsTotal: number;
  orderDiscountType: Sale['orderDiscountType'];
  orderDiscountValue: number;
  orderDiscountAmount: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountPercent: number;
  loyaltyDiscountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: Sale['paymentMethod'];
  bnplDetails?: BNPLDetails;
  amountPaid: number;
  cashTendered?: number;
  changeDue?: number;
  creditAmount: number;
  channel?: SaleChannel;
}

interface StoreContextValue {
  state: ERPState;
  decisionReport: HolisticEngineReport;
  toasts: ToastMessage[];
  isOnline: boolean;
  offlineQueueCount: number;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  toggleSimulatedOffline: () => void;
  syncOfflineInvoices: () => number;
  // Cross-module handoff
  pendingRestockProductId: string | null;
  setPendingRestockProductId: (id: string | null) => void;
  pendingRestockBatch: PurchaseOrderItem[] | null;
  setPendingRestockBatch: (items: PurchaseOrderItem[] | null) => void;
  // Products & Inventory
  saveProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  updateProductPrice: (productId: string, newPrice: number) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (
    productId: string,
    delta: number,
    reason: StockAdjustmentReason,
    notes: string,
    variantId?: string
  ) => void;
  // Sales & POS
  completeSale: (input: CompleteSaleInput) => Sale;
  refundSale: (saleId: string) => void;
  // Suppliers & Purchase Orders
  saveSupplier: (supplier: Omit<Supplier, 'id'> & { id?: string }) => void;
  recordSupplierPayment: (supplierId: string, amount: number) => void;
  createPurchaseOrder: (input: {
    supplierId: string;
    items: PurchaseOrderItem[];
    notes: string;
    markReceivedImmediately?: boolean;
    customFields?: Record<string, string>;
  }) => PurchaseOrder;
  receivePurchaseOrder: (poId: string) => void;
  // Customers & Loyalty
  saveCustomer: (
    customer: Omit<Customer, 'id' | 'totalSpent' | 'orderCount' | 'lifetimePointsEarned'> & {
      id?: string;
    }
  ) => void;
  quickEnrollCustomer: (input: { name: string; phone: string; email: string }) => Customer;
  recordCustomerPayment: (
    customerId: string,
    amount: number,
    method: ExpensePaymentMethod,
    notes: string
  ) => void;
  // Expenses
  saveExpense: (expense: Omit<Expense, 'id'> & { id?: string }) => void;
  deleteExpense: (id: string) => void;
  // Data Import & Custom Module Schemas
  saveModuleCustomFields: (module: ModuleKey, fields: CustomFieldDefinition[]) => void;
  saveImportProfile: (profile: Omit<ImportProfile, 'id'> & { id?: string }) => void;
  deleteImportProfile: (id: string) => void;
  applyBulkImport: (
    module: ModuleKey,
    rows: { system: Record<string, string>; custom: Record<string, string> }[]
  ) => number;
  // MENA Localization, Webhooks & E-Commerce Integrations
  setLanguage: (lang: Language) => void;
  applyRegionalPreset: (code: CurrencyCode) => void;
  regenerateWebhookKey: () => void;
  toggleWebhookDailySync: () => void;
  ingestWebhookPayload: (
    endpoint: WebhookLog['endpoint'],
    sourceSystem: string,
    rawJson: string
  ) => { ok: boolean; message: string };
  updateEcommerceConnector: (
    id: EcommerceConnector['id'],
    patch: Partial<EcommerceConnector>
  ) => void;
  syncEcommerceConnector: (id: EcommerceConnector['id']) => void;
  // Settings & Demo Data
  updateSettings: (settings: BusinessSettings) => void;
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function normalizeState(raw: Partial<ERPState>): ERPState {
  const seed = createSeedState();
  const mergedSettings: BusinessSettings = {
    ...seed.settings,
    ...(raw.settings ?? {}),
    loyalty: {
      ...seed.settings.loyalty,
      ...(raw.settings?.loyalty ?? {}),
      tiers:
        raw.settings?.loyalty?.tiers && raw.settings.loyalty.tiers.length > 0
          ? raw.settings.loyalty.tiers
          : seed.settings.loyalty.tiers,
    },
  };

  const products = (raw.products ?? seed.products).map((p) => {
    const variants = p.variants?.map((v) => ({
      ...v,
      barcode: v.barcode || generateVariantBarcode(p.sku, v.color, v.size),
    }));
    const syncedStock =
      variants && variants.length > 0
        ? variants.reduce((s, v) => s + v.stock, 0)
        : p.stock;
    const costLayers: CostLayer[] =
      p.costLayers && p.costLayers.length > 0
        ? p.costLayers
        : syncedStock > 0
        ? [
            {
              id: `cl-init-${p.id}`,
              date: new Date().toISOString(),
              quantityRemaining: syncedStock,
              unitCost: p.costPrice,
              sourceRef: 'Opening Balance',
            },
          ]
        : [];
    return {
      ...p,
      barcode: p.barcode || generateBaseBarcode(p.sku),
      stock: syncedStock,
      variants,
      costLayers,
    };
  });

  const customers = (raw.customers ?? seed.customers).map((c) => ({
    ...c,
    loyaltyPoints: c.loyaltyPoints ?? 0,
    lifetimePointsEarned: c.lifetimePointsEarned ?? c.loyaltyPoints ?? 0,
  }));

  const sales = (raw.sales ?? seed.sales).map((s) => ({
    ...s,
    loyaltyPointsRedeemed: s.loyaltyPointsRedeemed ?? 0,
    loyaltyDiscountPercent: s.loyaltyDiscountPercent ?? 0,
    loyaltyDiscountAmount: s.loyaltyDiscountAmount ?? 0,
    loyaltyPointsEarned: s.loyaltyPointsEarned ?? 0,
    channel: s.channel ?? 'POS',
    syncStatus: s.syncStatus ?? 'synced',
    items: s.items.map((it) => ({
      ...it,
      barcode: it.barcode || generateBaseBarcode(it.sku),
    })),
  }));

  return {
    products,
    stockAdjustments: raw.stockAdjustments ?? seed.stockAdjustments,
    suppliers: raw.suppliers ?? seed.suppliers,
    purchaseOrders: raw.purchaseOrders ?? seed.purchaseOrders,
    customers,
    customerPayments: raw.customerPayments ?? seed.customerPayments,
    loyaltyTransactions: raw.loyaltyTransactions ?? seed.loyaltyTransactions,
    sales,
    expenses: raw.expenses ?? seed.expenses,
    webhookLogs: raw.webhookLogs ?? seed.webhookLogs,
    ecommerceConnectors:
      raw.ecommerceConnectors && raw.ecommerceConnectors.length > 0
        ? raw.ecommerceConnectors
        : seed.ecommerceConnectors,
    offlineModeSimulated: raw.offlineModeSimulated ?? false,
    settings: mergedSettings,
    moduleSchemas: {
      ...seed.moduleSchemas,
      ...(raw.moduleSchemas ?? {}),
    },
    importProfiles: raw.importProfiles ?? [],
  };
}

function consumeFifoLayers(
  layers: CostLayer[],
  qtyToConsume: number,
  fallbackUnitCost: number
): { nextLayers: CostLayer[]; totalFifoCost: number; avgUnitCost: number } {
  let remaining = qtyToConsume;
  let totalCost = 0;
  const nextLayers: CostLayer[] = [];

  for (const layer of layers) {
    if (remaining <= 0) {
      if (layer.quantityRemaining > 0) nextLayers.push(layer);
      continue;
    }
    if (layer.quantityRemaining <= 0) continue;

    const take = Math.min(layer.quantityRemaining, remaining);
    totalCost += take * layer.unitCost;
    remaining -= take;
    const leftover = layer.quantityRemaining - take;
    if (leftover > 0) {
      nextLayers.push({ ...layer, quantityRemaining: leftover });
    }
  }

  if (remaining > 0) {
    totalCost += remaining * fallbackUnitCost;
  }

  const roundedTotal = roundMoney(totalCost);
  const avgUnitCost = qtyToConsume > 0 ? roundMoney(roundedTotal / qtyToConsume) : fallbackUnitCost;
  return { nextLayers, totalFifoCost: roundedTotal, avgUnitCost };
}

function loadInitialState(): ERPState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ERPState>;
      if (parsed && Array.isArray(parsed.products) && parsed.settings) {
        return normalizeState(parsed);
      }
    }
  } catch {
    // Fallback to seed data
  }
  const seed = createSeedState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch {
    // Ignore storage errors
  }
  return seed;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ERPState>(loadInitialState);
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingRestockProductId, setPendingRestockProductId] = useState<string | null>(null);
  const [pendingRestockBatch, setPendingRestockBatch] = useState<PurchaseOrderItem[] | null>(
    null
  );

  const isOnline = browserOnline && !state.offlineModeSimulated;
  const offlineQueueCount = useMemo(
    () => state.sales.filter((s) => s.syncStatus === 'offline_queued').length,
    [state.sales]
  );

  // Sync HTML dir/lang attribute for Arabic RTL & English LTR
  useEffect(() => {
    const lang = state.settings.language;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [state.settings.language]);

  // Listen to real browser connectivity events
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Background mathematical decision engine continuously evaluates current state
  const decisionReport = useMemo(() => runDecisionEngine(state), [state]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Partial<ERPState>;
          if (parsed && Array.isArray(parsed.products)) {
            setState(normalizeState(parsed));
          }
        } catch {
          // Ignore malformed event
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = generateId('toast');
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4400);
  }, []);

  const syncOfflineInvoices = useCallback((): number => {
    let syncedCount = 0;
    setState((prev) => {
      const queued = prev.sales.filter((s) => s.syncStatus === 'offline_queued');
      if (queued.length === 0) return prev;
      syncedCount = queued.length;
      return {
        ...prev,
        sales: prev.sales.map((s) =>
          s.syncStatus === 'offline_queued' ? { ...s, syncStatus: 'synced' as const } : s
        ),
      };
    });
    if (syncedCount > 0) {
      addToast({
        type: 'success',
        title: `Synced ${syncedCount} offline invoice${syncedCount === 1 ? '' : 's'}`,
        description: 'All queued POS transactions are now synchronized with central inventory & accounting.',
      });
    }
    return syncedCount;
  }, [addToast]);

  // Auto-sync queued offline invoices immediately when connection is restored
  useEffect(() => {
    if (isOnline && offlineQueueCount > 0) {
      syncOfflineInvoices();
    }
  }, [isOnline, offlineQueueCount, syncOfflineInvoices]);

  const toggleSimulatedOffline = useCallback(() => {
    setState((prev) => {
      const nextOffline = !prev.offlineModeSimulated;
      addToast({
        type: nextOffline ? 'warning' : 'success',
        title: nextOffline ? 'Offline POS Mode Active' : 'Connection Restored',
        description: nextOffline
          ? 'Sales continue uninterrupted and queue locally until reconnection.'
          : 'Checking local queue for automatic invoice synchronization.',
      });
      return { ...prev, offlineModeSimulated: nextOffline };
    });
  }, [addToast]);

  const saveProduct = useCallback(
    (input: Omit<Product, 'id'> & { id?: string }) => {
      const isEdit = Boolean(input.id);
      const variants = input.variants?.map((v) => ({
        ...v,
        barcode: v.barcode.trim() || generateVariantBarcode(input.sku, v.color, v.size),
      }));
      const computedStock =
        variants && variants.length > 0
          ? variants.reduce((s, v) => s + v.stock, 0)
          : input.stock;
      const barcode = input.barcode.trim() || generateBaseBarcode(input.sku);

      setState((prev) => {
        if (isEdit && input.id) {
          return {
            ...prev,
            products: prev.products.map((p) =>
              p.id === input.id
                ? { ...p, ...input, id: p.id, barcode, stock: computedStock, variants }
                : p
            ),
          };
        }
        const newProduct: Product = {
          ...input,
          id: generateId('prod'),
          barcode,
          stock: computedStock,
          variants,
          costLayers:
            computedStock > 0
              ? [
                  {
                    id: generateId('cl'),
                    date: new Date().toISOString(),
                    quantityRemaining: computedStock,
                    unitCost: input.costPrice,
                    sourceRef: 'Initial Stock',
                  },
                ]
              : [],
        };
        return {
          ...prev,
          products: [newProduct, ...prev.products],
        };
      });
      addToast({
        type: 'success',
        title: isEdit ? 'Product updated' : 'Product added',
        description: `${input.name} (${input.sku}) saved to inventory.`,
      });
    },
    [addToast]
  );

  const updateProductPrice = useCallback(
    (productId: string, newPrice: number) => {
      let label = '';
      setState((prev) => {
        const target = prev.products.find((p) => p.id === productId);
        if (!target) return prev;
        label = `${target.name}: ${prev.settings.currencySymbol}${target.sellingPrice.toFixed(2)} → ${prev.settings.currencySymbol}${newPrice.toFixed(2)}`;
        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId ? { ...p, sellingPrice: roundMoney(newPrice) } : p
          ),
        };
      });
      if (label) {
        addToast({
          type: 'success',
          title: 'Price updated from Decision Engine',
          description: label,
        });
      }
    },
    [addToast]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      let removedName = '';
      setState((prev) => {
        const target = prev.products.find((p) => p.id === id);
        removedName = target?.name ?? 'Product';
        return {
          ...prev,
          products: prev.products.filter((p) => p.id !== id),
        };
      });
      addToast({
        type: 'info',
        title: 'Product removed',
        description: `${removedName} was deleted from the catalog.`,
      });
    },
    [addToast]
  );

  const adjustStock = useCallback(
    (
      productId: string,
      delta: number,
      reason: StockAdjustmentReason,
      notes: string,
      variantId?: string
    ) => {
      let summary = '';
      setState((prev) => {
        const target = prev.products.find((p) => p.id === productId);
        if (!target) return prev;

        let nextStock = Math.max(0, target.stock + delta);
        let updatedVariants = target.variants;
        let labelName = target.name;
        let labelSku = target.sku;

        if (variantId && target.variants && target.variants.length > 0) {
          const variant = target.variants.find((v) => v.id === variantId);
          if (variant) {
            labelName = `${target.name} (${variant.color} / ${variant.size})`;
            labelSku = variant.sku;
            updatedVariants = target.variants.map((v) =>
              v.id === variantId ? { ...v, stock: Math.max(0, v.stock + delta) } : v
            );
            nextStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
          }
        }

        const actualDelta = nextStock - target.stock;
        summary = `${labelName}: ${target.stock} → ${nextStock} (${actualDelta >= 0 ? '+' : ''}${actualDelta})`;

        const adjustment: StockAdjustment = {
          id: generateId('adj'),
          productId: target.id,
          productName: labelName,
          sku: labelSku,
          date: new Date().toISOString(),
          delta: actualDelta,
          previousStock: target.stock,
          newStock: nextStock,
          reason,
          notes: notes.trim() || reason,
        };

        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId ? { ...p, stock: nextStock, variants: updatedVariants } : p
          ),
          stockAdjustments: [adjustment, ...prev.stockAdjustments],
        };
      });

      if (summary) {
        addToast({
          type: 'success',
          title: 'Stock updated',
          description: summary,
        });
      }
    },
    [addToast]
  );

  const completeSale = useCallback(
    (input: CompleteSaleInput): Sale => {
      const nextNum = 1049 + state.sales.length;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum}`;
      const customer =
        state.customers.find((c) => c.id === input.customerId) ?? state.customers[0];

      const costingMethod = state.settings.costingMethod;
      const productById = new Map<string, Product>();
      for (const p of state.products) productById.set(p.id, p);

      // Compute authentic FIFO or Weighted Average COGS per item
      const workingLayers = new Map<string, CostLayer[]>();
      const costedItems = input.items.map((item) => {
        const prod = productById.get(item.productId);
        if (!prod) return item;
        if (costingMethod === 'fifo') {
          const currentLayers =
            workingLayers.get(prod.id) ??
            (prod.costLayers && prod.costLayers.length > 0
              ? prod.costLayers
              : [
                  {
                    id: `cl-fb-${prod.id}`,
                    date: new Date().toISOString(),
                    quantityRemaining: prod.stock,
                    unitCost: prod.costPrice,
                    sourceRef: 'Opening Balance',
                  },
                ]);
          const { nextLayers, avgUnitCost } = consumeFifoLayers(
            currentLayers,
            item.quantity,
            prod.costPrice
          );
          workingLayers.set(prod.id, nextLayers);
          return { ...item, costPrice: avgUnitCost };
        }
        return { ...item, costPrice: prod.costPrice };
      });

      const totalCost = roundMoney(
        costedItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0)
      );

      // Compute loyalty points earned (registered customers only when loyalty is enabled)
      const loyaltyCfg = state.settings.loyalty;
      const loyaltyPointsEarned =
        loyaltyCfg.enabled && customer && !customer.isWalkIn && loyaltyCfg.spendUnit > 0
          ? Math.floor(input.total / loyaltyCfg.spendUnit) * loyaltyCfg.pointsPerUnit
          : 0;

      const sale: Sale = {
        id: generateId('sale'),
        invoiceNumber,
        date: new Date().toISOString(),
        customerId: customer?.id ?? 'cust-walkin',
        customerName: customer?.name ?? 'Walk-in Customer',
        items: costedItems,
        subtotal: roundMoney(input.subtotal),
        itemDiscountsTotal: roundMoney(input.itemDiscountsTotal),
        orderDiscountType: input.orderDiscountType,
        orderDiscountValue: input.orderDiscountValue,
        orderDiscountAmount: roundMoney(input.orderDiscountAmount),
        loyaltyPointsRedeemed: input.loyaltyPointsRedeemed,
        loyaltyDiscountPercent: input.loyaltyDiscountPercent,
        loyaltyDiscountAmount: roundMoney(input.loyaltyDiscountAmount),
        loyaltyPointsEarned,
        taxRate: input.taxRate,
        taxAmount: roundMoney(input.taxAmount),
        total: roundMoney(input.total),
        totalCost,
        costingMethodUsed: costingMethod,
        paymentMethod: input.paymentMethod,
        bnplDetails: input.bnplDetails,
        amountPaid: roundMoney(input.amountPaid),
        cashTendered: input.cashTendered !== undefined ? roundMoney(input.cashTendered) : undefined,
        changeDue: input.changeDue !== undefined ? roundMoney(input.changeDue) : undefined,
        creditAmount: roundMoney(input.creditAmount),
        channel: input.channel ?? 'POS',
        syncStatus: isOnline ? 'synced' : 'offline_queued',
        status: 'Completed',
      };

      setState((prev) => {
        const updatedProducts = prev.products.map((p) => {
          const matchingItems = costedItems.filter((i) => i.productId === p.id);
          if (matchingItems.length === 0) return p;

          const totalSold = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
          const nextLayers =
            workingLayers.get(p.id) ??
            consumeFifoLayers(p.costLayers ?? [], totalSold, p.costPrice).nextLayers;

          if (p.variants && p.variants.length > 0) {
            const updatedVariants = p.variants.map((v) => {
              const soldForVar = matchingItems
                .filter((i) => i.variantId === v.id)
                .reduce((sum, i) => sum + i.quantity, 0);
              if (!soldForVar) return v;
              return { ...v, stock: Math.max(0, v.stock - soldForVar) };
            });
            const baseSold = matchingItems
              .filter((i) => !i.variantId)
              .reduce((sum, i) => sum + i.quantity, 0);
            const totalVarStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
            return {
              ...p,
              variants: updatedVariants,
              stock: Math.max(0, totalVarStock - baseSold),
              costLayers: nextLayers,
            };
          }

          return {
            ...p,
            stock: Math.max(0, p.stock - totalSold),
            costLayers: nextLayers,
          };
        });

        const newLoyaltyTxs: LoyaltyTransaction[] = [];
        const updatedCustomers = prev.customers.map((c) => {
          if (c.id !== sale.customerId) return c;
          const nextPoints = Math.max(
            0,
            c.loyaltyPoints - sale.loyaltyPointsRedeemed + sale.loyaltyPointsEarned
          );

          if (sale.loyaltyPointsRedeemed > 0) {
            newLoyaltyTxs.push({
              id: generateId('ltx'),
              customerId: c.id,
              customerName: c.name,
              date: sale.date,
              pointsDelta: -sale.loyaltyPointsRedeemed,
              type: 'redeemed',
              reference: sale.invoiceNumber,
              note: `Redeemed ${sale.loyaltyDiscountPercent}% loyalty discount`,
            });
          }
          if (sale.loyaltyPointsEarned > 0) {
            newLoyaltyTxs.push({
              id: generateId('ltx'),
              customerId: c.id,
              customerName: c.name,
              date: sale.date,
              pointsDelta: sale.loyaltyPointsEarned,
              type: 'earned',
              reference: sale.invoiceNumber,
              note: `Earned on purchase (${prev.settings.currencySymbol}${sale.total.toFixed(2)})`,
            });
          }

          return {
            ...c,
            totalSpent: roundMoney(c.totalSpent + sale.total),
            orderCount: c.orderCount + 1,
            creditBalance: roundMoney(c.creditBalance + sale.creditAmount),
            loyaltyPoints: nextPoints,
            lifetimePointsEarned: c.lifetimePointsEarned + sale.loyaltyPointsEarned,
          };
        });

        return {
          ...prev,
          products: updatedProducts,
          customers: updatedCustomers,
          loyaltyTransactions: [...newLoyaltyTxs, ...prev.loyaltyTransactions],
          sales: [sale, ...prev.sales],
        };
      });

      addToast({
        type: isOnline ? 'success' : 'warning',
        title: isOnline
          ? `Sale completed · ${invoiceNumber}`
          : `Offline sale queued · ${invoiceNumber}`,
        description: !isOnline
          ? 'Saved locally in Offline POS mode — will auto-sync upon reconnection.'
          : loyaltyPointsEarned > 0
          ? `${sale.customerName} earned +${loyaltyPointsEarned} loyalty pts (${costingMethod.toUpperCase()} COGS).`
          : `${sale.customerName} — inventory deducted (${costingMethod.toUpperCase()}).`,
      });

      return sale;
    },
    [state.sales.length, state.customers, state.products, state.settings, isOnline, addToast]
  );

  const refundSale = useCallback(
    (saleId: string) => {
      let refundedInvoice = '';
      setState((prev) => {
        const target = prev.sales.find((s) => s.id === saleId);
        if (!target || target.status === 'Refunded') return prev;
        refundedInvoice = target.invoiceNumber;

        const now = new Date().toISOString();
        const newAdjustments: StockAdjustment[] = [];
        const updatedProducts = prev.products.map((p) => {
          const matchingItems = target.items.filter((i) => i.productId === p.id);
          if (matchingItems.length === 0) return p;

          let nextStock = p.stock;
          let updatedVariants = p.variants;
          const totalRestore = matchingItems.reduce((sum, i) => sum + i.quantity, 0);

          if (p.variants && p.variants.length > 0) {
            updatedVariants = p.variants.map((v) => {
              const varRestore = matchingItems
                .filter((i) => i.variantId === v.id)
                .reduce((sum, i) => sum + i.quantity, 0);
              return varRestore > 0 ? { ...v, stock: v.stock + varRestore } : v;
            });
            nextStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
          } else {
            nextStock = p.stock + totalRestore;
          }

          const returnedCost =
            matchingItems.reduce((s, it) => s + it.costPrice * it.quantity, 0) /
            Math.max(1, totalRestore);
          const restoredLayer: CostLayer = {
            id: generateId('cl'),
            date: now,
            quantityRemaining: totalRestore,
            unitCost: roundMoney(returnedCost),
            sourceRef: `Refund ${target.invoiceNumber}`,
          };

          newAdjustments.push({
            id: generateId('adj'),
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            date: now,
            delta: totalRestore,
            previousStock: p.stock,
            newStock: nextStock,
            reason: 'Customer Refund',
            notes: `Stock restored from refund of ${target.invoiceNumber}.`,
          });
          return {
            ...p,
            stock: nextStock,
            variants: updatedVariants,
            costLayers: [...(p.costLayers ?? []), restoredLayer],
          };
        });

        const newLoyaltyTxs: LoyaltyTransaction[] = [];
        const updatedCustomers = prev.customers.map((c) => {
          if (c.id !== target.customerId) return c;
          const netPointReversal = target.loyaltyPointsRedeemed - target.loyaltyPointsEarned;
          if (netPointReversal !== 0 && !c.isWalkIn) {
            newLoyaltyTxs.push({
              id: generateId('ltx'),
              customerId: c.id,
              customerName: c.name,
              date: now,
              pointsDelta: netPointReversal,
              type: 'reversed',
              reference: target.invoiceNumber,
              note: `Points reversed on refund of ${target.invoiceNumber}`,
            });
          }
          return {
            ...c,
            totalSpent: Math.max(0, roundMoney(c.totalSpent - target.total)),
            creditBalance: Math.max(0, roundMoney(c.creditBalance - target.creditAmount)),
            loyaltyPoints: Math.max(0, c.loyaltyPoints + netPointReversal),
          };
        });

        const updatedSales = prev.sales.map((s) =>
          s.id === saleId ? { ...s, status: 'Refunded' as const, refundedAt: now } : s
        );

        return {
          ...prev,
          products: updatedProducts,
          stockAdjustments: [...newAdjustments, ...prev.stockAdjustments],
          customers: updatedCustomers,
          loyaltyTransactions: [...newLoyaltyTxs, ...prev.loyaltyTransactions],
          sales: updatedSales,
        };
      });

      if (refundedInvoice) {
        addToast({
          type: 'warning',
          title: `Invoice ${refundedInvoice} refunded`,
          description: 'Inventory restored and customer credit/loyalty points reconciled.',
        });
      }
    },
    [addToast]
  );

  const saveSupplier = useCallback(
    (input: Omit<Supplier, 'id'> & { id?: string }) => {
      const isEdit = Boolean(input.id);
      setState((prev) => {
        if (isEdit && input.id) {
          return {
            ...prev,
            suppliers: prev.suppliers.map((s) =>
              s.id === input.id ? { ...s, ...input, id: s.id } : s
            ),
          };
        }
        return {
          ...prev,
          suppliers: [{ ...input, id: generateId('sup') }, ...prev.suppliers],
        };
      });
      addToast({
        type: 'success',
        title: isEdit ? 'Supplier updated' : 'Supplier added',
        description: `${input.name} saved to supplier directory.`,
      });
    },
    [addToast]
  );

  const recordSupplierPayment = useCallback(
    (supplierId: string, amount: number) => {
      let supplierName = '';
      setState((prev) => {
        const target = prev.suppliers.find((s) => s.id === supplierId);
        if (!target) return prev;
        supplierName = target.name;
        const nextBalance = Math.max(0, roundMoney(target.balanceOwed - amount));
        return {
          ...prev,
          suppliers: prev.suppliers.map((s) =>
            s.id === supplierId ? { ...s, balanceOwed: nextBalance } : s
          ),
        };
      });
      if (supplierName) {
        addToast({
          type: 'success',
          title: 'Supplier payment recorded',
          description: `Applied payment to ${supplierName}.`,
        });
      }
    },
    [addToast]
  );

  const applyPOReceivedState = (prev: ERPState, po: PurchaseOrder): ERPState => {
    const now = new Date().toISOString();
    const newAdjustments: StockAdjustment[] = [];
    const itemMap = new Map<string, PurchaseOrderItem>();
    for (const item of po.items) {
      itemMap.set(item.productId, item);
    }

    const updatedProducts = prev.products.map((p) => {
      const poItem = itemMap.get(p.id);
      if (!poItem) return p;

      const prevStock = p.stock;
      const nextStock = prevStock + poItem.quantity;
      const totalValue = prevStock * p.costPrice + poItem.quantity * poItem.unitCost;
      const updatedCost =
        nextStock > 0 ? roundMoney(totalValue / nextStock) : roundMoney(poItem.unitCost);

      // Distribute received stock across variants evenly if product uses variants
      let updatedVariants = p.variants;
      if (p.variants && p.variants.length > 0) {
        const perVar = Math.floor(poItem.quantity / p.variants.length);
        const remainder = poItem.quantity % p.variants.length;
        updatedVariants = p.variants.map((v, idx) => ({
          ...v,
          stock: v.stock + perVar + (idx < remainder ? 1 : 0),
        }));
      }

      newAdjustments.push({
        id: generateId('adj'),
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        date: now,
        delta: poItem.quantity,
        previousStock: prevStock,
        newStock: nextStock,
        reason: 'Purchase Order',
        notes: `Received ${po.poNumber} from ${po.supplierName} @ ${prev.settings.currencySymbol}${poItem.unitCost.toFixed(2)}/unit.`,
      });

      const newLayer: CostLayer = {
        id: generateId('cl'),
        date: now,
        quantityRemaining: poItem.quantity,
        unitCost: poItem.unitCost,
        sourceRef: po.poNumber,
      };

      return {
        ...p,
        stock: nextStock,
        costPrice: updatedCost,
        variants: updatedVariants,
        costLayers: [...(p.costLayers ?? []), newLayer],
      };
    });

    const updatedSuppliers = prev.suppliers.map((s) =>
      s.id === po.supplierId
        ? { ...s, balanceOwed: roundMoney(s.balanceOwed + po.totalCost) }
        : s
    );

    const updatedPOs = prev.purchaseOrders.map((existing) =>
      existing.id === po.id
        ? { ...existing, status: 'Received' as const, receivedDate: now }
        : existing
    );

    return {
      ...prev,
      products: updatedProducts,
      stockAdjustments: [...newAdjustments, ...prev.stockAdjustments],
      suppliers: updatedSuppliers,
      purchaseOrders: updatedPOs,
    };
  };

  const createPurchaseOrder = useCallback(
    (input: {
      supplierId: string;
      items: PurchaseOrderItem[];
      notes: string;
      markReceivedImmediately?: boolean;
      customFields?: Record<string, string>;
    }): PurchaseOrder => {
      const supplier = state.suppliers.find((s) => s.id === input.supplierId);
      const nextNumber = 44 + state.purchaseOrders.length;
      const poNumber = `PO-${new Date().getFullYear()}-0${nextNumber}`;
      const totalCost = roundMoney(
        input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
      );

      const po: PurchaseOrder = {
        id: generateId('po'),
        poNumber,
        supplierId: input.supplierId,
        supplierName: supplier?.name ?? 'Unknown Supplier',
        date: new Date().toISOString(),
        status: 'Pending',
        items: input.items,
        totalCost,
        notes: input.notes.trim(),
        customFields: input.customFields,
      };

      setState((prev) => {
        const withNewPO: ERPState = {
          ...prev,
          purchaseOrders: [po, ...prev.purchaseOrders],
        };
        if (input.markReceivedImmediately) {
          return applyPOReceivedState(withNewPO, po);
        }
        return withNewPO;
      });

      addToast({
        type: 'success',
        title: input.markReceivedImmediately
          ? `PO received · ${poNumber}`
          : `PO created · ${poNumber}`,
        description: input.markReceivedImmediately
          ? 'Inventory stock and weighted average costs updated.'
          : `Order placed with ${po.supplierName}.`,
      });

      return po;
    },
    [state.suppliers, state.purchaseOrders.length, addToast]
  );

  const receivePurchaseOrder = useCallback(
    (poId: string) => {
      let receivedNumber = '';
      setState((prev) => {
        const target = prev.purchaseOrders.find((p) => p.id === poId);
        if (!target || target.status === 'Received') return prev;
        receivedNumber = target.poNumber;
        return applyPOReceivedState(prev, target);
      });

      if (receivedNumber) {
        addToast({
          type: 'success',
          title: `${receivedNumber} marked received`,
          description: 'Stock quantities increased and product unit costs updated.',
        });
      }
    },
    [addToast]
  );

  const saveCustomer = useCallback(
    (
      input: Omit<Customer, 'id' | 'totalSpent' | 'orderCount' | 'lifetimePointsEarned'> & {
        id?: string;
      }
    ) => {
      const isEdit = Boolean(input.id);
      setState((prev) => {
        if (isEdit && input.id) {
          return {
            ...prev,
            customers: prev.customers.map((c) =>
              c.id === input.id ? { ...c, ...input, id: c.id } : c
            ),
          };
        }
        const newCustomer: Customer = {
          ...input,
          id: generateId('cust'),
          totalSpent: 0,
          orderCount: 0,
          lifetimePointsEarned: input.loyaltyPoints ?? 0,
        };
        return {
          ...prev,
          customers: [...prev.customers, newCustomer],
        };
      });
      addToast({
        type: 'success',
        title: isEdit ? 'Customer updated' : 'Customer added',
        description: `${input.name} saved to directory.`,
      });
    },
    [addToast]
  );

  const quickEnrollCustomer = useCallback(
    (input: { name: string; phone: string; email: string }): Customer => {
      const newCustomer: Customer = {
        id: generateId('cust'),
        name: input.name.trim() || input.phone.trim() || input.email.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        address: '',
        totalSpent: 0,
        orderCount: 0,
        creditBalance: 0,
        loyaltyPoints: 0,
        lifetimePointsEarned: 0,
      };
      setState((prev) => ({
        ...prev,
        customers: [...prev.customers, newCustomer],
      }));
      addToast({
        type: 'success',
        title: 'Loyalty member enrolled',
        description: `${newCustomer.name} is now active and selected for checkout.`,
      });
      return newCustomer;
    },
    [addToast]
  );

  const recordCustomerPayment = useCallback(
    (
      customerId: string,
      amount: number,
      method: ExpensePaymentMethod,
      notes: string
    ) => {
      let customerName = '';
      setState((prev) => {
        const target = prev.customers.find((c) => c.id === customerId);
        if (!target) return prev;
        customerName = target.name;
        const applied = Math.min(target.creditBalance, roundMoney(amount));
        const payment: CustomerPayment = {
          id: generateId('cpay'),
          customerId,
          customerName: target.name,
          date: new Date().toISOString(),
          amount: applied,
          method,
          notes: notes.trim() || 'Credit balance settlement',
        };
        return {
          ...prev,
          customers: prev.customers.map((c) =>
            c.id === customerId
              ? { ...c, creditBalance: Math.max(0, roundMoney(c.creditBalance - applied)) }
              : c
          ),
          customerPayments: [payment, ...prev.customerPayments],
        };
      });
      if (customerName) {
        addToast({
          type: 'success',
          title: 'Customer payment recorded',
          description: `Credit balance updated for ${customerName}.`,
        });
      }
    },
    [addToast]
  );

  const saveExpense = useCallback(
    (input: Omit<Expense, 'id'> & { id?: string }) => {
      const isEdit = Boolean(input.id);
      setState((prev) => {
        if (isEdit && input.id) {
          return {
            ...prev,
            expenses: prev.expenses.map((e) =>
              e.id === input.id ? { ...e, ...input, id: e.id } : e
            ),
          };
        }
        return {
          ...prev,
          expenses: [{ ...input, id: generateId('exp') }, ...prev.expenses],
        };
      });
      addToast({
        type: 'success',
        title: isEdit ? 'Expense updated' : 'Expense recorded',
        description: `${input.category} — ${input.vendor}`,
      });
    },
    [addToast]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== id),
      }));
      addToast({
        type: 'info',
        title: 'Expense removed',
        description: 'Profit & Loss summary recalculated.',
      });
    },
    [addToast]
  );

  const saveModuleCustomFields = useCallback(
    (module: ModuleKey, fields: CustomFieldDefinition[]) => {
      setState((prev) => ({
        ...prev,
        moduleSchemas: {
          ...prev.moduleSchemas,
          [module]: fields,
        },
      }));
      addToast({
        type: 'success',
        title: 'Custom schema saved',
        description: `Updated ${fields.length} custom field(s) for ${module}.`,
      });
    },
    [addToast]
  );

  const saveImportProfile = useCallback(
    (profile: Omit<ImportProfile, 'id'> & { id?: string }) => {
      setState((prev) => {
        if (profile.id) {
          return {
            ...prev,
            importProfiles: prev.importProfiles.map((p) =>
              p.id === profile.id ? { ...profile, id: p.id } : p
            ),
          };
        }
        return {
          ...prev,
          importProfiles: [{ ...profile, id: generateId('prof') }, ...prev.importProfiles],
        };
      });
      addToast({
        type: 'success',
        title: 'Import format profile saved',
        description: `"${profile.name}" is ready for reuse on future uploads.`,
      });
    },
    [addToast]
  );

  const deleteImportProfile = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      importProfiles: prev.importProfiles.filter((p) => p.id !== id),
    }));
  }, []);

  const applyBulkImport = useCallback(
    (
      module: ModuleKey,
      rows: { system: Record<string, string>; custom: Record<string, string> }[]
    ): number => {
      if (rows.length === 0) return 0;
      let importedCount = 0;

      setState((prev) => {
        const now = new Date().toISOString();

        if (module === 'inventory') {
          const updatedProducts = [...prev.products];
          const newAdjustments: StockAdjustment[] = [];

          for (const row of rows) {
            const sku = (row.system.sku || '').trim().toUpperCase();
            const name = (row.system.name || '').trim();
            if (!sku || !name) continue;
            const costPrice = Math.max(0, parseFloat(row.system.costPrice) || 0);
            const sellingPrice = Math.max(0, parseFloat(row.system.sellingPrice) || 0);
            const stock = Math.max(0, parseInt(row.system.stock, 10) || 0);
            const reorderLevel = Math.max(0, parseInt(row.system.reorderLevel, 10) || 5);
            const category = (row.system.category || 'General').trim();
            const unit = (row.system.unit || 'each').trim();
            const color = (row.system.color || '').trim();
            const size = (row.system.size || '').trim();
            const rawBarcode = (row.system.barcode || '').trim();

            const existingIdx = updatedProducts.findIndex(
              (p) => p.sku.toUpperCase() === sku
            );

            if (color || size) {
              const varBarcode =
                rawBarcode || generateVariantBarcode(sku, color || 'STD', size || 'ONE');
              const variant: ProductVariant = {
                id: generateId('var'),
                color: color || 'Standard',
                size: size || 'One Size',
                sku: `${sku}-${(color || 'STD').slice(0, 3).toUpperCase()}-${(size || 'ONE').slice(0, 3).toUpperCase()}`,
                barcode: varBarcode,
                stock,
              };

              if (existingIdx >= 0) {
                const existing = updatedProducts[existingIdx];
                const nextVariants = [...(existing.variants ?? []), variant];
                const nextStock = nextVariants.reduce((s, v) => s + v.stock, 0);
                updatedProducts[existingIdx] = {
                  ...existing,
                  variants: nextVariants,
                  stock: nextStock,
                  customFields: { ...(existing.customFields ?? {}), ...row.custom },
                };
              } else {
                updatedProducts.unshift({
                  id: generateId('prod'),
                  sku,
                  barcode: generateBaseBarcode(sku),
                  name,
                  category,
                  costPrice,
                  sellingPrice,
                  stock,
                  reorderLevel,
                  unit,
                  variants: [variant],
                  customFields: row.custom,
                });
              }
            } else if (existingIdx >= 0) {
              const existing = updatedProducts[existingIdx];
              updatedProducts[existingIdx] = {
                ...existing,
                name,
                category,
                costPrice,
                sellingPrice,
                stock,
                reorderLevel,
                unit,
                barcode: rawBarcode || existing.barcode,
                customFields: { ...(existing.customFields ?? {}), ...row.custom },
              };
            } else {
              updatedProducts.unshift({
                id: generateId('prod'),
                sku,
                barcode: rawBarcode || generateBaseBarcode(sku),
                name,
                category,
                costPrice,
                sellingPrice,
                stock,
                reorderLevel,
                unit,
                customFields: row.custom,
              });
            }

            newAdjustments.push({
              id: generateId('adj'),
              productId: sku,
              productName: color || size ? `${name} (${color}/${size})` : name,
              sku,
              date: now,
              delta: stock,
              previousStock: 0,
              newStock: stock,
              reason: 'Data Import',
              notes: 'Bulk data migration import',
            });
            importedCount++;
          }

          return {
            ...prev,
            products: updatedProducts,
            stockAdjustments: [...newAdjustments, ...prev.stockAdjustments],
          };
        }

        if (module === 'customers') {
          const nextCustomers = [...prev.customers];
          for (const row of rows) {
            const name = (row.system.name || '').trim();
            if (!name) continue;
            const pts = Math.max(0, parseInt(row.system.loyaltyPoints, 10) || 0);
            nextCustomers.push({
              id: generateId('cust'),
              name,
              phone: (row.system.phone || '').trim(),
              email: (row.system.email || '').trim(),
              address: (row.system.address || '').trim(),
              creditBalance: Math.max(0, parseFloat(row.system.creditBalance) || 0),
              loyaltyPoints: pts,
              lifetimePointsEarned: pts,
              totalSpent: 0,
              orderCount: 0,
              customFields: row.custom,
            });
            importedCount++;
          }
          return { ...prev, customers: nextCustomers };
        }

        if (module === 'suppliers') {
          const nextSuppliers = [...prev.suppliers];
          for (const row of rows) {
            const name = (row.system.name || '').trim();
            if (!name) continue;
            nextSuppliers.unshift({
              id: generateId('sup'),
              name,
              contactPerson: (row.system.contactPerson || '').trim(),
              phone: (row.system.phone || '').trim(),
              email: (row.system.email || '').trim(),
              address: (row.system.address || '').trim(),
              balanceOwed: Math.max(0, parseFloat(row.system.balanceOwed) || 0),
              customFields: row.custom,
            });
            importedCount++;
          }
          return { ...prev, suppliers: nextSuppliers };
        }

        if (module === 'expenses') {
          const validCats: ExpenseCategory[] = [
            'Rent',
            'Utilities',
            'Salaries',
            'Supplies',
            'Marketing',
            'Maintenance',
            'Other',
          ];
          const nextExpenses = [...prev.expenses];
          for (const row of rows) {
            const vendor = (row.system.vendor || '').trim();
            const amount = parseFloat(row.system.amount) || 0;
            if (!vendor || amount <= 0) continue;
            const rawCat = (row.system.category || 'Other').trim();
            const matchedCat =
              validCats.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? 'Other';
            const rawMethod = (row.system.paymentMethod || 'Card').trim();
            const method: ExpensePaymentMethod =
              rawMethod.toLowerCase() === 'cash'
                ? 'Cash'
                : rawMethod.toLowerCase().includes('bank')
                ? 'Bank Transfer'
                : 'Card';
            const parsedDate = row.system.date ? new Date(row.system.date) : new Date();
            const safeIso = isNaN(parsedDate.getTime()) ? now : parsedDate.toISOString();

            nextExpenses.unshift({
              id: generateId('exp'),
              date: safeIso,
              category: matchedCat,
              vendor,
              amount: roundMoney(amount),
              paymentMethod: method,
              notes: (row.system.notes || 'Imported record').trim(),
              customFields: row.custom,
            });
            importedCount++;
          }
          return { ...prev, expenses: nextExpenses };
        }

        if (module === 'sales') {
          const nextSales = [...prev.sales];
          for (const row of rows) {
            const sku = (row.system.sku || '').trim().toUpperCase();
            const qty = Math.max(1, parseInt(row.system.quantity, 10) || 1);
            const unitPrice = Math.max(0, parseFloat(row.system.unitPrice) || 0);
            if (!sku || unitPrice <= 0) continue;
            const matchedProd = prev.products.find((p) => p.sku.toUpperCase() === sku);
            const costPrice = matchedProd?.costPrice ?? roundMoney(unitPrice * 0.5);
            const subtotal = roundMoney(unitPrice * qty);
            const taxAmount = roundMoney((subtotal * prev.settings.taxRate) / 100);
            const total = roundMoney(subtotal + taxAmount);
            const rawPay = (row.system.paymentMethod || 'Card').trim();
            const paymentMethod: PaymentMethod =
              rawPay.toLowerCase() === 'cash'
                ? 'Cash'
                : rawPay.toLowerCase().includes('credit') || rawPay.toLowerCase().includes('split')
                ? 'Split/Credit'
                : 'Card';
            const parsedDate = row.system.date ? new Date(row.system.date) : new Date();
            const safeIso = isNaN(parsedDate.getTime()) ? now : parsedDate.toISOString();

            nextSales.unshift({
              id: generateId('sale'),
              invoiceNumber:
                (row.system.invoiceNumber || '').trim() ||
                `IMP-${Date.now().toString().slice(-5)}-${importedCount + 1}`,
              date: safeIso,
              customerId: 'cust-walkin',
              customerName: (row.system.customerName || 'Walk-in Customer').trim(),
              items: [
                {
                  productId: matchedProd?.id ?? sku,
                  productName: matchedProd?.name ?? `Imported SKU ${sku}`,
                  sku,
                  barcode: matchedProd?.barcode ?? generateBaseBarcode(sku),
                  quantity: qty,
                  unitPrice,
                  costPrice,
                  discountType: 'fixed',
                  discountValue: 0,
                  discountAmount: 0,
                  lineTotal: subtotal,
                },
              ],
              subtotal,
              itemDiscountsTotal: 0,
              orderDiscountType: 'fixed',
              orderDiscountValue: 0,
              orderDiscountAmount: 0,
              loyaltyPointsRedeemed: 0,
              loyaltyDiscountPercent: 0,
              loyaltyDiscountAmount: 0,
              loyaltyPointsEarned: 0,
              taxRate: prev.settings.taxRate,
              taxAmount,
              total,
              totalCost: roundMoney(costPrice * qty),
              paymentMethod,
              amountPaid: total,
              creditAmount: 0,
              status: 'Completed',
              customFields: row.custom,
            });
            importedCount++;
          }
          return { ...prev, sales: nextSales };
        }

        if (module === 'purchases') {
          const nextPOs = [...prev.purchaseOrders];
          for (const row of rows) {
            const supplierName = (row.system.supplierName || '').trim();
            const sku = (row.system.sku || '').trim().toUpperCase();
            const qty = Math.max(1, parseInt(row.system.quantity, 10) || 1);
            const unitCost = Math.max(0, parseFloat(row.system.unitCost) || 0);
            if (!supplierName || !sku) continue;
            const matchedSup = prev.suppliers.find(
              (s) => s.name.toLowerCase() === supplierName.toLowerCase()
            );
            const matchedProd = prev.products.find((p) => p.sku.toUpperCase() === sku);
            const status =
              (row.system.status || '').toLowerCase() === 'received' ? 'Received' : 'Pending';
            const parsedDate = row.system.date ? new Date(row.system.date) : new Date();
            const safeIso = isNaN(parsedDate.getTime()) ? now : parsedDate.toISOString();

            nextPOs.unshift({
              id: generateId('po'),
              poNumber:
                (row.system.poNumber || '').trim() ||
                `PO-IMP-${Date.now().toString().slice(-4)}-${importedCount + 1}`,
              supplierId: matchedSup?.id ?? prev.suppliers[0]?.id ?? 'sup-1',
              supplierName,
              date: safeIso,
              receivedDate: status === 'Received' ? safeIso : undefined,
              status,
              items: [
                {
                  productId: matchedProd?.id ?? sku,
                  productName: matchedProd?.name ?? `Imported SKU ${sku}`,
                  sku,
                  quantity: qty,
                  unitCost,
                },
              ],
              totalCost: roundMoney(qty * unitCost),
              notes: (row.system.notes || 'Historical PO import').trim(),
              customFields: row.custom,
            });
            importedCount++;
          }
          return { ...prev, purchaseOrders: nextPOs };
        }

        return prev;
      });

      addToast({
        type: 'success',
        title: `Imported ${importedCount} record${importedCount === 1 ? '' : 's'}`,
        description: `Successfully migrated data into ${module} and recalculated Decision Engine.`,
      });
      return importedCount;
    },
    [addToast]
  );

  const setLanguage = useCallback((lang: Language) => {
    setState((prev) => {
      const preset = REGIONAL_PRESETS.find((r) => r.code === prev.settings.currencyCode);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          language: lang,
          currencySymbol: preset
            ? lang === 'ar'
              ? preset.symbolAr
              : preset.symbolEn
            : prev.settings.currencySymbol,
        },
      };
    });
  }, []);

  const applyRegionalPreset = useCallback(
    (code: CurrencyCode) => {
      const preset = REGIONAL_PRESETS.find((r) => r.code === code);
      if (!preset) return;
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          currencyCode: code,
          currencySymbol: prev.settings.language === 'ar' ? preset.symbolAr : preset.symbolEn,
          taxRate: preset.defaultVat,
          zatcaEnabled: preset.zatcaDefault,
        },
      }));
      addToast({
        type: 'success',
        title: `Regional preset applied (${code})`,
        description: `Currency & VAT (${preset.defaultVat}%) updated across POS and receipts.`,
      });
    },
    [addToast]
  );

  const regenerateWebhookKey = useCallback(() => {
    const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const nextKey = `lf_live_mena_${rand}`;
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, webhookApiKey: nextKey },
    }));
    addToast({
      type: 'info',
      title: 'Webhook API Key Rotated',
      description: 'Update your external ERP connector with the new bearer token.',
    });
  }, [addToast]);

  const toggleWebhookDailySync = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        webhookAutoDailySync: !prev.settings.webhookAutoDailySync,
      },
    }));
  }, []);

  const ingestWebhookPayload = useCallback(
    (
      endpoint: WebhookLog['endpoint'],
      sourceSystem: string,
      rawJson: string
    ): { ok: boolean; message: string } => {
      const now = new Date().toISOString();
      try {
        const payload = JSON.parse(rawJson) as Record<string, unknown>;
        if (endpoint === '/api/v1/webhooks/sales') {
          const orders = Array.isArray(payload.orders) ? payload.orders : [payload];
          let ingested = 0;

          setState((prev) => {
            const nextSales = [...prev.sales];
            let nextProducts = [...prev.products];

            for (const rawOrd of orders) {
              const ord = rawOrd as Record<string, unknown>;
              const sku = String(ord.sku ?? '').trim().toUpperCase();
              const qty = Math.max(1, Number(ord.quantity) || 1);
              if (!sku) continue;
              const matchedProd = nextProducts.find((p) => p.sku.toUpperCase() === sku);
              const unitPrice = Number(ord.unitPrice) || matchedProd?.sellingPrice || 25;
              const costPrice = matchedProd?.costPrice || roundMoney(unitPrice * 0.5);
              const subtotal = roundMoney(unitPrice * qty);
              const taxAmount = roundMoney((subtotal * prev.settings.taxRate) / 100);
              const total = roundMoney(subtotal + taxAmount);

              if (matchedProd) {
                nextProducts = nextProducts.map((p) =>
                  p.id === matchedProd.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p
                );
              }

              nextSales.unshift({
                id: generateId('sale'),
                invoiceNumber:
                  String(ord.invoiceNumber || '') ||
                  `WH-${Date.now().toString().slice(-5)}-${ingested + 1}`,
                date: now,
                customerId: 'cust-walkin',
                customerName: String(ord.customerName || `${sourceSystem} Customer`),
                items: [
                  {
                    productId: matchedProd?.id ?? sku,
                    productName: matchedProd?.name ?? `Webhook SKU ${sku}`,
                    sku,
                    barcode: matchedProd?.barcode ?? generateBaseBarcode(sku),
                    quantity: qty,
                    unitPrice,
                    costPrice,
                    discountType: 'fixed',
                    discountValue: 0,
                    discountAmount: 0,
                    lineTotal: subtotal,
                  },
                ],
                subtotal,
                itemDiscountsTotal: 0,
                orderDiscountType: 'fixed',
                orderDiscountValue: 0,
                orderDiscountAmount: 0,
                loyaltyPointsRedeemed: 0,
                loyaltyDiscountPercent: 0,
                loyaltyDiscountAmount: 0,
                loyaltyPointsEarned: 0,
                taxRate: prev.settings.taxRate,
                taxAmount,
                total,
                totalCost: roundMoney(costPrice * qty),
                costingMethodUsed: prev.settings.costingMethod,
                paymentMethod: 'Card',
                amountPaid: total,
                creditAmount: 0,
                channel: 'Webhook',
                syncStatus: 'synced',
                status: 'Completed',
              });
              ingested++;
            }

            const log: WebhookLog = {
              id: generateId('wh'),
              timestamp: now,
              endpoint,
              sourceSystem,
              status: 200,
              summary: `Ingested ${ingested} order(s) from ${sourceSystem}`,
              payloadPreview: rawJson.slice(0, 110),
            };

            return {
              ...prev,
              products: nextProducts,
              sales: nextSales,
              webhookLogs: [log, ...prev.webhookLogs].slice(0, 25),
            };
          });

          const msg = `200 OK — Ingested ${ingested} sales order(s) from ${sourceSystem}.`;
          addToast({ type: 'success', title: 'Webhook Sales Received', description: msg });
          return { ok: true, message: msg };
        }

        // Inventory balance webhook
        const items = Array.isArray(payload.items) ? payload.items : [payload];
        let updatedCount = 0;

        setState((prev) => {
          const nextProducts = [...prev.products];
          const nextAdj = [...prev.stockAdjustments];

          for (const rawItem of items) {
            const it = rawItem as Record<string, unknown>;
            const sku = String(it.sku ?? '').trim().toUpperCase();
            const nextStock = Math.max(0, Number(it.stock));
            if (!sku || isNaN(nextStock)) continue;
            const idx = nextProducts.findIndex((p) => p.sku.toUpperCase() === sku);
            if (idx >= 0) {
              const target = nextProducts[idx];
              const delta = nextStock - target.stock;
              const nextUnitCost = Number(it.costPrice) || target.costPrice;
              nextProducts[idx] = {
                ...target,
                stock: nextStock,
                costPrice: nextUnitCost,
                costLayers:
                  delta > 0
                    ? [
                        ...(target.costLayers ?? []),
                        {
                          id: generateId('cl'),
                          date: now,
                          quantityRemaining: delta,
                          unitCost: nextUnitCost,
                          sourceRef: `${sourceSystem} Webhook`,
                        },
                      ]
                    : target.costLayers,
              };
              nextAdj.unshift({
                id: generateId('adj'),
                productId: target.id,
                productName: target.name,
                sku: target.sku,
                date: now,
                delta,
                previousStock: target.stock,
                newStock: nextStock,
                reason: 'Webhook Sync',
                notes: `Automated stock balance sync from ${sourceSystem}`,
              });
              updatedCount++;
            }
          }

          const log: WebhookLog = {
            id: generateId('wh'),
            timestamp: now,
            endpoint,
            sourceSystem,
            status: 200,
            summary: `Updated ${updatedCount} SKU balance(s) from ${sourceSystem}`,
            payloadPreview: rawJson.slice(0, 110),
          };

          return {
            ...prev,
            products: nextProducts,
            stockAdjustments: nextAdj,
            webhookLogs: [log, ...prev.webhookLogs].slice(0, 25),
          };
        });

        const msg = `200 OK — Reconciled ${updatedCount} inventory SKU(s) from ${sourceSystem}.`;
        addToast({ type: 'success', title: 'Webhook Inventory Synced', description: msg });
        return { ok: true, message: msg };
      } catch {
        const failLog: WebhookLog = {
          id: generateId('wh'),
          timestamp: now,
          endpoint,
          sourceSystem,
          status: 400,
          summary: 'Invalid JSON payload rejected',
          payloadPreview: rawJson.slice(0, 110),
        };
        setState((prev) => ({
          ...prev,
          webhookLogs: [failLog, ...prev.webhookLogs].slice(0, 25),
        }));
        addToast({
          type: 'error',
          title: 'Webhook Rejected (400)',
          description: 'Please provide valid JSON matching the webhook schema.',
        });
        return { ok: false, message: '400 Bad Request — Invalid JSON format.' };
      }
    },
    [addToast]
  );

  const updateEcommerceConnector = useCallback(
    (id: EcommerceConnector['id'], patch: Partial<EcommerceConnector>) => {
      setState((prev) => ({
        ...prev,
        ecommerceConnectors: prev.ecommerceConnectors.map((c) =>
          c.id === id ? { ...c, ...patch } : c
        ),
      }));
      addToast({
        type: 'success',
        title: 'Storefront connector updated',
        description: 'E-commerce sync preferences saved.',
      });
    },
    [addToast]
  );

  const syncEcommerceConnector = useCallback(
    (id: EcommerceConnector['id']) => {
      const now = new Date().toISOString();
      const channelMap: Record<EcommerceConnector['id'], SaleChannel> = {
        salla: 'Salla',
        zid: 'Zid',
        shopify: 'Shopify',
      };
      const channel = channelMap[id];
      const buyerNames: Record<EcommerceConnector['id'], string> = {
        salla: 'عبدالله الدوسري (سلة)',
        zid: 'نورة الشمري (زد)',
        shopify: 'Omar Mansour (Shopify)',
      };

      setState((prev) => {
        const inStock = prev.products.filter((p) => p.stock >= 2);
        const picked = inStock[Math.floor(Math.random() * Math.max(1, inStock.length))];
        if (!picked) return prev;

        const qty = 1;
        const subtotal = roundMoney(picked.sellingPrice * qty);
        const taxAmount = roundMoney((subtotal * prev.settings.taxRate) / 100);
        const total = roundMoney(subtotal + taxAmount);

        const newSale: Sale = {
          id: generateId('sale'),
          invoiceNumber: `${channel.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-5)}`,
          date: now,
          customerId: 'cust-walkin',
          customerName: buyerNames[id],
          items: [
            {
              productId: picked.id,
              productName: picked.name,
              sku: picked.sku,
              barcode: picked.barcode,
              quantity: qty,
              unitPrice: picked.sellingPrice,
              costPrice: picked.costPrice,
              discountType: 'fixed',
              discountValue: 0,
              discountAmount: 0,
              lineTotal: subtotal,
            },
          ],
          subtotal,
          itemDiscountsTotal: 0,
          orderDiscountType: 'fixed',
          orderDiscountValue: 0,
          orderDiscountAmount: 0,
          loyaltyPointsRedeemed: 0,
          loyaltyDiscountPercent: 0,
          loyaltyDiscountAmount: 0,
          loyaltyPointsEarned: 0,
          taxRate: prev.settings.taxRate,
          taxAmount,
          total,
          totalCost: roundMoney(picked.costPrice * qty),
          costingMethodUsed: prev.settings.costingMethod,
          paymentMethod: 'Card',
          amountPaid: total,
          creditAmount: 0,
          channel,
          syncStatus: 'synced',
          status: 'Completed',
        };

        const updatedProducts = prev.products.map((p) =>
          p.id === picked.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p
        );

        const updatedConnectors = prev.ecommerceConnectors.map((c) =>
          c.id === id
            ? {
                ...c,
                connected: true,
                lastSyncAt: now,
                syncedOrdersCount: c.syncedOrdersCount + 1,
              }
            : c
        );

        return {
          ...prev,
          products: updatedProducts,
          sales: [newSale, ...prev.sales],
          ecommerceConnectors: updatedConnectors,
        };
      });

      addToast({
        type: 'success',
        title: `${channel} Synced`,
        description: `Pushed live stock counts and imported latest ${channel} order into Sales History.`,
      });
    },
    [addToast]
  );

  const updateSettings = useCallback(
    (settings: BusinessSettings) => {
      setState((prev) => ({
        ...prev,
        settings,
      }));
      addToast({
        type: 'success',
        title: 'Settings saved',
        description: 'Localization, ZATCA tax, costing method, and loyalty rules updated.',
      });
    },
    [addToast]
  );

  const resetDemoData = useCallback(() => {
    const fresh = createSeedState();
    setState(fresh);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore
    }
    addToast({
      type: 'info',
      title: 'Demo data restored',
      description: 'All inventory, FIFO cost layers, ZATCA settings, connectors, and records reset.',
    });
  }, [addToast]);

  return (
    <StoreContext.Provider
      value={{
        state,
        decisionReport,
        toasts,
        isOnline,
        offlineQueueCount,
        addToast,
        dismissToast,
        toggleSimulatedOffline,
        syncOfflineInvoices,
        pendingRestockProductId,
        setPendingRestockProductId,
        pendingRestockBatch,
        setPendingRestockBatch,
        saveProduct,
        updateProductPrice,
        deleteProduct,
        adjustStock,
        completeSale,
        refundSale,
        saveSupplier,
        recordSupplierPayment,
        createPurchaseOrder,
        receivePurchaseOrder,
        saveCustomer,
        quickEnrollCustomer,
        recordCustomerPayment,
        saveExpense,
        deleteExpense,
        saveModuleCustomFields,
        saveImportProfile,
        deleteImportProfile,
        applyBulkImport,
        setLanguage,
        applyRegionalPreset,
        regenerateWebhookKey,
        toggleWebhookDailySync,
        ingestWebhookPayload,
        updateEcommerceConnector,
        syncEcommerceConnector,
        updateSettings,
        resetDemoData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return ctx;
}
