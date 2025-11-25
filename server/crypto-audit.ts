/**
 * Cryptographic Audit Trail Service
 * 
 * Implements tamper-proof audit logging for all cryptographic operations:
 * - Hash chain for integrity verification
 * - Digital signatures for non-repudiation
 * - Comprehensive operation tracking
 * 
 * Industry compliance:
 * - PCI DSS: Key management audit trail
 * - SOC 2: Security event logging
 * - GDPR: Data processing records
 */

import crypto from 'crypto';
import { db } from './db';
import { cryptoAuditLog } from '@shared/schema';
import { eq, desc, asc, and, gte, lte, sql } from 'drizzle-orm';
import { getKeyVaultClient } from './azure-keyvault';

export interface AuditLogEntry {
  id: string;
  sequenceNumber: number;
  operation: string;
  operationType: string;
  resourceType: string;
  resourceId?: string;
  kekId?: string;
  dekId?: string;
  actorUserId?: string;
  actorIpAddress?: string;
  status: string;
  entryHash: string;
  previousHash?: string;
  signature?: string;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface IntegrityReport {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenChainAt?: number;
  invalidSignatures: number[];
  message: string;
  verifiedAt: Date;
}

export interface AuditQuery {
  operation?: string;
  operationType?: string;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Cryptographic Audit Trail Service
 */
export class CryptoAuditService {
  private signingKeyName?: string;

  /**
   * Log a cryptographic operation with hash chain and optional signature
   */
  async logOperation(
    operation: string,
    operationType: 'kek' | 'dek' | 'data' | 'approval',
    resourceType: string,
    options: {
      resourceId?: string;
      kekId?: string;
      dekId?: string;
      actorUserId?: string;
      actorIpAddress?: string;
      actorUserAgent?: string;
      metadata?: Record<string, any>;
      sign?: boolean;
    } = {}
  ): Promise<string> {
    const {
      resourceId,
      kekId,
      dekId,
      actorUserId,
      actorIpAddress,
      actorUserAgent,
      metadata = {},
      sign = true,
    } = options;

    // Get previous log entry for hash chain
    const [previousLog] = await db.select()
      .from(cryptoAuditLog)
      .orderBy(desc(cryptoAuditLog.sequenceNumber))
      .limit(1);

    const previousHash = previousLog?.entryHash || null;

    // Create entry hash
    const timestamp = new Date().toISOString();
    const entryData = JSON.stringify({
      operation,
      operationType,
      resourceType,
      resourceId,
      kekId,
      dekId,
      actorUserId,
      timestamp,
      previousHash,
      metadata,
    });

    const entryHash = crypto.createHash('sha512').update(entryData).digest('hex');

    // Sign the entry if requested and Key Vault available
    let signature: string | undefined;
    let signatureKeyId: string | undefined;

    if (sign) {
      const vaultClient = getKeyVaultClient();
      if (vaultClient && this.signingKeyName) {
        try {
          const signResult = await vaultClient.sign(this.signingKeyName, Buffer.from(entryHash));
          signature = signResult.signature;
          signatureKeyId = this.signingKeyName;
        } catch (error) {
          console.warn('[CryptoAudit] Failed to sign entry:', error);
        }
      }
    }

    // Insert audit log entry
    const [entry] = await db.insert(cryptoAuditLog).values({
      operation,
      operationType,
      resourceType,
      resourceId,
      kekId,
      dekId,
      entryHash,
      previousHash,
      signature,
      signatureKeyId,
      actorUserId,
      actorIpAddress,
      actorUserAgent,
      metadata,
      status: 'success',
    }).returning();

    return entry.id;
  }

  /**
   * Log a failed operation
   */
  async logFailure(
    operation: string,
    operationType: 'kek' | 'dek' | 'data' | 'approval',
    resourceType: string,
    errorMessage: string,
    options: {
      resourceId?: string;
      kekId?: string;
      dekId?: string;
      actorUserId?: string;
      actorIpAddress?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const { resourceId, kekId, dekId, actorUserId, actorIpAddress, metadata = {} } = options;

    // Get previous hash
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
      errorMessage,
      metadata,
    });

    const entryHash = crypto.createHash('sha512').update(entryData).digest('hex');

    // Insert failed audit log entry
    const [entry] = await db.insert(cryptoAuditLog).values({
      operation,
      operationType,
      resourceType,
      resourceId,
      kekId,
      dekId,
      entryHash,
      previousHash,
      actorUserId,
      actorIpAddress,
      status: 'failed',
      errorMessage,
      metadata,
    }).returning();

    return entry.id;
  }

  /**
   * Verify the integrity of the audit log hash chain
   */
  async verifyIntegrity(options?: { startSequence?: number; endSequence?: number }): Promise<IntegrityReport> {
    const { startSequence, endSequence } = options || {};

    // Build query
    let query = db.select().from(cryptoAuditLog).orderBy(asc(cryptoAuditLog.sequenceNumber));

    if (startSequence !== undefined) {
      query = query.where(gte(cryptoAuditLog.sequenceNumber, startSequence)) as any;
    }
    if (endSequence !== undefined) {
      query = query.where(lte(cryptoAuditLog.sequenceNumber, endSequence)) as any;
    }

    const logs = await query;

    if (logs.length === 0) {
      return {
        valid: true,
        totalEntries: 0,
        verifiedEntries: 0,
        invalidSignatures: [],
        message: 'No audit log entries to verify',
        verifiedAt: new Date(),
      };
    }

    let previousHash: string | null = null;
    let verifiedEntries = 0;
    const invalidSignatures: number[] = [];

    for (const log of logs) {
      // Verify hash chain
      if (log.previousHash !== previousHash) {
        return {
          valid: false,
          totalEntries: logs.length,
          verifiedEntries,
          brokenChainAt: log.sequenceNumber,
          invalidSignatures,
          message: `Hash chain broken at sequence ${log.sequenceNumber}`,
          verifiedAt: new Date(),
        };
      }

      // Verify signature if present
      if (log.signature && log.signatureKeyId) {
        const vaultClient = getKeyVaultClient();
        if (vaultClient) {
          try {
            const isValid = await vaultClient.verify(
              log.signatureKeyId,
              Buffer.from(log.entryHash),
              log.signature
            );
            if (!isValid) {
              invalidSignatures.push(log.sequenceNumber);
            }
          } catch (error) {
            // Signature verification failed - could be key not found
            invalidSignatures.push(log.sequenceNumber);
          }
        }
      }

      previousHash = log.entryHash;
      verifiedEntries++;
    }

    const hasInvalidSignatures = invalidSignatures.length > 0;

    return {
      valid: !hasInvalidSignatures,
      totalEntries: logs.length,
      verifiedEntries,
      invalidSignatures,
      message: hasInvalidSignatures
        ? `Chain valid but ${invalidSignatures.length} invalid signature(s) found`
        : `Verified ${verifiedEntries} entries successfully`,
      verifiedAt: new Date(),
    };
  }

  /**
   * Query audit logs with filters
   */
  async query(options: AuditQuery): Promise<AuditLogEntry[]> {
    const {
      operation,
      operationType,
      resourceType,
      resourceId,
      actorUserId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = options;

    const conditions = [];

    if (operation) {
      conditions.push(eq(cryptoAuditLog.operation, operation));
    }
    if (operationType) {
      conditions.push(eq(cryptoAuditLog.operationType, operationType));
    }
    if (resourceType) {
      conditions.push(eq(cryptoAuditLog.resourceType, resourceType));
    }
    if (resourceId) {
      conditions.push(eq(cryptoAuditLog.resourceId, resourceId));
    }
    if (actorUserId) {
      conditions.push(eq(cryptoAuditLog.actorUserId, actorUserId));
    }
    if (startDate) {
      conditions.push(gte(cryptoAuditLog.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(cryptoAuditLog.createdAt, endDate));
    }

    let query = db.select().from(cryptoAuditLog);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const logs = await query
      .orderBy(desc(cryptoAuditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return logs.map(log => ({
      id: log.id,
      sequenceNumber: log.sequenceNumber,
      operation: log.operation,
      operationType: log.operationType,
      resourceType: log.resourceType,
      resourceId: log.resourceId || undefined,
      kekId: log.kekId || undefined,
      dekId: log.dekId || undefined,
      actorUserId: log.actorUserId || undefined,
      actorIpAddress: log.actorIpAddress || undefined,
      status: log.status,
      entryHash: log.entryHash,
      previousHash: log.previousHash || undefined,
      signature: log.signature || undefined,
      createdAt: log.createdAt,
      metadata: log.metadata as Record<string, any>,
    }));
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    operationsByType: Record<string, number>;
    operationsByActor: Record<string, number>;
  }> {
    const conditions = [];
    if (startDate) {
      conditions.push(gte(cryptoAuditLog.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(cryptoAuditLog.createdAt, endDate));
    }

    let query = db.select().from(cryptoAuditLog);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const logs = await query;

    const stats = {
      totalOperations: logs.length,
      successfulOperations: logs.filter(l => l.status === 'success').length,
      failedOperations: logs.filter(l => l.status === 'failed').length,
      operationsByType: {} as Record<string, number>,
      operationsByActor: {} as Record<string, number>,
    };

    for (const log of logs) {
      // Count by operation type
      const opType = `${log.operationType}:${log.operation}`;
      stats.operationsByType[opType] = (stats.operationsByType[opType] || 0) + 1;

      // Count by actor
      if (log.actorUserId) {
        stats.operationsByActor[log.actorUserId] = (stats.operationsByActor[log.actorUserId] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Export audit logs to WORM-compatible format
   */
  async exportForArchival(startDate: Date, endDate: Date): Promise<{
    entries: AuditLogEntry[];
    checksum: string;
    exportedAt: Date;
    range: { start: Date; end: Date };
  }> {
    const entries = await this.query({ startDate, endDate, limit: 10000 });

    // Create checksum of the export
    const exportData = JSON.stringify({
      entries,
      exportedAt: new Date().toISOString(),
      range: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const checksum = crypto.createHash('sha256').update(exportData).digest('hex');

    return {
      entries,
      checksum,
      exportedAt: new Date(),
      range: { start: startDate, end: endDate },
    };
  }

  /**
   * Set the signing key name for audit log signatures
   */
  setSigningKey(keyName: string): void {
    this.signingKeyName = keyName;
  }
}

// Singleton instance
let cryptoAuditService: CryptoAuditService | null = null;

/**
 * Get the crypto audit service instance
 */
export function getCryptoAuditService(): CryptoAuditService {
  if (!cryptoAuditService) {
    cryptoAuditService = new CryptoAuditService();
  }
  return cryptoAuditService;
}
