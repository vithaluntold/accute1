/**
 * SMS Helper Module for OTP verification via Twilio
 * 
 * Sends 6-digit OTP codes for mobile number verification during account setup.
 * Uses "Accute" as the alphanumeric sender ID for international messages.
 * Automatically falls back to TWILIO_PHONE_NUMBER for USA/Canada (where alphanumeric IDs are not supported)
 * 
 * To enable SMS functionality:
 * 1. Configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Replit Secrets
 * 2. Register "Accute" as your alphanumeric sender ID in Twilio console
 * 3. (Optional) Set TWILIO_PHONE_NUMBER for USA/Canada support
 */

import crypto from 'crypto';

const BRANDED_SENDER_ID = "Accute";
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
 * Check if phone number is from USA or Canada
 */
function isUSAOrCanada(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a US/Canada number
  // Case 1: Starts with country code 1 and is 11 digits (1XXXXXXXXXX)
  // Case 2: 10-digit number without country code (XXXXXXXXXX)
  // NANP (North American Numbering Plan) numbers are 10 digits after country code
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return true;
  }
  
  if (cleaned.length === 10) {
    // 10-digit number without country code - assume USA/Canada
    return true;
  }
  
  return false;
}

/**
 * Send OTP verification code via SMS
 */
export async function sendOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Twilio is configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken) {
      console.warn("Twilio not configured. SMS functionality disabled. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
      return { 
        success: false, 
        error: "SMS functionality not configured. Please set up Twilio credentials." 
      };
    }

    // Determine sender ID based on destination
    const isNorthAmerica = isUSAOrCanada(phone);
    let senderId: string;

    if (isNorthAmerica) {
      // USA/Canada: Must use a phone number
      if (!twilioPhone) {
        console.warn(`Cannot send SMS to USA/Canada number ${phone} without TWILIO_PHONE_NUMBER configured.`);
        return {
          success: false,
          error: "SMS to USA/Canada requires TWILIO_PHONE_NUMBER to be configured."
        };
      }
      senderId = twilioPhone;
    } else {
      // Rest of world: Use branded sender ID
      senderId = BRANDED_SENDER_ID;
    }

    // Dynamic import of Twilio SDK (only loads if configured)
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    const message = await client.messages.create({
      body: `Your Accute verification code is: ${otp}\n\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
      from: senderId,
      to: phone,
    });

    console.log(`OTP sent successfully to ${phone} from ${senderId}. SID: ${message.sid}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send OTP SMS:", error.message);
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
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );
}
