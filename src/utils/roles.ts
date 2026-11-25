import { AppModule, Language, UserPermissions, UserRole } from '../types';

export const ALL_APP_MODULES: AppModule[] = [
  'dashboard',
  'pos',
  'inventory',
  'purchases',
  'customers',
  'expenses',
  'decisions',
  'integrations',
  'settings',
];

export interface RolePreset {
  role: UserRole;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
  defaultModules: AppModule[];
  defaultPermissions: UserPermissions;
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    role: 'admin',
    labelEn: 'Administrator',
    labelAr: 'مدير النظام',
    descEn: 'Full access to all modules, financial & audit reports, settings, and staff passwords.',
    descAr: 'صلاحيات كاملة لجميع الأقسام، التقارير المالية وتقارير التدقيق، الإعدادات، وإدارة كلمات مرور الموظفين.',
    defaultModules: [...ALL_APP_MODULES],
    defaultPermissions: {
      canViewReports: true,
      canRefund: true,
      canGiveDiscounts: true,
      canManageUsers: true,
    },
  },
  {
    role: 'cashier',
    labelEn: 'Cashier (POS Only)',
    labelAr: 'كاشير (نقطة البيع فقط)',
    descEn: 'Restricted strictly to the POS Terminal checkout screen. No access to reports, costs, or settings.',
    descAr: 'وصول محصور فقط في شاشة الكاشير ونقطة البيع. بدون وصول للتقارير أو التكاليف أو الإعدادات.',
    defaultModules: ['pos'],
    defaultPermissions: {
      canViewReports: false,
      canRefund: false,
      canGiveDiscounts: false,
      canManageUsers: false,
    },
  },
  {
    role: 'inventory_manager',
    labelEn: 'Inventory & Purchasing',
    labelAr: 'مسؤول المخزون والمشتريات',
    descEn: 'Manages stock levels, barcode variants, adjustments, suppliers, and purchase orders.',
    descAr: 'يدير أرصدة المخزون وباركود المقاسات والتسويات والموردين وأوامر الشراء.',
    defaultModules: ['inventory', 'purchases'],
    defaultPermissions: {
      canViewReports: false,
      canRefund: false,
      canGiveDiscounts: false,
      canManageUsers: false,
    },
  },
  {
    role: 'accountant',
    labelEn: 'Accountant & Reports',
    labelAr: 'محاسب وتقارير',
    descEn: 'Accesses Dashboard, P&L Accounting, Sales History, Decision Engine, and Audit PDF reports.',
    descAr: 'يدخل إلى لوحة التحكم، المحاسبة والمصروفات، سجل الفواتير، محرك القرارات، وتقارير التدقيق.',
    defaultModules: ['dashboard', 'customers', 'expenses', 'decisions'],
    defaultPermissions: {
      canViewReports: true,
      canRefund: true,
      canGiveDiscounts: false,
      canManageUsers: false,
    },
  },
  {
    role: 'custom',
    labelEn: 'Custom Function Access',
    labelAr: 'صلاحيات مخصصة',
    descEn: 'Manually choose exact modules and operational permissions for this staff member.',
    descAr: 'اختيار يدوي دقيق للأقسام والصلاحيات التشغيلية المسموح بها لهذا الموظف.',
    defaultModules: ['pos'],
    defaultPermissions: {
      canViewReports: false,
      canRefund: false,
      canGiveDiscounts: true,
      canManageUsers: false,
    },
  },
];

export function getRolePreset(role: UserRole): RolePreset {
  return ROLE_PRESETS.find((r) => r.role === role) ?? ROLE_PRESETS[1];
}

export function getRoleLabel(role: UserRole, lang: Language): string {
  const preset = getRolePreset(role);
  return lang === 'ar' ? preset.labelAr : preset.labelEn;
}
