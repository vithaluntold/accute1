import crypto from 'crypto';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
}

export class EmailOAuthService {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (!envKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required for email OAuth');
    }
    this.encryptionKey = Buffer.from(envKey, 'hex');
  }

  /**
   * Encrypts OAuth credentials using AES-256-GCM
   * Returns format: iv:encryptedData:authTag
   */
  encryptCredentials(credentials: OAuthCredentials): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      const payload = JSON.stringify(credentials);
      let encrypted = cipher.update(payload, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
    } catch (error) {
      console.error('[EmailOAuthService] Encryption failed:', error);
      throw new Error('Failed to encrypt OAuth credentials');
    }
  }

  /**
   * Decrypts OAuth credentials from format: iv:encryptedData:authTag
   */
  decryptCredentials(encryptedData: string): OAuthCredentials {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, encrypted, authTagHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const credentials = JSON.parse(decrypted);
      
      return {
        ...credentials,
        tokenExpiry: new Date(credentials.tokenExpiry)
      };
    } catch (error) {
      console.error('[EmailOAuthService] Decryption failed:', error);
      throw new Error('Failed to decrypt OAuth credentials');
    }
  }

  /**
   * Check if access token is expired or will expire within 5 minutes
   */
  isTokenExpired(tokenExpiry: Date): boolean {
    const now = new Date();
    const expiryWithBuffer = new Date(tokenExpiry.getTime() - 5 * 60 * 1000); // 5 min buffer
    return now >= expiryWithBuffer;
  }

  /**
   * Refresh Gmail OAuth access token using refresh token
   */
  async refreshGmailToken(refreshToken: string): Promise<OAuthCredentials> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        `${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/oauth/gmail/callback`
      );

      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token || !credentials.expiry_date) {
        throw new Error('Invalid token refresh response');
      }

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        tokenExpiry: new Date(credentials.expiry_date)
      };
    } catch (error) {
      console.error('[EmailOAuthService] Gmail token refresh failed:', error);
      throw new Error('Failed to refresh Gmail access token');
    }
  }

  /**
   * Refresh Outlook/Microsoft Graph OAuth access token using refresh token
   */
  async refreshOutlookToken(refreshToken: string): Promise<OAuthCredentials> {
    try {
      const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      
      const params = new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID || '',
        client_secret: process.env.AZURE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access'
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.access_token || !data.expires_in) {
        throw new Error('Invalid token refresh response');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000)
      };
    } catch (error) {
      console.error('[EmailOAuthService] Outlook token refresh failed:', error);
      throw new Error('Failed to refresh Outlook access token');
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidToken(
    provider: 'gmail' | 'outlook',
    encryptedCredentials: string
  ): Promise<{ accessToken: string; needsUpdate: boolean; updatedCredentials?: string }> {
    try {
      const credentials = this.decryptCredentials(encryptedCredentials);

      if (!this.isTokenExpired(credentials.tokenExpiry)) {
        return { accessToken: credentials.accessToken, needsUpdate: false };
      }

      console.log(`[EmailOAuthService] Token expired for ${provider}, refreshing...`);

      const refreshed = provider === 'gmail'
        ? await this.refreshGmailToken(credentials.refreshToken)
        : await this.refreshOutlookToken(credentials.refreshToken);

      return {
        accessToken: refreshed.accessToken,
        needsUpdate: true,
        updatedCredentials: this.encryptCredentials(refreshed)
      };
    } catch (error) {
      console.error('[EmailOAuthService] Failed to get valid token:', error);
      throw error;
    }
  }

  /**
   * Initialize Gmail API client with valid credentials
   */
  async getGmailClient(encryptedCredentials: string): Promise<any> {
    const { accessToken } = await this.getValidToken('gmail', encryptedCredentials);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Initialize Microsoft Graph client with valid credentials
   */
  async getGraphClient(encryptedCredentials: string): Promise<Client> {
    const { accessToken } = await this.getValidToken('outlook', encryptedCredentials);

    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Validate Gmail OAuth credentials
   */
  async validateGmailCredentials(encryptedCredentials: string): Promise<boolean> {
    try {
      const gmail = await this.getGmailClient(encryptedCredentials);
      const response = await gmail.users.getProfile({ userId: 'me' });
      return !!response.data.emailAddress;
    } catch (error) {
      console.error('[EmailOAuthService] Gmail validation failed:', error);
      return false;
    }
  }

  /**
   * Validate Outlook OAuth credentials
   */
  async validateOutlookCredentials(encryptedCredentials: string): Promise<boolean> {
    try {
      const client = await this.getGraphClient(encryptedCredentials);
      const user = await client.api('/me').get();
      return !!user.mail || !!user.userPrincipalName;
    } catch (error) {
      console.error('[EmailOAuthService] Outlook validation failed:', error);
      return false;
    }
  }
}

export const emailOAuthService = new EmailOAuthService();
