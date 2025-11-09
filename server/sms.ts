/**
 * SMS Helper Module for OTP verification via Twilio
 * 
 * Sends 6-digit OTP codes for mobile number verification during account setup.
 * Uses Twilio for reliable international SMS delivery - NO IP WHITELISTING REQUIRED.
 * 
 * To enable SMS functionality:
 * 1. Sign up at twilio.com
 * 2. Configure TWILIO_ACCOUNT_SID in Replit Secrets (from Twilio dashboard)
 * 3. Configure TWILIO_AUTH_TOKEN in Replit Secrets (from Twilio dashboard)
 * 4. Configure TWILIO_PHONE_NUMBER (your Twilio phone number, e.g., +15551234567)
 */

import crypto from 'crypto';
import twilio from 'twilio';

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
 * Ensures phone number has country code for Twilio
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
 * Send OTP verification code via SMS using Twilio API
 */
export async function sendOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Twilio is configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken) {
      console.warn("Twilio not configured. SMS functionality disabled. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
      return { 
        success: false, 
        error: "SMS functionality not configured. Please set up Twilio credentials." 
      };
    }

    if (!fromNumber) {
      console.warn("TWILIO_PHONE_NUMBER not configured. Required for sending SMS.");
      return {
        success: false,
        error: "Twilio phone number required. Please configure TWILIO_PHONE_NUMBER in your environment."
      };
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(phone);

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Prepare SMS message
    const messageText = `Your Accute verification code is: ${otp}\n\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this message.`;

    // Send SMS via Twilio
    const message = await client.messages.create({
      body: messageText,
      from: fromNumber,
      to: formattedPhone,
    });

    if (!message || message.errorCode) {
      console.error('Twilio SMS API error:', message);
      return {
        success: false,
        error: message.errorMessage || 'Failed to send OTP via Twilio'
      };
    }

    console.log(`OTP sent successfully to ${phone} via Twilio. Message SID: ${message.sid}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send OTP SMS via Twilio:", error.message);
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
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
