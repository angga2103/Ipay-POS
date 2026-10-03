import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { BackupService } from '../services/backup';

async function runBackupTests() {
  console.log('\n================================================================');
  console.log('💾 RUNNING DYNAMIC AUTO-BACKUP & DATABASE ROTATION TESTS');
  console.log('================================================================');

  // Test 1: Get & Update Backup Settings
  console.log('\n--- Test 1: Backup Configuration Management ---');
  const initialSettings = BackupService.getSettings();
  assert(typeof initialSettings.autoBackupEnabled === 'boolean', 'autoBackupEnabled must be boolean');

  const updated = BackupService.updateSettings({
    autoBackupEnabled: true,
    frequency: 'every_6_hours',
    retentionDays: 30,
  });
  assert(updated.autoBackupEnabled === true, 'Updated autoBackupEnabled must be true');
  assert(updated.frequency === 'every_6_hours', 'Updated frequency must be every_6_hours');
  assert(updated.retentionDays === 30, 'Updated retentionDays must be 30');
  console.log('✅ PASSED: Backup settings updated and persisted successfully');

  // Test 2: Create Safe Database Snapshot
  console.log('\n--- Test 2: Safe Online Database Snapshot Creation ---');
  const backup = await BackupService.createBackup('test_unit');
  assert(backup.filename.includes('test_unit'), 'Backup filename must contain reason tag');
  assert(backup.sizeBytes > 0, 'Backup file size must be greater than 0');
  console.log(`   * Created: ${backup.filename} (${backup.sizeFormatted})`);
  console.log('✅ PASSED: Safe SQLite database snapshot created successfully');

  // Test 3: List & Verify Backups
  console.log('\n--- Test 3: Backup Listing & File Verification ---');
  const list = BackupService.listBackups();
  assert(list.length >= 1, 'Backup list must contain at least 1 file');
  const found = list.find(b => b.filename === backup.filename);
  assert(found !== undefined, 'Created backup must be present in the listing');
  console.log(`   * Total Backups Found: ${list.length}`);
  console.log('✅ PASSED: Backup listing and metadata verified');

  // Test 4: Path Security & Download Verification
  console.log('\n--- Test 4: Secure File Path Resolution ---');
  const filePath = BackupService.getBackupFilePath(backup.filename);
  assert(fs.existsSync(filePath), 'Resolved backup file path must exist on disk');

  let traversalBlocked = false;
  try {
    BackupService.getBackupFilePath('../../etc/passwd');
  } catch {
    traversalBlocked = true;
  }
  assert(traversalBlocked, 'Directory traversal attempt must be blocked');
  console.log('✅ PASSED: Path resolution and anti-traversal security verified');

  // Test 5: Delete Backup
  console.log('\n--- Test 5: Backup Deletion ---');
  const deleted = BackupService.deleteBackup(backup.filename);
  assert(deleted === true, 'Delete backup must return true');
  assert(!fs.existsSync(filePath), 'Backup file must no longer exist on disk');
  console.log('✅ PASSED: Backup file deleted cleanly');

  console.log('\n================================================================');
  console.log('🎉 ALL DYNAMIC AUTO-BACKUP TESTS PASSED 100%!');
  console.log('================================================================\n');
}

runBackupTests().catch(err => {
  console.error('Backup test failed:', err);
  process.exit(1);
});
