import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/api';
import { tenantMiddleware } from './middleware/tenant';
import { getAllTenantIds, getTenantDatabase, tenantContext } from './db/tenant';
import './db/database'; // Initialize DB on launch

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes with Multi-Tenant context resolution
app.use('/api', tenantMiddleware, apiRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'POS IPAY Backend Multi-Tenant',
    timestamp: new Date().toISOString(),
    tenantsCount: getAllTenantIds().length,
  });
});

// Serve frontend production build (SPA)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  // SPA Fallback for HTML5 client-side routing (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 POS IPAY Multi-Tenant Server running at http://localhost:${PORT}`);
    console.log(`   - REST API: http://localhost:${PORT}/api`);
    console.log(`   - PPOB Webhook: http://localhost:${PORT}/api/ppob/webhook`);
    console.log(`   - Mode: Multi-Tenant Database-per-Tenant`);
    console.log(`===================================================`);

    // Background Auto-Poller: Periksa status transaksi PENDING setiap 20 detik ke ipay.my.id untuk SEMUA tenant
    setInterval(async () => {
      try {
        const { PPOBService } = await import('./services/ppob');
        const tenantIds = getAllTenantIds();
        for (const tId of tenantIds) {
          const tenantDb = getTenantDatabase(tId);
          await tenantContext.run({ tenantId: tId, db: tenantDb }, async () => {
            try {
              await PPOBService.syncAllPendingTransactions();
            } catch {
              // ignore poller error per tenant
            }
          });
        }
      } catch {
        // ignore background poller errors
      }
    }, 20000);

    // Start dynamic database auto-backup scheduler
    import('./services/backup').then(({ BackupService }) => {
      BackupService.startScheduler();
      console.log('   - Dynamic Multi-Tenant Auto-Backup: Scheduler aktif');
    }).catch(() => {});
  });
}

// Global Process Error Handlers for High Availability Production
process.on('uncaughtException', (err) => {
  console.error('⚠️ [PRODUCTION GUARD] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [PRODUCTION GUARD] Unhandled Rejection:', reason);
});

export default app;
