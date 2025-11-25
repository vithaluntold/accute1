/**
 * Azure Key Vault Client Module
 * 
 * Provides HSM-backed key management for enterprise-grade encryption.
 * Supports KEK operations for envelope encryption with DEK hierarchy.
 * 
 * Authentication methods:
 * - Managed Identity (recommended for production)
 * - Client Secret (for development/testing)
 * - Certificate (for high-security environments)
 */

import { DefaultAzureCredential, ClientSecretCredential, ManagedIdentityCredential } from '@azure/identity';
import { KeyClient, CryptographyClient, KeyVaultKey } from '@azure/keyvault-keys';
import crypto from 'crypto';

export interface KeyVaultConfig {
  vaultUrl: string;
  authMethod: 'managed_identity' | 'client_secret' | 'certificate';
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface WrapKeyResult {
  wrappedKey: string; // Base64 encoded
  algorithm: string;
  keyVersion: string;
}

export interface UnwrapKeyResult {
  plainKey: Buffer;
  keyVersion: string;
}

export interface KeyInfo {
  name: string;
  version: string;
  enabled: boolean;
  createdOn?: Date;
  expiresOn?: Date;
  notBefore?: Date;
}

/**
 * Azure Key Vault Client for HSM-backed key management
 */
export class AzureKeyVaultClient {
  private keyClient: KeyClient;
  private vaultUrl: string;
  private cryptoClients: Map<string, CryptographyClient> = new Map();
  private initialized: boolean = false;

  constructor(config: KeyVaultConfig) {
    this.vaultUrl = config.vaultUrl;
    
    let credential;
    switch (config.authMethod) {
      case 'managed_identity':
        credential = new ManagedIdentityCredential();
        break;
      case 'client_secret':
        if (!config.tenantId || !config.clientId || !config.clientSecret) {
          throw new Error('Client secret auth requires tenantId, clientId, and clientSecret');
        }
        credential = new ClientSecretCredential(
          config.tenantId,
          config.clientId,
          config.clientSecret
        );
        break;
      default:
        credential = new DefaultAzureCredential();
    }
    
    this.keyClient = new KeyClient(config.vaultUrl, credential);
  }

  /**
   * Initialize and verify connection to Key Vault
   */
  async initialize(): Promise<boolean> {
    try {
      // Test connection by listing keys (limit 1)
      const iterator = this.keyClient.listPropertiesOfKeys();
      await iterator.next();
      this.initialized = true;
      console.log(`[KeyVault] Connected to ${this.vaultUrl}`);
      return true;
    } catch (error) {
      console.error('[KeyVault] Failed to connect:', error);
      return false;
    }
  }

  /**
   * Create a new RSA key for key wrapping (KEK)
   */
  async createKey(
    keyName: string,
    options?: {
      keySize?: number;
      expiresOn?: Date;
      notBefore?: Date;
      tags?: Record<string, string>;
    }
  ): Promise<KeyInfo> {
    const key = await this.keyClient.createRsaKey(keyName, {
      keySize: options?.keySize || 4096,
      expiresOn: options?.expiresOn,
      notBefore: options?.notBefore,
      tags: options?.tags,
      keyOps: ['wrapKey', 'unwrapKey', 'sign', 'verify'],
    });

    return this.keyToInfo(key);
  }

  /**
   * Rotate an existing key (creates new version)
   */
  async rotateKey(keyName: string): Promise<KeyInfo> {
    const key = await this.keyClient.rotateKey(keyName);
    
    // Clear cached crypto client for this key
    this.cryptoClients.delete(keyName);
    
    return this.keyToInfo(key);
  }

  /**
   * Get key information
   */
  async getKey(keyName: string, version?: string): Promise<KeyInfo | null> {
    try {
      const key = version
        ? await this.keyClient.getKey(keyName, { version })
        : await this.keyClient.getKey(keyName);
      return this.keyToInfo(key);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Wrap a Data Encryption Key (DEK) using the Key Encryption Key (KEK)
   * Uses RSA-OAEP-256 for key wrapping
   */
  async wrapKey(keyName: string, dekPlaintext: Buffer): Promise<WrapKeyResult> {
    const cryptoClient = await this.getCryptoClient(keyName);
    
    const result = await cryptoClient.wrapKey('RSA-OAEP-256', dekPlaintext);
    
    // Get current key version
    const key = await this.keyClient.getKey(keyName);
    
    return {
      wrappedKey: Buffer.from(result.result).toString('base64'),
      algorithm: result.algorithm,
      keyVersion: key.properties.version || 'latest',
    };
  }

  /**
   * Unwrap a Data Encryption Key (DEK) using the Key Encryption Key (KEK)
   */
  async unwrapKey(keyName: string, wrappedKey: string, version?: string): Promise<UnwrapKeyResult> {
    const cryptoClient = await this.getCryptoClient(keyName, version);
    
    const wrappedBuffer = Buffer.from(wrappedKey, 'base64');
    const result = await cryptoClient.unwrapKey('RSA-OAEP-256', wrappedBuffer);
    
    // Get key version used
    const key = version
      ? await this.keyClient.getKey(keyName, { version })
      : await this.keyClient.getKey(keyName);
    
    return {
      plainKey: Buffer.from(result.result),
      keyVersion: key.properties.version || 'latest',
    };
  }

  /**
   * Sign data using Key Vault key (for audit log signing)
   */
  async sign(keyName: string, data: Buffer): Promise<{ signature: string; algorithm: string }> {
    const cryptoClient = await this.getCryptoClient(keyName);
    
    // Hash the data first (RS256 = SHA-256 + RSA)
    const hash = crypto.createHash('sha256').update(data).digest();
    
    const result = await cryptoClient.sign('RS256', hash);
    
    return {
      signature: Buffer.from(result.result).toString('base64'),
      algorithm: result.algorithm,
    };
  }

  /**
   * Verify a signature using Key Vault key
   */
  async verify(keyName: string, data: Buffer, signature: string): Promise<boolean> {
    const cryptoClient = await this.getCryptoClient(keyName);
    
    // Hash the data first
    const hash = crypto.createHash('sha256').update(data).digest();
    const signatureBuffer = Buffer.from(signature, 'base64');
    
    const result = await cryptoClient.verify('RS256', hash, signatureBuffer);
    
    return result.result;
  }

  /**
   * List all keys in the vault
   */
  async listKeys(): Promise<KeyInfo[]> {
    const keys: KeyInfo[] = [];
    
    for await (const keyProperties of this.keyClient.listPropertiesOfKeys()) {
      keys.push({
        name: keyProperties.name,
        version: keyProperties.version || 'latest',
        enabled: keyProperties.enabled ?? true,
        createdOn: keyProperties.createdOn,
        expiresOn: keyProperties.expiresOn,
        notBefore: keyProperties.notBefore,
      });
    }
    
    return keys;
  }

  /**
   * Delete a key (soft delete by default in Key Vault)
   */
  async deleteKey(keyName: string): Promise<void> {
    await this.keyClient.beginDeleteKey(keyName);
    this.cryptoClients.delete(keyName);
  }

  /**
   * Check if Key Vault is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const iterator = this.keyClient.listPropertiesOfKeys();
      await iterator.next();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error.message,
      };
    }
  }

  /**
   * Get or create a CryptographyClient for a specific key
   */
  private async getCryptoClient(keyName: string, version?: string): Promise<CryptographyClient> {
    const cacheKey = version ? `${keyName}:${version}` : keyName;
    
    if (!this.cryptoClients.has(cacheKey)) {
      const keyUri = version
        ? `${this.vaultUrl}/keys/${keyName}/${version}`
        : `${this.vaultUrl}/keys/${keyName}`;
      
      const credential = new DefaultAzureCredential();
      const client = new CryptographyClient(keyUri, credential);
      this.cryptoClients.set(cacheKey, client);
    }
    
    return this.cryptoClients.get(cacheKey)!;
  }

  /**
   * Convert KeyVaultKey to KeyInfo
   */
  private keyToInfo(key: KeyVaultKey): KeyInfo {
    return {
      name: key.name,
      version: key.properties.version || 'latest',
      enabled: key.properties.enabled ?? true,
      createdOn: key.properties.createdOn,
      expiresOn: key.properties.expiresOn,
      notBefore: key.properties.notBefore,
    };
  }
}

/**
 * Singleton instance for the primary Key Vault
 */
let primaryVaultClient: AzureKeyVaultClient | null = null;

/**
 * Initialize the primary Key Vault client
 */
export async function initializeKeyVault(config: KeyVaultConfig): Promise<AzureKeyVaultClient> {
  primaryVaultClient = new AzureKeyVaultClient(config);
  const connected = await primaryVaultClient.initialize();
  
  if (!connected) {
    console.warn('[KeyVault] Running in fallback mode - HSM features unavailable');
  }
  
  return primaryVaultClient;
}

/**
 * Get the primary Key Vault client
 */
export function getKeyVaultClient(): AzureKeyVaultClient | null {
  return primaryVaultClient;
}

/**
 * Generate a cryptographically secure DEK (Data Encryption Key)
 * Used when Key Vault is unavailable for CSPRNG
 */
export function generateDEK(size: number = 32): Buffer {
  return crypto.randomBytes(size);
}
