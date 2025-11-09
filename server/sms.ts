/**
 * SMS Helper Module for OTP verification via Plivo
 * 
 * Sends 6-digit OTP codes for mobile number verification during account setup.
 * Uses Plivo for reliable international SMS delivery - NO IP WHITELISTING REQUIRED.
 * 
 * To enable SMS functionality:
 * 1. Sign up at plivo.com
 * 2. Configure PLIVO_AUTH_ID in Replit Secrets (from Plivo dashboard)
 * 3. Configure PLIVO_AUTH_TOKEN in Replit Secrets (from Plivo dashboard)
 * 4. Configure PLIVO_PHONE_NUMBER (your Plivo phone number, e.g., +15551234567)
 */

import crypto from 'crypto';
import plivo from 'plivo';

const DEFAULT_SENDER_ID = "ACCUTE";
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a cryptographically secure random 6-digit OTP code
 */
export function generateOTP(): string {
  // Generate a random number between 100000 and 999999 (inclusive)
  const otp = crypto.randomInt(100000, 1000000);
  return otp.toString();
}

/**
 * Calculate OTP expiration timestamp
 */
export function getOTPExpiry(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * Format phone number for international SMS (E.164 format)
 * Ensures phone number has country code for Plivo
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, add it
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * Send OTP verification code via SMS using Plivo API
 */
export async function sendOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Plivo is configured
    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    const fromNumber = process.env.PLIVO_PHONE_NUMBER;

    if (!authId || !authToken) {
      console.warn("Plivo not configured. SMS functionality disabled. Please set PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN.");
      return { 
        success: false, 
        error: "SMS functionality not configured. Please set up Plivo credentials." 
      };
    }

    if (!fromNumber) {
      console.warn("PLIVO_PHONE_NUMBER not configured. Required for sending SMS.");
      return {
        success: false,
        error: "Plivo phone number required. Please configure PLIVO_PHONE_NUMBER in your environment."
      };
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(phone);

    // Initialize Plivo client
    const client = new plivo.Client(authId, authToken);

    // Prepare SMS message
    const messageText = `Your Accute verification code is: ${otp}\n\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this message.`;

    // Send SMS via Plivo
    const response = await client.messages.create({
      src: fromNumber,
      dst: formattedPhone,
      text: messageText,
    });

    if (!response || response.error) {
      console.error('Plivo SMS API error:', response);
      return {
        success: false,
        error: response?.error || 'Failed to send OTP via Plivo'
      };
    }

    console.log(`OTP sent successfully to ${phone} via Plivo. Message UUID: ${response.messageUuid}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send OTP SMS via Plivo:", error.message);
    return { 
      success: false, 
      error: error.message || "Failed to send OTP SMS" 
    };
  }
}

/**
 * Check if SMS service is configured
 */
export function isSMSConfigured(): boolean {
  return !!(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN && process.env.PLIVO_PHONE_NUMBER);
}
