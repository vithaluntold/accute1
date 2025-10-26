import { db } from "./db";
import * as schema from "@shared/schema";

async function seed() {
  try {
    console.log("🌱 Seeding database...");

    // Create system roles
    const superAdminRole = await db.insert(schema.roles).values({
      name: "Super Admin",
      description: "Full system access with organization management",
      isSystemRole: true,
    }).returning().then(r => r[0]);

    const adminRole = await db.insert(schema.roles).values({
      name: "Admin",
      description: "Organization administrator with team management",
      isSystemRole: true,
    }).returning().then(r => r[0]);

    const employeeRole = await db.insert(schema.roles).values({
      name: "Employee",
      description: "Team member with workflow execution access",
      isSystemRole: true,
    }).returning().then(r => r[0]);

    const clientRole = await db.insert(schema.roles).values({
      name: "Client",
      description: "Client with portal access for documents and workflow status",
      isSystemRole: true,
    }).returning().then(r => r[0]);

    console.log("✓ Created system roles");

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
      
      // AI Agent management
      { name: "ai_agents.view", resource: "ai_agents", action: "view", description: "View AI agents" },
      { name: "ai_agents.install", resource: "ai_agents", action: "install", description: "Install AI agents" },
      { name: "ai_agents.configure", resource: "ai_agents", action: "configure", description: "Configure AI agents" },
      { name: "ai_agents.create", resource: "ai_agents", action: "create", description: "Create AI agents" },
      
      // Document management
      { name: "documents.view", resource: "documents", action: "view", description: "View documents" },
      { name: "documents.upload", resource: "documents", action: "upload", description: "Upload documents" },
      { name: "documents.delete", resource: "documents", action: "delete", description: "Delete documents" },
      
      // Organization management
      { name: "organizations.view", resource: "organizations", action: "view", description: "View organizations" },
      { name: "organizations.edit", resource: "organizations", action: "edit", description: "Edit organizations" },
      
      // Analytics
      { name: "analytics.view", resource: "analytics", action: "view", description: "View analytics" },
    ];

    const createdPermissions: any[] = [];
    for (const perm of permissions) {
      const created = await db.insert(schema.permissions).values(perm).returning();
      createdPermissions.push(created[0]);
    }

    console.log("✓ Created permissions");

    // Assign permissions to Super Admin (all permissions)
    for (const perm of createdPermissions) {
      await db.insert(schema.rolePermissions).values({
        roleId: superAdminRole.id,
        permissionId: perm.id,
      });
    }

    // Assign permissions to Admin
    const adminPermissions = createdPermissions.filter(p => 
      !p.name.startsWith("organizations.") &&
      !p.name.includes("delete")
    );
    for (const perm of adminPermissions) {
      await db.insert(schema.rolePermissions).values({
        roleId: adminRole.id,
        permissionId: perm.id,
      });
    }

    // Assign permissions to Employee
    const employeePermissions = createdPermissions.filter(p =>
      p.name.includes("view") ||
      p.name.includes("execute") ||
      p.name.includes("upload") ||
      p.name === "workflows.create" ||
      p.name === "workflows.edit"
    );
    for (const perm of employeePermissions) {
      await db.insert(schema.rolePermissions).values({
        roleId: employeeRole.id,
        permissionId: perm.id,
      });
    }

    // Assign permissions to Client
    const clientPermissions = createdPermissions.filter(p =>
      p.resource === "documents" ||
      (p.resource === "workflows" && p.action === "view")
    );
    for (const perm of clientPermissions) {
      await db.insert(schema.rolePermissions).values({
        roleId: clientRole.id,
        permissionId: perm.id,
      });
    }

    console.log("✓ Assigned permissions to roles");

    // Create sample AI agents
    const sampleAgents = [
      {
        name: "Invoice Processor",
        description: "Automatically extracts data from invoices and categorizes expenses",
        provider: "openai",
        category: "invoicing",
        capabilities: ["data_extraction", "categorization", "validation"],
        configuration: { model: "gpt-4", temperature: 0.2 },
        rating: 5,
        isPublic: true,
      },
      {
        name: "Tax Compliance Advisor",
        description: "Provides real-time tax compliance recommendations based on regulations",
        provider: "anthropic",
        category: "tax_filing",
        capabilities: ["compliance_check", "regulation_lookup", "recommendation"],
        configuration: { model: "claude-3-5-sonnet-20241022", temperature: 0.3 },
        rating: 5,
        isPublic: true,
      },
      {
        name: "Reconciliation Assistant",
        description: "Matches transactions across accounts and identifies discrepancies",
        provider: "azure_openai",
        category: "reconciliation",
        capabilities: ["transaction_matching", "discrepancy_detection", "reporting"],
        configuration: { model: "gpt-4", temperature: 0.1 },
        rating: 4,
        isPublic: true,
      },
    ];

    for (const agent of sampleAgents) {
      await db.insert(schema.aiAgents).values(agent);
    }

    console.log("✓ Created sample AI agents");

    console.log("✅ Database seeded successfully");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
