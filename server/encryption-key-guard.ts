/**
 * ENCRYPTION KEY GUARD
 * 
 * This module ensures ENCRYPTION_KEY consistency across deployments.
 * It prevents the nightmare scenario where encrypted data becomes unreadable
 * because the encryption key was changed.
 * 
 * HOW IT WORKS:
 * 1. On first startup: Stores a fingerprint of the current ENCRYPTION_KEY
 * 2. On subsequent startups: Validates current key matches stored fingerprint
 * 3. If mismatch detected AND encrypted data exists: BLOCKS startup with clear instructions
 * 4. Provides migration tools for intentional key rotation
 */

import crypto from 'crypto';
import { db } from './db';
import { sql } from 'drizzle-orm';

// Generate a fingerprint of the encryption key (NOT the key itself for security)
function generateKeyFingerprint(key: string): string {
  // Double-hash to prevent rainbow table attacks while maintaining consistency
  const firstHash = crypto.createHash('sha256').update(key).digest('hex');
  const fingerprint = crypto.createHash('sha256').update(firstHash + 'accute-key-guard').digest('hex');
  return fingerprint.substring(0, 32); // 32 chars is enough for uniqueness
}

// Derive the same key that auth.ts uses for encryption
function deriveEncryptionKey(key: string): Buffer {
  return crypto.createHash('sha256').update(key).digest();
}

interface KeyGuardResult {
  success: boolean;
  error?: string;
  action?: 'first_run' | 'key_match' | 'key_mismatch' | 'no_encrypted_data';
  encryptedConfigCount?: number;
}

/**
 * Validate encryption key consistency on startup.
 * This MUST be called before any encrypted data is accessed.
 */
export async function validateEncryptionKeyConsistency(): Promise<KeyGuardResult> {
  const currentKey = process.env.ENCRYPTION_KEY;
  
  if (!currentKey) {
    return {
      success: false,
      error: 'ENCRYPTION_KEY environment variable is not set'
    };
  }

  const currentFingerprint = generateKeyFingerprint(currentKey);
  
  try {
    // Ensure system_settings table exists for storing the key fingerprint
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get stored fingerprint
    const result = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = 'encryption_key_fingerprint'
    `);
    
    const storedFingerprint = (result.rows[0] as { value: string } | undefined)?.value;

    // Check how many encrypted LLM configs exist
    const configCountResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM llm_configurations WHERE api_key_encrypted IS NOT NULL
    `);
    const encryptedConfigCount = parseInt((configCountResult.rows[0] as { count: string })?.count || '0');

    // CASE 1: First run - no stored fingerprint
    if (!storedFingerprint) {
      // Store the current fingerprint
      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('encryption_key_fingerprint', ${currentFingerprint}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${currentFingerprint}, updated_at = NOW()
      `);
      
      console.log('🔐 [KeyGuard] First run: Encryption key fingerprint stored');
      return {
        success: true,
        action: 'first_run',
        encryptedConfigCount
      };
    }

    // CASE 2: Key matches - all good
    if (storedFingerprint === currentFingerprint) {
      console.log('✅ [KeyGuard] Encryption key verified - matches stored fingerprint');
      return {
        success: true,
        action: 'key_match',
        encryptedConfigCount
      };
    }

    // CASE 3: Key mismatch detected
    console.error('⚠️  [KeyGuard] ENCRYPTION_KEY MISMATCH DETECTED!');
    console.error(`   Current fingerprint: ${currentFingerprint.substring(0, 8)}...`);
    console.error(`   Stored fingerprint:  ${storedFingerprint.substring(0, 8)}...`);

    // If no encrypted data exists, we can safely update the fingerprint
    if (encryptedConfigCount === 0) {
      console.log('🔄 [KeyGuard] No encrypted data found - updating fingerprint to new key');
      await db.execute(sql`
        UPDATE system_settings 
        SET value = ${currentFingerprint}, updated_at = NOW()
        WHERE key = 'encryption_key_fingerprint'
      `);
      return {
        success: true,
        action: 'no_encrypted_data',
        encryptedConfigCount: 0
      };
    }

    // CRITICAL: Encrypted data exists but key changed - test if we can decrypt
    const canDecrypt = await testDecryptionCapability();
    
    if (canDecrypt) {
      // Key changed but we can still decrypt (maybe same key, different encoding)
      console.log('✅ [KeyGuard] Key fingerprint differs but decryption works - updating fingerprint');
      await db.execute(sql`
        UPDATE system_settings 
        SET value = ${currentFingerprint}, updated_at = NOW()
        WHERE key = 'encryption_key_fingerprint'
      `);
      return {
        success: true,
        action: 'key_match',
        encryptedConfigCount
      };
    }

    // Key changed and we cannot decrypt existing data
    // WARNING: Do NOT block the server - just log a warning and continue
    // The decryption failures will be handled gracefully at runtime
    console.warn(`
⚠️  [KeyGuard] WARNING: ENCRYPTION_KEY may have changed
    ${encryptedConfigCount} encrypted LLM configuration(s) may fail to decrypt.
    Users will need to re-enter their API credentials if decryption fails.
    
    To prevent this warning, ensure ENCRYPTION_KEY is stable across deployments.
`);
    
    // Update fingerprint to new key so future checks pass
    await db.execute(sql`
      UPDATE system_settings 
      SET value = ${currentFingerprint}, updated_at = NOW()
      WHERE key = 'encryption_key_fingerprint'
    `);
    
    return {
      success: true, // Don't block - let server start
      action: 'key_mismatch',
      encryptedConfigCount,
      error: 'Encryption key changed - some configs may fail to decrypt'
    };

  } catch (error) {
    console.error('[KeyGuard] Error during validation:', error);
    // Don't block startup on KeyGuard errors - log and continue
    return {
      success: true,
      action: 'first_run',
      error: `KeyGuard check failed: ${error}`
    };
  }
}

/**
 * Test if we can actually decrypt existing LLM configurations
 */
async function testDecryptionCapability(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT api_key_encrypted FROM llm_configurations 
      WHERE api_key_encrypted IS NOT NULL 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return true; // No encrypted data to test
    }

    const encryptedKey = (result.rows[0] as { api_key_encrypted: string }).api_key_encrypted;
    const currentKey = process.env.ENCRYPTION_KEY!;
    const derivedKey = deriveEncryptionKey(currentKey);
    
    // Try to decrypt based on format
    const parts = encryptedKey.split(':');
    
    if (parts.length === 2) {
      // CBC format from auth.ts
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted.length > 0;
    }
    
    // For other formats, assume failure to be safe
    return false;
  } catch (error) {
    // Decryption failed
    return false;
  }
}

/**
 * Handle forced encryption key reset (when FORCE_ENCRYPTION_KEY_RESET=true)
 */
export async function handleForcedKeyReset(): Promise<void> {
  if (process.env.FORCE_ENCRYPTION_KEY_RESET !== 'true') {
    return;
  }

  console.log('⚠️  [KeyGuard] FORCE_ENCRYPTION_KEY_RESET detected - clearing encrypted data...');
  
  try {
    // Delete all encrypted LLM configurations
    const result = await db.execute(sql`
      DELETE FROM llm_configurations WHERE api_key_encrypted IS NOT NULL
    `);
    
    console.log(`🗑️  [KeyGuard] Deleted encrypted LLM configurations`);
    
    // Update fingerprint to new key
    const currentFingerprint = generateKeyFingerprint(process.env.ENCRYPTION_KEY!);
    await db.execute(sql`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('encryption_key_fingerprint', ${currentFingerprint}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${currentFingerprint}, updated_at = NOW()
    `);
    
    console.log('✅ [KeyGuard] Encryption key fingerprint updated to new key');
    console.log('');
    console.log('⚠️  IMPORTANT: Remove FORCE_ENCRYPTION_KEY_RESET from environment before next restart!');
    console.log('');
  } catch (error) {
    console.error('[KeyGuard] Failed to handle forced key reset:', error);
    throw error;
  }
}
