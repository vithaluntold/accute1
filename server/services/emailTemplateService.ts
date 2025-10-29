import type { EmailTemplate } from "../../shared/schema";

/**
 * Email Template Rendering Service
 * 
 * Provides secure placeholder replacement for email templates.
 * Supports dynamic merge fields like {{portal_link}}, {{contact_name}}, etc.
 */

export interface TemplateRenderContext {
  firm_name?: string;
  contact_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  portal_link?: string;
  client_name?: string;
  logo_url?: string;
  footer_text?: string;
  // Allow additional dynamic fields
  [key: string]: string | undefined;
}

/**
 * Renders an email template by replacing placeholders with actual values
 * 
 * @param template - The email template to render
 * @param context - Object containing values to replace placeholders
 * @returns Object with rendered subject and body
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  context: TemplateRenderContext
): { subject: string; body: string } {
  // Start with template content
  let renderedSubject = template.subject;
  let renderedBody = template.body;

  // Replace placeholders in subject
  renderedSubject = replacePlaceholders(renderedSubject, context);

  // Replace placeholders in body
  renderedBody = replacePlaceholders(renderedBody, context);

  return {
    subject: renderedSubject,
    body: renderedBody
  };
}

/**
 * Replaces all {{placeholder}} patterns with values from context
 * 
 * @param text - Text containing placeholders
 * @param context - Object with replacement values
 * @returns Text with placeholders replaced
 */
function replacePlaceholders(text: string, context: TemplateRenderContext): string {
  // Find all {{placeholder}} patterns
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    
    // Get value from context
    const value = context[trimmedKey];
    
    // Return value if it exists, otherwise keep the placeholder
    return value !== undefined ? value : match;
  });
}

/**
 * Validates that all required variables in a template are provided in the context
 * 
 * @param template - The email template
 * @param context - The render context
 * @returns Array of missing variable names
 */
export function validateTemplateContext(
  template: EmailTemplate,
  context: TemplateRenderContext
): string[] {
  const missingVars: string[] = [];
  
  // Get all variables from template
  const variables = Array.isArray(template.variables) 
    ? template.variables as string[]
    : [];
  
  // Check each variable
  for (const variable of variables) {
    if (context[variable] === undefined) {
      missingVars.push(variable);
    }
  }
  
  return missingVars;
}

/**
 * Extracts all placeholder names from a text
 * 
 * @param text - Text to extract placeholders from
 * @returns Array of unique placeholder names
 */
export function extractPlaceholders(text: string): string[] {
  const placeholders = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    placeholders.add(match[1].trim());
  }
  
  return Array.from(placeholders);
}

/**
 * Gets all placeholders used in a template (subject + body)
 * 
 * @param template - The email template
 * @returns Array of unique placeholder names
 */
export function getTemplatePlaceholders(template: EmailTemplate): string[] {
  const subjectPlaceholders = extractPlaceholders(template.subject);
  const bodyPlaceholders = extractPlaceholders(template.body);
  
  // Combine and deduplicate
  const allPlaceholders = new Set([...subjectPlaceholders, ...bodyPlaceholders]);
  
  return Array.from(allPlaceholders);
}
