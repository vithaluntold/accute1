import type { Express } from "express";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
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

  // Ensure Sterling organization has a default LLM configuration
  const { getOnboardingService } = await import("./organization-onboarding-service");
  try {
    const onboardingService = getOnboardingService();
    await onboardingService.ensureDefaultLlmConfig(organization.id, admin.id);
  } catch (error) {
    console.log("Note: LLM config will be created after onboarding service initializes");
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
      
      // P0 PRIORITY: Notifications (Action Center, Notification Bell)
      { name: "notifications.view", resource: "notifications", action: "view", description: "View notifications" },
      { name: "notifications.create", resource: "notifications", action: "create", description: "Create notifications (system-generated)" },
      { name: "notifications.read", resource: "notifications", action: "read", description: "Mark notifications as read" },
      { name: "notifications.delete", resource: "notifications", action: "delete", description: "Delete notifications" },
      
      // P0 PRIORITY: Action Center (Client Portal)
      { name: "action_center.view", resource: "action_center", action: "view", description: "View action center dashboard" },
      { name: "action_center.filter", resource: "action_center", action: "filter", description: "Filter by responsibility (waiting on me/firm)" },
      
      // P0 PRIORITY: Payment Collection
      { name: "payments.request", resource: "payments", action: "request", description: "Request payment from client" },
      { name: "payments.collect", resource: "payments", action: "collect", description: "Access payment collection UI" },
      { name: "payments.refund", resource: "payments", action: "refund", description: "Process payment refunds" },
      { name: "payments.reconcile", resource: "payments", action: "reconcile", description: "Reconcile payment records" },
      
      // P0 PRIORITY: Client Portal Access (standardized naming)
      { name: "client_portal.access", resource: "client_portal", action: "access", description: "Access client portal" },
      
      // P1 PRIORITY: Automation
      { name: "automation.view", resource: "automation", action: "view", description: "View automation rules" },
      { name: "automation.create", resource: "automation", action: "create", description: "Create automation rules" },
      { name: "automation.edit", resource: "automation", action: "edit", description: "Edit automation rules" },
      { name: "automation.delete", resource: "automation", action: "delete", description: "Delete automation rules" },
      { name: "automation.execute", resource: "automation", action: "execute", description: "Manually trigger automations" },
      
      // P1 PRIORITY: Payment Gateways
      { name: "payment_gateways.view", resource: "payment_gateways", action: "view", description: "View configured payment gateways" },
      { name: "payment_gateways.create", resource: "payment_gateways", action: "create", description: "Add payment gateway" },
      { name: "payment_gateways.edit", resource: "payment_gateways", action: "edit", description: "Update gateway credentials" },
      { name: "payment_gateways.delete", resource: "payment_gateways", action: "delete", description: "Remove payment gateway" },
      { name: "payment_gateways.test", resource: "payment_gateways", action: "test", description: "Test gateway connection" },
      
      // P1 PRIORITY: Documents Advanced
      { name: "documents.share", resource: "documents", action: "share", description: "Share documents with clients" },
      { name: "documents.sign", resource: "documents", action: "sign", description: "Sign documents with PKI" },
      { name: "documents.verify", resource: "documents", action: "verify", description: "Verify document signatures" },
      { name: "documents.version", resource: "documents", action: "version", description: "Manage document versions" },
      { name: "documents.approve", resource: "documents", action: "approve", description: "Approve document versions" },
      { name: "documents.download", resource: "documents", action: "download", description: "Download documents" },
      
      // P1 PRIORITY: Reports Advanced
      { name: "reports.create", resource: "reports", action: "create", description: "Create custom reports" },
      { name: "reports.export", resource: "reports", action: "export", description: "Export report data" },
      { name: "reports.schedule", resource: "reports", action: "schedule", description: "Schedule recurring reports" },
      
      // P1 PRIORITY: Workload Analytics
      { name: "workload.view", resource: "workload", action: "view", description: "View team workload analytics" },
      { name: "workload.assign", resource: "workload", action: "assign", description: "Assign capacity and workload" },
      
      // P1 PRIORITY: LLM Configurations
      { name: "llm_configs.view", resource: "llm_configs", action: "view", description: "View LLM configurations" },
      { name: "llm_configs.create", resource: "llm_configs", action: "create", description: "Create LLM configurations" },
      { name: "llm_configs.edit", resource: "llm_configs", action: "edit", description: "Edit LLM credentials" },
      { name: "llm_configs.delete", resource: "llm_configs", action: "delete", description: "Delete LLM configurations" },
      { name: "llm_configs.test", resource: "llm_configs", action: "test", description: "Test LLM connections" },
      
      // P2: Recurring Schedules
      { name: "schedules.view", resource: "schedules", action: "view", description: "View recurring schedules" },
      { name: "schedules.create", resource: "schedules", action: "create", description: "Create recurring schedules" },
      { name: "schedules.edit", resource: "schedules", action: "edit", description: "Edit schedule frequency" },
      { name: "schedules.delete", resource: "schedules", action: "delete", description: "Delete schedules" },
      
      // P2: Timeline & Gantt Views
      { name: "timeline.view", resource: "timeline", action: "view", description: "View project timelines" },
      { name: "timeline.create_milestone", resource: "timeline", action: "create_milestone", description: "Create milestones" },
      { name: "gantt.view", resource: "gantt", action: "view", description: "View Gantt charts" },
      { name: "gantt.edit", resource: "gantt", action: "edit", description: "Edit task schedules in Gantt" },
      
      // P2: Email Integration
      { name: "email.view", resource: "email", action: "view", description: "View connected email accounts" },
      { name: "email.connect", resource: "email", action: "connect", description: "Connect email account via OAuth" },
      { name: "email.disconnect", resource: "email", action: "disconnect", description: "Disconnect email account" },
      { name: "email.send", resource: "email", action: "send", description: "Send emails via integration" },
      
      // P2: Unified Inbox
      { name: "inbox.view", resource: "inbox", action: "view", description: "View unified inbox" },
      { name: "inbox.manage", resource: "inbox", action: "manage", description: "Manage inbox filters and settings" },
      { name: "inbox.archive", resource: "inbox", action: "archive", description: "Archive conversations" },
      
      // P2: Subscriptions
      { name: "subscriptions.view", resource: "subscriptions", action: "view", description: "View subscription plans" },
      { name: "subscriptions.manage", resource: "subscriptions", action: "manage", description: "Manage organization subscription" },
      { name: "subscriptions.billing", resource: "subscriptions", action: "billing", description: "Access billing details" },
      
      // P2: Invoice Advanced
      { name: "invoices.send", resource: "invoices", action: "send", description: "Send invoices to clients" },
      { name: "invoices.void", resource: "invoices", action: "void", description: "Void invoices" },
      { name: "invoices.export", resource: "invoices", action: "export", description: "Export invoice data" },
      
      // P2: Folders
      { name: "folders.view", resource: "folders", action: "view", description: "View folder structure" },
      { name: "folders.create", resource: "folders", action: "create", description: "Create folders" },
      { name: "folders.edit", resource: "folders", action: "edit", description: "Rename and move folders" },
      { name: "folders.delete", resource: "folders", action: "delete", description: "Delete folders" },
      { name: "folders.share", resource: "folders", action: "share", description: "Share folders with clients" },
    ];

    console.log(`📋 Bulk upserting ${permissions.length} permissions...`);
    // Bulk upsert permissions using onConflictDoUpdate
    const chunkSize = 50;
    const allUpserted: any[] = [];
    
    for (let i = 0; i < permissions.length; i += chunkSize) {
      const chunk = permissions.slice(i, i + chunkSize);
      const upserted = await db
        .insert(schema.permissions)
        .values(chunk)
        .onConflictDoUpdate({
          target: schema.permissions.name,
          set: {
            resource: sql`excluded.resource`,
            action: sql`excluded.action`,
            description: sql`excluded.description`,
          },
        })
        .returning();
      allUpserted.push(...upserted);
      console.log(`  ✓ Processed ${Math.min(i + chunkSize, permissions.length)}/${permissions.length} permissions`);
    }
    
    const createdPermissions = allUpserted;
    console.log(`✓ All ${createdPermissions.length} permissions upserted`);

    // Assign permissions to roles using bulk operations
    console.log(`🔐 Assigning permissions to roles using bulk operations...`);
    
    // Fetch all existing role-permission assignments
    const existingRolePerms = await db.select().from(schema.rolePermissions);
    const existingSet = new Set(
      existingRolePerms.map(rp => `${rp.roleId}-${rp.permissionId}`)
    );
    
    // Helper to bulk assign permissions to a role
    async function bulkAssignPermissions(roleId: number, permissions: any[], roleName: string) {
      const newAssignments = permissions
        .filter(p => !existingSet.has(`${roleId}-${p.id}`))
        .map(p => ({ roleId, permissionId: p.id }));
      
      if (newAssignments.length > 0) {
        console.log(`  📝 Assigning ${newAssignments.length} new permissions to ${roleName}...`);
        await db.insert(schema.rolePermissions).values(newAssignments).onConflictDoNothing();
        
        // CRITICAL: Update existingSet to keep in-memory state accurate for subsequent role assignments
        // Without this, Admin/Employee/Client diffing would see stale data from before Super Admin inserts
        for (const assignment of newAssignments) {
          existingSet.add(`${assignment.roleId}-${assignment.permissionId}`);
        }
        
        console.log(`  ✓ ${roleName} permissions assigned`);
      } else {
        console.log(`  ✓ ${roleName} already has all required permissions`);
      }
    }
    
    if (roles.superAdmin) {
      await bulkAssignPermissions(roles.superAdmin.id, createdPermissions, "Super Admin");
    }

    if (roles.admin) {
      const adminPermissions = createdPermissions.filter(p => 
        // Exclude only organization management permissions
        !p.name.startsWith("organizations.")
      );
      await bulkAssignPermissions(roles.admin.id, adminPermissions, "Admin");
    }

    if (roles.employee) {
      // Employee should NOT have workflows.view (team-wide) or reports.view (practice-wide)
      // They can work on their own tasks but not see team/practice statistics
      const employeePermissions = createdPermissions.filter(p =>
        // Document permissions
        (p.resource === "documents" && (p.action === "view" || p.action === "upload" || p.action === "download")) ||
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
        (p.resource === "clients" && p.action === "view") ||
        // Notifications (own only)
        (p.resource === "notifications" && (p.action === "view" || p.action === "read" || p.action === "delete"))
      );
      await bulkAssignPermissions(roles.employee.id, employeePermissions, "Employee");
    }

    if (roles.client) {
      // Client portal access with standardized permissions
      // Clients access their own data through portal features
      const clientPermissions = createdPermissions.filter(p =>
        // Document permissions (view, upload, download own documents)
        (p.resource === "documents" && (p.action === "view" || p.action === "upload" || p.action === "download")) ||
        // Client Portal Access (main portal entry)
        (p.resource === "client_portal" && p.action === "access") ||
        // Action Center (view own pending items)
        (p.resource === "action_center" && p.action === "view") ||
        // Notifications (view, read, delete own notifications)
        (p.resource === "notifications" && (p.action === "view" || p.action === "read" || p.action === "delete")) ||
        // Forms (submit forms sent to them)
        (p.resource === "forms" && p.action === "submit") ||
        // Signatures (sign documents sent to them)
        (p.resource === "signatures" && p.action === "sign")
      );
      await bulkAssignPermissions(roles.client.id, clientPermissions, "Client");
    }
    
    console.log(`✅ All role permissions assigned`);

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
    
    // Initialize Organization Onboarding Service (for auto-provisioning LLM configs)
    const { initializeOnboardingService } = await import("./organization-onboarding-service");
    initializeOnboardingService(storage);

    // Initialize Agent Registry
    console.log("🤖 Initializing AI Agent Foundry...");
    const { agentRegistry } = await import("./agent-registry");
    await agentRegistry.initialize();
    console.log("✅ Agent Foundry initialized successfully");

    // Register agent routes using STATIC registration (bulletproof approach)
    console.log("🔧 Registering agent routes (STATIC METHOD)...");
    try {
      // Import the static agent loader
      const { registerAllAgentRoutes } = await import("./agents-static.js");
      
      const agents = agentRegistry.getAllAgents();
      const agentSlugs = agents.map((a: any) => a.slug);
      
      console.log(`📋 Found ${agentSlugs.length} agents to register routes for`);
      
      registerAllAgentRoutes(agentSlugs, app);
      console.log("✅ Agent route registration complete (STATIC)");
    } catch (error) {
      console.error("❌ Failed to register agent routes:", error);
    }

    // Initialize Recurring Scheduler Service
    console.log("⏰ Initializing recurring scheduler service...");
    try {
      const { getRecurringSchedulerService } = await import("./services/recurringSchedulerService");
      const scheduler = getRecurringSchedulerService();
      scheduler.start(5); // Check every 5 minutes
      console.log("✅ Recurring scheduler service started");
    } catch (error) {
      console.error("❌ Failed to start recurring scheduler:", error);
    }

    console.log("✅ System initialized successfully");
  } catch (error) {
    console.error("❌ System initialization failed:", error);
    // Don't throw - allow server to start even if initialization partially fails
  }
}
