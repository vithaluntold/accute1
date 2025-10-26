/**
 * SMS Helper Module for sending invitation texts via Twilio
 * 
 * To enable SMS functionality:
 * 1. Set up the Twilio connector integration in Replit
 * 2. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER
 * 3. SMS invitations will automatically work once configured
 */

export async function sendInvitationSMS(phone: string, inviteUrl: string, organizationName: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Twilio is configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      console.warn("Twilio not configured. SMS functionality disabled. Please set up Twilio integration.");
      return { 
        success: false, 
        error: "SMS functionality not configured. Please set up Twilio integration in Settings." 
      };
    }

    // Dynamic import of Twilio SDK (only loads if configured)
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    const message = await client.messages.create({
      body: `You've been invited to join ${organizationName} on Accute! Click here to register: ${inviteUrl}`,
      from: twilioPhone,
      to: phone,
    });

    console.log(`SMS sent successfully to ${phone}. SID: ${message.sid}`);
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
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
