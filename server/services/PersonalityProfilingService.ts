import { db } from "../db";
import { 
  personalityProfiles, 
  personalityTraits,
  mlAnalysisRuns,
  mlModelOutputs,
  type PersonalityProfile,
  type PersonalityTrait,
  type MlAnalysisRun,
  type MlModelOutput,
  type InsertPersonalityProfile,
  type InsertPersonalityTrait
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

/**
 * ===================================================================
 * PHASE 1: PERSONALITY PROFILING SERVICE FOUNDATION
 * ===================================================================
 * 
 * Status: PARTIAL IMPLEMENTATION
 * 
 * ✅ Implemented (Phase 1):
 * - Consent management (updateConsent, getConsent)
 * - Fusion results retrieval (getFusionResults, getAnalysisRun)
 * - Profile/trait repository methods (CRUD)
 * 
 * 🚧 Stubbed (Future Phases):
 * - analyzeUser: Requires ConversationAnalysisEngine
 * - runBatchAnalysis: Requires MLModelFusionEngine
 * 
 * Dependencies for Future Implementation:
 * 1. ConversationAnalysisEngine - Passive message analysis
 * 2. MLModelFusionEngine - Keyword/sentiment/behavioral analysis
 * 3. LLM validation adapter - Cultural context verification
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
 * Interface for future ConversationAnalysisEngine dependency
 * TODO: Implement in Task 6
 */
export interface IConversationAnalysisEngine {
  aggregateMetrics(userId: string, periodStart: Date, periodEnd: Date): Promise<ConversationMetrics>;
}

/**
 * Interface for future MLModelFusionEngine dependency
 * TODO: Implement in Task 5
 */
export interface IMLModelFusionEngine {
  runKeywordAnalysis(metrics: ConversationMetrics): Promise<ModelOutput>;
  runSentimentAnalysis(metrics: ConversationMetrics): Promise<ModelOutput>;
  runBehavioralPatterns(userId: string, metrics: ConversationMetrics): Promise<ModelOutput>;
  runLLMValidation(context: ValidationContext): Promise<ModelOutput | null>;
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
 * PersonalityProfilingService - Phase 1 Implementation
 * 
 * Orchestrates multi-framework personality analysis using ML model fusion.
 * Privacy-first: Only processes aggregated metrics, never raw messages.
 */
export class PersonalityProfilingService {
  
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

  // ==================== STUBBED METHODS (FUTURE IMPLEMENTATION) ====================

  /**
   * Analyze a single user's personality
   * 
   * ⚠️ NOT YET IMPLEMENTED ⚠️
   * 
   * Dependencies required:
   * 1. ConversationAnalysisEngine - To get aggregated metrics
   * 2. MLModelFusionEngine - To run keyword/sentiment/behavioral analysis
   * 3. LLM validation adapter - For cultural context
   * 
   * Future implementation will:
   * 1. Check consent
   * 2. Get aggregated conversation metrics (privacy-safe)
   * 3. Run Tier 1 models (keyword, sentiment, behavioral)
   * 4. Conditionally run LLM validation if confidence < 70%
   * 5. Fuse results using weighted consensus
   * 6. Update personality_profiles and personality_traits tables
   * 7. Create ml_analysis_runs record for audit
   * 
   * @throws Error - Method not yet implemented
   */
  async analyzeUser(
    userId: string,
    organizationId: string
  ): Promise<PersonalityProfile> {
    throw new Error(
      "analyzeUser not yet implemented. " +
      "Requires ConversationAnalysisEngine and MLModelFusionEngine. " +
      "See PersonalityProfilingService.ts for planned implementation."
    );
  }

  /**
   * Run batch analysis for multiple users
   * 
   * ⚠️ NOT YET IMPLEMENTED ⚠️
   * 
   * Dependencies required:
   * 1. ConversationAnalysisEngine
   * 2. MLModelFusionEngine
   * 3. Background job queue for async processing
   * 
   * Future implementation will:
   * 1. Create ml_analysis_runs record with status="pending"
   * 2. Queue background job for each user
   * 3. Update run status to "completed" when all users processed
   * 4. Return run ID for tracking
   * 
   * @throws Error - Method not yet implemented
   */
  async runBatchAnalysis(
    organizationId: string,
    userIds: string[]
  ): Promise<MlAnalysisRun> {
    throw new Error(
      "runBatchAnalysis not yet implemented. " +
      "Requires ConversationAnalysisEngine, MLModelFusionEngine, and background job queue. " +
      "See PersonalityProfilingService.ts for planned implementation."
    );
  }
}
