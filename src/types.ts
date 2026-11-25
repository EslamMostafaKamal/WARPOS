export type AppModule =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'expenses'
  | 'decisions'
  | 'integrations'
  | 'settings';

export type ModuleKey =
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'expenses';

export type Language = 'en' | 'ar';

export type CurrencyCode = 'SAR' | 'EGP' | 'AED' | 'USD';

export type CostingMethod = 'weighted_average' | 'fifo';

export type DiscountType = 'percent' | 'fixed';

export type PaymentMethod = 'Cash' | 'Card' | 'Split/Credit' | 'BNPL';

export type BNPLProvider = 'ValU' | 'Tabby' | 'Tamara' | 'Sympl' | 'Souhoola' | 'Custom';

export type SaleChannel = 'POS' | 'Salla' | 'Zid' | 'Shopify' | 'Webhook' | 'Import';

export type ExpensePaymentMethod = 'Cash' | 'Card' | 'Bank Transfer';

export type StockAdjustmentReason =
  | 'Damaged'
  | 'Expired'
  | 'Stock Count Correction'
  | 'Shrinkage'
  | 'Purchase Order'
  | 'Customer Refund'
  | 'Data Import'
  | 'Webhook Sync'
  | 'Other';

export type ExpenseCategory =
  | 'Rent'
  | 'Utilities'
  | 'Salaries'
  | 'Supplies'
  | 'Marketing'
  | 'Maintenance'
  | 'Other';

export interface CostLayer {
  id: string;
  date: string;
  quantityRemaining: number;
  unitCost: number;
  sourceRef: string;
}

export interface ProductVariant {
  id: string;
  color: string;
  size: string;
  sku: string;
  barcode: string;
  stock: number;
  priceOverride?: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  unit: string;
  variants?: ProductVariant[];
  costLayers?: CostLayer[];
  customFields?: Record<string, string>;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  date: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: StockAdjustmentReason;
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  balanceOwed: number;
  customFields?: Record<string, string>;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  receivedDate?: string;
  status: 'Pending' | 'Received';
  items: PurchaseOrderItem[];
  totalCost: number;
  notes: string;
  customFields?: Record<string, string>;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  totalSpent: number;
  orderCount: number;
  creditBalance: number;
  loyaltyPoints: number;
  lifetimePointsEarned: number;
  isWalkIn?: boolean;
  customFields?: Record<string, string>;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  method: ExpensePaymentMethod;
  notes: string;
}

export interface LoyaltyTier {
  id: string;
  label: string;
  pointsRequired: number;
  discountPercent: number;
}

export interface LoyaltyConfig {
  enabled: boolean;
  spendUnit: number;
  pointsPerUnit: number;
  tiers: LoyaltyTier[];
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  pointsDelta: number;
  type: 'earned' | 'redeemed' | 'reversed' | 'adjustment';
  reference: string;
  note: string;
}

export interface BNPLDetails {
  provider: BNPLProvider;
  months: number;
  downPayment: number;
  financedAmount: number;
  monthlyInstallment: number;
  reference: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  itemDiscountsTotal: number;
  orderDiscountType: DiscountType;
  orderDiscountValue: number;
  orderDiscountAmount: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountPercent: number;
  loyaltyDiscountAmount: number;
  loyaltyPointsEarned: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  totalCost: number;
  costingMethodUsed?: CostingMethod;
  paymentMethod: PaymentMethod;
  bnplDetails?: BNPLDetails;
  amountPaid: number;
  cashTendered?: number;
  changeDue?: number;
  creditAmount: number;
  channel?: SaleChannel;
  syncStatus?: 'synced' | 'offline_queued';
  status: 'Completed' | 'Refunded';
  refundedAt?: string;
  customFields?: Record<string, string>;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  vendor: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  notes: string;
  customFields?: Record<string, string>;
}

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface ImportProfile {
  id: string;
  name: string;
  module: ModuleKey;
  mapping: Record<string, string>;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  endpoint: '/api/v1/webhooks/sales' | '/api/v1/webhooks/inventory';
  sourceSystem: string;
  status: 200 | 400;
  summary: string;
  payloadPreview: string;
}

export interface EcommerceConnector {
  id: 'salla' | 'zid' | 'shopify';
  name: string;
  nameAr: string;
  connected: boolean;
  storeUrl: string;
  apiToken: string;
  autoSyncInventory: boolean;
  autoPullOrders: boolean;
  lastSyncAt?: string;
  syncedOrdersCount: number;
}

export interface BusinessSettings {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  vatNumber: string;
  zatcaEnabled: boolean;
  language: Language;
  currencyCode: CurrencyCode;
  currencySymbol: string;
  taxRate: number;
  costingMethod: CostingMethod;
  webhookApiKey: string;
  webhookAutoDailySync: boolean;
  receiptFooter: string;
  loyalty: LoyaltyConfig;
}

export interface ERPState {
  products: Product[];
  stockAdjustments: StockAdjustment[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  loyaltyTransactions: LoyaltyTransaction[];
  sales: Sale[];
  expenses: Expense[];
  webhookLogs: WebhookLog[];
  ecommerceConnectors: EcommerceConnector[];
  offlineModeSimulated: boolean;
  settings: BusinessSettings;
  moduleSchemas: Record<ModuleKey, CustomFieldDefinition[]>;
  importProfiles: ImportProfile[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}

export type UserRole = 'admin' | 'cashier' | 'inventory_manager' | 'accountant' | 'custom';

export interface UserPermissions {
  canViewReports: boolean;
  canRefund: boolean;
  canGiveDiscounts: boolean;
  canManageUsers: boolean;
}

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  allowedModules: AppModule[];
  permissions: UserPermissions;
  active: boolean;
  isPrimaryAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthStatus {
  adminClaimed: boolean;
  envOverride: boolean;
  userCount: number;
  hasCashier: boolean;
}

