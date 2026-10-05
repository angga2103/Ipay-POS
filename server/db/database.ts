import Database from 'better-sqlite3';
import {
  defaultDb,
  tenantContext,
  initTenantDatabase,
  getTenantDatabase,
  getAllTenantIds,
  sanitizeTenantId,
  closeTenantDatabase
} from './tenant';

// Export tenant utilities
export {
  defaultDb,
  tenantContext,
  initTenantDatabase,
  getTenantDatabase,
  getAllTenantIds,
  sanitizeTenantId,
  closeTenantDatabase
};

/**
 * Initialize default database schema & foundations
 */
export function initDatabase() {
  initTenantDatabase(defaultDb, 'default');
}

// Automatically ensure default database is ready on load
initDatabase();

/**
 * Global transparent Database Proxy.
 * Dynamically resolves to the active tenant's SQLite database
 * within the current async execution context (AsyncLocalStorage).
 * Falls back to defaultDb when invoked outside an HTTP request context (CLI, tests, seeds).
 */
export const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const context = tenantContext.getStore();
    const activeDb = context?.db || defaultDb;
    const val = (activeDb as any)[prop];
    if (typeof val === 'function') {
      return val.bind(activeDb);
    }
    return val;
  },
  set(_target, prop, value) {
    const context = tenantContext.getStore();
    const activeDb = context?.db || defaultDb;
    (activeDb as any)[prop] = value;
    return true;
  }
});

export default db;
