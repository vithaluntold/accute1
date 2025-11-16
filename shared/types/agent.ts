export interface AgentMetadata {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  category: 'finance' | 'compliance' | 'automation' | 'communication' | 'analytics';
  
  // Feature flags
  hasSessionPersistence: boolean;
  requiresLLMConfig: boolean;
  supportsFileUpload: boolean;
  supportsWebSocket: boolean;
  
  // Routing
  websocketTopic: string;
  routePaths: string[];
  primaryPath: string;
  
  // Capabilities
  supportedFileTypes?: string[];
  maxFileSize?: number;
  
  // Metadata
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCapabilities {
  canAnalyzeDocuments: boolean;
  canGenerateReports: boolean;
  canManageWorkflows: boolean;
  canAccessCalendar: boolean;
  canSendNotifications: boolean;
}

export interface AgentConnection {
  agentSlug: string;
  sessionId: string;
  userId: number;
  organizationId: number;
  connectedAt: Date;
}
