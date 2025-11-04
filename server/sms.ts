/**
 * SMS Helper Module for OTP verification via MSG91
 * 
 * Sends 6-digit OTP codes for mobile number verification during account setup.
 * Uses MSG91 for reliable international SMS delivery with strong India support.
 * 
 * To enable SMS functionality:
 * 1. Configure MSG91_AUTH_KEY in Replit Secrets (from MSG91 dashboard)
 * 2. Configure MSG91_SENDER_ID (default: "ACCUTE" - register this in MSG91 console)
 * 3. Configure MSG91_TEMPLATE_ID (from registered DLT template in MSG91)
 */

import crypto from 'crypto';

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
 * Ensures phone number has country code for MSG91
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
 * Send OTP verification code via SMS using MSG91 OTP API
 */
export async function sendOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if MSG91 is configured
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey) {
      console.warn("MSG91 not configured. SMS functionality disabled. Please set MSG91_AUTH_KEY.");
      return { 
        success: false, 
        error: "SMS functionality not configured. Please set up MSG91 credentials." 
      };
    }

    if (!templateId) {
      console.warn("MSG91_TEMPLATE_ID not configured. Required for OTP sending.");
      return {
        success: false,
        error: "MSG91 template ID required. Please configure MSG91_TEMPLATE_ID in your environment."
      };
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(phone);
    
    // Remove + prefix for MSG91 API (it expects just digits with country code)
    const phoneForAPI = formattedPhone.replace('+', '');

    // Prepare request payload for MSG91 OTP API
    // Use template_id for DLT compliance and structured OTP sending
    const payload: any = {
      template_id: templateId,
      mobile: phoneForAPI,
      otp: otp, // Send our pre-generated OTP
      otp_length: OTP_LENGTH,
      otp_expiry: OTP_EXPIRY_MINUTES
    };

    // Send OTP via MSG91 OTP API (v5)
    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || result.type === 'error') {
      console.error('MSG91 OTP API error:', result);
      return {
        success: false,
        error: result.message || 'Failed to send OTP via MSG91'
      };
    }

    console.log(`OTP sent successfully to ${phone} via MSG91. Type: ${result.type}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send OTP SMS via MSG91:", error.message);
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
  return !!process.env.MSG91_AUTH_KEY;
}
