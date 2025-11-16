import { AgentMetadata, AgentConnection } from '@shared/types/agent';
import { WebSocket } from 'ws';

class AgentOrchestrator {
  private registry: Map<string, AgentMetadata> = new Map();
  private connections: Map<string, AgentConnection & { ws: WebSocket }> = new Map();
  
  /**
   * Register an agent in the orchestrator
   */
  registerAgent(metadata: AgentMetadata): void {
    if (this.registry.has(metadata.slug)) {
      console.warn(`[Orchestrator] Agent ${metadata.slug} already registered, skipping`);
      return;
    }
    
    console.log(`[Orchestrator] Registering agent: ${metadata.name} (${metadata.slug})`);
    this.registry.set(metadata.slug, metadata);
  }
  
  /**
   * Get agent metadata by slug
   */
  getAgent(slug: string): AgentMetadata | null {
    return this.registry.get(slug) || null;
  }
  
  /**
   * Get all registered agents
   */
  getAllAgents(): AgentMetadata[] {
    return Array.from(this.registry.values());
  }
  
  /**
   * Get all route paths across all agents
   */
  getAllRoutes(): Map<string, AgentMetadata> {
    const routes = new Map<string, AgentMetadata>();
    
    for (const agent of this.registry.values()) {
      for (const path of agent.routePaths) {
        routes.set(path, agent);
      }
    }
    
    return routes;
  }
  
  /**
   * Handle new WebSocket connection
   */
  handleConnection(
    ws: WebSocket,
    agentSlug: string,
    sessionId: string,
    userId: number,
    organizationId: number
  ): void {
    const agent = this.getAgent(agentSlug);
    if (!agent) {
      throw new Error(`Agent ${agentSlug} not found in registry`);
    }
    
    if (!agent.supportsWebSocket) {
      throw new Error(`Agent ${agentSlug} does not support WebSocket connections`);
    }
    
    const connectionId = `${agentSlug}:${sessionId}`;
    
    this.connections.set(connectionId, {
      ws,
      agentSlug,
      sessionId,
      userId,
      organizationId,
      connectedAt: new Date(),
    });
    
    console.log(`[Orchestrator] Connection established: ${connectionId} (user: ${userId}, org: ${organizationId})`);
  }
  
  /**
   * Get connection by ID
   */
  getConnection(agentSlug: string, sessionId: string): (AgentConnection & { ws: WebSocket }) | null {
    const connectionId = `${agentSlug}:${sessionId}`;
    return this.connections.get(connectionId) || null;
  }
  
  /**
   * Close a connection
   */
  closeConnection(agentSlug: string, sessionId: string): void {
    const connectionId = `${agentSlug}:${sessionId}`;
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
      this.connections.delete(connectionId);
      console.log(`[Orchestrator] Connection closed: ${connectionId}`);
    }
  }
  
  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    connectionsByAgent: Record<string, number>;
  } {
    const stats = {
      totalConnections: this.connections.size,
      connectionsByAgent: {} as Record<string, number>,
    };
    
    for (const connection of this.connections.values()) {
      stats.connectionsByAgent[connection.agentSlug] =
        (stats.connectionsByAgent[connection.agentSlug] || 0) + 1;
    }
    
    return stats;
  }
  
  /**
   * Get all connections for a user
   */
  getUserConnections(userId: number): (AgentConnection & { ws: WebSocket })[] {
    const userConnections: (AgentConnection & { ws: WebSocket })[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        userConnections.push(connection);
      }
    }
    
    return userConnections;
  }
  
  /**
   * Close all connections for a user (e.g., on logout)
   */
  closeUserConnections(userId: number): void {
    const userConnections = this.getUserConnections(userId);
    
    for (const connection of userConnections) {
      this.closeConnection(connection.agentSlug, connection.sessionId);
    }
    
    console.log(`[Orchestrator] Closed ${userConnections.length} connections for user ${userId}`);
  }
}

export const orchestrator = new AgentOrchestrator();
