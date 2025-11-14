import { getLLMConfigService } from "../llm-config-service";
import type {
  ConversationMetrics,
  ModelOutput,
  ValidationContext,
  ConsensusScores,
} from "./PersonalityProfilingService";

/**
 * ===================================================================
 * ML MODEL FUSION ENGINE
 * ===================================================================
 * 
 * Implements hybrid ML approach combining:
 * - Tier 1: Fast models (keyword, sentiment, behavioral) - Always run
 * - Tier 2: LLM validation - Conditional execution
 * 
 * Fusion Strategy:
 * - Keyword Analysis: 25% weight - Pattern matching
 * - Sentiment Analysis: 25% weight - Emotional tone
 * - Behavioral Patterns: 30% weight - Objective metrics
 * - LLM Validation: 20% weight - Deep context (when needed)
 * 
 * Privacy-First: Only processes aggregated metrics, never raw messages
 * ===================================================================
 */

/**
 * Big Five personality traits keywords and patterns
 */
const BIG_FIVE_KEYWORDS = {
  openness: {
    high: ["creative", "curious", "innovative", "abstract", "imaginative", "artistic", "unconventional"],
    low: ["practical", "conventional", "routine", "traditional", "concrete"],
  },
  conscientiousness: {
    high: ["organized", "planned", "scheduled", "deadline", "checklist", "systematic", "detail", "thorough"],
    low: ["spontaneous", "flexible", "last-minute", "casual"],
  },
  extraversion: {
    high: ["excited", "energetic", "outgoing", "social", "party", "group", "team", "collaborative"],
    low: ["quiet", "reserved", "introspective", "alone", "independent", "solo"],
  },
  agreeableness: {
    high: ["please", "help", "support", "kind", "empathy", "understanding", "agree", "compassionate"],
    low: ["challenge", "disagree", "critical", "direct", "blunt"],
  },
  neuroticism: {
    high: ["worry", "stress", "anxious", "nervous", "concerned", "uncertain", "overwhelmed"],
    low: ["calm", "relaxed", "stable", "confident", "composed"],
  },
};

/**
 * DISC personality patterns
 */
const DISC_PATTERNS = {
  dominance: {
    high: ["results", "achieve", "win", "goal", "target", "compete", "decide", "control"],
    low: ["consider", "careful", "thoughtful", "cautious"],
  },
  influence: {
    high: ["enthusiasm", "inspire", "motivate", "persuade", "convince", "exciting", "fun"],
    low: ["reserved", "factual", "data", "evidence"],
  },
  steadiness: {
    high: ["stable", "consistent", "reliable", "patient", "supportive", "team", "harmony"],
    low: ["change", "adapt", "pivot", "fast", "quick"],
  },
  compliance: {
    high: ["accuracy", "precise", "detail", "quality", "standard", "process", "systematic"],
    low: ["approximate", "roughly", "generally", "estimate"],
  },
};

/**
 * Emotional Intelligence markers
 */
const EMOTIONAL_INTELLIGENCE_MARKERS = {
  selfAwareness: {
    high: ["I feel", "I realize", "I understand myself", "my strength", "my weakness", "aware"],
    low: [],
  },
  selfRegulation: {
    high: ["calm down", "manage", "control", "breathe", "composed", "collected"],
    low: ["reactive", "impulsive"],
  },
  motivation: {
    high: ["goal", "achieve", "improve", "grow", "learn", "progress", "strive"],
    low: ["don't care", "whatever", "doesn't matter"],
  },
  empathy: {
    high: ["I understand", "you must feel", "that sounds difficult", "I see", "perspective"],
    low: ["don't get", "don't see why"],
  },
  socialSkills: {
    high: ["collaborate", "together", "team", "partner", "coordinate", "facilitate"],
    low: ["alone", "myself", "solo"],
  },
};

export class MLModelFusionEngine {
  /**
   * Run keyword analysis on conversation metrics
   * Tier 1: Fast, no token cost, pattern matching
   */
  async runKeywordAnalysis(metrics: ConversationMetrics): Promise<ModelOutput> {
    const traits: Record<string, number> = {};

    // Analyze linguistic markers for patterns
    const { linguisticMarkers } = metrics;

    // Big Five Openness - Based on vocabulary diversity and formality
    const opennessScore = Math.min(
      100,
      Math.max(0, (linguisticMarkers.vocabularyDiversity / 600) * 100)
    );
    traits.openness = Math.round(opennessScore);

    // Big Five Conscientiousness - Based on formality and structure
    traits.conscientiousness = Math.round(linguisticMarkers.formalityAvg);

    // Big Five Extraversion - Based on conversation initiation and participation
    const totalConversations =
      metrics.conversationsInitiated + metrics.conversationsParticipated;
    const initiationRatio =
      totalConversations > 0
        ? (metrics.conversationsInitiated / totalConversations) * 100
        : 50;
    traits.extraversion = Math.round(
      Math.min(100, Math.max(0, initiationRatio + 30))
    );

    // Big Five Agreeableness - Based on positive sentiment and emoji usage
    const agreeablenessScore =
      metrics.sentimentPositive * 0.7 + (metrics.emojiUsageCount / metrics.messageCount) * 30;
    traits.agreeableness = Math.round(Math.min(100, Math.max(0, agreeablenessScore)));

    // Big Five Neuroticism - Based on negative sentiment and exclamations
    const neuroticismScore =
      metrics.sentimentNegative * 0.8 + (metrics.exclamationCount / metrics.messageCount) * 50;
    traits.neuroticism = Math.round(Math.min(100, Math.max(0, neuroticismScore)));

    // DISC Dominance - Based on short messages and low questions
    const avgMessageLength = metrics.avgMessageLength;
    const questionRatio = metrics.questionAskedCount / metrics.messageCount;
    const dominanceScore = avgMessageLength < 50 ? 70 : 40;
    traits.disc_dominance = Math.round(
      Math.min(100, Math.max(0, dominanceScore - questionRatio * 100))
    );

    // DISC Influence - Based on conversation initiation and emoji use
    const influenceScore =
      initiationRatio * 0.6 + (metrics.emojiUsageCount / metrics.messageCount) * 40;
    traits.disc_influence = Math.round(Math.min(100, Math.max(0, influenceScore)));

    // DISC Steadiness - Based on response time and neutral sentiment
    const steadinessScore =
      metrics.sentimentNeutral * 0.5 +
      (metrics.avgResponseTimeSeconds < 300 ? 50 : 30);
    traits.disc_steadiness = Math.round(Math.min(100, Math.max(0, steadinessScore)));

    // DISC Compliance - Based on formality and technical language
    const complianceScore =
      linguisticMarkers.formalityAvg * 0.6 +
      linguisticMarkers.technicalTermFrequency * 2;
    traits.disc_compliance = Math.round(Math.min(100, Math.max(0, complianceScore)));

    // Emotional Intelligence - Based on multiple factors
    traits.eq_selfAwareness = Math.round((opennessScore + agreeablenessScore) / 2);
    traits.eq_selfRegulation = Math.round(100 - neuroticismScore);
    traits.eq_motivation = Math.round(
      (metrics.conversationsInitiated / Math.max(1, totalConversations)) * 100
    );
    traits.eq_empathy = Math.round(agreeablenessScore);
    traits.eq_socialSkills = Math.round(
      (metrics.conversationsParticipated / Math.max(1, totalConversations)) * 100
    );

    // Calculate confidence based on data quality
    const confidence = this.calculateKeywordConfidence(metrics);

    return {
      modelType: "keyword_analysis",
      traits,
      confidence,
      tokensUsed: 0,
    };
  }

  /**
   * Calculate confidence for keyword analysis based on data quality
   */
  private calculateKeywordConfidence(metrics: ConversationMetrics): number {
    let confidence = 50; // Base confidence

    // More messages = higher confidence
    if (metrics.messageCount > 100) confidence += 20;
    else if (metrics.messageCount > 50) confidence += 10;
    else if (metrics.messageCount > 20) confidence += 5;

    // Vocabulary diversity indicates quality data
    if (metrics.linguisticMarkers.vocabularyDiversity > 400) confidence += 15;
    else if (metrics.linguisticMarkers.vocabularyDiversity > 200) confidence += 10;

    // Balanced sentiment indicates real communication
    if (
      metrics.sentimentPositive > 40 &&
      metrics.sentimentPositive < 80 &&
      metrics.sentimentNeutral > 15
    ) {
      confidence += 10;
    }

    // Participation indicates engagement
    if (metrics.conversationsParticipated > 10) confidence += 5;

    return Math.min(100, Math.max(30, confidence));
  }

  /**
   * Run sentiment analysis on conversation metrics
   * Tier 1: Fast, no token cost, emotion detection
   */
  async runSentimentAnalysis(metrics: ConversationMetrics): Promise<ModelOutput> {
    const traits: Record<string, number> = {};

    // Sentiment-based trait scoring
    const positiveRatio = metrics.sentimentPositive;
    const negativeRatio = metrics.sentimentNegative;
    const neutralRatio = metrics.sentimentNeutral;

    // Big Five from sentiment
    traits.openness = Math.round(
      positiveRatio * 0.6 + (metrics.emojiUsageCount / metrics.messageCount) * 40
    );
    traits.conscientiousness = Math.round(neutralRatio * 0.8 + 20);
    traits.extraversion = Math.round(positiveRatio * 0.9);
    traits.agreeableness = Math.round(positiveRatio * 0.85 + 10);
    traits.neuroticism = Math.round(negativeRatio * 1.2);

    // DISC from sentiment patterns
    traits.disc_dominance = Math.round(
      100 - neutralRatio * 0.7 - (metrics.questionAskedCount / metrics.messageCount) * 100
    );
    traits.disc_influence = Math.round(positiveRatio * 0.85 + 10);
    traits.disc_steadiness = Math.round(neutralRatio * 0.9 + 10);
    traits.disc_compliance = Math.round(neutralRatio * 0.75 + positiveRatio * 0.25);

    // Emotional Intelligence from sentiment
    traits.eq_selfAwareness = Math.round(50 + positiveRatio * 0.3 + neutralRatio * 0.2);
    traits.eq_selfRegulation = Math.round(100 - negativeRatio * 1.5);
    traits.eq_motivation = Math.round(positiveRatio * 0.8 + 15);
    traits.eq_empathy = Math.round(positiveRatio * 0.7 + neutralRatio * 0.3);
    traits.eq_socialSkills = Math.round(positiveRatio * 0.6 + neutralRatio * 0.3 + 10);

    // Normalize all scores to 0-100
    Object.keys(traits).forEach((key) => {
      traits[key] = Math.min(100, Math.max(0, traits[key]));
    });

    // Confidence based on sentiment distribution
    const confidence = this.calculateSentimentConfidence(metrics);

    return {
      modelType: "sentiment_analysis",
      traits,
      confidence,
      tokensUsed: 0,
    };
  }

  /**
   * Calculate confidence for sentiment analysis
   */
  private calculateSentimentConfidence(metrics: ConversationMetrics): number {
    let confidence = 55; // Base confidence

    // More messages = higher confidence
    if (metrics.messageCount > 100) confidence += 15;
    else if (metrics.messageCount > 50) confidence += 10;

    // Balanced sentiment distribution indicates real data
    const sentimentVariance =
      Math.abs(metrics.sentimentPositive - 50) +
      Math.abs(metrics.sentimentNegative - 20) +
      Math.abs(metrics.sentimentNeutral - 30);

    if (sentimentVariance < 50) confidence += 20;
    else if (sentimentVariance < 100) confidence += 10;

    // Emoji usage indicates emotional expression
    if (metrics.emojiUsageCount > 0) confidence += 10;

    return Math.min(100, Math.max(35, confidence));
  }

  /**
   * Run behavioral pattern analysis
   * Tier 1: Fast, no token cost, objective metrics
   */
  async runBehavioralPatterns(
    userId: string,
    metrics: ConversationMetrics
  ): Promise<ModelOutput> {
    const traits: Record<string, number> = {};

    // Response time analysis
    const responseTime = metrics.avgResponseTimeSeconds;
    const quickResponder = responseTime < 180; // < 3 minutes
    const slowResponder = responseTime > 600; // > 10 minutes

    // Message length patterns
    const shortMessages = metrics.avgMessageLength < 50;
    const longMessages = metrics.avgMessageLength > 150;

    // Communication style patterns
    const highInitiator =
      metrics.conversationsInitiated >
      metrics.conversationsParticipated * 0.3;
    const highParticipant =
      metrics.conversationsParticipated >
      metrics.conversationsInitiated * 2;

    // Big Five from behavioral patterns
    traits.openness = Math.round(
      (metrics.linguisticMarkers.vocabularyDiversity / 500) * 100
    );
    traits.conscientiousness = quickResponder ? 75 : slowResponder ? 40 : 60;
    traits.extraversion = highInitiator ? 80 : highParticipant ? 65 : 50;
    traits.agreeableness = highParticipant ? 75 : 55;
    traits.neuroticism = quickResponder && shortMessages ? 60 : 40;

    // DISC from behavioral patterns
    traits.disc_dominance = shortMessages && quickResponder ? 75 : 45;
    traits.disc_influence = highInitiator ? 80 : 50;
    traits.disc_steadiness = !quickResponder && !slowResponder ? 70 : 50;
    traits.disc_compliance = longMessages && !quickResponder ? 75 : 50;

    // Emotional Intelligence from behavioral patterns
    traits.eq_selfAwareness = longMessages ? 65 : 50;
    traits.eq_selfRegulation = !quickResponder ? 70 : 55;
    traits.eq_motivation = highInitiator ? 75 : 55;
    traits.eq_empathy = highParticipant ? 70 : 50;
    traits.eq_socialSkills = highParticipant ? 75 : 50;

    // Confidence based on data volume
    const confidence = this.calculateBehavioralConfidence(metrics);

    return {
      modelType: "behavioral_patterns",
      traits,
      confidence,
      tokensUsed: 0,
    };
  }

  /**
   * Calculate confidence for behavioral pattern analysis
   */
  private calculateBehavioralConfidence(metrics: ConversationMetrics): number {
    let confidence = 60; // Base confidence (highest of Tier 1)

    // More messages = higher confidence
    if (metrics.messageCount > 100) confidence += 20;
    else if (metrics.messageCount > 50) confidence += 15;
    else if (metrics.messageCount > 20) confidence += 10;

    // More conversations = better patterns
    const totalConversations =
      metrics.conversationsInitiated + metrics.conversationsParticipated;
    if (totalConversations > 20) confidence += 10;
    else if (totalConversations > 10) confidence += 5;

    return Math.min(100, Math.max(40, confidence));
  }

  /**
   * Run LLM validation (Tier 2)
   * Only executed when:
   * 1. Confidence < 70% from Tier 1 models
   * 2. Conflicting signals detected
   * 3. Cultural context ambiguity
   */
  async runLLMValidation(
    context: ValidationContext,
    organizationId: string
  ): Promise<ModelOutput | null> {
    const llmConfigService = getLLMConfigService();

    // Check if LLM validation is needed
    const avgConfidence =
      context.tier1Results.reduce((sum, r) => sum + r.confidence, 0) /
      context.tier1Results.length;

    // Skip if confidence is high enough
    if (avgConfidence >= 70 && !this.hasConflictingSignals(context.tier1Results)) {
      return null;
    }

    try {
      // Build prompt for LLM validation
      const prompt = this.buildValidationPrompt(context);

      // Get LLM response
      const response = await llmConfigService.chatCompletion(
        organizationId,
        [
          {
            role: "system",
            content:
              "You are a personality assessment expert. Analyze the conversation metrics and provide personality trait scores (0-100) for Big Five, DISC, and Emotional Intelligence frameworks. Return JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        {
          response_format: { type: "json_object" },
          temperature: 0.3,
        }
      );

      // Parse LLM response
      const result = JSON.parse(response.content);
      const tokensUsed = response.usage?.total_tokens || 0;

      return {
        modelType: "llm_validation",
        traits: result.traits || {},
        confidence: 85, // LLM has high confidence when it runs
        tokensUsed,
      };
    } catch (error) {
      console.error("LLM validation failed:", error);
      return null; // Graceful degradation
    }
  }

  /**
   * Detect conflicting signals between Tier 1 models
   */
  private hasConflictingSignals(results: ModelOutput[]): boolean {
    if (results.length < 2) return false;

    // Check for major disagreements in key traits
    const keyTraits = ["extraversion", "agreeableness", "conscientiousness"];

    for (const trait of keyTraits) {
      const scores = results
        .map((r) => r.traits[trait])
        .filter((s) => s !== undefined);

      if (scores.length >= 2) {
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        // Conflict if difference > 40 points
        if (max - min > 40) return true;
      }
    }

    return false;
  }

  /**
   * Build prompt for LLM validation
   */
  private buildValidationPrompt(context: ValidationContext): string {
    const { tier1Results, conversationSummary, culturalContext } = context;

    let prompt = `Analyze the following conversation metrics and preliminary trait assessments:\n\n`;
    prompt += `Conversation Summary:\n${conversationSummary}\n\n`;

    if (culturalContext) {
      prompt += `Cultural Context:\n`;
      prompt += `- Country: ${culturalContext.countryCode || "Unknown"}\n`;
      prompt += `- Detected Patterns: ${culturalContext.detectedPatterns.join(", ")}\n\n`;
    }

    prompt += `Preliminary Assessments:\n`;
    tier1Results.forEach((result) => {
      prompt += `- ${result.modelType}: Confidence ${result.confidence}%\n`;
    });

    prompt += `\nProvide refined personality scores in JSON format:\n`;
    prompt += `{\n`;
    prompt += `  "traits": {\n`;
    prompt += `    "openness": <0-100>,\n`;
    prompt += `    "conscientiousness": <0-100>,\n`;
    prompt += `    "extraversion": <0-100>,\n`;
    prompt += `    "agreeableness": <0-100>,\n`;
    prompt += `    "neuroticism": <0-100>,\n`;
    prompt += `    "disc_dominance": <0-100>,\n`;
    prompt += `    "disc_influence": <0-100>,\n`;
    prompt += `    "disc_steadiness": <0-100>,\n`;
    prompt += `    "disc_compliance": <0-100>,\n`;
    prompt += `    "eq_selfAwareness": <0-100>,\n`;
    prompt += `    "eq_selfRegulation": <0-100>,\n`;
    prompt += `    "eq_motivation": <0-100>,\n`;
    prompt += `    "eq_empathy": <0-100>,\n`;
    prompt += `    "eq_socialSkills": <0-100>\n`;
    prompt += `  }\n`;
    prompt += `}`;

    return prompt;
  }

  /**
   * Fuse results from multiple models using weighted consensus
   * 
   * Weights:
   * - Keyword: 25%
   * - Sentiment: 25%
   * - Behavioral: 30%
   * - LLM: 20% (when available)
   */
  async fuseResults(outputs: ModelOutput[]): Promise<ConsensusScores> {
    const weights: Record<string, number> = {
      keyword_analysis: 0.25,
      sentiment_analysis: 0.25,
      behavioral_patterns: 0.3,
      llm_validation: 0.2,
    };

    const consensusTraits: Record<
      string,
      { score: number; confidence: number; modelsUsed: number }
    > = {};

    // Get all unique traits across all models
    const allTraits = new Set<string>();
    outputs.forEach((output) => {
      Object.keys(output.traits).forEach((trait) => allTraits.add(trait));
    });

    // Calculate weighted consensus for each trait
    for (const trait of allTraits) {
      let totalWeight = 0;
      let weightedSum = 0;
      let modelsUsed = 0;

      for (const output of outputs) {
        if (output.traits[trait] !== undefined) {
          const confidence = output.confidence;
          const score = output.traits[trait];
          const modelWeight = weights[output.modelType] * (confidence / 100);

          weightedSum += score * modelWeight;
          totalWeight += modelWeight;
          modelsUsed++;
        }
      }

      if (totalWeight > 0) {
        consensusTraits[trait] = {
          score: Math.round(weightedSum / totalWeight),
          confidence: Math.round(totalWeight * 100),
          modelsUsed,
        };
      }
    }

    // Calculate overall confidence
    const avgConfidence =
      outputs.reduce((sum, o) => sum + o.confidence, 0) / outputs.length;

    return {
      traits: consensusTraits,
      overallConfidence: Math.round(avgConfidence),
    };
  }
}
