import crypto from 'crypto';
import { google } from 'googleapis';
import { db } from '../db';
import { oauthConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  scope?: string;
  providerAccountId?: string; // User's ID on the provider (Zoom user ID, Google email, etc.)
}

interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
}

export class VideoConferencingOAuthService {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (!envKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required for video conferencing OAuth');
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
      console.error('[VideoConferencingOAuth] Encryption failed:', error);
      throw new Error('Failed to encrypt OAuth credentials');
    }
  }

  /**
   * Decrypts OAuth credentials
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
      console.error('[VideoConferencingOAuth] Decryption failed:', error);
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
   * Get base redirect URI for OAuth callbacks
   */
  getRedirectUri(provider: string): string {
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN;
    if (!domain) {
      throw new Error('REPLIT_DOMAINS or REPLIT_DEV_DOMAIN must be set');
    }
    return `${domain}/api/oauth/${provider}/callback`;
  }

  /**
   * Refresh Google Calendar/Meet OAuth access token
   */
  async refreshGoogleToken(refreshToken: string): Promise<OAuthCredentials> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID, // Reusing Gmail credentials for Google Calendar
        process.env.GMAIL_CLIENT_SECRET,
        this.getRedirectUri('google_meet')
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
      console.error('[VideoConferencingOAuth] Google token refresh failed:', error);
      throw new Error('Failed to refresh Google access token');
    }
  }

  /**
   * Refresh Zoom OAuth access token
   */
  async refreshZoomToken(refreshToken: string): Promise<OAuthCredentials> {
    try {
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET must be set');
      }

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Zoom token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error('[VideoConferencingOAuth] Zoom token refresh failed:', error);
      throw new Error('Failed to refresh Zoom access token');
    }
  }

  /**
   * Refresh Microsoft Teams/Graph OAuth access token
   */
  async refreshMicrosoftToken(refreshToken: string): Promise<OAuthCredentials> {
    try {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set');
      }

      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Microsoft token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error('[VideoConferencingOAuth] Microsoft token refresh failed:', error);
      throw new Error('Failed to refresh Microsoft access token');
    }
  }

  /**
   * Get valid access token for a connection (auto-refreshes if expired)
   */
  async getValidAccessToken(
    organizationId: string,
    userId: string,
    provider: string
  ): Promise<string> {
    const connection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.organizationId, organizationId),
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, provider)
      ),
    });

    if (!connection) {
      throw new Error(`No ${provider} connection found`);
    }

    if (connection.status === 'revoked') {
      throw new Error(`${provider} connection has been revoked`);
    }

    let credentials = this.decryptCredentials(connection.encryptedCredentials);

    // Refresh if expired
    if (this.isTokenExpired(credentials.tokenExpiry)) {
      console.log(`[VideoConferencingOAuth] Token expired for ${provider}, refreshing...`);

      let refreshedCreds: OAuthCredentials;

      switch (provider) {
        case 'google_meet':
          refreshedCreds = await this.refreshGoogleToken(credentials.refreshToken);
          break;
        case 'zoom':
          refreshedCreds = await this.refreshZoomToken(credentials.refreshToken);
          break;
        case 'microsoft_teams':
          refreshedCreds = await this.refreshMicrosoftToken(credentials.refreshToken);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      // Update database with new credentials
      const encryptedCreds = this.encryptCredentials(refreshedCreds);
      await db.update(oauthConnections)
        .set({
          encryptedCredentials: encryptedCreds,
          expiresAt: refreshedCreds.tokenExpiry,
          updatedAt: new Date(),
        })
        .where(eq(oauthConnections.id, connection.id));

      credentials = refreshedCreds;
    }

    return credentials.accessToken;
  }

  /**
   * Revoke OAuth connection and mark as revoked in database
   */
  async revokeConnection(
    organizationId: string,
    userId: string,
    provider: string
  ): Promise<void> {
    const connection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.organizationId, organizationId),
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, provider)
      ),
    });

    if (!connection) {
      return; // Already revoked or doesn't exist
    }

    // Mark as revoked in database
    await db.update(oauthConnections)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(eq(oauthConnections.id, connection.id));

    console.log(`[VideoConferencingOAuth] Revoked ${provider} connection for user ${userId}`);
  }
}

// Singleton instance
export const videoOAuthService = new VideoConferencingOAuthService();
