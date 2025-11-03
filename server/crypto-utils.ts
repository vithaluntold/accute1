import crypto from 'crypto';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * PKI Digital Signature Utilities for Document Security
 * Implements RSA-SHA256 signatures with 2048-bit keys for tamper-proof verification
 * 
 * SECURITY: Keys are persisted to database to survive server restarts
 */

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

// Memory cache for loaded keys (cleared on restart, reloaded from DB)
const keyCache = new Map<string, KeyPair>();

/**
 * Generate and persist RSA key pair for an organization
 * @param organizationId Organization ID
 * @returns RSA key pair
 */
async function generateAndPersistKeyPair(organizationId: string): Promise<KeyPair> {
  // Generate 2048-bit RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
  
  // SECURITY: Encrypt private key before storing in database
  // This protects against database compromise
  const encryptedPrivateKey = encrypt(privateKey);
  
  // Persist to database with encrypted private key
  await db.insert(schema.organizationKeys).values({
    organizationId,
    publicKey,
    privateKey: encryptedPrivateKey, // Encrypted with AES-256-GCM
    algorithm: 'RSA-2048',
  }).onConflictDoNothing(); // Prevent race condition
  
  // Cache the decrypted keys in memory
  const keyPair = { publicKey, privateKey };
  keyCache.set(organizationId, keyPair);
  
  return keyPair;
}

/**
 * Load RSA key pair from database or generate if first time
 * @param organizationId Organization ID
 * @returns RSA key pair
 */
async function getOrganizationKeyPair(organizationId: string): Promise<KeyPair> {
  // Check cache first
  if (keyCache.has(organizationId)) {
    return keyCache.get(organizationId)!;
  }
  
  // Load from database
  const existingKeys = await db
    .select()
    .from(schema.organizationKeys)
    .where(eq(schema.organizationKeys.organizationId, organizationId))
    .limit(1);
  
  if (existingKeys.length > 0) {
    // SECURITY: Safely decrypt private key (handles both encrypted and legacy plaintext)
    const decryptedPrivateKey = safeDecryptRazorpay(existingKeys[0].privateKey) || existingKeys[0].privateKey;
    const keyPair = {
      publicKey: existingKeys[0].publicKey,
      privateKey: decryptedPrivateKey,
    };
    keyCache.set(organizationId, keyPair);
    return keyPair;
  }
  
  // Generate new key pair if first time
  return await generateAndPersistKeyPair(organizationId);
}

/**
 * Load RSA key pair from database - STRICT MODE (errors if missing)
 * Used during verification to prevent accidental key generation
 * @param organizationId Organization ID
 * @returns RSA key pair
 * @throws Error if keys don't exist
 */
async function loadOrganizationKeyPair(organizationId: string): Promise<KeyPair> {
  // Check cache first
  if (keyCache.has(organizationId)) {
    return keyCache.get(organizationId)!;
  }
  
  // Load from database
  const existingKeys = await db
    .select()
    .from(schema.organizationKeys)
    .where(eq(schema.organizationKeys.organizationId, organizationId))
    .limit(1);
  
  if (existingKeys.length === 0) {
    throw new Error(`Cryptographic keys not found for organization ${organizationId}. Cannot verify signature.`);
  }
  
  // SECURITY: Safely decrypt private key (handles both encrypted and legacy plaintext)
  const decryptedPrivateKey = safeDecryptRazorpay(existingKeys[0].privateKey) || existingKeys[0].privateKey;
  const keyPair = {
    publicKey: existingKeys[0].publicKey,
    privateKey: decryptedPrivateKey,
  };
  keyCache.set(organizationId, keyPair);
  return keyPair;
}

/**
 * Generate SHA-256 hash of file buffer
 * @param buffer File buffer
 * @returns Hexadecimal hash string
 */
export function generateDocumentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Sign document hash with RSA private key
 * @param documentHash SHA-256 hash to sign
 * @param organizationId Organization ID for key retrieval
 * @returns Base64-encoded digital signature
 */
export async function signDocumentHash(documentHash: string, organizationId: string): Promise<string> {
  const keyPair = await getOrganizationKeyPair(organizationId);
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(documentHash);
  sign.end();
  
  const signature = sign.sign(keyPair.privateKey, 'base64');
  return signature;
}

/**
 * Verify digital signature of document hash
 * SECURITY: Uses loadOrganizationKeyPair which errors if keys missing (prevents key generation attack)
 * @param documentHash Original SHA-256 hash
 * @param signature Base64-encoded signature to verify
 * @param organizationId Organization ID for key retrieval
 * @returns True if signature is valid, false otherwise
 */
export async function verifySignature(
  documentHash: string,
  signature: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Use strict loading - errors if keys don't exist instead of generating new ones
    const keyPair = await loadOrganizationKeyPair(organizationId);
    
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(documentHash);
    verify.end();
    
    return verify.verify(keyPair.publicKey, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Generate timestamp signature (RFC 3161-style internal timestamp)
 * @param documentHash Document hash
 * @param timestamp ISO timestamp
 * @param organizationId Organization ID
 * @returns Signed timestamp proof
 */
export async function generateTimestampProof(
  documentHash: string,
  timestamp: string,
  organizationId: string
): Promise<string> {
  const timestampData = `${documentHash}:${timestamp}`;
  return await signDocumentHash(timestampData, organizationId);
}

/**
 * Get public key for an organization (for external verification)
 * @param organizationId Organization ID
 * @returns PEM-formatted public key
 */
export async function getOrganizationPublicKey(organizationId: string): Promise<string> {
  const keyPair = await getOrganizationKeyPair(organizationId);
  return keyPair.publicKey;
}

/**
 * Verify document integrity by comparing hashes
 * @param originalHash Stored hash from database
 * @param currentBuffer Current file buffer
 * @returns True if file hasn't been tampered with
 */
export function verifyDocumentIntegrity(originalHash: string, currentBuffer: Buffer): boolean {
  const currentHash = generateDocumentHash(currentBuffer);
  return originalHash === currentHash;
}

/**
 * AES-256-GCM Encryption for sensitive credentials
 * Encrypts data using AES-256-GCM algorithm
 * @param text Plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData:authTag
 */
export function encrypt(text: string): string {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-encryption-key-change-in-production';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * AES-256-GCM Decryption for sensitive credentials
 * Decrypts data encrypted with encrypt() function
 * @param encryptedText Encrypted string in format: iv:encryptedData:authTag
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-encryption-key-change-in-production';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');
  
  // Validate authentication tag length (must be 16 bytes for AES-GCM)
  if (authTag.length !== 16) {
    throw new Error('Invalid authentication tag length');
  }
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
    authTagLength: 16
  });
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * SECURITY: Safely decrypt Razorpay credentials with backward compatibility
 * Handles both encrypted (new) and plaintext (legacy) values
 * @param value Potentially encrypted Razorpay credential
 * @returns Decrypted credential (or original if plaintext)
 */
export function safeDecryptRazorpay(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  
  // Check if value is encrypted (format: iv:encryptedData:authTag)
  // Encrypted values always have exactly 2 colons separating 3 parts
  const parts = value.split(':');
  if (parts.length === 3 && parts.every(p => p.length > 0)) {
    try {
      // Attempt decryption - if it works, it was encrypted
      return decrypt(value);
    } catch (error) {
      // If decryption fails, it might be plaintext that happens to have colons
      // Fall through to return plaintext
      console.warn('Failed to decrypt Razorpay credential, treating as plaintext:', error);
      return value;
    }
  }
  
  // Value is plaintext (legacy data) - return as-is
  return value;
}
