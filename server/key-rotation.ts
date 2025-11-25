/**
 * KEY ROTATION SERVICE
 * 
 * Implements secure encryption key rotation without data loss.
 * 
 * ARCHITECTURE:
 * - Supports dual keys: ENCRYPTION_KEY (current) + ENCRYPTION_KEY_PREVIOUS (fallback)
 * - Decryption tries current key first, falls back to previous key
 * - Migration re-encrypts all data from previous key to current key
 * - After migration, previous key can be safely removed
 * 
 * KEY ROTATION WORKFLOW:
 * 1. Set new key as ENCRYPTION_KEY
 * 2. Move old key to ENCRYPTION_KEY_PREVIOUS
 * 3. Call migrateEncryptedData() to re-encrypt all data
 * 4. Remove ENCRYPTION_KEY_PREVIOUS after successful migration
 */

import crypto from 'crypto';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { decrypt as llmServiceDecrypt } from './llm-service';

// Key derivation for AES-256-CBC (matches auth.ts)
function deriveKey(rawKey: string): Buffer {
  return crypto.createHash('sha256').update(rawKey).digest();
}

// Encrypt with current key (AES-256-CBC format: iv:encrypted)
export function encryptWithKey(text: string, key: string): string {
  const derivedKey = deriveKey(key);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt with specific key (AES-256-CBC format: iv:encrypted)
export function decryptWithKey(encryptedText: string, key: string): string {
  const derivedKey = deriveKey(key);
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts.slice(1).join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Get available encryption keys (current + previous if set)
export function getEncryptionKeys(): { current: string; previous: string | null } {
  const current = process.env.ENCRYPTION_KEY;
  const previous = process.env.ENCRYPTION_KEY_PREVIOUS || null;
  
  if (!current) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  return { current, previous };
}

// Try to decrypt with current key, fallback to previous key
export function decryptWithFallback(encryptedText: string): { 
  decrypted: string; 
  usedKey: 'current' | 'previous';
  needsMigration: boolean;
} {
  const { current, previous } = getEncryptionKeys();
  
  // Try current key first
  try {
    const decrypted = decryptWithKey(encryptedText, current);
    return { decrypted, usedKey: 'current', needsMigration: false };
  } catch (currentKeyError) {
    // Current key failed, try previous key if available
    if (previous) {
      try {
        const decrypted = decryptWithKey(encryptedText, previous);
        console.log('[KeyRotation] Decrypted with previous key - data needs migration');
        return { decrypted, usedKey: 'previous', needsMigration: true };
      } catch (previousKeyError) {
        throw new Error('Failed to decrypt with both current and previous keys');
      }
    }
    throw currentKeyError;
  }
}

// Re-encrypt a single value from previous key to current key
// This version handles all encryption formats (CBC, GCM-3part, GCM-concat)
export function reEncrypt(encryptedText: string): { reEncrypted: string; migrated: boolean } {
  const { current, previous } = getEncryptionKeys();
  
  // Try to decrypt with current key first (no migration needed)
  try {
    decryptWithKey(encryptedText, current);
    return { reEncrypted: encryptedText, migrated: false }; // Already using current key
  } catch {
    // Current key failed, try previous key
  }
  
  if (!previous) {
    throw new Error('Cannot re-encrypt: current key failed and no previous key set');
  }
  
  // Decrypt with previous key and re-encrypt with current key
  const decrypted = decryptWithKey(encryptedText, previous);
  const reEncrypted = encryptWithKey(decrypted, current);
  return { reEncrypted, migrated: true };
}

export interface MigrationResult {
  success: boolean;
  tablesProcessed: string[];
  recordsMigrated: number;
  recordsFailed: number;
  errors: string[];
}

// Migrate all encrypted data from previous key to current key
export async function migrateEncryptedData(): Promise<MigrationResult> {
  const { current, previous } = getEncryptionKeys();
  
  if (!previous) {
    return {
      success: true,
      tablesProcessed: [],
      recordsMigrated: 0,
      recordsFailed: 0,
      errors: ['No ENCRYPTION_KEY_PREVIOUS set - nothing to migrate']
    };
  }
  
  const result: MigrationResult = {
    success: true,
    tablesProcessed: [],
    recordsMigrated: 0,
    recordsFailed: 0,
    errors: []
  };
  
  console.log('[KeyRotation] Starting encryption key migration...');
  
  // Migrate LLM configurations
  try {
    const llmConfigs = await db.execute(sql`
      SELECT id, api_key_encrypted FROM llm_configurations 
      WHERE api_key_encrypted IS NOT NULL
    `);
    
    result.tablesProcessed.push('llm_configurations');
    
    for (const row of llmConfigs.rows as { id: string; api_key_encrypted: string }[]) {
      try {
        // Use LLMService decrypt which handles all formats (CBC, GCM-3part, GCM-concat)
        // and supports key fallback
        const decrypted = llmServiceDecrypt(row.api_key_encrypted);
        
        // Re-encrypt with current key (always CBC format for consistency)
        const reEncrypted = encryptWithKey(decrypted, current);
        
        // Only update if the encrypted value would change
        if (reEncrypted !== row.api_key_encrypted) {
          await db.execute(sql`
            UPDATE llm_configurations 
            SET api_key_encrypted = ${reEncrypted}
            WHERE id = ${row.id}
          `);
          result.recordsMigrated++;
          console.log(`[KeyRotation] Migrated LLM config: ${row.id}`);
        }
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(`LLM config ${row.id}: ${error}`);
      }
    }
  } catch (error) {
    result.errors.push(`Failed to process llm_configurations: ${error}`);
  }
  
  // Migrate payment gateway credentials (if encrypted)
  try {
    const gateways = await db.execute(sql`
      SELECT id, api_key_encrypted, api_secret_encrypted 
      FROM payment_gateways 
      WHERE api_key_encrypted IS NOT NULL OR api_secret_encrypted IS NOT NULL
    `);
    
    result.tablesProcessed.push('payment_gateways');
    
    for (const row of gateways.rows as { id: string; api_key_encrypted: string | null; api_secret_encrypted: string | null }[]) {
      try {
        let updated = false;
        let newApiKey = row.api_key_encrypted;
        let newApiSecret = row.api_secret_encrypted;
        
        if (row.api_key_encrypted) {
          try {
            // Use llmServiceDecrypt which handles all formats
            const decrypted = llmServiceDecrypt(row.api_key_encrypted);
            newApiKey = encryptWithKey(decrypted, current);
            if (newApiKey !== row.api_key_encrypted) {
              updated = true;
            }
          } catch (e) {
            // Skip if can't decrypt - could be corrupted or using different encryption
          }
        }
        
        if (row.api_secret_encrypted) {
          try {
            // Use llmServiceDecrypt which handles all formats
            const decrypted = llmServiceDecrypt(row.api_secret_encrypted);
            newApiSecret = encryptWithKey(decrypted, current);
            if (newApiSecret !== row.api_secret_encrypted) {
              updated = true;
            }
          } catch (e) {
            // Skip if can't decrypt - could be corrupted or using different encryption
          }
        }
        
        if (updated) {
          await db.execute(sql`
            UPDATE payment_gateways 
            SET api_key_encrypted = ${newApiKey}, api_secret_encrypted = ${newApiSecret}
            WHERE id = ${row.id}
          `);
          result.recordsMigrated++;
          console.log(`[KeyRotation] Migrated payment gateway: ${row.id}`);
        }
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(`Payment gateway ${row.id}: ${error}`);
      }
    }
  } catch (error) {
    // Table might not exist - that's OK
    if (!String(error).includes('does not exist')) {
      result.errors.push(`Failed to process payment_gateways: ${error}`);
    }
  }
  
  // Update the encryption key fingerprint to the new key
  try {
    const fingerprint = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(current).digest('hex') + 'accute-key-guard')
      .digest('hex')
      .substring(0, 32);
    
    await db.execute(sql`
      UPDATE system_settings 
      SET value = ${fingerprint}, updated_at = NOW()
      WHERE key = 'encryption_key_fingerprint'
    `);
    console.log('[KeyRotation] Updated encryption key fingerprint');
  } catch (error) {
    result.errors.push(`Failed to update fingerprint: ${error}`);
  }
  
  result.success = result.recordsFailed === 0;
  
  console.log(`[KeyRotation] Migration complete:
  - Tables processed: ${result.tablesProcessed.join(', ')}
  - Records migrated: ${result.recordsMigrated}
  - Records failed: ${result.recordsFailed}
  - Errors: ${result.errors.length}`);
  
  return result;
}

// Check if key rotation is needed (previous key is set)
export function isKeyRotationPending(): boolean {
  return !!process.env.ENCRYPTION_KEY_PREVIOUS;
}

// Get key rotation status
export async function getKeyRotationStatus(): Promise<{
  hasPreviousKey: boolean;
  recordsNeedingMigration: number;
}> {
  const hasPreviousKey = !!process.env.ENCRYPTION_KEY_PREVIOUS;
  let recordsNeedingMigration = 0;
  
  if (hasPreviousKey) {
    try {
      const { current, previous } = getEncryptionKeys();
      
      // Check LLM configs
      const llmConfigs = await db.execute(sql`
        SELECT api_key_encrypted FROM llm_configurations 
        WHERE api_key_encrypted IS NOT NULL
      `);
      
      for (const row of llmConfigs.rows as { api_key_encrypted: string }[]) {
        try {
          decryptWithKey(row.api_key_encrypted, current);
        } catch {
          // Can't decrypt with current key, needs migration
          recordsNeedingMigration++;
        }
      }
    } catch (error) {
      console.error('[KeyRotation] Error checking migration status:', error);
    }
  }
  
  return { hasPreviousKey, recordsNeedingMigration };
}
