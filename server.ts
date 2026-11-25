import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';

type AppModule =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'expenses'
  | 'decisions'
  | 'integrations'
  | 'settings';

type UserRole = 'admin' | 'cashier' | 'inventory_manager' | 'accountant' | 'custom';

interface UserPermissions {
  canViewReports: boolean;
  canRefund: boolean;
  canGiveDiscounts: boolean;
  canManageUsers: boolean;
}

interface StoredStaffUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  allowedModules: AppModule[];
  permissions: UserPermissions;
  active: boolean;
  isPrimaryAdmin?: boolean;
  salt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface PublicStaffUser {
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

interface SessionRecord {
  userId: string;
  expiresAt: number;
}

const ALL_MODULES: AppModule[] = [
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

const VALID_ROLES: UserRole[] = ['admin', 'cashier', 'inventory_manager', 'accountant', 'custom'];
const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_FAILS = 10;

const DATA_DIR = path.resolve(process.cwd(), '.data');
const AUTH_STORE_FILE = path.resolve(DATA_DIR, 'staff-auth.json');

// Verify store file stays strictly inside DATA_DIR
if (!AUTH_STORE_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid auth storage path');
}

const sessions = new Map<string, SessionRecord>();
const loginFailures = new Map<string, { count: number; resetAt: number }>();

function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, expectedHashHex: string): boolean {
  if (!password || !salt || !expectedHashHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function getEnvAdminPassword(): string {
  const raw = process.env.ADMIN_INITIAL_PASSWORD;
  return typeof raw === 'string' ? raw.trim() : '';
}

function sanitizeModules(input: unknown, role: UserRole): AppModule[] {
  if (role === 'admin') return [...ALL_MODULES];
  if (!Array.isArray(input)) return ['pos'];
  const unique = new Set<AppModule>();
  for (const item of input) {
    if (typeof item === 'string' && ALL_MODULES.includes(item as AppModule)) {
      unique.add(item as AppModule);
    }
  }
  return unique.size > 0 ? Array.from(unique) : ['pos'];
}

function sanitizePermissions(input: unknown, role: UserRole): UserPermissions {
  if (role === 'admin') {
    return {
      canViewReports: true,
      canRefund: true,
      canGiveDiscounts: true,
      canManageUsers: true,
    };
  }
  const obj = (typeof input === 'object' && input !== null ? input : {}) as Partial<UserPermissions>;
  return {
    canViewReports: Boolean(obj.canViewReports),
    canRefund: Boolean(obj.canRefund),
    canGiveDiscounts: Boolean(obj.canGiveDiscounts),
    canManageUsers: false, // Only admin role may manage users & passwords
  };
}

function toPublicUser(user: StoredStaffUser): PublicStaffUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    allowedModules: user.allowedModules,
    permissions: user.permissions,
    active: user.active,
    isPrimaryAdmin: user.isPrimaryAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

let usersStore: StoredStaffUser[] = [];

function loadUsersStore(): void {
  try {
    if (fs.existsSync(AUTH_STORE_FILE)) {
      const raw = fs.readFileSync(AUTH_STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        usersStore = parsed.filter(
          (u): u is StoredStaffUser =>
            typeof u === 'object' &&
            u !== null &&
            typeof u.id === 'string' &&
            typeof u.username === 'string' &&
            typeof u.salt === 'string' &&
            typeof u.passwordHash === 'string'
        );
      }
    }
  } catch {
    usersStore = [];
  }

  // If ADMIN_INITIAL_PASSWORD is configured in process.env, ensure a primary admin record exists
  const envPass = getEnvAdminPassword();
  if (envPass) {
    const existingPrimary = usersStore.find((u) => u.isPrimaryAdmin || u.username === 'admin');
    if (!existingPrimary) {
      const now = new Date().toISOString();
      const { salt, hash } = hashPassword(envPass);
      usersStore.unshift({
        id: 'usr-admin-primary',
        username: 'admin',
        displayName: 'Store Administrator',
        role: 'admin',
        allowedModules: [...ALL_MODULES],
        permissions: {
          canViewReports: true,
          canRefund: true,
          canGiveDiscounts: true,
          canManageUsers: true,
        },
        active: true,
        isPrimaryAdmin: true,
        salt,
        passwordHash: hash,
        createdAt: now,
        updatedAt: now,
      });
      persistUsersStore();
    }
  }
}

function persistUsersStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    const tmpFile = path.resolve(DATA_DIR, `staff-auth.${process.pid}.tmp`);
    if (!tmpFile.startsWith(DATA_DIR + path.sep)) return;
    fs.writeFileSync(tmpFile, JSON.stringify(usersStore, null, 2), { mode: 0o600 });
    fs.renameSync(tmpFile, AUTH_STORE_FILE);
  } catch {
    // Continue operating cleanly in memory if filesystem is read-only
  }
}

function isAdminClaimed(): boolean {
  if (getEnvAdminPassword()) return true;
  return usersStore.some((u) => u.role === 'admin' && u.active);
}

function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function revokeUserSessions(userId: string, exceptToken?: string): void {
  for (const [token, rec] of sessions.entries()) {
    if (rec.userId === userId && token !== exceptToken) {
      sessions.delete(token);
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function getRateLimitKey(req: Request, username: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${username.toLowerCase()}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now > entry.resetAt) {
    return true;
  }
  return entry.count < RATE_LIMIT_MAX_FAILS;
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now > entry.resetAt) {
    loginFailures.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

interface AuthedRequest extends Request {
  authUser?: StoredStaffUser;
  authToken?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) sessions.delete(token);
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }
  const user = usersStore.find((u) => u.id === session.userId);
  if (!user || !user.active) {
    sessions.delete(token);
    res.status(401).json({ error: 'Account is inactive or unavailable.' });
    return;
  }
  // Extend sliding session TTL
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  req.authUser = user;
  req.authToken = token;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'admin' || !req.authUser.permissions.canManageUsers) {
    res.status(403).json({ error: 'Administrator access required.' });
    return;
  }
  next();
}

async function startServer() {
  loadUsersStore();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Prevent caching on all auth API responses
  app.use('/api/auth', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // 1. Public auth status (reveals no secrets or usernames)
  app.get('/api/auth/status', (_req, res) => {
    const envOverride = Boolean(getEnvAdminPassword());
    res.json({
      adminClaimed: isAdminClaimed(),
      envOverride,
      userCount: usersStore.length,
      hasCashier: usersStore.some((u) => u.role === 'cashier' && u.active),
    });
  });

  // 2. First-run one-time administrator setup/claim route
  app.post('/api/auth/claim-admin', (req, res) => {
    if (getEnvAdminPassword() || isAdminClaimed()) {
      res.status(409).json({
        error: 'Administrator access is already configured. Please sign in.',
      });
      return;
    }

    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : 'admin';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 80)
        : 'Store Administrator';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!USERNAME_REGEX.test(rawUsername)) {
      res.status(400).json({
        error: 'Username must be 3–32 characters (letters, numbers, dot, underscore, or dash).',
      });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
      return;
    }

    const now = new Date().toISOString();
    const { salt, hash } = hashPassword(password);
    const adminUser: StoredStaffUser = {
      id: `usr-${crypto.randomBytes(6).toString('hex')}`,
      username: rawUsername,
      displayName,
      role: 'admin',
      allowedModules: [...ALL_MODULES],
      permissions: {
        canViewReports: true,
        canRefund: true,
        canGiveDiscounts: true,
        canManageUsers: true,
      },
      active: true,
      isPrimaryAdmin: true,
      salt,
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    };

    usersStore = [adminUser, ...usersStore.filter((u) => u.username !== rawUsername)];
    persistUsersStore();

    const token = createSession(adminUser.id);
    res.status(201).json({ token, user: toPublicUser(adminUser) });
  });

  // 3. Sign in (Admin, Cashier, or any configured staff account)
  app.post('/api/auth/login', (req, res) => {
    const username =
      typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const rlKey = getRateLimitKey(req, username);
    if (!checkRateLimit(rlKey)) {
      res.status(429).json({
        error: 'Too many failed sign-in attempts. Please wait 5 minutes and try again.',
      });
      return;
    }

    const user = usersStore.find((u) => u.username === username);
    if (!user) {
      recordLoginFailure(rlKey);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    // A configured ADMIN_INITIAL_PASSWORD always overrides the primary admin's fallback hash
    const envPass = getEnvAdminPassword();
    let valid = false;
    if (envPass && (user.isPrimaryAdmin || user.username === 'admin')) {
      const envHashed = hashPassword(envPass, user.salt);
      valid = verifyPassword(password, user.salt, envHashed.hash);
    } else {
      valid = verifyPassword(password, user.salt, user.passwordHash);
    }

    if (!valid) {
      recordLoginFailure(rlKey);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'This staff account has been disabled by an administrator.' });
      return;
    }

    clearLoginFailures(rlKey);
    const token = createSession(user.id);
    res.json({ token, user: toPublicUser(user) });
  });

  // 4. Sign out
  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    if (req.authToken) {
      sessions.delete(req.authToken);
    }
    res.json({ ok: true });
  });

  // 5. Current authenticated user
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: toPublicUser(req.authUser!) });
  });

  // 6. Change own password
  app.post('/api/auth/change-own-password', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (getEnvAdminPassword() && (user.isPrimaryAdmin || user.username === 'admin')) {
      res.status(400).json({
        error: 'Primary admin password is controlled by the ADMIN_INITIAL_PASSWORD environment secret.',
      });
      return;
    }

    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!verifyPassword(currentPassword, user.salt, user.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'New password must be between 6 and 128 characters.' });
      return;
    }

    const { salt, hash } = hashPassword(newPassword);
    user.salt = salt;
    user.passwordHash = hash;
    user.updatedAt = new Date().toISOString();
    persistUsersStore();
    revokeUserSessions(user.id, req.authToken);

    res.json({ ok: true });
  });

  // 7. Admin: List all staff accounts
  app.get('/api/auth/users', requireAuth, requireAdmin, (_req, res) => {
    res.json({ users: usersStore.map(toPublicUser) });
  });

  // 8. Admin: Create staff account (Cashier, Inventory Manager, Accountant, Admin, Custom)
  app.post('/api/auth/users', requireAuth, requireAdmin, (req, res) => {
    const username =
      typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const displayName =
      typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 80) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role: UserRole = VALID_ROLES.includes(req.body?.role) ? req.body.role : 'cashier';

    if (!USERNAME_REGEX.test(username)) {
      res.status(400).json({
        error: 'Username must be 3–32 characters (letters, numbers, dot, underscore, or dash).',
      });
      return;
    }
    if (!displayName) {
      res.status(400).json({ error: 'Display name is required.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
      return;
    }
    if (usersStore.some((u) => u.username === username)) {
      res.status(409).json({ error: 'A staff account with this username already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const { salt, hash } = hashPassword(password);
    const created: StoredStaffUser = {
      id: `usr-${crypto.randomBytes(6).toString('hex')}`,
      username,
      displayName,
      role,
      allowedModules: sanitizeModules(req.body?.allowedModules, role),
      permissions: sanitizePermissions(req.body?.permissions, role),
      active: req.body?.active !== false,
      salt,
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    };

    usersStore.push(created);
    persistUsersStore();
    res.status(201).json({ user: toPublicUser(created) });
  });

  // 9. Admin: Update staff account role, modules, permissions, or active status
  app.patch('/api/auth/users/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const target = usersStore.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Staff account not found.' });
      return;
    }

    const nextRole: UserRole = VALID_ROLES.includes(req.body?.role) ? req.body.role : target.role;
    const nextActive = typeof req.body?.active === 'boolean' ? req.body.active : target.active;
    const nextDisplayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 80)
        : target.displayName;

    // Prevent disabling or demoting the last active Administrator
    const otherActiveAdmins = usersStore.filter(
      (u) => u.id !== target.id && u.role === 'admin' && u.active
    );
    if (target.role === 'admin' && (nextRole !== 'admin' || !nextActive) && otherActiveAdmins.length === 0) {
      res.status(400).json({
        error: 'Cannot disable or demote the last active Administrator account.',
      });
      return;
    }

    target.displayName = nextDisplayName;
    target.role = nextRole;
    target.allowedModules = sanitizeModules(
      req.body?.allowedModules ?? target.allowedModules,
      nextRole
    );
    target.permissions = sanitizePermissions(req.body?.permissions ?? target.permissions, nextRole);
    target.active = nextActive;
    target.updatedAt = new Date().toISOString();

    if (!nextActive) {
      revokeUserSessions(target.id);
    }

    persistUsersStore();
    res.json({ user: toPublicUser(target) });
  });

  // 10. Admin: Set or reset any staff account's password
  app.post('/api/auth/users/:id/password', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const target = usersStore.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Staff account not found.' });
      return;
    }

    if (getEnvAdminPassword() && (target.isPrimaryAdmin || target.username === 'admin')) {
      res.status(400).json({
        error: 'Primary admin password is controlled by the ADMIN_INITIAL_PASSWORD environment secret.',
      });
      return;
    }

    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
      return;
    }

    const { salt, hash } = hashPassword(newPassword);
    target.salt = salt;
    target.passwordHash = hash;
    target.updatedAt = new Date().toISOString();
    persistUsersStore();

    // Revoke existing sessions for target user if different from caller
    if (target.id !== req.authUser?.id) {
      revokeUserSessions(target.id);
    }

    res.json({ ok: true });
  });

  // 11. Admin: Delete a staff account
  app.delete('/api/auth/users/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const target = usersStore.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Staff account not found.' });
      return;
    }
    if (target.id === req.authUser?.id) {
      res.status(400).json({ error: 'You cannot delete the currently signed-in account.' });
      return;
    }
    const otherActiveAdmins = usersStore.filter(
      (u) => u.id !== target.id && u.role === 'admin' && u.active
    );
    if (target.role === 'admin' && otherActiveAdmins.length === 0) {
      res.status(400).json({ error: 'Cannot delete the last active Administrator account.' });
      return;
    }

    usersStore = usersStore.filter((u) => u.id !== target.id);
    revokeUserSessions(target.id);
    persistUsersStore();
    res.json({ ok: true });
  });

  // Mount Vite dev middleware in development, or serve static dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LedgerFlow ERP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
