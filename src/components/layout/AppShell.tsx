import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  Users,
  Wallet,
  Calculator,
  Plug,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Globe,
  Wifi,
  WifiOff,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { AppModule } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, isSameDay } from '../../utils/format';
import { MODULE_TITLES, t, tr } from '../../utils/i18n';
import { getRoleLabel } from '../../utils/roles';

interface AppShellProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  children: React.ReactNode;
}

interface NavGroup {
  labelEn: string;
  labelAr: string;
  items: {
    id: AppModule;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelEn: 'Operations',
    labelAr: 'العمليات اليومية',
    items: [
      { id: 'dashboard', icon: LayoutDashboard },
      { id: 'pos', icon: ShoppingCart },
      { id: 'inventory', icon: Boxes },
      { id: 'purchases', icon: Truck },
      { id: 'customers', icon: Users },
      { id: 'expenses', icon: Wallet },
    ],
  },
  {
    labelEn: 'Intelligence & Add-on',
    labelAr: 'الذكاء والربط السريع',
    items: [
      { id: 'decisions', icon: Calculator },
      { id: 'integrations', icon: Plug },
    ],
  },
  {
    labelEn: 'System',
    labelAr: 'النظام والامتثال',
    items: [{ id: 'settings', icon: Settings }],
  },
];

const BrandEmblem: React.FC = () => (
  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-slate-950 flex items-center justify-center shrink-0 shadow-sm shadow-teal-950/40">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1.2" fill="currentColor" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" fill="currentColor" fillOpacity="0.45" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" fill="currentColor" fillOpacity="0.45" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" fill="currentColor" />
    </svg>
  </span>
);

export const AppShell: React.FC<AppShellProps> = ({
  activeModule,
  onSelectModule,
  children,
}) => {
  const {
    state,
    decisionReport,
    isOnline,
    offlineQueueCount,
    toggleSimulatedOffline,
    setLanguage,
  } = useStore();
  const { currentUser, canAccessModule, hasPermission, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sym = state.settings.currencySymbol;
  const lang = state.settings.language;
  const activeLabel = MODULE_TITLES[activeModule]?.[lang] ?? activeModule;

  const visibleNavGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessModule(item.id)),
    })).filter((group) => group.items.length > 0);
  }, [canAccessModule]);

  const topSummary = useMemo(() => {
    const todaySales = state.sales
      .filter((s) => s.status === 'Completed' && isSameDay(s.date))
      .reduce((sum, s) => sum + s.total, 0);
    const lowStockCount = state.products.filter((p) => p.stock <= p.reorderLevel).length;
    const pendingPOs = state.purchaseOrders.filter((p) => p.status === 'Pending').length;
    const activeDecisions = decisionReport.decisions.length;
    return { todaySales, lowStockCount, pendingPOs, activeDecisions };
  }, [state.sales, state.products, state.purchaseOrders, decisionReport.decisions.length]);

  const handleSelect = (module: AppModule) => {
    if (!canAccessModule(module)) return;
    onSelectModule(module);
    setMobileMenuOpen(false);
  };

  const getBadgeCount = (id: AppModule) => {
    if (id === 'inventory') return topSummary.lowStockCount;
    if (id === 'purchases') return topSummary.pendingPOs;
    if (id === 'decisions') return topSummary.activeDecisions;
    return 0;
  };

  const showTodaySalesChip = hasPermission('canViewReports') || canAccessModule('dashboard');
  const showDecisionsChip = canAccessModule('decisions');

  const renderNavGroups = (collapsed: boolean) => (
    <div className="space-y-5">
      {visibleNavGroups.map((group) => (
        <div key={group.labelEn} className="space-y-1">
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'ar' ? group.labelAr : group.labelEn}
            </p>
          )}
          {group.items.map(({ id, icon: Icon }) => {
            const label = MODULE_TITLES[id][lang];
            const isActive = activeModule === id;
            const count = getBadgeCount(id);

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                title={collapsed ? label : undefined}
                className={`w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap ${
                  collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-teal-500/15 text-white font-semibold ring-1 ring-inset ring-teal-400/25'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-teal-300' : 'text-slate-400'
                  }`}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-start truncate">{label}</span>
                    {count > 0 && (
                      <span
                        className={`text-[11px] font-mono tabular-nums font-semibold ${
                          id === 'inventory'
                            ? 'text-amber-300'
                            : id === 'decisions'
                            ? 'text-teal-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#f4f6f9] text-slate-900">
      {/* Desktop Executive Dark-Slate Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-950 text-slate-200 border-e border-slate-800/80 shrink-0 sticky top-0 h-screen transition-[width] duration-150 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        <div
          className={`h-16 border-b border-slate-800/80 flex items-center shrink-0 ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandEmblem />
              <div className="min-w-0">
                <span className="font-display font-bold text-[15px] tracking-tight text-white block truncate leading-tight">
                  {t('brand', lang)}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {t('brandTag', lang)}
                </span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label={
              sidebarCollapsed
                ? tr(lang, 'Expand sidebar', 'توسيع القائمة الجانبية')
                : tr(lang, 'Collapse sidebar', 'طي القائمة الجانبية')
            }
            title={
              sidebarCollapsed
                ? tr(lang, 'Expand sidebar', 'توسيع القائمة الجانبية')
                : tr(lang, 'Collapse sidebar', 'طي القائمة الجانبية')
            }
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 rtl:rotate-180" />
            ) : (
              <PanelLeftClose className="w-4 h-4 rtl:rotate-180" />
            )}
          </button>
        </div>

        <nav
          className="flex-1 px-3 py-4 overflow-y-auto"
          aria-label={tr(lang, 'Primary Navigation', 'القائمة الرئيسية')}
        >
          {renderNavGroups(sidebarCollapsed)}
        </nav>

        {!sidebarCollapsed ? (
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 text-xs text-slate-400 space-y-3">
            {currentUser && (
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate flex items-center gap-1.5">
                    {currentUser.role === 'admin' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{currentUser.displayName}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {getRoleLabel(currentUser.role, lang)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title={tr(lang, 'Sign out / Switch user', 'تسجيل الخروج / تبديل المستخدم')}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-200 truncate">{state.settings.storeName}</p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400 tabular-nums">
                {state.settings.currencyCode} ·{' '}
                {tr(lang, `VAT ${state.settings.taxRate}%`, `ضريبة ${state.settings.taxRate}%`)} ·{' '}
                {state.settings.costingMethod === 'fifo' ? 'FIFO' : tr(lang, 'W-AVG', 'متوسط مرجح')}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2.5 border-t border-slate-800/80 flex justify-center">
            <button
              type="button"
              onClick={logout}
              title={tr(lang, 'Sign out / Switch user', 'تسجيل الخروج / تبديل المستخدم')}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile / Tablet Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-slate-950/55 backdrop-blur-[1px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-72 max-w-[84vw] bg-slate-950 text-slate-200 h-full border-e border-slate-800 flex flex-col shadow-2xl">
            <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <BrandEmblem />
                <div className="min-w-0">
                  <span className="font-display font-bold text-[15px] text-white block truncate leading-tight">
                    {t('brand', lang)}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {t('brandTag', lang)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                aria-label={tr(lang, 'Close navigation menu', 'إغلاق القائمة')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 overflow-y-auto">{renderNavGroups(false)}</nav>
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-xs text-slate-400 space-y-2.5">
              {currentUser && (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{currentUser.displayName}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {getRoleLabel(currentUser.role, lang)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/15 rounded-lg"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {tr(lang, 'Sign Out', 'خروج')}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/85 sticky top-0 z-30 px-4 lg:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              aria-label={tr(lang, 'Open navigation menu', 'فتح القائمة')}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden xl:inline text-slate-400 truncate max-w-[190px]">
                {state.settings.storeName}
              </span>
              <span className="hidden xl:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-bold text-[15px] text-slate-900 truncate">
                {activeLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(showTodaySalesChip || showDecisionsChip) && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 tabular-nums">
                {showTodaySalesChip && (
                  <span>
                    {t('today', lang)}:{' '}
                    <strong className="font-mono text-slate-900">
                      {formatCurrency(topSummary.todaySales, sym)}
                    </strong>
                  </span>
                )}
                {showTodaySalesChip && showDecisionsChip && (
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                )}
                {showDecisionsChip && (
                  <button
                    type="button"
                    onClick={() => handleSelect('decisions')}
                    className="hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    {t('decisions', lang)}:{' '}
                    <strong className="font-mono text-teal-700">{topSummary.activeDecisions}</strong>
                  </button>
                )}
              </div>
            )}

            {/* Offline POS Quick Toggle */}
            <button
              type="button"
              onClick={toggleSimulatedOffline}
              title={
                isOnline
                  ? tr(lang, 'Click to test Offline POS Mode', 'انقر لتجربة وضع عدم الاتصال')
                  : tr(lang, 'Click to reconnect & auto-sync', 'انقر لاستعادة الاتصال والمزامنة')
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                isOnline
                  ? 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-700" />
              )}
              <span className="hidden sm:inline">
                {isOnline ? t('onlineMode', lang) : t('offlineMode', lang)}
              </span>
              {offlineQueueCount > 0 && (
                <span className="font-mono text-[11px] font-bold text-amber-800">
                  ({offlineQueueCount})
                </span>
              )}
            </button>

            {/* Arabic RTL / English LTR Toggle */}
            <button
              type="button"
              onClick={() => setLanguage(lang === 'en' ? 'ar' : 'en')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title={tr(lang, 'Switch to Arabic (RTL)', 'التبديل إلى الإنجليزية (LTR)')}
            >
              <Globe className="w-3.5 h-3.5 text-teal-700" />
              {lang === 'en' ? 'العربية' : 'EN'}
            </button>

            {activeModule !== 'pos' && canAccessModule('pos') ? (
              <button
                type="button"
                onClick={() => handleSelect('pos')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {t('openPos', lang)}
              </button>
            ) : activeModule === 'pos' && canAccessModule('customers') ? (
              <button
                type="button"
                onClick={() => handleSelect('customers')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {t('salesHistory', lang)}
              </button>
            ) : null}

            {/* Quick Lock / Switch User button */}
            <button
              type="button"
              onClick={logout}
              title={tr(lang, 'Switch User / Lock Terminal', 'تبديل المستخدم / قفل الجلسة')}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">
                {tr(lang, 'Switch User', 'تبديل المستخدم')}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
