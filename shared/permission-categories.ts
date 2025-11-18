/**
 * Permission Categorization System (PHASE 1: RBAC Enhancement)
 * 
 * Organizes permissions into logical categories for better UX in role management UI.
 * Includes dependencies and metadata for intelligent permission assignment.
 */

export const PERMISSION_CATEGORIES = {
  "User Management": {
    icon: "Users",
    description: "Manage team members, roles, and access",
    permissions: [
      "users.view", "users.create", "users.edit", "users.delete",
      "roles.view", "roles.create", "roles.edit", "roles.delete",
      "teams.view", "teams.create", "teams.update", "teams.delete", "teams.manage",
      "user_skills.view", "user_skills.manage"
    ]
  },
  "Workflows & Automation": {
    icon: "GitBranch",
    description: "Create and manage workflows, pipelines, and automations",
    permissions: [
      "workflows.view", "workflows.create", "workflows.edit", "workflows.delete", "workflows.execute",
      "pipelines.view", "pipelines.create", "pipelines.update", "pipelines.delete",
      "automation.view", "automation.create", "automation.edit", "automation.delete", "automation.execute",
      "tasks.view", "tasks.create", "tasks.update", "tasks.delete",
      "task_matching.suggest"
    ]
  },
  "AI Agents": {
    icon: "Bot",
    description: "Install and configure AI agents",
    permissions: [
      "ai_agents.view", "ai_agents.install", "ai_agents.configure", "ai_agents.create",
      "roundtable.access", "roundtable.create", "roundtable.manage",
      "llm_configs.view", "llm_configs.create", "llm_configs.edit", "llm_configs.delete", "llm_configs.test"
    ]
  },
  "Documents & Files": {
    icon: "FileText",
    description: "Manage documents, folders, and signatures",
    permissions: [
      "documents.view", "documents.upload", "documents.delete", "documents.share", 
      "documents.sign", "documents.verify", "documents.version", "documents.approve", "documents.download",
      "folders.view", "folders.create", "folders.edit", "folders.delete", "folders.share",
      "signatures.view", "signatures.create", "signatures.sign",
      "documentRequests.view", "documentRequests.create", "documentRequests.edit", 
      "documentRequests.delete", "documentRequests.manage"
    ]
  },
  "Financial Management": {
    icon: "DollarSign",
    description: "Handle invoices, payments, and billing",
    permissions: [
      "invoices.view", "invoices.create", "invoices.update", "invoices.delete", 
      "invoices.send", "invoices.void", "invoices.export",
      "payments.view", "payments.create", "payments.update", 
      "payments.request", "payments.collect", "payments.refund", "payments.reconcile",
      "payment_gateways.view", "payment_gateways.create", "payment_gateways.edit", 
      "payment_gateways.delete", "payment_gateways.test",
      "timeEntries.view", "timeEntries.create", "timeEntries.update", "timeEntries.delete"
    ]
  },
  "Client Portal": {
    icon: "Users2",
    description: "Client-facing features and access",
    permissions: [
      "client_portal.access",
      "action_center.view", "action_center.filter",
      "clients.view", "clients.create", "clients.edit", "clients.delete",
      "contacts.view", "contacts.create", "contacts.edit", "contacts.delete",
      "forms.view", "forms.create", "forms.edit", "forms.delete", 
      "forms.publish", "forms.share", "forms.submit"
    ]
  },
  "Analytics & Reporting": {
    icon: "BarChart",
    description: "View reports and analytics",
    permissions: [
      "analytics.view",
      "reports.view", "reports.create", "reports.export", "reports.schedule",
      "workload.view", "workload.assign",
      "timeline.view", "timeline.create_milestone",
      "gantt.view", "gantt.edit"
    ]
  },
  "Communication": {
    icon: "MessageSquare",
    description: "Team chat, email, and messaging",
    permissions: [
      "chat.view", "chat.create", "chat.send",
      "conversations.view", "conversations.create", "conversations.send",
      "email.view", "email.connect", "email.disconnect", "email.send",
      "inbox.view", "inbox.manage", "inbox.archive",
      "notifications.view", "notifications.create", "notifications.read", "notifications.delete",
      "templates.view", "templates.create", "templates.update", "templates.delete"
    ]
  },
  "Project Management": {
    icon: "Briefcase",
    description: "Projects, tasks, and resource allocation",
    permissions: [
      "projects.view", "projects.create", "projects.update", "projects.delete",
      "resource_allocations.view", "resource_allocations.create", 
      "resource_allocations.update", "resource_allocations.delete",
      "skills.view", "skills.create", "skills.update", "skills.delete", 
      "skills.categories", "skills.stats",
      "appointments.view", "appointments.create", "appointments.update", "appointments.delete",
      "schedules.view", "schedules.create", "schedules.edit", "schedules.delete"
    ]
  },
  "Settings & Configuration": {
    icon: "Settings",
    description: "Organization settings and integrations",
    permissions: [
      "settings.manage",
      "organizations.view", "organizations.edit",
      "tags.view", "tags.create", "tags.edit", "tags.delete", "tags.apply"
    ]
  },
  "Billing & Subscriptions (Owner Only)": {
    icon: "CreditCard",
    description: "Manage subscriptions and billing (requires Owner role)",
    ownerOnly: true,
    dangerous: true,
    permissions: [
      "subscriptions.view", "subscriptions.manage", "subscriptions.billing",
      "billing.view", "billing.update",
      "organization.transfer", "organization.delete"
    ]
  }
};

/**
 * Permission Dependencies
 * Some permissions require other permissions to be enabled first
 */
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // User Management
  "users.edit": ["users.view"],
  "users.delete": ["users.view", "users.edit"],
  "roles.edit": ["roles.view"],
  "roles.delete": ["roles.view"],
  "teams.update": ["teams.view"],
  "teams.delete": ["teams.view"],
  
  // Workflows
  "workflows.edit": ["workflows.view"],
  "workflows.delete": ["workflows.view"],
  "workflows.execute": ["workflows.view"],
  "pipelines.update": ["pipelines.view"],
  "pipelines.delete": ["pipelines.view"],
  
  // Automation
  "automation.edit": ["automation.view"],
  "automation.delete": ["automation.view"],
  "automation.execute": ["automation.view"],
  
  // Documents
  "documents.delete": ["documents.view"],
  "documents.share": ["documents.view"],
  "documents.download": ["documents.view"],
  "folders.edit": ["folders.view"],
  "folders.delete": ["folders.view"],
  "folders.share": ["folders.view"],
  
  // Clients
  "clients.edit": ["clients.view"],
  "clients.delete": ["clients.view", "clients.edit"],
  "contacts.edit": ["contacts.view"],
  "contacts.delete": ["contacts.view"],
  
  // Forms
  "forms.edit": ["forms.view"],
  "forms.delete": ["forms.view"],
  "forms.publish": ["forms.view", "forms.edit"],
  "forms.share": ["forms.view"],
  
  // Invoices
  "invoices.update": ["invoices.view"],
  "invoices.delete": ["invoices.view"],
  "invoices.send": ["invoices.view"],
  "invoices.void": ["invoices.view"],
  
  // Payments
  "payments.update": ["payments.view"],
  "payments.request": ["payments.view"],
  "payments.collect": ["payments.view"],
  "payments.refund": ["payments.view"],
  
  // Reports
  "reports.create": ["reports.view"],
  "reports.export": ["reports.view"],
  "reports.schedule": ["reports.view"],
  
  // Projects
  "projects.update": ["projects.view"],
  "projects.delete": ["projects.view"],
  
  // Tasks
  "tasks.update": ["tasks.view"],
  "tasks.delete": ["tasks.view"],
  
  // Billing (Owner-specific)
  "billing.update": ["billing.view"],
  "subscriptions.manage": ["subscriptions.view"],
  "organization.delete": ["organization.transfer"], // Must be able to transfer before deleting
};

/**
 * Permission Metadata
 * Additional information about critical permissions
 */
export const PERMISSION_METADATA: Record<string, {
  requiredRole?: string;
  dangerous?: boolean;
  description: string;
  subscriptionRequired?: string;
}> = {
  // Owner-only permissions
  "subscriptions.manage": {
    requiredRole: "Owner",
    dangerous: true,
    description: "Allows changing subscription plans and billing. Only organization owners should have this permission."
  },
  "billing.update": {
    requiredRole: "Owner",
    dangerous: true,
    description: "Allows updating payment methods. Only organization owners should have this permission."
  },
  "organization.transfer": {
    requiredRole: "Owner",
    dangerous: true,
    description: "Allows transferring organization ownership to another user. This action is irreversible."
  },
  "organization.delete": {
    requiredRole: "Owner",
    dangerous: true,
    description: "Permanently deletes organization and all data. This action cannot be undone."
  },
  
  // Admin-level permissions (destructive)
  "users.delete": {
    dangerous: true,
    description: "Allows deleting users from the organization. Use with caution."
  },
  "roles.delete": {
    dangerous: true,
    description: "Allows deleting custom roles. Users with deleted roles will lose their permissions."
  },
  "workflows.delete": {
    dangerous: true,
    description: "Allows permanently deleting workflows and their history."
  },
  "clients.delete": {
    dangerous: true,
    description: "Allows deleting clients and all associated data (documents, invoices, etc.)."
  },
  
  // Premium features
  "roundtable.access": {
    subscriptionRequired: "Professional",
    description: "Multi-agent AI collaboration requires Professional plan or higher."
  },
  "llm_configs.create": {
    subscriptionRequired: "Professional",
    description: "Custom LLM configurations require Professional plan or higher."
  },
  "automation.create": {
    subscriptionRequired: "Professional",
    description: "Advanced automation requires Professional plan or higher."
  },
  "reports.create": {
    subscriptionRequired: "Professional",
    description: "Custom report builder requires Professional plan or higher."
  },
  "workload.view": {
    subscriptionRequired: "Professional",
    description: "Team workload analytics requires Professional plan or higher."
  },
};

/**
 * Role Templates
 * Pre-configured permission sets for common accounting firm roles
 */
export const ROLE_TEMPLATES = {
  "Senior Accountant": {
    description: "Full access to workflows, clients, documents, and reports",
    icon: "Calculator",
    permissions: [
      "workflows.view", "workflows.create", "workflows.edit", "workflows.execute",
      "clients.view", "clients.create", "clients.edit",
      "documents.view", "documents.upload", "documents.share", "documents.download",
      "reports.view", "analytics.view",
      "invoices.view", "invoices.create", "invoices.update",
      "timeEntries.view", "timeEntries.create", "timeEntries.update",
      "forms.view", "forms.create", "forms.edit",
      "ai_agents.view"
    ]
  },
  "Tax Specialist": {
    description: "Tax-focused workflows and client data access",
    icon: "FileText",
    permissions: [
      "workflows.view", "workflows.execute",
      "clients.view", "clients.edit",
      "documents.view", "documents.upload", "documents.download",
      "forms.view", "forms.submit",
      "timeEntries.view", "timeEntries.create",
      "ai_agents.view"
    ]
  },
  "Bookkeeper": {
    description: "Invoice and payment management only",
    icon: "Receipt",
    permissions: [
      "invoices.view", "invoices.create", "invoices.update",
      "payments.view", "payments.create",
      "clients.view",
      "reports.view",
      "timeEntries.view", "timeEntries.create"
    ]
  },
  "Junior Staff": {
    description: "Limited access for entry-level employees",
    icon: "User",
    permissions: [
      "workflows.view", "workflows.execute",
      "documents.view", "documents.upload",
      "timeEntries.create", "timeEntries.view",
      "tasks.view", "tasks.update",
      "notifications.view", "notifications.read"
    ]
  },
  "Practice Manager": {
    description: "Team oversight and resource management",
    icon: "UserCog",
    permissions: [
      "workflows.view", "workflows.create", "workflows.edit",
      "users.view", "teams.view", "teams.update",
      "workload.view", "workload.assign",
      "reports.view", "analytics.view",
      "clients.view", "clients.edit",
      "projects.view", "projects.create", "projects.update",
      "resource_allocations.view", "resource_allocations.create", "resource_allocations.update"
    ]
  },
  "Client Services Coordinator": {
    description: "Client communication and onboarding",
    icon: "Headphones",
    permissions: [
      "clients.view", "clients.create", "clients.edit",
      "contacts.view", "contacts.create", "contacts.edit",
      "documents.view", "documents.upload", "documents.share",
      "forms.view", "forms.create", "forms.share",
      "conversations.view", "conversations.create", "conversations.send",
      "appointments.view", "appointments.create", "appointments.update",
      "documentRequests.view", "documentRequests.create"
    ]
  }
};
