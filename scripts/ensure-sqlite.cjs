/**
 * scripts/ensure-sqlite.cjs
 * Auto-detect and heal better-sqlite3 native binding compatibility issues
 * (e.g. GLIBC mismatch on Ubuntu 20.04 or missing prebuilds)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkAndFixSqlite() {
  let needsRebuild = false;
  let reason = '';

  try {
    // Attempt to initialize an in-memory SQLite database
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    // Successfully loaded native binding
    return;
  } catch (err) {
    needsRebuild = true;
    reason = err && err.message ? err.message : String(err);
  }

  if (needsRebuild) {
    console.log('[pos-ipay] Memeriksa dependensi native better-sqlite3...');
    console.log(`[pos-ipay] Terdeteksi kendala kompatibilitas binary: ${reason}`);

    const betterSqliteDir = path.dirname(require.resolve('better-sqlite3/package.json'));
    const prebuildsDir = path.join(betterSqliteDir, 'prebuilds');

    // If prebuilds directory exists and caused GLIBC error, remove it to force local compilation
    if (fs.existsSync(prebuildsDir)) {
      try {
        console.log('[pos-ipay] Membersihkan binary prebuild bawaan yang tidak cocok dengan kernel/GLIBC server...');
        fs.rmSync(prebuildsDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn('[pos-ipay] Gagal menghapus folder prebuilds:', rmErr.message);
      }
    }

    console.log('[pos-ipay] Mengompilasi ulang better-sqlite3 dari source code lokal...');
    try {
      execSync('npm rebuild better-sqlite3 --build-from-source', {
        stdio: 'inherit',
        env: { ...process.env }
      });

      // Verify again after rebuild
      const DatabasePost = require('better-sqlite3');
      const testDb = new DatabasePost(':memory:');
      testDb.close();
      console.log('[pos-ipay] [✔] better-sqlite3 berhasil dikompilasi ulang dan berfungsi normal!');
    } catch (buildErr) {
      console.warn('[pos-ipay] [!] Kompilasi otomatis selesai dengan catatan. Jika ada error, pastikan g++-10 terpasang di sistem.');
    }
  }
}

checkAndFixSqlite();
