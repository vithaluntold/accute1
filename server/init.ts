import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export async function initializeSystem() {
  try {
    console.log("🔧 Initializing system...");

    // Check if system roles exist
    const existingRoles = await db.select().from(schema.roles).where(eq(schema.roles.isSystemRole, true));
    
    if (existingRoles.length >= 4) {
      console.log("✓ System roles already initialized");
      return;
    }

    console.log("📝 Creating system roles and permissions...");

    // Create system roles
    const roles = {
      superAdmin: await db.insert(schema.roles).values({
        name: "Super Admin",
        description: "Full system access with organization management",
        isSystemRole: true,
      }).returning().then(r => r[0]).catch(() => null),

      admin: await db.insert(schema.roles).values({
        name: "Admin",
        description: "Organization administrator with team management",
        isSystemRole: true,
      }).returning().then(r => r[0]).catch(() => null),

      employee: await db.insert(schema.roles).values({
        name: "Employee",
        description: "Team member with workflow execution access",
        isSystemRole: true,
      }).returning().then(r => r[0]).catch(() => null),

      client: await db.insert(schema.roles).values({
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
      
      // AI Agent management
      { name: "ai_agents.view", resource: "ai_agents", action: "view", description: "View AI agents" },
      { name: "ai_agents.install", resource: "ai_agents", action: "install", description: "Install AI agents" },
      { name: "ai_agents.configure", resource: "ai_agents", action: "configure", description: "Configure AI agents" },
      { name: "ai_agents.create", resource: "ai_agents", action: "create", description: "Create AI agents" },
      
      // Document management
      { name: "documents.view", resource: "documents", action: "view", description: "View documents" },
      { name: "documents.upload", resource: "documents", action: "upload", description: "Upload documents" },
      { name: "documents.delete", resource: "documents", action: "delete", description: "Delete documents" },
      
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
        !p.name.startsWith("organizations.") &&
        !p.name.includes("delete")
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
      const employeePermissions = createdPermissions.filter(p =>
        p.name.includes("view") ||
        p.name.includes("execute") ||
        p.name.includes("upload") ||
        p.name === "workflows.create" ||
        p.name === "workflows.edit"
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
      const clientPermissions = createdPermissions.filter(p =>
        p.resource === "documents" ||
        (p.resource === "workflows" && p.action === "view")
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

    console.log("✅ System initialized successfully");
  } catch (error) {
    console.error("❌ System initialization failed:", error);
    // Don't throw - allow server to start even if initialization partially fails
  }
}
