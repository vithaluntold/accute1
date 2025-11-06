import type { Express } from "express";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "./storage";
import { hashPassword } from "./auth";

async function createPersistentSeedAccountsInline() {
  // Get roles
  const superAdminRole = await db.select().from(schema.roles).where(eq(schema.roles.name, "Super Admin")).then(r => r[0]);
  const adminRole = await db.select().from(schema.roles).where(eq(schema.roles.name, "Admin")).then(r => r[0]);
  const employeeRole = await db.select().from(schema.roles).where(eq(schema.roles.name, "Employee")).then(r => r[0]);
  const clientRole = await db.select().from(schema.roles).where(eq(schema.roles.name, "Client")).then(r => r[0]);

  // 1. Super Admin
  let superAdmin = await db.select().from(schema.users).where(eq(schema.users.email, "superadmin@accute.com")).then(r => r[0]);
  if (!superAdmin) {
    superAdmin = await db.insert(schema.users).values({
      email: "superadmin@accute.com",
      username: "superadmin",
      password: await hashPassword("SuperAdmin123!"),
      firstName: "Super",
      lastName: "Admin",
      roleId: superAdminRole.id,
      organizationId: null,
      isActive: true,
    }).returning().then(r => r[0]);
    console.log("✓ Super Admin created");
  }

  // 2. Organization
  let organization = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, "sterling-accounting")).then(r => r[0]);
  if (!organization) {
    organization = await db.insert(schema.organizations).values({
      name: "Sterling Accounting Firm",
      slug: "sterling-accounting",
    }).returning().then(r => r[0]);
    console.log("✓ Organization created: Sterling Accounting Firm");
  }

  // 3. Admin
  let admin = await db.select().from(schema.users).where(eq(schema.users.email, "admin@sterling.com")).then(r => r[0]);
  if (!admin) {
    admin = await db.insert(schema.users).values({
      email: "admin@sterling.com",
      username: "admin",
      password: await hashPassword("Admin123!"),
      firstName: "Sarah",
      lastName: "Sterling",
      roleId: adminRole.id,
      organizationId: organization.id,
      isActive: true,
    }).returning().then(r => r[0]);
    console.log("✓ Admin created: Sarah Sterling");
  }

  // 4. Employee
  let employee = await db.select().from(schema.users).where(eq(schema.users.email, "employee@sterling.com")).then(r => r[0]);
  if (!employee) {
    employee = await db.insert(schema.users).values({
      email: "employee@sterling.com",
      username: "employee",
      password: await hashPassword("Employee123!"),
      firstName: "John",
      lastName: "Matthews",
      roleId: employeeRole.id,
      organizationId: organization.id,
      isActive: true,
    }).returning().then(r => r[0]);
    console.log("✓ Employee created: John Matthews");
  }

  // 5. Client Company
  let client = await db.select().from(schema.clients)
    .where(and(eq(schema.clients.companyName, "TechNova Solutions"), eq(schema.clients.organizationId, organization.id)))
    .then(r => r[0]);
  if (!client) {
    client = await db.insert(schema.clients).values({
      companyName: "TechNova Solutions",
      contactName: "David Chen",
      email: "david@technova.com",
      phone: "+1-555-0199",
      address: "456 Innovation Drive",
      city: "San Francisco",
      state: "CA",
      zipCode: "94103",
      country: "US",
      taxId: "94-7654321",
      organizationId: organization.id,
      assignedTo: admin.id,
      status: "active",
      industry: "Technology",
      notes: "SaaS company requiring year-end tax preparation",
      metadata: {},
      createdBy: admin.id,
    }).returning().then(r => r[0]);
    console.log("✓ Client Company created: TechNova Solutions");
  }

  // 6. Contact
  let contact = await db.select().from(schema.contacts)
    .where(and(eq(schema.contacts.email, "david@technova.com"), eq(schema.contacts.organizationId, organization.id)))
    .then(r => r[0]);
  if (!contact) {
    contact = await db.insert(schema.contacts).values({
      clientId: client.id,
      firstName: "David",
      lastName: "Chen",
      email: "david@technova.com",
      phone: "+1-555-0199",
      title: "CFO",
      department: "Finance",
      isPrimary: true,
      notes: "Primary contact for all accounting matters",
      organizationId: organization.id,
      createdBy: admin.id,
    }).returning().then(r => r[0]);
    console.log("✓ Contact created: David Chen (CFO)");
  }

  // 7. Client User
  let clientUser = await db.select().from(schema.users).where(eq(schema.users.email, "david@technova.com")).then(r => r[0]);
  if (!clientUser) {
    clientUser = await db.insert(schema.users).values({
      email: "david@technova.com",
      username: "davidchen",
      password: await hashPassword("Client123!"),
      firstName: "David",
      lastName: "Chen",
      roleId: clientRole.id,
      organizationId: organization.id,
      isActive: true,
    }).returning().then(r => r[0]);
    console.log("✓ Client User created: David Chen");
  }

  console.log("✅ Persistent seed accounts ready for roleplay");
}

export async function initializeSystem(app: Express) {
  try {
    console.log("🔧 Initializing system...");

    // Check if system roles exist
    const existingRoles = await db.select().from(schema.roles).where(eq(schema.roles.isSystemRole, true));
    
    // Always run to ensure new permissions are added
    if (existingRoles.length >= 4) {
      console.log("✓ System roles exist, checking permissions...");
      // Continue to add any missing permissions
    }

    console.log("📝 Creating system roles and permissions...");

    // Get or create system roles
    const getSuperAdmin = await db.select().from(schema.roles).where(eq(schema.roles.name, "Super Admin"));
    const getAdmin = await db.select().from(schema.roles).where(eq(schema.roles.name, "Admin"));
    const getEmployee = await db.select().from(schema.roles).where(eq(schema.roles.name, "Employee"));
    const getClient = await db.select().from(schema.roles).where(eq(schema.roles.name, "Client"));
    
    const roles = {
      superAdmin: getSuperAdmin.length > 0 ? getSuperAdmin[0] : await db.insert(schema.roles).values({
        name: "Super Admin",
        description: "Full system access with organization management",
        isSystemRole: true,
      }).returning().then(r => r[0]).catch(() => null),

      admin: getAdmin.length > 0 ? getAdmin[0] : await db.insert(schema.roles).values({
        name: "Admin",
        description: "Organization administrator with team management",
        isSystemRole: true,
      }).returning().then(r => r[0]).catch(() => null),

      employee: getEmployee.length > 0 ? getEmployee[0] : await db.insert(schema.roles).values({
        name: "Employee",
        description: "Team member with workflow execution access",
        isSystemRole: true,
      }).returning().then(r => r[0]).catch(() => null),

      client: getClient.length > 0 ? getClient[0] : await db.insert(schema.roles).values({
        name: "Client",
        description: "Client with portal access for documents and workflow status",
        isSystemRole: true,
      }).returning().then(r => r[0]).catch(() => null),
    };

    // Create permissions
    const permissions = [
      // User management
      { name: "users.view", resource: "users", action: "view", description: "View users" },
      { name: "users.create", resource: "users", action: "create", description: "Create users" },
      { name: "users.edit", resource: "users", action: "edit", description: "Edit users" },
      { name: "users.delete", resource: "users", action: "delete", description: "Delete users" },
      
      // Role management
      { name: "roles.view", resource: "roles", action: "view", description: "View roles" },
      { name: "roles.create", resource: "roles", action: "create", description: "Create roles" },
      { name: "roles.edit", resource: "roles", action: "edit", description: "Edit roles" },
      { name: "roles.delete", resource: "roles", action: "delete", description: "Delete roles" },
      
      // Workflow management
      { name: "workflows.view", resource: "workflows", action: "view", description: "View workflows" },
      { name: "workflows.create", resource: "workflows", action: "create", description: "Create workflows" },
      { name: "workflows.edit", resource: "workflows", action: "edit", description: "Edit workflows" },
      { name: "workflows.delete", resource: "workflows", action: "delete", description: "Delete workflows" },
      { name: "workflows.execute", resource: "workflows", action: "execute", description: "Execute workflows" },
      
      // Pipeline management
      { name: "pipelines.view", resource: "pipelines", action: "view", description: "View pipelines" },
      { name: "pipelines.create", resource: "pipelines", action: "create", description: "Create pipelines" },
      { name: "pipelines.update", resource: "pipelines", action: "update", description: "Update pipelines" },
      { name: "pipelines.delete", resource: "pipelines", action: "delete", description: "Delete pipelines" },
      
      // AI Agent management
      { name: "ai_agents.view", resource: "ai_agents", action: "view", description: "View AI agents" },
      { name: "ai_agents.install", resource: "ai_agents", action: "install", description: "Install AI agents" },
      { name: "ai_agents.configure", resource: "ai_agents", action: "configure", description: "Configure AI agents" },
      { name: "ai_agents.create", resource: "ai_agents", action: "create", description: "Create AI agents" },
      
      // Document management
      { name: "documents.view", resource: "documents", action: "view", description: "View documents" },
      { name: "documents.upload", resource: "documents", action: "upload", description: "Upload documents" },
      { name: "documents.delete", resource: "documents", action: "delete", description: "Delete documents" },
      
      // Form management
      { name: "forms.view", resource: "forms", action: "view", description: "View forms" },
      { name: "forms.create", resource: "forms", action: "create", description: "Create forms" },
      { name: "forms.edit", resource: "forms", action: "edit", description: "Edit forms" },
      { name: "forms.delete", resource: "forms", action: "delete", description: "Delete forms" },
      { name: "forms.publish", resource: "forms", action: "publish", description: "Publish forms" },
      { name: "forms.share", resource: "forms", action: "share", description: "Share forms" },
      { name: "forms.submit", resource: "forms", action: "submit", description: "Submit forms" },
      
      // Document Request management
      { name: "documentRequests.view", resource: "documentRequests", action: "view", description: "View document requests" },
      { name: "documentRequests.create", resource: "documentRequests", action: "create", description: "Create document requests" },
      { name: "documentRequests.edit", resource: "documentRequests", action: "edit", description: "Edit document requests" },
      { name: "documentRequests.delete", resource: "documentRequests", action: "delete", description: "Delete document requests" },
      { name: "documentRequests.manage", resource: "documentRequests", action: "manage", description: "Manage document requests" },
      
      // Client management
      { name: "clients.view", resource: "clients", action: "view", description: "View clients" },
      { name: "clients.create", resource: "clients", action: "create", description: "Create clients" },
      { name: "clients.edit", resource: "clients", action: "edit", description: "Edit clients" },
      { name: "clients.delete", resource: "clients", action: "delete", description: "Delete clients" },
      
      // Contact management
      { name: "contacts.view", resource: "contacts", action: "view", description: "View contacts" },
      { name: "contacts.create", resource: "contacts", action: "create", description: "Create contacts" },
      { name: "contacts.edit", resource: "contacts", action: "edit", description: "Edit contacts" },
      { name: "contacts.delete", resource: "contacts", action: "delete", description: "Delete contacts" },
      
      // Tag management
      { name: "tags.view", resource: "tags", action: "view", description: "View tags" },
      { name: "tags.create", resource: "tags", action: "create", description: "Create tags" },
      { name: "tags.edit", resource: "tags", action: "edit", description: "Edit tags" },
      { name: "tags.delete", resource: "tags", action: "delete", description: "Delete tags" },
      { name: "tags.apply", resource: "tags", action: "apply", description: "Apply tags to resources" },
      
      // Organization management
      { name: "organizations.view", resource: "organizations", action: "view", description: "View organizations" },
      { name: "organizations.edit", resource: "organizations", action: "edit", description: "Edit organizations" },
      
      // Analytics
      { name: "analytics.view", resource: "analytics", action: "view", description: "View analytics" },
      
      // Settings
      { name: "settings.manage", resource: "settings", action: "manage", description: "Manage organization settings" },
      
      // Email Templates
      { name: "templates.view", resource: "templates", action: "view", description: "View email templates" },
      { name: "templates.create", resource: "templates", action: "create", description: "Create email templates" },
      { name: "templates.update", resource: "templates", action: "update", description: "Update email templates" },
      { name: "templates.delete", resource: "templates", action: "delete", description: "Delete email templates" },
      
      // Messages/Conversations
      { name: "conversations.view", resource: "conversations", action: "view", description: "View conversations" },
      { name: "conversations.create", resource: "conversations", action: "create", description: "Create conversations" },
      { name: "conversations.send", resource: "conversations", action: "send", description: "Send messages" },
      
      // Time Tracking
      { name: "timeEntries.view", resource: "timeEntries", action: "view", description: "View time entries" },
      { name: "timeEntries.create", resource: "timeEntries", action: "create", description: "Create time entries" },
      { name: "timeEntries.update", resource: "timeEntries", action: "update", description: "Update time entries" },
      { name: "timeEntries.delete", resource: "timeEntries", action: "delete", description: "Delete time entries" },
      
      // Invoices
      { name: "invoices.view", resource: "invoices", action: "view", description: "View invoices" },
      { name: "invoices.create", resource: "invoices", action: "create", description: "Create invoices" },
      { name: "invoices.update", resource: "invoices", action: "update", description: "Update invoices" },
      { name: "invoices.delete", resource: "invoices", action: "delete", description: "Delete invoices" },
      
      // Projects
      { name: "projects.view", resource: "projects", action: "view", description: "View projects" },
      { name: "projects.create", resource: "projects", action: "create", description: "Create projects" },
      { name: "projects.update", resource: "projects", action: "update", description: "Update projects" },
      { name: "projects.delete", resource: "projects", action: "delete", description: "Delete projects" },
      
      // Tasks
      { name: "tasks.view", resource: "tasks", action: "view", description: "View tasks" },
      { name: "tasks.create", resource: "tasks", action: "create", description: "Create tasks" },
      { name: "tasks.update", resource: "tasks", action: "update", description: "Update tasks" },
      { name: "tasks.delete", resource: "tasks", action: "delete", description: "Delete tasks" },
      
      // Payments
      { name: "payments.view", resource: "payments", action: "view", description: "View payments" },
      { name: "payments.create", resource: "payments", action: "create", description: "Create payments" },
      { name: "payments.update", resource: "payments", action: "update", description: "Update payments" },
      
      // Signature Requests
      { name: "signatures.view", resource: "signatures", action: "view", description: "View signature requests" },
      { name: "signatures.create", resource: "signatures", action: "create", description: "Create signature requests" },
      { name: "signatures.sign", resource: "signatures", action: "sign", description: "Sign documents" },
      
      // Team Chat
      { name: "chat.view", resource: "chat", action: "view", description: "View team chat" },
      { name: "chat.create", resource: "chat", action: "create", description: "Create team chat channels" },
      { name: "chat.send", resource: "chat", action: "send", description: "Send chat messages" },
      
      // Appointments
      { name: "appointments.view", resource: "appointments", action: "view", description: "View appointments" },
      { name: "appointments.create", resource: "appointments", action: "create", description: "Create appointments" },
      { name: "appointments.update", resource: "appointments", action: "update", description: "Update appointments" },
      { name: "appointments.delete", resource: "appointments", action: "delete", description: "Delete appointments" },
      
      // Roundtable (AI Collaboration)
      { name: "roundtable.access", resource: "roundtable", action: "access", description: "Access AI Roundtable for multi-agent collaboration" },
      { name: "roundtable.create", resource: "roundtable", action: "create", description: "Create Roundtable sessions" },
      { name: "roundtable.manage", resource: "roundtable", action: "manage", description: "Manage Roundtable sessions and participants" },
      
      // Reports
      { name: "reports.view", resource: "reports", action: "view", description: "View practice-wide reports and analytics" },
      
      // Team Management
      { name: "teams.view", resource: "teams", action: "view", description: "View teams" },
      { name: "teams.create", resource: "teams", action: "create", description: "Create teams" },
      { name: "teams.update", resource: "teams", action: "update", description: "Update teams and members" },
      { name: "teams.delete", resource: "teams", action: "delete", description: "Delete teams" },
      { name: "teams.manage", resource: "teams", action: "manage", description: "Manage hierarchical supervision" },
    ];

    const createdPermissions: any[] = [];
    for (const perm of permissions) {
      try {
        const created = await db.insert(schema.permissions).values(perm).returning();
        createdPermissions.push(created[0]);
      } catch (error) {
        // Permission might already exist, fetch it
        const existing = await db.select().from(schema.permissions).where(eq(schema.permissions.name, perm.name));
        if (existing.length > 0) {
          createdPermissions.push(existing[0]);
        }
      }
    }

    // Assign permissions to roles
    if (roles.superAdmin) {
      for (const perm of createdPermissions) {
        try {
          await db.insert(schema.rolePermissions).values({
            roleId: roles.superAdmin.id,
            permissionId: perm.id,
          });
        } catch (error) {
          // Ignore duplicates
        }
      }
    }

    if (roles.admin) {
      const adminPermissions = createdPermissions.filter(p => 
        // Exclude only organization management permissions
        !p.name.startsWith("organizations.")
      );
      for (const perm of adminPermissions) {
        try {
          await db.insert(schema.rolePermissions).values({
            roleId: roles.admin.id,
            permissionId: perm.id,
          });
        } catch (error) {
          // Ignore duplicates
        }
      }
    }

    if (roles.employee) {
      // Employee should NOT have workflows.view (team-wide) or reports.view (practice-wide)
      // They can work on their own tasks but not see team/practice statistics
      const employeePermissions = createdPermissions.filter(p =>
        // Document permissions
        (p.resource === "documents" && (p.action === "view" || p.action === "upload")) ||
        // AI Agent permissions
        (p.resource === "ai_agents" && p.action === "view") ||
        // Form permissions
        (p.resource === "forms" && p.action === "view") ||
        // Workflow execution (their own tasks)
        p.name === "workflows.execute" ||
        // Tag view
        (p.resource === "tags" && p.action === "view") ||
        // Contact view
        (p.resource === "contacts" && p.action === "view") ||
        // Client view
        (p.resource === "clients" && p.action === "view")
      );
      for (const perm of employeePermissions) {
        try {
          await db.insert(schema.rolePermissions).values({
            roleId: roles.employee.id,
            permissionId: perm.id,
          });
        } catch (error) {
          // Ignore duplicates
        }
      }
    }

    if (roles.client) {
      // Client should NOT have workflows.view (team-wide visibility)
      // They can only see documents and their own assigned tasks
      const clientPermissions = createdPermissions.filter(p =>
        p.resource === "documents" // Only document permissions for clients
      );
      for (const perm of clientPermissions) {
        try {
          await db.insert(schema.rolePermissions).values({
            roleId: roles.client.id,
            permissionId: perm.id,
          });
        } catch (error) {
          // Ignore duplicates
        }
      }
    }

    // Seed AI Copilots in marketplace
    const aiCopilots = [
      {
        name: "Cadence",
        description: "AI-powered workflow automation copilot that helps you build complex accounting workflows through natural conversation. Cadence understands tax processes, audit procedures, and bookkeeping tasks to create intelligent workflow pipelines.",
        provider: "accute",
        category: "workflow",
        capabilities: ["workflow_generation", "process_automation", "tax_workflows", "audit_workflows", "bookkeeping_automation"],
        configuration: { modelProvider: "openai", model: "gpt-4" },
        pricingModel: "free",
        version: "1.0.0",
        tags: ["workflow", "automation", "ai-assistant", "accounting"],
        isPublic: true,
      },
      {
        name: "Parity",
        description: "Legal document generation copilot specialized in creating engagement letters, agreements, contracts, and compliance documents. Parity ensures your documents meet professional standards and include all necessary legal clauses.",
        provider: "accute",
        category: "legal",
        capabilities: ["document_generation", "engagement_letters", "contracts", "compliance_docs", "legal_templates"],
        configuration: { modelProvider: "openai", model: "gpt-4" },
        pricingModel: "free",
        version: "1.0.0",
        tags: ["legal", "documents", "contracts", "ai-assistant"],
        isPublic: true,
      },
      {
        name: "Forma",
        description: "Intelligent form builder copilot that creates custom forms, organizers, and questionnaires for client data collection. Forma understands tax forms, client intake processes, and can build complex conditional forms with validation.",
        provider: "accute",
        category: "forms",
        capabilities: ["form_generation", "questionnaires", "organizers", "conditional_logic", "validation_rules"],
        configuration: { modelProvider: "openai", model: "gpt-4" },
        pricingModel: "free",
        version: "1.0.0",
        tags: ["forms", "data-collection", "ai-assistant", "tax-organizers"],
        isPublic: true,
      },
      {
        name: "Luca",
        description: "Expert AI assistant specializing in accounting, finance, and taxation. Luca provides comprehensive guidance on financial statements, tax planning, compliance, audit preparation, and can create support tickets for complex issues requiring human expertise. Think of Luca as your AI accounting consultant available 24/7.",
        provider: "accute",
        category: "accounting",
        capabilities: ["accounting_guidance", "tax_planning", "financial_analysis", "compliance_support", "support_tickets", "audit_preparation"],
        configuration: { modelProvider: "openai", model: "gpt-4" },
        pricingModel: "free",
        version: "1.0.0",
        tags: ["accounting", "taxation", "finance", "ai-assistant", "support"],
        isPublic: true,
      },
    ];

    for (const copilot of aiCopilots) {
      try {
        // Check if copilot already exists
        const existing = await db.select().from(schema.aiAgents).where(eq(schema.aiAgents.name, copilot.name));
        if (existing.length === 0) {
          await db.insert(schema.aiAgents).values(copilot);
          console.log(`✓ Seeded AI copilot: ${copilot.name}`);
        }
      } catch (error) {
        console.log(`⚠️  Copilot ${copilot.name} may already exist`);
      }
    }

    // Seed default welcome email template
    try {
      const existingWelcomeTemplate = await db.select().from(schema.emailTemplates)
        .where(
          and(
            eq(schema.emailTemplates.category, "welcome"),
            eq(schema.emailTemplates.isDefault, true)
          )
        );
      
      if (existingWelcomeTemplate.length === 0) {
        // Get Super Admin role first
        const superAdminRole = await db.select().from(schema.roles)
          .where(eq(schema.roles.name, "Super Admin"))
          .limit(1);

        // Find a system user with Super Admin role
        let createdBy = null;
        if (superAdminRole.length > 0) {
          const systemUser = await db.select().from(schema.users)
            .where(eq(schema.users.roleId, superAdminRole[0].id))
            .limit(1);
          createdBy = systemUser.length > 0 ? systemUser[0].id : null;
        }

        if (createdBy) {
          await db.insert(schema.emailTemplates).values({
            organizationId: null, // System-wide template (schema now allows null)
            name: "Client Portal Welcome Email",
            category: "welcome",
            subject: "Welcome to {{firm_name}} - Set Up Your Client Portal Access",
            body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #ec4899 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .social-links { margin: 15px 0; }
    .social-links a { margin: 0 10px; color: #1e3a8a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      {{#if logo_url}}<img src="{{logo_url}}" alt="{{firm_name}}" style="max-width: 200px; margin-bottom: 15px;">{{/if}}
      <h1>Welcome to {{firm_name}}!</h1>
    </div>
    <div class="content">
      <p>Hi {{contact_name}},</p>
      
      <p>We're excited to have you as a client! We've created a secure client portal where you can:</p>
      
      <ul>
        <li>View and manage your pending tasks</li>
        <li>Upload documents securely</li>
        <li>Track the progress of your assignments</li>
        <li>Communicate directly with our team</li>
        <li>Access important documents and reports</li>
      </ul>
      
      <p>To get started, please set up your client portal access by clicking the button below:</p>
      
      <div style="text-align: center;">
        <a href="{{portal_link}}" class="button">Set Up My Portal Access</a>
      </div>
      
      <p><strong>Note:</strong> This link will expire in 7 days for security purposes. If you need a new link, please contact us.</p>
      
      <p>If you have any questions or need assistance, don't hesitate to reach out to our team.</p>
      
      <p>Best regards,<br>The {{firm_name}} Team</p>
    </div>
    <div class="footer">
      {{#if footer_text}}
        <p>{{footer_text}}</p>
      {{/if}}
      {{#if social_links}}
        <div class="social-links">
          {{#if social_links.linkedin}}<a href="{{social_links.linkedin}}">LinkedIn</a>{{/if}}
          {{#if social_links.facebook}}<a href="{{social_links.facebook}}">Facebook</a>{{/if}}
          {{#if social_links.twitter}}<a href="{{social_links.twitter}}">Twitter</a>{{/if}}
        </div>
      {{/if}}
      <p>&copy; {{current_year}} {{firm_name}}. All rights reserved.</p>
      <p style="font-size: 10px; margin-top: 15px;">This email was sent to {{contact_email}}. If you received this in error, please contact us.</p>
    </div>
  </div>
</body>
</html>
            `.trim(),
            variables: ["firm_name", "contact_name", "portal_link", "logo_url", "footer_text", "social_links", "current_year", "contact_email"],
            isActive: true,
            isDefault: true,
            logoUrl: null,
            footerText: null,
            socialLinks: {},
            brandingColors: { primary: "#1e3a8a", secondary: "#ec4899" },
            usageCount: 0,
            metadata: {},
            createdBy,
          });
          console.log("✓ Seeded default welcome email template");
        }
      }
    } catch (error) {
      console.log("⚠️  Default welcome template may already exist or failed to create:", error);
    }

    // Backfill client_contacts junction table from existing contacts.clientId
    try {
      const contactsWithClients = await db.select().from(schema.contacts)
        .where(sql`${schema.contacts.clientId} IS NOT NULL`);
      
      if (contactsWithClients.length > 0) {
        console.log(`📦 Migrating ${contactsWithClients.length} contacts to client_contacts junction table...`);
        
        for (const contact of contactsWithClients) {
          // Check if relationship already exists
          const existingRelation = await db.select().from(schema.clientContacts)
            .where(and(
              eq(schema.clientContacts.contactId, contact.id),
              eq(schema.clientContacts.clientId, contact.clientId!)
            ));
          
          if (existingRelation.length === 0) {
            await db.insert(schema.clientContacts).values({
              contactId: contact.id,
              clientId: contact.clientId!,
              isPrimary: contact.isPrimary,
              organizationId: contact.organizationId,
            });
          }
        }
        
        console.log("✓ Client-contact relationships migrated successfully");
      }
    } catch (error) {
      console.log("⚠️  Client-contact migration may have already run or failed:", error);
    }

    // Create persistent seed accounts for roleplay
    try {
      console.log("🌱 Creating persistent seed accounts...");
      await createPersistentSeedAccountsInline();
    } catch (error) {
      console.log("⚠️  Persistent seed accounts may already exist or failed to create:", error);
    }

    // Initialize LLM Configuration Service (before agents)
    const { initializeLLMConfigService } = await import("./llm-config-service");
    initializeLLMConfigService(storage);

    // Initialize Agent Registry
    console.log("🤖 Initializing AI Agent Foundry...");
    const { agentRegistry } = await import("./agent-registry");
    await agentRegistry.initialize();
    console.log("✅ Agent Foundry initialized successfully");

    // Register agent routes AFTER agents are loaded
    console.log("🔧 Registering agent routes...");
    try {
      const agents = agentRegistry.getAllAgents();
      console.log(`📋 Found ${agents.length} agents to register routes for`);
      
      for (const agent of agents) {
        console.log(`  → Registering routes for: ${agent.slug}`);
        try {
          await agentRegistry.registerAgentRoutes(app, agent.slug);
          console.log(`  ✓ Successfully registered: ${agent.slug}`);
        } catch (error) {
          console.error(`  ✗ Failed to register routes for agent ${agent.slug}:`, error);
        }
      }
      console.log("✅ Agent route registration complete");
    } catch (error) {
      console.error("❌ Failed to register agent routes:", error);
    }

    console.log("✅ System initialized successfully");
  } catch (error) {
    console.error("❌ System initialization failed:", error);
    // Don't throw - allow server to start even if initialization partially fails
  }
}
