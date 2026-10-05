import { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import { tenantContext, getTenantDatabase, sanitizeTenantId } from '../db/tenant';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantDb?: Database.Database;
    }
  }
}

/**
 * Express middleware to resolve the active tenant from incoming requests
 * and bind it to the async context (AsyncLocalStorage).
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Extract tenant ID from header or query param
  const rawHeader = req.headers['x-tenant-id'] as string | undefined;
  const rawQuery = (req.query.tenant || req.query.tenant_id) as string | undefined;
  const rawTenant = rawHeader || rawQuery || 'default';

  const tenantId = sanitizeTenantId(rawTenant);
  const tenantDb = getTenantDatabase(tenantId);

  // Attach to Express request object for convenience
  req.tenantId = tenantId;
  req.tenantDb = tenantDb;

  // Run downstream handlers within the tenant async context
  tenantContext.run({ tenantId, db: tenantDb }, () => {
    next();
  });
}
