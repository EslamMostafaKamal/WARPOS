import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Pencil,
  Trash2,
  Power,
  Eye,
  EyeOff,
  ShoppingCart,
  Lock,
  Check,
  AlertCircle,
} from 'lucide-react';
import { AppModule, StaffUser, UserPermissions, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { MODULE_TITLES, tr } from '../../utils/i18n';
import { ALL_APP_MODULES, getRoleLabel, getRolePreset, ROLE_PRESETS } from '../../utils/roles';
import { Modal } from '../ui/Modal';

interface StaffFormState {
  id?: string;
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  allowedModules: AppModule[];
  permissions: UserPermissions;
  active: boolean;
}

const buildInitialForm = (presetRole: UserRole = 'cashier'): StaffFormState => {
  const preset = getRolePreset(presetRole);
  return {
    username: '',
    displayName: '',
    password: '',
    role: preset.role,
    allowedModules: [...preset.defaultModules],
    permissions: { ...preset.defaultPermissions },
    active: true,
  };
};

export const UserAccessManager: React.FC = () => {
  const {
    currentUser,
    authStatus,
    fetchUsers,
    createUser,
    updateUser,
    resetUserPassword,
    changeOwnPassword,
    deleteUser,
  } = useAuth();
  const { state, addToast } = useStore();
  const lang = state.settings.language;

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Add / Edit staff modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState<StaffFormState>(() => buildInitialForm('cashier'));
  const [showNewPass, setShowNewPass] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset staff password modal
  const [pwdTarget, setPwdTarget] = useState<StaffUser | null>(null);
  const [resetPassValue, setResetPassValue] = useState('');
  const [resetPassConfirm, setResetPassConfirm] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Change own password modal
  const [ownPwdOpen, setOwnPwdOpen] = useState(false);
  const [ownCurrentPwd, setOwnCurrentPwd] = useState('');
  const [ownNewPwd, setOwnNewPwd] = useState('');
  const [ownConfirmPwd, setOwnConfirmPwd] = useState('');
  const [ownPwdError, setOwnPwdError] = useState<string | null>(null);
  const [ownPwdSaving, setOwnPwdSaving] = useState(false);

  // Confirm delete modal
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetchUsers();
    if (res.ok && res.users) {
      setUsers(res.users);
      setErrorBanner(null);
    } else {
      setErrorBanner(res.error || tr(lang, 'Failed to load staff list.', 'تعذر تحميل قائمة الموظفين.'));
    }
    setLoading(false);
  }, [fetchUsers, lang]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === 'admin' && u.active).length;
    const cashiers = users.filter((u) => u.role === 'cashier').length;
    const active = users.filter((u) => u.active).length;
    return { total: users.length, admins, cashiers, active };
  }, [users]);

  const openAddStaff = (presetRole: UserRole) => {
    setStaffForm(buildInitialForm(presetRole));
    setFormError(null);
    setShowNewPass(false);
    setStaffModalOpen(true);
  };

  const openEditStaff = (u: StaffUser) => {
    setStaffForm({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      password: '',
      role: u.role,
      allowedModules: [...u.allowedModules],
      permissions: { ...u.permissions },
      active: u.active,
    });
    setFormError(null);
    setStaffModalOpen(true);
  };

  const applyRolePresetToForm = (role: UserRole) => {
    const preset = getRolePreset(role);
    setStaffForm((prev) => ({
      ...prev,
      role,
      allowedModules: [...preset.defaultModules],
      permissions: { ...preset.defaultPermissions },
    }));
  };

  const toggleModuleInForm = (mod: AppModule) => {
    if (staffForm.role === 'admin') return;
    setStaffForm((prev) => {
      const exists = prev.allowedModules.includes(mod);
      const next = exists
        ? prev.allowedModules.filter((m) => m !== mod)
        : [...prev.allowedModules, mod];
      if (next.length === 0) return prev;
      return { ...prev, allowedModules: next };
    });
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!staffForm.displayName.trim()) {
      setFormError(tr(lang, 'Display name is required.', 'اسم الموظف مطلوب.'));
      return;
    }

    setSaving(true);
    if (staffForm.id) {
      const res = await updateUser(staffForm.id, {
        displayName: staffForm.displayName.trim(),
        role: staffForm.role,
        allowedModules: staffForm.allowedModules,
        permissions: staffForm.permissions,
        active: staffForm.active,
      });
      setSaving(false);
      if (!res.ok) {
        setFormError(res.error || tr(lang, 'Update failed.', 'تعذر التحديث.'));
        return;
      }
      addToast({
        type: 'success',
        title: tr(lang, 'Staff access updated', 'تم تحديث صلاحيات الموظف'),
        description: staffForm.displayName.trim(),
      });
    } else {
      if (staffForm.password.length < 6) {
        setSaving(false);
        setFormError(
          tr(
            lang,
            'Initial password must be at least 6 characters.',
            'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.'
          )
        );
        return;
      }
      const res = await createUser({
        username: staffForm.username.trim().toLowerCase(),
        displayName: staffForm.displayName.trim(),
        password: staffForm.password,
        role: staffForm.role,
        allowedModules: staffForm.allowedModules,
        permissions: staffForm.permissions,
        active: staffForm.active,
      });
      setSaving(false);
      if (!res.ok) {
        setFormError(res.error || tr(lang, 'Creation failed.', 'تعذر إنشاء الحساب.'));
        return;
      }
      addToast({
        type: 'success',
        title: tr(lang, 'Staff account created', 'تم إنشاء حساب الموظف'),
        description: `${staffForm.displayName.trim()} (@${staffForm.username.trim().toLowerCase()})`,
      });
    }

    setStaffModalOpen(false);
    await loadUsers();
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTarget) return;
    setPwdError(null);

    if (resetPassValue.length < 6) {
      setPwdError(
        tr(lang, 'Password must be at least 6 characters.', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.')
      );
      return;
    }
    if (resetPassValue !== resetPassConfirm) {
      setPwdError(tr(lang, 'Passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
      return;
    }

    setPwdSaving(true);
    const res = await resetUserPassword(pwdTarget.id, resetPassValue);
    setPwdSaving(false);

    if (!res.ok) {
      setPwdError(res.error || tr(lang, 'Could not change password.', 'تعذر تغيير كلمة المرور.'));
      return;
    }

    addToast({
      type: 'success',
      title: tr(lang, 'Password updated', 'تم تحديث كلمة المرور'),
      description: tr(
        lang,
        `Updated password for ${pwdTarget.displayName}.`,
        `تم تغيير كلمة مرور ${pwdTarget.displayName} بنجاح.`
      ),
    });
    setPwdTarget(null);
    setResetPassValue('');
    setResetPassConfirm('');
  };

  const handleChangeOwnPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnPwdError(null);
    if (ownNewPwd.length < 6) {
      setOwnPwdError(
        tr(lang, 'New password must be at least 6 characters.', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.')
      );
      return;
    }
    if (ownNewPwd !== ownConfirmPwd) {
      setOwnPwdError(tr(lang, 'New passwords do not match.', 'كلمتا المرور الجديدتان غير متطابقتين.'));
      return;
    }

    setOwnPwdSaving(true);
    const res = await changeOwnPassword(ownCurrentPwd, ownNewPwd);
    setOwnPwdSaving(false);

    if (!res.ok) {
      setOwnPwdError(res.error || tr(lang, 'Could not update password.', 'تعذر تحديث كلمة المرور.'));
      return;
    }

    addToast({
      type: 'success',
      title: tr(lang, 'Your password was updated', 'تم تغيير كلمة مرورك بنجاح'),
    });
    setOwnPwdOpen(false);
    setOwnCurrentPwd('');
    setOwnNewPwd('');
    setOwnConfirmPwd('');
  };

  const handleToggleActive = async (u: StaffUser) => {
    const res = await updateUser(u.id, { active: !u.active });
    if (!res.ok) {
      addToast({
        type: 'error',
        title: tr(lang, 'Action blocked', 'تعذر تنفيذ الإجراء'),
        description: res.error,
      });
      return;
    }
    addToast({
      type: 'info',
      title: u.active
        ? tr(lang, 'Account disabled', 'تم إيقاف الحساب')
        : tr(lang, 'Account enabled', 'تم تفعيل الحساب'),
      description: u.displayName,
    });
    await loadUsers();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteUser(deleteTarget.id);
    if (!res.ok) {
      addToast({
        type: 'error',
        title: tr(lang, 'Cannot delete account', 'تعذر حذف الحساب'),
        description: res.error,
      });
      return;
    }
    addToast({
      type: 'info',
      title: tr(lang, 'Staff account deleted', 'تم حذف حساب الموظف'),
      description: deleteTarget.displayName,
    });
    setDeleteTarget(null);
    await loadUsers();
  };

  const envLocksPrimaryAdmin = Boolean(authStatus?.envOverride && currentUser?.isPrimaryAdmin);

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Total Staff Accounts', 'إجمالي حسابات الموظفين')}
          </p>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1.5">
            {stats.total}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Active Administrators', 'مديرو النظام النشطون')}
          </p>
          <p className="text-xl font-bold font-mono text-teal-700 tabular-nums mt-1.5">
            {stats.admins}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Cashiers (POS Only)', 'حسابات الكاشير (POS فقط)')}
          </p>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1.5">
            {stats.cashiers}
          </p>
        </div>
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs text-slate-500 font-medium">
            {tr(lang, 'Active Logins', 'الحسابات المفعلة')}
          </p>
          <p className="text-xl font-bold font-mono text-emerald-700 tabular-nums mt-1.5">
            {stats.active}
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {tr(
                lang,
                'Role-Based Access Control & Passwords',
                'إدارة الصلاحيات وحسابات الموظفين وكلمات المرور'
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr(
                lang,
                'Create password-protected Cashier accounts restricted strictly to POS, or configure custom per-module access for any role.',
                'أنشئ حسابات كاشير محمية بكلمة مرور ومحصورة في نقطة البيع فقط، أو خصص صلاحيات الأقسام والتقارير لكل وظيفة.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!envLocksPrimaryAdmin && (
            <button
              type="button"
              onClick={() => {
                setOwnPwdError(null);
                setOwnCurrentPwd('');
                setOwnNewPwd('');
                setOwnConfirmPwd('');
                setOwnPwdOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {tr(lang, 'Change My Password', 'تغيير كلمة مروري')}
            </button>
          )}
          <button
            type="button"
            onClick={() => openAddStaff('cashier')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {tr(lang, 'Add Cashier (POS Only)', 'إضافة كاشير (POS فقط)')}
          </button>
          <button
            type="button"
            onClick={() => openAddStaff('custom')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {tr(lang, 'Add Staff Account', 'إضافة حساب موظف')}
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Staff Accounts Table */}
      <section className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-xs text-slate-500">
              {tr(lang, 'Loading staff accounts...', 'جاري تحميل حسابات الموظفين...')}
            </div>
          ) : (
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 text-start">{tr(lang, 'Staff Member', 'الموظف')}</th>
                  <th className="py-3 px-4 text-start">{tr(lang, 'Role', 'الدور الوظيفي')}</th>
                  <th className="py-3 px-4 text-start">
                    {tr(lang, 'Allowed Modules', 'الأقسام المصرح بها')}
                  </th>
                  <th className="py-3 px-4 text-start">
                    {tr(lang, 'Special Rights', 'صلاحيات إضافية')}
                  </th>
                  <th className="py-3 px-4 text-start">{tr(lang, 'Status', 'الحالة')}</th>
                  <th className="py-3 px-4 text-end">{tr(lang, 'Actions', 'إجراءات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  const envControlled = Boolean(authStatus?.envOverride && u.isPrimaryAdmin);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{u.displayName}</span>
                          {isSelf && (
                            <span className="text-[10px] font-semibold text-teal-700">
                              ({tr(lang, 'You', 'أنت')})
                            </span>
                          )}
                        </div>
                        <div dir="ltr" className="font-mono text-[11px] text-slate-500 text-start">
                          @{u.username}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            u.role === 'admin' ? 'text-teal-800' : 'text-slate-800'
                          }`}
                        >
                          {getRoleLabel(u.role, lang)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">
                        {u.role === 'admin' ? (
                          <span className="font-medium text-teal-700">
                            {tr(lang, 'All 9 Modules & Settings', 'جميع الأقسام (9) والإعدادات')}
                          </span>
                        ) : (
                          <span>
                            {u.allowedModules
                              .map((m) => MODULE_TITLES[m]?.[lang] ?? m)
                              .join(lang === 'ar' ? '، ' : ', ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        <div className="space-y-0.5">
                          {u.permissions.canViewReports && (
                            <div>· {tr(lang, 'Executive & Audit Reports', 'التقارير والتدقيق')}</div>
                          )}
                          {u.permissions.canRefund && (
                            <div>· {tr(lang, 'Invoice Refunds', 'استرداد الفواتير')}</div>
                          )}
                          {u.permissions.canGiveDiscounts && (
                            <div>· {tr(lang, 'Manual POS Discounts', 'خصومات يدوية بالكاشير')}</div>
                          )}
                          {!u.permissions.canViewReports &&
                            !u.permissions.canRefund &&
                            !u.permissions.canGiveDiscounts && (
                              <span className="text-slate-400">
                                {tr(lang, 'Standard Checkout Only', 'بيع قياسي فقط')}
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            u.active ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {u.active ? tr(lang, 'Active', 'مفعّل') : tr(lang, 'Disabled', 'موقوف')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditStaff(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                            title={tr(lang, 'Edit role & modules', 'تعديل الصلاحيات')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {tr(lang, 'Access', 'الصلاحيات')}
                          </button>
                          {!envControlled && (
                            <button
                              type="button"
                              onClick={() => {
                                setPwdTarget(u);
                                setResetPassValue('');
                                setResetPassConfirm('');
                                setPwdError(null);
                                setShowResetPass(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md"
                              title={tr(lang, 'Change password', 'تغيير كلمة المرور')}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              {tr(lang, 'Password', 'كلمة المرور')}
                            </button>
                          )}
                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(u)}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded"
                                title={
                                  u.active
                                    ? tr(lang, 'Disable account', 'إيقاف الحساب')
                                    : tr(lang, 'Enable account', 'تفعيل الحساب')
                                }
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title={tr(lang, 'Delete account', 'حذف الحساب')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Add / Edit Staff Account Modal */}
      <Modal
        open={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        title={
          staffForm.id
            ? tr(lang, 'Edit Staff Access & Modules', 'تعديل صلاحيات وأقسام الموظف')
            : tr(lang, 'Create Staff Account', 'إنشاء حساب موظف جديد')
        }
        subtitle={tr(
          lang,
          'Choose a role template or customize individual module and report permissions',
          'اختر قالب وظيفة جاهز (مثل الكاشير) أو خصص الأقسام والتقارير يدوياً'
        )}
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setStaffModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="staff-access-form"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg whitespace-nowrap"
            >
              {saving
                ? tr(lang, 'Saving...', 'جاري الحفظ...')
                : staffForm.id
                ? tr(lang, 'Save Access Changes', 'حفظ الصلاحيات')
                : tr(lang, 'Create Account', 'إنشاء الحساب')}
            </button>
          </>
        }
      >
        <form id="staff-access-form" onSubmit={handleSaveStaff} className="space-y-5">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Full Name *', 'الاسم الكامل *')}
              </label>
              <input
                type="text"
                required
                value={staffForm.displayName}
                onChange={(e) => setStaffForm({ ...staffForm, displayName: e.target.value })}
                placeholder={tr(lang, 'e.g., Ahmed — Cashier 1', 'مثال: أحمد — كاشير 1')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Login Username *', 'اسم المستخدم للدخول *')}
              </label>
              <input
                type="text"
                required
                disabled={Boolean(staffForm.id)}
                dir="ltr"
                value={staffForm.username}
                onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                placeholder="cashier1"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          {!staffForm.id && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tr(lang, 'Password (min 6 chars) *', 'كلمة المرور (6 أحرف على الأقل) *')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  dir="ltr"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full ps-9 pe-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass((s) => !s)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Role Template Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              {tr(lang, 'Role Preset', 'الدور الوظيفي')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLE_PRESETS.map((preset) => {
                const active = staffForm.role === preset.role;
                return (
                  <button
                    key={preset.role}
                    type="button"
                    onClick={() => applyRolePresetToForm(preset.role)}
                    className={`text-start p-3 rounded-lg border transition-colors ${
                      active
                        ? 'bg-teal-50 border-teal-600 text-teal-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-semibold">
                      {lang === 'ar' ? preset.labelAr : preset.labelEn}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {lang === 'ar' ? preset.descAr : preset.descEn}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-Module Access Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                {tr(lang, 'Accessible Modules', 'الأقسام المسموح بالوصول إليها')}
              </label>
              {staffForm.role === 'admin' && (
                <span className="text-[11px] text-teal-700 font-medium">
                  {tr(lang, 'Administrators always have full access', 'يمتلك مدير النظام صلاحية كاملة دائماً')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_APP_MODULES.map((mod) => {
                const checked =
                  staffForm.role === 'admin' || staffForm.allowedModules.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    disabled={staffForm.role === 'admin'}
                    onClick={() => toggleModuleInForm(mod)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-start transition-colors ${
                      checked
                        ? 'bg-teal-50/80 border-teal-600/70 text-teal-950'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'
                    } disabled:opacity-75`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        checked
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <span className="truncate">{MODULE_TITLES[mod][lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Granular Feature Rights */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <p className="text-xs font-semibold text-slate-800">
              {tr(lang, 'Operational & Report Permissions', 'صلاحيات التقارير والعمليات الحساسة')}
            </p>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                disabled={staffForm.role === 'admin'}
                checked={staffForm.role === 'admin' || staffForm.permissions.canViewReports}
                onChange={(e) =>
                  setStaffForm((prev) => ({
                    ...prev,
                    permissions: { ...prev.permissions, canViewReports: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-teal-700"
              />
              <span>
                {tr(
                  lang,
                  'Access Executive Reports, P&L Totals & Instant Audit PDF',
                  'الاطلاع على التقارير التنفيذية والأرباح وتقرير التدقيق PDF'
                )}
              </span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                disabled={staffForm.role === 'admin'}
                checked={staffForm.role === 'admin' || staffForm.permissions.canRefund}
                onChange={(e) =>
                  setStaffForm((prev) => ({
                    ...prev,
                    permissions: { ...prev.permissions, canRefund: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-teal-700"
              />
              <span>
                {tr(
                  lang,
                  'Allow Invoice Refunds / Returns',
                  'السماح بإجراء مرتجعات واسترداد الفواتير'
                )}
              </span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                disabled={staffForm.role === 'admin'}
                checked={staffForm.role === 'admin' || staffForm.permissions.canGiveDiscounts}
                onChange={(e) =>
                  setStaffForm((prev) => ({
                    ...prev,
                    permissions: { ...prev.permissions, canGiveDiscounts: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-teal-700"
              />
              <span>
                {tr(
                  lang,
                  'Allow Manual POS Discounts at Checkout',
                  'السماح بتطبيق خصومات يدوية في الكاشير'
                )}
              </span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Admin Reset Staff Password Modal */}
      <Modal
        open={Boolean(pwdTarget)}
        onClose={() => setPwdTarget(null)}
        title={tr(lang, 'Change Staff Password', 'تغيير كلمة مرور الموظف')}
        subtitle={pwdTarget ? `${pwdTarget.displayName} (@${pwdTarget.username})` : ''}
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPwdTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="reset-staff-pwd-form"
              disabled={pwdSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg whitespace-nowrap"
            >
              {pwdSaving
                ? tr(lang, 'Updating...', 'جاري الحفظ...')
                : tr(lang, 'Update Password', 'تحديث كلمة المرور')}
            </button>
          </>
        }
      >
        <form id="reset-staff-pwd-form" onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
          {pwdError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {pwdError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'New Password (min 6 chars)', 'كلمة المرور الجديدة (6 أحرف على الأقل)')}
            </label>
            <div className="relative">
              <input
                type={showResetPass ? 'text' : 'password'}
                required
                minLength={6}
                dir="ltr"
                value={resetPassValue}
                onChange={(e) => setResetPassValue(e.target.value)}
                className="w-full px-3 pe-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
              <button
                type="button"
                onClick={() => setShowResetPass((s) => !s)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Confirm New Password', 'تأكيد كلمة المرور الجديدة')}
            </label>
            <input
              type={showResetPass ? 'text' : 'password'}
              required
              minLength={6}
              dir="ltr"
              value={resetPassConfirm}
              onChange={(e) => setResetPassConfirm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            {tr(
              lang,
              'Changing this password immediately signs out any active sessions for this user.',
              'سيتم تسجيل خروج الجلسات النشطة لهذا الموظف تلقائياً فور تغيير كلمة المرور.'
            )}
          </p>
        </form>
      </Modal>

      {/* Change Own Admin Password Modal */}
      <Modal
        open={ownPwdOpen}
        onClose={() => setOwnPwdOpen(false)}
        title={tr(lang, 'Change My Password', 'تغيير كلمة مروري')}
        subtitle={currentUser ? `@${currentUser.username}` : ''}
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOwnPwdOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              form="own-pwd-form"
              disabled={ownPwdSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg whitespace-nowrap"
            >
              {ownPwdSaving
                ? tr(lang, 'Updating...', 'جاري الحفظ...')
                : tr(lang, 'Save New Password', 'حفظ كلمة المرور')}
            </button>
          </>
        }
      >
        <form id="own-pwd-form" onSubmit={handleChangeOwnPasswordSubmit} className="space-y-3.5">
          {ownPwdError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {ownPwdError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Current Password', 'كلمة المرور الحالية')}
            </label>
            <input
              type="password"
              required
              dir="ltr"
              value={ownCurrentPwd}
              onChange={(e) => setOwnCurrentPwd(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'New Password (min 6 chars)', 'كلمة المرور الجديدة (6 أحرف على الأقل)')}
            </label>
            <input
              type="password"
              required
              minLength={6}
              dir="ltr"
              value={ownNewPwd}
              onChange={(e) => setOwnNewPwd(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tr(lang, 'Confirm New Password', 'تأكيد كلمة المرور الجديدة')}
            </label>
            <input
              type="password"
              required
              minLength={6}
              dir="ltr"
              value={ownConfirmPwd}
              onChange={(e) => setOwnConfirmPwd(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Staff Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={tr(lang, 'Delete Staff Account?', 'حذف حساب الموظف؟')}
        subtitle={deleteTarget ? `${deleteTarget.displayName} (@${deleteTarget.username})` : ''}
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Cancel', 'إلغاء')}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg whitespace-nowrap"
            >
              {tr(lang, 'Delete Account', 'تأكيد الحذف')}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          {tr(
            lang,
            'This will permanently remove this staff login and immediately sign out any active sessions.',
            'سيؤدي هذا إلى إزالة حساب الدخول نهائياً وإنهاء أي جلسات نشطة لهذا الموظف فوراً.'
          )}
        </p>
      </Modal>
    </div>
  );
};
