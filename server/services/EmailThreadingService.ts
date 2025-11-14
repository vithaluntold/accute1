import { db } from "../db";
import { emailMessages } from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";

/**
 * EmailThreadingService
 * 
 * Handles email conversation threading and grouping logic.
 * Threading strategy (in order of precedence):
 * 1. Use provider's threadId (Gmail/Outlook native threading)
 * 2. Parse In-Reply-To and References headers for RFC-compliant threading
 * 3. Subject-based grouping (Re:, Fwd:) as fallback
 * 4. Participant-based grouping (from/to addresses)
 */
export class EmailThreadingService {
  /**
   * Get all messages in a thread
   */
  async getThreadMessages(threadId: string, organizationId: string) {
    return db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.threadId, threadId),
          eq(emailMessages.organizationId, organizationId)
        )
      )
      .orderBy(sql`${emailMessages.sentAt} ASC`);
  }

  /**
   * Get or create thread for a message
   * Uses provider threadId if available, otherwise generates based on headers
   */
  async resolveThreadId(
    messageId: string,
    providedThreadId: string | null,
    subject: string,
    rawHeaders: any,
    from: string,
    to: string[],
    organizationId: string,
    emailAccountId: string
  ): Promise<string> {
    // Strategy 1: Use provider's thread ID if available (with deduplication)
    if (providedThreadId) {
      // Deduplicate: check if this threadId already exists
      const existingThread = await this.findThreadById(providedThreadId, organizationId);
      if (existingThread) {
        return providedThreadId;
      }
      // New thread - use provider's threadId
      return providedThreadId;
    }

    // Strategy 1.5: Check Outlook ConversationId header
    const conversationId = this.extractHeader(rawHeaders, 'thread-topic') || 
                          this.extractHeader(rawHeaders, 'x-microsoft-conversationid');
    if (conversationId) {
      const convThread = await this.findThreadById(conversationId, organizationId);
      if (convThread) {
        return conversationId;
      }
    }

    // Strategy 2: Check In-Reply-To header for parent message
    const inReplyTo = this.extractHeader(rawHeaders, 'in-reply-to');
    if (inReplyTo) {
      const cleanMessageId = this.cleanMessageId(inReplyTo);
      const parentMessage = await this.findMessageByMessageId(cleanMessageId, organizationId);
      if (parentMessage?.threadId) {
        return parentMessage.threadId;
      }
    }

    // Strategy 3: Check References header for thread ancestry (check in reverse order - most recent first)
    const references = this.extractHeader(rawHeaders, 'references');
    if (references) {
      const referenceIds = this.parseReferences(references).reverse(); // Check newest first
      for (const refId of referenceIds) {
        const refMessage = await this.findMessageByMessageId(refId, organizationId);
        if (refMessage?.threadId) {
          return refMessage.threadId;
        }
      }
    }

    // Strategy 4: Check List-Id header for mailing list threads
    const listId = this.extractHeader(rawHeaders, 'list-id');
    if (listId) {
      const normalizedSubject = this.normalizeSubject(subject);
      if (normalizedSubject.length >= 3) { // Minimum token length guard
        const listThread = await this.findListThread(listId, normalizedSubject, organizationId);
        if (listThread?.threadId) {
          return listThread.threadId;
        }
      }
    }

    // Strategy 5: Subject-based grouping with participant overlap guard
    const normalizedSubject = this.normalizeSubject(subject);
    if (normalizedSubject.length >= 3) { // Minimum token length to reduce false merges
      const subjectMatch = await this.findMessageBySubject(
        normalizedSubject,
        from,
        to,
        organizationId,
        emailAccountId
      );
      if (subjectMatch?.threadId) {
        // Verify participant overlap to reduce false positives
        const hasParticipantOverlap = this.checkParticipantOverlap(from, to, subjectMatch);
        if (hasParticipantOverlap) {
          return subjectMatch.threadId;
        }
      }
    }

    // Strategy 6: Create new thread (use messageId as threadId)
    return messageId;
  }

  /**
   * Clean message ID by removing angle brackets
   */
  private cleanMessageId(messageId: string): string {
    return messageId.replace(/[<>]/g, '').trim();
  }

  /**
   * Check if there's participant overlap between current and candidate message
   */
  private checkParticipantOverlap(from: string, to: string[], candidateMessage: any): boolean {
    const currentParticipants = new Set([from, ...to]);
    const candidateParticipants = new Set([
      candidateMessage.from,
      ...(candidateMessage.to || []),
      ...(candidateMessage.cc || [])
    ]);

    // Check if at least one participant matches
    for (const participant of currentParticipants) {
      if (candidateParticipants.has(participant)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find thread by threadId
   */
  private async findThreadById(threadId: string, organizationId: string) {
    const messages = await db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.threadId, threadId),
          eq(emailMessages.organizationId, organizationId)
        )
      )
      .limit(1);

    return messages[0] || null;
  }

  /**
   * Find thread in mailing list by List-Id and normalized subject
   */
  private async findListThread(listId: string, normalizedSubject: string, organizationId: string) {
    const messages = await db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.organizationId, organizationId),
          sql`${emailMessages.rawHeaders}->>'list-id' = ${listId}`,
          eq(emailMessages.normalizedSubject, normalizedSubject)
        )
      )
      .limit(1);

    return messages[0] || null;
  }

  /**
   * Find message by external message ID
   */
  private async findMessageByMessageId(messageId: string, organizationId: string) {
    const messages = await db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.messageId, messageId),
          eq(emailMessages.organizationId, organizationId)
        )
      )
      .limit(1);

    return messages[0] || null;
  }

  /**
   * Find message by normalized subject and participants
   */
  private async findMessageBySubject(
    normalizedSubject: string,
    from: string,
    to: string[],
    organizationId: string,
    emailAccountId: string
  ) {
    // Build participant matching condition
    // Match if from/to participants overlap (email conversation between same people)
    const messages = await db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.organizationId, organizationId),
          eq(emailMessages.emailAccountId, emailAccountId),
          eq(emailMessages.normalizedSubject, normalizedSubject)
        )
      )
      .orderBy(sql`${emailMessages.sentAt} DESC`)
      .limit(1);

    return messages[0] || null;
  }

  /**
   * Extract header value from raw headers object
   * Handles case variations and array values
   */
  private extractHeader(rawHeaders: any, headerName: string): string | null {
    if (!rawHeaders || typeof rawHeaders !== 'object') {
      return null;
    }

    // Try different case variations
    const variations = [
      headerName,
      headerName.toLowerCase(),
      headerName.toUpperCase(),
      headerName.split('-').map((p, i) => i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-')
    ];

    for (const variant of variations) {
      const value = rawHeaders[variant];
      if (value) {
        // Handle array values (some headers can be arrays)
        if (Array.isArray(value)) {
          return value[0] || null;
        }
        return String(value).trim();
      }
    }
    
    return null;
  }

  /**
   * Parse References header into array of message IDs
   * References: <msg1@example.com> <msg2@example.com> <msg3@example.com>
   */
  private parseReferences(references: string): string[] {
    if (!references) return [];
    
    // Extract all message IDs enclosed in angle brackets
    const matches = references.match(/<([^>]+)>/g);
    if (!matches) return [];
    
    return matches.map(match => match.replace(/[<>]/g, '').trim());
  }

  /**
   * Normalize subject by removing Re:, Fwd:, etc. prefixes
   * Handles multiple languages and formats: Re:, Fwd:, Aw:, Sv:, bracketed ticket IDs
   */
  private normalizeSubject(subject: string): string {
    if (!subject) return '';
    
    return subject
      // Remove common reply/forward prefixes (English, German, Swedish, etc.)
      .replace(/^(Re:|Fwd?:|FW:|RE:|FWD?:|Aw:|Sv:|R:|RV:)\s*/gi, '')
      // Remove bracketed ticket IDs like [TICKET-123] or [#456]
      .replace(/\[[^\]]*\]/g, '')
      // Collapse consecutive whitespace
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Get thread summary (message count, participants, latest message)
   */
  async getThreadSummary(threadId: string, organizationId: string) {
    const messages = await this.getThreadMessages(threadId, organizationId);
    
    if (messages.length === 0) {
      return null;
    }

    // Extract unique participants
    const participants = new Set<string>();
    messages.forEach(msg => {
      participants.add(msg.from);
      msg.to?.forEach(addr => participants.add(addr));
      msg.cc?.forEach(addr => participants.add(addr));
    });

    // Get latest message
    const latestMessage = messages[messages.length - 1];

    return {
      threadId,
      messageCount: messages.length,
      participants: Array.from(participants),
      subject: messages[0].subject, // First message subject
      latestMessageAt: latestMessage.sentAt,
      latestMessagePreview: this.getPreview(latestMessage.body),
      hasUnread: messages.some(msg => !msg.isRead),
      hasAttachments: messages.some(msg => msg.hasAttachments),
    };
  }

  /**
   * Get message preview (first 100 characters of body)
   */
  private getPreview(body: string, maxLength = 100): string {
    if (!body) return '';
    
    const plainText = body.replace(/<[^>]*>/g, '').trim(); // Strip HTML
    return plainText.length > maxLength
      ? plainText.substring(0, maxLength) + '...'
      : plainText;
  }

  /**
   * Mark thread as read
   */
  async markThreadAsRead(threadId: string, organizationId: string) {
    await db
      .update(emailMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(emailMessages.threadId, threadId),
          eq(emailMessages.organizationId, organizationId)
        )
      );
  }

  /**
   * Get all threads for an organization (grouped by threadId)
   */
  async getThreadsForOrganization(organizationId: string, limit = 50, offset = 0) {
    // Get unique threadIds with latest message timestamp
    const threads = await db.execute(sql`
      SELECT 
        thread_id,
        COUNT(*) as message_count,
        MAX(sent_at) as latest_message_at,
        BOOL_OR(NOT is_read) as has_unread,
        BOOL_OR(has_attachments) as has_attachments,
        ARRAY_AGG(DISTINCT "from") as participants_from,
        ARRAY_AGG(DISTINCT unnest(to)) FILTER (WHERE to IS NOT NULL) as participants_to,
        (ARRAY_AGG(subject ORDER BY sent_at ASC))[1] as first_subject,
        (ARRAY_AGG(body ORDER BY sent_at DESC))[1] as latest_body
      FROM ${emailMessages}
      WHERE organization_id = ${organizationId}
      GROUP BY thread_id
      ORDER BY latest_message_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return threads.rows.map((row: any) => ({
      threadId: row.thread_id,
      messageCount: parseInt(row.message_count),
      latestMessageAt: row.latest_message_at,
      hasUnread: row.has_unread,
      hasAttachments: row.has_attachments,
      participants: [
        ...(row.participants_from || []),
        ...(row.participants_to || [])
      ].filter((p, i, arr) => arr.indexOf(p) === i), // Unique
      subject: row.first_subject,
      latestMessagePreview: this.getPreview(row.latest_body),
    }));
  }
}
