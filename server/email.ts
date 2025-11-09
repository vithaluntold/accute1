/**
 * Email Service Module for sending emails via Resend
 * 
 * Uses Replit's Resend connector integration for secure API key management
 */

import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

/**
 * Send an invitation email to a user
 * 
 * @param email - Recipient email address
 * @param inviteUrl - Invitation URL with token
 * @param organizationName - Name of the organization inviting the user
 * @param roleName - Role the user is being invited to
 * @returns Success status and error if applicable
 */
// Replace Unicode smart quotes and other problematic characters with ASCII equivalents
function sanitizeForEmail(str: string): string {
  return str
    // Replace smart quotes
    .replace(/[\u2018\u2019]/g, "'")  // Single quotes
    .replace(/[\u201C\u201D]/g, '"')  // Double quotes
    .replace(/\u2013/g, '-')          // En dash
    .replace(/\u2014/g, '--')         // Em dash
    .replace(/\u2026/g, '...')        // Ellipsis
    // Remove any remaining non-ASCII characters > 255
    .replace(/[^\x00-\xFF]/g, '');
}

export async function sendInvitationEmail(
  email: string, 
  inviteUrl: string, 
  organizationName: string,
  roleName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    // Sanitize all input values before using them in the template
    const cleanOrgName = sanitizeForEmail(organizationName);
    const cleanRoleName = sanitizeForEmail(roleName);
    const cleanInviteUrl = sanitizeForEmail(inviteUrl);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join ${cleanOrgName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1a 0%, #ff1493 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                Welcome to Accute
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                You've Been Invited!
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                <strong>${cleanOrgName}</strong> has invited you to join their team on Accute as a <strong>${cleanRoleName}</strong>.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Accute is an AI-powered accounting workflow automation platform that streamlines financial operations with custom workflows, AI agents, and secure document management.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${cleanInviteUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #1a1a1a 0%, #ff1493 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(255, 20, 147, 0.3);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; padding: 12px; background-color: #f7fafc; border-radius: 6px; word-break: break-all;">
                <a href="${cleanInviteUrl}" style="color: #ff1493; text-decoration: none; font-size: 14px;">
                  ${cleanInviteUrl}
                </a>
              </p>
              
              <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; color: #718096; font-size: 14px;">
                © ${new Date().getFullYear()} Accute. All rights reserved.
              </p>
              <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                AI-Powered Accounting Workflow Automation
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const rawSubject = `You're invited to join ${cleanOrgName} on Accute`;
    const cleanSubject = sanitizeForEmail(rawSubject);
    const cleanFromEmail = sanitizeForEmail(fromEmail);
    
    const result = await client.emails.send({
      from: cleanFromEmail,
      to: email,
      subject: cleanSubject,
      html: emailHtml,
    });

    console.log(`✓ Invitation email sent successfully to ${email}. ID: ${result.data?.id}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send invitation email:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      organizationName,
      email
    });
    return { 
      success: false, 
      error: error.message || "Failed to send invitation email" 
    };
  }
}

/**
 * Check if email service is configured
 */
export async function isEmailConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch (error) {
    return false;
  }
}
