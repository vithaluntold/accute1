import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  Organization,
  InsertOrganization,
  Role,
  InsertRole,
  Permission,
  InsertPermission,
  Workflow,
  InsertWorkflow,
  AiAgent,
  InsertAiAgent,
  Document,
  InsertDocument,
  Notification,
  InsertNotification,
  ActivityLog,
  InsertActivityLog,
  Session,
  RolePermission,
  AiAgentInstallation,
  AiProviderConfig,
  SuperAdminKey,
  InsertSuperAdminKey,
  Invitation,
  InsertInvitation,
  Client,
  InsertClient,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  getUsersByRole(roleId: string): Promise<User[]>;

  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;

  // Roles
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<void>;
  getRolesByOrganization(organizationId: string): Promise<Role[]>;
  getSystemRoles(): Promise<Role[]>;

  // Permissions
  getPermission(id: string): Promise<Permission | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  getAllPermissions(): Promise<Permission[]>;
  getPermissionsByRole(roleId: string): Promise<Permission[]>;
  assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission>;
  removePermissionFromRole(roleId: string, permissionId: string): Promise<void>;

  // Sessions
  createSession(userId: string, token: string, expiresAt: Date): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;

  // Workflows
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<void>;
  getWorkflowsByOrganization(organizationId: string): Promise<Workflow[]>;
  getWorkflowsByUser(userId: string): Promise<Workflow[]>;

  // AI Agents
  getAiAgent(id: string): Promise<AiAgent | undefined>;
  createAiAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: string, agent: Partial<InsertAiAgent>): Promise<AiAgent | undefined>;
  deleteAiAgent(id: string): Promise<void>;
  getAllPublicAiAgents(): Promise<AiAgent[]>;
  getAiAgentsByCategory(category: string): Promise<AiAgent[]>;
  installAiAgent(agentId: string, organizationId: string, userId: string, configuration: any): Promise<AiAgentInstallation>;
  getInstalledAgents(organizationId: string): Promise<AiAgentInstallation[]>;

  // AI Provider Configs
  getAiProviderConfig(organizationId: string, provider: string): Promise<AiProviderConfig | undefined>;
  getAiProviderConfigById(id: string): Promise<AiProviderConfig | undefined>;
  createAiProviderConfig(config: Omit<AiProviderConfig, "id" | "createdAt" | "updatedAt">): Promise<AiProviderConfig>;
  updateAiProviderConfig(id: string, config: Partial<AiProviderConfig>): Promise<AiProviderConfig | undefined>;
  deleteAiProviderConfig(id: string): Promise<void>;
  getActiveProviders(organizationId: string): Promise<AiProviderConfig[]>;

  // Documents
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<void>;
  getDocumentsByOrganization(organizationId: string): Promise<Document[]>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  getDocumentsByWorkflow(workflowId: string): Promise<Document[]>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  deleteNotification(id: string): Promise<void>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByOrganization(organizationId: string, limit?: number): Promise<ActivityLog[]>;
  getActivityLogsByUser(userId: string, limit?: number): Promise<ActivityLog[]>;

  // Super Admin Keys
  createSuperAdminKey(key: InsertSuperAdminKey): Promise<SuperAdminKey>;
  getSuperAdminKeyByHash(keyHash: string): Promise<SuperAdminKey | undefined>;
  markSuperAdminKeyAsUsed(id: string, usedBy: string): Promise<void>;
  revokeSuperAdminKey(id: string): Promise<void>;
  getSuperAdminKeysByUser(userId: string): Promise<SuperAdminKey[]>;

  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(tokenHash: string): Promise<Invitation | undefined>;
  getInvitationById(id: string): Promise<Invitation | undefined>;
  updateInvitationStatus(id: string, status: string, acceptedBy?: string): Promise<void>;
  getInvitationsByOrganization(organizationId: string): Promise<Invitation[]>;
  revokeInvitation(id: string): Promise<void>;

  // Clients
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  getClientsByOrganization(organizationId: string): Promise<Client[]>;
  getClientsByAssignedUser(userId: string): Promise<Client[]>;
  
  // Contacts
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  getContactsByClient(clientId: string): Promise<Contact[]>;
  getContactsByOrganization(organizationId: string): Promise<Contact[]>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(schema.users)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return await db.select().from(schema.users).where(eq(schema.users.organizationId, organizationId));
  }

  async getUsersByRole(roleId: string): Promise<User[]> {
    return await db.select().from(schema.users).where(eq(schema.users.roleId, roleId));
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    return result[0];
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const result = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, slug));
    return result[0];
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const result = await db.insert(schema.organizations).values(org).returning();
    return result[0];
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const result = await db.update(schema.organizations)
      .set({ ...org, updatedAt: new Date() })
      .where(eq(schema.organizations.id, id))
      .returning();
    return result[0];
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(schema.organizations);
  }

  // Roles
  async getRole(id: string): Promise<Role | undefined> {
    const result = await db.select().from(schema.roles).where(eq(schema.roles.id, id));
    return result[0];
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const result = await db.select().from(schema.roles).where(eq(schema.roles.name, name));
    return result[0];
  }

  async createRole(role: InsertRole): Promise<Role> {
    const result = await db.insert(schema.roles).values(role).returning();
    return result[0];
  }

  async updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined> {
    const result = await db.update(schema.roles)
      .set({ ...role, updatedAt: new Date() })
      .where(eq(schema.roles.id, id))
      .returning();
    return result[0];
  }

  async deleteRole(id: string): Promise<void> {
    await db.delete(schema.roles).where(eq(schema.roles.id, id));
  }

  async getRolesByOrganization(organizationId: string): Promise<Role[]> {
    return await db.select().from(schema.roles).where(eq(schema.roles.organizationId, organizationId));
  }

  async getSystemRoles(): Promise<Role[]> {
    return await db.select().from(schema.roles).where(eq(schema.roles.isSystemRole, true));
  }

  // Permissions
  async getPermission(id: string): Promise<Permission | undefined> {
    const result = await db.select().from(schema.permissions).where(eq(schema.permissions.id, id));
    return result[0];
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const result = await db.insert(schema.permissions).values(permission).returning();
    return result[0];
  }

  async getAllPermissions(): Promise<Permission[]> {
    return await db.select().from(schema.permissions);
  }

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    const result = await db
      .select({ permission: schema.permissions })
      .from(schema.rolePermissions)
      .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(eq(schema.rolePermissions.roleId, roleId));
    return result.map(r => r.permission);
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const result = await db.insert(schema.rolePermissions).values({ roleId, permissionId }).returning();
    return result[0];
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await db.delete(schema.rolePermissions)
      .where(and(
        eq(schema.rolePermissions.roleId, roleId),
        eq(schema.rolePermissions.permissionId, permissionId)
      ));
  }

  // Sessions
  async createSession(userId: string, token: string, expiresAt: Date): Promise<Session> {
    const result = await db.insert(schema.sessions).values({ userId, token, expiresAt }).returning();
    return result[0];
  }

  async getSession(token: string): Promise<Session | undefined> {
    const result = await db.select().from(schema.sessions).where(eq(schema.sessions.token, token));
    return result[0];
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }

  // Workflows
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const result = await db.select().from(schema.workflows).where(eq(schema.workflows.id, id));
    return result[0];
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const result = await db.insert(schema.workflows).values(workflow).returning();
    return result[0];
  }

  async updateWorkflow(id: string, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const result = await db.update(schema.workflows)
      .set({ ...workflow, updatedAt: new Date() })
      .where(eq(schema.workflows.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkflow(id: string): Promise<void> {
    await db.delete(schema.workflows).where(eq(schema.workflows.id, id));
  }

  async getWorkflowsByOrganization(organizationId: string): Promise<Workflow[]> {
    return await db.select().from(schema.workflows)
      .where(eq(schema.workflows.organizationId, organizationId))
      .orderBy(desc(schema.workflows.updatedAt));
  }

  async getWorkflowsByUser(userId: string): Promise<Workflow[]> {
    return await db.select().from(schema.workflows)
      .where(eq(schema.workflows.createdBy, userId))
      .orderBy(desc(schema.workflows.updatedAt));
  }

  // AI Agents
  async getAiAgent(id: string): Promise<AiAgent | undefined> {
    const result = await db.select().from(schema.aiAgents).where(eq(schema.aiAgents.id, id));
    return result[0];
  }

  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const result = await db.insert(schema.aiAgents).values(agent).returning();
    return result[0];
  }

  async updateAiAgent(id: string, agent: Partial<InsertAiAgent>): Promise<AiAgent | undefined> {
    const result = await db.update(schema.aiAgents)
      .set({ ...agent, updatedAt: new Date() })
      .where(eq(schema.aiAgents.id, id))
      .returning();
    return result[0];
  }

  async deleteAiAgent(id: string): Promise<void> {
    await db.delete(schema.aiAgents).where(eq(schema.aiAgents.id, id));
  }

  async getAllPublicAiAgents(): Promise<AiAgent[]> {
    return await db.select().from(schema.aiAgents)
      .where(eq(schema.aiAgents.isPublic, true))
      .orderBy(desc(schema.aiAgents.rating));
  }

  async getAiAgentsByCategory(category: string): Promise<AiAgent[]> {
    return await db.select().from(schema.aiAgents)
      .where(and(
        eq(schema.aiAgents.isPublic, true),
        eq(schema.aiAgents.category, category)
      ))
      .orderBy(desc(schema.aiAgents.rating));
  }

  async installAiAgent(agentId: string, organizationId: string, userId: string, configuration: any): Promise<AiAgentInstallation> {
    const result = await db.insert(schema.aiAgentInstallations).values({
      agentId,
      organizationId,
      installedBy: userId,
      configuration,
    }).returning();

    await db.update(schema.aiAgents)
      .set({ installCount: db.$count(schema.aiAgentInstallations) })
      .where(eq(schema.aiAgents.id, agentId));

    return result[0];
  }

  async getInstalledAgents(organizationId: string): Promise<AiAgentInstallation[]> {
    return await db.select().from(schema.aiAgentInstallations)
      .where(eq(schema.aiAgentInstallations.organizationId, organizationId));
  }

  // AI Provider Configs
  async getAiProviderConfig(organizationId: string, provider: string): Promise<AiProviderConfig | undefined> {
    const result = await db.select().from(schema.aiProviderConfigs)
      .where(and(
        eq(schema.aiProviderConfigs.organizationId, organizationId),
        eq(schema.aiProviderConfigs.provider, provider)
      ));
    return result[0];
  }

  async getAiProviderConfigById(id: string): Promise<AiProviderConfig | undefined> {
    const result = await db.select().from(schema.aiProviderConfigs).where(eq(schema.aiProviderConfigs.id, id));
    return result[0];
  }

  async createAiProviderConfig(config: Omit<AiProviderConfig, "id" | "createdAt" | "updatedAt">): Promise<AiProviderConfig> {
    const result = await db.insert(schema.aiProviderConfigs).values(config).returning();
    return result[0];
  }

  async updateAiProviderConfig(id: string, config: Partial<AiProviderConfig>): Promise<AiProviderConfig | undefined> {
    const result = await db.update(schema.aiProviderConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(schema.aiProviderConfigs.id, id))
      .returning();
    return result[0];
  }

  async deleteAiProviderConfig(id: string): Promise<void> {
    await db.delete(schema.aiProviderConfigs).where(eq(schema.aiProviderConfigs.id, id));
  }

  async getActiveProviders(organizationId: string): Promise<AiProviderConfig[]> {
    return await db.select().from(schema.aiProviderConfigs)
      .where(and(
        eq(schema.aiProviderConfigs.organizationId, organizationId),
        eq(schema.aiProviderConfigs.isActive, true)
      ))
      .orderBy(desc(schema.aiProviderConfigs.priority));
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    return result[0];
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const result = await db.insert(schema.documents).values(document).returning();
    return result[0];
  }

  async updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document | undefined> {
    const result = await db.update(schema.documents)
      .set({ ...document, updatedAt: new Date() })
      .where(eq(schema.documents.id, id))
      .returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(schema.documents).where(eq(schema.documents.id, id));
  }

  async getDocumentsByOrganization(organizationId: string): Promise<Document[]> {
    return await db.select().from(schema.documents)
      .where(eq(schema.documents.organizationId, organizationId))
      .orderBy(desc(schema.documents.createdAt));
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return await db.select().from(schema.documents)
      .where(eq(schema.documents.uploadedBy, userId))
      .orderBy(desc(schema.documents.createdAt));
  }

  async getDocumentsByWorkflow(workflowId: string): Promise<Document[]> {
    return await db.select().from(schema.documents)
      .where(eq(schema.documents.workflowId, workflowId))
      .orderBy(desc(schema.documents.createdAt));
  }

  // Notifications
  async getNotification(id: string): Promise<Notification | undefined> {
    const result = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
    return result[0];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(schema.notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, id));
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(schema.activityLogs).values(log).returning();
    return result[0];
  }

  async getActivityLogsByOrganization(organizationId: string, limit: number = 100): Promise<ActivityLog[]> {
    return await db.select().from(schema.activityLogs)
      .where(eq(schema.activityLogs.organizationId, organizationId))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);
  }

  async getActivityLogsByUser(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return await db.select().from(schema.activityLogs)
      .where(eq(schema.activityLogs.userId, userId))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);
  }

  // Super Admin Keys
  async createSuperAdminKey(key: InsertSuperAdminKey): Promise<SuperAdminKey> {
    const result = await db.insert(schema.superAdminKeys).values(key).returning();
    return result[0];
  }

  async getSuperAdminKeyByHash(keyHash: string): Promise<SuperAdminKey | undefined> {
    const result = await db.select().from(schema.superAdminKeys)
      .where(eq(schema.superAdminKeys.keyHash, keyHash));
    return result[0];
  }

  async markSuperAdminKeyAsUsed(id: string, usedBy: string): Promise<void> {
    await db.update(schema.superAdminKeys)
      .set({ usedBy, usedAt: new Date() })
      .where(eq(schema.superAdminKeys.id, id));
  }

  async revokeSuperAdminKey(id: string): Promise<void> {
    await db.update(schema.superAdminKeys)
      .set({ revokedAt: new Date() })
      .where(eq(schema.superAdminKeys.id, id));
  }

  async getSuperAdminKeysByUser(userId: string): Promise<SuperAdminKey[]> {
    return await db.select().from(schema.superAdminKeys)
      .where(eq(schema.superAdminKeys.generatedBy, userId))
      .orderBy(desc(schema.superAdminKeys.createdAt));
  }

  // Invitations
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const result = await db.insert(schema.invitations).values(invitation).returning();
    return result[0];
  }

  async getInvitationByToken(tokenHash: string): Promise<Invitation | undefined> {
    const result = await db.select().from(schema.invitations)
      .where(eq(schema.invitations.tokenHash, tokenHash));
    return result[0];
  }

  async getInvitationById(id: string): Promise<Invitation | undefined> {
    const result = await db.select().from(schema.invitations)
      .where(eq(schema.invitations.id, id));
    return result[0];
  }

  async updateInvitationStatus(id: string, status: string, acceptedBy?: string): Promise<void> {
    const updateData: any = { status };
    if (status === "accepted" && acceptedBy) {
      updateData.acceptedBy = acceptedBy;
      updateData.acceptedAt = new Date();
    }
    await db.update(schema.invitations)
      .set(updateData)
      .where(eq(schema.invitations.id, id));
  }

  async getInvitationsByOrganization(organizationId: string): Promise<Invitation[]> {
    return await db.select().from(schema.invitations)
      .where(eq(schema.invitations.organizationId, organizationId))
      .orderBy(desc(schema.invitations.createdAt));
  }

  async revokeInvitation(id: string): Promise<void> {
    await db.update(schema.invitations)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(schema.invitations.id, id));
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const results = await db.select().from(schema.clients)
      .where(eq(schema.clients.id, id));
    return results[0];
  }

  async createClient(client: InsertClient): Promise<Client> {
    const results = await db.insert(schema.clients)
      .values(client)
      .returning();
    return results[0];
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const results = await db.update(schema.clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(schema.clients.id, id))
      .returning();
    return results[0];
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(schema.clients)
      .where(eq(schema.clients.id, id));
  }

  async getClientsByOrganization(organizationId: string): Promise<Client[]> {
    return await db.select().from(schema.clients)
      .where(eq(schema.clients.organizationId, organizationId))
      .orderBy(schema.clients.companyName);
  }

  async getClientsByAssignedUser(userId: string): Promise<Client[]> {
    return await db.select().from(schema.clients)
      .where(eq(schema.clients.assignedTo, userId))
      .orderBy(schema.clients.companyName);
  }

  // Contacts
  async getContact(id: string): Promise<Contact | undefined> {
    const result = await db.select().from(schema.contacts).where(eq(schema.contacts.id, id));
    return result[0];
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const result = await db.insert(schema.contacts).values(contact).returning();
    return result[0];
  }

  async updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact> {
    const result = await db.update(schema.contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(schema.contacts.id, id))
      .returning();
    return result[0];
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  }

  async getContactsByClient(clientId: string): Promise<Contact[]> {
    return await db.select().from(schema.contacts)
      .where(eq(schema.contacts.clientId, clientId))
      .orderBy(schema.contacts.lastName, schema.contacts.firstName);
  }

  async getContactsByOrganization(organizationId: string): Promise<Contact[]> {
    return await db.select().from(schema.contacts)
      .where(eq(schema.contacts.organizationId, organizationId))
      .orderBy(schema.contacts.lastName, schema.contacts.firstName);
  }
}

export const storage = new DbStorage();
