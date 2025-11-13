import { db } from '../db';
import { emailAccounts, emailMessages, EmailAccount } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { emailOAuthService } from './EmailOAuthService';
import { gmail_v1 } from 'googleapis';

interface EmailFetchResult {
  fetchedCount: number;
  newCount: number;
  errors: string[];
}

export class EmailSyncService {
  /**
   * Sync emails for a specific email account
   */
  async syncAccount(accountId: string): Promise<EmailFetchResult> {
    try {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId)
      });

      if (!account) {
        throw new Error(`Email account ${accountId} not found`);
      }

      if (account.status !== 'active') {
        console.log(`[EmailSync] Account ${accountId} is not active, skipping sync`);
        return { fetchedCount: 0, newCount: 0, errors: ['Account not active'] };
      }

      console.log(`[EmailSync] Starting sync for account: ${account.email} (${account.provider})`);

      let result: EmailFetchResult;

      switch (account.provider) {
        case 'gmail':
          result = await this.syncGmail(account);
          break;
        case 'outlook':
          result = await this.syncOutlook(account);
          break;
        default:
          throw new Error(`Unsupported provider: ${account.provider}`);
      }

      await db.update(emailAccounts)
        .set({
          lastSyncAt: new Date(),
          lastSyncError: result.errors.length > 0 ? result.errors.join('; ') : null,
          status: result.errors.length > 0 ? 'error' : 'active'
        })
        .where(eq(emailAccounts.id, accountId));

      console.log(`[EmailSync] Sync complete for ${account.email}: ${result.newCount} new messages`);

      return result;
    } catch (error) {
      console.error('[EmailSync] Sync failed:', error);
      
      await db.update(emailAccounts)
        .set({
          lastSyncAt: new Date(),
          lastSyncError: error instanceof Error ? error.message : 'Unknown error',
          status: 'error'
        })
        .where(eq(emailAccounts.id, accountId));

      throw error;
    }
  }

  /**
   * Sync emails from Gmail
   */
  private async syncGmail(account: EmailAccount): Promise<EmailFetchResult> {
    const result: EmailFetchResult = { fetchedCount: 0, newCount: 0, errors: [] };

    try {
      // Get valid token and check if it was refreshed
      const tokenResult = await emailOAuthService.getValidToken('gmail', account.encryptedCredentials);
      
      // CRITICAL: Persist refreshed credentials to prevent token expiry on next sync
      if (tokenResult.needsUpdate && tokenResult.updatedCredentials) {
        console.log(`[EmailSync] Persisting refreshed Gmail token for account ${account.id}`);
        await db.update(emailAccounts)
          .set({
            encryptedCredentials: tokenResult.updatedCredentials,
            updatedAt: new Date()
          })
          .where(eq(emailAccounts.id, account.id));
        
        // Update local reference
        account.encryptedCredentials = tokenResult.updatedCredentials;
      }

      const gmail = await emailOAuthService.getGmailClient(account.encryptedCredentials);

      const lastMessage = await db.query.emailMessages.findFirst({
        where: eq(emailMessages.emailAccountId, account.id),
        orderBy: desc(emailMessages.receivedAt),
        columns: { receivedAt: true }
      });

      const query = lastMessage
        ? `after:${Math.floor(lastMessage.receivedAt.getTime() / 1000)}`
        : 'in:inbox';

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100
      });

      const messages = response.data.messages || [];
      result.fetchedCount = messages.length;

      for (const msg of messages) {
        try {
          if (!msg.id) continue;

          const existing = await db.query.emailMessages.findFirst({
            where: and(
              eq(emailMessages.emailAccountId, account.id),
              eq(emailMessages.messageId, msg.id)
            )
          });

          if (existing) {
            continue;
          }

          const fullMsg = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          const parsed = this.parseGmailMessage(fullMsg.data, account);
          
          if (parsed) {
            await db.insert(emailMessages).values(parsed);
            result.newCount++;
          }
        } catch (error) {
          console.error(`[EmailSync] Failed to process Gmail message ${msg.id}:`, error);
          result.errors.push(`Message ${msg.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      console.error('[EmailSync] Gmail sync failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Parse Gmail message to database format
   */
  private parseGmailMessage(
    msg: gmail_v1.Schema$Message,
    account: EmailAccount
  ): any | null {
    try {
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('from');
      const to = getHeader('to').split(',').map(e => e.trim()).filter(Boolean);
      const cc = getHeader('cc').split(',').map(e => e.trim()).filter(Boolean);
      const subject = getHeader('subject');
      const messageId = getHeader('message-id') || msg.id || '';
      const threadId = msg.threadId || '';

      let bodyText = '';
      let bodyHtml = '';

      if (msg.payload?.parts) {
        for (const part of msg.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
      } else if (msg.payload?.body?.data) {
        const decoded = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
        if (msg.payload.mimeType === 'text/html') {
          bodyHtml = decoded;
        } else {
          bodyText = decoded;
        }
      }

      const snippet = msg.snippet || bodyText.substring(0, 200);

      const hasAttachments = (msg.payload?.parts || []).some(
        part => part.filename && part.filename.length > 0
      );

      const labels = msg.labelIds || [];

      const internalDate = msg.internalDate ? new Date(parseInt(msg.internalDate)) : new Date();

      return {
        emailAccountId: account.id,
        organizationId: account.organizationId,
        messageId,
        threadId,
        from,
        to,
        cc: cc.length > 0 ? cc : null,
        subject,
        body: bodyText || snippet,
        bodyHtml: bodyHtml || null,
        sentAt: internalDate,
        receivedAt: new Date(),
        isRead: !labels.includes('UNREAD'),
        isStarred: labels.includes('STARRED'),
        hasAttachments,
        labels,
        attachments: hasAttachments 
          ? (msg.payload?.parts || [])
              .filter(part => part.filename && part.filename.length > 0)
              .map(part => ({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body?.size,
                attachmentId: part.body?.attachmentId
              }))
          : [],
        aiProcessed: false
      };
    } catch (error) {
      console.error('[EmailSync] Failed to parse Gmail message:', error);
      return null;
    }
  }

  /**
   * Sync emails from Outlook/Microsoft Graph
   */
  private async syncOutlook(account: EmailAccount): Promise<EmailFetchResult> {
    const result: EmailFetchResult = { fetchedCount: 0, newCount: 0, errors: [] };

    try {
      // Get valid token and check if it was refreshed
      const tokenResult = await emailOAuthService.getValidToken('outlook', account.encryptedCredentials);
      
      // CRITICAL: Persist refreshed credentials to prevent token expiry on next sync
      if (tokenResult.needsUpdate && tokenResult.updatedCredentials) {
        console.log(`[EmailSync] Persisting refreshed Outlook token for account ${account.id}`);
        await db.update(emailAccounts)
          .set({
            encryptedCredentials: tokenResult.updatedCredentials,
            updatedAt: new Date()
          })
          .where(eq(emailAccounts.id, account.id));
        
        // Update local reference
        account.encryptedCredentials = tokenResult.updatedCredentials;
      }

      const client = await emailOAuthService.getGraphClient(account.encryptedCredentials);

      const lastMessage = await db.query.emailMessages.findFirst({
        where: eq(emailMessages.emailAccountId, account.id),
        orderBy: desc(emailMessages.receivedAt),
        columns: { receivedAt: true }
      });

      let url = '/me/messages?$top=100&$orderby=receivedDateTime desc';
      
      if (lastMessage) {
        const filterDate = lastMessage.receivedAt.toISOString();
        url += `&$filter=receivedDateTime gt ${filterDate}`;
      }

      const response = await client.api(url).get();
      const messages = response.value || [];
      result.fetchedCount = messages.length;

      for (const msg of messages) {
        try {
          const existing = await db.query.emailMessages.findFirst({
            where: and(
              eq(emailMessages.emailAccountId, account.id),
              eq(emailMessages.messageId, msg.id)
            )
          });

          if (existing) {
            continue;
          }

          const parsed = this.parseOutlookMessage(msg, account);
          
          if (parsed) {
            await db.insert(emailMessages).values(parsed);
            result.newCount++;
          }
        } catch (error) {
          console.error(`[EmailSync] Failed to process Outlook message ${msg.id}:`, error);
          result.errors.push(`Message ${msg.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      console.error('[EmailSync] Outlook sync failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Parse Outlook message to database format
   */
  private parseOutlookMessage(msg: any, account: EmailAccount): any | null {
    try {
      const from = msg.from?.emailAddress?.address || '';
      const to = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean);
      const cc = (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean);
      const subject = msg.subject || '';
      const messageId = msg.id || '';
      const conversationId = msg.conversationId || '';

      const bodyText = msg.body?.contentType === 'text' ? msg.body.content : '';
      const bodyHtml = msg.body?.contentType === 'html' ? msg.body.content : '';
      const snippet = msg.bodyPreview || bodyText.substring(0, 200);

      const hasAttachments = msg.hasAttachments || false;
      const isRead = msg.isRead || false;
      const categories = msg.categories || [];

      const receivedDate = msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date();
      const sentDate = msg.sentDateTime ? new Date(msg.sentDateTime) : receivedDate;

      return {
        emailAccountId: account.id,
        organizationId: account.organizationId,
        messageId,
        threadId: conversationId,
        from,
        to,
        cc: cc.length > 0 ? cc : null,
        subject,
        body: bodyText || snippet,
        bodyHtml: bodyHtml || null,
        sentAt: sentDate,
        receivedAt: receivedDate,
        isRead,
        isStarred: msg.flag?.flagStatus === 'flagged',
        hasAttachments,
        labels: categories,
        attachments: [],
        aiProcessed: false
      };
    } catch (error) {
      console.error('[EmailSync] Failed to parse Outlook message:', error);
      return null;
    }
  }

  /**
   * Sync all active email accounts for an organization
   */
  async syncOrganizationAccounts(organizationId: string): Promise<{
    accountsSynced: number;
    totalNewMessages: number;
    errors: Record<string, string[]>;
  }> {
    const accounts = await db.query.emailAccounts.findMany({
      where: and(
        eq(emailAccounts.organizationId, organizationId),
        eq(emailAccounts.status, 'active')
      )
    });

    const results = {
      accountsSynced: 0,
      totalNewMessages: 0,
      errors: {} as Record<string, string[]>
    };

    for (const account of accounts) {
      try {
        const result = await this.syncAccount(account.id);
        results.accountsSynced++;
        results.totalNewMessages += result.newCount;
        
        if (result.errors.length > 0) {
          results.errors[account.id] = result.errors;
        }
      } catch (error) {
        console.error(`[EmailSync] Failed to sync account ${account.id}:`, error);
        results.errors[account.id] = [error instanceof Error ? error.message : 'Unknown error'];
      }
    }

    return results;
  }
}

export const emailSyncService = new EmailSyncService();
