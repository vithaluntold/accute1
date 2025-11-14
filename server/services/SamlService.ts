import { Strategy as SamlStrategy, MultiSamlStrategy, Profile } from '@node-saml/passport-saml';
import { db } from '../db';
import { ssoConnections, ssoSessions, users, userOrganizations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * SamlService
 * 
 * Handles SAML 2.0 authentication with multi-tenant support
 * Features:
 * - Multi-tenant SSO configuration per organization
 * - Auto-provisioning for new users
 * - Session tracking for audit trail
 * - Support for major IdPs (Okta, Azure AD, OneLogin, Google, Custom)
 */
export class SamlService {
  /**
   * Get SAML configuration for an organization
   */
  async getSsoConnection(organizationId: string) {
    const connections = await db
      .select()
      .from(ssoConnections)
      .where(
        and(
          eq(ssoConnections.organizationId, organizationId),
          eq(ssoConnections.isEnabled, true)
        )
      )
      .limit(1);

    return connections[0] || null;
  }

  /**
   * Get SAML strategy options for an organization
   * This is called by MultiSamlStrategy to get org-specific config
   */
  async getSamlOptions(organizationId: string, callbackUrl: string) {
    const connection = await this.getSsoConnection(organizationId);
    
    if (!connection) {
      throw new Error(`No SSO configuration found for organization ${organizationId}`);
    }

    // Decode certificate (remove headers/footers, newlines)
    const cert = connection.certificate
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\n/g, '');

    return {
      // Required
      entryPoint: connection.ssoUrl,
      issuer: connection.entityId,
      callbackUrl,
      cert,
      
      // Optional SAML settings
      logoutUrl: connection.logoutUrl || undefined,
      signatureAlgorithm: connection.signatureAlgorithm as any || 'sha256',
      wantAssertionsSigned: connection.wantAssertionsSigned ?? true,
      wantAuthnResponseSigned: connection.wantAuthnResponseSigned ?? false,
      
      // Passport settings
      passReqToCallback: true,
      
      // Additional security
      acceptedClockSkewMs: 0,
      maxAssertionAgeMs: 600000, // 10 minutes
    };
  }

  /**
   * Process SAML profile and authenticate/create user
   */
  async processProfile(
    organizationId: string,
    profile: Profile,
    sessionIndex: string | undefined,
    ipAddress: string,
    userAgent: string
  ) {
    const connection = await this.getSsoConnection(organizationId);
    
    if (!connection) {
      throw new Error('SSO connection not found');
    }

    // Extract user attributes from SAML profile using attribute mappings
    const mappings = (connection.attributeMappings as any) || {};
    const email = this.extractAttribute(profile, mappings.email || 'email');
    const firstName = this.extractAttribute(profile, mappings.firstName || 'firstName');
    const lastName = this.extractAttribute(profile, mappings.lastName || 'lastName');

    if (!email) {
      throw new Error('Email not found in SAML profile');
    }

    // Find or create user
    let user = await this.findUserByEmail(email);

    if (!user) {
      if (!connection.autoProvision) {
        throw new Error('User not found and auto-provisioning is disabled');
      }

      // Auto-provision new user
      user = await this.createUser(
        email,
        firstName,
        lastName,
        organizationId,
        connection.defaultRoleId
      );
    }

    // Verify user has access to this organization
    const membership = await this.getUserOrganizationMembership(user.id, organizationId);
    if (!membership) {
      // Auto-add user to organization if auto-provisioning is enabled
      if (connection.autoProvision && connection.defaultRoleId) {
        await this.addUserToOrganization(user.id, organizationId, connection.defaultRoleId);
      } else {
        throw new Error('User does not have access to this organization');
      }
    }

    // Create SSO session for audit trail
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    await db.insert(ssoSessions).values({
      ssoConnectionId: connection.id,
      userId: user.id,
      nameId: profile.nameID || email,
      sessionIndex: sessionIndex || null,
      ipAddress,
      userAgent,
      expiresAt,
    });

    return user;
  }

  /**
   * Extract attribute from SAML profile
   */
  private extractAttribute(profile: Profile, attributeName: string): string | null {
    // Try direct property first
    if ((profile as any)[attributeName]) {
      return (profile as any)[attributeName];
    }

    // Try common SAML attribute URIs
    const commonMappings: Record<string, string[]> = {
      email: [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        'email',
        'emailAddress',
        'mail',
      ],
      firstName: [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        'firstName',
        'givenName',
        'first_name',
      ],
      lastName: [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        'lastName',
        'surname',
        'last_name',
      ],
    };

    const possibleAttributes = commonMappings[attributeName] || [attributeName];
    
    for (const attr of possibleAttributes) {
      if ((profile as any)[attr]) {
        return (profile as any)[attr];
      }
    }

    return null;
  }

  /**
   * Find user by email
   */
  private async findUserByEmail(email: string) {
    const results = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Create new user (auto-provisioning)
   */
  private async createUser(
    email: string,
    firstName: string | null,
    lastName: string | null,
    organizationId: string,
    roleId: string | null
  ) {
    // Generate random password (user won't need it, they'll use SSO)
    const randomPassword = crypto.randomBytes(32).toString('hex');

    const [newUser] = await db.insert(users).values({
      email,
      username: email.split('@')[0] + '_' + Date.now(),
      password: randomPassword, // Not used for SSO users
      firstName: firstName || null,
      lastName: lastName || null,
      roleId: roleId || '', // Will be set by organization membership
      organizationId, // Legacy field
      defaultOrganizationId: organizationId,
      isActive: true,
    }).returning();

    return newUser;
  }

  /**
   * Get user's organization membership
   */
  private async getUserOrganizationMembership(userId: string, organizationId: string) {
    const results = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId),
          eq(userOrganizations.status, 'active')
        )
      )
      .limit(1);

    return results[0] || null;
  }

  /**
   * Add user to organization
   */
  private async addUserToOrganization(userId: string, organizationId: string, roleId: string) {
    await db.insert(userOrganizations).values({
      userId,
      organizationId,
      roleId,
      status: 'active',
      joinedAt: new Date(),
      isDefault: true,
    });
  }

  /**
   * Generate SP metadata XML for IdP configuration
   */
  generateMetadata(entityId: string, acsUrl: string, certificate?: string): string {
    const certContent = certificate
      ? certificate
          .replace(/-----BEGIN CERTIFICATE-----/, '')
          .replace(/-----END CERTIFICATE-----/, '')
          .replace(/\n/g, '')
      : '';

    return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    ${certContent ? `
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>${certContent}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <KeyDescriptor use="encryption">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>${certContent}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>` : ''}
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService index="1" isDefault="true" 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
      Location="${acsUrl}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }

  /**
   * Logout SSO session
   */
  async logoutSession(userId: string, ssoConnectionId: string) {
    await db
      .update(ssoSessions)
      .set({ logoutAt: new Date() })
      .where(
        and(
          eq(ssoSessions.userId, userId),
          eq(ssoSessions.ssoConnectionId, ssoConnectionId)
        )
      );
  }
}

export const samlService = new SamlService();
