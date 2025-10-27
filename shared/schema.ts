import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with role-based access
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  organizationId: varchar("organization_id").references(() => organizations.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Organizations for multi-tenancy
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Roles table (Super Admin, Admin, Employee, Client)
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").notNull().default(false),
  organizationId: varchar("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Permissions for granular access control
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Role-Permission junction table
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sessions for authentication
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Workflows for accounting automation
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"), // 'tax', 'audit', 'bookkeeping', 'custom'
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  // Visual workflow builder data
  nodes: jsonb("nodes").notNull().default(sql`'[]'::jsonb`), // Array of workflow nodes
  edges: jsonb("edges").notNull().default(sql`'[]'::jsonb`), // Array of connections between nodes
  viewport: jsonb("viewport").default(sql`'{"x": 0, "y": 0, "zoom": 1}'::jsonb`), // Canvas viewport state
  // Workflow state
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'archived'
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  // Trigger configuration
  trigger: jsonb("trigger").default(sql`'{}'::jsonb`), // Trigger type and configuration
  // Metadata
  lastPublishedAt: timestamp("last_published_at"),
  lastExecutedAt: timestamp("last_executed_at"),
  executionCount: integer("execution_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Workflow Executions - track workflow runs
export const workflowExecutions = pgTable("workflow_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  workflowVersion: integer("workflow_version").notNull(), // Critical: track which version executed
  triggeredBy: varchar("triggered_by").references(() => users.id),
  status: text("status").notNull().default("running"), // 'running', 'completed', 'failed', 'cancelled'
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  // Execution data
  input: jsonb("input").default(sql`'{}'::jsonb`),
  output: jsonb("output").default(sql`'{}'::jsonb`),
  error: text("error"),
  // Node execution tracking
  nodeExecutions: jsonb("node_executions").notNull().default(sql`'[]'::jsonb`), // Track which nodes executed
  currentNodeId: varchar("current_node_id"),
  // Metadata
  duration: integer("duration"), // milliseconds
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance on multi-tenant queries
  orgWorkflowIdx: index("workflow_executions_org_workflow_idx").on(table.organizationId, table.workflowId),
  workflowStatusIdx: index("workflow_executions_workflow_status_idx").on(table.workflowId, table.status),
}));

// AI Agents in marketplace
export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  provider: text("provider").notNull(),
  category: text("category").notNull(),
  capabilities: jsonb("capabilities").notNull().default([]),
  configuration: jsonb("configuration").notNull().default({}),
  rating: integer("rating").default(0),
  installCount: integer("install_count").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  // Directory paths for agent code
  backendPath: text("backend_path"),
  frontendPath: text("frontend_path"),
  // Subscription and pricing
  pricingModel: text("pricing_model").notNull().default("free"),
  priceMonthly: integer("price_monthly").default(0),
  priceYearly: integer("price_yearly").default(0),
  // Metadata
  version: text("version").notNull().default("1.0.0"),
  tags: jsonb("tags").notNull().default([]),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Agent Installations
export const aiAgentInstallations = pgTable("ai_agent_installations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  installedBy: varchar("installed_by").notNull().references(() => users.id),
  configuration: jsonb("configuration").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI Provider Configurations
export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  provider: text("provider").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  endpoint: text("endpoint"),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Documents for client portal
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  workflowId: varchar("workflow_id").references(() => workflows.id),
  status: text("status").notNull().default("pending"),
  encryptedContent: text("encrypted_content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Activity logs for audit trail
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  organizationId: varchar("organization_id").references(() => organizations.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: varchar("resource_id"),
  metadata: jsonb("metadata").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Super Admin Keys for controlled super admin onboarding
export const superAdminKeys = pgTable("super_admin_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyHash: text("key_hash").notNull().unique(),
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  usedBy: varchar("used_by").references(() => users.id),
  usedAt: timestamp("used_at"),
  revokedAt: timestamp("revoked_at"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invitations for employee and client onboarding
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenHash: text("token_hash").notNull().unique(),
  type: text("type").notNull(), // 'email' or 'sms'
  email: text("email"),
  phone: text("phone"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'expired', 'revoked'
  expiresAt: timestamp("expires_at").notNull(),
  acceptedBy: varchar("accepted_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Clients for accounting firms
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").notNull().default("US"),
  taxId: text("tax_id"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'prospect'
  industry: text("industry"),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contacts table - individual contacts within client companies
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  title: text("title"),
  department: text("department"),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tags for organizing resources
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6b7280"), // Default gray
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Polymorphic taggables junction table
export const taggables = pgTable("taggables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  taggableType: text("taggable_type").notNull(), // 'document', 'client', 'workflow', 'contact', etc.
  taggableId: varchar("taggable_id").notNull(), // ID of the tagged resource
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Form Templates - Advanced form builder for organizers and questionnaires
export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"), // 'tax', 'audit', 'onboarding', 'custom'
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  // Form structure
  fields: jsonb("fields").notNull().default(sql`'[]'::jsonb`), // Array of form fields
  sections: jsonb("sections").notNull().default(sql`'[]'::jsonb`), // Group fields into sections
  pages: jsonb("pages").notNull().default(sql`'[]'::jsonb`), // Multi-page forms
  // Conditional logic
  conditionalRules: jsonb("conditional_rules").notNull().default(sql`'[]'::jsonb`), // Show/hide logic
  validationRules: jsonb("validation_rules").notNull().default(sql`'[]'::jsonb`), // Custom validation
  calculatedFields: jsonb("calculated_fields").notNull().default(sql`'[]'::jsonb`), // Auto-calculated fields
  // Folder mapping for document organization
  folderStructure: jsonb("folder_structure").default(sql`'{}'::jsonb`), // Maps form sections to folder paths
  // Settings
  settings: jsonb("settings").default(sql`'{}'::jsonb`), // Notifications, confirmations, etc.
  // State
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'archived'
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  // Metadata
  lastPublishedAt: timestamp("last_published_at"),
  submissionCount: integer("submission_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Form Submissions - Store form responses
export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formTemplateId: varchar("form_template_id").notNull().references(() => formTemplates.id, { onDelete: "cascade" }),
  formVersion: integer("form_version").notNull(), // Track which version was submitted
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  submittedBy: varchar("submitted_by").references(() => users.id),
  clientId: varchar("client_id").references(() => clients.id), // Link to client if applicable
  // Submission data
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`), // Form field responses
  attachments: jsonb("attachments").notNull().default(sql`'[]'::jsonb`), // Uploaded files metadata
  // Status tracking
  status: text("status").notNull().default("submitted"), // 'submitted', 'under_review', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  // Metadata
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  orgFormIdx: index("form_submissions_org_form_idx").on(table.organizationId, table.formTemplateId),
  clientIdx: index("form_submissions_client_idx").on(table.clientId),
  statusIdx: index("form_submissions_status_idx").on(table.status),
}));

// Form Share Links - For client portal secure sharing
export const formShareLinks = pgTable("form_share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formTemplateId: varchar("form_template_id").notNull().references(() => formTemplates.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  // Share link configuration
  shareToken: varchar("share_token").notNull().unique(), // Unique token for the URL
  clientId: varchar("client_id").references(() => clients.id), // Optional: associate with specific client
  // Security settings
  password: text("password"), // Optional: bcrypt hashed password
  expiresAt: timestamp("expires_at"), // Optional: expiration date
  maxSubmissions: integer("max_submissions"), // Optional: limit number of submissions
  // Tracking
  status: text("status").notNull().default("active"), // 'active', 'expired', 'disabled'
  viewCount: integer("view_count").notNull().default(0),
  submissionCount: integer("submission_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  // Metadata
  dueDate: timestamp("due_date"), // When client should complete the form
  notes: text("notes"), // Internal notes about this share
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("form_share_links_token_idx").on(table.shareToken),
  formIdx: index("form_share_links_form_idx").on(table.formTemplateId),
  clientIdx: index("form_share_links_client_idx").on(table.clientId),
}));

// Form Builder TypeScript Types
export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "url"
  | "date"
  | "time"
  | "datetime"
  | "select"
  | "multi_select"
  | "radio"
  | "checkbox"
  | "file_upload"
  | "signature"
  | "name"          // Composite: title, first, middle, last
  | "address"       // Composite: street, city, state, zip
  | "currency"      // Number with currency symbol/type
  | "decimal"       // Number with decimal precision
  | "percentage"
  | "rating"
  | "slider"
  | "image_choice"  // Image-based single/multi selection
  | "matrix_choice" // Grid of questions with rating scale
  | "audio"         // Audio upload with recording capability
  | "video"         // Video upload with recording capability
  | "camera"        // Camera image capture
  | "unique_id"     // Auto-incremented sequential ID
  | "random_id"     // Random alphanumeric ID
  | "formula"       // Computed field based on other fields
  | "page_break"    // Multi-page form separator
  | "terms"         // Terms & Conditions checkbox
  | "calculated"
  | "heading"
  | "divider"
  | "html";

export interface FormFieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customValidation?: string; // JavaScript expression
  errorMessage?: string;
}

export interface FormFieldOption {
  label: string;
  value: string;
  icon?: string;
  imageUrl?: string; // For image_choice field type
}

export interface CompositeFieldConfig {
  // Name field sub-fields
  showTitle?: boolean;
  showMiddleName?: boolean;
  // Address field configuration
  showLine2?: boolean;
  showCountry?: boolean;
  defaultCountry?: string;
  // Currency configuration
  currencyType?: string; // 'USD', 'EUR', 'GBP', etc.
  allowNegative?: boolean;
  // Decimal configuration
  decimalPlaces?: number;
  // Image choice configuration
  allowMultiple?: boolean; // Allow multiple image selections
  imageSize?: "small" | "medium" | "large"; // Display size of images
  // Matrix choice configuration
  matrixRows?: FormFieldOption[]; // Questions/items to rate
  matrixColumns?: FormFieldOption[]; // Rating scale options
  matrixType?: "radio" | "checkbox"; // Single or multiple selections per row
  // Unique ID configuration
  idPrefix?: string; // Prefix like "INV-", "ORD-"
  idStartingNumber?: number; // Starting number (default: 1)
  idPadding?: number; // Zero padding (default: 3, e.g., 001)
  // Random ID configuration
  randomIdLength?: number; // Length of random ID (default: 8)
  randomIdCharSet?: "alphanumeric" | "alpha" | "numeric"; // Character set
  // Formula configuration
  formulaExpression?: string; // Expression to calculate (e.g., "price * quantity")
  // Terms configuration
  termsText?: string; // Full terms and conditions text
  termsLink?: string; // Link to external terms page
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  description?: string;
  helpText?: string;
  defaultValue?: any;
  // Validation
  validation?: FormFieldValidation;
  // Options for select/radio/checkbox
  options?: FormFieldOption[];
  // File upload settings
  fileTypes?: string[]; // ['pdf', 'jpg', 'png']
  maxFileSize?: number; // in MB
  maxFiles?: number;
  // Composite field configuration (Name, Address, Currency, Decimal)
  config?: CompositeFieldConfig;
  // Conditional logic
  conditionalRules?: FormConditionalRule[];
  // Layout
  width?: "full" | "half" | "third" | "quarter";
  order?: number;
  sectionId?: string;
  pageId?: string;
  // Calculated field
  calculation?: string; // JavaScript expression
  // Folder mapping
  folderPath?: string; // e.g., "Tax Returns/2024/W2"
}

export interface FormConditionalRule {
  id: string;
  condition: string; // JavaScript expression, e.g., "field_income > 100000"
  action: "show" | "hide" | "require" | "disable";
  targetFieldIds: string[];
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order?: number;
  isRepeatable?: boolean; // For repeating sections
  minRepeat?: number;
  maxRepeat?: number;
  folderPath?: string; // Auto-create folder for this section
}

export interface FormPage {
  id: string;
  title: string;
  description?: string;
  order?: number;
  sectionIds: string[];
}

export interface FormSettings {
  // Submission
  allowMultipleSubmissions?: boolean;
  requireAuth?: boolean;
  // Notifications
  sendConfirmationEmail?: boolean;
  confirmationEmailTemplate?: string;
  notifyOnSubmission?: boolean;
  notificationRecipients?: string[];
  // Workflow integration
  triggerWorkflowOnSubmit?: boolean;
  workflowId?: string;
  // Folder automation
  autoCreateFolders?: boolean;
  baseFolderPath?: string;
}

// Workflow TypeScript Types for Nodes and Edges
export type WorkflowNodeType = 
  | "trigger"
  | "condition"
  | "action"
  | "delay"
  | "notification"
  | "approval"
  | "loop"
  | "end";

export type WorkflowTriggerType =
  | "manual"
  | "schedule"
  | "document_upload"
  | "client_created"
  | "form_submitted"
  | "email_received"
  | "webhook";

export type WorkflowActionType =
  | "send_email"
  | "send_notification"
  | "create_task"
  | "update_document"
  | "run_ai_agent"
  | "http_request"
  | "create_organizer"
  | "assign_to_user";

export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  config: Record<string, any>;
  // For trigger nodes
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, any>;
  // For action nodes
  actionType?: WorkflowActionType;
  actionConfig?: Record<string, any>;
  // For condition nodes
  conditionExpression?: string;
  conditionConfig?: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  // For conditional edges
  condition?: string;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: Record<string, any>;
  // For schedule triggers
  schedule?: {
    cron?: string;
    timezone?: string;
  };
  // For event triggers
  event?: {
    resource: string;
    action: string;
  };
}

// Zod Schemas and Types
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  lastPublishedAt: true,
  lastExecutedAt: true,
  executionCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  organizationId: true,
  startedAt: true,
  createdAt: true,
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSuperAdminKeySchema = createInsertSchema(superAdminKeys).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaggableSchema = createInsertSchema(taggables).omit({
  id: true,
  createdAt: true,
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  lastPublishedAt: true,
  submissionCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  organizationId: true,
  submittedAt: true,
  createdAt: true,
});

export const insertFormShareLinkSchema = createInsertSchema(formShareLinks).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  viewCount: true,
  submissionCount: true,
  lastAccessedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertSuperAdminKey = z.infer<typeof insertSuperAdminKeySchema>;
export type SuperAdminKey = typeof superAdminKeys.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTaggable = z.infer<typeof insertTaggableSchema>;
export type Taggable = typeof taggables.$inferSelect;
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormShareLink = z.infer<typeof insertFormShareLinkSchema>;
export type FormShareLink = typeof formShareLinks.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type AiAgentInstallation = typeof aiAgentInstallations.$inferSelect;
export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect;
