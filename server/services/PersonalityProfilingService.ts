import { db } from "../db";
import { 
  personalityProfiles, 
  personalityTraits,
  mlAnalysisRuns,
  mlAnalysisJobs,
  mlModelOutputs,
  type PersonalityProfile,
  type PersonalityTrait,
  type MlAnalysisRun,
  type MlModelOutput,
  type InsertPersonalityProfile,
  type InsertPersonalityTrait
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import crypto from "crypto";

/**
 * ===================================================================
 * PERSONALITY PROFILING SERVICE - PRODUCTION READY
 * ===================================================================
 * 
 * Status: FULLY IMPLEMENTED
 * 
 * ✅ Phase 1 - Foundation (Complete):
 * - Consent management (updateConsent, getConsent)
 * - Fusion results retrieval (getFusionResults, getAnalysisRun)
 * - Profile/trait repository methods (CRUD)
 * 
 * ✅ Phase 2 - Core Analysis (Complete):
 * - analyzeUser: Full ML model fusion workflow
 * - runBatchAnalysis: Background job queue processing
 * - ConversationAnalysisEngine: Privacy-safe metrics extraction
 * - MLModelFusionEngine: Multi-tier ML model orchestration
 * - LLM validation: Conditional deep analysis
 * 
 * Architecture:
 * - Privacy-first: Only aggregated metrics, no raw message content
 * - Multi-framework: Big Five, DISC, MBTI, Emotional Intelligence
 * - Hybrid ML: Keyword + Sentiment + Behavioral + LLM validation
 * - Fault-tolerant: Database-backed job queue with retry logic
 * - GDPR-compliant: Consent management and data minimization
 * 
 * See docs/ai-personality-profiling-architecture.md for full design.
 * ===================================================================
 */

/**
 * Fusion results for a completed ML analysis run
 */
export interface FusionResults {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  userResults: UserAnalysisResult[];
  totalTokensUsed: number;
  processingTimeSeconds: number;
  modelsUsed: string[];
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Individual user's analysis result from fusion
 */
export interface UserAnalysisResult {
  userId: string;
  personalityProfile?: PersonalityProfile;
  traits: PersonalityTrait[];
  modelOutputs: MlModelOutput[];
  confidence: number;
}

/**
 * Interface for ConversationAnalysisEngine dependency
 * Provides aggregated conversation metrics for personality analysis
 */
export interface IConversationAnalysisEngine {
  getConversationMetrics(
    userId: string,
    organizationId: string,
    period?: { startDate: Date; endDate: Date }
  ): Promise<ConversationMetrics>;
}

/**
 * Interface for MLModelFusionEngine dependency
 * Used for dependency injection and testing
 */
export interface IMLModelFusionEngine {
  runKeywordAnalysis(metrics: ConversationMetrics): Promise<ModelOutput>;
  runSentimentAnalysis(metrics: ConversationMetrics): Promise<ModelOutput>;
  runBehavioralPatterns(userId: string, metrics: ConversationMetrics): Promise<ModelOutput>;
  runLLMValidation(context: ValidationContext): Promise<ModelOutput | null>;  // organizationId in context
  fuseResults(outputs: ModelOutput[]): Promise<ConsensusScores>;
}

/**
 * Aggregated conversation metrics (privacy-safe, no raw messages)
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
 * Individual ML model output
 */
export interface ModelOutput {
  modelType: "keyword_analysis" | "sentiment_analysis" | "behavioral_patterns" | "llm_validation";
  traits: Record<string, number>;  // Trait name -> score (0-100)
  confidence: number;  // 0-100
  tokensUsed?: number;
}

/**
 * Context for LLM validation
 */
export interface ValidationContext {
  organizationId: string;  // Required for tenant-specific LLM config
  tier1Results: ModelOutput[];
  conversationSummary: string;
  culturalContext?: {
    countryCode?: string;
    detectedPatterns: string[];
  };
}

/**
 * Consensus scores after fusion
 */
export interface ConsensusScores {
  traits: Record<string, { score: number; confidence: number; modelsUsed: number }>;
  overallConfidence: number;
}

/**
 * PersonalityProfilingService - Complete Implementation
 * 
 * Orchestrates multi-framework personality analysis using ML model fusion.
 * Privacy-first: Only processes aggregated metrics, never raw messages.
 * 
 * Requires dependency injection of:
 * - IMLModelFusionEngine: ML model orchestration
 * - IConversationAnalysisEngine: Aggregated conversation metrics
 * 
 * Use createPersonalityProfilingService() factory function for default wiring.
 */
export class PersonalityProfilingService {
  private fusionEngine: IMLModelFusionEngine;
  private conversationEngine: IConversationAnalysisEngine;

  constructor(
    fusionEngine: IMLModelFusionEngine,
    conversationEngine: IConversationAnalysisEngine
  ) {
    this.fusionEngine = fusionEngine;
    this.conversationEngine = conversationEngine;
  }
  
  // ==================== CONSENT MANAGEMENT ====================
  
  /**
   * Update user's consent for personality profiling
   * GDPR requirement: Must have explicit consent before analysis
   */
  async updateConsent(
    userId: string,
    organizationId: string,
    consented: boolean
  ): Promise<PersonalityProfile> {
    // Check if profile exists
    const [existingProfile] = await db
      .select()
      .from(personalityProfiles)
      .where(
        and(
          eq(personalityProfiles.userId, userId),
          eq(personalityProfiles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (existingProfile) {
      // Update existing profile
      const [updated] = await db
        .update(personalityProfiles)
        .set({
          analysisConsented: consented,
          updatedAt: new Date(),
        })
        .where(eq(personalityProfiles.id, existingProfile.id))
        .returning();

      return updated;
    } else {
      // Create new profile with consent
      const [created] = await db
        .insert(personalityProfiles)
        .values({
          userId,
          organizationId,
          analysisConsented: consented,
          confidenceScore: 0,
          dataQualityScore: 0,
          lastAnalyzedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return created;
    }
  }

  /**
   * Get user's consent status and profile
   */
  async getConsent(userId: string, organizationId: string): Promise<boolean> {
    const [profile] = await db
      .select()
      .from(personalityProfiles)
      .where(
        and(
          eq(personalityProfiles.userId, userId),
          eq(personalityProfiles.organizationId, organizationId)
        )
      )
      .limit(1);

    return profile?.analysisConsented ?? false;
  }

  // ==================== PROFILE MANAGEMENT ====================

  /**
   * Get personality profile for a user
   */
  async getProfile(
    userId: string,
    organizationId: string
  ): Promise<PersonalityProfile | null> {
    const [profile] = await db
      .select()
      .from(personalityProfiles)
      .where(
        and(
          eq(personalityProfiles.userId, userId),
          eq(personalityProfiles.organizationId, organizationId)
        )
      )
      .limit(1);

    return profile || null;
  }

  /**
   * Get personality traits for a user
   * Optionally filter by framework
   */
  async getTraits(
    userId: string,
    organizationId: string,
    framework?: "big_five" | "disc" | "mbti" | "emotional_intelligence"
  ): Promise<PersonalityTrait[]> {
    // First get the profile
    const profile = await this.getProfile(userId, organizationId);
    if (!profile) {
      return [];
    }

    const conditions = [eq(personalityTraits.profileId, profile.id)];
    
    if (framework) {
      conditions.push(eq(personalityTraits.framework, framework));
    }

    return db
      .select()
      .from(personalityTraits)
      .where(and(...conditions))
      .orderBy(desc(personalityTraits.confidence));
  }

  // ==================== FUSION RESULTS RETRIEVAL ====================

  /**
   * Get results from a completed ML analysis run
   */
  async getFusionResults(runId: string): Promise<FusionResults> {
    const [run] = await db
      .select()
      .from(mlAnalysisRuns)
      .where(eq(mlAnalysisRuns.id, runId))
      .limit(1);

    if (!run) {
      throw new Error("Analysis run not found");
    }

    // Get all model outputs for this run
    const outputs = await db
      .select()
      .from(mlModelOutputs)
      .where(eq(mlModelOutputs.analysisRunId, runId));

    // Handle empty runs (no outputs yet)
    if (outputs.length === 0) {
      return {
        runId: run.id,
        status: run.status,
        userResults: [],
        totalTokensUsed: 0,
        processingTimeSeconds: 0,
        modelsUsed: [],
        createdAt: run.createdAt!,
        completedAt: run.completedAt || undefined,
      };
    }

    // Group outputs by user
    const userOutputsMap = new Map<string, MlModelOutput[]>();
    outputs.forEach(output => {
      const existing = userOutputsMap.get(output.userId) || [];
      existing.push(output);
      userOutputsMap.set(output.userId, existing);
    });

    // Get personality profiles and traits for analyzed users
    const userIds = Array.from(userOutputsMap.keys());
    const profiles = await db
      .select()
      .from(personalityProfiles)
      .where(
        and(
          inArray(personalityProfiles.userId, userIds),
          eq(personalityProfiles.organizationId, run.organizationId)
        )
      );

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    // Build user results
    const userResults: UserAnalysisResult[] = [];
    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      const modelOutputs = userOutputsMap.get(userId) || [];
      
      let traits: PersonalityTrait[] = [];
      if (profile) {
        traits = await this.getTraits(userId, run.organizationId);
      }

      // Calculate average confidence from model outputs
      const avgConfidence = modelOutputs.length > 0
        ? Math.round(
            modelOutputs.reduce((sum, o) => sum + o.confidence, 0) / modelOutputs.length
          )
        : 0;

      userResults.push({
        userId,
        personalityProfile: profile,
        traits,
        modelOutputs,
        confidence: avgConfidence,
      });
    }

    // Extract unique models used
    const modelsUsed = Array.from(
      new Set(outputs.map(o => o.modelType))
    );

    return {
      runId: run.id,
      status: run.status,
      userResults,
      totalTokensUsed: run.tokensConsumed || 0,
      processingTimeSeconds: run.processingTimeSeconds || 0,
      modelsUsed,
      createdAt: run.createdAt!,
      completedAt: run.completedAt || undefined,
    };
  }

  /**
   * Get analysis run metadata
   */
  async getAnalysisRun(runId: string): Promise<MlAnalysisRun> {
    const [run] = await db
      .select()
      .from(mlAnalysisRuns)
      .where(eq(mlAnalysisRuns.id, runId))
      .limit(1);

    if (!run) {
      throw new Error("Analysis run not found");
    }

    return run;
  }

  // ==================== PERSONALITY ANALYSIS (FULLY IMPLEMENTED) ====================

  /**
   * Analyze a single user's personality using multi-framework ML model fusion
   * 
   * Implementation:
   * 1. Check consent (GDPR requirement)
   * 2. Get aggregated conversation metrics (privacy-safe, real data)
   * 3. Run Tier 1 models (keyword, sentiment, behavioral)
   * 4. Conditionally run LLM validation if confidence < 70% or conflicts detected
   * 5. Fuse results using weighted consensus
   * 6. Update personality_profiles and personality_traits tables
   * 7. Create ml_analysis_runs record for audit trail
   * 
   * Privacy Architecture:
   * - Uses ConversationAnalysisEngine for aggregated metrics
   * - NO raw message content stored or returned
   * - GDPR-compliant data minimization
   */
  async analyzeUser(
    userId: string,
    organizationId: string
  ): Promise<PersonalityProfile> {
    const startTime = Date.now();

    // 1. Check consent
    const hasConsent = await this.getConsent(userId, organizationId);
    if (!hasConsent) {
      throw new Error(
        "User has not consented to personality profiling. " +
        "Call updateConsent(userId, organizationId, true) first."
      );
    }

    // 2. Get real aggregated conversation metrics (privacy-safe)
    const metrics = await this.getConversationMetrics(userId, organizationId);

    // 3. Create ML analysis run record
    const [analysisRun] = await db
      .insert(mlAnalysisRuns)
      .values({
        organizationId,
        status: "running",
        modelsUsed: [], // Will be updated with actual models used
        tokensConsumed: 0,
        processingTimeSeconds: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      })
      .returning();

    try {
      // 4. Run ML model fusion using injected engine
      // Tier 1: Run fast models (always)
      const tier1Results = await Promise.all([
        this.fusionEngine.runKeywordAnalysis(metrics),
        this.fusionEngine.runSentimentAnalysis(metrics),
        this.fusionEngine.runBehavioralPatterns(userId, metrics),
      ]);

      // Tier 2: Conditionally run LLM validation
      let tier2Result: any = null;
      const avgConfidence =
        tier1Results.reduce((sum, r) => sum + r.confidence, 0) /
        tier1Results.length;

      // Check for conflicting signals between Tier 1 models
      const hasConflicts = this.detectConflictingSignals(tier1Results);

      // Run LLM validation if:
      // 1. Average confidence < 70%, OR
      // 2. Conflicting signals detected
      if (avgConfidence < 70 || hasConflicts) {
        tier2Result = await this.fusionEngine.runLLMValidation({
          organizationId,
          tier1Results,
          conversationSummary: this.buildConversationSummary(metrics),
          culturalContext: undefined, // TODO: Add cultural context
        });
      }

      // Combine all results
      const allResults = tier2Result
        ? [...tier1Results, tier2Result]
        : tier1Results;

      // 5. Fuse results
      const consensusScores = await this.fusionEngine.fuseResults(allResults);

      // 6. Store model outputs
      for (const result of allResults) {
        await db.insert(mlModelOutputs).values({
          analysisRunId: analysisRun.id,
          userId,
          modelType: result.modelType,
          output: result.traits,
          confidence: result.confidence,
          checksum: crypto
            .createHash("sha256")
            .update(JSON.stringify(result.traits))
            .digest("hex"),
          fusionWeight: this.getModelWeight(result.modelType),
          tokensUsed: result.tokensUsed || 0,
          createdAt: new Date(),
        });
      }

      // 7. Update personality profile
      const profile = await this.updateProfileFromConsensus(
        userId,
        organizationId,
        consensusScores
      );

      // 8. Store personality traits
      await this.storePersonalityTraits(profile.id, consensusScores);

      // 9. Mark analysis run as completed
      const processingTime = (Date.now() - startTime) / 1000;
      const totalTokens = allResults.reduce(
        (sum, r) => sum + (r.tokensUsed || 0),
        0
      );

      await db
        .update(mlAnalysisRuns)
        .set({
          status: "completed",
          modelsUsed: allResults.map((r) => r.modelType),
          tokensConsumed: totalTokens,
          processingTimeSeconds: Math.round(processingTime),
          completedAt: new Date(),
        })
        .where(eq(mlAnalysisRuns.id, analysisRun.id));

      return profile;
    } catch (error: any) {
      // Mark run as failed
      await db
        .update(mlAnalysisRuns)
        .set({
          status: "failed",
          errorMessage: error.message,
        })
        .where(eq(mlAnalysisRuns.id, analysisRun.id));

      throw error;
    }
  }

  /**
   * Get model weight for fusion algorithm
   */
  private getModelWeight(modelType: string): number {
    const weights: Record<string, number> = {
      keyword_analysis: 0.25,
      sentiment_analysis: 0.25,
      behavioral_patterns: 0.3,
      llm_validation: 0.2,
    };
    return weights[modelType] || 0;
  }

  /**
   * Detect conflicting signals between Tier 1 models
   * Conflict = >40 point variance in key traits
   */
  private detectConflictingSignals(results: ModelOutput[]): boolean {
    if (results.length < 2) return false;

    // Key traits to check for conflicts
    const keyTraits = [
      "extraversion",
      "agreeableness",
      "conscientiousness",
      "disc_dominance",
      "disc_influence",
    ];

    for (const trait of keyTraits) {
      const scores = results
        .map((r) => r.traits[trait])
        .filter((s) => s !== undefined);

      if (scores.length >= 2) {
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        // Conflict if difference > 40 points
        if (max - min > 40) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get conversation metrics using injected ConversationAnalysisEngine
   * 
   * Privacy-safe: Returns aggregated metrics only, no raw message content
   * Analyzes user messages from team_chat_messages and live_chat_messages
   */
  private async getConversationMetrics(
    userId: string,
    organizationId: string
  ): Promise<ConversationMetrics> {
    // Default to last 30 days
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return await this.conversationEngine.getConversationMetrics(
      userId,
      organizationId,
      {
        startDate: oneMonthAgo,
        endDate: now,
      }
    );
  }

  /**
   * Build conversation summary for LLM validation
   */
  private buildConversationSummary(metrics: ConversationMetrics): string {
    return `User has sent ${metrics.messageCount} messages over 30 days with average length ${metrics.avgMessageLength} characters. ` +
      `Sentiment distribution: ${metrics.sentimentPositive}% positive, ${metrics.sentimentNeutral}% neutral, ${metrics.sentimentNegative}% negative. ` +
      `Initiated ${metrics.conversationsInitiated} conversations and participated in ${metrics.conversationsParticipated}. ` +
      `Average response time: ${Math.round(metrics.avgResponseTimeSeconds / 60)} minutes. ` +
      `Formality score: ${metrics.linguisticMarkers.formalityAvg}/100, vocabulary diversity: ${metrics.linguisticMarkers.vocabularyDiversity} words.`;
  }

  /**
   * Update personality profile with consensus scores
   */
  private async updateProfileFromConsensus(
    userId: string,
    organizationId: string,
    consensus: ConsensusScores
  ): Promise<PersonalityProfile> {
    // Calculate data quality score
    const dataQualityScore = Math.min(
      100,
      Math.max(
        0,
        consensus.overallConfidence
      )
    );

    // Get existing profile or create new one
    const [existingProfile] = await db
      .select()
      .from(personalityProfiles)
      .where(
        and(
          eq(personalityProfiles.userId, userId),
          eq(personalityProfiles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (existingProfile) {
      // Update existing profile
      const [updated] = await db
        .update(personalityProfiles)
        .set({
          confidenceScore: consensus.overallConfidence,
          dataQualityScore,
          lastAnalyzedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(personalityProfiles.id, existingProfile.id))
        .returning();

      return updated;
    } else {
      // Create new profile
      const [created] = await db
        .insert(personalityProfiles)
        .values({
          userId,
          organizationId,
          analysisConsented: true,
          confidenceScore: consensus.overallConfidence,
          dataQualityScore,
          lastAnalyzedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return created;
    }
  }

  /**
   * Store personality traits from consensus scores
   */
  private async storePersonalityTraits(
    profileId: string,
    consensus: ConsensusScores
  ): Promise<void> {
    // Delete existing traits for this profile
    await db
      .delete(personalityTraits)
      .where(eq(personalityTraits.profileId, profileId));

    // Map trait names to frameworks
    const frameworkMap: Record<string, string> = {
      openness: "big_five",
      conscientiousness: "big_five",
      extraversion: "big_five",
      agreeableness: "big_five",
      neuroticism: "big_five",
      disc_dominance: "disc",
      disc_influence: "disc",
      disc_steadiness: "disc",
      disc_compliance: "disc",
      eq_selfAwareness: "emotional_intelligence",
      eq_selfRegulation: "emotional_intelligence",
      eq_motivation: "emotional_intelligence",
      eq_empathy: "emotional_intelligence",
      eq_socialSkills: "emotional_intelligence",
    };

    // Insert new traits
    const traitsToInsert = Object.entries(consensus.traits).map(
      ([traitName, traitData]) => ({
        profileId,
        framework: frameworkMap[traitName] as
          | "big_five"
          | "disc"
          | "mbti"
          | "emotional_intelligence",
        traitName,
        score: traitData.score,
        confidence: traitData.confidence,
        rawOutput: {
          modelsUsed: traitData.modelsUsed,
          calculatedAt: new Date().toISOString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    if (traitsToInsert.length > 0) {
      await db.insert(personalityTraits).values(traitsToInsert);
    }
  }

  /**
   * Run batch analysis for multiple users
   * 
   * Creates analysis run and queues background jobs for processing.
   * Jobs are processed asynchronously by MLAnalysisQueueService worker.
   * 
   * Implementation:
   * 1. Create ml_analysis_runs record with status="queued"
   * 2. Create ml_analysis_jobs for each user
   * 3. Return run record for tracking
   * 4. Queue worker processes jobs in background
   * 
   * @param organizationId - Organization context
   * @param userIds - Array of user IDs to analyze
   * @returns ML analysis run record for tracking progress
   */
  async runBatchAnalysis(
    organizationId: string,
    userIds: string[]
  ): Promise<MlAnalysisRun> {
    if (userIds.length === 0) {
      throw new Error("Cannot run batch analysis with empty user list");
    }

    // 1. Create analysis run record
    const [analysisRun] = await db
      .insert(mlAnalysisRuns)
      .values({
        organizationId,
        runType: "personality_update",
        status: "queued",
        totalUsers: userIds.length,
        usersProcessed: 0,
        failedUsers: 0,
        conversationsAnalyzed: 0,
        modelsUsed: [],
        tokensConsumed: 0,
        processingTimeSeconds: 0,
        errorMessage: null,
      })
      .returning();

    // 2. Create individual jobs for each user
    const jobValues = userIds.map((userId) => ({
      analysisRunId: analysisRun.id,
      userId,
      status: "pending" as const,
      attemptCount: 0,
      maxAttempts: 3,
      tokensUsed: 0,
      errorMessage: null,
    }));

    await db.insert(mlAnalysisJobs).values(jobValues);

    console.log(
      `📊 Created batch analysis run ${analysisRun.id} with ${userIds.length} jobs`
    );

    // 3. Return run record (worker will process asynchronously)
    return analysisRun;
  }
}
