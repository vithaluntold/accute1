/**
 * Envelope Encryption Service
 * 
 * Implements KEK/DEK hierarchy for enterprise-grade encryption:
 * - KEK (Key Encryption Key): Stored in Azure Key Vault (HSM-backed)
 * - DEK (Data Encryption Key): Generated locally, wrapped by KEK, stored encrypted
 * 
 * Data flow:
 * 1. Generate DEK locally (AES-256)
 * 2. Encrypt data with DEK
 * 3. Wrap DEK with KEK (Key Vault)
 * 4. Store wrapped DEK + encrypted data
 * 
 * Decryption:
 * 1. Retrieve wrapped DEK
 * 2. Unwrap DEK using KEK (Key Vault)
 * 3. Decrypt data with DEK
 */

import crypto from 'crypto';
import { AzureKeyVaultClient, getKeyVaultClient, generateDEK } from './azure-keyvault';
import { db } from './db';
import { dekRegistry, kekRegistry, cryptoAuditLog } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  dekId: string;      // Reference to DEK in registry
  iv: string;         // Base64 encoded IV
  authTag: string;    // Base64 encoded auth tag
}

export interface DEKInfo {
  id: string;
  keyId: string;
  domain: string;
  kekId: string;
  isActive: boolean;
}

/**
 * Envelope Encryption Service
 */
export class EnvelopeEncryptionService {
  private vaultClient: AzureKeyVaultClient | null;
  private dekCache: Map<string, Buffer> = new Map();
  private dekCacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private dekCacheTimestamps: Map<string, number> = new Map();
  private fallbackMode: boolean = false;

  constructor() {
    this.vaultClient = getKeyVaultClient();
    this.fallbackMode = !this.vaultClient;
    
    if (this.fallbackMode) {
      console.warn('[EnvelopeEncryption] Running in fallback mode - using local encryption only');
    }
  }

  /**
   * Encrypt data using envelope encryption
   */
  async encrypt(
    plaintext: string | Buffer,
    domain: string,
    organizationId?: string,
    actorUserId?: string,
    actorIp?: string
  ): Promise<EncryptedData> {
    // Get or create active DEK for this domain
    const dek = await this.getOrCreateDEK(domain, organizationId);
    
    // Unwrap the DEK
    const dekPlaintext = await this.unwrapDEK(dek.id);
    
    // Encrypt data with DEK
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, dekPlaintext, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    
    const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Update DEK usage count
    await db.update(dekRegistry)
      .set({ 
        usageCount: dek.usageCount + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(dekRegistry.id, dek.id));
    
    // Audit log
    await this.logOperation('encrypt', 'data', domain, undefined, actorUserId, actorIp, {
      dekId: dek.id,
      domain,
      organizationId,
    });
    
    return {
      ciphertext: encrypted.toString('base64'),
      dekId: dek.id,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * Decrypt data using envelope encryption
   */
  async decrypt(
    encryptedData: EncryptedData,
    actorUserId?: string,
    actorIp?: string
  ): Promise<Buffer> {
    // Get the DEK
    const dek = await db.select().from(dekRegistry).where(eq(dekRegistry.id, encryptedData.dekId)).limit(1);
    
    if (!dek.length) {
      throw new Error(`DEK not found: ${encryptedData.dekId}`);
    }
    
    // Unwrap the DEK
    const dekPlaintext = await this.unwrapDEK(encryptedData.dekId);
    
    // Decrypt data with DEK
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, dekPlaintext, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    
    // Audit log
    await this.logOperation('decrypt', 'data', dek[0].domain, undefined, actorUserId, actorIp, {
      dekId: encryptedData.dekId,
      domain: dek[0].domain,
    });
    
    return decrypted;
  }

  /**
   * Encrypt a simple string (convenience method)
   */
  async encryptString(
    plaintext: string,
    domain: string,
    organizationId?: string,
    actorUserId?: string
  ): Promise<string> {
    const result = await this.encrypt(plaintext, domain, organizationId, actorUserId);
    // Return as a compact JSON string
    return JSON.stringify(result);
  }

  /**
   * Decrypt a simple string (convenience method)
   */
  async decryptString(
    encryptedJson: string,
    actorUserId?: string
  ): Promise<string> {
    const encryptedData: EncryptedData = JSON.parse(encryptedJson);
    const decrypted = await this.decrypt(encryptedData, actorUserId);
    return decrypted.toString('utf8');
  }

  /**
   * Check if a string is envelope-encrypted
   */
  isEnvelopeEncrypted(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return parsed.dekId && parsed.ciphertext && parsed.iv && parsed.authTag;
    } catch {
      return false;
    }
  }

  /**
   * Get or create a DEK for a domain
   */
  private async getOrCreateDEK(domain: string, organizationId?: string): Promise<typeof dekRegistry.$inferSelect> {
    // Try to find an active DEK for this domain
    const existingDEK = await db.select()
      .from(dekRegistry)
      .where(
        and(
          eq(dekRegistry.domain, domain),
          eq(dekRegistry.isActive, true),
          organizationId 
            ? eq(dekRegistry.organizationId, organizationId)
            : eq(dekRegistry.organizationId, '') // Platform-wide
        )
      )
      .limit(1);
    
    if (existingDEK.length > 0) {
      return existingDEK[0];
    }
    
    // Create a new DEK
    return this.createDEK(domain, organizationId);
  }

  /**
   * Create a new DEK and wrap it with the active KEK
   */
  private async createDEK(domain: string, organizationId?: string): Promise<typeof dekRegistry.$inferSelect> {
    // Get active KEK
    const activeKEK = await this.getActiveKEK();
    
    if (!activeKEK && !this.fallbackMode) {
      throw new Error('No active KEK available');
    }
    
    // Generate a new DEK
    const dekPlaintext = generateDEK(32); // 256-bit key
    const keyId = `dek-${domain}-${crypto.randomBytes(8).toString('hex')}`;
    
    let wrappedKeyMaterial: string;
    let kekId: string;
    
    if (this.vaultClient && activeKEK) {
      // Wrap DEK with KEK via Key Vault
      const wrapResult = await this.vaultClient.wrapKey(activeKEK.keyName, dekPlaintext);
      wrappedKeyMaterial = wrapResult.wrappedKey;
      kekId = activeKEK.id;
    } else {
      // Fallback: Encrypt DEK with local ENCRYPTION_KEY
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not set for fallback encryption');
      }
      
      // Use the same encryption as auth.ts for consistency
      const key = crypto.createHash('sha256').update(encryptionKey).digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      const encrypted = Buffer.concat([cipher.update(dekPlaintext), cipher.final()]);
      wrappedKeyMaterial = `${iv.toString('hex')}:${encrypted.toString('hex')}`;
      kekId = 'fallback-local-key';
    }
    
    // Store DEK in registry
    const [newDEK] = await db.insert(dekRegistry).values({
      keyId,
      kekId,
      wrappedKeyMaterial,
      keyWrapAlgorithm: this.vaultClient ? 'RSA-OAEP-256' : 'AES-256-CBC',
      algorithm: 'AES-256-GCM',
      domain,
      organizationId: organizationId || null,
      status: 'active',
      isActive: true,
      usageCount: 0,
    }).returning();
    
    // Cache the DEK
    this.dekCache.set(newDEK.id, dekPlaintext);
    this.dekCacheTimestamps.set(newDEK.id, Date.now());
    
    // Audit log
    await this.logOperation('create', 'dek', domain, undefined, undefined, undefined, {
      dekId: newDEK.id,
      kekId,
      domain,
    });
    
    return newDEK;
  }

  /**
   * Unwrap a DEK (retrieve plaintext key)
   */
  private async unwrapDEK(dekId: string): Promise<Buffer> {
    // Check cache first
    const cached = this.dekCache.get(dekId);
    const cacheTime = this.dekCacheTimestamps.get(dekId);
    
    if (cached && cacheTime && (Date.now() - cacheTime) < this.dekCacheTTL) {
      return cached;
    }
    
    // Get DEK from registry
    const [dek] = await db.select().from(dekRegistry).where(eq(dekRegistry.id, dekId)).limit(1);
    
    if (!dek) {
      throw new Error(`DEK not found: ${dekId}`);
    }
    
    let dekPlaintext: Buffer;
    
    if (dek.kekId === 'fallback-local-key') {
      // Decrypt using local ENCRYPTION_KEY
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not set for fallback decryption');
      }
      
      const key = crypto.createHash('sha256').update(encryptionKey).digest();
      const parts = dek.wrappedKeyMaterial.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      dekPlaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } else if (this.vaultClient) {
      // Get KEK info
      const [kek] = await db.select().from(kekRegistry).where(eq(kekRegistry.id, dek.kekId)).limit(1);
      
      if (!kek) {
        throw new Error(`KEK not found: ${dek.kekId}`);
      }
      
      // Unwrap via Key Vault
      const result = await this.vaultClient.unwrapKey(kek.keyName, dek.wrappedKeyMaterial);
      dekPlaintext = result.plainKey;
    } else {
      throw new Error('Cannot unwrap DEK: Key Vault not available and not a fallback key');
    }
    
    // Cache the DEK
    this.dekCache.set(dekId, dekPlaintext);
    this.dekCacheTimestamps.set(dekId, Date.now());
    
    return dekPlaintext;
  }

  /**
   * Get the active KEK
   */
  private async getActiveKEK(): Promise<typeof kekRegistry.$inferSelect | null> {
    const [activeKEK] = await db.select()
      .from(kekRegistry)
      .where(
        and(
          eq(kekRegistry.isActive, true),
          eq(kekRegistry.status, 'active')
        )
      )
      .orderBy(desc(kekRegistry.createdAt))
      .limit(1);
    
    return activeKEK || null;
  }

  /**
   * Rotate DEKs for a domain (re-wrap with new KEK)
   */
  async rotateDEKs(domain: string, newKEKId: string, actorUserId: string): Promise<number> {
    if (!this.vaultClient) {
      throw new Error('Key Vault required for DEK rotation');
    }
    
    // Get the new KEK
    const [newKEK] = await db.select().from(kekRegistry).where(eq(kekRegistry.id, newKEKId)).limit(1);
    if (!newKEK) {
      throw new Error(`New KEK not found: ${newKEKId}`);
    }
    
    // Get all active DEKs for this domain
    const deks = await db.select()
      .from(dekRegistry)
      .where(
        and(
          eq(dekRegistry.domain, domain),
          eq(dekRegistry.isActive, true)
        )
      );
    
    let rotated = 0;
    
    for (const dek of deks) {
      try {
        // Unwrap with old KEK
        const dekPlaintext = await this.unwrapDEK(dek.id);
        
        // Wrap with new KEK
        const wrapResult = await this.vaultClient.wrapKey(newKEK.keyName, dekPlaintext);
        
        // Update DEK
        await db.update(dekRegistry)
          .set({
            kekId: newKEKId,
            wrappedKeyMaterial: wrapResult.wrappedKey,
            updatedAt: new Date(),
          })
          .where(eq(dekRegistry.id, dek.id));
        
        // Clear from cache
        this.dekCache.delete(dek.id);
        this.dekCacheTimestamps.delete(dek.id);
        
        rotated++;
      } catch (error) {
        console.error(`[EnvelopeEncryption] Failed to rotate DEK ${dek.id}:`, error);
      }
    }
    
    // Audit log
    await this.logOperation('rotate', 'dek', domain, undefined, actorUserId, undefined, {
      domain,
      newKekId: newKEKId,
      deksRotated: rotated,
    });
    
    return rotated;
  }

  /**
   * Clear DEK cache (force refresh from Key Vault)
   */
  clearCache(): void {
    this.dekCache.clear();
    this.dekCacheTimestamps.clear();
  }

  /**
   * Log a cryptographic operation to the tamper-proof audit log
   */
  private async logOperation(
    operation: string,
    operationType: string,
    resourceType: string,
    resourceId?: string,
    actorUserId?: string,
    actorIp?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Get the previous log entry for hash chain
      const [previousLog] = await db.select()
        .from(cryptoAuditLog)
        .orderBy(desc(cryptoAuditLog.sequenceNumber))
        .limit(1);
      
      const previousHash = previousLog?.entryHash || null;
      
      // Create entry hash
      const entryData = JSON.stringify({
        operation,
        operationType,
        resourceType,
        resourceId,
        actorUserId,
        timestamp: new Date().toISOString(),
        previousHash,
        metadata,
      });
      
      const entryHash = crypto.createHash('sha512').update(entryData).digest('hex');
      
      // Sign the entry if Key Vault available
      let signature: string | undefined;
      let signatureKeyId: string | undefined;
      
      if (this.vaultClient) {
        try {
          const activeKEK = await this.getActiveKEK();
          if (activeKEK) {
            const signResult = await this.vaultClient.sign(activeKEK.keyName, Buffer.from(entryHash));
            signature = signResult.signature;
            signatureKeyId = activeKEK.keyName;
          }
        } catch (error) {
          // Continue without signature if signing fails
          console.warn('[EnvelopeEncryption] Failed to sign audit log entry:', error);
        }
      }
      
      // Insert audit log entry
      await db.insert(cryptoAuditLog).values({
        operation,
        operationType,
        resourceType,
        resourceId,
        entryHash,
        previousHash,
        signature,
        signatureKeyId,
        actorUserId,
        actorIpAddress: actorIp,
        metadata: metadata || {},
        status: 'success',
      });
    } catch (error) {
      console.error('[EnvelopeEncryption] Failed to log operation:', error);
      // Don't throw - logging failure shouldn't break encryption operations
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyAuditLogIntegrity(): Promise<{ valid: boolean; brokenAt?: number; message: string }> {
    const logs = await db.select()
      .from(cryptoAuditLog)
      .orderBy(cryptoAuditLog.sequenceNumber);
    
    if (logs.length === 0) {
      return { valid: true, message: 'No audit log entries to verify' };
    }
    
    let previousHash: string | null = null;
    
    for (const log of logs) {
      // Verify chain
      if (log.previousHash !== previousHash) {
        return {
          valid: false,
          brokenAt: log.sequenceNumber,
          message: `Hash chain broken at sequence ${log.sequenceNumber}: expected ${previousHash}, got ${log.previousHash}`,
        };
      }
      
      previousHash = log.entryHash;
    }
    
    return { valid: true, message: `Verified ${logs.length} audit log entries` };
  }
}

// Singleton instance
let envelopeEncryptionService: EnvelopeEncryptionService | null = null;

/**
 * Get the envelope encryption service instance
 */
export function getEnvelopeEncryptionService(): EnvelopeEncryptionService {
  if (!envelopeEncryptionService) {
    envelopeEncryptionService = new EnvelopeEncryptionService();
  }
  return envelopeEncryptionService;
}

/**
 * Initialize envelope encryption service
 */
export function initializeEnvelopeEncryption(): EnvelopeEncryptionService {
  envelopeEncryptionService = new EnvelopeEncryptionService();
  return envelopeEncryptionService;
}
