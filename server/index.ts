import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/api';
import './db/database'; // Initialize DB on launch

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'POS IPAY Backend', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 POS IPAY Server running at http://localhost:${PORT}`);
  console.log(`   - REST API: http://localhost:${PORT}/api`);
  console.log(`   - PPOB Webhook: http://localhost:${PORT}/api/ppob/webhook`);
  console.log(`===================================================`);

  // Background Auto-Poller: Periksa status transaksi PENDING setiap 20 detik ke ipay.my.id
  setInterval(async () => {
    try {
      const { PPOBService } = await import('./services/ppob');
      await PPOBService.syncAllPendingTransactions();
    } catch {
      // ignore background poller errors
    }
  }, 20000);

  // Start dynamic database auto-backup scheduler
  import('./services/backup').then(({ BackupService }) => {
    BackupService.startScheduler();
    console.log('   - Dynamic Auto-Backup: Scheduler aktif');
  }).catch(() => {});
});

export default app;
