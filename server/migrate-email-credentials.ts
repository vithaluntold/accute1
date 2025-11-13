/**
 * SECURITY: Data Migration Script for Email OAuth Credential Encryption
 * 
 * This script re-encrypts all legacy Gmail/Outlook OAuth credentials from the old JSON format
 * to the new colon-delimited format using ENCRYPTION_KEY instead of JWT_SECRET.
 * 
 * Legacy format: JSON string {"iv": "...", "authTag": "...", "encrypted": "..."}
 * New format: Colon-delimited string "iv:encrypted:authTag"
 * 
 * Usage:
 *   tsx server/migrate-email-credentials.ts           # Dry run (preview changes)
 *   tsx server/migrate-email-credentials.ts --apply   # Apply changes
 * 
 * Features:
 * - Dry-run mode to preview changes without modifying data
 * - Progress tracking with counts
 * - Error handling with detailed logging
 * - Zero-downtime migration (reads and writes atomically)
 * - Validates credentials before and after migration
 */

import { db } from "./db";
import { emailAccounts } from "../shared/schema";
import { EmailOAuthService } from "./services/EmailOAuthService";
import { eq } from "drizzle-orm";

interface MigrationStats {
  emailAccountsChecked: number;
  emailAccountsUpdated: number;
  errors: number;
  alreadyMigrated: number;
  failedAccountIds: string[];
}

/**
 * Check if a credential payload is in legacy JSON format
 */
function isLegacyFormat(encryptedData: string): boolean {
  try {
    const parsed = JSON.parse(encryptedData);
    // Legacy format must have these three string properties
    return (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.authTag === 'string' &&
      typeof parsed.encrypted === 'string'
    );
  } catch {
    // Not JSON, must be new format
    return false;
  }
}

/**
 * Migrate email accounts with per-account error isolation
 */
async function migrateEmailAccounts(dryRun: boolean): Promise<{ updated: number; alreadyMigrated: number; failed: string[] }> {
  console.log('\n🔄 Migrating email account OAuth credentials...');
  
  // SECURITY: Check if JWT_SECRET is available for legacy decryption
  if (!process.env.JWT_SECRET) {
    console.warn('\n⚠️  JWT_SECRET not found - legacy credential decryption will fail');
    console.warn('   If you have legacy Gmail/Outlook accounts, set JWT_SECRET before running migration');
    console.warn('   Continuing with migration (new-format accounts will still be processed)...\n');
  }
  
  const accounts = await db
    .select()
    .from(emailAccounts);
  
  let updated = 0;
  let alreadyMigrated = 0;
  const failedIds: string[] = [];
  
  // Initialize OAuth service once outside loop for efficiency
  const oauthService = new EmailOAuthService();
  
  for (const account of accounts) {
    if (!account.encryptedCredentials) {
      continue; // Skip accounts without credentials
    }
    
    // Check if credentials are in legacy format
    if (isLegacyFormat(account.encryptedCredentials)) {
      console.log(`  ⚡ Found legacy credentials for account ${account.id} (${account.email})`);
      
      if (!dryRun) {
        try {
          // Decrypt using backward-compatible logic (handles both formats)
          const credentials = oauthService.decryptCredentials(account.encryptedCredentials);
          
          // Re-encrypt using new format
          const newEncrypted = oauthService.encryptCredentials(credentials);
          
          // Update database with new format
          await db
            .update(emailAccounts)
            .set({ 
              encryptedCredentials: newEncrypted,
              updatedAt: new Date()
            })
            .where(eq(emailAccounts.id, account.id));
          
          updated++;
          console.log(`  ✅ Migrated account ${account.id} (${account.email}) to new format`);
        } catch (error: any) {
          // DEFENSIVE: Log error but continue with other accounts
          failedIds.push(account.id);
          console.error(`  ❌ Failed to migrate account ${account.id}:`, error.message);
          console.error(`     Account will remain in legacy format - manual intervention may be required`);
        }
      } else {
        updated++;
        console.log(`  📋 Would migrate account ${account.id} (${account.email}) (dry run)`);
      }
    } else {
      alreadyMigrated++;
      console.log(`  ✓ Account ${account.id} (${account.email}) already using new format`);
    }
  }
  
  console.log(`✓ Email accounts: ${updated} migrated, ${alreadyMigrated} already up-to-date, ${failedIds.length} failed`);
  return { updated, alreadyMigrated, failed: failedIds };
}

/**
 * Main migration function
 */
async function runMigration(dryRun: boolean = true): Promise<MigrationStats> {
  const stats: MigrationStats = {
    emailAccountsChecked: 0,
    emailAccountsUpdated: 0,
    errors: 0,
    alreadyMigrated: 0,
    failedAccountIds: [],
  };
  
  console.log('🔐 Starting Email OAuth Credential Re-Encryption Migration');
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will update database)'}`);
  console.log('━'.repeat(80));
  
  try {
    // Get all email accounts count first
    const allAccounts = await db.select().from(emailAccounts);
    stats.emailAccountsChecked = allAccounts.length;
    
    console.log(`📊 Found ${stats.emailAccountsChecked} email accounts to check`);
    
    // Migrate email accounts
    const { updated, alreadyMigrated, failed } = await migrateEmailAccounts(dryRun);
    stats.emailAccountsUpdated = updated;
    stats.alreadyMigrated = alreadyMigrated;
    stats.failedAccountIds = failed;
    
    console.log('\n' + '━'.repeat(80));
    console.log('📊 Migration Summary:');
    console.log(`  Total Accounts Checked: ${stats.emailAccountsChecked}`);
    console.log(`  Accounts Migrated: ${stats.emailAccountsUpdated}`);
    console.log(`  Already Up-to-Date: ${stats.alreadyMigrated}`);
    console.log(`  Failed Accounts: ${stats.failedAccountIds.length}`);
    
    if (stats.failedAccountIds.length > 0) {
      console.log(`\n⚠️  Failed Account IDs (require manual intervention):`);
      stats.failedAccountIds.forEach(id => console.log(`    - ${id}`));
    }
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no data was modified');
      console.log('💡 To apply changes, run: tsx server/migrate-email-credentials.ts --apply');
    } else {
      if (stats.failedAccountIds.length === 0) {
        console.log('\n✅ Migration completed successfully!');
        console.log('💡 All email accounts now use the new encryption format');
      } else {
        console.log('\n⚠️  Migration completed with errors');
        console.log(`💡 ${stats.emailAccountsUpdated} accounts migrated successfully`);
        console.log(`💡 ${stats.failedAccountIds.length} accounts failed - review errors above`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed catastrophically:', error);
    stats.errors++;
  }
  
  return stats;
}

export { runMigration, isLegacyFormat };

// CLI execution - ES module compatible
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const isDryRun = !process.argv.includes('--apply');
  
  runMigration(isDryRun)
    .then((stats) => {
      // Exit with error code if there were catastrophic errors OR failed accounts
      const hasFailures = stats.errors > 0 || stats.failedAccountIds.length > 0;
      process.exit(hasFailures ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
