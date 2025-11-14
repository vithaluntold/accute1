import { db } from "../db";
import { teamChatMessages, liveChatMessages, teams, liveChatConversations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * ChatThreadingService
 * 
 * Handles chat message threading logic for team chat and live chat.
 * 
 * Threading strategy:
 * 1. If message has inReplyTo: resolve parent message and inherit its threadId
 * 2. If no inReplyTo: create new thread using message's own ID as threadId
 * 
 * Thread ID namespacing:
 * - Team chat: `${teamId}:${rootMessageId}` (namespace per team)
 * - Live chat: just `messageId` (already scoped within conversationId)
 */
export class ChatThreadingService {
  /**
   * Resolve threadId for team chat message
   * 
   * @param messageId - ID of the message being created
   * @param teamId - ID of the team this message belongs to
   * @param inReplyTo - ID of the parent message (if replying)
   * @param organizationId - ID of the organization (for validation)
   * @returns threadId to assign to the message
   * @throws Error if parent message validation fails
   */
  async resolveTeamChatThreadId(
    messageId: string,
    teamId: string,
    inReplyTo: string | null,
    organizationId: string
  ): Promise<string> {
    // If no parent message, create new thread
    if (!inReplyTo) {
      return `${teamId}:${messageId}`;
    }

    // Find parent message
    const parentMessages = await db
      .select({
        id: teamChatMessages.id,
        teamId: teamChatMessages.teamId,
        threadId: teamChatMessages.threadId,
        organizationId: teams.organizationId,
      })
      .from(teamChatMessages)
      .innerJoin(teams, eq(teamChatMessages.teamId, teams.id))
      .where(eq(teamChatMessages.id, inReplyTo))
      .limit(1);

    const parentMessage = parentMessages[0];

    // Validate parent message exists
    if (!parentMessage) {
      throw new Error(`Parent message ${inReplyTo} not found`);
    }

    // Validate parent belongs to same team
    if (parentMessage.teamId !== teamId) {
      throw new Error(
        `Parent message belongs to team ${parentMessage.teamId}, but current message is for team ${teamId}`
      );
    }

    // Validate parent belongs to same organization
    if (parentMessage.organizationId !== organizationId) {
      throw new Error(
        `Parent message belongs to organization ${parentMessage.organizationId}, but current message is for organization ${organizationId}`
      );
    }

    // Inherit threadId from parent
    // If parent has no threadId, create one using parent's ID
    return parentMessage.threadId || `${teamId}:${parentMessage.id}`;
  }

  /**
   * Resolve threadId for live chat message
   * 
   * @param messageId - ID of the message being created
   * @param conversationId - ID of the conversation this message belongs to
   * @param inReplyTo - ID of the parent message (if replying)
   * @param organizationId - ID of the organization (for validation)
   * @returns threadId to assign to the message
   * @throws Error if parent message validation fails
   */
  async resolveLiveChatThreadId(
    messageId: string,
    conversationId: string,
    inReplyTo: string | null,
    organizationId: string
  ): Promise<string> {
    // If no parent message, create new thread (just messageId, already scoped by conversationId)
    if (!inReplyTo) {
      return messageId;
    }

    // Find parent message
    const parentMessages = await db
      .select({
        id: liveChatMessages.id,
        conversationId: liveChatMessages.conversationId,
        threadId: liveChatMessages.threadId,
        organizationId: liveChatConversations.organizationId,
      })
      .from(liveChatMessages)
      .innerJoin(liveChatConversations, eq(liveChatMessages.conversationId, liveChatConversations.id))
      .where(eq(liveChatMessages.id, inReplyTo))
      .limit(1);

    const parentMessage = parentMessages[0];

    // Validate parent message exists
    if (!parentMessage) {
      throw new Error(`Parent message ${inReplyTo} not found`);
    }

    // Validate parent belongs to same conversation
    if (parentMessage.conversationId !== conversationId) {
      throw new Error(
        `Parent message belongs to conversation ${parentMessage.conversationId}, but current message is for conversation ${conversationId}`
      );
    }

    // Validate parent belongs to same organization
    if (parentMessage.organizationId !== organizationId) {
      throw new Error(
        `Parent message belongs to organization ${parentMessage.organizationId}, but current message is for organization ${organizationId}`
      );
    }

    // Inherit threadId from parent
    // If parent has no threadId, use parent's ID as threadId
    return parentMessage.threadId || parentMessage.id;
  }

  /**
   * Get all messages in a team chat thread
   * 
   * @param threadId - Thread ID to fetch messages for
   * @param teamId - Team ID for scope validation
   * @param organizationId - Organization ID for validation
   * @returns Array of messages in the thread, ordered by creation time
   */
  async getTeamChatThreadMessages(
    threadId: string,
    teamId: string,
    organizationId: string
  ) {
    return db
      .select({
        message: teamChatMessages,
        organizationId: teams.organizationId,
      })
      .from(teamChatMessages)
      .innerJoin(teams, eq(teamChatMessages.teamId, teams.id))
      .where(
        and(
          eq(teamChatMessages.threadId, threadId),
          eq(teamChatMessages.teamId, teamId),
          eq(teams.organizationId, organizationId)
        )
      )
      .orderBy(teamChatMessages.createdAt);
  }

  /**
   * Get all messages in a live chat thread
   * 
   * @param threadId - Thread ID to fetch messages for
   * @param conversationId - Conversation ID for scope validation
   * @param organizationId - Organization ID for validation
   * @returns Array of messages in the thread, ordered by creation time
   */
  async getLiveChatThreadMessages(
    threadId: string,
    conversationId: string,
    organizationId: string
  ) {
    return db
      .select({
        message: liveChatMessages,
        organizationId: liveChatConversations.organizationId,
      })
      .from(liveChatMessages)
      .innerJoin(liveChatConversations, eq(liveChatMessages.conversationId, liveChatConversations.id))
      .where(
        and(
          eq(liveChatMessages.threadId, threadId),
          eq(liveChatMessages.conversationId, conversationId),
          eq(liveChatConversations.organizationId, organizationId)
        )
      )
      .orderBy(liveChatMessages.createdAt);
  }
}

// Export singleton instance
export const chatThreadingService = new ChatThreadingService();
