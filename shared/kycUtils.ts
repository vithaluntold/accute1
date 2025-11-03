/**
 * KYC Utility Functions
 * Shared between frontend and backend for consistent KYC validation
 */

export interface KycCheckResult {
  isComplete: boolean;
  completionPercentage: number;
  missingFields: string[];
  canAccessFeatures: boolean;
}

export interface User {
  phoneVerified?: boolean;
  dateOfBirth?: any;
  nationalId?: string;
  nationalIdType?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  idDocumentUrl?: string;
  addressProofUrl?: string;
  kycStatus?: string;
}

/**
 * Calculate KYC completion status for a user
 */
export function calculateKycCompletion(user: User): KycCheckResult {
  const checks = {
    phoneVerified: {
      completed: user.phoneVerified === true,
      label: "Phone Verification",
      weight: 20,
    },
    personalInfo: {
      completed: !!(user.dateOfBirth && user.nationalId && user.nationalIdType),
      label: "Personal Information (DOB, National ID)",
      weight: 20,
    },
    address: {
      completed: !!(user.address && user.city && user.state && user.zipCode && user.country),
      label: "Complete Address",
      weight: 15,
    },
    emergencyContact: {
      completed: !!(user.emergencyContactName && user.emergencyContactPhone && user.emergencyContactRelation),
      label: "Emergency Contact",
      weight: 15,
    },
    idDocument: {
      completed: !!user.idDocumentUrl,
      label: "ID Document Upload",
      weight: 15,
    },
    addressProof: {
      completed: !!user.addressProofUrl,
      label: "Address Proof Upload",
      weight: 15,
    },
  };

  const missingFields: string[] = [];
  let totalWeight = 0;
  let completedWeight = 0;

  Object.entries(checks).forEach(([key, check]) => {
    totalWeight += check.weight;
    if (check.completed) {
      completedWeight += check.weight;
    } else {
      missingFields.push(check.label);
    }
  });

  const completionPercentage = Math.round((completedWeight / totalWeight) * 100);
  const isComplete = completionPercentage === 100;

  // Users can access features if:
  // 1. They have at least 80% KYC completion, OR
  // 2. Their KYC status is 'verified'
  const canAccessFeatures = completionPercentage >= 80 || user.kycStatus === "verified";

  return {
    isComplete,
    completionPercentage,
    missingFields,
    canAccessFeatures,
  };
}

/**
 * Get user-friendly message for KYC status
 */
export function getKycStatusMessage(kycCheck: KycCheckResult): string {
  if (kycCheck.isComplete) {
    return "Your profile is complete and verified.";
  }
  
  if (kycCheck.completionPercentage >= 80) {
    return "Your profile is mostly complete. Some features may be limited until full verification.";
  }
  
  if (kycCheck.completionPercentage >= 50) {
    return "Please complete your profile to access all features.";
  }
  
  return "Important: Complete your profile verification to access platform features.";
}

/**
 * Get required fields for different access levels
 */
export function getRequiredFieldsForLevel(level: "basic" | "standard" | "full"): string[] {
  const fields = {
    basic: ["phoneVerified"],
    standard: ["phoneVerified", "dateOfBirth", "nationalId", "address", "city", "state", "zipCode"],
    full: [
      "phoneVerified",
      "dateOfBirth",
      "nationalId",
      "address",
      "city",
      "state",
      "zipCode",
      "emergencyContactName",
      "emergencyContactPhone",
      "idDocumentUrl",
      "addressProofUrl",
    ],
  };
  
  return fields[level] || fields.full;
}
