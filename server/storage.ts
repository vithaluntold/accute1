import { eq, and, or, desc, sql, lt, lte, gt, gte, ne, isNull } from "drizzle-orm";
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
  ClientContact,
  InsertClientContact,
  ClientOnboardingSession,
  InsertClientOnboardingSession,
  OnboardingMessage,
  InsertOnboardingMessage,
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
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  getUsersByRole(roleId: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>; // Super Admin: get all users across all organizations

  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;

  // Platform Subscriptions (Super Admin)
  getPlatformSubscriptionByOrganization(organizationId: string): Promise<schema.PlatformSubscription | undefined>;
  getAllPlatformSubscriptions(): Promise<schema.PlatformSubscription[]>;
  createPlatformSubscription(subscription: schema.InsertPlatformSubscription): Promise<schema.PlatformSubscription>;
  updatePlatformSubscription(id: string, subscription: Partial<schema.InsertPlatformSubscription>): Promise<schema.PlatformSubscription | undefined>;

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

  // OTP Verification
  createOtpVerification(data: schema.InsertOtpVerification): Promise<schema.OtpVerification>;
  getLatestOtpByPhone(phone: string): Promise<schema.OtpVerification | undefined>;
  verifyOtp(id: string): Promise<schema.OtpVerification | undefined>;
  deleteExpiredOtps(): Promise<void>;

  // Luca Chat Sessions
  createLucaChatSession(session: schema.InsertLucaChatSession): Promise<schema.LucaChatSession>;
  getLucaChatSession(id: string): Promise<schema.LucaChatSession | undefined>;
  getLucaChatSessionsByUser(userId: string): Promise<schema.LucaChatSession[]>;
  updateLucaChatSession(id: string, updates: Partial<schema.InsertLucaChatSession>): Promise<schema.LucaChatSession | undefined>;
  deleteLucaChatSession(id: string): Promise<void>;
  
  // Luca Chat Messages
  createLucaChatMessage(message: schema.InsertLucaChatMessage): Promise<schema.LucaChatMessage>;
  getLucaChatMessagesBySession(sessionId: string): Promise<schema.LucaChatMessage[]>;
  deleteLucaChatMessagesBySession(sessionId: string): Promise<void>;

  // Workflows
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow & { organizationId: string; createdBy: string }): Promise<Workflow>;
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
  uninstallAiAgent(installationId: string, organizationId: string): Promise<void>;
  getAiAgentInstallation(agentId: string, organizationId: string): Promise<AiAgentInstallation | undefined>;
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

  // Document Templates
  getDocumentTemplate(id: string): Promise<schema.DocumentTemplate | undefined>;
  createDocumentTemplate(template: schema.InsertDocumentTemplate): Promise<schema.DocumentTemplate>;
  updateDocumentTemplate(id: string, template: Partial<schema.InsertDocumentTemplate>): Promise<schema.DocumentTemplate | undefined>;
  deleteDocumentTemplate(id: string): Promise<void>;
  getDocumentTemplatesByOrganization(organizationId: string): Promise<schema.DocumentTemplate[]>;
  getDocumentTemplatesByCategory(organizationId: string, category: string): Promise<schema.DocumentTemplate[]>;
  incrementTemplateUsage(id: string): Promise<void>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  deleteNotification(id: string): Promise<void>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByOrganization(organizationId: string, options?: {
    limit?: number;
    offset?: number;
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ActivityLog[]>;
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
  
  // Client-Contact Relationships (Multi-client support)
  getClientsForContact(contactId: string): Promise<Client[]>;
  getContactsForClient(clientId: string): Promise<Contact[]>;
  linkContactToClient(contactId: string, clientId: string, isPrimary: boolean, organizationId: string): Promise<ClientContact>;
  unlinkContactFromClient(contactId: string, clientId: string): Promise<void>;
  updateContactClientLink(contactId: string, clientId: string, updates: Partial<InsertClientContact>): Promise<ClientContact | undefined>;
  
  // Client Onboarding Sessions
  getOnboardingSession(id: string): Promise<ClientOnboardingSession | undefined>;
  createOnboardingSession(session: InsertClientOnboardingSession): Promise<ClientOnboardingSession>;
  updateOnboardingSession(id: string, session: Partial<InsertClientOnboardingSession>): Promise<ClientOnboardingSession>;
  getOnboardingSessionsByOrganization(organizationId: string): Promise<ClientOnboardingSession[]>;
  getOnboardingMessages(sessionId: string): Promise<OnboardingMessage[]>;
  createOnboardingMessage(message: InsertOnboardingMessage): Promise<OnboardingMessage>;
  
  // Team Management
  createTeam(team: schema.InsertTeam): Promise<schema.Team>;
  getTeamById(id: string): Promise<schema.Team | undefined>;
  getTeamsByOrganization(organizationId: string): Promise<schema.Team[]>;
  updateTeam(id: string, updates: Partial<schema.InsertTeam>): Promise<schema.Team | undefined>;
  deleteTeam(id: string): Promise<void>;
  
  addTeamMember(member: schema.InsertTeamMember): Promise<schema.TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  getTeamMembers(teamId: string): Promise<(schema.TeamMember & { user: User })[]>;
  getTeamsByUser(userId: string): Promise<(schema.TeamMember & { team: schema.Team })[]>;
  updateTeamMemberRole(teamId: string, userId: string, role: string): Promise<void>;
  
  createSupervisorRelationship(relationship: schema.InsertSupervisorRelationship): Promise<schema.SupervisorRelationship>;
  deleteSupervisorRelationship(supervisorId: string, reporteeId: string): Promise<void>;
  getReportees(supervisorId: string): Promise<User[]>;
  getSupervisors(reporteeId: string): Promise<User[]>;
  
  // Team Chat
  createTeamChatMessage(message: schema.InsertTeamChatMessage): Promise<schema.TeamChatMessage>;
  getTeamChatMessages(teamId: string, limit?: number): Promise<schema.TeamChatMessage[]>;
  getClientChatMessages(clientId: string, limit?: number): Promise<schema.TeamChatMessage[]>;
  
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
  
  // Platform Subscription Invoices
  createSubscriptionInvoice(invoice: schema.InsertSubscriptionInvoice): Promise<schema.SubscriptionInvoice>;
  getSubscriptionInvoice(id: string): Promise<schema.SubscriptionInvoice | undefined>;
  getSubscriptionInvoicesByOrganization(organizationId: string): Promise<schema.SubscriptionInvoice[]>;
  getSubscriptionInvoicesBySubscription(subscriptionId: string): Promise<schema.SubscriptionInvoice[]>;
  updateSubscriptionInvoice(id: string, invoice: Partial<schema.InsertSubscriptionInvoice>): Promise<schema.SubscriptionInvoice | undefined>;
  getDueSubscriptionInvoices(): Promise<schema.SubscriptionInvoice[]>;
  
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

  // AI Agent Sessions (Parity, Cadence, Forma)
  createAgentSession(session: schema.InsertAgentSession): Promise<schema.AgentSession>;
  getAgentSession(id: string): Promise<schema.AgentSession | undefined>;
  getAgentSessionsByUser(userId: string, agentSlug: string): Promise<schema.AgentSession[]>;
  updateAgentSession(id: string, name: string): Promise<schema.AgentSession | undefined>;
  deleteAgentSession(id: string): Promise<void>;
  
  createAgentMessage(message: schema.InsertAgentMessage): Promise<schema.AgentMessage>;
  getAgentMessagesBySession(sessionId: string): Promise<schema.AgentMessage[]>;

  // AI Roundtable - Multi-Agent Collaborative Sessions
  createRoundtableSession(session: schema.InsertRoundtableSession): Promise<schema.RoundtableSession>;
  getRoundtableSession(id: string): Promise<schema.RoundtableSession | undefined>;
  getRoundtableSessionsByUser(userId: string): Promise<schema.RoundtableSession[]>;
  getRoundtableSessionsByOrganization(organizationId: string): Promise<schema.RoundtableSession[]>;
  updateRoundtableSession(id: string, updates: Partial<schema.InsertRoundtableSession>): Promise<schema.RoundtableSession | undefined>;
  deleteRoundtableSession(id: string): Promise<void>;

  createRoundtableParticipant(participant: schema.InsertRoundtableParticipant): Promise<schema.RoundtableParticipant>;
  getRoundtableParticipant(id: string): Promise<schema.RoundtableParticipant | undefined>;
  getRoundtableParticipantsBySession(sessionId: string): Promise<schema.RoundtableParticipant[]>;
  updateRoundtableParticipant(id: string, updates: Partial<schema.InsertRoundtableParticipant>): Promise<schema.RoundtableParticipant | undefined>;
  deleteRoundtableParticipant(id: string): Promise<void>;

  createRoundtableMessage(message: schema.InsertRoundtableMessage): Promise<schema.RoundtableMessage>;
  getRoundtableMessage(id: string): Promise<schema.RoundtableMessage | undefined>;
  getRoundtableMessagesBySession(sessionId: string, channelType?: string): Promise<schema.RoundtableMessage[]>;
  getRoundtablePrivateMessages(sessionId: string, participantId: string): Promise<schema.RoundtableMessage[]>;
  updateRoundtableMessage(id: string, updates: Partial<schema.InsertRoundtableMessage>): Promise<schema.RoundtableMessage | undefined>;
  deleteRoundtableMessage(id: string): Promise<void>;

  createRoundtableDeliverable(deliverable: schema.InsertRoundtableDeliverable): Promise<schema.RoundtableDeliverable>;
  getRoundtableDeliverable(id: string): Promise<schema.RoundtableDeliverable | undefined>;
  getRoundtableDeliverablesBySession(sessionId: string): Promise<schema.RoundtableDeliverable[]>;
  updateRoundtableDeliverable(id: string, updates: Partial<schema.InsertRoundtableDeliverable>): Promise<schema.RoundtableDeliverable | undefined>;
  deleteRoundtableDeliverable(id: string): Promise<void>;
  setCurrentPresentation(sessionId: string, deliverableId: string): Promise<void>;
  clearCurrentPresentation(sessionId: string): Promise<void>;

  createRoundtableApproval(approval: schema.InsertRoundtableApproval): Promise<schema.RoundtableApproval>;
  getRoundtableApproval(id: string): Promise<schema.RoundtableApproval | undefined>;
  getRoundtableApprovalsByDeliverable(deliverableId: string): Promise<schema.RoundtableApproval[]>;
  getRoundtableApprovalsBySession(sessionId: string): Promise<schema.RoundtableApproval[]>;

  createRoundtableKnowledgeEntry(entry: schema.InsertRoundtableKnowledgeEntry): Promise<schema.RoundtableKnowledgeEntry>;
  getRoundtableKnowledgeEntry(id: string): Promise<schema.RoundtableKnowledgeEntry | undefined>;
  getRoundtableKnowledgeEntriesBySession(sessionId: string): Promise<schema.RoundtableKnowledgeEntry[]>;
  updateRoundtableKnowledgeEntry(id: string, updates: Partial<schema.InsertRoundtableKnowledgeEntry>): Promise<schema.RoundtableKnowledgeEntry | undefined>;
  deleteRoundtableKnowledgeEntry(id: string): Promise<void>;

  // TaxDome Features - Calendar & Appointments
  createAppointment(appointment: schema.InsertAppointment): Promise<schema.Appointment>;
  getAppointment(id: string): Promise<schema.Appointment | undefined>;
  getAppointmentsByOrganization(organizationId: string): Promise<schema.Appointment[]>;
  getAppointmentsByClient(clientId: string): Promise<schema.Appointment[]>;
  getAppointmentsByUser(userId: string): Promise<schema.Appointment[]>;
  updateAppointment(id: string, appointment: Partial<schema.InsertAppointment>): Promise<schema.Appointment | undefined>;
  deleteAppointment(id: string): Promise<void>;

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
  getAllLlmConfigurations(): Promise<schema.LlmConfiguration[]>; // Super Admin: get all configs
  getDefaultLlmConfiguration(organizationId: string): Promise<schema.LlmConfiguration | undefined>;
  updateLlmConfiguration(id: string, config: Partial<schema.InsertLlmConfiguration>): Promise<schema.LlmConfiguration | undefined>;
  deleteLlmConfiguration(id: string): Promise<void>;

  // Support Tickets
  createSupportTicket(ticket: schema.InsertSupportTicket): Promise<schema.SupportTicket>;
  getSupportTicket(id: string): Promise<schema.SupportTicket | undefined>;
  getSupportTickets(organizationId: string): Promise<schema.SupportTicket[]>;
  getAllSupportTickets(): Promise<schema.SupportTicket[]>; // Super Admin: get all tickets
  updateSupportTicket(id: string, ticket: Partial<schema.InsertSupportTicket>): Promise<schema.SupportTicket | undefined>;
  deleteSupportTicket(id: string): Promise<void>;

  // Support Ticket Comments
  createSupportTicketComment(comment: schema.InsertSupportTicketComment): Promise<schema.SupportTicketComment>;
  getTicketComments(ticketId: string): Promise<schema.SupportTicketComment[]>;

  // Workflow Assignments
  getWorkflowAssignment(id: string): Promise<schema.WorkflowAssignment | undefined>;
  createWorkflowAssignment(assignment: schema.InsertWorkflowAssignment): Promise<schema.WorkflowAssignment>;
  updateWorkflowAssignment(id: string, assignment: Partial<schema.InsertWorkflowAssignment>): Promise<schema.WorkflowAssignment | undefined>;
  deleteWorkflowAssignment(id: string): Promise<void>;
  getWorkflowAssignmentsByOrganization(organizationId: string): Promise<schema.WorkflowAssignment[]>;
  getWorkflowAssignmentsByClient(clientId: string): Promise<schema.WorkflowAssignment[]>;
  getWorkflowAssignmentsByWorkflow(workflowId: string): Promise<schema.WorkflowAssignment[]>;
  getWorkflowAssignmentsByEmployee(userId: string): Promise<schema.WorkflowAssignment[]>;

  // Email Accounts
  createEmailAccount(account: schema.InsertEmailAccount): Promise<schema.EmailAccount>;
  getEmailAccount(id: string): Promise<schema.EmailAccount | undefined>;
  getEmailAccountsByOrganization(organizationId: string): Promise<schema.EmailAccount[]>;
  getEmailAccountsByUser(userId: string): Promise<schema.EmailAccount[]>;
  updateEmailAccount(id: string, account: Partial<schema.InsertEmailAccount>): Promise<schema.EmailAccount | undefined>;
  deleteEmailAccount(id: string): Promise<void>;

  // Onboarding System
  createOnboardingProgress(progress: schema.InsertOnboardingProgress): Promise<schema.OnboardingProgress>;
  getOnboardingProgress(id: string): Promise<schema.OnboardingProgress | undefined>;
  getOnboardingProgressByUser(userId: string): Promise<schema.OnboardingProgress | undefined>;
  getOnboardingProgressByOrganization(organizationId: string): Promise<schema.OnboardingProgress[]>;
  getAllOnboardingProgress(): Promise<schema.OnboardingProgress[]>; // Super Admin
  updateOnboardingProgress(id: string, progress: Partial<schema.InsertOnboardingProgress>): Promise<schema.OnboardingProgress | undefined>;
  deleteOnboardingProgress(id: string): Promise<void>;
  createOnboardingTask(task: schema.InsertOnboardingTask): Promise<schema.OnboardingTask>;
  getOnboardingTasksByProgress(progressId: string): Promise<schema.OnboardingTask[]>;
  getOnboardingTasksByDay(progressId: string, day: number): Promise<schema.OnboardingTask[]>;
  updateOnboardingTask(id: string, task: Partial<schema.InsertOnboardingTask>): Promise<schema.OnboardingTask | undefined>;
  completeOnboardingTask(taskId: string): Promise<schema.OnboardingTask | undefined>;
  createOnboardingNudge(nudge: schema.InsertOnboardingNudge): Promise<schema.OnboardingNudge>;
  getOnboardingNudgesByProgress(progressId: string): Promise<schema.OnboardingNudge[]>;
  updateOnboardingNudge(id: string, nudge: Partial<schema.InsertOnboardingNudge>): Promise<schema.OnboardingNudge | undefined>;
  dismissOnboardingNudge(nudgeId: string): Promise<schema.OnboardingNudge | undefined>;

  // Email Messages
  createEmailMessage(message: schema.InsertEmailMessage): Promise<schema.EmailMessage>;
  getEmailMessage(id: string): Promise<schema.EmailMessage | undefined>;
  getEmailMessagesByAccount(emailAccountId: string): Promise<schema.EmailMessage[]>;
  getEmailMessagesByOrganization(organizationId: string): Promise<schema.EmailMessage[]>;
  updateEmailMessage(id: string, message: Partial<schema.InsertEmailMessage>): Promise<schema.EmailMessage | undefined>;
  deleteEmailMessage(id: string): Promise<void>;
  getUnprocessedEmails(organizationId: string): Promise<schema.EmailMessage[]>;

  // Assignment Workflow Cloning
  cloneWorkflowToAssignment(assignmentId: string, workflowId: string, organizationId: string): Promise<void>;
  
  // Assignment Workflow Stages
  createAssignmentWorkflowStage(stage: schema.InsertAssignmentWorkflowStage): Promise<schema.AssignmentWorkflowStage>;
  getAssignmentWorkflowStage(id: string): Promise<schema.AssignmentWorkflowStage | undefined>;
  getAssignmentStagesByAssignment(assignmentId: string): Promise<schema.AssignmentWorkflowStage[]>;
  updateAssignmentWorkflowStage(id: string, stage: Partial<schema.InsertAssignmentWorkflowStage>): Promise<schema.AssignmentWorkflowStage | undefined>;
  deleteAssignmentWorkflowStage(id: string): Promise<void>;
  
  // Assignment Workflow Steps
  createAssignmentWorkflowStep(step: schema.InsertAssignmentWorkflowStep): Promise<schema.AssignmentWorkflowStep>;
  getAssignmentWorkflowStep(id: string): Promise<schema.AssignmentWorkflowStep | undefined>;
  getAssignmentStepsByStage(stageId: string): Promise<schema.AssignmentWorkflowStep[]>;
  updateAssignmentWorkflowStep(id: string, step: Partial<schema.InsertAssignmentWorkflowStep>): Promise<schema.AssignmentWorkflowStep | undefined>;
  deleteAssignmentWorkflowStep(id: string): Promise<void>;
  
  // Assignment Workflow Tasks
  createAssignmentWorkflowTask(task: schema.InsertAssignmentWorkflowTask): Promise<schema.AssignmentWorkflowTask>;
  getAssignmentWorkflowTask(id: string): Promise<schema.AssignmentWorkflowTask | undefined>;
  getAssignmentTasksByStep(stepId: string): Promise<schema.AssignmentWorkflowTask[]>;
  updateAssignmentWorkflowTask(id: string, task: Partial<schema.InsertAssignmentWorkflowTask>): Promise<schema.AssignmentWorkflowTask | undefined>;
  deleteAssignmentWorkflowTask(id: string): Promise<void>;
  
  // Client Portal Tasks
  createClientPortalTask(task: schema.InsertClientPortalTask): Promise<schema.ClientPortalTask>;
  getClientPortalTask(id: string, organizationId: string): Promise<schema.ClientPortalTask | undefined>;
  getClientPortalTasksByClient(clientId: string, organizationId: string): Promise<schema.ClientPortalTask[]>;
  getClientPortalTasksByAssignment(assignmentId: string, organizationId: string): Promise<schema.ClientPortalTask[]>;
  getClientPortalTasksByContact(contactId: string, organizationId: string): Promise<schema.ClientPortalTask[]>;
  updateClientPortalTask(id: string, task: Partial<schema.InsertClientPortalTask>): Promise<schema.ClientPortalTask | undefined>;
  deleteClientPortalTask(id: string): Promise<void>;
  
  // Task Ingestion
  createTaskFromWorkflowTask(assignmentTaskId: string, organizationId: string, createdBy: string): Promise<schema.ClientPortalTask | null>;
  createTaskFromMessage(conversationId: string, messageId: string, title: string, description: string, organizationId: string, clientId: string, assignedTo: string | undefined, createdBy: string, dueDate?: Date): Promise<schema.ClientPortalTask>;
  createTaskFromFormRequest(formTemplateId: string, title: string, description: string, organizationId: string, clientId: string, assignmentId: string | undefined, assignedTo: string | undefined, createdBy: string, dueDate?: Date): Promise<schema.ClientPortalTask>;
  
  // Task Followups
  createTaskFollowup(followup: schema.InsertTaskFollowup): Promise<schema.TaskFollowup>;
  getTaskFollowup(id: string): Promise<schema.TaskFollowup | undefined>;
  getFollowupsByTask(taskId: string): Promise<schema.TaskFollowup[]>;
  getPendingFollowups(): Promise<schema.TaskFollowup[]>;
  updateTaskFollowup(id: string, followup: Partial<schema.InsertTaskFollowup>): Promise<schema.TaskFollowup | undefined>;
  deleteTaskFollowup(id: string): Promise<void>;
  
  // Email Templates
  createEmailTemplate(template: schema.InsertEmailTemplate): Promise<schema.EmailTemplate>;
  getEmailTemplate(id: string, organizationId: string): Promise<schema.EmailTemplate | undefined>;
  getEmailTemplatesByOrganization(organizationId: string): Promise<schema.EmailTemplate[]>;
  getEmailTemplateByCategory(organizationId: string, category: string): Promise<schema.EmailTemplate | undefined>;
  getDefaultEmailTemplate(category: string): Promise<schema.EmailTemplate | undefined>;
  updateEmailTemplate(id: string, organizationId: string, template: Partial<schema.InsertEmailTemplate>): Promise<schema.EmailTemplate | undefined>;
  deleteEmailTemplate(id: string, organizationId: string): Promise<void>;
  renderEmailTemplate(templateId: string, placeholders: Record<string, string>): Promise<{subject: string, body: string}>;
  
  // Message Templates
  createMessageTemplate(template: schema.InsertMessageTemplate): Promise<schema.MessageTemplate>;
  getMessageTemplate(id: string, organizationId: string): Promise<schema.MessageTemplate | undefined>;
  getMessageTemplatesByOrganization(organizationId: string): Promise<schema.MessageTemplate[]>;
  getMessageTemplateByCategory(organizationId: string, category: string): Promise<schema.MessageTemplate | undefined>;
  getDefaultMessageTemplate(category: string): Promise<schema.MessageTemplate | undefined>;
  updateMessageTemplate(id: string, organizationId: string, template: Partial<schema.InsertMessageTemplate>): Promise<schema.MessageTemplate | undefined>;
  deleteMessageTemplate(id: string, organizationId: string): Promise<void>;
  
  // Live Chat Support (Edge Subscription)
  createLiveChatConversation(conversation: schema.InsertLiveChatConversation): Promise<schema.LiveChatConversation>;
  getLiveChatConversation(id: string): Promise<schema.LiveChatConversation | undefined>;
  getLiveChatConversationsByOrganization(organizationId: string): Promise<schema.LiveChatConversation[]>;
  getLiveChatConversationsByUser(userId: string): Promise<schema.LiveChatConversation[]>;
  getLiveChatConversationsByAgent(agentId: string): Promise<schema.LiveChatConversation[]>;
  updateLiveChatConversation(id: string, conversation: Partial<schema.InsertLiveChatConversation>): Promise<schema.LiveChatConversation | undefined>;
  
  createLiveChatMessage(message: schema.InsertLiveChatMessage): Promise<schema.LiveChatMessage>;
  getLiveChatMessage(id: string): Promise<schema.LiveChatMessage | undefined>;
  getLiveChatMessages(conversationId: string): Promise<schema.LiveChatMessage[]>;
  markLiveChatMessagesAsRead(conversationId: string, userId: string): Promise<void>;
  
  createAgentAvailability(availability: schema.InsertAgentAvailability): Promise<schema.AgentAvailability>;
  getAgentAvailability(userId: string): Promise<schema.AgentAvailability | undefined>;
  getAllAgentAvailability(): Promise<schema.AgentAvailability[]>;
  updateAgentAvailability(userId: string, availability: Partial<schema.InsertAgentAvailability>): Promise<schema.AgentAvailability | undefined>;
  getAvailableAgents(): Promise<schema.AgentAvailability[]>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select({
        ...Object.fromEntries(
          Object.keys(schema.users).map(key => [key, schema.users[key as keyof typeof schema.users]])
        ),
        role: schema.roles
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .where(eq(schema.users.id, id));
    return result[0] as any;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.phone, phone));
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
    await db.delete(schema.activityLogs).where(eq(schema.activityLogs.userId, id));
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

  // Platform Subscriptions (Super Admin)
  async getPlatformSubscriptionByOrganization(organizationId: string): Promise<schema.PlatformSubscription | undefined> {
    const result = await db.select().from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.organizationId, organizationId));
    return result[0];
  }

  async getAllPlatformSubscriptions(): Promise<schema.PlatformSubscription[]> {
    return await db.select().from(schema.platformSubscriptions);
  }

  async createPlatformSubscription(subscription: schema.InsertPlatformSubscription): Promise<schema.PlatformSubscription> {
    const result = await db.insert(schema.platformSubscriptions).values(subscription).returning();
    return result[0];
  }

  async updatePlatformSubscription(id: string, subscription: Partial<schema.InsertPlatformSubscription>): Promise<schema.PlatformSubscription | undefined> {
    const result = await db.update(schema.platformSubscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(schema.platformSubscriptions.id, id))
      .returning();
    return result[0];
  }

  // Alias for feature gating system
  async getActiveSubscriptionByOrganization(organizationId: string): Promise<schema.PlatformSubscription | undefined> {
    const result = await db.select().from(schema.platformSubscriptions)
      .where(and(
        eq(schema.platformSubscriptions.organizationId, organizationId),
        eq(schema.platformSubscriptions.status, 'active')
      ));
    return result[0];
  }

  async getSubscriptionPlan(planId: string): Promise<schema.SubscriptionPlan | undefined> {
    const result = await db.select().from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, planId));
    return result[0];
  }

  // Subscription Add-ons
  async getSubscriptionAddonsBySubscription(
    subscriptionId: string
  ): Promise<Array<{ addon: schema.SubscriptionAddon; details: schema.PlanAddon }>> {
    const result = await db
      .select({
        addon: schema.subscriptionAddons,
        details: schema.planAddons
      })
      .from(schema.subscriptionAddons)
      .innerJoin(
        schema.planAddons,
        eq(schema.subscriptionAddons.addonId, schema.planAddons.id)
      )
      .where(
        and(
          eq(schema.subscriptionAddons.subscriptionId, subscriptionId),
          eq(schema.subscriptionAddons.status, 'active')
        )
      );
    return result;
  }

  async getActiveAddonsForOrganization(
    organizationId: string
  ): Promise<Array<{ addon: schema.SubscriptionAddon; details: schema.PlanAddon }>> {
    // Get active subscription first
    const subscription = await this.getActiveSubscriptionByOrganization(organizationId);
    if (!subscription) {
      return [];
    }
    
    // Get add-ons for that subscription
    return await this.getSubscriptionAddonsBySubscription(subscription.id);
  }

  // Get organization (includes test account flag)
  async getOrganization(organizationId: string): Promise<schema.Organization | undefined> {
    const result = await db.select().from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
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

  // OTP Verification Methods
  async createOtpVerification(data: schema.InsertOtpVerification): Promise<schema.OtpVerification> {
    const result = await db.insert(schema.otpVerifications).values(data).returning();
    return result[0];
  }

  async getLatestOtpByPhone(phone: string): Promise<schema.OtpVerification | undefined> {
    const result = await db
      .select()
      .from(schema.otpVerifications)
      .where(eq(schema.otpVerifications.phone, phone))
      .orderBy(desc(schema.otpVerifications.createdAt))
      .limit(1);
    return result[0];
  }

  async verifyOtp(id: string): Promise<schema.OtpVerification | undefined> {
    const result = await db
      .update(schema.otpVerifications)
      .set({ verified: true })
      .where(eq(schema.otpVerifications.id, id))
      .returning();
    return result[0];
  }

  async deleteExpiredOtps(): Promise<void> {
    await db.delete(schema.otpVerifications).where(lt(schema.otpVerifications.expiresAt, new Date()));
  }

  // Luca Chat Sessions
  async createLucaChatSession(session: schema.InsertLucaChatSession): Promise<schema.LucaChatSession> {
    const result = await db.insert(schema.lucaChatSessions).values(session).returning();
    return result[0];
  }

  async getLucaChatSession(id: string): Promise<schema.LucaChatSession | undefined> {
    const result = await db.select().from(schema.lucaChatSessions).where(eq(schema.lucaChatSessions.id, id));
    return result[0];
  }

  async getLucaChatSessionsByUser(userId: string): Promise<schema.LucaChatSession[]> {
    return await db.select()
      .from(schema.lucaChatSessions)
      .where(and(
        eq(schema.lucaChatSessions.userId, userId),
        eq(schema.lucaChatSessions.isActive, true)
      ))
      .orderBy(desc(schema.lucaChatSessions.lastMessageAt));
  }

  async updateLucaChatSession(id: string, updates: Partial<schema.InsertLucaChatSession>): Promise<schema.LucaChatSession | undefined> {
    const result = await db.update(schema.lucaChatSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.lucaChatSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteLucaChatSession(id: string): Promise<void> {
    await db.delete(schema.lucaChatSessions).where(eq(schema.lucaChatSessions.id, id));
  }

  // Luca Chat Messages
  async createLucaChatMessage(message: schema.InsertLucaChatMessage): Promise<schema.LucaChatMessage> {
    const result = await db.insert(schema.lucaChatMessages).values(message).returning();
    return result[0];
  }

  async getLucaChatMessagesBySession(sessionId: string): Promise<schema.LucaChatMessage[]> {
    return await db.select()
      .from(schema.lucaChatMessages)
      .where(eq(schema.lucaChatMessages.sessionId, sessionId))
      .orderBy(schema.lucaChatMessages.createdAt);
  }

  async deleteLucaChatMessagesBySession(sessionId: string): Promise<void> {
    await db.delete(schema.lucaChatMessages).where(eq(schema.lucaChatMessages.sessionId, sessionId));
  }

  // Workflows
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const result = await db.select().from(schema.workflows).where(eq(schema.workflows.id, id));
    return result[0];
  }

  async createWorkflow(workflow: InsertWorkflow & { organizationId: string | null; createdBy: string }): Promise<Workflow> {
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
      .where(
        or(
          eq(schema.workflows.organizationId, organizationId),
          isNull(schema.workflows.organizationId) // Include global templates
        )
      )
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
    const existing = await db.select().from(schema.aiAgents)
      .where(eq(schema.aiAgents.name, agent.name))
      .limit(1);
    
    if (existing.length > 0) {
      throw new Error(`An agent with the name "${agent.name}" already exists`);
    }

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

    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.aiAgentInstallations)
      .where(eq(schema.aiAgentInstallations.agentId, agentId));
    
    await db.update(schema.aiAgents)
      .set({ installCount: countResult[0].count })
      .where(eq(schema.aiAgents.id, agentId));

    return result[0];
  }

  async uninstallAiAgent(installationId: string, organizationId: string): Promise<void> {
    const installation = await db.select().from(schema.aiAgentInstallations)
      .where(and(
        eq(schema.aiAgentInstallations.id, installationId),
        eq(schema.aiAgentInstallations.organizationId, organizationId)
      ));

    if (installation.length === 0) {
      throw new Error("Installation not found or unauthorized");
    }

    const agentId = installation[0].agentId;

    await db.delete(schema.aiAgentInstallations)
      .where(eq(schema.aiAgentInstallations.id, installationId));

    if (agentId) {
      const countResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.aiAgentInstallations)
        .where(eq(schema.aiAgentInstallations.agentId, agentId));
      
      await db.update(schema.aiAgents)
        .set({ installCount: countResult[0].count })
        .where(eq(schema.aiAgents.id, agentId));
    }
  }

  async getAiAgentInstallation(agentId: string, organizationId: string): Promise<AiAgentInstallation | undefined> {
    const result = await db.select().from(schema.aiAgentInstallations)
      .where(and(
        eq(schema.aiAgentInstallations.agentId, agentId),
        eq(schema.aiAgentInstallations.organizationId, organizationId),
        eq(schema.aiAgentInstallations.isActive, true)
      ));
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

  // Document Templates
  async getDocumentTemplate(id: string): Promise<schema.DocumentTemplate | undefined> {
    const result = await db.select().from(schema.documentTemplates).where(eq(schema.documentTemplates.id, id));
    return result[0];
  }

  async createDocumentTemplate(template: schema.InsertDocumentTemplate): Promise<schema.DocumentTemplate> {
    const result = await db.insert(schema.documentTemplates).values(template).returning();
    return result[0];
  }

  async updateDocumentTemplate(id: string, template: Partial<schema.InsertDocumentTemplate>): Promise<schema.DocumentTemplate | undefined> {
    const result = await db.update(schema.documentTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(schema.documentTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteDocumentTemplate(id: string): Promise<void> {
    await db.delete(schema.documentTemplates).where(eq(schema.documentTemplates.id, id));
  }

  async getDocumentTemplatesByOrganization(organizationId: string): Promise<schema.DocumentTemplate[]> {
    return await db.select().from(schema.documentTemplates)
      .where(
        and(
          or(
            eq(schema.documentTemplates.organizationId, organizationId),
            sql`${schema.documentTemplates.organizationId} IS NULL` // Include system templates
          ),
          eq(schema.documentTemplates.isActive, true)
        )
      )
      .orderBy(desc(schema.documentTemplates.createdAt));
  }

  async getDocumentTemplatesByCategory(organizationId: string, category: string): Promise<schema.DocumentTemplate[]> {
    return await db.select().from(schema.documentTemplates)
      .where(
        and(
          or(
            eq(schema.documentTemplates.organizationId, organizationId),
            sql`${schema.documentTemplates.organizationId} IS NULL` // Include system templates
          ),
          eq(schema.documentTemplates.category, category),
          eq(schema.documentTemplates.isActive, true)
        )
      )
      .orderBy(desc(schema.documentTemplates.usageCount), desc(schema.documentTemplates.createdAt));
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db.update(schema.documentTemplates)
      .set({ usageCount: sql`${schema.documentTemplates.usageCount} + 1`, updatedAt: new Date() })
      .where(eq(schema.documentTemplates.id, id));
  }

  // Marketplace Items
  async getMarketplaceItem(id: string): Promise<schema.MarketplaceItem | undefined> {
    const result = await db.select().from(schema.marketplaceItems).where(eq(schema.marketplaceItems.id, id));
    return result[0];
  }

  async createMarketplaceItem(item: schema.InsertMarketplaceItem): Promise<schema.MarketplaceItem> {
    const result = await db.insert(schema.marketplaceItems).values(item).returning();
    return result[0];
  }

  async updateMarketplaceItem(id: string, item: Partial<schema.InsertMarketplaceItem>): Promise<schema.MarketplaceItem | undefined> {
    const result = await db.update(schema.marketplaceItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(schema.marketplaceItems.id, id))
      .returning();
    return result[0];
  }

  async deleteMarketplaceItem(id: string): Promise<void> {
    await db.delete(schema.marketplaceItems).where(eq(schema.marketplaceItems.id, id));
  }

  async getMarketplaceItemsByCategory(category: string): Promise<schema.MarketplaceItem[]> {
    return await db.select().from(schema.marketplaceItems)
      .where(
        and(
          eq(schema.marketplaceItems.category, category),
          eq(schema.marketplaceItems.status, 'published'),
          eq(schema.marketplaceItems.isPublic, true)
        )
      )
      .orderBy(desc(schema.marketplaceItems.isFeatured), desc(schema.marketplaceItems.rating), desc(schema.marketplaceItems.installCount));
  }

  async getMarketplaceItemsForOrganization(organizationId: string, category?: string): Promise<schema.MarketplaceItem[]> {
    const conditions = [
      eq(schema.marketplaceItems.status, 'published'),
      or(
        eq(schema.marketplaceItems.isPublic, true), // Include all public items
        eq(schema.marketplaceItems.organizationId, organizationId) // Include org-specific items
      )
    ];
    
    if (category) {
      conditions.push(eq(schema.marketplaceItems.category, category));
    }

    return await db.select().from(schema.marketplaceItems)
      .where(and(...conditions))
      .orderBy(desc(schema.marketplaceItems.isFeatured), desc(schema.marketplaceItems.rating), desc(schema.marketplaceItems.installCount));
  }

  async getAllPublishedMarketplaceItems(): Promise<schema.MarketplaceItem[]> {
    return await db.select().from(schema.marketplaceItems)
      .where(
        and(
          eq(schema.marketplaceItems.status, 'published'),
          eq(schema.marketplaceItems.isPublic, true)
        )
      )
      .orderBy(desc(schema.marketplaceItems.isFeatured), desc(schema.marketplaceItems.rating));
  }

  async getOrganizationMarketplaceItems(organizationId: string): Promise<schema.MarketplaceItem[]> {
    return await db.select().from(schema.marketplaceItems)
      .where(eq(schema.marketplaceItems.organizationId, organizationId))
      .orderBy(desc(schema.marketplaceItems.updatedAt));
  }

  async incrementMarketplaceInstallCount(id: string): Promise<void> {
    await db.update(schema.marketplaceItems)
      .set({ installCount: sql`${schema.marketplaceItems.installCount} + 1`, updatedAt: new Date() })
      .where(eq(schema.marketplaceItems.id, id));
  }

  // Marketplace Installations
  async getMarketplaceInstallation(id: string): Promise<schema.MarketplaceInstallation | undefined> {
    const result = await db.select().from(schema.marketplaceInstallations).where(eq(schema.marketplaceInstallations.id, id));
    return result[0];
  }

  async createMarketplaceInstallation(installation: schema.InsertMarketplaceInstallation): Promise<schema.MarketplaceInstallation> {
    const result = await db.insert(schema.marketplaceInstallations).values(installation).returning();
    return result[0];
  }

  async deleteMarketplaceInstallation(id: string): Promise<void> {
    await db.delete(schema.marketplaceInstallations).where(eq(schema.marketplaceInstallations.id, id));
  }

  async getMarketplaceInstallationsByOrganization(organizationId: string): Promise<schema.MarketplaceInstallation[]> {
    return await db.select().from(schema.marketplaceInstallations)
      .where(
        and(
          eq(schema.marketplaceInstallations.organizationId, organizationId),
          eq(schema.marketplaceInstallations.isActive, true)
        )
      )
      .orderBy(desc(schema.marketplaceInstallations.installedAt));
  }

  async getMarketplaceInstallationByItemAndOrg(itemId: string, organizationId: string): Promise<schema.MarketplaceInstallation | undefined> {
    const result = await db.select().from(schema.marketplaceInstallations)
      .where(
        and(
          eq(schema.marketplaceInstallations.itemId, itemId),
          eq(schema.marketplaceInstallations.organizationId, organizationId)
        )
      );
    return result[0];
  }

  // Workflow Assignments
  async getWorkflowAssignment(id: string): Promise<schema.WorkflowAssignment | undefined> {
    const result = await db.select().from(schema.workflowAssignments).where(eq(schema.workflowAssignments.id, id));
    return result[0];
  }

  async createWorkflowAssignment(assignment: schema.InsertWorkflowAssignment): Promise<schema.WorkflowAssignment> {
    const result = await db.insert(schema.workflowAssignments).values(assignment).returning();
    return result[0];
  }

  async updateWorkflowAssignment(id: string, assignment: Partial<schema.InsertWorkflowAssignment>): Promise<schema.WorkflowAssignment | undefined> {
    const result = await db.update(schema.workflowAssignments)
      .set({ ...assignment, updatedAt: new Date() })
      .where(eq(schema.workflowAssignments.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkflowAssignment(id: string): Promise<void> {
    await db.delete(schema.workflowAssignments).where(eq(schema.workflowAssignments.id, id));
  }

  async getWorkflowAssignmentsByOrganization(organizationId: string): Promise<schema.WorkflowAssignment[]> {
    return await db.select().from(schema.workflowAssignments)
      .where(eq(schema.workflowAssignments.organizationId, organizationId))
      .orderBy(desc(schema.workflowAssignments.createdAt));
  }

  async getWorkflowAssignmentsByClient(clientId: string): Promise<schema.WorkflowAssignment[]> {
    return await db.select().from(schema.workflowAssignments)
      .where(eq(schema.workflowAssignments.clientId, clientId))
      .orderBy(desc(schema.workflowAssignments.createdAt));
  }

  async getWorkflowAssignmentsByWorkflow(workflowId: string): Promise<schema.WorkflowAssignment[]> {
    return await db.select().from(schema.workflowAssignments)
      .where(eq(schema.workflowAssignments.workflowId, workflowId))
      .orderBy(desc(schema.workflowAssignments.createdAt));
  }

  async getWorkflowAssignmentsByEmployee(userId: string): Promise<schema.WorkflowAssignment[]> {
    return await db.select().from(schema.workflowAssignments)
      .where(eq(schema.workflowAssignments.assignedTo, userId))
      .orderBy(desc(schema.workflowAssignments.dueDate));
  }

  // Email Accounts
  async createEmailAccount(account: schema.InsertEmailAccount): Promise<schema.EmailAccount> {
    const result = await db.insert(schema.emailAccounts).values(account).returning();
    return result[0];
  }

  async getEmailAccount(id: string): Promise<schema.EmailAccount | undefined> {
    const result = await db.select().from(schema.emailAccounts).where(eq(schema.emailAccounts.id, id));
    return result[0];
  }

  async getEmailAccountsByOrganization(organizationId: string): Promise<schema.EmailAccount[]> {
    return await db.select().from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.organizationId, organizationId))
      .orderBy(desc(schema.emailAccounts.createdAt));
  }

  async getEmailAccountsByUser(userId: string): Promise<schema.EmailAccount[]> {
    return await db.select().from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.userId, userId))
      .orderBy(desc(schema.emailAccounts.createdAt));
  }

  async updateEmailAccount(id: string, account: Partial<schema.InsertEmailAccount>): Promise<schema.EmailAccount | undefined> {
    const result = await db.update(schema.emailAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(schema.emailAccounts.id, id))
      .returning();
    return result[0];
  }

  async deleteEmailAccount(id: string): Promise<void> {
    await db.delete(schema.emailAccounts).where(eq(schema.emailAccounts.id, id));
  }

  // Email Messages
  async createEmailMessage(message: schema.InsertEmailMessage): Promise<schema.EmailMessage> {
    const result = await db.insert(schema.emailMessages).values(message).returning();
    return result[0];
  }

  async getEmailMessage(id: string): Promise<schema.EmailMessage | undefined> {
    const result = await db.select().from(schema.emailMessages).where(eq(schema.emailMessages.id, id));
    return result[0];
  }

  async getEmailMessageByExternalId(messageId: string): Promise<schema.EmailMessage | undefined> {
    const result = await db.select().from(schema.emailMessages).where(eq(schema.emailMessages.messageId, messageId));
    return result[0];
  }

  async getEmailMessagesByAccount(emailAccountId: string): Promise<schema.EmailMessage[]> {
    return await db.select().from(schema.emailMessages)
      .where(eq(schema.emailMessages.emailAccountId, emailAccountId))
      .orderBy(desc(schema.emailMessages.receivedAt));
  }

  async getEmailMessagesByOrganization(organizationId: string): Promise<schema.EmailMessage[]> {
    return await db.select().from(schema.emailMessages)
      .where(eq(schema.emailMessages.organizationId, organizationId))
      .orderBy(desc(schema.emailMessages.receivedAt));
  }

  async updateEmailMessage(id: string, message: Partial<schema.InsertEmailMessage>): Promise<schema.EmailMessage | undefined> {
    const result = await db.update(schema.emailMessages)
      .set(message)
      .where(eq(schema.emailMessages.id, id))
      .returning();
    return result[0];
  }

  async deleteEmailMessage(id: string): Promise<void> {
    await db.delete(schema.emailMessages).where(eq(schema.emailMessages.id, id));
  }

  async getUnprocessedEmails(organizationId: string): Promise<schema.EmailMessage[]> {
    return await db.select().from(schema.emailMessages)
      .where(
        and(
          eq(schema.emailMessages.organizationId, organizationId),
          eq(schema.emailMessages.aiProcessed, false)
        )
      )
      .orderBy(desc(schema.emailMessages.receivedAt));
  }

  // Onboarding System
  async createOnboardingProgress(progress: schema.InsertOnboardingProgress): Promise<schema.OnboardingProgress> {
    const result = await db.insert(schema.onboardingProgress).values(progress).returning();
    return result[0];
  }

  async getOnboardingProgress(id: string): Promise<schema.OnboardingProgress | undefined> {
    const result = await db.select().from(schema.onboardingProgress)
      .where(eq(schema.onboardingProgress.id, id));
    return result[0];
  }

  async getOnboardingProgressByUser(userId: string): Promise<schema.OnboardingProgress | undefined> {
    const result = await db.select().from(schema.onboardingProgress)
      .where(eq(schema.onboardingProgress.userId, userId));
    return result[0];
  }

  async getOnboardingProgressByOrganization(organizationId: string): Promise<schema.OnboardingProgress[]> {
    return await db.select().from(schema.onboardingProgress)
      .where(eq(schema.onboardingProgress.organizationId, organizationId))
      .orderBy(desc(schema.onboardingProgress.createdAt));
  }

  async getAllOnboardingProgress(): Promise<schema.OnboardingProgress[]> {
    return await db.select().from(schema.onboardingProgress)
      .orderBy(desc(schema.onboardingProgress.createdAt));
  }

  async updateOnboardingProgress(id: string, progress: Partial<schema.InsertOnboardingProgress>): Promise<schema.OnboardingProgress | undefined> {
    const result = await db.update(schema.onboardingProgress)
      .set({ ...progress, updatedAt: new Date() })
      .where(eq(schema.onboardingProgress.id, id))
      .returning();
    return result[0];
  }

  async deleteOnboardingProgress(id: string): Promise<void> {
    await db.delete(schema.onboardingProgress).where(eq(schema.onboardingProgress.id, id));
  }

  async createOnboardingTask(task: schema.InsertOnboardingTask): Promise<schema.OnboardingTask> {
    const result = await db.insert(schema.onboardingTasks).values(task).returning();
    return result[0];
  }

  async getOnboardingTasksByProgress(progressId: string): Promise<schema.OnboardingTask[]> {
    return await db.select().from(schema.onboardingTasks)
      .where(eq(schema.onboardingTasks.progressId, progressId))
      .orderBy(schema.onboardingTasks.day, schema.onboardingTasks.createdAt);
  }

  async getOnboardingTasksByDay(progressId: string, day: number): Promise<schema.OnboardingTask[]> {
    return await db.select().from(schema.onboardingTasks)
      .where(
        and(
          eq(schema.onboardingTasks.progressId, progressId),
          eq(schema.onboardingTasks.day, day)
        )
      )
      .orderBy(schema.onboardingTasks.createdAt);
  }

  async updateOnboardingTask(id: string, task: Partial<schema.InsertOnboardingTask>): Promise<schema.OnboardingTask | undefined> {
    const result = await db.update(schema.onboardingTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(schema.onboardingTasks.id, id))
      .returning();
    return result[0];
  }

  async completeOnboardingTask(taskId: string): Promise<schema.OnboardingTask | undefined> {
    const result = await db.update(schema.onboardingTasks)
      .set({ 
        isCompleted: true, 
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.onboardingTasks.id, taskId))
      .returning();
    return result[0];
  }

  async createOnboardingNudge(nudge: schema.InsertOnboardingNudge): Promise<schema.OnboardingNudge> {
    const result = await db.insert(schema.onboardingNudges).values(nudge).returning();
    return result[0];
  }

  async getOnboardingNudgesByProgress(progressId: string): Promise<schema.OnboardingNudge[]> {
    return await db.select().from(schema.onboardingNudges)
      .where(eq(schema.onboardingNudges.progressId, progressId))
      .orderBy(desc(schema.onboardingNudges.lastShownAt));
  }

  async updateOnboardingNudge(id: string, nudge: Partial<schema.InsertOnboardingNudge>): Promise<schema.OnboardingNudge | undefined> {
    const result = await db.update(schema.onboardingNudges)
      .set(nudge)
      .where(eq(schema.onboardingNudges.id, id))
      .returning();
    return result[0];
  }

  async dismissOnboardingNudge(nudgeId: string): Promise<schema.OnboardingNudge | undefined> {
    const result = await db.update(schema.onboardingNudges)
      .set({ 
        isDismissed: true, 
        dismissedAt: new Date()
      })
      .where(eq(schema.onboardingNudges.id, nudgeId))
      .returning();
    return result[0];
  }

  // Assignment Workflow Cloning
  async cloneWorkflowToAssignment(assignmentId: string, workflowId: string, organizationId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Verify assignment belongs to the organization (security check)
      const assignmentResult = await tx.select().from(schema.workflowAssignments)
        .where(eq(schema.workflowAssignments.id, assignmentId));
      
      if (assignmentResult.length === 0 || assignmentResult[0].organizationId !== organizationId) {
        throw new Error('Assignment not found or does not belong to this organization');
      }

      // Verify workflow belongs to the same organization (security check)
      const workflowResult = await tx.select().from(schema.workflows)
        .where(eq(schema.workflows.id, workflowId));
      
      if (workflowResult.length === 0 || workflowResult[0].organizationId !== organizationId) {
        throw new Error('Workflow not found or does not belong to this organization');
      }

      const stages = await tx.select().from(schema.workflowStages)
        .where(eq(schema.workflowStages.workflowId, workflowId))
        .orderBy(schema.workflowStages.order);

      for (const stage of stages) {
        const assignmentStage = await tx.insert(schema.assignmentWorkflowStages).values({
          assignmentId,
          organizationId,
          templateStageId: stage.id,
          name: stage.name,
          description: stage.description,
          order: stage.order,
          status: 'not_started',
          autoProgress: stage.autoProgress,
        }).returning();

        const steps = await tx.select().from(schema.workflowSteps)
          .where(eq(schema.workflowSteps.stageId, stage.id))
          .orderBy(schema.workflowSteps.order);

        for (const step of steps) {
          const assignmentStep = await tx.insert(schema.assignmentWorkflowSteps).values({
            assignmentStageId: assignmentStage[0].id,
            organizationId,
            templateStepId: step.id,
            name: step.name,
            description: step.description,
            order: step.order,
            status: 'pending',
            autoProgress: step.autoProgress,
          }).returning();

          const tasks = await tx.select().from(schema.workflowTasks)
            .where(eq(schema.workflowTasks.stepId, step.id))
            .orderBy(schema.workflowTasks.order);

          for (const task of tasks) {
            await tx.insert(schema.assignmentWorkflowTasks).values({
              assignmentStepId: assignmentStep[0].id,
              organizationId,
              templateTaskId: task.id,
              name: task.name,
              description: task.description,
              type: task.type,
              order: task.order,
              status: 'pending',
              priority: task.priority,
              assignedTo: task.assignedTo,
              dueDate: task.dueDate,
              aiAgentId: task.aiAgentId,
              automationInput: task.automationInput,
              automationOutput: task.automationOutput,
              autoProgress: task.autoProgress,
            });
          }
        }
      }
    });
  }

  // Assignment Workflow Stages
  async createAssignmentWorkflowStage(stage: schema.InsertAssignmentWorkflowStage): Promise<schema.AssignmentWorkflowStage> {
    const result = await db.insert(schema.assignmentWorkflowStages).values(stage).returning();
    return result[0];
  }

  async getAssignmentWorkflowStage(id: string): Promise<schema.AssignmentWorkflowStage | undefined> {
    const result = await db.select().from(schema.assignmentWorkflowStages).where(eq(schema.assignmentWorkflowStages.id, id));
    return result[0];
  }

  async getAssignmentStagesByAssignment(assignmentId: string): Promise<schema.AssignmentWorkflowStage[]> {
    return await db.select().from(schema.assignmentWorkflowStages)
      .where(eq(schema.assignmentWorkflowStages.assignmentId, assignmentId))
      .orderBy(schema.assignmentWorkflowStages.order);
  }

  async updateAssignmentWorkflowStage(id: string, stage: Partial<schema.InsertAssignmentWorkflowStage>): Promise<schema.AssignmentWorkflowStage | undefined> {
    const result = await db.update(schema.assignmentWorkflowStages)
      .set({ ...stage, updatedAt: new Date() })
      .where(eq(schema.assignmentWorkflowStages.id, id))
      .returning();
    return result[0];
  }

  async deleteAssignmentWorkflowStage(id: string): Promise<void> {
    await db.delete(schema.assignmentWorkflowStages).where(eq(schema.assignmentWorkflowStages.id, id));
  }

  // Assignment Workflow Steps
  async createAssignmentWorkflowStep(step: schema.InsertAssignmentWorkflowStep): Promise<schema.AssignmentWorkflowStep> {
    const result = await db.insert(schema.assignmentWorkflowSteps).values(step).returning();
    return result[0];
  }

  async getAssignmentWorkflowStep(id: string): Promise<schema.AssignmentWorkflowStep | undefined> {
    const result = await db.select().from(schema.assignmentWorkflowSteps).where(eq(schema.assignmentWorkflowSteps.id, id));
    return result[0];
  }

  async getAssignmentStepsByStage(stageId: string): Promise<schema.AssignmentWorkflowStep[]> {
    return await db.select().from(schema.assignmentWorkflowSteps)
      .where(eq(schema.assignmentWorkflowSteps.assignmentStageId, stageId))
      .orderBy(schema.assignmentWorkflowSteps.order);
  }

  async updateAssignmentWorkflowStep(id: string, step: Partial<schema.InsertAssignmentWorkflowStep>): Promise<schema.AssignmentWorkflowStep | undefined> {
    const result = await db.update(schema.assignmentWorkflowSteps)
      .set({ ...step, updatedAt: new Date() })
      .where(eq(schema.assignmentWorkflowSteps.id, id))
      .returning();
    return result[0];
  }

  async deleteAssignmentWorkflowStep(id: string): Promise<void> {
    await db.delete(schema.assignmentWorkflowSteps).where(eq(schema.assignmentWorkflowSteps.id, id));
  }

  // Assignment Workflow Tasks
  async createAssignmentWorkflowTask(task: schema.InsertAssignmentWorkflowTask): Promise<schema.AssignmentWorkflowTask> {
    const result = await db.insert(schema.assignmentWorkflowTasks).values(task).returning();
    return result[0];
  }

  async getAssignmentWorkflowTask(id: string): Promise<schema.AssignmentWorkflowTask | undefined> {
    const result = await db.select().from(schema.assignmentWorkflowTasks).where(eq(schema.assignmentWorkflowTasks.id, id));
    return result[0];
  }

  async getAssignmentTasksByStep(stepId: string): Promise<schema.AssignmentWorkflowTask[]> {
    return await db.select().from(schema.assignmentWorkflowTasks)
      .where(eq(schema.assignmentWorkflowTasks.assignmentStepId, stepId))
      .orderBy(schema.assignmentWorkflowTasks.order);
  }

  async updateAssignmentWorkflowTask(id: string, task: Partial<schema.InsertAssignmentWorkflowTask>): Promise<schema.AssignmentWorkflowTask | undefined> {
    const result = await db.update(schema.assignmentWorkflowTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(schema.assignmentWorkflowTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteAssignmentWorkflowTask(id: string): Promise<void> {
    await db.delete(schema.assignmentWorkflowTasks).where(eq(schema.assignmentWorkflowTasks.id, id));
  }

  // Client Portal Tasks
  async createClientPortalTask(task: schema.InsertClientPortalTask): Promise<schema.ClientPortalTask> {
    const result = await db.insert(schema.clientPortalTasks).values(task).returning();
    return result[0];
  }

  async getClientPortalTask(id: string, organizationId: string): Promise<schema.ClientPortalTask | undefined> {
    const result = await db.select().from(schema.clientPortalTasks)
      .where(
        and(
          eq(schema.clientPortalTasks.id, id),
          eq(schema.clientPortalTasks.organizationId, organizationId)
        )
      );
    return result[0];
  }

  async getClientPortalTasksByClient(clientId: string, organizationId: string): Promise<schema.ClientPortalTask[]> {
    // Filter by organizationId on base table first to enforce tenant boundary
    return await db.select().from(schema.clientPortalTasks)
      .where(
        and(
          eq(schema.clientPortalTasks.clientId, clientId),
          eq(schema.clientPortalTasks.organizationId, organizationId)
        )
      )
      .orderBy(desc(schema.clientPortalTasks.createdAt));
  }

  async getClientPortalTasksByAssignment(assignmentId: string, organizationId: string): Promise<schema.ClientPortalTask[]> {
    // Filter by organizationId on base table first to enforce tenant boundary
    return await db.select().from(schema.clientPortalTasks)
      .where(
        and(
          eq(schema.clientPortalTasks.assignmentId, assignmentId),
          eq(schema.clientPortalTasks.organizationId, organizationId)
        )
      )
      .orderBy(desc(schema.clientPortalTasks.createdAt));
  }

  async getClientPortalTasksByContact(contactId: string, organizationId: string): Promise<schema.ClientPortalTask[]> {
    // Filter by organizationId on base table first to enforce tenant boundary
    return await db.select().from(schema.clientPortalTasks)
      .where(
        and(
          eq(schema.clientPortalTasks.assignedTo, contactId),
          eq(schema.clientPortalTasks.organizationId, organizationId)
        )
      )
      .orderBy(desc(schema.clientPortalTasks.createdAt));
  }

  async updateClientPortalTask(id: string, task: Partial<schema.InsertClientPortalTask>): Promise<schema.ClientPortalTask | undefined> {
    const result = await db.update(schema.clientPortalTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(schema.clientPortalTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteClientPortalTask(id: string): Promise<void> {
    await db.delete(schema.clientPortalTasks).where(eq(schema.clientPortalTasks.id, id));
  }

  // Task Ingestion - Create tasks from different sources
  async createTaskFromWorkflowTask(
    assignmentTaskId: string,
    organizationId: string,
    createdBy: string
  ): Promise<schema.ClientPortalTask | null> {
    // Fetch assignment task with related data
    const assignmentTask = await db.select({
      task: schema.assignmentWorkflowTasks,
      step: schema.assignmentWorkflowSteps,
      stage: schema.assignmentWorkflowStages,
      assignment: schema.workflowAssignments,
      client: schema.clients,
    })
      .from(schema.assignmentWorkflowTasks)
      .innerJoin(schema.assignmentWorkflowSteps, eq(schema.assignmentWorkflowTasks.assignmentStepId, schema.assignmentWorkflowSteps.id))
      .innerJoin(schema.assignmentWorkflowStages, eq(schema.assignmentWorkflowSteps.assignmentStageId, schema.assignmentWorkflowStages.id))
      .innerJoin(schema.workflowAssignments, eq(schema.assignmentWorkflowStages.assignmentId, schema.workflowAssignments.id))
      .innerJoin(schema.clients, eq(schema.workflowAssignments.clientId, schema.clients.id))
      .where(
        and(
          eq(schema.assignmentWorkflowTasks.id, assignmentTaskId),
          eq(schema.assignmentWorkflowTasks.organizationId, organizationId)
        )
      );

    if (!assignmentTask[0]) {
      return null;
    }

    const { task, assignment, client } = assignmentTask[0];

    // Only create portal task if the workflow task is assigned to client
    if (!task.assigneeType || task.assigneeType !== 'client') {
      return null;
    }

    // Create client portal task
    const portalTask = await this.createClientPortalTask({
      organizationId,
      clientId: client.id,
      assignmentId: assignment.id,
      title: task.name,
      description: task.description || '',
      type: 'workflow_task',
      priority: task.priority || 'medium',
      status: 'pending',
      sourceType: 'workflow_task',
      sourceId: assignmentTaskId,
      assignedTo: client.primaryContactId || undefined,
      createdBy,
      dueDate: task.dueDate || undefined,
      requiresFollowup: false,
    });

    return portalTask;
  }

  async createTaskFromMessage(
    conversationId: string,
    messageId: string,
    title: string,
    description: string,
    organizationId: string,
    clientId: string,
    assignedTo: string | undefined,
    createdBy: string,
    dueDate?: Date
  ): Promise<schema.ClientPortalTask> {
    // Verify client ownership before creating task
    const client = await db.select().from(schema.clients)
      .where(
        and(
          eq(schema.clients.id, clientId),
          eq(schema.clients.organizationId, organizationId)
        )
      );

    if (client.length === 0) {
      throw new Error('Client not found or does not belong to this organization');
    }

    // Create client portal task from employee message
    return await this.createClientPortalTask({
      organizationId,
      clientId,
      assignmentId: undefined,
      title,
      description,
      type: 'information_request',
      priority: 'medium',
      status: 'pending',
      sourceType: 'conversation',
      sourceId: conversationId,
      assignedTo,
      createdBy,
      dueDate,
      requiresFollowup: false,
      metadata: { messageId },
    });
  }

  async createTaskFromFormRequest(
    formTemplateId: string,
    title: string,
    description: string,
    organizationId: string,
    clientId: string,
    assignmentId: string | undefined,
    assignedTo: string | undefined,
    createdBy: string,
    dueDate?: Date
  ): Promise<schema.ClientPortalTask> {
    // Verify client ownership before creating task
    const client = await db.select().from(schema.clients)
      .where(
        and(
          eq(schema.clients.id, clientId),
          eq(schema.clients.organizationId, organizationId)
        )
      );

    if (client.length === 0) {
      throw new Error('Client not found or does not belong to this organization');
    }

    // Verify assignment ownership if provided
    if (assignmentId) {
      const assignment = await db.select().from(schema.workflowAssignments)
        .where(
          and(
            eq(schema.workflowAssignments.id, assignmentId),
            eq(schema.workflowAssignments.organizationId, organizationId)
          )
        );

      if (assignment.length === 0) {
        throw new Error('Assignment not found or does not belong to this organization');
      }
    }

    // Create client portal task from form/document request
    return await this.createClientPortalTask({
      organizationId,
      clientId,
      assignmentId,
      title,
      description,
      type: 'document_upload',
      priority: 'high',
      status: 'pending',
      sourceType: 'form_request',
      sourceId: formTemplateId,
      assignedTo,
      createdBy,
      dueDate,
      requiresFollowup: false,
    });
  }

  // Task Followups
  async createTaskFollowup(followup: schema.InsertTaskFollowup): Promise<schema.TaskFollowup> {
    const result = await db.insert(schema.taskFollowups).values(followup).returning();
    return result[0];
  }

  async getTaskFollowup(id: string): Promise<schema.TaskFollowup | undefined> {
    const result = await db.select().from(schema.taskFollowups).where(eq(schema.taskFollowups.id, id));
    return result[0];
  }

  async getFollowupsByTask(taskId: string): Promise<schema.TaskFollowup[]> {
    return await db.select().from(schema.taskFollowups)
      .where(eq(schema.taskFollowups.taskId, taskId))
      .orderBy(desc(schema.taskFollowups.createdAt));
  }

  async getPendingFollowups(): Promise<schema.TaskFollowup[]> {
    return await db.select().from(schema.taskFollowups)
      .where(
        and(
          eq(schema.taskFollowups.status, 'active'),
          sql`${schema.taskFollowups.nextRunAt} <= NOW()`
        )
      )
      .orderBy(schema.taskFollowups.nextRunAt);
  }

  async updateTaskFollowup(id: string, followup: Partial<schema.InsertTaskFollowup>): Promise<schema.TaskFollowup | undefined> {
    const result = await db.update(schema.taskFollowups)
      .set({ ...followup, updatedAt: new Date() })
      .where(eq(schema.taskFollowups.id, id))
      .returning();
    return result[0];
  }

  async deleteTaskFollowup(id: string): Promise<void> {
    await db.delete(schema.taskFollowups).where(eq(schema.taskFollowups.id, id));
  }

  // Email Templates
  async createEmailTemplate(template: schema.InsertEmailTemplate): Promise<schema.EmailTemplate> {
    const result = await db.insert(schema.emailTemplates).values(template).returning();
    return result[0];
  }

  async getEmailTemplate(id: string, organizationId: string): Promise<schema.EmailTemplate | undefined> {
    const result = await db.select().from(schema.emailTemplates)
      .where(
        and(
          eq(schema.emailTemplates.id, id),
          or(
            eq(schema.emailTemplates.organizationId, organizationId),
            isNull(schema.emailTemplates.organizationId)
          )
        )
      );
    return result[0];
  }

  async getEmailTemplatesByOrganization(organizationId: string): Promise<schema.EmailTemplate[]> {
    return await db.select().from(schema.emailTemplates)
      .where(
        or(
          eq(schema.emailTemplates.organizationId, organizationId),
          isNull(schema.emailTemplates.organizationId)
        )
      )
      .orderBy(schema.emailTemplates.category, schema.emailTemplates.name);
  }

  async getEmailTemplateByCategory(organizationId: string, category: string): Promise<schema.EmailTemplate | undefined> {
    // First try to find organization-specific template
    const orgTemplate = await db.select().from(schema.emailTemplates)
      .where(
        and(
          eq(schema.emailTemplates.organizationId, organizationId),
          eq(schema.emailTemplates.category, category),
          eq(schema.emailTemplates.isActive, true)
        )
      )
      .limit(1);

    if (orgTemplate[0]) {
      return orgTemplate[0];
    }

    // Fall back to default template if no org-specific template found
    return await this.getDefaultEmailTemplate(category);
  }

  async getDefaultEmailTemplate(category: string): Promise<schema.EmailTemplate | undefined> {
    const result = await db.select().from(schema.emailTemplates)
      .where(
        and(
          eq(schema.emailTemplates.isDefault, true),
          eq(schema.emailTemplates.category, category),
          eq(schema.emailTemplates.isActive, true)
        )
      )
      .limit(1);
    return result[0];
  }

  async updateEmailTemplate(id: string, organizationId: string, template: Partial<schema.InsertEmailTemplate>): Promise<schema.EmailTemplate | undefined> {
    // Whitelist mutable fields only - exclude protected system fields
    const allowedUpdates: Partial<schema.InsertEmailTemplate> = {};
    
    // Allowed fields for update
    if (template.name !== undefined) allowedUpdates.name = template.name;
    if (template.category !== undefined) allowedUpdates.category = template.category;
    if (template.subject !== undefined) allowedUpdates.subject = template.subject;
    if (template.body !== undefined) allowedUpdates.body = template.body;
    if (template.variables !== undefined) allowedUpdates.variables = template.variables;
    if (template.isActive !== undefined) allowedUpdates.isActive = template.isActive;
    if (template.logoUrl !== undefined) allowedUpdates.logoUrl = template.logoUrl;
    if (template.footerText !== undefined) allowedUpdates.footerText = template.footerText;
    if (template.socialLinks !== undefined) allowedUpdates.socialLinks = template.socialLinks;
    if (template.brandingColors !== undefined) allowedUpdates.brandingColors = template.brandingColors;
    if (template.usageCount !== undefined) allowedUpdates.usageCount = template.usageCount;
    if (template.metadata !== undefined) allowedUpdates.metadata = template.metadata;
    
    // Protected fields are NOT included: organizationId, isDefault, createdBy
    
    const result = await db.update(schema.emailTemplates)
      .set({ ...allowedUpdates, updatedAt: new Date() })
      .where(
        and(
          eq(schema.emailTemplates.id, id),
          eq(schema.emailTemplates.organizationId, organizationId)
        )
      )
      .returning();
    return result[0];
  }

  async deleteEmailTemplate(id: string, organizationId: string): Promise<void> {
    await db.delete(schema.emailTemplates)
      .where(
        and(
          eq(schema.emailTemplates.id, id),
          eq(schema.emailTemplates.organizationId, organizationId)
        )
      );
  }

  async renderEmailTemplate(templateId: string, placeholders: Record<string, string>): Promise<{subject: string, body: string}> {
    const template = await db.select().from(schema.emailTemplates)
      .where(eq(schema.emailTemplates.id, templateId))
      .limit(1);

    if (!template[0]) {
      throw new Error('Template not found');
    }

    // Use the email template service for secure placeholder replacement
    const { renderEmailTemplate } = await import('./services/emailTemplateService');
    return renderEmailTemplate(template[0], placeholders);
  }

  // Message Templates
  async createMessageTemplate(template: schema.InsertMessageTemplate): Promise<schema.MessageTemplate> {
    const result = await db.insert(schema.messageTemplates).values(template).returning();
    return result[0];
  }

  async getMessageTemplate(id: string, organizationId: string): Promise<schema.MessageTemplate | undefined> {
    const result = await db.select().from(schema.messageTemplates)
      .where(
        and(
          eq(schema.messageTemplates.id, id),
          or(
            eq(schema.messageTemplates.organizationId, organizationId),
            isNull(schema.messageTemplates.organizationId)
          )
        )
      );
    return result[0];
  }

  async getMessageTemplatesByOrganization(organizationId: string): Promise<schema.MessageTemplate[]> {
    return await db.select().from(schema.messageTemplates)
      .where(
        or(
          eq(schema.messageTemplates.organizationId, organizationId),
          isNull(schema.messageTemplates.organizationId)
        )
      )
      .orderBy(schema.messageTemplates.category, schema.messageTemplates.name);
  }

  async getMessageTemplateByCategory(organizationId: string, category: string): Promise<schema.MessageTemplate | undefined> {
    const orgTemplate = await db.select().from(schema.messageTemplates)
      .where(
        and(
          eq(schema.messageTemplates.organizationId, organizationId),
          eq(schema.messageTemplates.category, category),
          eq(schema.messageTemplates.isActive, true)
        )
      )
      .limit(1);

    if (orgTemplate[0]) {
      return orgTemplate[0];
    }

    return await this.getDefaultMessageTemplate(category);
  }

  async getDefaultMessageTemplate(category: string): Promise<schema.MessageTemplate | undefined> {
    const result = await db.select().from(schema.messageTemplates)
      .where(
        and(
          eq(schema.messageTemplates.isDefault, true),
          eq(schema.messageTemplates.category, category),
          eq(schema.messageTemplates.isActive, true)
        )
      )
      .limit(1);
    return result[0];
  }

  async updateMessageTemplate(id: string, organizationId: string, template: Partial<schema.InsertMessageTemplate>): Promise<schema.MessageTemplate | undefined> {
    const allowedUpdates: Partial<schema.InsertMessageTemplate> = {};
    
    if (template.name !== undefined) allowedUpdates.name = template.name;
    if (template.category !== undefined) allowedUpdates.category = template.category;
    if (template.content !== undefined) allowedUpdates.content = template.content;
    if (template.variables !== undefined) allowedUpdates.variables = template.variables;
    if (template.isActive !== undefined) allowedUpdates.isActive = template.isActive;
    if (template.usageCount !== undefined) allowedUpdates.usageCount = template.usageCount;
    if (template.metadata !== undefined) allowedUpdates.metadata = template.metadata;
    
    const result = await db.update(schema.messageTemplates)
      .set({ ...allowedUpdates, updatedAt: new Date() })
      .where(
        and(
          eq(schema.messageTemplates.id, id),
          eq(schema.messageTemplates.organizationId, organizationId)
        )
      )
      .returning();
    return result[0];
  }

  async deleteMessageTemplate(id: string, organizationId: string): Promise<void> {
    await db.delete(schema.messageTemplates)
      .where(
        and(
          eq(schema.messageTemplates.id, id),
          eq(schema.messageTemplates.organizationId, organizationId)
        )
      );
  }

  // Folders
  async getFolder(id: string): Promise<schema.Folder | undefined> {
    const result = await db.select().from(schema.folders).where(eq(schema.folders.id, id));
    return result[0];
  }

  async createFolder(folder: schema.InsertFolder): Promise<schema.Folder> {
    const result = await db.insert(schema.folders).values(folder).returning();
    return result[0];
  }

  async updateFolder(id: string, folder: Partial<schema.InsertFolder>): Promise<schema.Folder | undefined> {
    const result = await db.update(schema.folders)
      .set({ ...folder, updatedAt: new Date() })
      .where(eq(schema.folders.id, id))
      .returning();
    return result[0];
  }

  async deleteFolder(id: string): Promise<void> {
    await db.delete(schema.folders).where(eq(schema.folders.id, id));
  }

  async getFoldersByOrganization(organizationId: string): Promise<schema.Folder[]> {
    return await db.select().from(schema.folders)
      .where(
        and(
          eq(schema.folders.organizationId, organizationId),
          eq(schema.folders.isArchived, false)
        )
      )
      .orderBy(schema.folders.name);
  }

  async getFoldersByParent(parentId: string | null, organizationId: string): Promise<schema.Folder[]> {
    if (parentId === null) {
      return await db.select().from(schema.folders)
        .where(
          and(
            sql`${schema.folders.parentId} IS NULL`,
            eq(schema.folders.organizationId, organizationId),
            eq(schema.folders.isArchived, false)
          )
        )
        .orderBy(schema.folders.name);
    }
    return await db.select().from(schema.folders)
      .where(
        and(
          eq(schema.folders.parentId, parentId),
          eq(schema.folders.organizationId, organizationId),
          eq(schema.folders.isArchived, false)
        )
      )
      .orderBy(schema.folders.name);
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

  async getActivityLogsByOrganization(
    organizationId: string, 
    options?: {
      limit?: number;
      offset?: number;
      resource?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ActivityLog[]> {
    const { limit = 100, offset = 0, resource, resourceId, startDate, endDate } = options || {};
    
    let query = db.select().from(schema.activityLogs)
      .where(eq(schema.activityLogs.organizationId, organizationId));

    // Apply filters
    if (resource) {
      query = query.where(eq(schema.activityLogs.resource, resource)) as any;
    }
    if (resourceId) {
      query = query.where(eq(schema.activityLogs.resourceId, resourceId)) as any;
    }
    if (startDate) {
      query = query.where(gte(schema.activityLogs.createdAt, startDate)) as any;
    }
    if (endDate) {
      query = query.where(lte(schema.activityLogs.createdAt, endDate)) as any;
    }

    return await query
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit)
      .offset(offset);
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
    // Delete related records first to avoid foreign key constraint violations
    // Delete in order: child records → parent records
    
    // Delete onboarding sessions and messages
    const sessions = await db.select({ id: schema.clientOnboardingSessions.id })
      .from(schema.clientOnboardingSessions)
      .where(eq(schema.clientOnboardingSessions.clientId, id));
    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      for (const sessionId of sessionIds) {
        await db.delete(schema.onboardingMessages)
          .where(eq(schema.onboardingMessages.sessionId, sessionId));
      }
      await db.delete(schema.clientOnboardingSessions)
        .where(eq(schema.clientOnboardingSessions.clientId, id));
    }
    
    // Delete contacts (has cascade delete configured)
    await db.delete(schema.contacts)
      .where(eq(schema.contacts.clientId, id));
    
    // Finally, delete the client
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

  // Client-Contact Relationships (Multi-client support)
  async getClientsForContact(contactId: string): Promise<Client[]> {
    // First, get the contact to verify organizationId for security
    const contact = await this.getContact(contactId);
    if (!contact) {
      return [];
    }

    const clientContacts = await db.select()
      .from(schema.clientContacts)
      .leftJoin(schema.clients, eq(schema.clientContacts.clientId, schema.clients.id))
      .where(and(
        eq(schema.clientContacts.contactId, contactId),
        eq(schema.clientContacts.organizationId, contact.organizationId) // Organization scoping
      ))
      .orderBy(desc(schema.clientContacts.isPrimary), schema.clients.companyName);
    
    return clientContacts
      .map(row => row.clients)
      .filter((client): client is Client => client !== null);
  }

  async getContactsForClient(clientId: string): Promise<Contact[]> {
    // First, get the client to verify organizationId for security
    const client = await this.getClient(clientId);
    if (!client) {
      return [];
    }

    const clientContacts = await db.select()
      .from(schema.clientContacts)
      .leftJoin(schema.contacts, eq(schema.clientContacts.contactId, schema.contacts.id))
      .where(and(
        eq(schema.clientContacts.clientId, clientId),
        eq(schema.clientContacts.organizationId, client.organizationId) // Organization scoping
      ))
      .orderBy(desc(schema.clientContacts.isPrimary), schema.contacts.lastName, schema.contacts.firstName);
    
    return clientContacts
      .map(row => row.contacts)
      .filter((contact): contact is Contact => contact !== null);
  }

  async linkContactToClient(contactId: string, clientId: string, isPrimary: boolean, organizationId: string): Promise<ClientContact> {
    // Validate that both contact and client belong to the same organization
    const contact = await this.getContact(contactId);
    const client = await this.getClient(clientId);
    
    if (!contact || !client) {
      throw new Error("Contact or client not found");
    }
    
    if (contact.organizationId !== client.organizationId) {
      throw new Error("Contact and client must belong to the same organization");
    }
    
    if (contact.organizationId !== organizationId) {
      throw new Error("Organization ID mismatch - potential cross-tenant violation");
    }

    const result = await db.insert(schema.clientContacts).values({
      contactId,
      clientId,
      isPrimary,
      organizationId: contact.organizationId, // Use verified organizationId from contact
    }).returning();
    return result[0];
  }

  async unlinkContactFromClient(contactId: string, clientId: string): Promise<void> {
    // Validate organization scoping before deletion
    const contact = await this.getContact(contactId);
    const client = await this.getClient(clientId);
    
    if (!contact || !client) {
      throw new Error("Contact or client not found");
    }
    
    if (contact.organizationId !== client.organizationId) {
      throw new Error("Contact and client must belong to the same organization");
    }

    await db.delete(schema.clientContacts)
      .where(and(
        eq(schema.clientContacts.contactId, contactId),
        eq(schema.clientContacts.clientId, clientId),
        eq(schema.clientContacts.organizationId, contact.organizationId) // Organization scoping
      ));
  }

  async updateContactClientLink(contactId: string, clientId: string, updates: Partial<InsertClientContact>): Promise<ClientContact | undefined> {
    // Validate organization scoping before update
    const contact = await this.getContact(contactId);
    const client = await this.getClient(clientId);
    
    if (!contact || !client) {
      throw new Error("Contact or client not found");
    }
    
    if (contact.organizationId !== client.organizationId) {
      throw new Error("Contact and client must belong to the same organization");
    }

    // Strip relationship fields and organizationId from updates to prevent tampering
    // Only allow updating isPrimary - if caller wants to change clientId/contactId, they should unlink and re-link
    const { organizationId: _org, contactId: _contact, clientId: _client, ...safeUpdates } = updates;

    const result = await db.update(schema.clientContacts)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(and(
        eq(schema.clientContacts.contactId, contactId),
        eq(schema.clientContacts.clientId, clientId),
        eq(schema.clientContacts.organizationId, contact.organizationId) // Organization scoping
      ))
      .returning();
    return result[0];
  }

  // Client Onboarding Sessions
  async getOnboardingSession(id: string): Promise<ClientOnboardingSession | undefined> {
    const results = await db.select().from(schema.clientOnboardingSessions)
      .where(eq(schema.clientOnboardingSessions.id, id));
    return results[0];
  }

  async createOnboardingSession(session: InsertClientOnboardingSession): Promise<ClientOnboardingSession> {
    const result = await db.insert(schema.clientOnboardingSessions).values(session).returning();
    return result[0];
  }

  async updateOnboardingSession(id: string, session: Partial<InsertClientOnboardingSession>): Promise<ClientOnboardingSession> {
    const result = await db.update(schema.clientOnboardingSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(schema.clientOnboardingSessions.id, id))
      .returning();
    return result[0];
  }

  async getOnboardingSessionsByOrganization(organizationId: string): Promise<ClientOnboardingSession[]> {
    return await db.select().from(schema.clientOnboardingSessions)
      .where(eq(schema.clientOnboardingSessions.organizationId, organizationId))
      .orderBy(desc(schema.clientOnboardingSessions.createdAt));
  }

  async getOnboardingMessages(sessionId: string): Promise<OnboardingMessage[]> {
    return await db.select().from(schema.onboardingMessages)
      .where(eq(schema.onboardingMessages.sessionId, sessionId))
      .orderBy(schema.onboardingMessages.createdAt);
  }

  async createOnboardingMessage(message: InsertOnboardingMessage): Promise<OnboardingMessage> {
    const result = await db.insert(schema.onboardingMessages).values(message).returning();
    return result[0];
  }

  // ==================== Team Management ====================
  
  async createTeam(team: schema.InsertTeam): Promise<schema.Team> {
    const result = await db.insert(schema.teams).values(team).returning();
    return result[0];
  }

  async getTeamById(id: string): Promise<schema.Team | undefined> {
    const result = await db.select().from(schema.teams).where(eq(schema.teams.id, id));
    return result[0];
  }

  async getTeamsByOrganization(organizationId: string): Promise<schema.Team[]> {
    return await db.select().from(schema.teams)
      .where(and(
        eq(schema.teams.organizationId, organizationId),
        eq(schema.teams.isActive, true)
      ))
      .orderBy(schema.teams.name);
  }

  async updateTeam(id: string, updates: Partial<schema.InsertTeam>): Promise<schema.Team | undefined> {
    const result = await db.update(schema.teams)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.teams.id, id))
      .returning();
    return result[0];
  }

  async deleteTeam(id: string): Promise<void> {
    // Cascade delete will handle teamMembers automatically
    await db.delete(schema.teams).where(eq(schema.teams.id, id));
  }

  async addTeamMember(member: schema.InsertTeamMember): Promise<schema.TeamMember> {
    const result = await db.insert(schema.teamMembers).values(member).returning();
    return result[0];
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await db.delete(schema.teamMembers)
      .where(and(
        eq(schema.teamMembers.teamId, teamId),
        eq(schema.teamMembers.userId, userId)
      ));
  }

  async getTeamMembers(teamId: string): Promise<(schema.TeamMember & { user: User })[]> {
    const results = await db.select({
      id: schema.teamMembers.id,
      teamId: schema.teamMembers.teamId,
      userId: schema.teamMembers.userId,
      role: schema.teamMembers.role,
      joinedAt: schema.teamMembers.joinedAt,
      user: schema.users,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.users, eq(schema.teamMembers.userId, schema.users.id))
    .where(eq(schema.teamMembers.teamId, teamId))
    .orderBy(schema.users.firstName, schema.users.lastName);
    
    return results;
  }

  async getTeamsByUser(userId: string): Promise<(schema.TeamMember & { team: schema.Team })[]> {
    const results = await db.select({
      id: schema.teamMembers.id,
      teamId: schema.teamMembers.teamId,
      userId: schema.teamMembers.userId,
      role: schema.teamMembers.role,
      joinedAt: schema.teamMembers.joinedAt,
      team: schema.teams,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
    .where(and(
      eq(schema.teamMembers.userId, userId),
      eq(schema.teams.isActive, true)
    ))
    .orderBy(schema.teams.name);
    
    return results;
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: string): Promise<void> {
    await db.update(schema.teamMembers)
      .set({ role })
      .where(and(
        eq(schema.teamMembers.teamId, teamId),
        eq(schema.teamMembers.userId, userId)
      ));
  }

  async createSupervisorRelationship(relationship: schema.InsertSupervisorRelationship): Promise<schema.SupervisorRelationship> {
    const result = await db.insert(schema.supervisorRelationships).values(relationship).returning();
    return result[0];
  }

  async deleteSupervisorRelationship(supervisorId: string, reporteeId: string): Promise<void> {
    await db.delete(schema.supervisorRelationships)
      .where(and(
        eq(schema.supervisorRelationships.supervisorId, supervisorId),
        eq(schema.supervisorRelationships.reporteeId, reporteeId)
      ));
  }

  async getReportees(supervisorId: string): Promise<User[]> {
    const results = await db.select({ user: schema.users })
      .from(schema.supervisorRelationships)
      .innerJoin(schema.users, eq(schema.supervisorRelationships.reporteeId, schema.users.id))
      .where(eq(schema.supervisorRelationships.supervisorId, supervisorId))
      .orderBy(schema.users.firstName, schema.users.lastName);
    
    return results.map(r => r.user);
  }

  async getSupervisors(reporteeId: string): Promise<User[]> {
    const results = await db.select({ user: schema.users })
      .from(schema.supervisorRelationships)
      .innerJoin(schema.users, eq(schema.supervisorRelationships.supervisorId, schema.users.id))
      .where(eq(schema.supervisorRelationships.reporteeId, reporteeId))
      .orderBy(schema.users.firstName, schema.users.lastName);
    
    return results.map(r => r.user);
  }

  // Team Chat
  async createTeamChatMessage(message: schema.InsertTeamChatMessage): Promise<schema.TeamChatMessage> {
    const result = await db.insert(schema.teamChatMessages).values(message).returning();
    return result[0];
  }

  async getTeamChatMessages(teamId: string, limit: number = 100): Promise<schema.TeamChatMessage[]> {
    return await db.select().from(schema.teamChatMessages)
      .where(eq(schema.teamChatMessages.teamId, teamId))
      .orderBy(desc(schema.teamChatMessages.createdAt))
      .limit(limit);
  }

  async getClientChatMessages(clientId: string, limit: number = 100): Promise<schema.TeamChatMessage[]> {
    return await db.select().from(schema.teamChatMessages)
      .where(eq(schema.teamChatMessages.clientId, clientId))
      .orderBy(desc(schema.teamChatMessages.createdAt))
      .limit(limit);
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

  async createFormTemplate(template: InsertFormTemplate & { organizationId: string | null; createdBy: string }): Promise<FormTemplate> {
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
      .where(
        or(
          eq(schema.formTemplates.organizationId, organizationId),
          isNull(schema.formTemplates.organizationId) // Include global templates
        )
      )
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

  // Platform Subscription Invoices
  async createSubscriptionInvoice(invoice: schema.InsertSubscriptionInvoice): Promise<schema.SubscriptionInvoice> {
    const result = await db.insert(schema.subscriptionInvoices).values(invoice).returning();
    return result[0];
  }

  async getSubscriptionInvoice(id: string): Promise<schema.SubscriptionInvoice | undefined> {
    const result = await db.select().from(schema.subscriptionInvoices)
      .where(eq(schema.subscriptionInvoices.id, id));
    return result[0];
  }

  async getSubscriptionInvoicesByOrganization(organizationId: string): Promise<schema.SubscriptionInvoice[]> {
    return await db.select().from(schema.subscriptionInvoices)
      .where(eq(schema.subscriptionInvoices.organizationId, organizationId))
      .orderBy(desc(schema.subscriptionInvoices.createdAt));
  }

  async getSubscriptionInvoicesBySubscription(subscriptionId: string): Promise<schema.SubscriptionInvoice[]> {
    return await db.select().from(schema.subscriptionInvoices)
      .where(eq(schema.subscriptionInvoices.subscriptionId, subscriptionId))
      .orderBy(desc(schema.subscriptionInvoices.createdAt));
  }

  async updateSubscriptionInvoice(id: string, invoice: Partial<schema.InsertSubscriptionInvoice>): Promise<schema.SubscriptionInvoice | undefined> {
    const result = await db.update(schema.subscriptionInvoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(schema.subscriptionInvoices.id, id))
      .returning();
    return result[0];
  }

  async getDueSubscriptionInvoices(): Promise<schema.SubscriptionInvoice[]> {
    const now = new Date();
    return await db.select().from(schema.subscriptionInvoices)
      .where(
        and(
          eq(schema.subscriptionInvoices.status, "pending"),
          sql`${schema.subscriptionInvoices.dueDate} <= ${now}`
        )
      )
      .orderBy(schema.subscriptionInvoices.dueDate);
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

  // Project Workflows - Projects as combinations of 2+ workflows
  async addWorkflowToProject(projectWorkflow: schema.InsertProjectWorkflow): Promise<schema.ProjectWorkflow> {
    const result = await db.insert(schema.projectWorkflows).values(projectWorkflow).returning();
    return result[0];
  }

  async getProjectWorkflows(projectId: string): Promise<any[]> {
    return await db.select({
      id: schema.projectWorkflows.id,
      projectId: schema.projectWorkflows.projectId,
      workflowId: schema.projectWorkflows.workflowId,
      order: schema.projectWorkflows.order,
      createdAt: schema.projectWorkflows.createdAt,
      workflow: {
        id: schema.workflows.id,
        name: schema.workflows.name,
        description: schema.workflows.description,
        status: schema.workflows.status,
      }
    })
    .from(schema.projectWorkflows)
    .leftJoin(schema.workflows, eq(schema.projectWorkflows.workflowId, schema.workflows.id))
    .where(eq(schema.projectWorkflows.projectId, projectId))
    .orderBy(schema.projectWorkflows.order);
  }

  async removeWorkflowFromProject(projectId: string, workflowId: string): Promise<void> {
    await db.delete(schema.projectWorkflows)
      .where(and(
        eq(schema.projectWorkflows.projectId, projectId),
        eq(schema.projectWorkflows.workflowId, workflowId)
      ));
  }

  async isWorkflowInProject(projectId: string, workflowId: string): Promise<boolean> {
    const result = await db.select()
      .from(schema.projectWorkflows)
      .where(and(
        eq(schema.projectWorkflows.projectId, projectId),
        eq(schema.projectWorkflows.workflowId, workflowId)
      ))
      .limit(1);
    return result.length > 0;
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

  // AI Agent Sessions
  async createAgentSession(session: schema.InsertAgentSession): Promise<schema.AgentSession> {
    const result = await db.insert(schema.agentSessions).values(session).returning();
    return result[0];
  }

  async getAgentSession(id: string): Promise<schema.AgentSession | undefined> {
    const result = await db.select().from(schema.agentSessions).where(eq(schema.agentSessions.id, id));
    return result[0];
  }

  async getAgentSessionsByUser(userId: string, agentSlug: string): Promise<schema.AgentSession[]> {
    return await db.select().from(schema.agentSessions)
      .where(and(
        eq(schema.agentSessions.userId, userId),
        eq(schema.agentSessions.agentSlug, agentSlug)
      ))
      .orderBy(desc(schema.agentSessions.updatedAt));
  }

  async updateAgentSession(id: string, name: string): Promise<schema.AgentSession | undefined> {
    const result = await db.update(schema.agentSessions)
      .set({ name, updatedAt: new Date() })
      .where(eq(schema.agentSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteAgentSession(id: string): Promise<void> {
    await db.delete(schema.agentSessions).where(eq(schema.agentSessions.id, id));
  }

  async createAgentMessage(message: schema.InsertAgentMessage): Promise<schema.AgentMessage> {
    const result = await db.insert(schema.agentMessages).values(message).returning();
    return result[0];
  }

  async getAgentMessagesBySession(sessionId: string): Promise<schema.AgentMessage[]> {
    return await db.select().from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, sessionId))
      .orderBy(schema.agentMessages.createdAt);
  }

  // AI Roundtable - Multi-Agent Collaborative Sessions
  async createRoundtableSession(session: schema.InsertRoundtableSession): Promise<schema.RoundtableSession> {
    const result = await db.insert(schema.roundtableSessions).values(session).returning();
    return result[0];
  }

  async getRoundtableSession(id: string): Promise<schema.RoundtableSession | undefined> {
    const result = await db.select().from(schema.roundtableSessions)
      .where(eq(schema.roundtableSessions.id, id));
    return result[0];
  }

  async getRoundtableSessionsByUser(userId: string): Promise<schema.RoundtableSession[]> {
    return await db.select().from(schema.roundtableSessions)
      .where(eq(schema.roundtableSessions.userId, userId))
      .orderBy(desc(schema.roundtableSessions.createdAt));
  }

  async getRoundtableSessionsByOrganization(organizationId: string): Promise<schema.RoundtableSession[]> {
    return await db.select().from(schema.roundtableSessions)
      .where(eq(schema.roundtableSessions.organizationId, organizationId))
      .orderBy(desc(schema.roundtableSessions.createdAt));
  }

  async updateRoundtableSession(id: string, updates: Partial<schema.InsertRoundtableSession>): Promise<schema.RoundtableSession | undefined> {
    const result = await db.update(schema.roundtableSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.roundtableSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteRoundtableSession(id: string): Promise<void> {
    await db.delete(schema.roundtableSessions).where(eq(schema.roundtableSessions.id, id));
  }

  async createRoundtableParticipant(participant: schema.InsertRoundtableParticipant): Promise<schema.RoundtableParticipant> {
    const result = await db.insert(schema.roundtableParticipants).values(participant).returning();
    return result[0];
  }

  async getRoundtableParticipant(id: string): Promise<schema.RoundtableParticipant | undefined> {
    const result = await db.select().from(schema.roundtableParticipants)
      .where(eq(schema.roundtableParticipants.id, id));
    return result[0];
  }

  async getRoundtableParticipantsBySession(sessionId: string): Promise<schema.RoundtableParticipant[]> {
    return await db.select().from(schema.roundtableParticipants)
      .where(eq(schema.roundtableParticipants.sessionId, sessionId))
      .orderBy(schema.roundtableParticipants.joinedAt);
  }

  async updateRoundtableParticipant(id: string, updates: Partial<schema.InsertRoundtableParticipant>): Promise<schema.RoundtableParticipant | undefined> {
    const result = await db.update(schema.roundtableParticipants)
      .set(updates)
      .where(eq(schema.roundtableParticipants.id, id))
      .returning();
    return result[0];
  }

  async deleteRoundtableParticipant(id: string): Promise<void> {
    await db.delete(schema.roundtableParticipants).where(eq(schema.roundtableParticipants.id, id));
  }

  async createRoundtableMessage(message: schema.InsertRoundtableMessage): Promise<schema.RoundtableMessage> {
    const result = await db.insert(schema.roundtableMessages).values(message).returning();
    return result[0];
  }

  async getRoundtableMessage(id: string): Promise<schema.RoundtableMessage | undefined> {
    const result = await db.select().from(schema.roundtableMessages)
      .where(eq(schema.roundtableMessages.id, id));
    return result[0];
  }

  async getRoundtableMessagesBySession(sessionId: string, channelType?: string): Promise<schema.RoundtableMessage[]> {
    const conditions = [eq(schema.roundtableMessages.sessionId, sessionId)];
    if (channelType) {
      conditions.push(eq(schema.roundtableMessages.channelType, channelType));
    }
    return await db.select().from(schema.roundtableMessages)
      .where(and(...conditions))
      .orderBy(schema.roundtableMessages.createdAt);
  }

  async getRoundtablePrivateMessages(sessionId: string, participantId: string): Promise<schema.RoundtableMessage[]> {
    return await db.select().from(schema.roundtableMessages)
      .where(
        and(
          eq(schema.roundtableMessages.sessionId, sessionId),
          eq(schema.roundtableMessages.channelType, 'private'),
          or(
            eq(schema.roundtableMessages.senderId, participantId),
            eq(schema.roundtableMessages.recipientParticipantId, participantId)
          )
        )
      )
      .orderBy(schema.roundtableMessages.createdAt);
  }

  async updateRoundtableMessage(id: string, updates: Partial<schema.InsertRoundtableMessage>): Promise<schema.RoundtableMessage | undefined> {
    const result = await db.update(schema.roundtableMessages)
      .set(updates)
      .where(eq(schema.roundtableMessages.id, id))
      .returning();
    return result[0];
  }

  async deleteRoundtableMessage(id: string): Promise<void> {
    await db.delete(schema.roundtableMessages).where(eq(schema.roundtableMessages.id, id));
  }

  async createRoundtableDeliverable(deliverable: schema.InsertRoundtableDeliverable): Promise<schema.RoundtableDeliverable> {
    const result = await db.insert(schema.roundtableDeliverables).values(deliverable).returning();
    return result[0];
  }

  async getRoundtableDeliverable(id: string): Promise<schema.RoundtableDeliverable | undefined> {
    const result = await db.select().from(schema.roundtableDeliverables)
      .where(eq(schema.roundtableDeliverables.id, id));
    return result[0];
  }

  async getRoundtableDeliverablesBySession(sessionId: string): Promise<schema.RoundtableDeliverable[]> {
    return await db.select().from(schema.roundtableDeliverables)
      .where(eq(schema.roundtableDeliverables.sessionId, sessionId))
      .orderBy(schema.roundtableDeliverables.createdAt);
  }

  async updateRoundtableDeliverable(id: string, updates: Partial<schema.InsertRoundtableDeliverable>): Promise<schema.RoundtableDeliverable | undefined> {
    const result = await db.update(schema.roundtableDeliverables)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.roundtableDeliverables.id, id))
      .returning();
    return result[0];
  }

  async deleteRoundtableDeliverable(id: string): Promise<void> {
    await db.delete(schema.roundtableDeliverables).where(eq(schema.roundtableDeliverables.id, id));
  }

  async setCurrentPresentation(sessionId: string, deliverableId: string): Promise<void> {
    // Clear all other presentations in this session
    await db.update(schema.roundtableDeliverables)
      .set({ isPresentingNow: false })
      .where(eq(schema.roundtableDeliverables.sessionId, sessionId));
    
    // Set this deliverable as presenting
    await db.update(schema.roundtableDeliverables)
      .set({ isPresentingNow: true, presentedAt: new Date() })
      .where(eq(schema.roundtableDeliverables.id, deliverableId));
  }

  async clearCurrentPresentation(sessionId: string): Promise<void> {
    await db.update(schema.roundtableDeliverables)
      .set({ isPresentingNow: false })
      .where(eq(schema.roundtableDeliverables.sessionId, sessionId));
  }

  async createRoundtableApproval(approval: schema.InsertRoundtableApproval): Promise<schema.RoundtableApproval> {
    const result = await db.insert(schema.roundtableApprovals).values(approval).returning();
    return result[0];
  }

  async getRoundtableApproval(id: string): Promise<schema.RoundtableApproval | undefined> {
    const result = await db.select().from(schema.roundtableApprovals)
      .where(eq(schema.roundtableApprovals.id, id));
    return result[0];
  }

  async getRoundtableApprovalsByDeliverable(deliverableId: string): Promise<schema.RoundtableApproval[]> {
    return await db.select().from(schema.roundtableApprovals)
      .where(eq(schema.roundtableApprovals.deliverableId, deliverableId))
      .orderBy(schema.roundtableApprovals.createdAt);
  }

  async getRoundtableApprovalsBySession(sessionId: string): Promise<schema.RoundtableApproval[]> {
    return await db.select().from(schema.roundtableApprovals)
      .where(eq(schema.roundtableApprovals.sessionId, sessionId))
      .orderBy(schema.roundtableApprovals.createdAt);
  }

  async createRoundtableKnowledgeEntry(entry: schema.InsertRoundtableKnowledgeEntry): Promise<schema.RoundtableKnowledgeEntry> {
    const result = await db.insert(schema.roundtableKnowledgeEntries).values(entry).returning();
    return result[0];
  }

  async getRoundtableKnowledgeEntry(id: string): Promise<schema.RoundtableKnowledgeEntry | undefined> {
    const result = await db.select().from(schema.roundtableKnowledgeEntries)
      .where(eq(schema.roundtableKnowledgeEntries.id, id));
    return result[0];
  }

  async getRoundtableKnowledgeEntriesBySession(sessionId: string): Promise<schema.RoundtableKnowledgeEntry[]> {
    return await db.select().from(schema.roundtableKnowledgeEntries)
      .where(eq(schema.roundtableKnowledgeEntries.sessionId, sessionId))
      .orderBy(schema.roundtableKnowledgeEntries.createdAt);
  }

  async updateRoundtableKnowledgeEntry(id: string, updates: Partial<schema.InsertRoundtableKnowledgeEntry>): Promise<schema.RoundtableKnowledgeEntry | undefined> {
    const result = await db.update(schema.roundtableKnowledgeEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.roundtableKnowledgeEntries.id, id))
      .returning();
    return result[0];
  }

  async deleteRoundtableKnowledgeEntry(id: string): Promise<void> {
    await db.delete(schema.roundtableKnowledgeEntries).where(eq(schema.roundtableKnowledgeEntries.id, id));
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

  // Dashboard Task Queries
  async getTasksByUser(userId: string): Promise<schema.WorkflowTask[]> {
    return await db.select().from(schema.workflowTasks)
      .where(eq(schema.workflowTasks.assignedTo, userId))
      .orderBy(desc(schema.workflowTasks.createdAt));
  }

  async getTasksByOrganization(organizationId: string): Promise<any[]> {
    // Get tasks with workflow context for organization filtering
    return await db.select({
      task: schema.workflowTasks,
      step: schema.workflowSteps,
      stage: schema.workflowStages,
      workflow: schema.workflows
    })
    .from(schema.workflowTasks)
    .innerJoin(schema.workflowSteps, eq(schema.workflowTasks.stepId, schema.workflowSteps.id))
    .innerJoin(schema.workflowStages, eq(schema.workflowSteps.stageId, schema.workflowStages.id))
    .innerJoin(schema.workflows, eq(schema.workflowStages.workflowId, schema.workflows.id))
    .where(eq(schema.workflows.organizationId, organizationId))
    .orderBy(desc(schema.workflowTasks.createdAt));
  }

  async getOverdueTasks(organizationId: string): Promise<any[]> {
    const now = new Date();
    return await db.select({
      task: schema.workflowTasks,
      step: schema.workflowSteps,
      stage: schema.workflowStages,
      workflow: schema.workflows
    })
    .from(schema.workflowTasks)
    .innerJoin(schema.workflowSteps, eq(schema.workflowTasks.stepId, schema.workflowSteps.id))
    .innerJoin(schema.workflowStages, eq(schema.workflowSteps.stageId, schema.workflowStages.id))
    .innerJoin(schema.workflows, eq(schema.workflowStages.workflowId, schema.workflows.id))
    .where(
      and(
        eq(schema.workflows.organizationId, organizationId),
        lt(schema.workflowTasks.dueDate, now),
        ne(schema.workflowTasks.status, 'completed')
      )
    )
    .orderBy(schema.workflowTasks.dueDate);
  }

  async getTasksDueSoon(organizationId: string, daysAhead: number = 7): Promise<any[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    return await db.select({
      task: schema.workflowTasks,
      step: schema.workflowSteps,
      stage: schema.workflowStages,
      workflow: schema.workflows
    })
    .from(schema.workflowTasks)
    .innerJoin(schema.workflowSteps, eq(schema.workflowTasks.stepId, schema.workflowSteps.id))
    .innerJoin(schema.workflowStages, eq(schema.workflowSteps.stageId, schema.workflowStages.id))
    .innerJoin(schema.workflows, eq(schema.workflowStages.workflowId, schema.workflows.id))
    .where(
      and(
        eq(schema.workflows.organizationId, organizationId),
        gte(schema.workflowTasks.dueDate, now),
        lte(schema.workflowTasks.dueDate, futureDate),
        ne(schema.workflowTasks.status, 'completed')
      )
    )
    .orderBy(schema.workflowTasks.dueDate);
  }

  async getTaskStatsByUser(userId: string): Promise<{
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
  }> {
    const tasks = await this.getTasksByUser(userId);
    const now = new Date();
    
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length
    };
  }

  async getTaskStatsByOrganization(organizationId: string): Promise<{
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
    onTime: number;
  }> {
    const tasksData = await this.getTasksByOrganization(organizationId);
    const now = new Date();
    
    const tasks = tasksData.map((t: any) => t.task);
    const overdueCount = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
    const onTimeCount = tasks.filter((t: any) => !t.dueDate || (new Date(t.dueDate) >= now) || t.status === 'completed').length;
    
    return {
      total: tasks.length,
      pending: tasks.filter((t: any) => t.status === 'pending').length,
      in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
      completed: tasks.filter((t: any) => t.status === 'completed').length,
      overdue: overdueCount,
      onTime: onTimeCount - overdueCount
    };
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

  async getAllLlmConfigurations(): Promise<schema.LlmConfiguration[]> {
    return await db.select().from(schema.llmConfigurations)
      .orderBy(desc(schema.llmConfigurations.createdAt));
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

  // ========================================
  // SUPPORT TICKETS
  // ========================================

  async createSupportTicket(ticket: schema.InsertSupportTicket): Promise<schema.SupportTicket> {
    const result = await db.insert(schema.supportTickets).values(ticket).returning();
    return result[0];
  }

  async getSupportTicket(id: string): Promise<schema.SupportTicket | undefined> {
    const result = await db.select().from(schema.supportTickets).where(eq(schema.supportTickets.id, id));
    return result[0];
  }

  async getSupportTickets(organizationId: string): Promise<schema.SupportTicket[]> {
    return await db.select().from(schema.supportTickets)
      .where(eq(schema.supportTickets.organizationId, organizationId))
      .orderBy(desc(schema.supportTickets.createdAt));
  }

  async getAllSupportTickets(): Promise<schema.SupportTicket[]> {
    return await db.select().from(schema.supportTickets)
      .orderBy(desc(schema.supportTickets.createdAt));
  }

  async updateSupportTicket(id: string, ticket: Partial<schema.InsertSupportTicket>): Promise<schema.SupportTicket | undefined> {
    const result = await db.update(schema.supportTickets)
      .set({ ...ticket, updatedAt: new Date() })
      .where(eq(schema.supportTickets.id, id))
      .returning();
    return result[0];
  }

  async deleteSupportTicket(id: string): Promise<void> {
    await db.delete(schema.supportTickets).where(eq(schema.supportTickets.id, id));
  }

  // ========================================
  // SUPPORT TICKET COMMENTS
  // ========================================

  async createSupportTicketComment(comment: schema.InsertSupportTicketComment): Promise<schema.SupportTicketComment> {
    const result = await db.insert(schema.supportTicketComments).values(comment).returning();
    return result[0];
  }

  async getTicketComments(ticketId: string): Promise<schema.SupportTicketComment[]> {
    return await db.select().from(schema.supportTicketComments)
      .where(eq(schema.supportTicketComments.ticketId, ticketId))
      .orderBy(schema.supportTicketComments.createdAt);
  }

  // ========================================
  // LIVE CHAT SUPPORT (EDGE SUBSCRIPTION)
  // ========================================

  async createLiveChatConversation(conversation: schema.InsertLiveChatConversation): Promise<schema.LiveChatConversation> {
    const result = await db.insert(schema.liveChatConversations).values(conversation).returning();
    return result[0];
  }

  async getLiveChatConversation(id: string): Promise<schema.LiveChatConversation | undefined> {
    const result = await db.select().from(schema.liveChatConversations).where(eq(schema.liveChatConversations.id, id));
    return result[0];
  }

  async getLiveChatConversationsByOrganization(organizationId: string): Promise<schema.LiveChatConversation[]> {
    return await db.select().from(schema.liveChatConversations)
      .where(eq(schema.liveChatConversations.organizationId, organizationId))
      .orderBy(desc(schema.liveChatConversations.lastMessageAt));
  }

  async getLiveChatConversationsByUser(userId: string): Promise<schema.LiveChatConversation[]> {
    return await db.select().from(schema.liveChatConversations)
      .where(eq(schema.liveChatConversations.userId, userId))
      .orderBy(desc(schema.liveChatConversations.lastMessageAt));
  }

  async getLiveChatConversationsByAgent(agentId: string): Promise<schema.LiveChatConversation[]> {
    return await db.select().from(schema.liveChatConversations)
      .where(eq(schema.liveChatConversations.assignedAgentId, agentId))
      .orderBy(desc(schema.liveChatConversations.lastMessageAt));
  }

  async updateLiveChatConversation(id: string, conversation: Partial<schema.InsertLiveChatConversation>): Promise<schema.LiveChatConversation | undefined> {
    const result = await db.update(schema.liveChatConversations)
      .set({ ...conversation, updatedAt: new Date() })
      .where(eq(schema.liveChatConversations.id, id))
      .returning();
    return result[0];
  }

  async createLiveChatMessage(message: schema.InsertLiveChatMessage): Promise<schema.LiveChatMessage> {
    const result = await db.insert(schema.liveChatMessages).values(message).returning();
    return result[0];
  }

  async getLiveChatMessage(id: string): Promise<schema.LiveChatMessage | undefined> {
    const result = await db.select().from(schema.liveChatMessages).where(eq(schema.liveChatMessages.id, id));
    return result[0];
  }

  async getLiveChatMessages(conversationId: string): Promise<schema.LiveChatMessage[]> {
    return await db.select().from(schema.liveChatMessages)
      .where(eq(schema.liveChatMessages.conversationId, conversationId))
      .orderBy(schema.liveChatMessages.createdAt);
  }

  async markLiveChatMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await db.update(schema.liveChatMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(schema.liveChatMessages.conversationId, conversationId),
          ne(schema.liveChatMessages.senderId, userId),
          eq(schema.liveChatMessages.isRead, false)
        )
      );
  }

  async createAgentAvailability(availability: schema.InsertAgentAvailability): Promise<schema.AgentAvailability> {
    const result = await db.insert(schema.agentAvailability).values(availability).returning();
    return result[0];
  }

  async getAgentAvailability(userId: string): Promise<schema.AgentAvailability | undefined> {
    const result = await db.select().from(schema.agentAvailability).where(eq(schema.agentAvailability.userId, userId));
    return result[0];
  }

  async getAllAgentAvailability(): Promise<schema.AgentAvailability[]> {
    return await db.select().from(schema.agentAvailability);
  }

  async updateAgentAvailability(userId: string, availability: Partial<schema.InsertAgentAvailability>): Promise<schema.AgentAvailability | undefined> {
    const result = await db.update(schema.agentAvailability)
      .set({ ...availability, updatedAt: new Date() })
      .where(eq(schema.agentAvailability.userId, userId))
      .returning();
    return result[0];
  }

  async getAvailableAgents(): Promise<schema.AgentAvailability[]> {
    return await db.select().from(schema.agentAvailability)
      .where(
        and(
          eq(schema.agentAvailability.status, 'online'),
          eq(schema.agentAvailability.isAcceptingChats, true),
          sql`${schema.agentAvailability.currentChatCount} < ${schema.agentAvailability.maxConcurrentChats}`
        )
      )
      .orderBy(schema.agentAvailability.currentChatCount);
  }
}

export const storage = new DbStorage();
