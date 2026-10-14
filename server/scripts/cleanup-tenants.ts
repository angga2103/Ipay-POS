import fs from 'fs';
import path from 'path';
import { getTenantDatabase } from '../db/tenant';

// Allowed active tenant IDs (never deleted)
const KEEP_TENANTS = new Set(['default', 'arya-store']);

const dataDir = path.resolve(__dirname, '../../data');
const tenantsDir = path.join(dataDir, 'tenants');
const backupDir = path.join(dataDir, 'backups', 'deleted_zombies');

export function cleanupZombies() {
  console.log('====================================================');
  console.log('🧹 [POS-IPAY] PEMBERSINAN AKUN ZOMBI & SAMPAH LAMA');
  console.log('====================================================');

  if (!fs.existsSync(tenantsDir)) {
    console.log('Direktori tenants tidak ditemukan:', tenantsDir);
    return;
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const files = fs.readdirSync(tenantsDir);
  let deletedCount = 0;

  for (const file of files) {
    // Only check database files
    const extMatch = file.match(/^(.+?)\.db(-wal|-shm)?$/);
    if (!extMatch) continue;

    const tenantId = extMatch[1];
    if (KEEP_TENANTS.has(tenantId)) {
      console.log(`[KEEP] Menyimpan toko aktif: ${file}`);
      continue;
    }

    const srcPath = path.join(tenantsDir, file);
    const destPath = path.join(backupDir, `${Date.now()}_${file}`);

    try {
      // Backup before deleting
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
      deletedCount++;
      console.log(`[DELETED] Berhasil menghapus file sampah: ${file} (arsip tersimpan di backups)`);
    } catch (err: any) {
      console.error(`[ERROR] Gagal menghapus ${file}:`, err.message);
    }
  }

  console.log(`\n✅ Pembersihan selesai! Total file sampah dihapus: ${deletedCount}`);

  // Inisialisasi dan verifikasi toko resmi 'arya-store'
  console.log('\n====================================================');
  console.log('🏪 [POS-IPAY] INITIALIZING TOKO RESMI: arya-store');
  console.log('====================================================');

  try {
    const aryaDb = getTenantDatabase('arya-store', 'arya store');
    const upsert = aryaDb.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    
    upsert.run('store_name', 'arya store');
    upsert.run('store_phone', '087859000777');
    upsert.run('tenant_id', 'arya-store');
    upsert.run('ipay_merchant_id', 'IPAY_MCH_8822DED4');
    upsert.run('ipay_api_key', 'IPAY_LIVE_e485a7663c96747ba6df1520c7c9ad23');
    upsert.run('ipay_secret_key', 'SEC_6993c12658117d91');
    upsert.run('ipay_mode', 'live');
    upsert.run('ipay_provision_status', 'APPROVED');

    // Cek master_recovery_key dari database garudatel.db jika ada di VPS
    const garudaDbPaths = [
      '/var/www/garudatel/app/garudatel.db',
      path.resolve(__dirname, '../../../garudatell/app/garudatel.db'),
      path.resolve(__dirname, '../../../garudatel/app/garudatel.db'),
    ];
    let syncedKey: string | null = null;
    for (const gPath of garudaDbPaths) {
      if (fs.existsSync(gPath)) {
        try {
          const Database = require('better-sqlite3');
          const gDb = new Database(gPath, { readonly: true });
          const mchRow = gDb.prepare("SELECT master_recovery_key FROM merchant_api_keys WHERE merchant_id = 'IPAY_MCH_8822DED4' LIMIT 1").get() as any;
          if (mchRow && mchRow.master_recovery_key) {
            syncedKey = String(mchRow.master_recovery_key).trim();
            upsert.run('store_recovery_key', syncedKey);
            upsert.run('recovery_key', syncedKey);
            console.log(`🔑 [MasterKey] Berhasil menarik Master Key dari garudatel.db: ${syncedKey}`);
          }
          gDb.close();
        } catch (e: any) {
          console.log(`[Info] Cek garudatel.db (${gPath}):`, e.message);
        }
      }
    }

    // Jika belum ada recovery_key sama sekali di arya-store.db, pastikan ada key default
    const curKey = aryaDb.prepare("SELECT value FROM settings WHERE key IN ('store_recovery_key', 'recovery_key') LIMIT 1").get() as any;
    if (!curKey || !curKey.value) {
      const fallbackKey = 'RCV-8822-DED4-LIVE';
      upsert.run('store_recovery_key', fallbackKey);
      upsert.run('recovery_key', fallbackKey);
      console.log(`🔑 [MasterKey] Menyiapkan fallback Master Key: ${fallbackKey}`);
    }

    // Update user owner agar memiliki nomor WA 087859000777
    aryaDb.prepare("UPDATE users SET name = 'arya store', phone = '087859000777' WHERE role = 'owner'").run();

    console.log('✅ Toko arya-store aktif dengan kredensial LIVE IPAY_MCH_8822DED4 dan nomor WA 087859000777!');
  } catch (err: any) {
    console.error('Gagal menginisialisasi arya-store:', err.message);
  }

  console.log('====================================================\n');
}

if (require.main === module) {
  cleanupZombies();
}
