import type { EmailTemplate, Contact, Organization } from "../../shared/schema";
import { renderEmailTemplate, validateTemplateContext, type TemplateRenderContext } from "./emailTemplateService";

/**
 * Portal Invitation Service
 * 
 * Handles the creation and sending of portal invitation emails
 * using customizable email templates.
 */

export interface PortalInvitationEmailData {
  contact: Contact;
  organization: Organization;
  client: {
    id: string;
    companyName: string;
  };
  invitationToken: string;
  invitationUrl: string;
  tempPassword?: string;
}

/**
 * Prepares a portal welcome email using the organization's email template
 * 
 * @param template - The email template to use
 * @param data - Portal invitation data
 * @returns Rendered email with subject and body
 */
export function preparePortalWelcomeEmail(
  template: EmailTemplate,
  data: PortalInvitationEmailData
): { subject: string; body: string; recipientEmail: string } {
  // Validate required data before rendering
  const missingFields = validatePortalInvitationData(data);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields for portal invitation email: ${missingFields.join(', ')}`);
  }

  // Build the context with all available placeholders
  const context: TemplateRenderContext = {
    firm_name: data.organization.name,
    contact_name: data.contact.contactName || `${data.contact.firstName} ${data.contact.lastName}`,
    first_name: data.contact.firstName,
    last_name: data.contact.lastName,
    email: data.contact.email,
    client_name: data.client.companyName,
    portal_link: data.invitationUrl,
    logo_url: template.logoUrl || '',
    footer_text: template.footerText || '',
  };

  // If temp password was provided, add it (though we shouldn't expose it in emails)
  if (data.tempPassword) {
    // Note: For security, we should NOT include the password in the email
    // Instead, the user should set their own password via the portal setup link
  }

  // Validate that all required template variables can be resolved
  const missingVars = validateTemplateContext(template, context);
  if (missingVars.length > 0) {
    throw new Error(`Template has unresolved variables: ${missingVars.join(', ')}. Cannot send email with raw placeholder tokens.`);
  }

  // Render the template
  const rendered = renderEmailTemplate(template, context);

  return {
    subject: rendered.subject,
    body: rendered.body,
    recipientEmail: data.contact.email,
  };
}

/**
 * Validates that required data is present for sending a portal invitation
 * 
 * @param data - Portal invitation data
 * @returns Array of missing field names
 */
export function validatePortalInvitationData(data: Partial<PortalInvitationEmailData>): string[] {
  const missingFields: string[] = [];

  if (!data.contact) {
    missingFields.push('contact');
  } else {
    if (!data.contact.email) missingFields.push('contact.email');
    if (!data.contact.firstName) missingFields.push('contact.firstName');
    if (!data.contact.lastName) missingFields.push('contact.lastName');
  }

  if (!data.organization) {
    missingFields.push('organization');
  } else {
    if (!data.organization.name) missingFields.push('organization.name');
  }

  if (!data.client) {
    missingFields.push('client');
  } else {
    if (!data.client.companyName) missingFields.push('client.companyName');
  }

  if (!data.invitationUrl) {
    missingFields.push('invitationUrl');
  }

  return missingFields;
}

/**
 * Creates a portal invitation URL for a given token
 * 
 * @param token - The invitation token
 * @param baseUrl - The base URL of the application
 * @returns The complete portal invitation URL
 */
export function createPortalInvitationUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
  return `${base}/portal-setup/${token}`;
}
