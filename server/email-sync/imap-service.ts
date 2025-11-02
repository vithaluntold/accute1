import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.JWT_SECRET?.slice(0, 32).padEnd(32, '0') || '0'.repeat(32));
const ALGORITHM = 'aes-256-gcm';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class ImapEmailService {
  encryptCredentials(credentials: any): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    });
  }

  decryptCredentials(encryptedData: string): any {
    const { iv, authTag, encrypted } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  async testConnection(config: ImapConfig): Promise<boolean> {
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      logger: false
    });

    try {
      await client.connect();
      await client.logout();
      return true;
    } catch (error) {
      console.error('IMAP connection test failed:', error);
      return false;
    }
  }

  async fetchEmails(
    encryptedCredentials: string,
    imapHost: string,
    imapPort: number,
    useSsl: boolean,
    maxMessages: number = 50
  ) {
    const credentials = this.decryptCredentials(encryptedCredentials);
    
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: useSsl,
      auth: {
        user: credentials.user,
        pass: credentials.pass
      },
      logger: false
    });

    try {
      await client.connect();
      
      const lock = await client.getMailboxLock('INBOX');
      const emails = [];

      try {
        const messages = client.fetch('1:*', {
          envelope: true,
          source: true,
          flags: true,
          uid: true
        }, { uid: true });

        let count = 0;
        for await (const msg of messages) {
          if (count >= maxMessages) break;
          
          const parsed = await simpleParser(msg.source);
          
          emails.push({
            uid: msg.uid,
            messageId: msg.envelope.messageId,
            from: parsed.from?.text || '',
            to: parsed.to?.text.split(',') || [],
            cc: parsed.cc?.text.split(',').filter(Boolean) || [],
            bcc: parsed.bcc?.text.split(',').filter(Boolean) || [],
            subject: parsed.subject || '',
            body: parsed.text || '',
            bodyHtml: parsed.html || '',
            sentAt: parsed.date || new Date(),
            isRead: msg.flags.has('\\Seen'),
            attachments: parsed.attachments.map(att => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size
            }))
          });
          
          count++;
        }
      } finally {
        lock.release();
      }

      await client.logout();
      return emails;
    } catch (error) {
      console.error('IMAP fetch error:', error);
      throw error;
    }
  }

  async getUserEmail(
    encryptedCredentials: string,
    imapHost: string,
    imapPort: number,
    useSsl: boolean
  ): Promise<string> {
    const credentials = this.decryptCredentials(encryptedCredentials);
    return credentials.user;
  }
}
