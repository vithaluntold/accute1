import * as msal from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.JWT_SECRET?.slice(0, 32).padEnd(32, '0') || '0'.repeat(32));
const ALGORITHM = 'aes-256-gcm';

export interface OutlookOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  redirectUri: string;
}

export class OutlookOAuthService {
  private msalClient: msal.ConfidentialClientApplication;
  private config: OutlookOAuthConfig;

  constructor(config: OutlookOAuthConfig) {
    this.config = config;
    
    const clientId = config.clientId || process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.OUTLOOK_CLIENT_SECRET;
    const tenantId = config.tenantId || process.env.OUTLOOK_TENANT_ID || 'common';
    
    if (!clientId || !clientSecret) {
      throw new Error('Outlook OAuth credentials not configured');
    }

    const msalConfig: msal.Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret
      }
    };

    this.msalClient = new msal.ConfidentialClientApplication(msalConfig);
  }

  getAuthUrl(state: string): string {
    const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
      scopes: [
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.ReadWrite',
        'https://graph.microsoft.com/Mail.Send',
        'offline_access'
      ],
      redirectUri: this.config.redirectUri,
      state
    };

    return this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  async getTokensFromCode(code: string) {
    const tokenRequest: msal.AuthorizationCodeRequest = {
      code,
      scopes: [
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.ReadWrite',
        'offline_access'
      ],
      redirectUri: this.config.redirectUri
    };

    const response = await this.msalClient.acquireTokenByCode(tokenRequest);
    
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresIn: response.expiresOn ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000) : 3600
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const refreshRequest: msal.RefreshTokenRequest = {
      refreshToken,
      scopes: ['https://graph.microsoft.com/Mail.Read']
    };

    const response = await this.msalClient.acquireTokenByRefreshToken(refreshRequest);
    
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || refreshToken,
      expiresIn: response.expiresOn ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000) : 3600
    };
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

  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  async fetchEmails(encryptedCredentials: string, maxResults: number = 50) {
    const credentials = this.decryptCredentials(encryptedCredentials);
    const client = this.getGraphClient(credentials.accessToken);

    const messages = await client
      .api('/me/messages')
      .select('id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,bodyPreview,body,hasAttachments,isRead')
      .filter('isRead eq false')
      .top(maxResults)
      .orderby('receivedDateTime DESC')
      .get();

    return messages.value;
  }

  async getUserProfile(encryptedCredentials: string) {
    const credentials = this.decryptCredentials(encryptedCredentials);
    const client = this.getGraphClient(credentials.accessToken);

    const user = await client.api('/me').get();
    
    return {
      emailAddress: user.mail || user.userPrincipalName,
      displayName: user.displayName
    };
  }
}
