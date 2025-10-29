import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export async function initializeSystem() {
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
      { name: "chat.send", resource: "chat", action: "send", description: "Send chat messages" },
      
      // Appointments
      { name: "appointments.view", resource: "appointments", action: "view", description: "View appointments" },
      { name: "appointments.create", resource: "appointments", action: "create", description: "Create appointments" },
      { name: "appointments.update", resource: "appointments", action: "update", description: "Update appointments" },
      { name: "appointments.delete", resource: "appointments", action: "delete", description: "Delete appointments" },
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

    console.log("✅ System initialized successfully");
  } catch (error) {
    console.error("❌ System initialization failed:", error);
    // Don't throw - allow server to start even if initialization partially fails
  }
}
