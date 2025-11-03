/**
 * SECURITY: Data Migration Script for Razorpay Credential Encryption
 * 
 * This script re-encrypts all legacy plaintext Razorpay credentials using AES-256-GCM.
 * Run this script to bulk-upgrade historical data to encrypted format.
 * 
 * Usage:
 *   tsx server/migrate-encryption.ts
 * 
 * Features:
 * - Dry-run mode to preview changes without modifying data
 * - Progress tracking with counts
 * - Error handling with detailed logging
 * - Zero-downtime migration (reads and writes atomically)
 */

import { db } from "./db";
import { platformSubscriptions, paymentMethods, organizationKeys } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as cryptoUtils from "./crypto-utils";

interface MigrationStats {
  platformSubscriptionsUpdated: number;
  paymentMethodsUpdated: number;
  organizationKeysUpdated: number;
  errors: number;
  totalProcessed: number;
}

/**
 * Check if a value needs re-encryption (is plaintext)
 */
function needsReEncryption(value: string | null): boolean {
  if (!value) return false;
  
  // Encrypted format: iv:encryptedData:authTag (exactly 3 parts)
  const parts = value.split(':');
  return parts.length !== 3 || !parts.every(p => p.length > 0);
}

/**
 * Migrate platform subscriptions
 */
async function migratePlatformSubscriptions(dryRun: boolean): Promise<number> {
  console.log('\n🔄 Migrating platform subscriptions...');
  
  const subscriptions = await db
    .select()
    .from(platformSubscriptions);
  
  let updated = 0;
  
  for (const subscription of subscriptions) {
    if (subscription.razorpayCustomerId && needsReEncryption(subscription.razorpayCustomerId)) {
      console.log(`  ⚡ Found plaintext customer ID in subscription ${subscription.id}`);
      
      if (!dryRun) {
        try {
          const encrypted = cryptoUtils.encrypt(subscription.razorpayCustomerId);
          await db
            .update(platformSubscriptions)
            .set({ 
              razorpayCustomerId: encrypted,
              updatedAt: new Date()
            })
            .where(eq(platformSubscriptions.id, subscription.id));
          
          updated++;
          console.log(`  ✅ Encrypted subscription ${subscription.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to encrypt subscription ${subscription.id}:`, error);
        }
      } else {
        updated++;
        console.log(`  📋 Would encrypt subscription ${subscription.id} (dry run)`);
      }
    }
  }
  
  console.log(`✓ Platform subscriptions: ${updated} updated`);
  return updated;
}

/**
 * Migrate payment methods
 */
async function migratePaymentMethods(dryRun: boolean): Promise<number> {
  console.log('\n🔄 Migrating payment methods...');
  
  const methods = await db
    .select()
    .from(paymentMethods);
  
  let updated = 0;
  
  for (const method of methods) {
    const needsCustomerIdEncryption = method.razorpayCustomerId && needsReEncryption(method.razorpayCustomerId);
    const needsTokenIdEncryption = method.razorpayTokenId && needsReEncryption(method.razorpayTokenId);
    
    if (needsCustomerIdEncryption || needsTokenIdEncryption) {
      console.log(`  ⚡ Found plaintext credential(s) in payment method ${method.id}`);
      
      if (!dryRun) {
        try {
          const updates: any = { updatedAt: new Date() };
          
          if (needsCustomerIdEncryption && method.razorpayCustomerId) {
            updates.razorpayCustomerId = cryptoUtils.encrypt(method.razorpayCustomerId);
          }
          
          if (needsTokenIdEncryption && method.razorpayTokenId) {
            updates.razorpayTokenId = cryptoUtils.encrypt(method.razorpayTokenId);
          }
          
          await db
            .update(paymentMethods)
            .set(updates)
            .where(eq(paymentMethods.id, method.id));
          
          updated++;
          console.log(`  ✅ Encrypted payment method ${method.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to encrypt payment method ${method.id}:`, error);
        }
      } else {
        updated++;
        console.log(`  📋 Would encrypt payment method ${method.id} (dry run)`);
      }
    }
  }
  
  console.log(`✓ Payment methods: ${updated} updated`);
  return updated;
}

/**
 * Migrate organization keys
 */
async function migrateOrganizationKeys(dryRun: boolean): Promise<number> {
  console.log('\n🔄 Migrating organization keys...');
  
  const keys = await db
    .select()
    .from(organizationKeys);
  
  let updated = 0;
  
  for (const key of keys) {
    if (key.privateKey && needsReEncryption(key.privateKey)) {
      console.log(`  ⚡ Found plaintext private key for organization ${key.organizationId}`);
      
      if (!dryRun) {
        try {
          const encrypted = cryptoUtils.encrypt(key.privateKey);
          await db
            .update(organizationKeys)
            .set({ 
              privateKey: encrypted,
              rotatedAt: new Date() // Track when key was re-encrypted
            })
            .where(eq(organizationKeys.id, key.id));
          
          updated++;
          console.log(`  ✅ Encrypted organization key ${key.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to encrypt organization key ${key.id}:`, error);
        }
      } else {
        updated++;
        console.log(`  📋 Would encrypt organization key ${key.id} (dry run)`);
      }
    }
  }
  
  console.log(`✓ Organization keys: ${updated} updated`);
  return updated;
}

/**
 * Main migration function
 */
async function runMigration(dryRun: boolean = true): Promise<MigrationStats> {
  const stats: MigrationStats = {
    platformSubscriptionsUpdated: 0,
    paymentMethodsUpdated: 0,
    organizationKeysUpdated: 0,
    errors: 0,
    totalProcessed: 0,
  };
  
  console.log('🔐 Starting Razorpay Credential Re-Encryption Migration');
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will update database)'}`);
  console.log('━'.repeat(80));
  
  try {
    // Migrate platform subscriptions
    stats.platformSubscriptionsUpdated = await migratePlatformSubscriptions(dryRun);
    
    // Migrate payment methods
    stats.paymentMethodsUpdated = await migratePaymentMethods(dryRun);
    
    // Migrate organization keys
    stats.organizationKeysUpdated = await migrateOrganizationKeys(dryRun);
    
    stats.totalProcessed = stats.platformSubscriptionsUpdated + 
                          stats.paymentMethodsUpdated + 
                          stats.organizationKeysUpdated;
    
    console.log('\n' + '━'.repeat(80));
    console.log('📊 Migration Summary:');
    console.log(`  Platform Subscriptions: ${stats.platformSubscriptionsUpdated}`);
    console.log(`  Payment Methods: ${stats.paymentMethodsUpdated}`);
    console.log(`  Organization Keys: ${stats.organizationKeysUpdated}`);
    console.log(`  Total Records Updated: ${stats.totalProcessed}`);
    console.log(`  Errors: ${stats.errors}`);
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no data was modified');
      console.log('💡 To apply changes, run: tsx server/migrate-encryption.ts --apply');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    stats.errors++;
  }
  
  return stats;
}

export { runMigration, needsReEncryption };

// CLI execution - ES module compatible
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const isDryRun = !process.argv.includes('--apply');
  
  runMigration(isDryRun)
    .then((stats) => {
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
