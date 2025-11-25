/**
 * Split Knowledge Approval Service
 * 
 * Implements dual-approval (quorum-based) workflow for sensitive key operations.
 * Requires multiple administrators to approve before execution.
 * 
 * Supported operations:
 * - create_kek: Create a new Key Encryption Key
 * - rotate_kek: Rotate an existing KEK
 * - revoke_kek: Revoke/disable a KEK
 * - emergency_decrypt: Emergency decryption (break-glass procedure)
 */

import crypto from 'crypto';
import { db } from './db';
import { keyOperationApprovals, keyOperationApprovalVotes, cryptoAuditLog, users } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export type OperationType = 'create_kek' | 'rotate_kek' | 'revoke_kek' | 'emergency_decrypt';

export interface ApprovalRequest {
  id: string;
  operationType: OperationType;
  requiredApprovals: number;
  currentApprovals: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  expiresAt: Date;
  initiatedBy: string;
  votes: ApprovalVote[];
}

export interface ApprovalVote {
  approverId: string;
  approverName: string;
  vote: 'approve' | 'reject';
  reason?: string;
  votedAt: Date;
}

export interface CreateApprovalOptions {
  operationType: OperationType;
  operationPayload: Record<string, any>;
  requiredApprovals?: number;
  expiresInMinutes?: number;
  initiatedBy: string;
}

/**
 * Split Knowledge Approval Service
 */
export class SplitKnowledgeService {
  private readonly DEFAULT_REQUIRED_APPROVALS = 2;
  private readonly DEFAULT_EXPIRY_MINUTES = 60; // 1 hour

  /**
   * Create a new approval request
   */
  async createApprovalRequest(options: CreateApprovalOptions): Promise<ApprovalRequest> {
    const {
      operationType,
      operationPayload,
      requiredApprovals = this.DEFAULT_REQUIRED_APPROVALS,
      expiresInMinutes = this.DEFAULT_EXPIRY_MINUTES,
      initiatedBy,
    } = options;

    // Generate approval token
    const approvalToken = crypto.randomBytes(32).toString('hex');
    const approvalTokenHash = crypto.createHash('sha512').update(approvalToken).digest('hex');

    // Calculate expiry
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Encrypt operation payload for security
    const encryptedPayload = this.encryptPayload(operationPayload);

    // Insert approval request
    const [approval] = await db.insert(keyOperationApprovals).values({
      operationType,
      operationPayload: encryptedPayload,
      requiredApprovals,
      currentApprovals: 0,
      approvalTokenHash,
      expiresAt,
      status: 'pending',
      initiatedBy,
    }).returning();

    // Log the operation
    await this.logApprovalOperation('create_approval', approval.id, initiatedBy, {
      operationType,
      requiredApprovals,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      id: approval.id,
      operationType: approval.operationType as OperationType,
      requiredApprovals: approval.requiredApprovals,
      currentApprovals: approval.currentApprovals,
      status: approval.status as any,
      expiresAt: approval.expiresAt,
      initiatedBy: approval.initiatedBy,
      votes: [],
    };
  }

  /**
   * Submit a vote for an approval request
   */
  async vote(
    approvalId: string,
    approverId: string,
    vote: 'approve' | 'reject',
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string; approval?: ApprovalRequest }> {
    // Get the approval request
    const [approval] = await db.select()
      .from(keyOperationApprovals)
      .where(eq(keyOperationApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return { success: false, message: 'Approval request not found' };
    }

    // Check if expired
    if (new Date() > approval.expiresAt) {
      await db.update(keyOperationApprovals)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(keyOperationApprovals.id, approvalId));
      return { success: false, message: 'Approval request has expired' };
    }

    // Check if already finalized
    if (approval.status !== 'pending') {
      return { success: false, message: `Approval request is already ${approval.status}` };
    }

    // Check if initiator is trying to vote (not allowed)
    if (approval.initiatedBy === approverId) {
      return { success: false, message: 'Initiator cannot vote on their own request' };
    }

    // Check if already voted
    const [existingVote] = await db.select()
      .from(keyOperationApprovalVotes)
      .where(
        and(
          eq(keyOperationApprovalVotes.approvalId, approvalId),
          eq(keyOperationApprovalVotes.approverId, approverId)
        )
      )
      .limit(1);

    if (existingVote) {
      return { success: false, message: 'You have already voted on this request' };
    }

    // Generate signed token hash
    const signedTokenHash = crypto.createHash('sha512')
      .update(`${approvalId}:${approverId}:${vote}:${Date.now()}`)
      .digest('hex');

    // Insert vote
    await db.insert(keyOperationApprovalVotes).values({
      approvalId,
      approverId,
      vote,
      signedTokenHash,
      ipAddress,
      userAgent,
      reason,
    });

    // Update approval counts
    const votes = await db.select()
      .from(keyOperationApprovalVotes)
      .where(eq(keyOperationApprovalVotes.approvalId, approvalId));

    const approveCount = votes.filter(v => v.vote === 'approve').length;
    const rejectCount = votes.filter(v => v.vote === 'reject').length;

    let newStatus = approval.status;
    
    // Check if we have enough approvals
    if (approveCount >= approval.requiredApprovals) {
      newStatus = 'approved';
    } else if (rejectCount > 0) {
      // Any rejection cancels the request
      newStatus = 'rejected';
    }

    await db.update(keyOperationApprovals)
      .set({
        currentApprovals: approveCount,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(keyOperationApprovals.id, approvalId));

    // Log the vote
    await this.logApprovalOperation('vote', approvalId, approverId, {
      vote,
      reason,
      newStatus,
      approveCount,
      rejectCount,
    });

    // Get updated approval
    const updatedApproval = await this.getApprovalRequest(approvalId);

    return {
      success: true,
      message: vote === 'approve' 
        ? `Vote recorded. ${approveCount}/${approval.requiredApprovals} approvals.`
        : 'Request rejected.',
      approval: updatedApproval!,
    };
  }

  /**
   * Execute an approved operation
   */
  async execute(
    approvalId: string,
    executorId: string,
    executionFn: (payload: Record<string, any>) => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    // Get the approval request
    const [approval] = await db.select()
      .from(keyOperationApprovals)
      .where(eq(keyOperationApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return { success: false, error: 'Approval request not found' };
    }

    if (approval.status !== 'approved') {
      return { success: false, error: `Cannot execute: status is ${approval.status}` };
    }

    // Check if expired
    if (new Date() > approval.expiresAt) {
      await db.update(keyOperationApprovals)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(keyOperationApprovals.id, approvalId));
      return { success: false, error: 'Approval has expired' };
    }

    try {
      // Decrypt payload
      const payload = this.decryptPayload(approval.operationPayload as any);

      // Execute the operation
      const result = await executionFn(payload);

      // Update approval as executed
      await db.update(keyOperationApprovals)
        .set({
          status: 'executed',
          executedAt: new Date(),
          executedBy: executorId,
          executionResult: { success: true, result },
          updatedAt: new Date(),
        })
        .where(eq(keyOperationApprovals.id, approvalId));

      // Log execution
      await this.logApprovalOperation('execute', approvalId, executorId, {
        operationType: approval.operationType,
        success: true,
      });

      return { success: true, result };
    } catch (error: any) {
      // Log failure
      await db.update(keyOperationApprovals)
        .set({
          executionResult: { success: false, error: error.message },
          updatedAt: new Date(),
        })
        .where(eq(keyOperationApprovals.id, approvalId));

      await this.logApprovalOperation('execute_failed', approvalId, executorId, {
        operationType: approval.operationType,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Get an approval request with votes
   */
  async getApprovalRequest(approvalId: string): Promise<ApprovalRequest | null> {
    const [approval] = await db.select()
      .from(keyOperationApprovals)
      .where(eq(keyOperationApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return null;
    }

    // Get votes with user names
    const votes = await db.select({
      approverId: keyOperationApprovalVotes.approverId,
      vote: keyOperationApprovalVotes.vote,
      reason: keyOperationApprovalVotes.reason,
      votedAt: keyOperationApprovalVotes.votedAt,
      firstName: users.firstName,
      lastName: users.lastName,
    })
      .from(keyOperationApprovalVotes)
      .leftJoin(users, eq(keyOperationApprovalVotes.approverId, users.id))
      .where(eq(keyOperationApprovalVotes.approvalId, approvalId));

    return {
      id: approval.id,
      operationType: approval.operationType as OperationType,
      requiredApprovals: approval.requiredApprovals,
      currentApprovals: approval.currentApprovals,
      status: approval.status as any,
      expiresAt: approval.expiresAt,
      initiatedBy: approval.initiatedBy,
      votes: votes.map(v => ({
        approverId: v.approverId,
        approverName: [v.firstName, v.lastName].filter(Boolean).join(' ') || 'Unknown',
        vote: v.vote as 'approve' | 'reject',
        reason: v.reason || undefined,
        votedAt: v.votedAt,
      })),
    };
  }

  /**
   * Get pending approval requests for an approver
   */
  async getPendingApprovals(approverId: string): Promise<ApprovalRequest[]> {
    const approvals = await db.select()
      .from(keyOperationApprovals)
      .where(
        and(
          eq(keyOperationApprovals.status, 'pending'),
          sql`${keyOperationApprovals.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(keyOperationApprovals.createdAt));

    const results: ApprovalRequest[] = [];

    for (const approval of approvals) {
      // Skip if this is the initiator
      if (approval.initiatedBy === approverId) continue;

      // Check if already voted
      const [existingVote] = await db.select()
        .from(keyOperationApprovalVotes)
        .where(
          and(
            eq(keyOperationApprovalVotes.approvalId, approval.id),
            eq(keyOperationApprovalVotes.approverId, approverId)
          )
        )
        .limit(1);

      if (existingVote) continue;

      const request = await this.getApprovalRequest(approval.id);
      if (request) {
        results.push(request);
      }
    }

    return results;
  }

  /**
   * Cancel an approval request (only by initiator)
   */
  async cancel(approvalId: string, userId: string): Promise<boolean> {
    const [approval] = await db.select()
      .from(keyOperationApprovals)
      .where(eq(keyOperationApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return false;
    }

    if (approval.initiatedBy !== userId) {
      throw new Error('Only the initiator can cancel an approval request');
    }

    if (approval.status !== 'pending') {
      throw new Error('Cannot cancel: request is no longer pending');
    }

    await db.update(keyOperationApprovals)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(keyOperationApprovals.id, approvalId));

    await this.logApprovalOperation('cancel', approvalId, userId, {
      operationType: approval.operationType,
    });

    return true;
  }

  /**
   * Encrypt payload for secure storage
   */
  private encryptPayload(payload: Record<string, any>): Record<string, any> {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      // Store as-is if no encryption key (development mode)
      return { unencrypted: true, data: payload };
    }

    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    const plaintext = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return {
      encrypted: true,
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  /**
   * Decrypt payload
   */
  private decryptPayload(encryptedPayload: Record<string, any>): Record<string, any> {
    if (encryptedPayload.unencrypted) {
      return encryptedPayload.data;
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY required to decrypt payload');
    }

    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = Buffer.from(encryptedPayload.iv, 'hex');
    const encrypted = Buffer.from(encryptedPayload.data, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Log approval operations
   */
  private async logApprovalOperation(
    operation: string,
    approvalId: string,
    actorUserId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Get previous hash for chain
      const [previousLog] = await db.select()
        .from(cryptoAuditLog)
        .orderBy(desc(cryptoAuditLog.sequenceNumber))
        .limit(1);

      const previousHash = previousLog?.entryHash || null;

      // Create entry hash
      const entryData = JSON.stringify({
        operation,
        approvalId,
        actorUserId,
        timestamp: new Date().toISOString(),
        previousHash,
        metadata,
      });

      const entryHash = crypto.createHash('sha512').update(entryData).digest('hex');

      // Insert log entry
      await db.insert(cryptoAuditLog).values({
        operation,
        operationType: 'approval',
        resourceType: 'key_operation',
        resourceId: approvalId,
        entryHash,
        previousHash,
        actorUserId,
        metadata,
        status: 'success',
      });
    } catch (error) {
      console.error('[SplitKnowledge] Failed to log operation:', error);
    }
  }
}

// Singleton instance
let splitKnowledgeService: SplitKnowledgeService | null = null;

/**
 * Get the split knowledge service instance
 */
export function getSplitKnowledgeService(): SplitKnowledgeService {
  if (!splitKnowledgeService) {
    splitKnowledgeService = new SplitKnowledgeService();
  }
  return splitKnowledgeService;
}
