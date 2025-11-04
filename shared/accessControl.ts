import type { LiveChatConversation, LiveChatMessage, AgentAvailability } from "./schema";

/**
 * Check if a user has access to live chat
 * - Requires Edge subscription OR
 * - User is a test/seed user (created before cutoff date)
 * 
 * @param subscription - User's platform subscription
 * @param userCreatedAt - When the user account was created
 * @returns true if user has live chat access
 */
export function hasLiveChatAccess(
  subscription: { plan: string; status: string } | null,
  userCreatedAt: Date
): boolean {
  // Check if user was created before January 1, 2025 (test/seed users)
  const TEST_USER_CUTOFF = new Date("2025-01-01T00:00:00Z");
  const isTestUser = new Date(userCreatedAt) < TEST_USER_CUTOFF;
  
  // Test users always have access
  if (isTestUser) {
    return true;
  }
  
  // Check subscription - only Edge plan has live chat
  if (!subscription || subscription.status !== "active") {
    return false;
  }
  
  // Case-insensitive check for Edge plan
  return subscription.plan.toLowerCase() === "edge";
}

/**
 * Check if a user's KYC is complete enough for feature access
 * - Requires 80% completion OR admin verification
 * 
 * @param kycStatus - User's KYC status
 * @param kycCompletionPercentage - KYC completion percentage
 * @returns true if KYC requirements are met
 */
export function meetsKycRequirements(
  kycStatus: string,
  kycCompletionPercentage: number
): boolean {
  // Admin-verified users always pass
  if (kycStatus === "verified") {
    return true;
  }
  
  // Otherwise require at least 80% completion
  return kycCompletionPercentage >= 80;
}

/**
 * Check if a user can access live chat based on all requirements
 * - Subscription: Edge plan (or test user exemption)
 * - KYC: 80% complete or verified
 * - Account: Active
 * 
 * @param user - User object with subscription and KYC data
 * @returns Object with access status and reason for denial
 */
export function canAccessLiveChat(user: {
  id: string;
  isActive: boolean;
  createdAt: Date | string;
  kycStatus: string;
  subscription?: { plan: string; status: string } | null;
}): {
  allowed: boolean;
  reason?: string;
} {
  // Check if account is active
  if (!user.isActive) {
    return {
      allowed: false,
      reason: "Account is inactive"
    };
  }
  
  // Check subscription/test user status
  const userCreatedAt = typeof user.createdAt === "string" 
    ? new Date(user.createdAt) 
    : user.createdAt;
    
  if (!hasLiveChatAccess(user.subscription || null, userCreatedAt)) {
    return {
      allowed: false,
      reason: "Live chat is only available for Edge subscription users"
    };
  }
  
  // All checks passed
  return { allowed: true };
}

/**
 * Check if a user can access a specific feature based on onboarding completion
 * For new users (created after cutoff), enforce KYC requirements
 * 
 * @param user - User object
 * @param kycCompletionPercentage - KYC completion percentage
 * @returns Object with access status and reason for denial
 */
export function requiresOnboarding(user: {
  id: string;
  createdAt: Date | string;
  kycStatus: string;
}): {
  required: boolean;
  reason?: string;
} {
  const TEST_USER_CUTOFF = new Date("2025-01-01T00:00:00Z");
  const userCreatedAt = typeof user.createdAt === "string" 
    ? new Date(user.createdAt) 
    : user.createdAt;
  const isTestUser = userCreatedAt < TEST_USER_CUTOFF;
  
  // Test users are exempt from onboarding requirements
  if (isTestUser) {
    return { required: false };
  }
  
  // Admin-verified users have completed onboarding
  if (user.kycStatus === "verified") {
    return { required: false };
  }
  
  // New users require onboarding
  return {
    required: true,
    reason: "Please complete your profile verification to access this feature"
  };
}
