import { google } from 'googleapis';
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.JWT_SECRET?.slice(0, 32).padEnd(32, '0') || '0'.repeat(32));
const ALGORITHM = 'aes-256-gcm';

export interface GmailOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
}

export class GmailOAuthService {
  private oauth2Client: any;
  private config: GmailOAuthConfig;

  constructor(config: GmailOAuthConfig) {
    this.config = config;
    
    const clientId = config.clientId || process.env.GMAIL_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.GMAIL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      config.redirectUri
    );
  }

  generateAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://mail.google.com/'
      ],
      prompt: 'consent',
      state
    });
  }

  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async refreshAccessToken(refreshToken: string) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials;
  }

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

  async fetchEmails(encryptedCredentials: string, maxResults: number = 50) {
    const credentials = this.decryptCredentials(encryptedCredentials);
    this.oauth2Client.setCredentials(credentials);

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'is:unread'
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages) {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full'
      });
      
      emails.push(email.data);
    }

    return emails;
  }

  async getUserProfile(encryptedCredentials: string) {
    const credentials = this.decryptCredentials(encryptedCredentials);
    this.oauth2Client.setCredentials(credentials);

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    return profile.data;
  }
}
