import { db } from "@db";
import { eq, and, inArray } from "drizzle-orm";
import { users, notifications } from "@shared/schema";

export interface MentionContext {
  resourceType: 'comment' | 'task' | 'workflow' | 'project';
  resourceId: string;
  resourceTitle?: string;
  organizationId: string;
  mentionedBy: string;
  content: string;
}

export class MentionService {
  /**
   * Extract user IDs from @mention syntax in text
   * Supports: @userId or @[userId]
   */
  static extractMentions(text: string): string[] {
    const mentionPattern = /@\[([a-zA-Z0-9-]+)\]|@([a-zA-Z0-9-]+)/g;
    const mentions = new Set<string>();
    
    let match;
    while ((match = mentionPattern.exec(text)) !== null) {
      const userId = match[1] || match[2];
      if (userId) {
        mentions.add(userId);
      }
    }
    
    return Array.from(mentions);
  }

  /**
   * Create notifications for all mentioned users
   */
  static async createMentionNotifications(context: MentionContext): Promise<void> {
    const mentionedUserIds = this.extractMentions(context.content);
    
    if (mentionedUserIds.length === 0) {
      return;
    }

    // Verify mentioned users exist and belong to the organization
    const validUsers = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(
        and(
          inArray(users.id, mentionedUserIds),
          eq(users.organizationId, context.organizationId)
        )
      );

    if (validUsers.length === 0) {
      return;
    }

    // Get the user who created the mention
    const mentioner = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, context.mentionedBy))
      .limit(1);

    const mentionerName = mentioner[0]?.fullName || 'Someone';

    // Create notifications for each mentioned user
    const notificationPromises = validUsers.map(async (user) => {
      const title = this.getNotificationTitle(context.resourceType, mentionerName);
      const message = this.getNotificationMessage(
        context.resourceType,
        mentionerName,
        context.resourceTitle || '',
        context.content
      );

      await db.insert(notifications).values({
        userId: user.id,
        title,
        message,
        type: 'mention',
        isRead: false,
        metadata: {
          mentionedBy: context.mentionedBy,
          resourceType: context.resourceType,
          resourceId: context.resourceId,
          resourceTitle: context.resourceTitle,
        },
      });
    });

    await Promise.all(notificationPromises);
  }

  private static getNotificationTitle(resourceType: string, mentionerName: string): string {
    const typeMap: Record<string, string> = {
      comment: `${mentionerName} mentioned you in a comment`,
      task: `${mentionerName} mentioned you in a task`,
      workflow: `${mentionerName} mentioned you in a workflow`,
      project: `${mentionerName} mentioned you in a project`,
    };
    return typeMap[resourceType] || `${mentionerName} mentioned you`;
  }

  private static getNotificationMessage(
    resourceType: string,
    mentionerName: string,
    resourceTitle: string,
    content: string
  ): string {
    const truncatedContent = content.length > 100 
      ? content.substring(0, 100) + '...' 
      : content;
    
    return resourceTitle
      ? `${mentionerName} mentioned you in ${resourceType} "${resourceTitle}": ${truncatedContent}`
      : `${mentionerName} mentioned you: ${truncatedContent}`;
  }

  /**
   * Get users available for @mention autocomplete
   */
  static async getOrganizationUsers(organizationId: string, searchQuery?: string): Promise<Array<{ id: string; fullName: string; email: string; role: string }>> {
    let query = db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .limit(50);

    const results = await query;
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      return results.filter(
        (user) =>
          user.fullName.toLowerCase().includes(lowerQuery) ||
          user.email.toLowerCase().includes(lowerQuery)
      );
    }
    
    return results;
  }

  /**
   * Replace user IDs with display names in text
   */
  static async replaceUserIdsWithNames(text: string, organizationId: string): Promise<string> {
    const mentionedUserIds = this.extractMentions(text);
    
    if (mentionedUserIds.length === 0) {
      return text;
    }

    const validUsers = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(
        and(
          inArray(users.id, mentionedUserIds),
          eq(users.organizationId, organizationId)
        )
      );

    let result = text;
    for (const user of validUsers) {
      result = result.replace(
        new RegExp(`@\\[${user.id}\\]`, 'g'),
        `@${user.fullName}`
      );
    }

    return result;
  }
}
