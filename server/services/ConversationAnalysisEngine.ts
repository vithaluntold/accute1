/**
 * ConversationAnalysisEngine - Privacy-First Conversation Analytics
 * 
 * Analyzes team chat and live chat messages to extract aggregated metrics
 * for personality profiling. Implements strict privacy-first architecture:
 * 
 * Privacy Guarantees:
 * - NO raw message content storage
 * - NO message text returned in metrics
 * - Only aggregated statistical data
 * - GDPR-compliant data minimization
 * 
 * Analysis Capabilities:
 * - Message volume and frequency patterns
 * - Response time analysis
 * - Sentiment distribution (positive/neutral/negative)
 * - Communication style indicators
 * - Engagement and collaboration metrics
 * - Linguistic pattern analysis
 */

import { db } from "../db";
import { teamChatMessages, liveChatMessages } from "@shared/schema";
import { eq, and, between, sql, desc } from "drizzle-orm";

/**
 * Aggregated conversation metrics for personality analysis
 * (Privacy-safe: no raw message content)
 */
export interface ConversationMetrics {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  messageCount: number;
  avgMessageLength: number;
  avgResponseTimeSeconds: number;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
  questionAskedCount: number;
  exclamationCount: number;
  emojiUsageCount: number;
  conversationsInitiated: number;
  conversationsParticipated: number;
  linguisticMarkers: {
    formalityAvg: number;
    vocabularyDiversity: number;
    technicalTermFrequency: number;
  };
}

/**
 * Analysis period configuration
 */
export interface AnalysisPeriod {
  startDate: Date;
  endDate: Date;
}

/**
 * Conversation Analysis Engine Interface
 */
export interface IConversationAnalysisEngine {
  /**
   * Get aggregated conversation metrics for a user
   * 
   * @param userId - User to analyze
   * @param organizationId - Organization context
   * @param period - Optional time period (defaults to last 30 days)
   * @returns Privacy-safe aggregated metrics
   */
  getConversationMetrics(
    userId: string,
    organizationId: string,
    period?: AnalysisPeriod
  ): Promise<ConversationMetrics>;
}

/**
 * ConversationAnalysisEngine Implementation
 * 
 * Analyzes team chat and live chat messages to extract behavioral patterns
 * while maintaining strict privacy guarantees.
 */
export class ConversationAnalysisEngine implements IConversationAnalysisEngine {
  /**
   * Get aggregated conversation metrics for personality profiling
   * 
   * Implementation:
   * 1. Query team_chat_messages and live_chat_messages
   * 2. Calculate message volume and temporal patterns
   * 3. Analyze sentiment distribution (based on emoji/punctuation heuristics)
   * 4. Extract linguistic markers (formality, diversity, technical terms)
   * 5. Compute engagement metrics (initiated vs participated)
   * 
   * Privacy: Only aggregated statistics, no message content returned
   */
  async getConversationMetrics(
    userId: string,
    organizationId: string,
    period?: AnalysisPeriod
  ): Promise<ConversationMetrics> {
    // Default to last 30 days
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const periodStart = period?.startDate || defaultStart;
    const periodEnd = period?.endDate || now;

    // Parallel queries for team chat and live chat
    const [teamMetrics, liveMetrics] = await Promise.all([
      this.analyzeTeamChatMessages(userId, organizationId, periodStart, periodEnd),
      this.analyzeLiveChatMessages(userId, organizationId, periodStart, periodEnd),
    ]);

    // Merge metrics from both sources
    return this.mergeMetrics(userId, periodStart, periodEnd, teamMetrics, liveMetrics);
  }

  /**
   * Analyze team chat messages for a user
   * (Privacy: aggregated metrics only, no message content)
   * 
   * Returns ConversationMetrics plus internal helper field responseTimeIntervalCount
   */
  private async analyzeTeamChatMessages(
    userId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Partial<ConversationMetrics> & { responseTimeIntervalCount?: number }> {
    // Query messages from the user in the period
    const messages = await db
      .select({
        content: teamChatMessages.message,
        createdAt: teamChatMessages.createdAt,
        threadId: teamChatMessages.threadId,
        inReplyTo: teamChatMessages.inReplyTo,
      })
      .from(teamChatMessages)
      .where(
        and(
          eq(teamChatMessages.senderId, userId),
          eq(teamChatMessages.organizationId, organizationId),
          between(teamChatMessages.createdAt, periodStart, periodEnd)
        )
      )
      .orderBy(teamChatMessages.createdAt); // Chronological for response time calc

    if (messages.length === 0) {
      return this.getEmptyMetrics();
    }

    // Aggregate metrics (privacy-safe)
    const messageCount = messages.length;
    const totalLength = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    const avgMessageLength = Math.round(totalLength / messageCount);

    // Sentiment analysis (heuristic-based, no raw content stored)
    const sentimentCounts = this.analyzeSentimentHeuristics(messages.map(m => m.content || ""));
    
    // Question frequency
    const questionAskedCount = messages.filter(m => 
      (m.content || "").includes("?")
    ).length;

    // Exclamation frequency
    const exclamationCount = messages.filter(m => 
      (m.content || "").includes("!")
    ).length;

    // Emoji usage (simple heuristic)
    const emojiUsageCount = this.countEmojis(messages.map(m => m.content || ""));

    // Conversations initiated (root messages: no inReplyTo)
    // Note: Root messages may have threadId = their own ID, so only check inReplyTo
    const conversationsInitiated = messages.filter(m => !m.inReplyTo).length;

    // Calculate average response time (time between consecutive user messages)
    const responseTime = this.calculateAvgResponseTime(messages);

    // Linguistic markers
    const linguisticMarkers = this.analyzeLinguisticMarkers(
      messages.map(m => m.content || "")
    );

    return {
      messageCount,
      avgMessageLength,
      avgResponseTimeSeconds: responseTime.avgSeconds,
      responseTimeIntervalCount: responseTime.intervalCount,
      sentimentPositive: sentimentCounts.positive,
      sentimentNeutral: sentimentCounts.neutral,
      sentimentNegative: sentimentCounts.negative,
      questionAskedCount,
      exclamationCount,
      emojiUsageCount,
      conversationsInitiated,
      conversationsParticipated: messageCount, // All messages are participation
      linguisticMarkers,
    };
  }

  /**
   * Analyze live chat messages for a user
   * (Privacy: aggregated metrics only, no message content)
   * 
   * Returns ConversationMetrics plus internal helper field responseTimeIntervalCount
   */
  private async analyzeLiveChatMessages(
    userId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Partial<ConversationMetrics> & { responseTimeIntervalCount?: number }> {
    // Query messages from the user in the period
    const messages = await db
      .select({
        content: liveChatMessages.content,
        createdAt: liveChatMessages.createdAt,
        conversationId: liveChatMessages.conversationId,
      })
      .from(liveChatMessages)
      .where(
        and(
          eq(liveChatMessages.senderId, userId),
          eq(liveChatMessages.organizationId, organizationId),
          between(liveChatMessages.createdAt, periodStart, periodEnd)
        )
      )
      .orderBy(liveChatMessages.createdAt); // Chronological for response time calc

    if (messages.length === 0) {
      return this.getEmptyMetrics();
    }

    // Aggregate metrics (privacy-safe)
    const messageCount = messages.length;
    const totalLength = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    const avgMessageLength = Math.round(totalLength / messageCount);

    // Sentiment analysis
    const sentimentCounts = this.analyzeSentimentHeuristics(messages.map(m => m.content || ""));
    
    // Question frequency
    const questionAskedCount = messages.filter(m => 
      (m.content || "").includes("?")
    ).length;

    // Exclamation frequency
    const exclamationCount = messages.filter(m => 
      (m.content || "").includes("!")
    ).length;

    // Emoji usage
    const emojiUsageCount = this.countEmojis(messages.map(m => m.content || ""));

    // Conversations (unique conversation IDs)
    const uniqueConversations = new Set(messages.map(m => m.conversationId)).size;

    // Calculate average response time
    const responseTime = this.calculateAvgResponseTime(messages);

    // Linguistic markers
    const linguisticMarkers = this.analyzeLinguisticMarkers(
      messages.map(m => m.content || "")
    );

    return {
      messageCount,
      avgMessageLength,
      avgResponseTimeSeconds: responseTime.avgSeconds,
      responseTimeIntervalCount: responseTime.intervalCount,
      sentimentPositive: sentimentCounts.positive,
      sentimentNeutral: sentimentCounts.neutral,
      sentimentNegative: sentimentCounts.negative,
      questionAskedCount,
      exclamationCount,
      emojiUsageCount,
      conversationsInitiated: 0, // Live chat doesn't track initiators clearly
      conversationsParticipated: uniqueConversations,
      linguisticMarkers,
    };
  }

  /**
   * Merge metrics from team chat and live chat
   * 
   * Accepts internal helper field (responseTimeIntervalCount) for proper weighting,
   * but does NOT expose it in the returned ConversationMetrics
   */
  private mergeMetrics(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    teamMetrics: Partial<ConversationMetrics> & { responseTimeIntervalCount?: number },
    liveMetrics: Partial<ConversationMetrics> & { responseTimeIntervalCount?: number }
  ): ConversationMetrics {
    const totalMessages = (teamMetrics.messageCount || 0) + (liveMetrics.messageCount || 0);

    if (totalMessages === 0) {
      // Destructure to exclude internal helper field
      const { responseTimeIntervalCount, ...emptyMetrics } = this.getEmptyMetrics();
      
      return {
        userId,
        periodStart,
        periodEnd,
        ...emptyMetrics,
      };
    }

    // Weighted average for message length
    const avgMessageLength = Math.round(
      ((teamMetrics.avgMessageLength || 0) * (teamMetrics.messageCount || 0) +
       (liveMetrics.avgMessageLength || 0) * (liveMetrics.messageCount || 0)) /
      totalMessages
    );

    // Weighted average for sentiment percentages
    const sentimentPositive = Math.round(
      ((teamMetrics.sentimentPositive || 0) * (teamMetrics.messageCount || 0) +
       (liveMetrics.sentimentPositive || 0) * (liveMetrics.messageCount || 0)) /
      totalMessages
    );

    const sentimentNeutral = Math.round(
      ((teamMetrics.sentimentNeutral || 0) * (teamMetrics.messageCount || 0) +
       (liveMetrics.sentimentNeutral || 0) * (liveMetrics.messageCount || 0)) /
      totalMessages
    );

    const sentimentNegative = 100 - sentimentPositive - sentimentNeutral;

    // Weighted average for linguistic markers
    const formalityAvg = Math.round(
      ((teamMetrics.linguisticMarkers?.formalityAvg || 0) * (teamMetrics.messageCount || 0) +
       (liveMetrics.linguisticMarkers?.formalityAvg || 0) * (liveMetrics.messageCount || 0)) /
      totalMessages
    );

    const vocabularyDiversity = Math.round(
      ((teamMetrics.linguisticMarkers?.vocabularyDiversity || 0) * (teamMetrics.messageCount || 0) +
       (liveMetrics.linguisticMarkers?.vocabularyDiversity || 0) * (liveMetrics.messageCount || 0)) /
      totalMessages
    );

    const technicalTermFrequency = Math.round(
      ((teamMetrics.linguisticMarkers?.technicalTermFrequency || 0) * (teamMetrics.messageCount || 0) +
       (liveMetrics.linguisticMarkers?.technicalTermFrequency || 0) * (liveMetrics.messageCount || 0)) /
      totalMessages
    );

    // Weighted average for response time (weight by interval count, not message count)
    // This prevents fallback values from contaminating real response time data
    const totalIntervals = (teamMetrics.responseTimeIntervalCount || 0) + 
                           (liveMetrics.responseTimeIntervalCount || 0);
    
    const avgResponseTimeSeconds = totalIntervals > 0
      ? Math.round(
          ((teamMetrics.avgResponseTimeSeconds || 0) * (teamMetrics.responseTimeIntervalCount || 0) +
           (liveMetrics.avgResponseTimeSeconds || 0) * (liveMetrics.responseTimeIntervalCount || 0)) /
          totalIntervals
        )
      : 240; // Fallback only if both sources have no valid intervals

    return {
      userId,
      periodStart,
      periodEnd,
      messageCount: totalMessages,
      avgMessageLength,
      avgResponseTimeSeconds,
      sentimentPositive,
      sentimentNeutral,
      sentimentNegative,
      questionAskedCount: (teamMetrics.questionAskedCount || 0) + (liveMetrics.questionAskedCount || 0),
      exclamationCount: (teamMetrics.exclamationCount || 0) + (liveMetrics.exclamationCount || 0),
      emojiUsageCount: (teamMetrics.emojiUsageCount || 0) + (liveMetrics.emojiUsageCount || 0),
      conversationsInitiated: (teamMetrics.conversationsInitiated || 0) + (liveMetrics.conversationsInitiated || 0),
      conversationsParticipated: (teamMetrics.conversationsParticipated || 0) + (liveMetrics.conversationsParticipated || 0),
      linguisticMarkers: {
        formalityAvg,
        vocabularyDiversity,
        technicalTermFrequency,
      },
    };
  }

  /**
   * Calculate average response time between consecutive messages
   * 
   * Privacy-safe: Uses timestamps only, no message content
   * 
   * @param messages - Array of messages with createdAt timestamps (chronological order)
   * @returns Object with average time in seconds and count of valid intervals
   */
  private calculateAvgResponseTime(
    messages: Array<{ createdAt: Date | null; content?: string }>
  ): { avgSeconds: number; intervalCount: number } {
    if (messages.length < 2) {
      return { avgSeconds: 240, intervalCount: 0 }; // Fallback: 4 minutes, no intervals
    }

    const responseTimes: number[] = [];

    // Calculate time gaps between consecutive messages
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i].createdAt;
      const previous = messages[i - 1].createdAt;

      if (current && previous) {
        const gapSeconds = (current.getTime() - previous.getTime()) / 1000;
        
        // Only count reasonable gaps (1 second to 24 hours)
        // Exclude very short gaps (rapid messages) and very long gaps (inactive periods)
        if (gapSeconds >= 1 && gapSeconds <= 86400) {
          responseTimes.push(gapSeconds);
        }
      }
    }

    if (responseTimes.length === 0) {
      return { avgSeconds: 240, intervalCount: 0 }; // Fallback, no valid intervals
    }

    // Calculate average
    const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
    const avgSeconds = Math.round(totalTime / responseTimes.length);
    
    return { avgSeconds, intervalCount: responseTimes.length };
  }

  /**
   * Analyze sentiment using heuristics (privacy-safe)
   * 
   * Returns percentage distribution (positive/neutral/negative)
   * without storing raw content
   */
  private analyzeSentimentHeuristics(messages: string[]): {
    positive: number;
    neutral: number;
    negative: number;
  } {
    if (messages.length === 0) {
      return { positive: 0, neutral: 100, negative: 0 };
    }

    let positiveCount = 0;
    let negativeCount = 0;

    // Simple heuristic-based sentiment
    const positivePatterns = /\b(great|good|excellent|thanks|perfect|awesome|love|appreciate)\b|😊|👍|✅|🎉/gi;
    const negativePatterns = /\b(issue|problem|error|fail|wrong|bad|broken|urgent)\b|😔|❌|⚠️/gi;

    for (const message of messages) {
      const hasPositive = positivePatterns.test(message);
      const hasNegative = negativePatterns.test(message);

      if (hasPositive && !hasNegative) {
        positiveCount++;
      } else if (hasNegative && !hasPositive) {
        negativeCount++;
      }
    }

    const total = messages.length;
    const positive = Math.round((positiveCount / total) * 100);
    const negative = Math.round((negativeCount / total) * 100);
    const neutral = 100 - positive - negative;

    return { positive, neutral, negative };
  }

  /**
   * Count emoji usage (privacy-safe heuristic)
   */
  private countEmojis(messages: string[]): number {
    let count = 0;
    
    // Simple emoji detection (common emoji ranges)
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\\u{1F300}-\\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\\u{2700}-\\u{27BF}]/gu;

    for (const message of messages) {
      const matches = message.match(emojiPattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Analyze linguistic markers (privacy-safe)
   * 
   * Returns aggregated scores without storing raw content
   */
  private analyzeLinguisticMarkers(messages: string[]): {
    formalityAvg: number;
    vocabularyDiversity: number;
    technicalTermFrequency: number;
  } {
    if (messages.length === 0) {
      return {
        formalityAvg: 50,
        vocabularyDiversity: 0,
        technicalTermFrequency: 0,
      };
    }

    let formalitySum = 0;
    const uniqueWords = new Set<string>();
    let technicalTermCount = 0;

    // Technical terms (accounting/finance domain)
    const technicalTerms = /\b(ledger|invoice|revenue|expense|debit|credit|accrual|depreciation|amortization|reconciliation|compliance|audit|tax|gaap|ifrs|ebitda|roi|kpi|balance sheet|income statement|cash flow)\b/gi;

    // Informal markers (reduce formality)
    const informalPatterns = /\b(gonna|wanna|yeah|nope|lol|omg|btw|fyi)\b|!{2,}|\.{3,}/gi;

    for (const message of messages) {
      // Formality score (0-100, where 100 is very formal)
      const hasInformal = informalPatterns.test(message);
      const avgWordLength = message.split(/\s+/).reduce((sum, w) => sum + w.length, 0) / message.split(/\s+/).length;
      
      // Formality heuristic: longer words = more formal, informal markers reduce score
      let formality = Math.min(100, avgWordLength * 10);
      if (hasInformal) {
        formality = Math.max(0, formality - 30);
      }
      
      formalitySum += formality;

      // Vocabulary diversity (unique words)
      const words = message.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach(w => uniqueWords.add(w));

      // Technical term count
      const techMatches = message.match(technicalTerms);
      if (techMatches) {
        technicalTermCount += techMatches.length;
      }
    }

    const formalityAvg = Math.round(formalitySum / messages.length);
    const vocabularyDiversity = uniqueWords.size;
    const technicalTermFrequency = Math.round((technicalTermCount / messages.length) * 100);

    return {
      formalityAvg,
      vocabularyDiversity,
      technicalTermFrequency,
    };
  }

  /**
   * Get empty metrics for users with no messages
   */
  private getEmptyMetrics(): Partial<ConversationMetrics> & { responseTimeIntervalCount: number } {
    return {
      messageCount: 0,
      avgMessageLength: 0,
      avgResponseTimeSeconds: 240,
      responseTimeIntervalCount: 0,
      sentimentPositive: 0,
      sentimentNeutral: 100,
      sentimentNegative: 0,
      questionAskedCount: 0,
      exclamationCount: 0,
      emojiUsageCount: 0,
      conversationsInitiated: 0,
      conversationsParticipated: 0,
      linguisticMarkers: {
        formalityAvg: 50,
        vocabularyDiversity: 0,
        technicalTermFrequency: 0,
      },
    };
  }
}