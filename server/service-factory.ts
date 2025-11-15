/**
 * Service Factory - Composition Root
 * 
 * Centralizes service instantiation and dependency wiring.
 * Use these factories in routes, schedulers, and background jobs.
 * Tests can bypass factories and inject mocks directly via constructors.
 */

import { PersonalityProfilingService } from "./services/PersonalityProfilingService";
import { MLModelFusionEngine } from "./services/MLModelFusionEngine";

/**
 * Create PersonalityProfilingService with default production wiring
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
 * const mockEngine: IMLModelFusionEngine = {...};
 * const service = new PersonalityProfilingService(mockEngine);
 */
export function createPersonalityProfilingService(): PersonalityProfilingService {
  const fusionEngine = new MLModelFusionEngine();
  return new PersonalityProfilingService(fusionEngine);
}
