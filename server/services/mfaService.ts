import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { userMFA, trustedDevices, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../crypto-utils';

export class MFAService {
  /**
   * Setup MFA for a user - generates TOTP secret, QR code, and backup codes
   */
  async setupMFA(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    // Check if MFA already exists
    const existingMFA = await db.query.userMFA.findFirst({
      where: eq(userMFA.userId, userId)
    });

    if (existingMFA && existingMFA.mfaEnabled) {
      throw new Error('MFA is already enabled for this user');
    }

    // Get user details for QR code
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate TOTP secret
    const secret = authenticator.generateSecret();

    // Create QR code
    const otpauth = authenticator.keyuri(
      user.email,
      'Accute',
      secret
    );
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Generate 10 backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    // Encrypt TOTP secret using AES-256-GCM (returns format: iv:encryptedData:authTag)
    const encryptedSecret = encrypt(secret);

    // Store MFA data (disabled initially - user must verify first)
    if (existingMFA) {
      // Update existing record
      await db.update(userMFA)
        .set({
          totpSecret: encryptedSecret,
          backupCodes: hashedBackupCodes,
          backupCodesUsed: [],
          mfaEnabled: false, // User must verify to enable
          updatedAt: new Date()
        })
        .where(eq(userMFA.userId, userId));
    } else {
      // Create new record
      await db.insert(userMFA).values({
        userId,
        totpSecret: encryptedSecret,
        backupCodes: hashedBackupCodes,
        backupCodesUsed: [],
        mfaEnabled: false
      });
    }

    return {
      secret,
      qrCodeUrl,
      backupCodes // Return plaintext codes for user to save
    };
  }

  /**
   * Verify TOTP token and enable MFA
   */
  async verifyAndEnableMFA(userId: string, token: string): Promise<boolean> {
    const mfa = await db.query.userMFA.findFirst({
      where: eq(userMFA.userId, userId)
    });

    if (!mfa || !mfa.totpSecret) {
      throw new Error('MFA not set up for this user');
    }

    if (mfa.mfaEnabled) {
      throw new Error('MFA is already enabled');
    }

    // Decrypt TOTP secret (format: iv:encryptedData:authTag)
    const secret = decrypt(mfa.totpSecret!);

    // Verify token
    const isValid = authenticator.verify({ token, secret });

    if (isValid) {
      // Enable MFA
      await db.update(userMFA)
        .set({
          mfaEnabled: true,
          lastVerified: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userMFA.userId, userId));
    }

    return isValid;
  }

  /**
   * Verify TOTP token during login
   */
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const mfa = await db.query.userMFA.findFirst({
      where: eq(userMFA.userId, userId)
    });

    if (!mfa || !mfa.mfaEnabled || !mfa.totpSecret) {
      return false;
    }

    // Decrypt TOTP secret (format: iv:encryptedData:authTag)
    const secret = decrypt(mfa.totpSecret!);

    // Verify token with 1 step window (30 seconds before/after)
    const isValid = authenticator.verify({ 
      token, 
      secret,
      window: 1 // Allow 1 step before/after for clock drift
    });

    if (isValid) {
      // Update last verified timestamp
      await db.update(userMFA)
        .set({ 
          lastVerified: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userMFA.userId, userId));
    }

    return isValid;
  }

  /**
   * Get current TOTP token for a given secret (TEST/DEVELOPMENT ONLY)
   * Used by automated testing to generate valid TOTP codes
   */
  getCurrentToken(secret: string): string {
    return authenticator.generate(secret);
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const mfa = await db.query.userMFA.findFirst({
      where: eq(userMFA.userId, userId)
    });

    if (!mfa || !mfa.mfaEnabled) {
      return false;
    }

    // Check all backup codes
    for (const hashedCode of mfa.backupCodes || []) {
      // Skip if already used
      if (mfa.backupCodesUsed?.includes(hashedCode)) {
        continue;
      }

      // Compare with bcrypt
      const isValid = await bcrypt.compare(code, hashedCode);

      if (isValid) {
        // Mark code as used
        const updatedUsedCodes = [...(mfa.backupCodesUsed || []), hashedCode];
        
        console.log(`[MFA] Marking backup code as used for user ${userId}`);
        console.log(`[MFA] Previously used: ${mfa.backupCodesUsed?.length || 0}, Now used: ${updatedUsedCodes.length}`);

        await db.update(userMFA)
          .set({
            backupCodesUsed: updatedUsedCodes,
            lastVerified: new Date(),
            updatedAt: new Date()
          })
          .where(eq(userMFA.userId, userId));
        
        console.log(`[MFA] Backup code marked as used successfully`);

        return true;
      }
    }

    return false;
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string): Promise<void> {
    await db.update(userMFA)
      .set({
        mfaEnabled: false,
        updatedAt: new Date()
      })
      .where(eq(userMFA.userId, userId));

    // Remove all trusted devices
    await db.delete(trustedDevices)
      .where(eq(trustedDevices.userId, userId));
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    const mfa = await db.query.userMFA.findFirst({
      where: eq(userMFA.userId, userId)
    });

    return mfa?.mfaEnabled || false;
  }

  /**
   * Get MFA status for user
   */
  async getMFAStatus(userId: string): Promise<{
    enabled: boolean;
    enforced: boolean;
    backupCodesRemaining: number;
  }> {
    const mfa = await db.query.userMFA.findFirst({
      where: eq(userMFA.userId, userId)
    });

    if (!mfa) {
      return {
        enabled: false,
        enforced: false,
        backupCodesRemaining: 0
      };
    }

    const backupCodesRemaining = 
      (mfa.backupCodes?.length || 0) - (mfa.backupCodesUsed?.length || 0);
    
    console.log(`[MFA] Status for user ${userId}: total codes=${mfa.backupCodes?.length || 0}, used=${mfa.backupCodesUsed?.length || 0}, remaining=${backupCodesRemaining}`);

    return {
      enabled: mfa.mfaEnabled,
      enforced: mfa.mfaEnforced,
      backupCodesRemaining
    };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const mfa = await db.query.userMFA.findFirst({
      where: eq(userMFA.userId, userId)
    });

    if (!mfa || !mfa.mfaEnabled) {
      throw new Error('MFA is not enabled');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Hash backup codes
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    // Update database
    await db.update(userMFA)
      .set({
        backupCodes: hashedBackupCodes,
        backupCodesUsed: [], // Reset used codes
        updatedAt: new Date()
      })
      .where(eq(userMFA.userId, userId));

    return backupCodes;
  }

  /**
   * Trust a device (skip MFA for 30 days)
   */
  async trustDevice(
    userId: string,
    deviceId: string,
    deviceName: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    // Check if device already trusted
    const existing = await db.query.trustedDevices.findFirst({
      where: and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.deviceId, deviceId)
      )
    });

    if (existing) {
      // Update expiry
      await db.update(trustedDevices)
        .set({
          expiresAt,
          lastUsed: new Date()
        })
        .where(eq(trustedDevices.id, existing.id));
    } else {
      // Create new trusted device
      await db.insert(trustedDevices).values({
        userId,
        deviceId,
        deviceName,
        ipAddress,
        userAgent,
        expiresAt
      });
    }
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const device = await db.query.trustedDevices.findFirst({
      where: and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.deviceId, deviceId)
      )
    });

    if (!device) {
      return false;
    }

    // Check if expired
    if (new Date() > device.expiresAt) {
      // Delete expired device
      await db.delete(trustedDevices)
        .where(eq(trustedDevices.id, device.id));
      return false;
    }

    // Update last used
    await db.update(trustedDevices)
      .set({ lastUsed: new Date() })
      .where(eq(trustedDevices.id, device.id));

    return true;
  }

  /**
   * Get all trusted devices for a user
   */
  async getTrustedDevices(userId: string) {
    const devices = await db.query.trustedDevices.findMany({
      where: eq(trustedDevices.userId, userId)
    });

    // Filter out expired devices
    const now = new Date();
    return devices.filter(device => device.expiresAt > now);
  }

  /**
   * Remove a trusted device
   */
  async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await db.delete(trustedDevices)
      .where(and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.deviceId, deviceId)
      ));
  }

  /**
   * Generate backup codes (8 characters, alphanumeric)
   */
  private generateBackupCodes(count: number): string[] {
    return Array.from({ length: count }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
  }

  /**
   * Generate device fingerprint from request
   */
  generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}|${ipAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const mfaService = new MFAService();
