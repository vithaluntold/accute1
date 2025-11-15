/**
 * Service Factory - Composition Root
 * 
 * Centralizes service instantiation and dependency wiring.
 * Use these factories in routes, schedulers, and background jobs.
 * Tests can bypass factories and inject mocks directly via constructors.
 */

import { PersonalityProfilingService } from "./services/PersonalityProfilingService";
import { MLModelFusionEngine } from "./services/MLModelFusionEngine";
import { ConversationAnalysisEngine } from "./services/ConversationAnalysisEngine";
import { MLAnalysisQueueService } from "./services/MLAnalysisQueueService";

/**
 * Create PersonalityProfilingService with default production wiring
 * 
 * Wires:
 * - MLModelFusionEngine: Multi-tier ML model orchestration
 * - ConversationAnalysisEngine: Privacy-safe aggregated metrics
 * 
 * @returns Fully wired PersonalityProfilingService instance
 * 
 * @example
 * // In routes
 * const profilingService = createPersonalityProfilingService();
 * const profile = await profilingService.analyzeUser(userId, organizationId);
 * 
 * @example
 * // In tests (bypass factory, inject mocks)
 * const mockFusionEngine: IMLModelFusionEngine = {...};
 * const mockConversationEngine: IConversationAnalysisEngine = {...};
 * const service = new PersonalityProfilingService(mockFusionEngine, mockConversationEngine);
 */
export function createPersonalityProfilingService(): PersonalityProfilingService {
  const fusionEngine = new MLModelFusionEngine();
  const conversationEngine = new ConversationAnalysisEngine();
  return new PersonalityProfilingService(fusionEngine, conversationEngine);
}

/**
 * Create MLAnalysisQueueService with default production wiring
 * 
 * Wires:
 * - PersonalityProfilingService: For processing individual user analyses
 * 
 * @returns Fully wired MLAnalysisQueueService instance
 * 
 * @example
 * // In server initialization
 * const queueService = createMLAnalysisQueueService();
 * await queueService.startWorker();
 */
export function createMLAnalysisQueueService(): MLAnalysisQueueService {
  const profilingService = createPersonalityProfilingService();
  return new MLAnalysisQueueService(profilingService);
}
