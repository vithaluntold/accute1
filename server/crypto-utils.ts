import crypto from 'crypto';

/**
 * PKI Digital Signature Utilities for Document Security
 * Implements RSA-SHA256 signatures with 2048-bit keys for tamper-proof verification
 */

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

// Store organization keys in memory (in production, use HSM or secure key vault)
const organizationKeyPairs = new Map<string, KeyPair>();

/**
 * Generate or retrieve RSA key pair for an organization
 * @param organizationId Organization ID
 * @returns RSA key pair
 */
export function getOrganizationKeyPair(organizationId: string): KeyPair {
  if (!organizationKeyPairs.has(organizationId)) {
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
    
    organizationKeyPairs.set(organizationId, { publicKey, privateKey });
  }
  
  return organizationKeyPairs.get(organizationId)!;
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
export function signDocumentHash(documentHash: string, organizationId: string): string {
  const keyPair = getOrganizationKeyPair(organizationId);
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(documentHash);
  sign.end();
  
  const signature = sign.sign(keyPair.privateKey, 'base64');
  return signature;
}

/**
 * Verify digital signature of document hash
 * @param documentHash Original SHA-256 hash
 * @param signature Base64-encoded signature to verify
 * @param organizationId Organization ID for key retrieval
 * @returns True if signature is valid, false otherwise
 */
export function verifySignature(
  documentHash: string,
  signature: string,
  organizationId: string
): boolean {
  try {
    const keyPair = getOrganizationKeyPair(organizationId);
    
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
export function generateTimestampProof(
  documentHash: string,
  timestamp: string,
  organizationId: string
): string {
  const timestampData = `${documentHash}:${timestamp}`;
  return signDocumentHash(timestampData, organizationId);
}

/**
 * Get public key for an organization (for external verification)
 * @param organizationId Organization ID
 * @returns PEM-formatted public key
 */
export function getOrganizationPublicKey(organizationId: string): string {
  const keyPair = getOrganizationKeyPair(organizationId);
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
