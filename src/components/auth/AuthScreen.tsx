import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Globe,
  ShoppingCart,
  BarChart3,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { t, tr } from '../../utils/i18n';

export const AuthScreen: React.FC = () => {
  const { authStatus, authError, claimAdmin, login, refreshStatus } = useAuth();
  const { state, setLanguage } = useStore();
  const lang = state.settings.language;

  const isSetupMode = authStatus ? !authStatus.adminClaimed : false;

  const [username, setUsername] = useState(isSetupMode ? 'admin' : '');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg(
        tr(
          lang,
          'Password must be at least 6 characters long.',
          'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.'
        )
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(tr(lang, 'Passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
      return;
    }

    setSubmitting(true);
    const result = await claimAdmin({
      username: username.trim() || 'admin',
      displayName: displayName.trim() || tr(lang, 'Store Administrator', 'مدير النظام'),
      password,
    });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.error || tr(lang, 'Could not complete setup.', 'تعذر إكمال الإعداد.'));
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password) {
      setErrorMsg(
        tr(lang, 'Enter your username and password.', 'أدخل اسم المستخدم وكلمة المرور.')
      );
      return;
    }

    setSubmitting(true);
    const result = await login(username.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      setErrorMsg(
        result.error || tr(lang, 'Invalid username or password.', 'اسم المستخدم أو كلمة المرور غير صحيحة.')
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col justify-center p-4 sm:p-6">
      <div className="max-w-4xl w-full mx-auto bg-white border border-slate-200/90 rounded-2xl shadow-lg shadow-slate-900/5 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Brand & Access Architecture Panel */}
        <div className="lg:col-span-5 bg-slate-950 text-slate-200 p-7 sm:p-8 flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-slate-950 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2" y="2" width="5" height="5" rx="1.2" fill="currentColor" />
                    <rect
                      x="9"
                      y="2"
                      width="5"
                      height="5"
                      rx="1.2"
                      fill="currentColor"
                      fillOpacity="0.45"
                    />
                    <rect
                      x="2"
                      y="9"
                      width="5"
                      height="5"
                      rx="1.2"
                      fill="currentColor"
                      fillOpacity="0.45"
                    />
                    <rect x="9" y="9" width="5" height="5" rx="1.2" fill="currentColor" />
                  </svg>
                </span>
                <div>
                  <p className="font-display font-bold text-base text-white leading-tight">
                    {t('brand', lang)}
                  </p>
                  <p className="text-[11px] text-slate-400">{state.settings.storeName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLanguage(lang === 'en' ? 'ar' : 'en')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 rounded-lg transition-colors whitespace-nowrap"
              >
                <Globe className="w-3.5 h-3.5 text-teal-300" />
                {lang === 'en' ? 'العربية' : 'EN'}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">
                {isSetupMode
                  ? tr(lang, 'Initial Security Setup', 'إعداد الأمان الأولي')
                  : tr(lang, 'Role-Based Access Control', 'نظام الصلاحيات والوصول')}
              </p>
              <h1 className="font-display text-2xl font-bold text-white leading-snug">
                {isSetupMode
                  ? tr(
                      lang,
                      'Create your Administrator account',
                      'أنشئ حساب مدير النظام'
                    )
                  : tr(
                      lang,
                      'Sign in to your workspace',
                      'تسجيل الدخول إلى النظام'
                    )}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isSetupMode
                  ? tr(
                      lang,
                      'Set up the primary Administrator password to unlock full ERP controls, executive reports, and staff password management.',
                      'قم بتعيين كلمة مرور مدير النظام لفتح جميع المزايا والتقارير وإدارة حسابات الكاشير والموظفين من الإعدادات.'
                    )
                  : tr(
                      lang,
                      'Each staff member sees only the modules assigned by the Administrator — from POS-only cashiers to full executive reporting.',
                      'يرى كل موظف الأقسام المصرح له بها فقط من قِبل مدير النظام — من كاشير نقطة البيع فقط إلى الإدارة الكاملة.'
                    )}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-800/80 pt-5 text-xs">
            <div className="flex items-start gap-2.5">
              <BarChart3 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-100">
                  {tr(lang, 'Administrator Access', 'صلاحية مدير النظام')}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {tr(
                    lang,
                    'All modules, P&L & Audit PDF reports, and staff password setup in Settings.',
                    'كافة الأقسام، تقارير الأرباح والتدقيق، وإنشاء وتغيير كلمات مرور الموظفين.'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <ShoppingCart className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-100">
                  {tr(lang, 'Cashier Terminal Lock', 'حساب الكاشير (POS فقط)')}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {tr(
                    lang,
                    'Cashier logins open directly into POS Checkout with all back-office tabs hidden.',
                    'يدخل الكاشير مباشرة إلى شاشة الكاشير مع إخفاء التقارير والمخزون والإعدادات.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div className="lg:col-span-7 p-7 sm:p-9 flex flex-col justify-center">
          {authError && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {authError}
              </span>
              <button
                type="button"
                onClick={refreshStatus}
                className="font-semibold underline whitespace-nowrap"
              >
                {tr(lang, 'Retry', 'إعادة المحاولة')}
              </button>
            </div>
          )}

          {isSetupMode ? (
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-teal-700 text-xs font-semibold mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  {tr(lang, 'First-Run Admin Claim', 'التفعيل الأول لمدير النظام')}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {tr(lang, 'Set Administrator Credentials', 'تعيين بيانات مدير النظام')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr(
                    lang,
                    'After signing in, open Settings → Access Control to create Cashier (POS-only) and role-specific accounts.',
                    'بعد الدخول، افتح الإعدادات ← الصلاحيات والموظفون لإنشاء حسابات الكاشير وتحديد صلاحيات كل وظيفة.'
                  )}
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {tr(lang, 'Admin Name', 'اسم المدير')}
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={tr(lang, 'e.g., Store Owner', 'مثال: مدير المتجر')}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {tr(lang, 'Admin Username', 'اسم المستخدم للمدير')}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full ps-9 pe-3 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Administrator Password (min 6 chars)', 'كلمة مرور المدير (6 أحرف على الأقل)')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={tr(lang, 'Toggle password visibility', 'إظهار/إخفاء كلمة المرور')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Confirm Password', 'تأكيد كلمة المرور')}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    dir="ltr"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg transition-colors shadow-xs"
              >
                {submitting
                  ? tr(lang, 'Creating Administrator...', 'جاري إنشاء الحساب...')
                  : tr(lang, 'Activate Admin Access & Enter Workspace', 'تفعيل حساب المدير والدخول للنظام')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-teal-700 text-xs font-semibold mb-1">
                  <Lock className="w-4 h-4" />
                  {tr(lang, 'Staff Authentication', 'بوابة دخول الموظفين')}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {tr(lang, 'Sign in with your assigned credentials', 'سجّل الدخول ببيانات حسابك')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr(
                    lang,
                    'Administrators get full access; Cashiers enter directly into POS Checkout.',
                    'يدخل المدير بكامل الصلاحيات، ويدخل الكاشير مباشرة إلى شاشة الكاشير فقط.'
                  )}
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Username', 'اسم المستخدم')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoFocus
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={tr(lang, 'admin or cashier username', 'اسم المستخدم (مثال: admin أو cashier1)')}
                    className="w-full ps-9 pe-3 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {tr(lang, 'Password', 'كلمة المرور')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={tr(lang, 'Toggle password visibility', 'إظهار/إخفاء كلمة المرور')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg transition-colors shadow-xs"
              >
                {submitting
                  ? tr(lang, 'Signing in...', 'جاري التحقق...')
                  : tr(lang, 'Sign In', 'دخول')}
              </button>

              {authStatus && (
                <p className="text-[11px] text-slate-500 text-center pt-1">
                  {tr(
                    lang,
                    `${authStatus.userCount} staff account${authStatus.userCount === 1 ? '' : 's'} configured. Passwords are managed by the Administrator in Settings.`,
                    `يوجد ${authStatus.userCount} حساب موظف مسجل. يتم إنشاء وتغيير كلمات المرور بواسطة مدير النظام من الإعدادات.`
                  )}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
