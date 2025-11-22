/**
 * Unified Encryption Service for Accute Platform
 * 
 * Provides enterprise-grade encryption with:
 * - AES-256-GCM authenticated encryption
 * - Backward compatibility with legacy formats  
 * - Comprehensive error handling and logging
 * - Memory-safe operations
 * - Timing attack resistance
 * 
 * SECURITY DESIGN:
 * - Single source of truth for all encryption operations
 * - Consistent salt and key derivation across the platform
 * - Proper input validation and sanitization
 * - Detailed security logging for audit trails
 * - Graceful handling of legacy data formats
 */

import crypto from 'crypto';

// Security constants
const IV_LENGTH = 16; // 128 bits for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128 bits authentication tag
const PLATFORM_SALT = 'accute-salt-2024'; // Consistent across all services
const MIN_KEY_LENGTH = 32; // 256 bits minimum for encryption key

/**
 * Encryption Service Class
 * Centralized encryption management with proper error handling
 */
class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: Buffer | null = null;
  private keyInitialized = false;

  private constructor() {
    this.initializeEncryptionKey();
  }

  /**
   * Singleton pattern for consistent encryption across platform
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Reset singleton instance and re-initialize with current ENCRYPTION_KEY
   * ⚠️ TEST ONLY - Simulates server restart with new encryption key
   * DO NOT USE IN PRODUCTION
   */
  public static resetInstance(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetInstance() can only be called in test environment');
    }
    EncryptionService.instance = new EncryptionService();
    console.debug('🔄 Encryption service reset (test mode)');
  }

  /**
   * Initialize encryption key with proper validation
   * @private
   */
  private initializeEncryptionKey(): void {
    try {
      const envKey = process.env.ENCRYPTION_KEY;
      
      if (!envKey) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
      }

      if (envKey.length < 32) {
        throw new Error(`ENCRYPTION_KEY too short: ${envKey.length} chars, minimum 32 required`);
      }

      // Derive consistent 256-bit key using scrypt
      this.encryptionKey = crypto.scryptSync(envKey, PLATFORM_SALT, 32);
      this.keyInitialized = true;

      console.info('🔐 Encryption service initialized successfully');
    } catch (error: any) {
      console.error('🚨 CRITICAL: Failed to initialize encryption service', {
        error: error.message,
        action: 'Server will fail to start'
      });
      throw error;
    }
  }

  /**
   * Get validated encryption key
   * @returns 32-byte encryption key
   * @throws Error if key not properly initialized
   */
  private getEncryptionKey(): Buffer {
    if (!this.keyInitialized || !this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    return this.encryptionKey;
  }

  /**
   * Encrypt text using AES-256-GCM with authentication
   * @param text Plain text to encrypt
   * @returns Encrypted string in format: iv:encryptedData:authTag
   * @throws Error if encryption fails or input is invalid
   */
  public encrypt(text: string): string {
    // Input validation
    if (typeof text !== 'string') {
      throw new Error(`Encrypt input must be a string, received: ${typeof text}`);
    }

    if (text.length === 0) {
      throw new Error('Cannot encrypt empty string');
    }

    if (text.length > 1048576) { // 1MB limit
      throw new Error(`Text too large to encrypt: ${text.length} bytes, maximum 1MB`);
    }

    try {
      const key = this.getEncryptionKey();
      
      // Generate cryptographically secure random IV
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Create cipher with AES-256-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
        authTagLength: AUTH_TAG_LENGTH
      });
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Return in standard format: iv:encryptedData:authTag
      const result = `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
      
      console.debug('🔐 Successfully encrypted data', {
        inputLength: text.length,
        outputLength: result.length,
        format: 'AES-256-GCM'
      });
      
      return result;
    } catch (error: any) {
      console.error('🚨 Encryption failed', {
        error: error.message,
        inputType: typeof text,
        inputLength: text?.length || 0
      });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt text using AES-256-GCM with authentication verification
   * @param encryptedText Encrypted string in format: iv:encryptedData:authTag
   * @returns Decrypted plain text
   * @throws Error if decryption fails, format invalid, or authentication fails
   */
  public decrypt(encryptedText: string): string {
    // Input validation
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error(`Invalid encrypted text: expected non-empty string, received: ${typeof encryptedText}`);
    }

    // Validate format (should have exactly 3 parts separated by ':')
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error(`Invalid encrypted text format: expected "iv:encrypted:authTag", got ${parts.length} parts`);
    }

    try {
      const key = this.getEncryptionKey();
      
      // Parse and validate components
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const authTag = Buffer.from(parts[2], 'hex');

      // Component validation
      if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
      }

      if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
      }

      if (encrypted.length === 0) {
        throw new Error('Invalid encrypted data: empty string');
      }

      if (!/^[0-9a-fA-F]+$/.test(encrypted)) {
        throw new Error('Invalid encrypted data: not hexadecimal');
      }

      // Create decipher with AES-256-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength: AUTH_TAG_LENGTH
      });

      // Set authentication tag (MUST be done before calling update/final)
      decipher.setAuthTag(authTag);

      // Decrypt and verify authentication
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      console.debug('🔓 Successfully decrypted data', {
        outputLength: decrypted.length,
        format: 'AES-256-GCM'
      });

      return decrypted;
    } catch (error: any) {
      // Enhanced error reporting for debugging
      const errorContext = {
        error: error.message,
        code: error.code,
        inputFormat: `${parts.length} parts`,
        action: 'Decryption failed'
      };

      if (error.code === 'OSSL_EVP_BAD_DECRYPT') {
        console.error('🚨 SECURITY ALERT: Authentication failed during decryption', {
          ...errorContext,
          possibleCauses: ['Data tampering', 'Wrong encryption key', 'Corrupted storage']
        });
        throw new Error('Authentication failed: data may have been tampered with or wrong encryption key');
      }

      console.error('🚨 Decryption error', errorContext);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Legacy AES-256-CBC decryption for backward compatibility
   * @param encryptedText Legacy encrypted text in format: iv:encryptedData
   * @returns Decrypted plain text
   * @throws Error if decryption fails
   */
  public decryptLegacyCBC(encryptedText: string): string {
    const envKey = process.env.ENCRYPTION_KEY;
    if (!envKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    // Use legacy key derivation method (SHA-256 hash)
    const legacyKey = crypto.createHash('sha256').update(envKey).digest();

    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid legacy CBC format: expected "iv:encrypted"');
    }

    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      console.info('🔓 Successfully decrypted legacy CBC data');
      return decrypted;
    } catch (error: any) {
      throw new Error(`Legacy CBC decryption failed: ${error.message}`);
    }
  }

  /**
   * Safely decrypt credentials with comprehensive backward compatibility
   * Handles AES-256-GCM, legacy AES-256-CBC, and plaintext values
   * 
   * @param value Potentially encrypted credential
   * @returns Decrypted value or null if input is null/undefined
   */
  public safeDecrypt(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    // Empty string check
    if (value.trim().length === 0) {
      return null;
    }

    const parts = value.split(':');

    // Try AES-256-GCM format first (current standard): iv:encryptedData:authTag
    if (parts.length === 3 && parts.every(p => p.length > 0 && /^[0-9a-fA-F]+$/.test(p))) {
      try {
        const decrypted = this.decrypt(value);
        console.debug('✅ Successfully decrypted AES-256-GCM credential');
        return decrypted;
      } catch (error: any) {
        console.warn('⚠️ SECURITY ALERT: Failed to decrypt AES-256-GCM credential', {
          errorType: error.name,
          errorMessage: error.message,
          credentialFormat: 'AES-256-GCM (3 parts)',
          possibleCauses: ['Wrong encryption key', 'Data tampering', 'Corrupted storage'],
          action: 'Attempting legacy decryption'
        });

        // Try legacy CBC format before giving up
        try {
          // Convert to legacy format for testing
          const legacyFormat = `${parts[0]}:${parts[1]}`;
          const legacyDecrypted = this.decryptLegacyCBC(legacyFormat);
          console.info('✅ Successfully decrypted using legacy AES-256-CBC format');
          return legacyDecrypted;
        } catch (legacyError: any) {
          // CRITICAL SECURITY FIX: Fail loudly instead of returning ciphertext as plaintext
          console.error('🚨 CRITICAL: Failed to decrypt credential with both GCM and CBC', {
            gcmError: error.message,
            cbcError: legacyError.message,
            possibleCauses: ['Encryption key changed', 'Data corruption', 'Data tampering'],
            action: 'Throwing error to prevent silent failures'
          });
          
          // TODO: Alert monitoring system (PagerDuty, Slack, etc.)
          // alertOps({ severity: 'critical', message: 'Encryption decryption failure', context: { gcmError, cbcError } });
          
          throw new Error(
            'Failed to decrypt credential: ENCRYPTION_KEY may have changed. ' +
            'Please verify ENCRYPTION_KEY configuration and run credential re-encryption if needed. ' +
            `GCM error: ${error.message}. CBC error: ${legacyError.message}`
          );
        }
      }
    }

    // Try legacy AES-256-CBC format: iv:encryptedData (2 parts)
    if (parts.length === 2 && parts.every(p => p.length > 0 && /^[0-9a-fA-F]+$/.test(p))) {
      try {
        const legacyDecrypted = this.decryptLegacyCBC(value);
        console.info('✅ Successfully decrypted legacy AES-256-CBC credential');
        return legacyDecrypted;
      } catch (error: any) {
        // CRITICAL SECURITY FIX: Fail loudly for encrypted-looking data that won't decrypt
        console.error('🚨 CRITICAL: Failed to decrypt legacy CBC credential', {
          errorMessage: error.message,
          possibleCauses: ['Encryption key changed', 'Data corruption'],
          action: 'Throwing error to prevent silent failures'
        });
        
        throw new Error(
          'Failed to decrypt legacy CBC credential: ENCRYPTION_KEY may have changed. ' +
          `Error: ${error.message}`
        );
      }
    }

    // If value doesn't match any encrypted format, treat as plaintext (backward compatibility)
    // This allows transition period where some credentials are still unencrypted
    console.debug('📊 SECURITY METRICS: Plaintext credential detected', {
      format: `${parts.length} parts`,
      recommendation: 'Consider encrypting for enhanced security'
    });

    // Return as plaintext (for values that were never encrypted)
    return value;
  }

  /**
   * Validate if a string appears to be encrypted
   * @param value String to check
   * @returns Object with validation results
   */
  public validateEncryptionFormat(value: string): {
    isEncrypted: boolean;
    format: 'GCM' | 'CBC' | 'plaintext' | 'invalid';
    valid: boolean;
    issues: string[];
  } {
    if (!value || typeof value !== 'string') {
      return { isEncrypted: false, format: 'invalid', valid: false, issues: ['Invalid input'] };
    }

    const parts = value.split(':');
    const issues: string[] = [];

    // Check AES-256-GCM format
    if (parts.length === 3) {
      let isValidGCM = true;
      
      if (!parts.every(p => p.length > 0)) {
        isValidGCM = false;
        issues.push('Empty parts detected');
      }
      
      if (!parts.every(p => /^[0-9a-fA-F]+$/.test(p))) {
        isValidGCM = false;
        issues.push('Non-hexadecimal characters detected');
      }
      
      if (Buffer.from(parts[0], 'hex').length !== IV_LENGTH) {
        isValidGCM = false;
        issues.push(`Invalid IV length: expected ${IV_LENGTH} bytes`);
      }
      
      if (Buffer.from(parts[2], 'hex').length !== AUTH_TAG_LENGTH) {
        isValidGCM = false;
        issues.push(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes`);
      }
      
      return {
        isEncrypted: true,
        format: 'GCM',
        valid: isValidGCM,
        issues
      };
    }

    // Check legacy AES-256-CBC format
    if (parts.length === 2) {
      let isValidCBC = true;
      
      if (!parts.every(p => p.length > 0)) {
        isValidCBC = false;
        issues.push('Empty parts detected');
      }
      
      if (!parts.every(p => /^[0-9a-fA-F]+$/.test(p))) {
        isValidCBC = false;
        issues.push('Non-hexadecimal characters detected');
      }
      
      return {
        isEncrypted: true,
        format: 'CBC',
        valid: isValidCBC,
        issues
      };
    }

    // Not encrypted
    return {
      isEncrypted: false,
      format: 'plaintext',
      valid: true,
      issues: []
    };
  }

  /**
   * Migrate legacy encrypted data to new format
   * @param legacyEncryptedText Legacy encrypted text
   * @returns New format encrypted text
   */
  public migrateLegacyToGCM(legacyEncryptedText: string): string {
    try {
      // Decrypt using legacy method
      const plaintext = this.decryptLegacyCBC(legacyEncryptedText);
      
      // Re-encrypt using new GCM method
      const newEncrypted = this.encrypt(plaintext);
      
      console.info('✅ Successfully migrated legacy CBC encryption to GCM format');
      return newEncrypted;
    } catch (error: any) {
      console.error('❌ Failed to migrate legacy encryption', {
        error: error.message
      });
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Test encryption round-trip to verify system health
   * @returns True if encryption/decryption working correctly
   */
  public healthCheck(): boolean {
    try {
      const testData = `health-check-${Date.now()}`;
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      
      const isHealthy = decrypted === testData;
      
      console.info('🔐 Encryption service health check', {
        status: isHealthy ? 'HEALTHY' : 'FAILED',
        testPassed: isHealthy
      });
      
      return isHealthy;
    } catch (error: any) {
      console.error('🚨 Encryption service health check failed', {
        error: error.message
      });
      return false;
    }
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();

// Export convenience functions that use the singleton
export const encrypt = (text: string): string => encryptionService.encrypt(text);
export const decrypt = (encryptedText: string): string => encryptionService.decrypt(encryptedText);
export const safeDecrypt = (value: string | null | undefined): string | null => 
  encryptionService.safeDecrypt(value);

// Test-only function to simulate server restart with new encryption key
export const resetEncryptionService = (): void => EncryptionService.resetInstance();

// Legacy compatibility function
export const safeDecryptRazorpay = safeDecrypt;

// Export service class for advanced usage
export { EncryptionService };