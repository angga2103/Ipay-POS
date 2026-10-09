import { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import { tenantContext, getTenantDatabase, sanitizeTenantId } from '../db/tenant';
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
  // Extract tenant ID from header or query param
  const rawHeader = req.headers['x-tenant-id'] as string | undefined;
  const rawQuery = (req.query.tenant || req.query.tenant_id) as string | undefined;
  const rawTenant = rawHeader || rawQuery || 'default';

  const tenantId = sanitizeTenantId(rawTenant);

  // Extract and verify Bearer token
  const authHeader = req.headers['authorization'];
  let tokenPayload: AuthTokenPayload | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    tokenPayload = verifyAuthToken(token);
  }

  // Cross-Tenant Authorization Guard:
  // If an authenticated user presents a token, they cannot access a different tenant's database
  if (tokenPayload && tenantId !== 'default' && tokenPayload.tenantId !== tenantId) {
    return res.status(403).json({
      error: 'Akses ditolak: Token autentikasi Anda tidak sesuai dengan tenant toko yang diminta.'
    });
  }

  // Protected Routes Guard for stores:
  const path = req.path || '';
  const isPublicRoute = 
    path.startsWith('/auth/') || 
    path === '/tenant/info' || 
    path === '/tenant/list' || 
    path === '/ppob/webhook' || 
    (path === '/users' && req.method === 'GET');

  const requiresAuth = !isPublicRoute && (process.env.NODE_ENV === 'production' || tenantId !== 'default');

  if (requiresAuth && !tokenPayload) {
    return res.status(401).json({
      error: 'Sesi autentikasi diperlukan untuk mengakses data toko ini. Silakan login kembali.'
    });
  }

  const tenantDb = getTenantDatabase(tenantId);

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

