import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/api';
import { tenantMiddleware } from './middleware/tenant';
import { getAllTenantIds, getTenantDatabase, tenantContext } from './db/tenant';
import './db/database'; // Initialize DB on launch

const app = express();
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

export default app;
