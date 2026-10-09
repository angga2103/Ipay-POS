import path from 'path';
import fs from 'fs';
import db from '../db/database';
import { tenantContext, getAllTenantIds, getTenantDatabase, closeTenantDatabase } from '../db/tenant';

export interface BackupItem {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  frequency: 'hourly' | 'every_6_hours' | 'every_12_hours' | 'daily' | 'weekly';
  retentionDays: number;
  lastBackupAt: string | null;
}

export class BackupService {
  private static backupDir = path.resolve(__dirname, '../../data/backups');

  /**
   * Ensure backup directory exists
   */
  private static ensureDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Format bytes to readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Current active tenant ID
   */
  private static getCurrentTenantId(): string {
    return tenantContext.getStore()?.tenantId || 'default';
  }

  /**
   * Get backup settings from database
   */
  static getSettings(): BackupSettings {
    const getSetting = (key: string, def = '') => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : def;
    };

    return {
      autoBackupEnabled: getSetting('auto_backup_enabled', 'true') === 'true',
      frequency: (getSetting('auto_backup_frequency', 'daily') as any),
      retentionDays: parseInt(getSetting('auto_backup_retention_days', '14'), 10),
      lastBackupAt: getSetting('last_backup_timestamp', null as any),
    };
  }

  /**
   * Update backup settings
   */
  static updateSettings(settings: Partial<BackupSettings>) {
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    if (settings.autoBackupEnabled !== undefined) {
      upsert.run('auto_backup_enabled', settings.autoBackupEnabled ? 'true' : 'false');
    }
    if (settings.frequency !== undefined) {
      upsert.run('auto_backup_frequency', settings.frequency);
    }
    if (settings.retentionDays !== undefined) {
      upsert.run('auto_backup_retention_days', settings.retentionDays.toString());
    }
    if (settings.lastBackupAt !== undefined) {
      upsert.run('last_backup_timestamp', settings.lastBackupAt);
    }

    return this.getSettings();
  }

  /**
   * Create a new database backup using SQLite native backup API
   */
  static async createBackup(reason = 'manual'): Promise<BackupItem> {
    this.ensureDir();
    const tenantId = this.getCurrentTenantId();

    const now = new Date();
    const timestampStr = now.toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    
    const filename = `pos_backup_${tenantId}_${timestampStr}_${reason}.db`;
    const targetPath = path.join(this.backupDir, filename);

    // Use better-sqlite3 native safe online backup
    await (db as any).backup(targetPath);

    const stats = fs.statSync(targetPath);

    // Update last backup timestamp
    this.updateSettings({ lastBackupAt: now.toISOString() });

    // Clean up old backups based on retention policy
    await this.cleanOldBackups();

    return {
      filename,
      sizeBytes: stats.size,
      sizeFormatted: this.formatBytes(stats.size),
      createdAt: now.toISOString(),
    };
  }

  /**
   * List all available backups for the current tenant
   */
  static listBackups(): BackupItem[] {
    this.ensureDir();
    const tenantId = this.getCurrentTenantId();

    const files = fs.readdirSync(this.backupDir);
    const backups: BackupItem[] = [];

    for (const file of files) {
      if (file.endsWith('.db')) {
        // Filter by tenant prefix
        const isMatch = tenantId === 'default'
          ? (file.startsWith('pos_backup_default_') || (!file.startsWith('pos_backup_') || !file.includes('_202')))
          : file.startsWith(`pos_backup_${tenantId}_`);

        if (isMatch) {
          const filePath = path.join(this.backupDir, file);
          try {
            const stats = fs.statSync(filePath);
            backups.push({
              filename: file,
              sizeBytes: stats.size,
              sizeFormatted: this.formatBytes(stats.size),
              createdAt: stats.mtime.toISOString(),
            });
          } catch {}
        }
      }
    }

    // Sort descending by creation date
    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get file path for download (with security check against path traversal)
   */
  static getBackupFilePath(filename: string): string {
    this.ensureDir();
    const sanitized = path.basename(filename);
    const fullPath = path.join(this.backupDir, sanitized);

    if (!fs.existsSync(fullPath) || !sanitized.endsWith('.db')) {
      throw new Error('File backup tidak ditemukan atau tidak valid');
    }

    const tenantId = this.getCurrentTenantId();
    const isValidTenant = tenantId === 'default'
      ? (sanitized.startsWith('pos_backup_default_') || (!sanitized.startsWith('pos_backup_') || !sanitized.includes('_202')))
      : sanitized.startsWith(`pos_backup_${tenantId}_`);

    if (!isValidTenant) {
      throw new Error('Akses ditolak: File backup bukan milik toko/tenant aktif');
    }

    return fullPath;
  }

  /**
   * Delete a backup file
   */
  static deleteBackup(filename: string): boolean {
    const filePath = this.getBackupFilePath(filename);
    fs.unlinkSync(filePath);
    return true;
  }

  /**
   * Restore database from backup
   */
  static async restoreBackup(filename: string): Promise<boolean> {
    const backupFilePath = this.getBackupFilePath(filename);
    const tenantId = this.getCurrentTenantId();

    const liveDbPath = tenantId === 'default'
      ? path.resolve(__dirname, '../../data/pos.db')
      : path.resolve(__dirname, `../../data/tenants/${tenantId}.db`);

    // 1. Create a safety snapshot before restoring
    await this.createBackup('pre_restore');

    // 2. Perform restore safely by checkpointing and closing the active pool connection
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}

    // Tutup koneksi database agar file lock di OS Windows terlepas sempurna
    closeTenantDatabase(tenantId);

    fs.copyFileSync(backupFilePath, liveDbPath);

    // Remove old wal/shm if present
    try { fs.unlinkSync(`${liveDbPath}-wal`); } catch {}
    try { fs.unlinkSync(`${liveDbPath}-shm`); } catch {}

    // Buka kembali koneksi database baru dari pool
    getTenantDatabase(tenantId);

    return true;
  }

  /**
   * Clean backups older than retention days for the current tenant
   */
  static async cleanOldBackups() {
    this.ensureDir();
    const settings = this.getSettings();
    const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const backups = this.listBackups();
    if (backups.length <= 3) return;

    for (let i = 3; i < backups.length; i++) {
      const item = backups[i];
      const age = now - new Date(item.createdAt).getTime();
      if (age > retentionMs) {
        try {
          fs.unlinkSync(path.join(this.backupDir, item.filename));
          console.log(`[Backup] Rotated old backup: ${item.filename}`);
        } catch {}
      }
    }
  }

  /**
   * Background Auto-Backup Scheduled Runner across all tenants
   */
  static startScheduler() {
    // Check every 15 minutes
    setInterval(async () => {
      try {
        const tenantIds = getAllTenantIds();
        for (const tId of tenantIds) {
          const tenantDb = getTenantDatabase(tId);
          await tenantContext.run({ tenantId: tId, db: tenantDb }, async () => {
            try {
              const settings = this.getSettings();
              if (!settings.autoBackupEnabled) return;

              const now = Date.now();
              const lastTime = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0;
              
              let intervalMs = 24 * 60 * 60 * 1000; // default daily
              switch (settings.frequency) {
                case 'hourly':
                  intervalMs = 60 * 60 * 1000;
                  break;
                case 'every_6_hours':
                  intervalMs = 6 * 60 * 60 * 1000;
                  break;
                case 'every_12_hours':
                  intervalMs = 12 * 60 * 60 * 1000;
                  break;
                case 'daily':
                  intervalMs = 24 * 60 * 60 * 1000;
                  break;
                case 'weekly':
                  intervalMs = 7 * 24 * 60 * 60 * 1000;
                  break;
              }

              if (now - lastTime >= intervalMs) {
                console.log(`[Auto-Backup] Menjalankan auto-backup untuk tenant ${tId} (${settings.frequency})...`);
                await this.createBackup('auto');
                console.log(`[Auto-Backup] Snapshot tenant ${tId} berhasil dibuat.`);
              }
            } catch (errTenant) {
              console.error(`[Auto-Backup] Error backup tenant ${tId}:`, errTenant);
            }
          });
        }
      } catch (err) {
        console.error('[Auto-Backup] Error global scheduler:', err);
      }
    }, 15 * 60 * 1000); // 15 mins check
  }
}
