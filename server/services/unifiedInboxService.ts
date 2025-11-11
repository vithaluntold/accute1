import { db } from "@db";
import { emailMessages, teamChatMessages, liveChatMessages, liveChatConversations, users, clients, teams } from "@shared/schema";
import { eq, desc, or, and, sql, like, inArray } from "drizzle-orm";

export interface UnifiedConversation {
  id: string;
  type: 'email' | 'team_chat' | 'live_chat';
  subject: string;
  preview: string;
  participants: string[];
  lastMessageAt: Date;
  unreadCount: number;
  isStarred?: boolean;
  clientId?: string;
  clientName?: string;
  threadId?: string;
  conversationId?: string;
  metadata: any;
}

export interface UnifiedMessage {
  id: string;
  conversationId: string;
  type: 'email' | 'team_chat' | 'live_chat';
  content: string;
  sender: {
    id: string;
    name: string;
    email?: string;
  };
  createdAt: Date;
  isRead: boolean;
  attachments: any[];
  metadata: any;
}

export class UnifiedInboxService {
  async getConversations(organizationId: string, filters?: {
    type?: string;
    search?: string;
    unreadOnly?: boolean;
    starredOnly?: boolean;
  }): Promise<UnifiedConversation[]> {
    const conversations: UnifiedConversation[] = [];

    // Fetch email conversations (grouped by threadId)
    if (!filters?.type || filters.type === 'email') {
      const emailThreads = await db
        .select({
          threadId: emailMessages.threadId,
          subject: emailMessages.subject,
          lastMessageAt: sql<Date>`MAX(${emailMessages.receivedAt})`,
          unreadCount: sql<number>`SUM(CASE WHEN ${emailMessages.isRead} = false THEN 1 ELSE 0 END)`,
          isStarred: sql<boolean>`bool_or(${emailMessages.isStarred})`,
          preview: sql<string>`substring((array_agg(${emailMessages.body} ORDER BY ${emailMessages.receivedAt} DESC))[1], 1, 150)`,
          participants: sql<string[]>`array_agg(DISTINCT ${emailMessages.from})`,
        })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.organizationId, organizationId),
            emailMessages.threadId !== null,
            filters?.search ? or(
              like(emailMessages.subject, `%${filters.search}%`),
              like(emailMessages.body, `%${filters.search}%`)
            ) : undefined
          )
        )
        .groupBy(emailMessages.threadId, emailMessages.subject)
        .orderBy(desc(sql`MAX(${emailMessages.receivedAt})`));

      for (const thread of emailThreads) {
        if (filters?.unreadOnly && thread.unreadCount === 0) continue;
        if (filters?.starredOnly && !thread.isStarred) continue;

        conversations.push({
          id: thread.threadId!,
          type: 'email',
          subject: thread.subject,
          preview: thread.preview,
          participants: thread.participants,
          lastMessageAt: thread.lastMessageAt,
          unreadCount: thread.unreadCount,
          isStarred: thread.isStarred,
          threadId: thread.threadId!,
          metadata: {},
        });
      }
    }

    // Fetch team chat conversations (grouped by teamId/clientId with org scoping)
    if (!filters?.type || filters.type === 'team_chat') {
      // Get organization's teams for scoping
      const orgTeams = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.organizationId, organizationId));
      
      const teamIds = orgTeams.map(t => t.id);

      // Get organization's clients for scoping
      const orgClients = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.organizationId, organizationId));
      
      const clientIds = orgClients.map(c => c.id);

      // Only query if we have teams or clients
      if (teamIds.length > 0 || clientIds.length > 0) {
        const teamChats = await db
          .select({
            teamId: teamChatMessages.teamId,
            clientId: teamChatMessages.clientId,
            clientName: clients.name,
            lastMessageAt: sql<Date>`MAX(${teamChatMessages.createdAt})`,
            preview: sql<string>`substring((array_agg(${teamChatMessages.message} ORDER BY ${teamChatMessages.createdAt} DESC))[1], 1, 150)`,
            messageCount: sql<number>`COUNT(*)`,
            unreadCount: sql<number>`SUM(CASE WHEN (${teamChatMessages.metadata}->>'read' IS NULL OR ${teamChatMessages.metadata}->>'read' = 'false') THEN 1 ELSE 0 END)`,
            participants: sql<string[]>`array_agg(DISTINCT ${teamChatMessages.senderId})`,
          })
          .from(teamChatMessages)
          .leftJoin(clients, eq(teamChatMessages.clientId, clients.id))
          .where(
            and(
              or(
                teamIds.length > 0 ? inArray(teamChatMessages.teamId, teamIds) : undefined,
                clientIds.length > 0 ? inArray(teamChatMessages.clientId, clientIds) : undefined
              ),
              filters?.search ? like(teamChatMessages.message, `%${filters.search}%`) : undefined
            )
          )
          .groupBy(teamChatMessages.teamId, teamChatMessages.clientId, clients.name)
          .orderBy(desc(sql`MAX(${teamChatMessages.createdAt})`));

        for (const chat of teamChats) {
          // Apply filters before processing
          if (filters?.unreadOnly && chat.unreadCount === 0) continue;
          if (filters?.starredOnly) continue; // Team chat doesn't support starring yet
          
          // Create deterministic conversation ID (no random UUIDs!)
          const conversationId = chat.clientId || chat.teamId;
          if (!conversationId) continue; // Skip if neither exists
          
          const subject = chat.clientName 
            ? `Chat with ${chat.clientName}`
            : chat.teamId 
              ? `Team Chat ${chat.teamId.substring(0, 8)}`
              : 'Group Chat';

          conversations.push({
            id: conversationId,
            type: 'team_chat',
            subject,
            preview: chat.preview,
            participants: chat.participants,
            lastMessageAt: chat.lastMessageAt,
            unreadCount: chat.unreadCount,
            clientId: chat.clientId || undefined,
            clientName: chat.clientName || undefined,
            metadata: { messageCount: chat.messageCount },
          });
        }
      }
    }

    // Fetch live chat conversations
    if (!filters?.type || filters.type === 'live_chat') {
      const liveChats = await db
        .select({
          conversationId: liveChatConversations.id,
          subject: liveChatConversations.subject,
          clientId: liveChatConversations.clientId,
          clientName: clients.name,
          status: liveChatConversations.status,
          lastMessageAt: sql<Date>`MAX(${liveChatMessages.createdAt})`,
          unreadCount: sql<number>`SUM(CASE WHEN ${liveChatMessages.isRead} = false THEN 1 ELSE 0 END)`,
          preview: sql<string>`substring((array_agg(${liveChatMessages.content} ORDER BY ${liveChatMessages.createdAt} DESC))[1], 1, 150)`,
          participants: sql<string[]>`array_agg(DISTINCT ${liveChatMessages.senderId})`,
        })
        .from(liveChatConversations)
        .leftJoin(liveChatMessages, eq(liveChatMessages.conversationId, liveChatConversations.id))
        .leftJoin(clients, eq(liveChatConversations.clientId, clients.id))
        .where(
          and(
            eq(liveChatConversations.organizationId, organizationId),
            filters?.search ? or(
              like(liveChatConversations.subject, `%${filters.search}%`),
              like(liveChatMessages.content, `%${filters.search}%`)
            ) : undefined
          )
        )
        .groupBy(
          liveChatConversations.id,
          liveChatConversations.subject,
          liveChatConversations.clientId,
          liveChatConversations.status,
          clients.name
        )
        .orderBy(desc(sql`MAX(${liveChatMessages.createdAt})`));

      for (const chat of liveChats) {
        if (filters?.unreadOnly && chat.unreadCount === 0) continue;

        conversations.push({
          id: chat.conversationId,
          type: 'live_chat',
          subject: chat.subject || `Chat with ${chat.clientName || 'Client'}`,
          preview: chat.preview,
          participants: chat.participants,
          lastMessageAt: chat.lastMessageAt,
          unreadCount: chat.unreadCount,
          clientId: chat.clientId || undefined,
          clientName: chat.clientName || undefined,
          conversationId: chat.conversationId,
          metadata: { status: chat.status },
        });
      }
    }

    // Sort all conversations by lastMessageAt
    return conversations.sort((a, b) => 
      b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
  }

  async getMessages(conversationId: string, type: 'email' | 'team_chat' | 'live_chat'): Promise<UnifiedMessage[]> {
    const messages: UnifiedMessage[] = [];

    if (type === 'email') {
      // Fetch all emails in the thread
      const emails = await db
        .select()
        .from(emailMessages)
        .where(eq(emailMessages.threadId, conversationId))
        .orderBy(desc(emailMessages.receivedAt));

      for (const email of emails) {
        messages.push({
          id: email.id,
          conversationId,
          type: 'email',
          content: email.body,
          sender: {
            id: email.from,
            name: email.from,
            email: email.from,
          },
          createdAt: email.receivedAt,
          isRead: email.isRead || false,
          attachments: (email.attachments as any[]) || [],
          metadata: { subject: email.subject, to: email.to, cc: email.cc },
        });
      }
    } else if (type === 'team_chat') {
      // Fetch team chat messages
      const chats = await db
        .select({
          message: teamChatMessages,
          senderName: users.fullName,
          senderEmail: users.email,
        })
        .from(teamChatMessages)
        .leftJoin(users, eq(teamChatMessages.senderId, users.id))
        .where(
          or(
            eq(teamChatMessages.teamId, conversationId),
            eq(teamChatMessages.clientId, conversationId)
          )
        )
        .orderBy(desc(teamChatMessages.createdAt));

      for (const chat of chats) {
        // Read status from metadata (default to false for unread)
        const metadata = (chat.message.metadata as any) || {};
        const isRead = metadata.read === true || metadata.read === 'true';
        
        messages.push({
          id: chat.message.id,
          conversationId,
          type: 'team_chat',
          content: chat.message.message,
          sender: {
            id: chat.message.senderId,
            name: chat.senderName || 'Unknown User',
            email: chat.senderEmail || undefined,
          },
          createdAt: chat.message.createdAt,
          isRead,
          attachments: [],
          metadata: chat.message.metadata || {},
        });
      }
    } else if (type === 'live_chat') {
      // Fetch live chat messages
      const chats = await db
        .select({
          message: liveChatMessages,
          senderName: users.fullName,
          senderEmail: users.email,
        })
        .from(liveChatMessages)
        .leftJoin(users, eq(liveChatMessages.senderId, users.id))
        .where(eq(liveChatMessages.conversationId, conversationId))
        .orderBy(desc(liveChatMessages.createdAt));

      for (const chat of chats) {
        messages.push({
          id: chat.message.id,
          conversationId,
          type: 'live_chat',
          content: chat.message.content,
          sender: {
            id: chat.message.senderId,
            name: chat.senderName || 'Unknown User',
            email: chat.senderEmail || undefined,
          },
          createdAt: chat.message.createdAt,
          isRead: chat.message.isRead,
          attachments: (chat.message.attachments as any[]) || [],
          metadata: { senderType: chat.message.senderType, isInternal: chat.message.isInternal },
        });
      }
    }

    return messages;
  }

  async markAsRead(conversationId: string, type: 'email' | 'team_chat' | 'live_chat'): Promise<void> {
    if (type === 'email') {
      await db
        .update(emailMessages)
        .set({ isRead: true })
        .where(eq(emailMessages.threadId, conversationId));
    } else if (type === 'team_chat') {
      // Bulk update: Set metadata->read = true for all messages in conversation
      await db
        .update(teamChatMessages)
        .set({ 
          metadata: sql`jsonb_set(COALESCE(${teamChatMessages.metadata}, '{}'::jsonb), '{read}', 'true'::jsonb)` 
        })
        .where(
          or(
            eq(teamChatMessages.teamId, conversationId),
            eq(teamChatMessages.clientId, conversationId)
          )
        );
    } else if (type === 'live_chat') {
      await db
        .update(liveChatMessages)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(liveChatMessages.conversationId, conversationId));
    }
  }
}

export const unifiedInboxService = new UnifiedInboxService();
