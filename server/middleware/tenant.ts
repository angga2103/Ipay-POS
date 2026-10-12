import { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import { tenantContext, getTenantDatabase, sanitizeTenantId, resolveExistingTenantId, defaultDb } from '../db/tenant';
import { verifyAuthToken, AuthTokenPayload } from '../utils/auth-token';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantDb?: Database.Database;
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Express middleware to resolve the active tenant from incoming requests,
 * verify authentication tokens, prevent cross-tenant data tampering,
 * and bind the database instance to the async execution context (AsyncLocalStorage).
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract tenant ID from header, query param, or webhook JSON body
  const rawHeader = req.headers['x-tenant-id'] as string | undefined;
  const rawQuery = (req.query.tenant || req.query.tenant_id) as string | undefined;
  const rawBodyTenant = (req.path === '/ppob/provision-callback' || req.path === '/ppob/webhook')
    ? (req.body?.tenant_id || req.body?.tenantId)
    : undefined;
  const rawTenant = rawHeader || rawQuery || rawBodyTenant || 'default';

  // Extract and verify Bearer token
  const authHeader = req.headers['authorization'];
  let tokenPayload: AuthTokenPayload | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    tokenPayload = verifyAuthToken(token);
  }

  // Resolve existing tenant ID without creating phantom .db files on typos or bot requests
  let resolvedTenant = resolveExistingTenantId(rawTenant);
  if (!resolvedTenant && tokenPayload?.tenantId) {
    resolvedTenant = resolveExistingTenantId(tokenPayload.tenantId);
  }

  const path = req.path || '';
  const isPublicRoute =
    path.startsWith('/auth/') ||
    path === '/tenant/info' ||
    path === '/tenant/list' ||
    path === '/ppob/webhook' ||
    path === '/ppob/provision-callback' ||
    (path === '/users' && req.method === 'GET');

  // If tenant does not exist on disk and this is not a public auth/webhook route, reject instead of creating a new .db file
  if (!resolvedTenant) {
    if (isPublicRoute) {
      resolvedTenant = 'default';
    } else {
      return res.status(404).json({
        error: `Toko "${sanitizeTenantId(rawTenant)}" tidak ditemukan. Silakan periksa kembali ID Toko atau login ulang.`,
      });
    }
  }

  const tenantId = resolvedTenant;

  // Strict Cross-Tenant Authorization Guard (applies to ALL tenants including 'default')
  if (tokenPayload && !isPublicRoute && tokenPayload.tenantId !== tenantId) {
    return res.status(403).json({
      error: 'Akses ditolak: Token autentikasi Anda tidak sesuai dengan tenant toko yang diminta.',
    });
  }

  const requiresAuth = !isPublicRoute && (process.env.NODE_ENV === 'production' || tenantId !== 'default');

  if (requiresAuth && !tokenPayload) {
    return res.status(401).json({
      error: 'Sesi autentikasi diperlukan untuk mengakses data toko ini. Silakan login kembali.',
    });
  }

  const tenantDb = tenantId === 'default' ? defaultDb : getTenantDatabase(tenantId);

  // Attach to Express request object
  req.tenantId = tenantId;
  req.tenantDb = tenantDb;
  req.user = tokenPayload || undefined;

  // Run downstream handlers within the tenant async context
  tenantContext.run({ tenantId, db: tenantDb }, () => {
    next();
  });
}

/**
 * Role-Based Access Control (RBAC) middleware
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // If running in development/test on default store without auth, bypass
    if (process.env.NODE_ENV !== 'production' && req.tenantId === 'default' && !req.user) {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Sesi autentikasi diperlukan' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses ditolak: Fitur ini hanya dapat diakses oleh role [${roles.join(', ')}]`,
      });
    }

    next();
  };
}

