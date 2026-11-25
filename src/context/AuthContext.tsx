import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppModule, AuthStatus, StaffUser, UserPermissions, UserRole } from '../types';

interface CreateStaffInput {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  allowedModules: AppModule[];
  permissions: UserPermissions;
  active?: boolean;
}

interface UpdateStaffInput {
  displayName?: string;
  role?: UserRole;
  allowedModules?: AppModule[];
  permissions?: UserPermissions;
  active?: boolean;
}

interface AuthContextValue {
  authStatus: AuthStatus | null;
  currentUser: StaffUser | null;
  authLoading: boolean;
  authError: string | null;
  refreshStatus: () => Promise<void>;
  claimAdmin: (input: {
    username: string;
    displayName: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  changeOwnPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  canAccessModule: (module: AppModule) => boolean;
  hasPermission: (key: keyof UserPermissions) => boolean;
  // Admin staff management
  fetchUsers: () => Promise<{ ok: boolean; users?: StaffUser[]; error?: string }>;
  createUser: (
    input: CreateStaffInput
  ) => Promise<{ ok: boolean; user?: StaffUser; error?: string }>;
  updateUser: (
    id: string,
    patch: UpdateStaffInput
  ) => Promise<{ ok: boolean; user?: StaffUser; error?: string }>;
  resetUserPassword: (
    id: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Bearer session token is kept strictly in React memory — never in localStorage or sessionStorage
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Unable to reach authentication service.');
      }
      const data = (await res.json()) as AuthStatus;
      setAuthStatus(data);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication service unavailable.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const authedFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...init, headers, cache: 'no-store' });
      if (res.status === 401) {
        setToken(null);
        setCurrentUser(null);
      }
      return res;
    },
    [token]
  );

  const claimAdmin: AuthContextValue['claimAdmin'] = useCallback(
    async ({ username, displayName, password }) => {
      try {
        const res = await fetch('/api/auth/claim-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayName, password }),
          cache: 'no-store',
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          return {
            ok: false,
            error: typeof data.error === 'string' ? data.error : 'Setup failed.',
          };
        }
        setToken(String(data.token));
        setCurrentUser(data.user as StaffUser);
        await refreshStatus();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while creating administrator account.' };
      }
    },
    [refreshStatus]
  );

  const login: AuthContextValue['login'] = useCallback(async (username, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        cache: 'no-store',
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : 'Invalid credentials.',
        };
      }
      setToken(String(data.token));
      setCurrentUser(data.user as StaffUser);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while signing in.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authedFetch('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // Clear local session regardless
    } finally {
      setToken(null);
      setCurrentUser(null);
      await refreshStatus();
    }
  }, [token, authedFetch, refreshStatus]);

  const changeOwnPassword: AuthContextValue['changeOwnPassword'] = useCallback(
    async (currentPassword, newPassword) => {
      try {
        const res = await authedFetch('/api/auth/change-own-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          return {
            ok: false,
            error: typeof data.error === 'string' ? data.error : 'Password update failed.',
          };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while updating password.' };
      }
    },
    [authedFetch]
  );

  const fetchUsers: AuthContextValue['fetchUsers'] = useCallback(async () => {
    try {
      const res = await authedFetch('/api/auth/users');
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : 'Unable to load staff list.',
        };
      }
      return { ok: true, users: (data.users as StaffUser[]) ?? [] };
    } catch {
      return { ok: false, error: 'Network error while loading staff accounts.' };
    }
  }, [authedFetch]);

  const createUser: AuthContextValue['createUser'] = useCallback(
    async (input) => {
      try {
        const res = await authedFetch('/api/auth/users', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          return {
            ok: false,
            error: typeof data.error === 'string' ? data.error : 'Unable to create account.',
          };
        }
        await refreshStatus();
        return { ok: true, user: data.user as StaffUser };
      } catch {
        return { ok: false, error: 'Network error while creating staff account.' };
      }
    },
    [authedFetch, refreshStatus]
  );

  const updateUser: AuthContextValue['updateUser'] = useCallback(
    async (id, patch) => {
      try {
        const res = await authedFetch(`/api/auth/users/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          return {
            ok: false,
            error: typeof data.error === 'string' ? data.error : 'Unable to update account.',
          };
        }
        const updated = data.user as StaffUser;
        if (currentUser && updated.id === currentUser.id) {
          setCurrentUser(updated);
        }
        return { ok: true, user: updated };
      } catch {
        return { ok: false, error: 'Network error while updating staff account.' };
      }
    },
    [authedFetch, currentUser]
  );

  const resetUserPassword: AuthContextValue['resetUserPassword'] = useCallback(
    async (id, newPassword) => {
      try {
        const res = await authedFetch(`/api/auth/users/${encodeURIComponent(id)}/password`, {
          method: 'POST',
          body: JSON.stringify({ newPassword }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          return {
            ok: false,
            error: typeof data.error === 'string' ? data.error : 'Unable to reset password.',
          };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while updating password.' };
      }
    },
    [authedFetch]
  );

  const deleteUser: AuthContextValue['deleteUser'] = useCallback(
    async (id) => {
      try {
        const res = await authedFetch(`/api/auth/users/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          return {
            ok: false,
            error: typeof data.error === 'string' ? data.error : 'Unable to delete account.',
          };
        }
        await refreshStatus();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while deleting staff account.' };
      }
    },
    [authedFetch, refreshStatus]
  );

  const canAccessModule = useCallback(
    (module: AppModule) => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      return currentUser.allowedModules.includes(module);
    },
    [currentUser]
  );

  const hasPermission = useCallback(
    (key: keyof UserPermissions) => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      return Boolean(currentUser.permissions[key]);
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        authStatus,
        currentUser,
        authLoading,
        authError,
        refreshStatus,
        claimAdmin,
        login,
        logout,
        changeOwnPassword,
        canAccessModule,
        hasPermission,
        fetchUsers,
        createUser,
        updateUser,
        resetUserPassword,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
