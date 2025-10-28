import { eq, and, or, desc, sql } from "drizzle-orm";
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
  Contact,
  InsertContact,
  Tag,
  InsertTag,
  Taggable,
  InsertTaggable,
  FormTemplate,
  InsertFormTemplate,
  FormSubmission,
  InsertFormSubmission,
  FormShareLink,
  InsertFormShareLink,
  DocumentRequest,
  InsertDocumentRequest,
  RequiredDocument,
  InsertRequiredDocument,
  DocumentSubmission as DocSubmission,
  InsertDocumentSubmission,
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
  getPlatformRoles(): Promise<Role[]>;
  getTenantRoles(organizationId?: string): Promise<Role[]>;

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
  getInstalledAgents(organizationId: string): Promise<schema.InstalledAgentView[]>;

  // AI Provider Configs
  getAiProviderConfig(organizationId: string, provider: string): Promise<AiProviderConfig | undefined>;
  getAiProviderConfigById(id: string): Promise<AiProviderConfig | undefined>;
  createAiProviderConfig(config: Omit<AiProviderConfig, "id" | "createdAt" | "updatedAt">): Promise<AiProviderConfig>;
  updateAiProviderConfig(id: string, config: Partial<AiProviderConfig>): Promise<AiProviderConfig | undefined>;
  deleteAiProviderConfig(id: string): Promise<void>;
  getActiveProviders(organizationId: string): Promise<AiProviderConfig[]>;

  // AI Agent Conversations
  createAiConversation(conversation: schema.InsertAiAgentConversation): Promise<schema.AiAgentConversation>;
  getAiConversation(id: string): Promise<schema.AiAgentConversation | undefined>;
  getAiConversationsByUser(userId: string, agentName?: string): Promise<schema.AiAgentConversation[]>;
  getAiConversationByContext(contextType: string, contextId: string, userId: string, agentName: string): Promise<schema.AiAgentConversation | undefined>;
  updateAiConversationTitle(id: string, title: string): Promise<void>;
  closeAiConversation(id: string): Promise<void>;
  
  // AI Agent Messages
  createAiMessage(message: schema.InsertAiAgentMessage): Promise<schema.AiAgentMessage>;
  getAiMessagesByConversation(conversationId: string): Promise<schema.AiAgentMessage[]>;
  updateAiMessageWithToolExecutions(id: string, toolExecutions: any[]): Promise<void>;

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
  
  // Tags
  getTag(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag & { organizationId: string; createdBy: string }): Promise<Tag>;
  updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  getTagsByOrganization(organizationId: string): Promise<Tag[]>;
  
  // Taggables
  addTag(taggable: InsertTaggable): Promise<Taggable>;
  removeTag(tagId: string, taggableType: string, taggableId: string): Promise<void>;
  getTagsForResource(taggableType: string, taggableId: string): Promise<Tag[]>;
  getResourcesByTag(tagId: string, taggableType: string): Promise<string[]>;

  // Form Templates
  getFormTemplate(id: string): Promise<FormTemplate | undefined>;
  createFormTemplate(template: InsertFormTemplate & { organizationId: string; createdBy: string }): Promise<FormTemplate>;
  updateFormTemplate(id: string, template: Partial<InsertFormTemplate>): Promise<FormTemplate | undefined>;
  deleteFormTemplate(id: string): Promise<void>;
  getFormTemplatesByOrganization(organizationId: string): Promise<FormTemplate[]>;
  publishFormTemplate(id: string): Promise<FormTemplate | undefined>;

  // Form Submissions
  getFormSubmission(id: string): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission & { organizationId: string }): Promise<FormSubmission>;
  updateFormSubmission(id: string, submission: Partial<InsertFormSubmission>): Promise<FormSubmission | undefined>;
  getFormSubmissionsByTemplate(formTemplateId: string): Promise<FormSubmission[]>;
  getFormSubmissionsByClient(clientId: string): Promise<FormSubmission[]>;
  getFormSubmissionsByOrganization(organizationId: string): Promise<FormSubmission[]>;
  reviewFormSubmission(id: string, reviewedBy: string, status: string, reviewNotes?: string): Promise<FormSubmission | undefined>;

  // Form Share Links
  createFormShareLink(data: InsertFormShareLink & { organizationId: string; createdBy: string }): Promise<FormShareLink>;
  getFormShareLink(id: string): Promise<FormShareLink | undefined>;
  getFormShareLinkByToken(token: string): Promise<FormShareLink | undefined>;
  getFormShareLinksByForm(formTemplateId: string): Promise<FormShareLink[]>;
  updateFormShareLink(id: string, data: Partial<InsertFormShareLink>): Promise<FormShareLink | undefined>;
  deleteFormShareLink(id: string): Promise<void>;
  incrementShareLinkView(shareToken: string): Promise<void>;
  incrementShareLinkSubmission(shareToken: string): Promise<void>;

  // Submission Notes
  addSubmissionNote(submissionId: string, userId: string, note: string): Promise<schema.SubmissionNote>;
  getSubmissionNotes(submissionId: string): Promise<Array<schema.SubmissionNote & { user: User }>>;

  // Revision Requests
  createRevisionRequest(submissionId: string, requestedBy: string, fieldsToRevise: any): Promise<schema.RevisionRequest>;
  getRevisionRequests(submissionId: string): Promise<Array<schema.RevisionRequest & { requestedByUser: User }>>;
  assignSubmissionReviewer(id: string, reviewerId: string): Promise<FormSubmission | undefined>;

  // Document Requests
  createDocumentRequest(request: InsertDocumentRequest & { organizationId: string; createdBy: string }): Promise<DocumentRequest>;
  getDocumentRequest(id: string): Promise<DocumentRequest | undefined>;
  getDocumentRequestsByOrganization(organizationId: string): Promise<DocumentRequest[]>;
  getDocumentRequestsByClient(clientId: string): Promise<DocumentRequest[]>;
  updateDocumentRequest(id: string, request: Partial<InsertDocumentRequest>): Promise<DocumentRequest | undefined>;
  deleteDocumentRequest(id: string): Promise<void>;

  // Required Documents
  createRequiredDocument(doc: InsertRequiredDocument): Promise<RequiredDocument>;
  getRequiredDocument(id: string): Promise<RequiredDocument | undefined>;
  getRequiredDocumentsByRequest(requestId: string): Promise<RequiredDocument[]>;
  updateRequiredDocument(id: string, doc: Partial<InsertRequiredDocument>): Promise<RequiredDocument | undefined>;
  deleteRequiredDocument(id: string): Promise<void>;

  // Document Submissions
  createDocumentSubmission(submission: InsertDocumentSubmission): Promise<DocSubmission>;
  getDocumentSubmission(id: string): Promise<DocSubmission | undefined>;
  getDocumentSubmissionsByRequiredDoc(requiredDocumentId: string): Promise<DocSubmission[]>;
  reviewDocumentSubmission(id: string, reviewedBy: string, status: string, reviewNotes?: string): Promise<DocSubmission | undefined>;

  // TaxDome Features - Secure Messaging
  createConversation(conversation: schema.InsertConversation): Promise<schema.Conversation>;
  getConversation(id: string): Promise<schema.Conversation | undefined>;
  getConversationsByOrganization(organizationId: string): Promise<schema.Conversation[]>;
  getConversationsByClient(clientId: string): Promise<schema.Conversation[]>;
  updateConversation(id: string, conversation: Partial<schema.InsertConversation>): Promise<schema.Conversation | undefined>;
  createMessage(message: schema.InsertMessage): Promise<schema.Message>;
  getMessage(id: string): Promise<schema.Message | undefined>;
  getMessagesByConversation(conversationId: string): Promise<schema.Message[]>;
  markMessageAsRead(id: string): Promise<void>;

  // TaxDome Features - Time Tracking & Billing
  createTimeEntry(entry: schema.InsertTimeEntry): Promise<schema.TimeEntry>;
  getTimeEntry(id: string): Promise<schema.TimeEntry | undefined>;
  getTimeEntriesByOrganization(organizationId: string): Promise<schema.TimeEntry[]>;
  getTimeEntriesByUser(userId: string): Promise<schema.TimeEntry[]>;
  getTimeEntriesByClient(clientId: string): Promise<schema.TimeEntry[]>;
  updateTimeEntry(id: string, entry: Partial<schema.InsertTimeEntry>): Promise<schema.TimeEntry | undefined>;
  deleteTimeEntry(id: string): Promise<void>;
  
  createInvoice(invoice: schema.InsertInvoice): Promise<schema.Invoice>;
  getInvoice(id: string): Promise<schema.Invoice | undefined>;
  getInvoicesByOrganization(organizationId: string): Promise<schema.Invoice[]>;
  getInvoicesByClient(clientId: string): Promise<schema.Invoice[]>;
  updateInvoice(id: string, invoice: Partial<schema.InsertInvoice>): Promise<schema.Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;
  
  createInvoiceItem(item: schema.InsertInvoiceItem): Promise<schema.InvoiceItem>;
  getInvoiceItemsByInvoice(invoiceId: string): Promise<schema.InvoiceItem[]>;
  deleteInvoiceItem(id: string): Promise<void>;
  
  createPayment(payment: schema.InsertPayment): Promise<schema.Payment>;
  getPayment(id: string): Promise<schema.Payment | undefined>;
  getPaymentsByInvoice(invoiceId: string): Promise<schema.Payment[]>;
  getPaymentsByClient(clientId: string): Promise<schema.Payment[]>;
  updatePayment(id: string, payment: Partial<schema.InsertPayment>): Promise<schema.Payment | undefined>;
  
  createExpense(expense: schema.InsertExpense): Promise<schema.Expense>;
  getExpense(id: string): Promise<schema.Expense | undefined>;
  getExpensesByOrganization(organizationId: string): Promise<schema.Expense[]>;
  getExpensesByUser(userId: string): Promise<schema.Expense[]>;
  updateExpense(id: string, expense: Partial<schema.InsertExpense>): Promise<schema.Expense | undefined>;
  deleteExpense(id: string): Promise<void>;

  // TaxDome Features - E-Signatures
  createSignatureRequest(request: schema.InsertSignatureRequest): Promise<schema.SignatureRequest>;
  getSignatureRequest(id: string): Promise<schema.SignatureRequest | undefined>;
  getSignatureRequestsByOrganization(organizationId: string): Promise<schema.SignatureRequest[]>;
  getSignatureRequestsByClient(clientId: string): Promise<schema.SignatureRequest[]>;
  updateSignatureRequest(id: string, request: Partial<schema.InsertSignatureRequest>): Promise<schema.SignatureRequest | undefined>;
  signDocument(id: string, signedBy: string, signatureData: string, ipAddress: string, userAgent: string): Promise<schema.SignatureRequest | undefined>;

  // TaxDome Features - Projects & Kanban
  createProject(project: schema.InsertProject): Promise<schema.Project>;
  getProject(id: string): Promise<schema.Project | undefined>;
  getProjectsByOrganization(organizationId: string): Promise<schema.Project[]>;
  getProjectsByClient(clientId: string): Promise<schema.Project[]>;
  updateProject(id: string, project: Partial<schema.InsertProject>): Promise<schema.Project | undefined>;
  deleteProject(id: string): Promise<void>;
  
  createProjectTask(task: schema.InsertProjectTask): Promise<schema.ProjectTask>;
  getProjectTask(id: string): Promise<schema.ProjectTask | undefined>;
  getProjectTasksByProject(projectId: string): Promise<schema.ProjectTask[]>;
  updateProjectTask(id: string, task: Partial<schema.InsertProjectTask>): Promise<schema.ProjectTask | undefined>;
  deleteProjectTask(id: string): Promise<void>;

  // TaxDome Features - Team Chat
  createChatChannel(channel: schema.InsertChatChannel): Promise<schema.ChatChannel>;
  getChatChannel(id: string): Promise<schema.ChatChannel | undefined>;
  getChatChannelsByOrganization(organizationId: string): Promise<schema.ChatChannel[]>;
  updateChatChannel(id: string, channel: Partial<schema.InsertChatChannel>): Promise<schema.ChatChannel | undefined>;
  deleteChatChannel(id: string): Promise<void>;
  
  addChatMember(member: schema.InsertChatMember): Promise<schema.ChatMember>;
  getChatMembersByChannel(channelId: string): Promise<schema.ChatMember[]>;
  removeChatMember(channelId: string, userId: string): Promise<void>;
  updateLastRead(channelId: string, userId: string): Promise<void>;
  
  createChatMessage(message: schema.InsertChatMessage): Promise<schema.ChatMessage>;
  getChatMessage(id: string): Promise<schema.ChatMessage | undefined>;
  getChatMessagesByChannel(channelId: string): Promise<schema.ChatMessage[]>;
  updateChatMessage(id: string, content: string): Promise<schema.ChatMessage | undefined>;
  deleteChatMessage(id: string): Promise<void>;

  // TaxDome Features - Calendar & Appointments
  createAppointment(appointment: schema.InsertAppointment): Promise<schema.Appointment>;
  getAppointment(id: string): Promise<schema.Appointment | undefined>;
  getAppointmentsByOrganization(organizationId: string): Promise<schema.Appointment[]>;
  getAppointmentsByClient(clientId: string): Promise<schema.Appointment[]>;
  getAppointmentsByUser(userId: string): Promise<schema.Appointment[]>;
  updateAppointment(id: string, appointment: Partial<schema.InsertAppointment>): Promise<schema.Appointment | undefined>;
  deleteAppointment(id: string): Promise<void>;

  // TaxDome Features - Email Templates
  createEmailTemplate(template: schema.InsertEmailTemplate): Promise<schema.EmailTemplate>;
  getEmailTemplate(id: string): Promise<schema.EmailTemplate | undefined>;
  getEmailTemplatesByOrganization(organizationId: string): Promise<schema.EmailTemplate[]>;
  updateEmailTemplate(id: string, template: Partial<schema.InsertEmailTemplate>): Promise<schema.EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<void>;

  // TaxDome Features - PDF Annotations
  createDocumentAnnotation(annotation: schema.InsertDocumentAnnotation): Promise<schema.DocumentAnnotation>;
  getDocumentAnnotation(id: string): Promise<schema.DocumentAnnotation | undefined>;
  getDocumentAnnotationsByDocument(documentId: string): Promise<schema.DocumentAnnotation[]>;
  updateDocumentAnnotation(id: string, annotation: Partial<schema.InsertDocumentAnnotation>): Promise<schema.DocumentAnnotation | undefined>;
  deleteDocumentAnnotation(id: string): Promise<void>;
  resolveAnnotation(id: string, resolvedBy: string): Promise<schema.DocumentAnnotation | undefined>;

  // Workflow Stages - Hierarchical structure within workflows
  createWorkflowStage(stage: schema.InsertWorkflowStage): Promise<schema.WorkflowStage>;
  getWorkflowStage(id: string): Promise<schema.WorkflowStage | undefined>;
  getStagesByWorkflow(workflowId: string): Promise<schema.WorkflowStage[]>;
  updateWorkflowStage(id: string, stage: Partial<schema.InsertWorkflowStage>): Promise<schema.WorkflowStage | undefined>;
  deleteWorkflowStage(id: string): Promise<void>;

  // Workflow Steps - Within each stage
  createWorkflowStep(step: schema.InsertWorkflowStep): Promise<schema.WorkflowStep>;
  getWorkflowStep(id: string): Promise<schema.WorkflowStep | undefined>;
  getStepsByStage(stageId: string): Promise<schema.WorkflowStep[]>;
  updateWorkflowStep(id: string, step: Partial<schema.InsertWorkflowStep>): Promise<schema.WorkflowStep | undefined>;
  deleteWorkflowStep(id: string): Promise<void>;

  // Workflow Tasks - Individual work items
  createWorkflowTask(task: schema.InsertWorkflowTask): Promise<schema.WorkflowTask>;
  getWorkflowTask(id: string): Promise<schema.WorkflowTask | undefined>;
  getTasksByStep(stepId: string): Promise<schema.WorkflowTask[]>;
  updateWorkflowTask(id: string, task: Partial<schema.InsertWorkflowTask>): Promise<schema.WorkflowTask | undefined>;
  deleteWorkflowTask(id: string): Promise<void>;
  assignTask(taskId: string, userId: string): Promise<schema.WorkflowTask | undefined>;
  completeTask(taskId: string, userId: string): Promise<schema.WorkflowTask | undefined>;

  // Task Subtasks
  createTaskSubtask(subtask: schema.InsertTaskSubtask): Promise<schema.TaskSubtask>;
  getTaskSubtask(id: string): Promise<schema.TaskSubtask | undefined>;
  getSubtasksByTask(taskId: string): Promise<schema.TaskSubtask[]>;
  updateTaskSubtask(id: string, subtask: Partial<schema.InsertTaskSubtask>): Promise<schema.TaskSubtask | undefined>;
  deleteTaskSubtask(id: string): Promise<void>;
  completeSubtask(subtaskId: string, userId: string): Promise<schema.TaskSubtask | undefined>;

  // Task Checklists
  createTaskChecklist(checklist: schema.InsertTaskChecklist): Promise<schema.TaskChecklist>;
  getTaskChecklist(id: string): Promise<schema.TaskChecklist | undefined>;
  getChecklistsByTask(taskId: string): Promise<schema.TaskChecklist[]>;
  updateTaskChecklist(id: string, checklist: Partial<schema.InsertTaskChecklist>): Promise<schema.TaskChecklist | undefined>;
  deleteTaskChecklist(id: string): Promise<void>;
  toggleChecklistItem(id: string, userId: string): Promise<schema.TaskChecklist | undefined>;

  // LLM Configurations
  createLlmConfiguration(config: schema.InsertLlmConfiguration): Promise<schema.LlmConfiguration>;
  getLlmConfiguration(id: string): Promise<schema.LlmConfiguration | undefined>;
  getLlmConfigurationsByOrganization(organizationId: string): Promise<schema.LlmConfiguration[]>;
  getDefaultLlmConfiguration(organizationId: string): Promise<schema.LlmConfiguration | undefined>;
  updateLlmConfiguration(id: string, config: Partial<schema.InsertLlmConfiguration>): Promise<schema.LlmConfiguration | undefined>;
  deleteLlmConfiguration(id: string): Promise<void>;
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
    // Only return tenant-scoped system roles (NEVER platform roles like Super Admin)
    return await db.select().from(schema.roles).where(
      and(
        eq(schema.roles.isSystemRole, true),
        eq(schema.roles.scope, "tenant")
      )
    );
  }

  async getPlatformRoles(): Promise<Role[]> {
    return await db.select().from(schema.roles).where(eq(schema.roles.scope, "platform"));
  }

  async getTenantRoles(organizationId?: string): Promise<Role[]> {
    // Get all tenant-scoped roles (system templates + org-specific custom roles)
    if (organizationId) {
      // Return tenant-scoped system roles + custom roles for this organization
      return await db.select().from(schema.roles).where(
        and(
          eq(schema.roles.scope, "tenant"),
          or(
            eq(schema.roles.isSystemRole, true),
            eq(schema.roles.organizationId, organizationId)
          )
        )
      );
    } else {
      // Return only tenant-scoped system role templates
      return await db.select().from(schema.roles).where(
        and(
          eq(schema.roles.scope, "tenant"),
          eq(schema.roles.isSystemRole, true)
        )
      );
    }
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

  async getInstalledAgents(organizationId: string): Promise<schema.InstalledAgentView[]> {
    return await db.select({
      id: schema.aiAgentInstallations.id,
      agentId: schema.aiAgentInstallations.agentId,
      organizationId: schema.aiAgentInstallations.organizationId,
      installedBy: schema.aiAgentInstallations.installedBy,
      configuration: schema.aiAgentInstallations.configuration,
      isActive: schema.aiAgentInstallations.isActive,
      createdAt: schema.aiAgentInstallations.createdAt,
      agent: schema.aiAgents,
    })
      .from(schema.aiAgentInstallations)
      .leftJoin(schema.aiAgents, eq(schema.aiAgentInstallations.agentId, schema.aiAgents.id))
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

  // AI Agent Conversations
  async createAiConversation(conversation: schema.InsertAiAgentConversation): Promise<schema.AiAgentConversation> {
    const result = await db.insert(schema.aiAgentConversations).values(conversation).returning();
    return result[0];
  }

  async getAiConversation(id: string): Promise<schema.AiAgentConversation | undefined> {
    const result = await db.select().from(schema.aiAgentConversations)
      .where(eq(schema.aiAgentConversations.id, id));
    return result[0];
  }

  async getAiConversationsByUser(userId: string, agentName?: string): Promise<schema.AiAgentConversation[]> {
    const conditions = [
      eq(schema.aiAgentConversations.userId, userId),
      eq(schema.aiAgentConversations.isActive, true)
    ];
    
    if (agentName) {
      conditions.push(eq(schema.aiAgentConversations.agentName, agentName));
    }
    
    return await db.select().from(schema.aiAgentConversations)
      .where(and(...conditions))
      .orderBy(desc(schema.aiAgentConversations.lastMessageAt));
  }

  async getAiConversationByContext(
    contextType: string,
    contextId: string,
    userId: string,
    agentName: string
  ): Promise<schema.AiAgentConversation | undefined> {
    const result = await db.select().from(schema.aiAgentConversations)
      .where(and(
        eq(schema.aiAgentConversations.contextType, contextType),
        eq(schema.aiAgentConversations.contextId, contextId),
        eq(schema.aiAgentConversations.userId, userId),
        eq(schema.aiAgentConversations.agentName, agentName),
        eq(schema.aiAgentConversations.isActive, true)
      ));
    return result[0];
  }

  async updateAiConversationTitle(id: string, title: string): Promise<void> {
    await db.update(schema.aiAgentConversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.aiAgentConversations.id, id));
  }

  async closeAiConversation(id: string): Promise<void> {
    await db.update(schema.aiAgentConversations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.aiAgentConversations.id, id));
  }

  // AI Agent Messages
  async createAiMessage(message: schema.InsertAiAgentMessage): Promise<schema.AiAgentMessage> {
    const result = await db.insert(schema.aiAgentMessages).values(message).returning();
    
    // Update conversation's lastMessageAt timestamp
    await db.update(schema.aiAgentConversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(schema.aiAgentConversations.id, message.conversationId));
    
    return result[0];
  }

  async getAiMessagesByConversation(conversationId: string): Promise<schema.AiAgentMessage[]> {
    return await db.select().from(schema.aiAgentMessages)
      .where(eq(schema.aiAgentMessages.conversationId, conversationId))
      .orderBy(schema.aiAgentMessages.createdAt);
  }

  async updateAiMessageWithToolExecutions(id: string, toolExecutions: any[]): Promise<void> {
    await db.update(schema.aiAgentMessages)
      .set({ toolExecutions })
      .where(eq(schema.aiAgentMessages.id, id));
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

  // Tags
  async getTag(id: string): Promise<Tag | undefined> {
    const result = await db.select().from(schema.tags).where(eq(schema.tags.id, id));
    return result[0];
  }

  async createTag(tag: InsertTag & { organizationId: string; createdBy: string }): Promise<Tag> {
    const result = await db.insert(schema.tags).values(tag).returning();
    return result[0];
  }

  async updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag> {
    const result = await db.update(schema.tags)
      .set({ ...tag, updatedAt: new Date() })
      .where(eq(schema.tags.id, id))
      .returning();
    return result[0];
  }

  async deleteTag(id: string): Promise<void> {
    await db.delete(schema.tags).where(eq(schema.tags.id, id));
  }

  async getTagsByOrganization(organizationId: string): Promise<Tag[]> {
    return await db.select().from(schema.tags)
      .where(eq(schema.tags.organizationId, organizationId))
      .orderBy(schema.tags.name);
  }

  // Taggables
  async addTag(taggable: InsertTaggable): Promise<Taggable> {
    const result = await db.insert(schema.taggables).values(taggable).returning();
    return result[0];
  }

  async removeTag(tagId: string, taggableType: string, taggableId: string): Promise<void> {
    await db.delete(schema.taggables)
      .where(and(
        eq(schema.taggables.tagId, tagId),
        eq(schema.taggables.taggableType, taggableType),
        eq(schema.taggables.taggableId, taggableId)
      ));
  }

  async getTagsForResource(taggableType: string, taggableId: string): Promise<Tag[]> {
    const result = await db.select({ tag: schema.tags })
      .from(schema.taggables)
      .innerJoin(schema.tags, eq(schema.taggables.tagId, schema.tags.id))
      .where(and(
        eq(schema.taggables.taggableType, taggableType),
        eq(schema.taggables.taggableId, taggableId)
      ));
    return result.map(r => r.tag);
  }

  async getResourcesByTag(tagId: string, taggableType: string): Promise<string[]> {
    const result = await db.select({ taggableId: schema.taggables.taggableId })
      .from(schema.taggables)
      .where(and(
        eq(schema.taggables.tagId, tagId),
        eq(schema.taggables.taggableType, taggableType)
      ));
    return result.map(r => r.taggableId);
  }

  // Form Templates
  async getFormTemplate(id: string): Promise<FormTemplate | undefined> {
    const result = await db.select().from(schema.formTemplates).where(eq(schema.formTemplates.id, id));
    return result[0];
  }

  async createFormTemplate(template: InsertFormTemplate & { organizationId: string; createdBy: string }): Promise<FormTemplate> {
    const result = await db.insert(schema.formTemplates).values(template).returning();
    return result[0];
  }

  async updateFormTemplate(id: string, template: Partial<InsertFormTemplate>): Promise<FormTemplate | undefined> {
    const result = await db.update(schema.formTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(schema.formTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteFormTemplate(id: string): Promise<void> {
    await db.delete(schema.formTemplates).where(eq(schema.formTemplates.id, id));
  }

  async getFormTemplatesByOrganization(organizationId: string): Promise<FormTemplate[]> {
    return await db.select().from(schema.formTemplates)
      .where(eq(schema.formTemplates.organizationId, organizationId))
      .orderBy(desc(schema.formTemplates.updatedAt));
  }

  async publishFormTemplate(id: string): Promise<FormTemplate | undefined> {
    const result = await db.update(schema.formTemplates)
      .set({ 
        status: 'published', 
        lastPublishedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(schema.formTemplates.id, id))
      .returning();
    return result[0];
  }

  // Form Submissions
  async getFormSubmission(id: string): Promise<FormSubmission | undefined> {
    const result = await db.select().from(schema.formSubmissions).where(eq(schema.formSubmissions.id, id));
    return result[0];
  }

  async createFormSubmission(submission: InsertFormSubmission & { organizationId: string }): Promise<FormSubmission> {
    const result = await db.insert(schema.formSubmissions).values(submission).returning();
    // Increment submission count on template
    await db.update(schema.formTemplates)
      .set({ 
        submissionCount: sql`${schema.formTemplates.submissionCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(schema.formTemplates.id, submission.formTemplateId));
    return result[0];
  }

  async updateFormSubmission(id: string, submission: Partial<InsertFormSubmission>): Promise<FormSubmission | undefined> {
    const result = await db.update(schema.formSubmissions)
      .set(submission)
      .where(eq(schema.formSubmissions.id, id))
      .returning();
    return result[0];
  }

  async getFormSubmissionsByTemplate(formTemplateId: string): Promise<FormSubmission[]> {
    return await db.select().from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.formTemplateId, formTemplateId))
      .orderBy(desc(schema.formSubmissions.submittedAt));
  }

  async getFormSubmissionsByClient(clientId: string): Promise<FormSubmission[]> {
    return await db.select().from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.clientId, clientId))
      .orderBy(desc(schema.formSubmissions.submittedAt));
  }

  async getFormSubmissionsByOrganization(organizationId: string): Promise<FormSubmission[]> {
    return await db.select().from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.organizationId, organizationId))
      .orderBy(desc(schema.formSubmissions.submittedAt));
  }

  async reviewFormSubmission(id: string, reviewedBy: string, status: string, reviewNotes?: string): Promise<FormSubmission | undefined> {
    const result = await db.update(schema.formSubmissions)
      .set({ 
        status,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes
      })
      .where(eq(schema.formSubmissions.id, id))
      .returning();
    return result[0];
  }

  // Form Share Links
  async createFormShareLink(data: InsertFormShareLink & { organizationId: string; createdBy: string }): Promise<FormShareLink> {
    const result = await db.insert(schema.formShareLinks).values(data).returning();
    return result[0];
  }

  async getFormShareLink(id: string): Promise<FormShareLink | undefined> {
    const result = await db.select().from(schema.formShareLinks).where(eq(schema.formShareLinks.id, id));
    return result[0];
  }

  async getFormShareLinkByToken(token: string): Promise<FormShareLink | undefined> {
    const result = await db.select().from(schema.formShareLinks).where(eq(schema.formShareLinks.shareToken, token));
    return result[0];
  }

  async getFormShareLinksByForm(formTemplateId: string): Promise<FormShareLink[]> {
    return await db.select().from(schema.formShareLinks)
      .where(eq(schema.formShareLinks.formTemplateId, formTemplateId))
      .orderBy(desc(schema.formShareLinks.createdAt));
  }

  async updateFormShareLink(id: string, data: Partial<InsertFormShareLink>): Promise<FormShareLink | undefined> {
    const result = await db.update(schema.formShareLinks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.formShareLinks.id, id))
      .returning();
    return result[0];
  }

  async deleteFormShareLink(id: string): Promise<void> {
    await db.delete(schema.formShareLinks).where(eq(schema.formShareLinks.id, id));
  }

  async incrementShareLinkView(shareToken: string): Promise<void> {
    await db.update(schema.formShareLinks)
      .set({ 
        viewCount: sql`${schema.formShareLinks.viewCount} + 1`,
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.formShareLinks.shareToken, shareToken));
  }

  async incrementShareLinkSubmission(shareToken: string): Promise<void> {
    await db.update(schema.formShareLinks)
      .set({ 
        submissionCount: sql`${schema.formShareLinks.submissionCount} + 1`,
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.formShareLinks.shareToken, shareToken));
  }

  // Submission Notes
  async addSubmissionNote(submissionId: string, userId: string, note: string): Promise<schema.SubmissionNote> {
    const result = await db.insert(schema.submissionNotes).values({
      submissionId,
      userId,
      note,
    }).returning();
    return result[0];
  }

  async getSubmissionNotes(submissionId: string): Promise<Array<schema.SubmissionNote & { user: User }>> {
    const result = await db
      .select({
        id: schema.submissionNotes.id,
        submissionId: schema.submissionNotes.submissionId,
        userId: schema.submissionNotes.userId,
        note: schema.submissionNotes.note,
        createdAt: schema.submissionNotes.createdAt,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        }
      })
      .from(schema.submissionNotes)
      .leftJoin(schema.users, eq(schema.submissionNotes.userId, schema.users.id))
      .where(eq(schema.submissionNotes.submissionId, submissionId))
      .orderBy(desc(schema.submissionNotes.createdAt));
    
    return result.map(row => ({
      id: row.id,
      submissionId: row.submissionId,
      userId: row.userId,
      note: row.note,
      createdAt: row.createdAt,
      user: {
        id: row.user?.id || '',
        username: row.user?.username || '',
        email: row.user?.email || '',
        password: '',
        firstName: row.user?.firstName || null,
        lastName: row.user?.lastName || null,
        roleId: '',
        organizationId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  // Revision Requests
  async createRevisionRequest(submissionId: string, requestedBy: string, fieldsToRevise: any): Promise<schema.RevisionRequest> {
    // Update submission status to revision_requested
    await db.update(schema.formSubmissions)
      .set({ status: 'revision_requested' })
      .where(eq(schema.formSubmissions.id, submissionId));

    const result = await db.insert(schema.revisionRequests).values({
      submissionId,
      requestedBy,
      fieldsToRevise,
    }).returning();
    return result[0];
  }

  async getRevisionRequests(submissionId: string): Promise<Array<schema.RevisionRequest & { requestedByUser: User }>> {
    const result = await db
      .select({
        id: schema.revisionRequests.id,
        submissionId: schema.revisionRequests.submissionId,
        requestedBy: schema.revisionRequests.requestedBy,
        fieldsToRevise: schema.revisionRequests.fieldsToRevise,
        status: schema.revisionRequests.status,
        completedAt: schema.revisionRequests.completedAt,
        createdAt: schema.revisionRequests.createdAt,
        requestedByUser: {
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        }
      })
      .from(schema.revisionRequests)
      .leftJoin(schema.users, eq(schema.revisionRequests.requestedBy, schema.users.id))
      .where(eq(schema.revisionRequests.submissionId, submissionId))
      .orderBy(desc(schema.revisionRequests.createdAt));
    
    return result.map(row => ({
      id: row.id,
      submissionId: row.submissionId,
      requestedBy: row.requestedBy,
      fieldsToRevise: row.fieldsToRevise,
      status: row.status,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      requestedByUser: {
        id: row.requestedByUser?.id || '',
        username: row.requestedByUser?.username || '',
        email: row.requestedByUser?.email || '',
        password: '',
        firstName: row.requestedByUser?.firstName || null,
        lastName: row.requestedByUser?.lastName || null,
        roleId: '',
        organizationId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  async assignSubmissionReviewer(id: string, reviewerId: string): Promise<FormSubmission | undefined> {
    const result = await db.update(schema.formSubmissions)
      .set({ reviewedBy: reviewerId })
      .where(eq(schema.formSubmissions.id, id))
      .returning();
    return result[0];
  }

  // Document Requests
  async createDocumentRequest(request: InsertDocumentRequest & { organizationId: string; createdBy: string }): Promise<DocumentRequest> {
    const result = await db.insert(schema.documentRequests).values(request).returning();
    return result[0];
  }

  async getDocumentRequest(id: string): Promise<DocumentRequest | undefined> {
    const result = await db.select().from(schema.documentRequests).where(eq(schema.documentRequests.id, id));
    return result[0];
  }

  async getDocumentRequestsByOrganization(organizationId: string): Promise<DocumentRequest[]> {
    return await db.select().from(schema.documentRequests)
      .where(eq(schema.documentRequests.organizationId, organizationId))
      .orderBy(desc(schema.documentRequests.createdAt));
  }

  async getDocumentRequestsByClient(clientId: string): Promise<DocumentRequest[]> {
    return await db.select().from(schema.documentRequests)
      .where(eq(schema.documentRequests.clientId, clientId))
      .orderBy(desc(schema.documentRequests.createdAt));
  }

  async updateDocumentRequest(id: string, request: Partial<InsertDocumentRequest>): Promise<DocumentRequest | undefined> {
    const result = await db.update(schema.documentRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(schema.documentRequests.id, id))
      .returning();
    return result[0];
  }

  async deleteDocumentRequest(id: string): Promise<void> {
    await db.delete(schema.documentRequests).where(eq(schema.documentRequests.id, id));
  }

  // Required Documents
  async createRequiredDocument(doc: InsertRequiredDocument): Promise<RequiredDocument> {
    const result = await db.insert(schema.requiredDocuments).values(doc).returning();
    return result[0];
  }

  async getRequiredDocument(id: string): Promise<RequiredDocument | undefined> {
    const result = await db.select().from(schema.requiredDocuments).where(eq(schema.requiredDocuments.id, id));
    return result[0];
  }

  async getRequiredDocumentsByRequest(requestId: string): Promise<RequiredDocument[]> {
    return await db.select().from(schema.requiredDocuments)
      .where(eq(schema.requiredDocuments.requestId, requestId))
      .orderBy(schema.requiredDocuments.sortOrder);
  }

  async updateRequiredDocument(id: string, doc: Partial<InsertRequiredDocument>): Promise<RequiredDocument | undefined> {
    const result = await db.update(schema.requiredDocuments)
      .set(doc)
      .where(eq(schema.requiredDocuments.id, id))
      .returning();
    return result[0];
  }

  async deleteRequiredDocument(id: string): Promise<void> {
    await db.delete(schema.requiredDocuments).where(eq(schema.requiredDocuments.id, id));
  }

  // Document Submissions
  async createDocumentSubmission(submission: InsertDocumentSubmission): Promise<DocSubmission> {
    const result = await db.insert(schema.documentSubmissions).values(submission).returning();
    return result[0];
  }

  async getDocumentSubmission(id: string): Promise<DocSubmission | undefined> {
    const result = await db.select().from(schema.documentSubmissions).where(eq(schema.documentSubmissions.id, id));
    return result[0];
  }

  async getDocumentSubmissionsByRequiredDoc(requiredDocumentId: string): Promise<DocSubmission[]> {
    return await db.select().from(schema.documentSubmissions)
      .where(eq(schema.documentSubmissions.requiredDocumentId, requiredDocumentId))
      .orderBy(desc(schema.documentSubmissions.createdAt));
  }

  async reviewDocumentSubmission(id: string, reviewedBy: string, status: string, reviewNotes?: string): Promise<DocSubmission | undefined> {
    const result = await db.update(schema.documentSubmissions)
      .set({ 
        reviewedBy, 
        status, 
        reviewNotes,
        reviewedAt: new Date() 
      })
      .where(eq(schema.documentSubmissions.id, id))
      .returning();
    return result[0];
  }

  // ==============================================
  // TAXDOME FEATURES - Practice Management
  // ==============================================

  // Secure Messaging
  async createConversation(conversation: schema.InsertConversation): Promise<schema.Conversation> {
    const result = await db.insert(schema.conversations).values(conversation).returning();
    return result[0];
  }

  async getConversation(id: string): Promise<schema.Conversation | undefined> {
    const result = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id));
    return result[0];
  }

  async getConversationsByOrganization(organizationId: string): Promise<schema.Conversation[]> {
    return await db.select().from(schema.conversations)
      .where(eq(schema.conversations.organizationId, organizationId))
      .orderBy(desc(schema.conversations.lastMessageAt));
  }

  async getConversationsByClient(clientId: string): Promise<schema.Conversation[]> {
    return await db.select().from(schema.conversations)
      .where(eq(schema.conversations.clientId, clientId))
      .orderBy(desc(schema.conversations.lastMessageAt));
  }

  async updateConversation(id: string, conversation: Partial<schema.InsertConversation>): Promise<schema.Conversation | undefined> {
    const result = await db.update(schema.conversations)
      .set({ ...conversation, updatedAt: new Date() })
      .where(eq(schema.conversations.id, id))
      .returning();
    return result[0];
  }

  async createMessage(message: schema.InsertMessage): Promise<schema.Message> {
    const result = await db.insert(schema.messages).values(message).returning();
    await db.update(schema.conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(schema.conversations.id, message.conversationId));
    return result[0];
  }

  async getMessage(id: string): Promise<schema.Message | undefined> {
    const result = await db.select().from(schema.messages).where(eq(schema.messages.id, id));
    return result[0];
  }

  async getMessagesByConversation(conversationId: string): Promise<schema.Message[]> {
    return await db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.createdAt);
  }

  async markMessageAsRead(id: string): Promise<void> {
    await db.update(schema.messages)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(schema.messages.id, id));
  }

  // Time Tracking & Billing
  async createTimeEntry(entry: schema.InsertTimeEntry): Promise<schema.TimeEntry> {
    const result = await db.insert(schema.timeEntries).values(entry).returning();
    return result[0];
  }

  async getTimeEntry(id: string): Promise<schema.TimeEntry | undefined> {
    const result = await db.select().from(schema.timeEntries).where(eq(schema.timeEntries.id, id));
    return result[0];
  }

  async getTimeEntriesByOrganization(organizationId: string): Promise<schema.TimeEntry[]> {
    return await db.select().from(schema.timeEntries)
      .where(eq(schema.timeEntries.organizationId, organizationId))
      .orderBy(desc(schema.timeEntries.date));
  }

  async getTimeEntriesByUser(userId: string): Promise<schema.TimeEntry[]> {
    return await db.select().from(schema.timeEntries)
      .where(eq(schema.timeEntries.userId, userId))
      .orderBy(desc(schema.timeEntries.date));
  }

  async getTimeEntriesByClient(clientId: string): Promise<schema.TimeEntry[]> {
    return await db.select().from(schema.timeEntries)
      .where(eq(schema.timeEntries.clientId, clientId))
      .orderBy(desc(schema.timeEntries.date));
  }

  async updateTimeEntry(id: string, entry: Partial<schema.InsertTimeEntry>): Promise<schema.TimeEntry | undefined> {
    const result = await db.update(schema.timeEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(schema.timeEntries.id, id))
      .returning();
    return result[0];
  }

  async deleteTimeEntry(id: string): Promise<void> {
    await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, id));
  }

  async createInvoice(invoice: schema.InsertInvoice): Promise<schema.Invoice> {
    const result = await db.insert(schema.invoices).values(invoice).returning();
    return result[0];
  }

  async getInvoice(id: string): Promise<schema.Invoice | undefined> {
    const result = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    return result[0];
  }

  async getInvoicesByOrganization(organizationId: string): Promise<schema.Invoice[]> {
    return await db.select().from(schema.invoices)
      .where(eq(schema.invoices.organizationId, organizationId))
      .orderBy(desc(schema.invoices.createdAt));
  }

  async getInvoicesByClient(clientId: string): Promise<schema.Invoice[]> {
    return await db.select().from(schema.invoices)
      .where(eq(schema.invoices.clientId, clientId))
      .orderBy(desc(schema.invoices.createdAt));
  }

  async updateInvoice(id: string, invoice: Partial<schema.InsertInvoice>): Promise<schema.Invoice | undefined> {
    const result = await db.update(schema.invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(schema.invoices.id, id))
      .returning();
    return result[0];
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(schema.invoices).where(eq(schema.invoices.id, id));
  }

  async createInvoiceItem(item: schema.InsertInvoiceItem): Promise<schema.InvoiceItem> {
    const result = await db.insert(schema.invoiceItems).values(item).returning();
    return result[0];
  }

  async getInvoiceItemsByInvoice(invoiceId: string): Promise<schema.InvoiceItem[]> {
    return await db.select().from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoiceId));
  }

  async deleteInvoiceItem(id: string): Promise<void> {
    await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.id, id));
  }

  async createPayment(payment: schema.InsertPayment): Promise<schema.Payment> {
    const result = await db.insert(schema.payments).values(payment).returning();
    return result[0];
  }

  async getPayment(id: string): Promise<schema.Payment | undefined> {
    const result = await db.select().from(schema.payments).where(eq(schema.payments.id, id));
    return result[0];
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<schema.Payment[]> {
    return await db.select().from(schema.payments)
      .where(eq(schema.payments.invoiceId, invoiceId))
      .orderBy(desc(schema.payments.createdAt));
  }

  async getPaymentsByClient(clientId: string): Promise<schema.Payment[]> {
    return await db.select().from(schema.payments)
      .where(eq(schema.payments.clientId, clientId))
      .orderBy(desc(schema.payments.createdAt));
  }

  async updatePayment(id: string, payment: Partial<schema.InsertPayment>): Promise<schema.Payment | undefined> {
    const result = await db.update(schema.payments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(schema.payments.id, id))
      .returning();
    return result[0];
  }

  async createExpense(expense: schema.InsertExpense): Promise<schema.Expense> {
    const result = await db.insert(schema.expenses).values(expense).returning();
    return result[0];
  }

  async getExpense(id: string): Promise<schema.Expense | undefined> {
    const result = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
    return result[0];
  }

  async getExpensesByOrganization(organizationId: string): Promise<schema.Expense[]> {
    return await db.select().from(schema.expenses)
      .where(eq(schema.expenses.organizationId, organizationId))
      .orderBy(desc(schema.expenses.date));
  }

  async getExpensesByUser(userId: string): Promise<schema.Expense[]> {
    return await db.select().from(schema.expenses)
      .where(eq(schema.expenses.userId, userId))
      .orderBy(desc(schema.expenses.date));
  }

  async updateExpense(id: string, expense: Partial<schema.InsertExpense>): Promise<schema.Expense | undefined> {
    const result = await db.update(schema.expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(schema.expenses.id, id))
      .returning();
    return result[0];
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
  }

  // E-Signatures
  async createSignatureRequest(request: schema.InsertSignatureRequest): Promise<schema.SignatureRequest> {
    const result = await db.insert(schema.signatureRequests).values(request).returning();
    return result[0];
  }

  async getSignatureRequest(id: string): Promise<schema.SignatureRequest | undefined> {
    const result = await db.select().from(schema.signatureRequests).where(eq(schema.signatureRequests.id, id));
    return result[0];
  }

  async getSignatureRequestsByOrganization(organizationId: string): Promise<schema.SignatureRequest[]> {
    return await db.select().from(schema.signatureRequests)
      .where(eq(schema.signatureRequests.organizationId, organizationId))
      .orderBy(desc(schema.signatureRequests.createdAt));
  }

  async getSignatureRequestsByClient(clientId: string): Promise<schema.SignatureRequest[]> {
    return await db.select().from(schema.signatureRequests)
      .where(eq(schema.signatureRequests.clientId, clientId))
      .orderBy(desc(schema.signatureRequests.createdAt));
  }

  async updateSignatureRequest(id: string, request: Partial<schema.InsertSignatureRequest>): Promise<schema.SignatureRequest | undefined> {
    const result = await db.update(schema.signatureRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(schema.signatureRequests.id, id))
      .returning();
    return result[0];
  }

  async signDocument(id: string, signedBy: string, signatureData: string, ipAddress: string, userAgent: string): Promise<schema.SignatureRequest | undefined> {
    const result = await db.update(schema.signatureRequests)
      .set({
        status: 'signed',
        signedBy,
        signatureData,
        ipAddress,
        userAgent,
        signedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.signatureRequests.id, id))
      .returning();
    return result[0];
  }

  // Projects & Kanban
  async createProject(project: schema.InsertProject): Promise<schema.Project> {
    const result = await db.insert(schema.projects).values(project).returning();
    return result[0];
  }

  async getProject(id: string): Promise<schema.Project | undefined> {
    const result = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
    return result[0];
  }

  async getProjectsByOrganization(organizationId: string): Promise<schema.Project[]> {
    return await db.select().from(schema.projects)
      .where(eq(schema.projects.organizationId, organizationId))
      .orderBy(desc(schema.projects.createdAt));
  }

  async getProjectsByClient(clientId: string): Promise<schema.Project[]> {
    return await db.select().from(schema.projects)
      .where(eq(schema.projects.clientId, clientId))
      .orderBy(desc(schema.projects.createdAt));
  }

  async updateProject(id: string, project: Partial<schema.InsertProject>): Promise<schema.Project | undefined> {
    const result = await db.update(schema.projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(schema.projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
  }

  async createProjectTask(task: schema.InsertProjectTask): Promise<schema.ProjectTask> {
    const result = await db.insert(schema.projectTasks).values(task).returning();
    return result[0];
  }

  async getProjectTask(id: string): Promise<schema.ProjectTask | undefined> {
    const result = await db.select().from(schema.projectTasks).where(eq(schema.projectTasks.id, id));
    return result[0];
  }

  async getProjectTasksByProject(projectId: string): Promise<schema.ProjectTask[]> {
    return await db.select().from(schema.projectTasks)
      .where(eq(schema.projectTasks.projectId, projectId))
      .orderBy(schema.projectTasks.position);
  }

  async updateProjectTask(id: string, task: Partial<schema.InsertProjectTask>): Promise<schema.ProjectTask | undefined> {
    const result = await db.update(schema.projectTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(schema.projectTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteProjectTask(id: string): Promise<void> {
    await db.delete(schema.projectTasks).where(eq(schema.projectTasks.id, id));
  }

  // Team Chat
  async createChatChannel(channel: schema.InsertChatChannel): Promise<schema.ChatChannel> {
    const result = await db.insert(schema.chatChannels).values(channel).returning();
    return result[0];
  }

  async getChatChannel(id: string): Promise<schema.ChatChannel | undefined> {
    const result = await db.select().from(schema.chatChannels).where(eq(schema.chatChannels.id, id));
    return result[0];
  }

  async getChatChannelsByOrganization(organizationId: string): Promise<schema.ChatChannel[]> {
    return await db.select().from(schema.chatChannels)
      .where(eq(schema.chatChannels.organizationId, organizationId))
      .orderBy(schema.chatChannels.name);
  }

  async updateChatChannel(id: string, channel: Partial<schema.InsertChatChannel>): Promise<schema.ChatChannel | undefined> {
    const result = await db.update(schema.chatChannels)
      .set({ ...channel, updatedAt: new Date() })
      .where(eq(schema.chatChannels.id, id))
      .returning();
    return result[0];
  }

  async deleteChatChannel(id: string): Promise<void> {
    await db.delete(schema.chatChannels).where(eq(schema.chatChannels.id, id));
  }

  async addChatMember(member: schema.InsertChatMember): Promise<schema.ChatMember> {
    const result = await db.insert(schema.chatMembers).values(member).returning();
    return result[0];
  }

  async getChatMembersByChannel(channelId: string): Promise<schema.ChatMember[]> {
    return await db.select().from(schema.chatMembers)
      .where(eq(schema.chatMembers.channelId, channelId));
  }

  async removeChatMember(channelId: string, userId: string): Promise<void> {
    await db.delete(schema.chatMembers)
      .where(and(
        eq(schema.chatMembers.channelId, channelId),
        eq(schema.chatMembers.userId, userId)
      ));
  }

  async updateLastRead(channelId: string, userId: string): Promise<void> {
    await db.update(schema.chatMembers)
      .set({ lastReadAt: new Date() })
      .where(and(
        eq(schema.chatMembers.channelId, channelId),
        eq(schema.chatMembers.userId, userId)
      ));
  }

  async createChatMessage(message: schema.InsertChatMessage): Promise<schema.ChatMessage> {
    const result = await db.insert(schema.chatMessages).values(message).returning();
    return result[0];
  }

  async getChatMessage(id: string): Promise<schema.ChatMessage | undefined> {
    const result = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.id, id));
    return result[0];
  }

  async getChatMessagesByChannel(channelId: string): Promise<schema.ChatMessage[]> {
    return await db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.channelId, channelId))
      .orderBy(schema.chatMessages.createdAt);
  }

  async updateChatMessage(id: string, content: string): Promise<schema.ChatMessage | undefined> {
    const result = await db.update(schema.chatMessages)
      .set({ content, isEdited: true, editedAt: new Date() })
      .where(eq(schema.chatMessages.id, id))
      .returning();
    return result[0];
  }

  async deleteChatMessage(id: string): Promise<void> {
    await db.delete(schema.chatMessages).where(eq(schema.chatMessages.id, id));
  }

  // Calendar & Appointments
  async createAppointment(appointment: schema.InsertAppointment): Promise<schema.Appointment> {
    const result = await db.insert(schema.appointments).values(appointment).returning();
    return result[0];
  }

  async getAppointment(id: string): Promise<schema.Appointment | undefined> {
    const result = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id));
    return result[0];
  }

  async getAppointmentsByOrganization(organizationId: string): Promise<schema.Appointment[]> {
    return await db.select().from(schema.appointments)
      .where(eq(schema.appointments.organizationId, organizationId))
      .orderBy(schema.appointments.startTime);
  }

  async getAppointmentsByClient(clientId: string): Promise<schema.Appointment[]> {
    return await db.select().from(schema.appointments)
      .where(eq(schema.appointments.clientId, clientId))
      .orderBy(schema.appointments.startTime);
  }

  async getAppointmentsByUser(userId: string): Promise<schema.Appointment[]> {
    return await db.select().from(schema.appointments)
      .where(eq(schema.appointments.assignedTo, userId))
      .orderBy(schema.appointments.startTime);
  }

  async updateAppointment(id: string, appointment: Partial<schema.InsertAppointment>): Promise<schema.Appointment | undefined> {
    const result = await db.update(schema.appointments)
      .set({ ...appointment, updatedAt: new Date() })
      .where(eq(schema.appointments.id, id))
      .returning();
    return result[0];
  }

  async deleteAppointment(id: string): Promise<void> {
    await db.delete(schema.appointments).where(eq(schema.appointments.id, id));
  }

  // Email Templates
  async createEmailTemplate(template: schema.InsertEmailTemplate): Promise<schema.EmailTemplate> {
    const result = await db.insert(schema.emailTemplates).values(template).returning();
    return result[0];
  }

  async getEmailTemplate(id: string): Promise<schema.EmailTemplate | undefined> {
    const result = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, id));
    return result[0];
  }

  async getEmailTemplatesByOrganization(organizationId: string): Promise<schema.EmailTemplate[]> {
    return await db.select().from(schema.emailTemplates)
      .where(eq(schema.emailTemplates.organizationId, organizationId))
      .orderBy(schema.emailTemplates.name);
  }

  async updateEmailTemplate(id: string, template: Partial<schema.InsertEmailTemplate>): Promise<schema.EmailTemplate | undefined> {
    const result = await db.update(schema.emailTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(schema.emailTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, id));
  }

  // PDF Annotations
  async createDocumentAnnotation(annotation: schema.InsertDocumentAnnotation): Promise<schema.DocumentAnnotation> {
    const result = await db.insert(schema.documentAnnotations).values(annotation).returning();
    return result[0];
  }

  async getDocumentAnnotation(id: string): Promise<schema.DocumentAnnotation | undefined> {
    const result = await db.select().from(schema.documentAnnotations).where(eq(schema.documentAnnotations.id, id));
    return result[0];
  }

  async getDocumentAnnotationsByDocument(documentId: string): Promise<schema.DocumentAnnotation[]> {
    return await db.select().from(schema.documentAnnotations)
      .where(eq(schema.documentAnnotations.documentId, documentId))
      .orderBy(schema.documentAnnotations.pageNumber, schema.documentAnnotations.createdAt);
  }

  async updateDocumentAnnotation(id: string, annotation: Partial<schema.InsertDocumentAnnotation>): Promise<schema.DocumentAnnotation | undefined> {
    const result = await db.update(schema.documentAnnotations)
      .set({ ...annotation, updatedAt: new Date() })
      .where(eq(schema.documentAnnotations.id, id))
      .returning();
    return result[0];
  }

  async deleteDocumentAnnotation(id: string): Promise<void> {
    await db.delete(schema.documentAnnotations).where(eq(schema.documentAnnotations.id, id));
  }

  async resolveAnnotation(id: string, resolvedBy: string): Promise<schema.DocumentAnnotation | undefined> {
    const result = await db.update(schema.documentAnnotations)
      .set({ 
        resolved: true, 
        resolvedBy, 
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.documentAnnotations.id, id))
      .returning();
    return result[0];
  }

  // Workflow Stages
  async createWorkflowStage(stage: schema.InsertWorkflowStage): Promise<schema.WorkflowStage> {
    const result = await db.insert(schema.workflowStages).values(stage).returning();
    return result[0];
  }

  async getWorkflowStage(id: string): Promise<schema.WorkflowStage | undefined> {
    const result = await db.select().from(schema.workflowStages).where(eq(schema.workflowStages.id, id));
    return result[0];
  }

  async getStagesByWorkflow(workflowId: string): Promise<schema.WorkflowStage[]> {
    return await db.select().from(schema.workflowStages)
      .where(eq(schema.workflowStages.workflowId, workflowId))
      .orderBy(schema.workflowStages.order);
  }

  async updateWorkflowStage(id: string, stage: Partial<schema.InsertWorkflowStage>): Promise<schema.WorkflowStage | undefined> {
    const result = await db.update(schema.workflowStages)
      .set({ ...stage, updatedAt: new Date() })
      .where(eq(schema.workflowStages.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkflowStage(id: string): Promise<void> {
    await db.delete(schema.workflowStages).where(eq(schema.workflowStages.id, id));
  }

  // Workflow Steps
  async createWorkflowStep(step: schema.InsertWorkflowStep): Promise<schema.WorkflowStep> {
    const result = await db.insert(schema.workflowSteps).values(step).returning();
    return result[0];
  }

  async getWorkflowStep(id: string): Promise<schema.WorkflowStep | undefined> {
    const result = await db.select().from(schema.workflowSteps).where(eq(schema.workflowSteps.id, id));
    return result[0];
  }

  async getStepsByStage(stageId: string): Promise<schema.WorkflowStep[]> {
    return await db.select().from(schema.workflowSteps)
      .where(eq(schema.workflowSteps.stageId, stageId))
      .orderBy(schema.workflowSteps.order);
  }

  async updateWorkflowStep(id: string, step: Partial<schema.InsertWorkflowStep>): Promise<schema.WorkflowStep | undefined> {
    const result = await db.update(schema.workflowSteps)
      .set({ ...step, updatedAt: new Date() })
      .where(eq(schema.workflowSteps.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkflowStep(id: string): Promise<void> {
    await db.delete(schema.workflowSteps).where(eq(schema.workflowSteps.id, id));
  }

  // Workflow Tasks
  async createWorkflowTask(task: schema.InsertWorkflowTask): Promise<schema.WorkflowTask> {
    const result = await db.insert(schema.workflowTasks).values(task).returning();
    return result[0];
  }

  async getWorkflowTask(id: string): Promise<schema.WorkflowTask | undefined> {
    const result = await db.select().from(schema.workflowTasks).where(eq(schema.workflowTasks.id, id));
    return result[0];
  }

  async getTasksByStep(stepId: string): Promise<schema.WorkflowTask[]> {
    return await db.select().from(schema.workflowTasks)
      .where(eq(schema.workflowTasks.stepId, stepId))
      .orderBy(schema.workflowTasks.order);
  }

  async updateWorkflowTask(id: string, task: Partial<schema.InsertWorkflowTask>): Promise<schema.WorkflowTask | undefined> {
    const result = await db.update(schema.workflowTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(schema.workflowTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkflowTask(id: string): Promise<void> {
    await db.delete(schema.workflowTasks).where(eq(schema.workflowTasks.id, id));
  }

  async assignTask(taskId: string, userId: string): Promise<schema.WorkflowTask | undefined> {
    const result = await db.update(schema.workflowTasks)
      .set({ assignedTo: userId, updatedAt: new Date() })
      .where(eq(schema.workflowTasks.id, taskId))
      .returning();
    return result[0];
  }

  async completeTask(taskId: string, userId: string): Promise<schema.WorkflowTask | undefined> {
    const task = await this.getWorkflowTask(taskId);
    if (!task) return undefined;
    
    const result = await db.update(schema.workflowTasks)
      .set({ 
        status: 'completed', 
        completedAt: new Date(), 
        completedBy: userId,
        updatedAt: new Date()
      })
      .where(eq(schema.workflowTasks.id, taskId))
      .returning();
    
    // Trigger progression check
    if (result[0]) {
      await this.checkAndUpdateStepCompletion(task.stepId);
    }
    
    return result[0];
  }

  // Task Subtasks
  async createTaskSubtask(subtask: schema.InsertTaskSubtask): Promise<schema.TaskSubtask> {
    const result = await db.insert(schema.taskSubtasks).values(subtask).returning();
    return result[0];
  }

  async getTaskSubtask(id: string): Promise<schema.TaskSubtask | undefined> {
    const result = await db.select().from(schema.taskSubtasks).where(eq(schema.taskSubtasks.id, id));
    return result[0];
  }

  async getSubtasksByTask(taskId: string): Promise<schema.TaskSubtask[]> {
    return await db.select().from(schema.taskSubtasks)
      .where(eq(schema.taskSubtasks.taskId, taskId))
      .orderBy(schema.taskSubtasks.order);
  }

  async updateTaskSubtask(id: string, subtask: Partial<schema.InsertTaskSubtask>): Promise<schema.TaskSubtask | undefined> {
    const result = await db.update(schema.taskSubtasks)
      .set({ ...subtask, updatedAt: new Date() })
      .where(eq(schema.taskSubtasks.id, id))
      .returning();
    return result[0];
  }

  async deleteTaskSubtask(id: string): Promise<void> {
    await db.delete(schema.taskSubtasks).where(eq(schema.taskSubtasks.id, id));
  }

  async completeSubtask(subtaskId: string, userId: string): Promise<schema.TaskSubtask | undefined> {
    const subtask = await this.getTaskSubtask(subtaskId);
    if (!subtask) return undefined;
    
    const result = await db.update(schema.taskSubtasks)
      .set({ 
        status: 'completed', 
        completedAt: new Date(), 
        completedBy: userId,
        updatedAt: new Date()
      })
      .where(eq(schema.taskSubtasks.id, subtaskId))
      .returning();
    
    // Trigger progression check
    if (result[0]) {
      await this.checkAndUpdateTaskCompletion(subtask.taskId);
    }
    
    return result[0];
  }

  // Task Checklists
  async createTaskChecklist(checklist: schema.InsertTaskChecklist): Promise<schema.TaskChecklist> {
    const result = await db.insert(schema.taskChecklists).values(checklist).returning();
    return result[0];
  }

  async getTaskChecklist(id: string): Promise<schema.TaskChecklist | undefined> {
    const result = await db.select().from(schema.taskChecklists).where(eq(schema.taskChecklists.id, id));
    return result[0];
  }

  async getChecklistsByTask(taskId: string): Promise<schema.TaskChecklist[]> {
    return await db.select().from(schema.taskChecklists)
      .where(eq(schema.taskChecklists.taskId, taskId))
      .orderBy(schema.taskChecklists.order);
  }

  async updateTaskChecklist(id: string, checklist: Partial<schema.InsertTaskChecklist>): Promise<schema.TaskChecklist | undefined> {
    const result = await db.update(schema.taskChecklists)
      .set(checklist)
      .where(eq(schema.taskChecklists.id, id))
      .returning();
    return result[0];
  }

  async deleteTaskChecklist(id: string): Promise<void> {
    await db.delete(schema.taskChecklists).where(eq(schema.taskChecklists.id, id));
  }

  async toggleChecklistItem(id: string, userId: string): Promise<schema.TaskChecklist | undefined> {
    const current = await this.getTaskChecklist(id);
    if (!current) return undefined;
    
    const result = await db.update(schema.taskChecklists)
      .set({ 
        isChecked: !current.isChecked,
        checkedAt: !current.isChecked ? new Date() : null,
        checkedBy: !current.isChecked ? userId : null
      })
      .where(eq(schema.taskChecklists.id, id))
      .returning();
    
    // Check if all checklists for this task are complete
    if (result[0]) {
      await this.checkAndUpdateTaskCompletion(current.taskId);
    }
    
    return result[0];
  }

  // Progression Logic - Check if task can be auto-completed
  async checkAndUpdateTaskCompletion(taskId: string): Promise<void> {
    console.log(`[PROGRESSION] Checking task completion for task ${taskId}`);
    const task = await this.getWorkflowTask(taskId);
    if (!task) {
      console.log(`[PROGRESSION] Task not found: ${taskId}`);
      return;
    }
    if (task.status === 'completed') {
      console.log(`[PROGRESSION] Task already completed: ${taskId}`);
      return;
    }

    const subtasks = await this.getSubtasksByTask(taskId);
    const checklists = await this.getChecklistsByTask(taskId);
    console.log(`[PROGRESSION] Task ${taskId} has ${subtasks.length} subtasks and ${checklists.length} checklists`);

    // Check if all subtasks and checklists are complete
    const allSubtasksComplete = subtasks.length === 0 || subtasks.every(s => s.status === 'completed');
    const allChecklistsComplete = checklists.length === 0 || checklists.every(c => c.isChecked);
    console.log(`[PROGRESSION] All subtasks complete: ${allSubtasksComplete}, All checklists complete: ${allChecklistsComplete}`);

    if (allSubtasksComplete && allChecklistsComplete) {
      console.log(`[PROGRESSION] Auto-completing task ${taskId}`);
      // Auto-complete the task
      await db.update(schema.workflowTasks)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.workflowTasks.id, taskId));
      
      console.log(`[PROGRESSION] Task ${taskId} completed, checking step ${task.stepId}`);
      // Check step completion
      await this.checkAndUpdateStepCompletion(task.stepId);
    } else {
      console.log(`[PROGRESSION] Not all children complete for task ${taskId}, not auto-completing`);
    }
  }

  // Check if step can be auto-completed
  async checkAndUpdateStepCompletion(stepId: string): Promise<void> {
    console.log(`[PROGRESSION] Checking step completion for step ${stepId}`);
    const step = await this.getWorkflowStep(stepId);
    if (!step) {
      console.log(`[PROGRESSION] Step not found: ${stepId}`);
      return;
    }
    if (step.status === 'completed') {
      console.log(`[PROGRESSION] Step already completed: ${stepId}`);
      return;
    }
    
    // Only check for completion if requireAllTasksComplete is explicitly set to false
    // Default behavior (null/undefined/true) is to require all tasks complete
    console.log(`[PROGRESSION] Step requireAllTasksComplete: ${step.requireAllTasksComplete}`);
    if (step.requireAllTasksComplete === false) {
      console.log(`[PROGRESSION] Step ${stepId} has requireAllTasksComplete=false, skipping auto-completion`);
      return;
    }

    const tasks = await this.getTasksByStep(stepId);
    console.log(`[PROGRESSION] Step ${stepId} has ${tasks.length} tasks`);
    console.log(`[PROGRESSION] Task statuses:`, tasks.map(t => ({ id: t.id, name: t.name, status: t.status })));
    
    // Check if all tasks are complete
    const allTasksComplete = tasks.length > 0 && tasks.every(t => t.status === 'completed');
    console.log(`[PROGRESSION] All tasks complete: ${allTasksComplete}`);

    if (allTasksComplete) {
      console.log(`[PROGRESSION] Auto-completing step ${stepId}`);
      // Auto-complete the step
      await db.update(schema.workflowSteps)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.workflowSteps.id, stepId));
      
      console.log(`[PROGRESSION] Step ${stepId} completed, checking stage`);
      // Check stage completion
      await this.checkAndUpdateStageCompletion(step.stageId);
    } else {
      console.log(`[PROGRESSION] Not all tasks complete for step ${stepId}, not auto-completing`);
    }
  }

  // Check if stage can be auto-completed
  async checkAndUpdateStageCompletion(stageId: string): Promise<void> {
    const stage = await this.getWorkflowStage(stageId);
    if (!stage || stage.status === 'completed') return;

    const steps = await this.getStepsByStage(stageId);
    
    // Check if all steps are complete
    const allStepsComplete = steps.length > 0 && steps.every(s => s.status === 'completed');

    if (allStepsComplete) {
      // Auto-complete the stage
      await db.update(schema.workflowStages)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.workflowStages.id, stageId));
      
      // Check workflow completion
      await this.checkAndUpdateWorkflowCompletion(stage.workflowId);
    }
  }

  // Check if workflow can be auto-completed
  async checkAndUpdateWorkflowCompletion(workflowId: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || workflow.status === 'completed') return;

    const stages = await this.getStagesByWorkflow(workflowId);
    
    // Check if all stages are complete
    const allStagesComplete = stages.length > 0 && stages.every(s => s.status === 'completed');

    if (allStagesComplete) {
      // Auto-complete the workflow
      await db.update(schema.workflows)
        .set({ 
          status: 'completed',
          updatedAt: new Date()
        })
        .where(eq(schema.workflows.id, workflowId));
    }
  }

  // ========================================
  // LLM CONFIGURATIONS
  // ========================================

  async createLlmConfiguration(config: schema.InsertLlmConfiguration): Promise<schema.LlmConfiguration> {
    const result = await db.insert(schema.llmConfigurations).values(config).returning();
    return result[0];
  }

  async getLlmConfiguration(id: string): Promise<schema.LlmConfiguration | undefined> {
    const result = await db.select().from(schema.llmConfigurations).where(eq(schema.llmConfigurations.id, id));
    return result[0];
  }

  async getLlmConfigurationsByOrganization(organizationId: string): Promise<schema.LlmConfiguration[]> {
    return await db.select().from(schema.llmConfigurations)
      .where(eq(schema.llmConfigurations.organizationId, organizationId))
      .orderBy(schema.llmConfigurations.isDefault);
  }

  async getDefaultLlmConfiguration(organizationId: string): Promise<schema.LlmConfiguration | undefined> {
    const result = await db.select().from(schema.llmConfigurations)
      .where(
        and(
          eq(schema.llmConfigurations.organizationId, organizationId),
          eq(schema.llmConfigurations.isDefault, true),
          eq(schema.llmConfigurations.isActive, true)
        )
      );
    return result[0];
  }

  async updateLlmConfiguration(id: string, config: Partial<schema.InsertLlmConfiguration>): Promise<schema.LlmConfiguration | undefined> {
    const result = await db.update(schema.llmConfigurations)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(schema.llmConfigurations.id, id))
      .returning();
    return result[0];
  }

  async deleteLlmConfiguration(id: string): Promise<void> {
    await db.delete(schema.llmConfigurations).where(eq(schema.llmConfigurations.id, id));
  }
}

export const storage = new DbStorage();
