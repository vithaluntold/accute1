/**
 * SMS Helper Module for sending messages via Twilio with branded sender ID
 * 
 * Configured to use "Accute" as the alphanumeric sender ID for most countries
 * Automatically falls back to TWILIO_PHONE_NUMBER for USA/Canada (where alphanumeric IDs are not supported)
 * 
 * To enable SMS functionality:
 * 1. Configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Replit Secrets
 * 2. Register "Accute" as your alphanumeric sender ID in Twilio console
 * 3. (Optional) Set TWILIO_PHONE_NUMBER for USA/Canada support
 * 4. SMS will automatically use "Accute" or fall back to phone number based on destination
 */

const BRANDED_SENDER_ID = "Accute";

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

export async function sendInvitationSMS(phone: string, inviteUrl: string, organizationName: string): Promise<{ success: boolean; error?: string }> {
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
      body: `You've been invited to join ${organizationName} on Accute! Click here to register: ${inviteUrl}`,
      from: senderId,
      to: phone,
    });

    console.log(`SMS sent successfully to ${phone} from ${senderId}. SID: ${message.sid}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send SMS:", error.message);
    return { 
      success: false, 
      error: error.message || "Failed to send SMS" 
    };
  }
}

export function isSMSConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );
}
