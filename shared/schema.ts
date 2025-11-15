import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer, index, numeric, unique, pgEnum, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with role-based access
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationTokenExpiry: timestamp("email_verification_token_expiry"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  phoneVerifiedAt: timestamp("phone_verified_at"),
  avatarUrl: text("avatar_url"), // Profile picture URL
  
  // KYC fields for employee verification
  dateOfBirth: timestamp("date_of_birth"),
  nationalId: text("national_id"), // SSN, National ID, or equivalent
  nationalIdType: text("national_id_type"), // 'ssn', 'pan', 'nid', 'passport', etc.
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("US"),
  
  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  
  // KYC document verification
  idDocumentUrl: text("id_document_url"), // Uploaded ID proof
  addressProofUrl: text("address_proof_url"), // Uploaded address proof
  kycStatus: text("kyc_status").notNull().default("pending"), // 'pending', 'in_review', 'verified', 'rejected'
  kycVerifiedAt: timestamp("kyc_verified_at"),
  kycRejectionReason: text("kyc_rejection_reason"),
  
  roleId: varchar("role_id").notNull().references(() => roles.id),
  organizationId: varchar("organization_id").references(() => organizations.id), // Legacy - for backward compatibility during migration
  defaultOrganizationId: varchar("default_organization_id").references(() => organizations.id), // Default workspace on login (NOTE: Application must verify membership via userOrganizations)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Multi-Factor Authentication (MFA)
export const userMFA = pgTable("user_mfa", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaEnforced: boolean("mfa_enforced").notNull().default(false), // Organization policy
  
  // TOTP secret (AES-256-GCM encrypted in format: iv:encryptedData:authTag)
  totpSecret: text("totp_secret"),
  
  // Backup codes (hashed with bcrypt, one-time use)
  backupCodes: text("backup_codes").array().default(sql`ARRAY[]::text[]`),
  backupCodesUsed: text("backup_codes_used").array().default(sql`ARRAY[]::text[]`),
  
  lastVerified: timestamp("last_verified"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("user_mfa_user_idx").on(table.userId),
}));

// Trusted devices for MFA (skip MFA for 30 days)
export const trustedDevices = pgTable("trusted_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  deviceId: varchar("device_id", { length: 255 }).notNull(), // Browser fingerprint
  deviceName: varchar("device_name", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  expiresAt: timestamp("expires_at").notNull(), // 30 days from trust
  lastUsed: timestamp("last_used"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userDeviceIdx: index("trusted_devices_user_device_idx").on(table.userId, table.deviceId),
}));

// User-Organization Membership (Multi-Workspace Support)
// Allows users to belong to multiple organizations with different roles
export const userOrganizations = pgTable("user_organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  
  // Membership status
  status: text("status").notNull().default("active"), // 'active', 'invited', 'suspended'
  isDefault: boolean("is_default").notNull().default(false), // Default workspace on login
  
  // Invitation metadata
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at"),
  lastActiveAt: timestamp("last_active_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("user_organizations_user_idx").on(table.userId),
  orgUserIdx: index("user_organizations_org_idx").on(table.organizationId),
  // Ensure a user can only have one membership per organization
  userOrgUnique: unique("user_organizations_user_org_unique").on(table.userId, table.organizationId),
}));

// Partial unique index to ensure only one default workspace per user (defined separately for Drizzle)
// This prevents users from having multiple is_default=true memberships
// CREATE UNIQUE INDEX user_organizations_default_unique ON user_organizations (user_id) WHERE is_default = true;

// Organizations for multi-tenancy
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Display name (can be changed easily)
  legalName: text("legal_name"), // Legal business name
  slug: text("slug").notNull().unique(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  
  // Company Profile / Branding
  logoUrl: text("logo_url"), // Company logo
  faviconUrl: text("favicon_url"), // Custom favicon
  primaryColor: text("primary_color").default("#1e3a8a"), // Brand primary color
  secondaryColor: text("secondary_color").default("#10b981"), // Brand secondary color
  
  // Business Information
  industry: text("industry"), // e.g., 'accounting', 'legal', 'consulting'
  businessType: text("business_type"), // e.g., 'llc', 'corporation', 'partnership'
  taxId: text("tax_id"), // EIN/TIN for tax purposes
  website: text("website"),
  
  // Contact Information
  email: text("email"), // Company email
  phone: text("phone"), // Company phone
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("US"),
  
  // Localization
  timezone: text("timezone").default("America/New_York"),
  locale: text("locale").default("en-US"), // Language/region
  currency: text("currency").default("USD"),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  
  // Billing
  billingEmail: text("billing_email"),
  billingAddress: text("billing_address"),
  
  // Custom Domain Support
  customDomain: text("custom_domain"), // e.g., 'app.company.com'
  customDomainVerified: boolean("custom_domain_verified").default(false),
  
  // Workspace Settings (JSONB for flexibility)
  settings: jsonb("settings").default(sql`'{}'::jsonb`), // Custom workspace settings
  
  // Test account flag - grants unlimited access to all features (for testing)
  // Existing test accounts bypass all subscription limits
  isTestAccount: boolean("is_test_account").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Platform Subscriptions - Track organization subscriptions to the SaaS platform
export const platformSubscriptions = pgTable("platform_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Subscription details
  plan: text("plan").notNull().default("free"), // 'free', 'starter', 'professional', 'enterprise'
  status: text("status").notNull().default("active"), // 'active', 'cancelled', 'suspended', 'expired'
  billingCycle: text("billing_cycle").notNull().default("monthly"), // 'monthly', 'yearly'
  
  // Pricing
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }),
  mrr: numeric("mrr", { precision: 10, scale: 2 }).notNull().default(sql`0`), // Monthly Recurring Revenue
  
  // Limits based on plan
  maxUsers: integer("max_users").notNull().default(5),
  maxClients: integer("max_clients").notNull().default(10),
  maxStorage: integer("max_storage").notNull().default(5), // GB
  
  // Billing
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  nextBillingDate: timestamp("next_billing_date"),
  
  // Usage tracking
  currentUsers: integer("current_users").notNull().default(0),
  currentClients: integer("current_clients").notNull().default(0),
  currentStorage: numeric("current_storage", { precision: 10, scale: 2 }).notNull().default(sql`0`), // GB
  
  // Payment info
  paymentMethod: text("payment_method"), // 'credit_card', 'invoice', 'free'
  paymentGateway: text("payment_gateway").default("manual"), // 'stripe', 'razorpay', 'payu', 'payoneer', 'manual'
  defaultPaymentMethodId: varchar("default_payment_method_id"), // Reference to saved payment method for auto-sweep
  lastPaymentDate: timestamp("last_payment_date"),
  lastPaymentAmount: numeric("last_payment_amount", { precision: 10, scale: 2 }),
  
  // Enhanced subscription fields for multi-factor pricing
  planId: varchar("plan_id").references(() => subscriptionPlans.id), // Link to subscription_plans table
  currency: text("currency").notNull().default("USD"), // Billing currency
  regionCode: text("region_code"), // Pricing region (for PPP)
  seatCount: integer("seat_count").notNull().default(1), // Number of seats
  basePrice: numeric("base_price", { precision: 10, scale: 2 }), // Calculated base price after regional multiplier
  perSeatPrice: numeric("per_seat_price", { precision: 10, scale: 2 }), // Calculated per-seat price
  totalDiscount: numeric("total_discount", { precision: 10, scale: 2 }).notNull().default(sql`0`), // Total discount amount
  couponId: varchar("coupon_id").references(() => coupons.id), // Applied coupon
  
  // Price snapshot - immutable pricing details at subscription time
  priceSnapshot: jsonb("price_snapshot").default(sql`'{}'::jsonb`), // Store complete pricing breakdown
  
  // Payment gateway integration IDs
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  razorpayCustomerId: text("razorpay_customer_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  
  // Additional metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Flexible metadata storage
  
  // Trial
  trialEndsAt: timestamp("trial_ends_at"),
  isTrialing: boolean("is_trialing").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => ({
  orgIdx: index("platform_subscriptions_org_idx").on(table.organizationId),
  statusIdx: index("platform_subscriptions_status_idx").on(table.status),
  planIdx: index("platform_subscriptions_plan_idx").on(table.plan),
}));

// Subscription Plans - Define available plans with features, pricing, and limits
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // 'Free', 'Starter', 'Professional', 'Enterprise'
  slug: text("slug").notNull().unique(), // 'free', 'starter', 'professional', 'enterprise'
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0), // For ordering in UI
  
  // Feature configuration
  features: jsonb("features").notNull().default(sql`'[]'::jsonb`), // Marketing copy: ["Forms & Workflows", "Email Integration"]
  featureIdentifiers: jsonb("feature_identifiers").notNull().default(sql`'[]'::jsonb`), // Machine-readable: ['workflows', 'ai_agents', 'resource_management']
  
  // Base pricing (USD) - before regional multipliers
  basePriceMonthly: numeric("base_price_monthly", { precision: 10, scale: 2 }).notNull().default(sql`0`),
  basePriceYearly: numeric("base_price_yearly", { precision: 10, scale: 2 }).notNull().default(sql`0`),
  
  // Per-seat pricing
  perSeatPriceMonthly: numeric("per_seat_price_monthly", { precision: 10, scale: 2 }).notNull().default(sql`0`),
  perSeatPriceYearly: numeric("per_seat_price_yearly", { precision: 10, scale: 2 }).notNull().default(sql`0`),
  
  // Limits and quotas
  maxUsers: integer("max_users").notNull().default(5),
  maxClients: integer("max_clients").notNull().default(10),
  maxStorage: integer("max_storage").notNull().default(5), // GB
  maxWorkflows: integer("max_workflows").notNull().default(10),
  maxAIAgents: integer("max_ai_agents").notNull().default(3),
  
  // Included seats (before per-seat pricing kicks in)
  includedSeats: integer("included_seats").notNull().default(1),
  
  // Trial settings
  trialDays: integer("trial_days").notNull().default(0), // 0 = no trial
  
  // Stripe integration
  stripeProductId: text("stripe_product_id"), // Stripe Product ID
  stripePriceMonthlyId: text("stripe_price_monthly_id"), // Stripe Price ID for monthly
  stripePriceYearlyId: text("stripe_price_yearly_id"), // Stripe Price ID for yearly
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(true), // Show in public pricing page
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("subscription_plans_slug_idx").on(table.slug),
  displayOrderIdx: index("subscription_plans_display_order_idx").on(table.displayOrder),
}));

// Pricing Regions - Country-based pricing multipliers for purchasing power parity
export const pricingRegions = pgTable("pricing_regions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 'North America', 'Western Europe', 'India', etc.
  code: text("code"), // 'NA', 'EU', 'IN', etc.
  description: text("description"), // Optional description
  countryCodes: jsonb("country_codes").notNull().default(sql`'[]'::jsonb`), // Array of ISO country codes ['US', 'CA']
  currency: text("currency").notNull().default("USD"), // 'USD', 'EUR', 'INR', etc.
  currencySymbol: text("currency_symbol").notNull().default("$"),
  
  // Pricing multiplier (1.0 = full price, 0.5 = 50% discount)
  priceMultiplier: numeric("price_multiplier", { precision: 5, scale: 3 }).notNull().default(sql`1.000`),
  
  // Stripe-specific settings
  stripeCurrency: text("stripe_currency"), // Stripe currency code (lowercase)
  
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  displayOrderIdx: index("pricing_regions_display_order_idx").on(table.displayOrder),
}));

// Plan Volume Tiers - Volume discounts for per-seat pricing
export const planVolumeTiers = pgTable("plan_volume_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  
  // Tier configuration
  minSeats: integer("min_seats").notNull(), // Minimum seats for this tier (e.g., 11)
  maxSeats: integer("max_seats"), // Maximum seats for this tier (null = unlimited)
  
  // Discount
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }).notNull().default(sql`0`), // 0-100
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  planIdx: index("plan_volume_tiers_plan_idx").on(table.planId),
  planSeatsIdx: index("plan_volume_tiers_plan_seats_idx").on(table.planId, table.minSeats),
}));

// Coupons - Discount codes for promotional offers
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // 'LAUNCH2024', 'SAVE50', etc.
  name: text("name").notNull(), // Display name
  description: text("description"),
  
  // Discount type and value
  discountType: text("discount_type").notNull(), // 'percentage', 'fixed_amount'
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(), // 20 (for 20%), or 50.00 (for $50)
  
  // Applicability
  applicablePlans: jsonb("applicable_plans").default(sql`'[]'::jsonb`), // Empty = all plans, or array of plan IDs
  minimumSeats: integer("minimum_seats"), // Minimum seats required to use coupon
  
  // Usage limits
  maxRedemptions: integer("max_redemptions"), // null = unlimited
  currentRedemptions: integer("current_redemptions").notNull().default(0),
  maxRedemptionsPerOrganization: integer("max_redemptions_per_organization").notNull().default(1),
  
  // Validity period
  validFrom: timestamp("valid_from").notNull().defaultNow(),
  validUntil: timestamp("valid_until"),
  
  // Duration (how long the discount applies)
  durationMonths: integer("duration_months"), // null = forever, 1 = first month, 3 = first 3 months, etc.
  
  // Stripe integration
  stripeCouponId: text("stripe_coupon_id"), // Stripe Coupon ID
  
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  codeIdx: index("coupons_code_idx").on(table.code),
  validIdx: index("coupons_valid_idx").on(table.isActive, table.validFrom, table.validUntil),
}));

// Coupon Redemptions - Track coupon usage
export const couponRedemptions = pgTable("coupon_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => platformSubscriptions.id, { onDelete: "set null" }),
  
  // Snapshot of coupon at redemption time
  discountSnapshot: jsonb("discount_snapshot").notNull(), // Store coupon details at time of redemption
  
  redeemedBy: varchar("redeemed_by").references(() => users.id),
  redeemedAt: timestamp("redeemed_at").notNull().defaultNow(),
}, (table) => ({
  couponIdx: index("coupon_redemptions_coupon_idx").on(table.couponId),
  orgIdx: index("coupon_redemptions_org_idx").on(table.organizationId),
  uniqueOrgCoupon: unique("unique_org_coupon").on(table.couponId, table.organizationId),
}));

// Subscription Events - Audit trail for subscription lifecycle events
export const subscriptionEvents = pgTable("subscription_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => platformSubscriptions.id, { onDelete: "cascade" }),
  
  // Event details
  eventType: text("event_type").notNull(), // 'created', 'plan_changed', 'payment_succeeded', 'payment_failed', 'cancelled', etc.
  eventSource: text("event_source").notNull(), // 'stripe', 'razorpay', 'admin', 'system'
  externalEventId: text("external_event_id"), // Stripe event ID, for deduplication
  
  // Event data
  eventData: jsonb("event_data").notNull().default(sql`'{}'::jsonb`), // Full event payload
  
  // Processing status
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  subscriptionIdx: index("subscription_events_subscription_idx").on(table.subscriptionId),
  typeIdx: index("subscription_events_type_idx").on(table.eventType),
  externalIdx: index("subscription_events_external_idx").on(table.externalEventId),
  processedIdx: index("subscription_events_processed_idx").on(table.processed),
}));

// Product Families - Group features into bundles that super admin can manage
export const productFamilies = pgTable("product_families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // 'Core Features', 'AI Features', 'Compliance Features'
  slug: text("slug").notNull().unique(), // 'core-features', 'ai-features'
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  
  // Feature configuration
  features: jsonb("features").notNull().default(sql`'[]'::jsonb`), // Array of feature identifiers
  
  // Metadata
  icon: text("icon"), // Icon name for UI
  color: text("color"), // Brand color for UI
  
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("product_families_slug_idx").on(table.slug),
  displayOrderIdx: index("product_families_display_order_idx").on(table.displayOrder),
}));

// Plan SKUs - Support for SKU-based and usage-based pricing
export const planSKUs = pgTable("plan_skus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  
  // SKU details
  sku: text("sku").notNull().unique(), // 'ACCUTE-CORE-MONTHLY-USD', 'ACCUTE-AI-YEARLY-INR'
  name: text("name").notNull(), // Display name
  description: text("description"),
  
  // Pricing model
  pricingModel: text("pricing_model").notNull(), // 'fixed', 'usage_based', 'hybrid', 'per_seat', 'tiered'
  
  // Fixed pricing
  fixedPrice: numeric("fixed_price", { precision: 10, scale: 2 }),
  
  // Usage-based pricing
  usageUnit: text("usage_unit"), // 'tokens', 'api_calls', 'documents', 'storage_gb', 'users'
  usagePrice: numeric("usage_price", { precision: 10, scale: 6 }), // Price per unit
  includedUsage: integer("included_usage").default(0), // Free units included
  
  // Hybrid pricing (fixed + usage)
  basePrice: numeric("base_price", { precision: 10, scale: 2 }),
  
  // Tiered pricing configuration
  tiers: jsonb("tiers").default(sql`'[]'::jsonb`), // [{minUnits: 0, maxUnits: 100, pricePerUnit: 1.0}, ...]
  
  // Regional and billing
  regionCode: text("region_code"), // For region-specific SKUs
  currency: text("currency").notNull().default("USD"),
  billingCycle: text("billing_cycle").notNull(), // 'monthly', 'yearly', '3_year', 'one_time'
  
  // Gateway integration
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  razorpayPlanId: text("razorpay_plan_id"),
  payuPlanId: text("payu_plan_id"),
  payoneerPlanId: text("payoneer_plan_id"),
  
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  planIdx: index("plan_skus_plan_idx").on(table.planId),
  skuIdx: index("plan_skus_sku_idx").on(table.sku),
}));

// Plan Add-ons - Additional features organizations can purchase
export const planAddons = pgTable("plan_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productFamilyId: varchar("product_family_id").references(() => productFamilies.id, { onDelete: "set null" }),
  
  // Add-on details
  name: text("name").notNull(), // 'Extra Storage', 'Additional Users', 'Priority Support'
  slug: text("slug").notNull().unique(),
  description: text("description"),
  
  // Pricing
  pricingModel: text("pricing_model").notNull().default("fixed"), // 'fixed', 'per_unit', 'tiered'
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }),
  priceYearly: numeric("price_yearly", { precision: 10, scale: 2 }),
  
  // Unit-based pricing
  unit: text("unit"), // 'gb', 'user', 'seat', 'document'
  pricePerUnit: numeric("price_per_unit", { precision: 10, scale: 4 }),
  minQuantity: integer("min_quantity").default(1),
  maxQuantity: integer("max_quantity"), // null = unlimited
  
  // Features granted
  features: jsonb("features").notNull().default(sql`'[]'::jsonb`),
  
  // Quota increases
  additionalStorage: integer("additional_storage"), // GB
  additionalUsers: integer("additional_users"),
  additionalClients: integer("additional_clients"),
  additionalWorkflows: integer("additional_workflows"),
  
  // Applicability
  applicablePlans: jsonb("applicable_plans").default(sql`'[]'::jsonb`), // Empty = all plans
  
  // Gateway integration
  stripeProductId: text("stripe_product_id"),
  razorpayPlanId: text("razorpay_plan_id"),
  
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("plan_addons_slug_idx").on(table.slug),
  displayOrderIdx: index("plan_addons_display_order_idx").on(table.displayOrder),
}));

// Subscription Add-ons - Track which add-ons organizations have purchased
export const subscriptionAddons = pgTable("subscription_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => platformSubscriptions.id, { onDelete: "cascade" }),
  addonId: varchar("addon_id").notNull().references(() => planAddons.id, { onDelete: "cascade" }),
  
  // Quantity and pricing
  quantity: integer("quantity").notNull().default(1),
  priceSnapshot: jsonb("price_snapshot").notNull(), // Immutable pricing at purchase time
  
  // Status
  status: text("status").notNull().default("active"), // 'active', 'cancelled', 'expired'
  
  // Billing
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  nextBillingDate: timestamp("next_billing_date"),
  
  // Payment gateway integration
  stripeSubscriptionItemId: text("stripe_subscription_item_id"),
  razorpayAddonId: text("razorpay_addon_id"),
  
  addedBy: varchar("added_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => ({
  subscriptionIdx: index("subscription_addons_subscription_idx").on(table.subscriptionId),
  addonIdx: index("subscription_addons_addon_idx").on(table.addonId),
}));

// Payment Gateway Configurations - Organizations configure their own payment gateways
export const paymentGatewayConfigs = pgTable("payment_gateway_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Gateway details
  gateway: text("gateway").notNull(), // 'razorpay', 'stripe', 'payu', 'payoneer'
  nickname: text("nickname"), // User-friendly name
  
  // Credentials (encrypted with AES-256-GCM in format: iv:encryptedData:authTag)
  credentials: jsonb("credentials").notNull(), // Encrypted API keys, secrets
  
  // Configuration
  config: jsonb("config").default(sql`'{}'::jsonb`), // Webhook URLs, settings
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false), // Default gateway for client payments
  
  // Testing
  isTestMode: boolean("is_test_mode").notNull().default(false),
  
  // Webhook verification
  webhookSecret: text("webhook_secret"), // Encrypted
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  totalTransactions: integer("total_transactions").notNull().default(0),
  totalVolume: numeric("total_volume", { precision: 15, scale: 2 }).notNull().default(sql`0`),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("payment_gateway_configs_org_idx").on(table.organizationId),
  gatewayIdx: index("payment_gateway_configs_gateway_idx").on(table.gateway),
  defaultIdx: index("payment_gateway_configs_default_idx").on(table.isDefault),
}));

// Service Plans - Fiverr-style service offerings that admins create for clients
export const servicePlans = pgTable("service_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Service details
  title: text("title").notNull(), // 'Tax Return Preparation', 'Monthly Bookkeeping', 'Payroll Processing'
  slug: text("slug").notNull(), // URL-friendly identifier
  description: text("description"),
  
  // Categorization
  category: text("category"), // 'tax', 'bookkeeping', 'payroll', 'consulting', 'audit'
  tags: jsonb("tags").default(sql`'[]'::jsonb`), // Search tags
  
  // Pricing
  pricingModel: text("pricing_model").notNull().default("fixed"), // 'fixed', 'hourly', 'custom'
  basePrice: numeric("base_price", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  
  // Hourly pricing
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  estimatedHours: integer("estimated_hours"),
  
  // Pricing tiers (like Fiverr packages: Basic, Standard, Premium)
  tiers: jsonb("tiers").default(sql`'[]'::jsonb`), // [{name, price, features, deliveryDays}, ...]
  
  // Deliverables
  deliveryDays: integer("delivery_days"), // Expected delivery time
  revisions: integer("revisions"), // Number of revisions included
  features: jsonb("features").default(sql`'[]'::jsonb`), // What's included
  
  // Requirements
  requirements: jsonb("requirements").default(sql`'[]'::jsonb`), // What client needs to provide
  
  // Media
  coverImage: text("cover_image"),
  gallery: jsonb("gallery").default(sql`'[]'::jsonb`), // Additional images
  
  // Availability
  isAvailable: boolean("is_available").notNull().default(true),
  maxOrders: integer("max_orders"), // Queue limit
  currentOrders: integer("current_orders").notNull().default(0),
  
  // Stats
  totalOrders: integer("total_orders").notNull().default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }), // 0-5.00
  reviewCount: integer("review_count").notNull().default(0),
  
  // Visibility
  isPublic: boolean("is_public").notNull().default(true), // Show in marketplace
  isFeatured: boolean("is_featured").notNull().default(false),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("service_plans_org_idx").on(table.organizationId),
  slugIdx: index("service_plans_slug_idx").on(table.slug),
  categoryIdx: index("service_plans_category_idx").on(table.category),
  publicIdx: index("service_plans_public_idx").on(table.isPublic),
  uniqueOrgSlug: unique("unique_org_slug_service").on(table.organizationId, table.slug),
}));

// Service Plan Purchases - Track when clients purchase service plans
export const servicePlanPurchases = pgTable("service_plan_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  servicePlanId: varchar("service_plan_id").notNull().references(() => servicePlans.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Pricing snapshot
  selectedTier: text("selected_tier"), // Which tier was purchased
  priceSnapshot: jsonb("price_snapshot").notNull(), // Pricing at purchase time
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  
  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'refunded'
  
  // Delivery
  deliveryDate: timestamp("delivery_date"),
  deliveredAt: timestamp("delivered_at"),
  completedAt: timestamp("completed_at"),
  
  // Requirements and communication
  clientRequirements: jsonb("client_requirements"), // Client's inputs
  notes: text("notes"),
  
  // Review
  rating: numeric("rating", { precision: 3, scale: 2 }), // 0-5.00
  review: text("review"),
  reviewedAt: timestamp("reviewed_at"),
  
  // Payment
  paymentStatus: text("payment_status").notNull().default("pending"), // 'pending', 'paid', 'failed', 'refunded'
  paymentId: varchar("payment_id").references(() => payments.id),
  paymentGateway: text("payment_gateway"), // 'razorpay', 'stripe', 'payu', 'payoneer'
  paymentGatewayOrderId: text("payment_gateway_order_id"),
  
  // Assignment
  assignedTo: varchar("assigned_to").references(() => users.id), // Which employee is working on this
  
  purchasedBy: varchar("purchased_by").references(() => users.id), // Client user who purchased
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  servicePlanIdx: index("service_plan_purchases_service_idx").on(table.servicePlanId),
  clientIdx: index("service_plan_purchases_client_idx").on(table.clientId),
  orgIdx: index("service_plan_purchases_org_idx").on(table.organizationId),
  statusIdx: index("service_plan_purchases_status_idx").on(table.status),
}));

// Proposal status enum
export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "sent", 
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "cancelled"
]);

// Proposals & Quotes - Formal quotes/proposals sent to clients for acceptance
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Proposal details
  title: text("title").notNull(), // 'Q4 2024 Tax Planning Proposal'
  description: text("description"), // Brief summary
  proposalNumber: text("proposal_number"), // 'PROP-2024-001' - auto-generated
  
  // Financial (nullable for drafts, calculated when line items added)
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default(sql`0`),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default(sql`0`),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default(sql`0`),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default(sql`0`),
  currency: text("currency").notNull().default("USD"),
  
  // Line items (services/products)
  lineItems: jsonb("line_items").notNull().default(sql`'[]'::jsonb`),
  // [{name, description, quantity, rate, amount, taxable}]
  
  // Content
  content: text("content"), // Rich text/markdown proposal body
  termsAndConditions: text("terms_and_conditions"),
  notes: text("notes"), // Internal notes
  
  // Template
  templateId: varchar("template_id").references(() => documentTemplates.id, { onDelete: "set null" }),
  
  // Validity
  validFrom: timestamp("valid_from").notNull().defaultNow(),
  validUntil: timestamp("valid_until").notNull(),
  
  // Status
  status: proposalStatusEnum("status").notNull().default("draft"),
  
  // Client interaction
  viewedAt: timestamp("viewed_at"),
  viewCount: integer("view_count").notNull().default(0),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  clientNotes: text("client_notes"), // Client's reason for rejection or acceptance notes
  signedBy: varchar("signed_by").references(() => users.id), // Client portal user who accepted
  signatureUrl: text("signature_url"), // Digital signature image/data
  
  // PDF generation
  pdfUrl: text("pdf_url"), // Generated PDF file path
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  
  // Tracking
  sentAt: timestamp("sent_at"),
  sentBy: varchar("sent_by").references(() => users.id), // Internal user who sent
  reminderSentAt: timestamp("reminder_sent_at"),
  reminderCount: integer("reminder_count").notNull().default(0),
  
  // Conversion to project/invoice
  convertedToProjectId: varchar("converted_to_project_id").references(() => projects.id),
  convertedToInvoiceId: varchar("converted_to_invoice_id").references(() => invoices.id),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  clientIdx: index("proposals_client_idx").on(table.clientId),
  orgIdx: index("proposals_org_idx").on(table.organizationId),
  statusIdx: index("proposals_status_idx").on(table.status),
  numberIdx: index("proposals_number_idx").on(table.proposalNumber),
  validUntilIdx: index("proposals_valid_until_idx").on(table.validUntil),
  // Composite indexes for common queries
  orgStatusIdx: index("proposals_org_status_idx").on(table.organizationId, table.status),
  clientStatusIdx: index("proposals_client_status_idx").on(table.clientId, table.status),
  uniqueOrgNumber: unique("unique_org_proposal_number").on(table.organizationId, table.proposalNumber),
}));

// Roles table (Super Admin, Admin, Employee, Client)
// scope: 'platform' for SaaS-level roles (Super Admin), 'tenant' for organization roles
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  scope: text("scope").notNull().default("tenant"), // 'platform' or 'tenant'
  isSystemRole: boolean("is_system_role").notNull().default(false),
  organizationId: varchar("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Permissions for granular access control
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Role-Permission junction table
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sessions for authentication
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// SSO/SAML Connections - Enterprise authentication configuration per organization
export const ssoConnections = pgTable("sso_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // SAML Configuration
  provider: text("provider").notNull().default("custom"), // 'okta', 'azure', 'onelogin', 'google', 'custom'
  entityId: text("entity_id").notNull(), // SP Entity ID (issuer)
  ssoUrl: text("sso_url").notNull(), // IdP SSO URL (entryPoint)
  certificate: text("certificate").notNull(), // IdP X.509 certificate (base64)
  
  // Optional SAML settings
  logoutUrl: text("logout_url"), // IdP logout URL
  signatureAlgorithm: text("signature_algorithm").default("sha256"), // 'sha1', 'sha256', 'sha512'
  wantAssertionsSigned: boolean("want_assertions_signed").default(true),
  wantAuthnResponseSigned: boolean("want_authn_response_signed").default(false),
  
  // Attribute mapping (SAML attributes to user fields)
  attributeMappings: jsonb("attribute_mappings").default(sql`'{}'::jsonb`),
  // Example: { "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" }
  
  // Auto-provisioning settings
  autoProvision: boolean("auto_provision").default(false), // Auto-create users on first login
  defaultRoleId: varchar("default_role_id").references(() => roles.id), // Role for auto-provisioned users
  
  // Status
  isEnabled: boolean("is_enabled").default(true),
  
  // Metadata
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("sso_connections_org_idx").on(table.organizationId),
}));

// SSO Sessions - Track active SSO sessions for audit trail
export const ssoSessions = pgTable("sso_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ssoConnectionId: varchar("sso_connection_id").notNull().references(() => ssoConnections.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // SAML session data
  nameId: text("name_id").notNull(), // SAML NameID
  sessionIndex: text("session_index"), // SAML SessionIndex for SLO
  
  // Session metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Audit trail
  loginAt: timestamp("login_at").notNull().defaultNow(),
  logoutAt: timestamp("logout_at"),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  ssoConnectionIdx: index("sso_sessions_connection_idx").on(table.ssoConnectionId),
  userIdx: index("sso_sessions_user_idx").on(table.userId),
}));

// OTP Verification - For phone number verification during account setup
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  otp: text("otp").notNull(),
  verified: boolean("verified").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  phoneIdx: index("otp_verifications_phone_idx").on(table.phone),
  userIdx: index("otp_verifications_user_idx").on(table.userId),
}));

// Luca Chat Sessions - Store conversation history
export const lucaChatSessions = pgTable("luca_chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id),
  title: text("title").notNull().default("New Chat"),
  llmConfigId: varchar("llm_config_id").references(() => llmConfigurations.id, { onDelete: "set null" }), // Which AI provider was used - preserve chat history even if config deleted
  isActive: boolean("is_active").notNull().default(true),
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false), // Archived chats are hidden from main list but still searchable
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("luca_chat_sessions_user_idx").on(table.userId),
  userActiveIdx: index("luca_chat_sessions_user_active_idx").on(table.userId, table.isActive),
  userArchivedIdx: index("luca_chat_sessions_user_archived_idx").on(table.userId, table.isArchived),
}));

// Luca Chat Messages - Individual messages within sessions
export const lucaChatMessages = pgTable("luca_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => lucaChatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Store token usage, model info, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("luca_chat_messages_session_idx").on(table.sessionId),
  sessionCreatedIdx: index("luca_chat_messages_session_created_idx").on(table.sessionId, table.createdAt),
}));

// Workflows - Unified hierarchical project/workflow management with automation
// Combines stages/steps/tasks hierarchy WITH visual automation capabilities (best of both worlds!)
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"), // 'tax', 'audit', 'bookkeeping', 'custom'
  
  // Template scoping: 'global' (super admin, visible to all) or 'organization' (admin, org-specific)
  scope: text("scope").notNull().default("organization"), // 'global', 'organization'
  organizationId: varchar("organization_id").references(() => organizations.id), // null for global templates, org ID for org-scoped
  createdBy: varchar("created_by").notNull().references(() => users.id),
  status: text("status").notNull().default("draft"), // 'draft', 'active', 'completed', 'archived'
  currentStageId: varchar("current_stage_id"), // Track which stage workflow is currently on
  
  // Automation triggers - What starts this workflow?
  triggers: jsonb("triggers").notNull().default(sql`'[]'::jsonb`), // Array of trigger configs: {type: 'email'|'form'|'webhook'|'schedule', config: {...}}
  isAutomated: boolean("is_automated").notNull().default(false), // Does this workflow have automation?
  
  // Visual workflow representation (for automation canvas)
  nodes: jsonb("nodes").notNull().default(sql`'[]'::jsonb`), // Visual workflow nodes
  edges: jsonb("edges").notNull().default(sql`'[]'::jsonb`), // Connections between nodes
  viewport: jsonb("viewport").default(sql`'{"x": 0, "y": 0, "zoom": 1}'::jsonb`), // Canvas state
  
  // Metadata
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  lastPublishedAt: timestamp("last_published_at"),
  lastExecutedAt: timestamp("last_executed_at"),
  executionCount: integer("execution_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Workflow Executions - track workflow runs
export const workflowExecutions = pgTable("workflow_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  workflowVersion: integer("workflow_version").notNull(), // Critical: track which version executed
  triggeredBy: varchar("triggered_by").references(() => users.id),
  status: text("status").notNull().default("running"), // 'running', 'completed', 'failed', 'cancelled'
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  // Execution data
  input: jsonb("input").default(sql`'{}'::jsonb`),
  output: jsonb("output").default(sql`'{}'::jsonb`),
  error: text("error"),
  // Node execution tracking
  nodeExecutions: jsonb("node_executions").notNull().default(sql`'[]'::jsonb`), // Track which nodes executed
  currentNodeId: varchar("current_node_id"),
  // Metadata
  duration: integer("duration"), // milliseconds
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance on multi-tenant queries
  orgWorkflowIdx: index("workflow_executions_org_workflow_idx").on(table.organizationId, table.workflowId),
  workflowStatusIdx: index("workflow_executions_workflow_status_idx").on(table.workflowId, table.status),
}));

// Workflow Stages - Top level grouping with auto-progression rules
export const workflowStages = pgTable("workflow_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(), // Display order
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed'
  
  // Automation: Auto-progression to next stage
  autoProgress: boolean("auto_progress").notNull().default(false), // Auto-advance when conditions met
  progressConditions: jsonb("progress_conditions").default(sql`'{}'::jsonb`), // Conditions for auto-progression
  onCompleteActions: jsonb("on_complete_actions").default(sql`'[]'::jsonb`), // Actions to execute when stage completes
  
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Workflow Steps - Within each stage with automation support
export const workflowSteps = pgTable("workflow_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageId: varchar("stage_id").notNull().references(() => workflowStages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(), // Display order
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed'
  requireAllTasksComplete: boolean("require_all_tasks_complete").notNull().default(true), // Must complete all tasks before proceeding
  
  // Automation: Auto-progression and actions
  autoProgress: boolean("auto_progress").notNull().default(false), // Auto-advance when conditions met
  progressConditions: jsonb("progress_conditions").default(sql`'{}'::jsonb`), // Conditions for auto-progression
  onCompleteActions: jsonb("on_complete_actions").default(sql`'[]'::jsonb`), // Actions to execute when step completes
  
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Workflow Tasks - Individual work items with full automation support
export const workflowTasks = pgTable("workflow_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stepId: varchar("step_id").notNull().references(() => workflowSteps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("manual"), // 'manual', 'automated'
  order: integer("order").notNull(), // Display order
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed'
  assignedTo: varchar("assigned_to").references(() => users.id), // User assigned to this task
  aiAgentId: varchar("ai_agent_id").references(() => aiAgents.id), // AI agent for automated tasks
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  
  // Task scheduling and duration (for dependency management and critical path)
  startDate: timestamp("start_date"), // Planned/actual start date
  dueDate: timestamp("due_date"), // Planned/actual end date
  estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }), // Estimated duration in hours
  actualHours: numeric("actual_hours", { precision: 10, scale: 2 }), // Actual duration in hours (for completed tasks)
  
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  
  // Visual automation canvas (for task-level automation design)
  nodes: jsonb("nodes").notNull().default(sql`'[]'::jsonb`), // Visual workflow nodes for this task
  edges: jsonb("edges").notNull().default(sql`'[]'::jsonb`), // Connections between nodes for this task
  viewport: jsonb("viewport").default(sql`'{"x": 0, "y": 0, "zoom": 1}'::jsonb`), // Canvas state
  
  // Automation configuration
  automationTrigger: jsonb("automation_trigger").default(sql`'{}'::jsonb`), // Trigger config for automated tasks
  automationConditions: jsonb("automation_conditions").default(sql`'[]'::jsonb`), // Conditions to check before executing
  automationActions: jsonb("automation_actions").default(sql`'[]'::jsonb`), // Actions to execute (API calls, notifications, etc.)
  automationInput: jsonb("automation_input").default(sql`'{}'::jsonb`), // Input data for AI agent or automation
  automationOutput: jsonb("automation_output").default(sql`'{}'::jsonb`), // Output/results from automation
  
  // Auto-progression (TaxDome-style)
  autoProgress: boolean("auto_progress").notNull().default(false), // Auto-advance to next task when all checklists/subtasks complete
  requireAllChecklistsComplete: boolean("require_all_checklists_complete").notNull().default(true), // Must complete all checklists
  requireAllSubtasksComplete: boolean("require_all_subtasks_complete").notNull().default(true), // Must complete all subtasks
  
  // AI Agent Review Workflow
  reviewRequired: boolean("review_required").notNull().default(false), // Whether AI output needs human review
  reviewStatus: text("review_status"), // 'pending_review', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Who reviewed the AI output
  reviewedAt: timestamp("reviewed_at"), // When it was reviewed
  reviewNotes: text("review_notes"), // Reviewer's notes or feedback
  
  // Reminder configuration
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderDuration: integer("reminder_duration"), // Minutes before due date to send reminder (e.g., 60 = 1 hour before, 1440 = 1 day before)
  notifyAssignee: boolean("notify_assignee").notNull().default(true), // Notify the assigned user
  notifyManager: boolean("notify_manager").notNull().default(false), // Notify the manager/admin
  notifyClient: boolean("notify_client").notNull().default(false), // Notify the client (if client is assigned)
  lastReminderSent: timestamp("last_reminder_sent"), // Track when last reminder was sent
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Subtasks - Break down tasks into smaller pieces
export const taskSubtasks = pgTable("task_subtasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => workflowTasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull(), // Display order
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed'
  assignedTo: varchar("assigned_to").references(() => users.id), // User assigned to this subtask
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  
  // Visual automation canvas (for subtask-level automation)
  nodes: jsonb("nodes").notNull().default(sql`'[]'::jsonb`),
  edges: jsonb("edges").notNull().default(sql`'[]'::jsonb`),
  viewport: jsonb("viewport").default(sql`'{"x": 0, "y": 0, "zoom": 1}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Checklists - Simple checkboxes for task completion
export const taskChecklists = pgTable("task_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => workflowTasks.id, { onDelete: "cascade" }),
  item: text("item").notNull(),
  order: integer("order").notNull(), // Display order
  isChecked: boolean("is_checked").notNull().default(false),
  checkedAt: timestamp("checked_at"),
  checkedBy: varchar("checked_by").references(() => users.id),
  
  // Visual automation canvas (for checklist-level automation triggers)
  nodes: jsonb("nodes").notNull().default(sql`'[]'::jsonb`),
  edges: jsonb("edges").notNull().default(sql`'[]'::jsonb`),
  viewport: jsonb("viewport").default(sql`'{"x": 0, "y": 0, "zoom": 1}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Dependencies - Track task relationships and critical path
export const taskDependencies = pgTable("task_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => workflowTasks.id, { onDelete: "cascade" }), // The dependent task (waits for predecessor)
  dependsOnTaskId: varchar("depends_on_task_id").notNull().references(() => workflowTasks.id, { onDelete: "cascade" }), // The predecessor task
  
  // Dependency type determines when the dependent task can start/finish
  // ENUM constraint: Must be one of the 4 valid dependency types
  dependencyType: text("dependency_type", { 
    enum: ["finish-to-start", "start-to-start", "finish-to-finish", "start-to-finish"] 
  }).notNull().default("finish-to-start"),
  
  // Lag/lead time (in minutes)
  lag: integer("lag").notNull().default(0), // Positive = delay, Negative = lead time (task can start before predecessor finishes)
  
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id), // SECURITY: Ensure both tasks in same workflow
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  taskIdx: index("task_dependencies_task_idx").on(table.taskId),
  dependsOnIdx: index("task_dependencies_depends_on_idx").on(table.dependsOnTaskId),
  orgIdx: index("task_dependencies_org_idx").on(table.organizationId),
  workflowIdx: index("task_dependencies_workflow_idx").on(table.workflowId),
  // Prevent duplicate dependencies
  taskDependencyUnique: unique("task_dependencies_unique").on(table.taskId, table.dependsOnTaskId),
}));

// AI Agents in marketplace - Enhanced for Foundry
export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").unique(), // Unique identifier (e.g., 'parity', 'cadence') - nullable for existing agents
  name: text("name").notNull(),
  description: text("description").notNull(),
  provider: text("provider").notNull(),
  category: text("category").notNull(),
  capabilities: jsonb("capabilities").notNull().default([]),
  configuration: jsonb("configuration").notNull().default({}),
  rating: integer("rating").default(0),
  installCount: integer("install_count").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  
  // Directory paths for agent code (Foundry support)
  backendPath: text("backend_path"), // Path to backend handler entry point
  frontendPath: text("frontend_path"), // Path to frontend component entry point
  iconPath: text("icon_path"), // Path to agent icon
  manifestJson: text("manifest_json"), // Full manifest JSON for validation
  
  // Subscription and pricing - Comprehensive model
  pricingModel: text("pricing_model").notNull().default("free"), // 'free', 'per_month', 'per_year', 'per_instance', 'per_token', 'one_time', 'hybrid'
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).default(sql`0`),
  priceYearly: numeric("price_yearly", { precision: 10, scale: 2 }).default(sql`0`),
  pricePerInstance: numeric("price_per_instance", { precision: 10, scale: 4 }).default(sql`0`), // Per-use pricing (e.g., $0.50 per execution)
  pricePerToken: numeric("price_per_token", { precision: 10, scale: 6 }).default(sql`0`), // Per-token pricing (e.g., $0.000001 per token)
  oneTimeFee: numeric("one_time_fee", { precision: 10, scale: 2 }).default(sql`0`), // One-time purchase fee
  subscriptionMinPlan: text("subscription_min_plan").notNull().default("free"), // Minimum subscription plan required
  
  // Access control (Foundry feature)
  defaultScope: text("default_scope").notNull().default("admin"), // 'admin', 'user' (who gets access by default)
  
  // Publishing
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by").references(() => users.id),
  
  // Metadata
  version: text("version").notNull().default("1.0.0"),
  tags: jsonb("tags").notNull().default([]),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("ai_agents_slug_idx").on(table.slug),
  publicIdx: index("ai_agents_public_idx").on(table.isPublic),
}));

// AI Agent Installations
export const aiAgentInstallations = pgTable("ai_agent_installations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  installedBy: varchar("installed_by").notNull().references(() => users.id),
  configuration: jsonb("configuration").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI Agent Usage Tracking - For per-instance and per-token billing
export const aiAgentUsage = pgTable("ai_agent_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Usage metrics
  instanceCount: integer("instance_count").notNull().default(1), // Number of times agent was invoked
  tokenCount: integer("token_count").notNull().default(0), // Number of tokens consumed
  executionTimeMs: integer("execution_time_ms"), // Execution time
  
  // Billing
  cost: numeric("cost", { precision: 10, scale: 6 }).notNull().default(sql`0`), // Calculated cost for this usage
  billingPeriod: text("billing_period"), // e.g., '2025-01' for monthly billing
  
  // Context
  conversationId: varchar("conversation_id").references(() => aiAgentConversations.id),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgBillingIdx: index("ai_agent_usage_org_billing_idx").on(table.organizationId, table.billingPeriod),
  agentBillingIdx: index("ai_agent_usage_agent_billing_idx").on(table.agentId, table.billingPeriod),
}));

// AI Provider Configurations
export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  provider: text("provider").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  endpoint: text("endpoint"),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Agent Conversations - Persistent chat sessions
export const aiAgentConversations = pgTable("ai_agent_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentName: text("agent_name").notNull(), // 'cadence', 'forma', 'parity', 'kanban'
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title"), // Optional user-defined title
  contextType: text("context_type"), // 'workflow', 'form', 'document', etc.
  contextId: varchar("context_id"), // ID of the workflow/form/document being discussed
  contextData: jsonb("context_data").default(sql`'{}'::jsonb`), // Snapshot of context at conversation start
  isActive: boolean("is_active").notNull().default(true),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Index for finding user's conversations with specific agent
  userAgentIdx: index("ai_conversations_user_agent_idx").on(table.userId, table.agentName),
  // Index for finding conversations by context
  contextIdx: index("ai_conversations_context_idx").on(table.contextType, table.contextId),
}));

// AI Agent Messages - Individual messages in conversations
export const aiAgentMessages = pgTable("ai_agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => aiAgentConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  
  // Function calling / tool execution
  functionCalls: jsonb("function_calls").default(sql`'[]'::jsonb`), // Array of {name, arguments, result}
  toolExecutions: jsonb("tool_executions").default(sql`'[]'::jsonb`), // Results of any actions taken
  
  // Metadata
  llmConfigId: varchar("llm_config_id"), // Which LLM was used for this message
  tokensUsed: integer("tokens_used"), // Track token usage
  executionTimeMs: integer("execution_time_ms"), // How long the agent took to respond
  error: text("error"), // Any errors that occurred
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Index for fetching messages in a conversation
  conversationIdx: index("ai_messages_conversation_idx").on(table.conversationId, table.createdAt),
}));

// Organization Cryptographic Keys - Persisted RSA key pairs for PKI signatures
export const organizationKeys = pgTable("organization_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id).unique(),
  publicKey: text("public_key").notNull(), // PEM-formatted RSA public key
  privateKey: text("private_key").notNull(), // PEM-formatted RSA private key (encrypted at rest)
  algorithm: text("algorithm").notNull().default("RSA-2048"), // Key algorithm
  createdAt: timestamp("created_at").notNull().defaultNow(),
  rotatedAt: timestamp("rotated_at"), // For key rotation tracking
});

// Documents for client portal with PKI digital signatures
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  workflowId: varchar("workflow_id").references(() => workflows.id),
  status: text("status").notNull().default("pending"),
  encryptedContent: text("encrypted_content"),
  
  // PKI Digital Signature fields for tamper-proof verification
  documentHash: text("document_hash"), // SHA-256 hash of original file
  digitalSignature: text("digital_signature"), // RSA signature of hash
  signatureAlgorithm: text("signature_algorithm").default("RSA-SHA256"), // Algorithm used
  signedAt: timestamp("signed_at"), // When document was signed
  signedBy: varchar("signed_by").references(() => users.id), // Who signed it
  verificationStatus: text("verification_status").default("unverified"), // 'verified', 'unverified', 'tampered'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Document Versions for version control and audit trail
export const documentVersions = pgTable("document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(), // Sequential version (1, 2, 3...)
  
  // Version metadata
  name: text("name").notNull(), // Filename at this version
  type: text("type").notNull(), // MIME type
  size: integer("size").notNull(), // File size in bytes
  url: text("url").notNull(), // Storage URL for this version
  
  // Change tracking
  changeDescription: text("change_description"), // User-provided description of changes
  changeType: text("change_type").notNull().default("minor"), // 'major', 'minor', 'patch'
  
  // Security and integrity
  documentHash: text("document_hash").notNull(), // SHA-256 hash for verification
  digitalSignature: text("digital_signature"), // RSA signature
  encryptedContent: text("encrypted_content"), // AES-256 encrypted content
  
  // Metadata
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Approval workflow (for compliance)
  approvalStatus: text("approval_status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdx: index("document_versions_document_idx").on(table.documentId),
  orgIdx: index("document_versions_org_idx").on(table.organizationId),
  // Ensure unique version numbers per document
  documentVersionUnique: unique("document_versions_unique").on(table.documentId, table.versionNumber),
}));

// Document Templates for reusable engagement letters and contracts
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Standard CPA Engagement Letter"
  category: text("category").notNull().default("engagement_letter"), // engagement_letter, audit_letter, tax_organizer, etc.
  content: text("content").notNull(), // Template content with placeholders like {{client_name}}
  description: text("description"), // Brief description of template
  
  // Template scoping: 'global' (super admin, visible to all) or 'organization' (admin, org-specific)
  scope: text("scope").notNull().default("organization"), // 'global', 'organization'
  organizationId: varchar("organization_id").references(() => organizations.id), // null for global templates, org ID for org-scoped
  createdBy: varchar("created_by").references(() => users.id),
  isDefault: boolean("is_default").notNull().default(false), // System-provided templates
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0), // Track how many times template was used
  metadata: jsonb("metadata").default({}), // Additional template settings
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Notifications - Enhanced for Action Center
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  // Type: task_assigned, task_due_soon, task_overdue, document_shared, document_request, 
  // signature_request, form_request, payment_request, message_received, workflow_updated
  type: text("type").notNull(),
  // Priority: low, medium, high, urgent
  priority: text("priority").notNull().default("medium"),
  // Action URL to navigate when clicking notification
  actionUrl: text("action_url"),
  // Reference to the source resource (task ID, document ID, etc.)
  resourceId: varchar("resource_id"),
  resourceType: text("resource_type"), // task, document, signature, form, payment, message
  isRead: boolean("is_read").notNull().default(false),
  isActioned: boolean("is_actioned").notNull().default(false), // User completed the action
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
  actionedAt: timestamp("actioned_at"),
});

// Activity logs for audit trail
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  organizationId: varchar("organization_id").references(() => organizations.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: varchar("resource_id"),
  metadata: jsonb("metadata").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Super Admin Keys for controlled super admin onboarding
export const superAdminKeys = pgTable("super_admin_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyHash: text("key_hash").notNull().unique(),
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  usedBy: varchar("used_by").references(() => users.id),
  usedAt: timestamp("used_at"),
  revokedAt: timestamp("revoked_at"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invitations for employee and client onboarding
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenHash: text("token_hash").notNull().unique(),
  type: text("type").notNull(), // 'email' or 'sms'
  email: text("email"),
  phone: text("phone"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'expired', 'revoked'
  expiresAt: timestamp("expires_at").notNull(),
  acceptedBy: varchar("accepted_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// LLM Configurations for user-managed AI credentials
// Supports two scopes: 'user' (shared across all user's workspaces) and 'workspace' (workspace-specific)
export const llmConfigurations = pgTable("llm_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Scope: 'user' = user-level (shared across all user's workspaces), 'workspace' = workspace-specific
  scope: text("scope").notNull().default("workspace"), // 'user' | 'workspace'
  organizationId: varchar("organization_id").references(() => organizations.id), // Required for workspace scope, null for user scope
  userId: varchar("user_id").references(() => users.id), // Required for user scope, null for workspace scope
  name: text("name").notNull(), // User-friendly name for this configuration
  provider: text("provider").notNull(), // 'openai', 'anthropic', 'azure'
  // Encrypted API credentials
  apiKeyEncrypted: text("api_key_encrypted").notNull(), // AES-256 encrypted
  azureEndpoint: text("azure_endpoint"), // For Azure OpenAI
  // Model configuration
  model: text("model").notNull(), // e.g., 'gpt-4', 'claude-3-opus', etc.
  modelVersion: text("model_version"), // Optional version specification
  // Settings
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false), // Default config for scope (user or workspace)
  // Metadata
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("llm_configurations_org_idx").on(table.organizationId),
  userIdx: index("llm_configurations_user_idx").on(table.userId),
  scopeIdx: index("llm_configurations_scope_idx").on(table.scope),
}));

// Partial unique index to ensure only one default LLM config per organization (defined separately for Drizzle)
// This prevents organizations from having multiple is_default=true configurations
// CREATE UNIQUE INDEX llm_configurations_default_unique ON llm_configurations (organization_id) WHERE is_default = true;

// Clients for accounting firms
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").notNull().default("US"),
  taxId: text("tax_id"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'prospect'
  industry: text("industry"),
  notes: text("notes"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  metadata: jsonb("metadata").default({}),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contacts table - individual contacts within client companies
// Note: clientId kept for backward compatibility but relationships now managed via client_contacts junction table
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "cascade" }), // Nullable for multi-client support
  userId: varchar("user_id").references(() => users.id), // Link to user account for portal access
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  title: text("title"),
  department: text("department"),
  isPrimary: boolean("is_primary").notNull().default(false), // Deprecated - use client_contacts.isPrimary instead
  notes: text("notes"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Client-Contact Junction Table - Many-to-many relationships between clients and contacts
// Enables contacts to access multiple clients with same credentials
export const clientContacts = pgTable("client_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false), // Primary client designation for this contact
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniquePair: unique().on(table.clientId, table.contactId),
}));

// Portal Invitations - Manage client portal access setup
export const portalInvitations = pgTable("portal_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  invitationToken: text("invitation_token").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'expired'
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Client Onboarding Sessions - Track AI-assisted client onboarding conversations
export const clientOnboardingSessions = pgTable("client_onboarding_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'completed', 'cancelled'
  // Collected data (non-sensitive metadata about what was collected)
  collectedData: jsonb("collected_data").default({}), // Stores: country, clientType, industry, etc.
  // Sensitive data collected via direct form (not sent to AI)
  sensitiveData: jsonb("sensitive_data").default({}), // Stores: names, emails, phones, addresses
  // Final client ID once created
  clientId: varchar("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Onboarding Messages - Conversation history for audit trail
export const onboardingMessages = pgTable("onboarding_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => clientOnboardingSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  // Metadata about the message
  metadata: jsonb("metadata").default({}), // Can store: field_collected, validation_result, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==================== TEAM MANAGEMENT SYSTEM ====================

// Teams - organizational units within a practice (distinct from Employee Management)
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("teams_org_idx").on(table.organizationId),
}));

// Team Members - employees assigned to teams with roles
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'manager', 'member'
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => ({
  uniquePair: unique().on(table.teamId, table.userId),
  teamIdx: index("team_members_team_idx").on(table.teamId),
  userIdx: index("team_members_user_idx").on(table.userId),
}));

// Supervisor Relationships - hierarchical supervision (can be cross-team)
export const supervisorRelationships = pgTable("supervisor_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  supervisorId: varchar("supervisor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reporteeId: varchar("reportee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  level: integer("level").notNull().default(1), // 1 = direct, 2+ = indirect
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniquePair: unique().on(table.supervisorId, table.reporteeId),
  supervisorIdx: index("supervisor_relationships_supervisor_idx").on(table.supervisorId),
  reporteeIdx: index("supervisor_relationships_reportee_idx").on(table.reporteeId),
  orgIdx: index("supervisor_relationships_org_idx").on(table.organizationId),
}));

// Team Chat Messages - real-time team communication
export const teamChatMessages = pgTable("team_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => teams.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").references(() => clients.id), // For cross-team/client chats
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Attachments, mentions, etc.
  
  // Threading support
  threadId: varchar("thread_id"), // Namespace: ${teamId}:${rootMessageId}
  inReplyTo: varchar("in_reply_to").references((): any => teamChatMessages.id), // Direct parent message
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  teamIdx: index("team_chat_messages_team_idx").on(table.teamId),
  clientIdx: index("team_chat_messages_client_idx").on(table.clientId),
  senderIdx: index("team_chat_messages_sender_idx").on(table.senderId),
  createdIdx: index("team_chat_messages_created_idx").on(table.createdAt),
  threadIdx: index("team_chat_messages_thread_idx").on(table.teamId, table.threadId),
}));

// ==================== CLIENT PORTAL TASK SYSTEM ====================

// Client Portal Tasks - Unified task system visible to clients in their portal
// Tasks can originate from: employee messages, workflow assignments, form requests, ad-hoc creation
export const clientPortalTasks = pgTable("client_portal_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  assignmentId: varchar("assignment_id").references(() => workflowAssignments.id, { onDelete: "cascade" }),
  
  // Task details
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'message_response', 'workflow_task', 'form_request', 'document_request', 'ad_hoc'
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'waiting_response', 'completed', 'cancelled'
  
  // Source tracking - what created this task?
  sourceType: text("source_type"), // 'conversation', 'workflow_task', 'form_template', 'document_request', 'manual'
  sourceId: varchar("source_id"), // ID of the source (messageId, workflowTaskId, formTemplateId, etc.)
  
  // Assignment
  assignedTo: varchar("assigned_to").references(() => contacts.id), // Which contact should handle this
  assignedBy: varchar("assigned_by").notNull().references(() => users.id), // Employee who created/assigned the task
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  // Timeline
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id), // Who marked it complete
  
  // Follow-up tracking
  requiresFollowup: boolean("requires_followup").notNull().default(false),
  lastFollowupSent: timestamp("last_followup_sent"),
  followupCount: integer("followup_count").notNull().default(0),
  
  // Additional data
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Flexible storage for task-specific data
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`), // File attachments
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  orgClientIdx: index("client_portal_tasks_org_client_idx").on(table.organizationId, table.clientId),
  assignmentIdx: index("client_portal_tasks_assignment_idx").on(table.assignmentId),
  statusIdx: index("client_portal_tasks_status_idx").on(table.status),
  dueDateIdx: index("client_portal_tasks_due_date_idx").on(table.dueDate),
}));

// Task Follow-ups - Schedule automatic reminders and follow-ups for client portal tasks
export const taskFollowups = pgTable("task_followups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => clientPortalTasks.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Follow-up configuration
  frequency: text("frequency").notNull(), // 'once', 'daily', 'every_2_days', 'weekly', 'biweekly', 'monthly'
  urgency: text("urgency").notNull().default("normal"), // 'low', 'normal', 'high', 'critical'
  
  // Scheduling
  nextRunAt: timestamp("next_run_at").notNull(), // When to send next follow-up
  lastRunAt: timestamp("last_run_at"), // When last follow-up was sent
  expiresAt: timestamp("expires_at"), // Optional: stop following up after this date
  
  // Status
  status: text("status").notNull().default("active"), // 'active', 'paused', 'completed', 'cancelled'
  runCount: integer("run_count").notNull().default(0), // How many times this follow-up has run
  maxRuns: integer("max_runs"), // Optional: max number of follow-ups to send
  
  // Notification channels
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifySMS: boolean("notify_sms").notNull().default(false),
  notifyInApp: boolean("notify_in_app").notNull().default(true),
  
  // Escalation rules
  escalateAfterRuns: integer("escalate_after_runs"), // Escalate to manager after N reminders
  escalateToUserId: varchar("escalate_to_user_id").references(() => users.id),
  escalated: boolean("escalated").notNull().default(false),
  escalatedAt: timestamp("escalated_at"),
  
  // Message customization
  customMessage: text("custom_message"), // Optional custom reminder message
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for scheduler performance
  nextRunIdx: index("task_followups_next_run_idx").on(table.nextRunAt, table.status),
  taskStatusIdx: index("task_followups_task_status_idx").on(table.taskId, table.status),
}));

// Assignment-Specific Workflow Stages - Cloned from workflow templates for per-assignment customization
export const assignmentWorkflowStages = pgTable("assignment_workflow_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => workflowAssignments.id, { onDelete: "cascade" }),
  templateStageId: varchar("template_stage_id").references(() => workflowStages.id), // Link back to original template
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'skipped'
  color: text("color").default("#6b7280"),
  
  // Auto-progression
  autoProgress: boolean("auto_progress").notNull().default(false),
  
  // Timeline
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  assignmentOrderIdx: index("assignment_stages_assignment_order_idx").on(table.assignmentId, table.order),
}));

// Assignment-Specific Workflow Steps - Cloned from workflow templates
export const assignmentWorkflowSteps = pgTable("assignment_workflow_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentStageId: varchar("assignment_stage_id").notNull().references(() => assignmentWorkflowStages.id, { onDelete: "cascade" }),
  templateStepId: varchar("template_step_id").references(() => workflowSteps.id), // Link back to original template
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'skipped'
  type: text("type").notNull().default("manual"), // 'manual', 'automated', 'approval'
  
  // Assignment
  assignedTo: varchar("assigned_to").references(() => users.id),
  
  // Auto-progression
  autoProgress: boolean("auto_progress").notNull().default(false),
  
  // Timeline
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  stageOrderIdx: index("assignment_steps_stage_order_idx").on(table.assignmentStageId, table.order),
}));

// Assignment-Specific Workflow Tasks - Cloned from workflow templates with full customization
export const assignmentWorkflowTasks = pgTable("assignment_workflow_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentStepId: varchar("assignment_step_id").notNull().references(() => assignmentWorkflowSteps.id, { onDelete: "cascade" }),
  templateTaskId: varchar("template_task_id").references(() => workflowTasks.id), // Link back to original template
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("manual"), // 'manual', 'automated'
  order: integer("order").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'skipped'
  
  // Assignment
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedToContact: varchar("assigned_to_contact").references(() => contacts.id), // For client-facing tasks
  
  // AI and automation
  aiAgentId: varchar("ai_agent_id").references(() => aiAgents.id),
  automationInput: jsonb("automation_input").default(sql`'{}'::jsonb`),
  automationOutput: jsonb("automation_output").default(sql`'{}'::jsonb`),
  
  // Priority and timeline
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  
  // Client visibility
  visibleToClient: boolean("visible_to_client").notNull().default(false),
  clientPortalTaskId: varchar("client_portal_task_id").references(() => clientPortalTasks.id), // Link to client-facing task
  
  // Auto-progression
  autoProgress: boolean("auto_progress").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  stepOrderIdx: index("assignment_tasks_step_order_idx").on(table.assignmentStepId, table.order),
  assignedToIdx: index("assignment_tasks_assigned_to_idx").on(table.assignedTo),
}));

// Tags for organizing resources
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6b7280"), // Default gray
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Polymorphic taggables junction table
export const taggables = pgTable("taggables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  taggableType: text("taggable_type").notNull(), // 'document', 'client', 'workflow', 'contact', etc.
  taggableId: varchar("taggable_id").notNull(), // ID of the tagged resource
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Form Templates - Advanced form builder for organizers and questionnaires
export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"), // 'tax', 'audit', 'onboarding', 'custom'
  
  // Template scoping: 'global' (super admin, visible to all) or 'organization' (admin, org-specific)
  scope: text("scope").notNull().default("organization"), // 'global', 'organization'
  organizationId: varchar("organization_id").references(() => organizations.id), // null for global templates, org ID for org-scoped
  createdBy: varchar("created_by").notNull().references(() => users.id),
  // Form structure
  fields: jsonb("fields").notNull().default(sql`'[]'::jsonb`), // Array of form fields
  sections: jsonb("sections").notNull().default(sql`'[]'::jsonb`), // Group fields into sections
  pages: jsonb("pages").notNull().default(sql`'[]'::jsonb`), // Multi-page forms
  // Conditional logic
  conditionalRules: jsonb("conditional_rules").notNull().default(sql`'[]'::jsonb`), // Show/hide logic
  validationRules: jsonb("validation_rules").notNull().default(sql`'[]'::jsonb`), // Custom validation
  calculatedFields: jsonb("calculated_fields").notNull().default(sql`'[]'::jsonb`), // Auto-calculated fields
  // Folder mapping for document organization
  folderStructure: jsonb("folder_structure").default(sql`'{}'::jsonb`), // Maps form sections to folder paths
  // Settings
  settings: jsonb("settings").default(sql`'{}'::jsonb`), // Notifications, confirmations, etc.
  // State
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'archived'
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  // Metadata
  lastPublishedAt: timestamp("last_published_at"),
  submissionCount: integer("submission_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Form Submissions - Store form responses
export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formTemplateId: varchar("form_template_id").notNull().references(() => formTemplates.id, { onDelete: "cascade" }),
  formVersion: integer("form_version").notNull(), // Track which version was submitted
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  submittedBy: varchar("submitted_by").references(() => users.id),
  clientId: varchar("client_id").references(() => clients.id), // Link to client if applicable
  // Submission data
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`), // Form field responses
  attachments: jsonb("attachments").notNull().default(sql`'[]'::jsonb`), // Uploaded files metadata
  // Status tracking
  status: text("status").notNull().default("submitted"), // 'submitted', 'under_review', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  // Metadata
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  orgFormIdx: index("form_submissions_org_form_idx").on(table.organizationId, table.formTemplateId),
  clientIdx: index("form_submissions_client_idx").on(table.clientId),
  statusIdx: index("form_submissions_status_idx").on(table.status),
}));

// Form Share Links - For client portal secure sharing
export const formShareLinks = pgTable("form_share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formTemplateId: varchar("form_template_id").notNull().references(() => formTemplates.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  // Share link configuration
  shareToken: varchar("share_token").notNull().unique(), // Unique token for the URL
  clientId: varchar("client_id").references(() => clients.id), // Optional: associate with specific client
  // Security settings
  password: text("password"), // Optional: bcrypt hashed password
  expiresAt: timestamp("expires_at"), // Optional: expiration date
  maxSubmissions: integer("max_submissions"), // Optional: limit number of submissions
  // Tracking
  status: text("status").notNull().default("active"), // 'active', 'expired', 'disabled'
  viewCount: integer("view_count").notNull().default(0),
  submissionCount: integer("submission_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  // Metadata
  dueDate: timestamp("due_date"), // When client should complete the form
  notes: text("notes"), // Internal notes about this share
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("form_share_links_token_idx").on(table.shareToken),
  formIdx: index("form_share_links_form_idx").on(table.formTemplateId),
  clientIdx: index("form_share_links_client_idx").on(table.clientId),
}));

// Staff notes on submissions
export const submissionNotes = pgTable("submission_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => formSubmissions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Revision requests
export const revisionRequests = pgTable("revision_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => formSubmissions.id, { onDelete: "cascade" }),
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  fieldsToRevise: jsonb("fields_to_revise").notNull(), // Array of {fieldId, notes}
  status: text("status").notNull().default("pending"), // pending, completed
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Document Requests - Track document collection from clients
export const documentRequests = pgTable("document_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // e.g., "2024 Tax Documents"
  description: text("description"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id), // Staff member responsible
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'overdue'
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"), // Internal notes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  clientIdx: index("document_requests_client_idx").on(table.clientId),
  statusIdx: index("document_requests_status_idx").on(table.status),
  orgIdx: index("document_requests_org_idx").on(table.organizationId),
}));

// Required Documents - Individual document types within a request
export const requiredDocuments = pgTable("required_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => documentRequests.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "W-2 Form", "1099-MISC"
  description: text("description"), // Instructions for the document
  category: text("category"), // e.g., "Tax Documents", "Bank Statements"
  isRequired: boolean("is_required").notNull().default(true),
  expectedQuantity: integer("expected_quantity").default(1), // How many of this document expected
  status: text("status").notNull().default("pending"), // 'pending', 'submitted', 'approved', 'rejected'
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  requestIdx: index("required_documents_request_idx").on(table.requestId),
}));

// Document Submissions - Links uploaded documents to required documents
export const documentSubmissions = pgTable("document_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requiredDocumentId: varchar("required_document_id").notNull().references(() => requiredDocuments.id, { onDelete: "cascade" }),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  status: text("status").notNull().default("pending_review"), // 'pending_review', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  requiredDocIdx: index("document_submissions_required_idx").on(table.requiredDocumentId),
  docIdx: index("document_submissions_doc_idx").on(table.documentId),
}));

// Form Builder TypeScript Types
export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "url"
  | "date"
  | "time"
  | "datetime"
  | "select"
  | "multi_select"
  | "radio"
  | "checkbox"
  | "file_upload"
  | "signature"
  | "name"          // Composite: title, first, middle, last
  | "address"       // Composite: street, city, state, zip
  | "currency"      // Number with currency symbol/type
  | "decimal"       // Number with decimal precision
  | "percentage"
  | "rating"
  | "slider"
  | "image_choice"  // Image-based single/multi selection
  | "matrix_choice" // Grid of questions with rating scale
  | "audio"         // Audio upload with recording capability
  | "video"         // Video upload with recording capability
  | "camera"        // Camera image capture
  | "unique_id"     // Auto-incremented sequential ID
  | "random_id"     // Random alphanumeric ID
  | "formula"       // Computed field based on other fields
  | "page_break"    // Multi-page form separator
  | "terms"         // Terms & Conditions checkbox
  | "calculated"
  | "heading"
  | "divider"
  | "html";

export interface FormFieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customValidation?: string; // JavaScript expression
  errorMessage?: string;
}

export interface FormFieldOption {
  label: string;
  value: string;
  icon?: string;
  imageUrl?: string; // For image_choice field type
}

export interface CompositeFieldConfig {
  // Name field sub-fields
  showTitle?: boolean;
  showMiddleName?: boolean;
  // Address field configuration
  showLine2?: boolean;
  showCountry?: boolean;
  defaultCountry?: string;
  // Currency configuration
  currencyType?: string; // 'USD', 'EUR', 'GBP', etc.
  allowNegative?: boolean;
  // Decimal configuration
  decimalPlaces?: number;
  // Image choice configuration
  allowMultiple?: boolean; // Allow multiple image selections
  imageSize?: "small" | "medium" | "large"; // Display size of images
  // Matrix choice configuration
  matrixRows?: FormFieldOption[]; // Questions/items to rate
  matrixColumns?: FormFieldOption[]; // Rating scale options
  matrixType?: "radio" | "checkbox"; // Single or multiple selections per row
  // Unique ID configuration
  idPrefix?: string; // Prefix like "INV-", "ORD-"
  idStartingNumber?: number; // Starting number (default: 1)
  idPadding?: number; // Zero padding (default: 3, e.g., 001)
  // Random ID configuration
  randomIdLength?: number; // Length of random ID (default: 8)
  randomIdCharSet?: "alphanumeric" | "alpha" | "numeric"; // Character set
  // Formula configuration
  formulaExpression?: string; // Expression to calculate (e.g., "price * quantity")
  // Terms configuration
  termsText?: string; // Full terms and conditions text
  termsLink?: string; // Link to external terms page
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  description?: string;
  helpText?: string;
  defaultValue?: any;
  // Validation
  validation?: FormFieldValidation;
  // Options for select/radio/checkbox
  options?: FormFieldOption[];
  // File upload settings
  fileTypes?: string[]; // ['pdf', 'jpg', 'png']
  maxFileSize?: number; // in MB
  maxFiles?: number;
  // Composite field configuration (Name, Address, Currency, Decimal)
  config?: CompositeFieldConfig;
  // Conditional logic
  conditionalRules?: FormConditionalRule[];
  // Layout
  width?: "full" | "half" | "third" | "quarter";
  order?: number;
  sectionId?: string;
  pageId?: string;
  // Calculated field
  calculation?: string; // JavaScript expression
  // Folder mapping
  folderPath?: string; // e.g., "Tax Returns/2024/W2"
}

export interface FormConditionalRule {
  id: string;
  condition: string; // JavaScript expression, e.g., "field_income > 100000"
  action: "show" | "hide" | "require" | "disable";
  targetFieldIds: string[];
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order?: number;
  isRepeatable?: boolean; // For repeating sections
  minRepeat?: number;
  maxRepeat?: number;
  folderPath?: string; // Auto-create folder for this section
}

export interface FormPage {
  id: string;
  title: string;
  description?: string;
  order?: number;
  sectionIds: string[];
}

export interface FormSettings {
  // Submission
  allowMultipleSubmissions?: boolean;
  requireAuth?: boolean;
  // Notifications
  sendConfirmationEmail?: boolean;
  confirmationEmailTemplate?: string;
  notifyOnSubmission?: boolean;
  notificationRecipients?: string[];
  // Workflow integration
  triggerWorkflowOnSubmit?: boolean;
  workflowId?: string;
  // Folder automation
  autoCreateFolders?: boolean;
  baseFolderPath?: string;
}

// Workflow TypeScript Types for Nodes and Edges
export type WorkflowNodeType = 
  | "trigger"
  | "condition"
  | "action"
  | "delay"
  | "notification"
  | "approval"
  | "loop"
  | "end";

export type WorkflowTriggerType =
  | "manual"
  | "schedule"
  | "document_upload"
  | "client_created"
  | "form_submitted"
  | "email_received"
  | "webhook";

export type WorkflowActionType =
  | "send_email"
  | "send_notification"
  | "create_task"
  | "update_document"
  | "run_ai_agent"
  | "http_request"
  | "create_organizer"
  | "assign_to_user";

export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  config: Record<string, any>;
  // For trigger nodes
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, any>;
  // For action nodes
  actionType?: WorkflowActionType;
  actionConfig?: Record<string, any>;
  // For condition nodes
  conditionExpression?: string;
  conditionConfig?: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  // For conditional edges
  condition?: string;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: Record<string, any>;
  // For schedule triggers
  schedule?: {
    cron?: string;
    timezone?: string;
  };
  // For event triggers
  event?: {
    resource: string;
    action: string;
  };
}

// Zod Schemas and Types
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  phoneVerifiedAt: true,
});

export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertUserMFASchema = createInsertSchema(userMFA).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastVerified: true,
});

export const insertTrustedDeviceSchema = createInsertSchema(trustedDevices).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export const insertUserOrganizationSchema = createInsertSchema(userOrganizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActiveAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  lastPublishedAt: true,
  lastExecutedAt: true,
  executionCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  organizationId: true,
  startedAt: true,
  createdAt: true,
});

// Workflow Hierarchy Zod Schemas (Stages, Steps, Tasks)
export const insertWorkflowStageSchema = createInsertSchema(workflowStages).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowTaskSchema = createInsertSchema(workflowTasks).omit({
  id: true,
  completedAt: true,
  completedBy: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSubtaskSchema = createInsertSchema(taskSubtasks).omit({
  id: true,
  completedAt: true,
  completedBy: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskChecklistSchema = createInsertSchema(taskChecklists).omit({
  id: true,
  checkedAt: true,
  checkedBy: true,
  createdAt: true,
});

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSuperAdminKeySchema = createInsertSchema(superAdminKeys).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientContactSchema = createInsertSchema(clientContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Team Management Insert Schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertSupervisorRelationshipSchema = createInsertSchema(supervisorRelationships).omit({
  id: true,
  createdAt: true,
});

export const insertTeamChatMessageSchema = createInsertSchema(teamChatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertClientOnboardingSessionSchema = createInsertSchema(clientOnboardingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertOnboardingMessageSchema = createInsertSchema(onboardingMessages).omit({
  id: true,
  createdAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaggableSchema = createInsertSchema(taggables).omit({
  id: true,
  createdAt: true,
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  lastPublishedAt: true,
  submissionCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  organizationId: true,
  submittedAt: true,
  createdAt: true,
});

export const insertFormShareLinkSchema = createInsertSchema(formShareLinks).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  viewCount: true,
  submissionCount: true,
  lastAccessedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubmissionNoteSchema = createInsertSchema(submissionNotes).omit({
  id: true,
  createdAt: true,
});

export const insertRevisionRequestSchema = createInsertSchema(revisionRequests).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentRequestSchema = createInsertSchema(documentRequests).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRequiredDocumentSchema = createInsertSchema(requiredDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSubmissionSchema = createInsertSchema(documentSubmissions).omit({
  id: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertUserMFA = z.infer<typeof insertUserMFASchema>;
export type UserMFA = typeof userMFA.$inferSelect;
export type InsertTrustedDevice = z.infer<typeof insertTrustedDeviceSchema>;
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertUserOrganization = z.infer<typeof insertUserOrganizationSchema>;
export type UserOrganization = typeof userOrganizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// Workflow Hierarchy Types (Stages, Steps, Tasks)
export type InsertWorkflowStage = z.infer<typeof insertWorkflowStageSchema>;
export type WorkflowStage = typeof workflowStages.$inferSelect;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowTask = z.infer<typeof insertWorkflowTaskSchema>;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type InsertTaskSubtask = z.infer<typeof insertTaskSubtaskSchema>;
export type TaskSubtask = typeof taskSubtasks.$inferSelect;
export type InsertTaskChecklist = z.infer<typeof insertTaskChecklistSchema>;
export type TaskChecklist = typeof taskChecklists.$inferSelect;
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;

export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertSuperAdminKey = z.infer<typeof insertSuperAdminKeySchema>;
export type SuperAdminKey = typeof superAdminKeys.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type ClientContact = typeof clientContacts.$inferSelect;
export type InsertClientOnboardingSession = z.infer<typeof insertClientOnboardingSessionSchema>;
export type ClientOnboardingSession = typeof clientOnboardingSessions.$inferSelect;
export type InsertOnboardingMessage = z.infer<typeof insertOnboardingMessageSchema>;
export type OnboardingMessage = typeof onboardingMessages.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertSupervisorRelationship = z.infer<typeof insertSupervisorRelationshipSchema>;
export type SupervisorRelationship = typeof supervisorRelationships.$inferSelect;
export type InsertTeamChatMessage = z.infer<typeof insertTeamChatMessageSchema>;
export type TeamChatMessage = typeof teamChatMessages.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTaggable = z.infer<typeof insertTaggableSchema>;
export type Taggable = typeof taggables.$inferSelect;
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormShareLink = z.infer<typeof insertFormShareLinkSchema>;
export type FormShareLink = typeof formShareLinks.$inferSelect;
export type InsertSubmissionNote = z.infer<typeof insertSubmissionNoteSchema>;
export type SubmissionNote = typeof submissionNotes.$inferSelect;
export type InsertRevisionRequest = z.infer<typeof insertRevisionRequestSchema>;
export type RevisionRequest = typeof revisionRequests.$inferSelect;
export type InsertDocumentRequest = z.infer<typeof insertDocumentRequestSchema>;
export type DocumentRequest = typeof documentRequests.$inferSelect;
export type InsertRequiredDocument = z.infer<typeof insertRequiredDocumentSchema>;
export type RequiredDocument = typeof requiredDocuments.$inferSelect;
export type InsertDocumentSubmission = z.infer<typeof insertDocumentSubmissionSchema>;
export type DocumentSubmission = typeof documentSubmissions.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type AiAgentInstallation = typeof aiAgentInstallations.$inferSelect;
export type InstalledAgentView = AiAgentInstallation & {
  agent: typeof aiAgents.$inferSelect | null;
};
export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect;

// ============================================
// TAXDOME FEATURES - Practice Management
// ============================================

// Secure Messaging System
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  clientId: varchar("client_id").references(() => clients.id),
  subject: text("subject"),
  status: text("status").notNull().default("active"), // active, archived, closed
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  senderType: text("sender_type").notNull(), // staff, client
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  attachments: jsonb("attachments").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Time Tracking & Billing
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientId: varchar("client_id").references(() => clients.id),
  projectId: varchar("project_id").references(() => workflows.id),
  description: text("description").notNull(),
  hours: numeric("hours", { precision: 10, scale: 2 }).notNull(),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  isBillable: boolean("is_billable").notNull().default(true),
  isInvoiced: boolean("is_invoiced").notNull().default(false),
  invoiceId: varchar("invoice_id"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue, cancelled
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  terms: text("terms"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  timeEntryId: varchar("time_entry_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subscription Invoices - Platform subscription billing invoices (NOT client invoices)
// IMPORTANT: Must be defined BEFORE payments table to avoid forward reference
export const subscriptionInvoices = pgTable("subscription_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  subscriptionId: varchar("subscription_id").notNull().references(() => platformSubscriptions.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  
  // Invoice details
  status: text("status").notNull().default("pending"), // pending, paid, failed, overdue, cancelled
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  
  // Pricing breakdown
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  
  // Payment details
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method"), // upi, credit_card, debit_card, netbanking
  paidAt: timestamp("paid_at"),
  
  // Dates
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  
  // Payment failure handling
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  gracePeriodEndsAt: timestamp("grace_period_ends_at"), // 2 days after due date for payment failure
  servicesDisabledAt: timestamp("services_disabled_at"),
  
  // Razorpay integration
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  
  // Invoice snapshot
  lineItems: jsonb("line_items").notNull().default(sql`'[]'::jsonb`), // Array of {description, quantity, unitPrice, amount}
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("subscription_invoices_org_idx").on(table.organizationId),
  subscriptionIdx: index("subscription_invoices_subscription_idx").on(table.subscriptionId),
  statusIdx: index("subscription_invoices_status_idx").on(table.status),
  dueDateIdx: index("subscription_invoices_due_date_idx").on(table.dueDate),
}));

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  subscriptionInvoiceId: varchar("subscription_invoice_id").references(() => subscriptionInvoices.id),
  clientId: varchar("client_id").references(() => clients.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull(), // upi, credit_card, debit_card, netbanking, card, ach, check, cash, other
  status: text("status").notNull().default("pending"), // pending, completed, failed, refunded
  stripePaymentId: text("stripe_payment_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpayOrderId: text("razorpay_order_id"),
  transactionDate: timestamp("transaction_date").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Saved Payment Methods for Auto-Sweep
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Payment method details
  type: text("type").notNull(), // credit_card, debit_card, upi, netbanking, bank_account
  nickname: text("nickname"), // User-friendly name (e.g., "Business Visa")
  isDefault: boolean("is_default").notNull().default(false),
  
  // Card details (if type is card)
  cardLast4: text("card_last4"), // Last 4 digits
  cardBrand: text("card_brand"), // visa, mastercard, amex, etc.
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  cardholderName: text("cardholder_name"),
  
  // Bank account details (if type is bank_account)
  bankName: text("bank_name"),
  accountLast4: text("account_last4"),
  accountHolderName: text("account_holder_name"),
  
  // UPI details (if type is upi)
  upiId: text("upi_id"), // Masked UPI ID
  
  // Payment gateway tokens
  razorpayTokenId: text("razorpay_token_id"), // Razorpay token for recurring payments
  razorpayCustomerId: text("razorpay_customer_id"), // Razorpay customer ID
  stripePaymentMethodId: text("stripe_payment_method_id"), // Stripe payment method ID
  
  // Metadata
  status: text("status").notNull().default("active"), // active, expired, failed
  lastUsedAt: timestamp("last_used_at"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // EFFICIENCY: Indexes for fast payment method queries
  orgIdx: index("payment_methods_org_idx").on(table.organizationId),
  defaultIdx: index("payment_methods_default_idx").on(table.isDefault),
  statusIdx: index("payment_methods_status_idx").on(table.status),
  typeIdx: index("payment_methods_type_idx").on(table.type),
  // Composite index for fast default payment method lookup per organization
  orgDefaultIdx: index("payment_methods_org_default_idx").on(table.organizationId, table.isDefault),
}));

// E-Signatures
export const signatureRequests = pgTable("signature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  documentId: varchar("document_id").references(() => documents.id),
  clientId: varchar("client_id").references(() => clients.id),
  title: text("title").notNull(),
  message: text("message"),
  status: text("status").notNull().default("pending"), // pending, signed, declined, expired
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  signedBy: varchar("signed_by").references(() => users.id),
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  signatureData: text("signature_data"), // Base64 encoded signature image
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Projects (Kanban)
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  clientId: varchar("client_id").references(() => clients.id),
  status: text("status").notNull().default("active"), // active, on_hold, completed, cancelled
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  ownerId: varchar("owner_id").references(() => users.id),
  budget: numeric("budget", { precision: 10, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 10, scale: 2 }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo, in_progress, review, completed
  priority: text("priority").notNull().default("medium"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  position: integer("position").notNull().default(0), // For drag-drop ordering
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 10, scale: 2 }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project-Workflow Junction - Projects are combinations of 2+ workflows
export const projectWorkflows = pgTable("project_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0), // Display order within project
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  projectWorkflowIdx: index("project_workflows_project_idx").on(table.projectId),
  uniqueProjectWorkflow: unique().on(table.projectId, table.workflowId),
}));

// Team Chat
export const chatChannels = pgTable("chat_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("group"), // direct, group, project
  projectId: varchar("project_id").references(() => projects.id),
  isPrivate: boolean("is_private").notNull().default(false),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatMembers = pgTable("chat_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // admin, member
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  mentions: jsonb("mentions").notNull().default(sql`'[]'::jsonb`), // Array of user IDs
  attachments: jsonb("attachments").notNull().default(sql`'[]'::jsonb`),
  isEdited: boolean("is_edited").notNull().default(false),
  editedAt: timestamp("edited_at"),
  parentMessageId: varchar("parent_message_id"), // For threading
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// WebRTC Call Logs
export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  channelId: varchar("channel_id").references(() => chatChannels.id, { onDelete: "set null" }),
  callerId: varchar("caller_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  callType: text("call_type").notNull(), // 'audio' or 'video'
  status: text("status").notNull(), // 'completed', 'missed', 'rejected', 'failed'
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // Duration in seconds
  quality: jsonb("quality"), // Connection quality metrics { iceConnectionState, avgRtt, packetsLost }
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index("call_logs_organization_idx").on(table.organizationId),
  callerIdx: index("call_logs_caller_idx").on(table.callerId),
  receiverIdx: index("call_logs_receiver_idx").on(table.receiverId),
  channelIdx: index("call_logs_channel_idx").on(table.channelId),
}));

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});

// AI Agent Sessions (for Parity, Cadence, Forma)
export const agentSessions = pgTable("agent_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentSlug: text("agent_slug").notNull(), // 'parity', 'cadence', 'forma'
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // User-editable session name
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userAgentIdx: index("agent_sessions_user_agent_idx").on(table.userId, table.agentSlug),
}));

export const agentMessages = pgTable("agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // For storing artifacts, file refs, etc
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("agent_messages_session_idx").on(table.sessionId),
}));

// ==================== CALENDAR SYSTEM ====================

// Events - Unified calendar events (meetings, tasks, PTO, block time)
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Event details
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("meeting"), // 'meeting', 'task', 'pto', 'block_time', 'reminder'
  
  // Scheduling
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  timezone: text("timezone").notNull().default("UTC"),
  
  // Location & conferencing
  location: text("location"),
  meetingUrl: text("meeting_url"),
  meetingProvider: text("meeting_provider"), // 'zoom', 'teams', 'google_meet', 'manual'
  meetingProviderId: text("meeting_provider_id"), // External meeting ID
  
  // Relations
  clientId: varchar("client_id").references(() => clients.id),
  projectId: varchar("project_id").references(() => projects.id),
  workflowTaskId: varchar("workflow_task_id").references(() => workflowTasks.id), // Link to task deadlines
  
  // Organizer and primary assignee
  organizerId: varchar("organizer_id").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id), // Primary responsible person
  
  // Status
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'in_progress'
  
  // Recurring events
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceRule: text("recurrence_rule"), // RRULE format (RFC 5545)
  recurrenceParentId: varchar("recurrence_parent_id"), // Links recurring instances to parent
  recurrenceException: boolean("recurrence_exception").notNull().default(false), // Is this an exception to recurring series?
  
  // Reminders
  reminderMinutes: integer("reminder_minutes").array().default(sql`ARRAY[15]::integer[]`), // [15, 60, 1440] = 15min, 1hr, 1day before
  lastReminderSent: timestamp("last_reminder_sent"),
  
  // Additional metadata
  color: text("color"), // Hex color for calendar display
  notes: text("notes"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgTimeIdx: index("events_org_time_idx").on(table.organizationId, table.startTime),
  typeStatusIdx: index("events_type_status_idx").on(table.type, table.status),
  assignedIdx: index("events_assigned_idx").on(table.assignedTo),
  recurringIdx: index("events_recurring_idx").on(table.isRecurring, table.recurrenceParentId),
}));

// Event Attendees - Multi-user participation with RSVP
export const eventAttendees = pgTable("event_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Null for external attendees
  email: text("email"), // For external attendees
  name: text("name"), // For external attendees
  
  // RSVP status
  rsvpStatus: text("rsvp_status").notNull().default("pending"), // 'pending', 'accepted', 'declined', 'tentative'
  rsvpAt: timestamp("rsvp_at"),
  
  // Role
  isOptional: boolean("is_optional").notNull().default(false),
  isOrganizer: boolean("is_organizer").notNull().default(false),
  
  // Notifications
  reminderSent: boolean("reminder_sent").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  eventUserIdx: index("event_attendees_event_user_idx").on(table.eventId, table.userId),
  userRsvpIdx: index("event_attendees_user_rsvp_idx").on(table.userId, table.rsvpStatus),
}));

// Time Off Requests - PTO, vacation, sick leave tracking
export const timeOffRequests = pgTable("time_off_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Request details
  type: text("type").notNull(), // 'vacation', 'sick', 'personal', 'unpaid', 'other'
  reason: text("reason"),
  
  // Dates
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isHalfDay: boolean("is_half_day").notNull().default(false),
  halfDayPeriod: text("half_day_period"), // 'morning', 'afternoon'
  totalDays: numeric("total_days", { precision: 5, scale: 2 }).notNull(), // Calculated based on date range
  
  // Approval workflow
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'denied', 'cancelled'
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  denialReason: text("denial_reason"),
  
  // Calendar event link (auto-created when approved)
  eventId: varchar("event_id").references(() => events.id),
  
  // Notifications
  notifyTeam: boolean("notify_team").notNull().default(true), // Send team notification when approved
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgUserIdx: index("time_off_requests_org_user_idx").on(table.organizationId, table.userId),
  statusIdx: index("time_off_requests_status_idx").on(table.status),
  dateRangeIdx: index("time_off_requests_date_range_idx").on(table.startDate, table.endDate),
}));

// Legacy appointments table (deprecated - migrate to events)
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  title: text("title").notNull(),
  description: text("description"),
  clientId: varchar("client_id").references(() => clients.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  meetingUrl: text("meeting_url"),
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, cancelled, completed, no_show
  reminderSent: boolean("reminder_sent").notNull().default(false),
  notes: text("notes"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email Templates
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // welcome, reminder, invoice, signature_request, custom
  
  // Template scoping: 'global' (super admin, visible to all) or 'organization' (admin, org-specific)
  scope: text("scope").notNull().default("organization"), // 'global', 'organization'
  organizationId: varchar("organization_id").references(() => organizations.id), // null for global templates, org ID for org-scoped
  
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML content with merge fields {{client_name}}, {{portal_link}}, etc.
  variables: jsonb("variables").notNull().default(sql`'[]'::jsonb`), // Available merge fields
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false), // System-provided templates
  // Branding customization
  logoUrl: text("logo_url"), // Firm logo for email header/footer
  footerText: text("footer_text"), // Custom footer text
  socialLinks: jsonb("social_links").default(sql`'{}'::jsonb`), // {facebook: "url", linkedin: "url", twitter: "url"}
  brandingColors: jsonb("branding_colors").default(sql`'{}'::jsonb`), // {primary: "#hex", secondary: "#hex"}
  // Usage tracking
  usageCount: integer("usage_count").notNull().default(0),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Additional settings (attachments, etc.)
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgCategoryIdx: index("email_templates_org_category_idx").on(table.organizationId, table.category),
}));

// Message Templates - Quick message templates for client communication
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // follow_up, status_update, request_info, greeting, custom
  
  // Template scoping: 'global' (super admin, visible to all) or 'organization' (admin, org-specific)
  scope: text("scope").notNull().default("organization"), // 'global', 'organization'
  organizationId: varchar("organization_id").references(() => organizations.id), // null for global templates, org ID for org-scoped
  
  content: text("content").notNull(), // Message content with merge fields {{client_name}}, {{firm_name}}, etc.
  variables: jsonb("variables").notNull().default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  usageCount: integer("usage_count").notNull().default(0),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgCategoryIdx: index("message_templates_org_category_idx").on(table.organizationId, table.category),
}));

// PDF Annotations
export const documentAnnotations = pgTable("document_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // comment, highlight, drawing, text
  pageNumber: integer("page_number").notNull(),
  position: jsonb("position").notNull(), // {x, y, width, height}
  content: text("content"), // For comments or text annotations
  color: text("color").notNull().default("#FFD700"),
  mentions: jsonb("mentions").notNull().default(sql`'[]'::jsonb`), // Tagged users
  resolved: boolean("resolved").notNull().default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Expenses (for time tracking)
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientId: varchar("client_id").references(() => clients.id),
  projectId: varchar("project_id").references(() => projects.id),
  category: text("category").notNull(), // travel, meals, supplies, software, other
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  isBillable: boolean("is_billable").notNull().default(true),
  isInvoiced: boolean("is_invoiced").notNull().default(false),
  invoiceId: varchar("invoice_id"),
  receipt: text("receipt"), // File path/URL to receipt
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Marketplace Items - Templates for documents, forms, and workflows that can be purchased/installed
export const marketplaceItems = pgTable("marketplace_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'document_template', 'form_template', 'pipeline_template'
  type: text("type").notNull(), // Specific type within category (e.g., 'engagement_letter', '1120_filing', etc.)
  
  // Pricing
  pricingModel: text("pricing_model").notNull().default("free"), // 'free', 'one_time', 'subscription'
  price: numeric("price", { precision: 10, scale: 2 }).default(sql`0`), // One-time or monthly price
  priceYearly: numeric("price_yearly", { precision: 10, scale: 2 }), // Optional yearly price for subscriptions
  
  // Content - stores the actual template data (optional until linked to source template)
  content: jsonb("content").default(sql`'{}'::jsonb`), // Template structure varies by category
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Additional configuration
  
  // Source template linking
  sourceId: varchar("source_id"), // ID of the source template (documentId, formId, workflowId, emailTemplateId, messageTemplateId)
  sourceType: text("source_type"), // 'document', 'form', 'workflow', 'email_template', 'message_template'
  
  // Marketplace metadata
  createdBy: varchar("created_by").references(() => users.id), // Super admin who created it
  organizationId: varchar("organization_id").references(() => organizations.id), // null = system-wide (created by super admin)
  isPublic: boolean("is_public").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  installCount: integer("install_count").notNull().default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }).default(sql`0`), // 0.00 to 5.00
  reviewCount: integer("review_count").notNull().default(0),
  
  // Status
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'archived'
  publishedAt: timestamp("published_at"),
  
  // Tags for filtering
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  orgCategoryIdx: index("marketplace_items_org_category_idx").on(table.organizationId, table.category),
  categoryStatusIdx: index("marketplace_items_category_status_idx").on(table.category, table.status),
  statusPublicIdx: index("marketplace_items_status_public_idx").on(table.status, table.isPublic),
}));

// Marketplace Installations - Track which organizations have installed which items
export const marketplaceInstallations = pgTable("marketplace_installations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull().references(() => marketplaceItems.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  installedBy: varchar("installed_by").notNull().references(() => users.id),
  
  // Billing information (if paid item)
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
  transactionId: text("transaction_id"), // Reference to payment/transaction
  subscriptionStatus: text("subscription_status"), // 'active', 'cancelled', 'expired' (for subscription items)
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  
  isActive: boolean("is_active").notNull().default(true),
  installedAt: timestamp("installed_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  itemOrgIdx: index("marketplace_installations_item_org_idx").on(table.itemId, table.organizationId),
  orgActiveIdx: index("marketplace_installations_org_active_idx").on(table.organizationId, table.isActive),
}));

// ==================== AI AGENT FOUNDRY ====================
// Organization-level agent enablement (which orgs have which agents enabled)
export const organizationAgents = pgTable("organization_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id, { onDelete: "cascade" }),
  
  // Status and configuration
  status: text("status").notNull().default("enabled"), // 'enabled', 'disabled', 'suspended'
  config: text("config"), // JSON string for agent-specific configuration
  
  // Tracking
  enabledAt: timestamp("enabled_at").notNull().defaultNow(),
  disabledAt: timestamp("disabled_at"),
  grantedBy: varchar("granted_by").notNull().references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgAgentIdx: index("organization_agents_org_agent_idx").on(table.organizationId, table.agentId),
  statusIdx: index("organization_agents_status_idx").on(table.status),
  uniqueOrgAgent: index("organization_agents_unique_idx").on(table.organizationId, table.agentId),
}));

// User-level agent access control (which specific users can access which agents)
export const userAgentAccess = pgTable("user_agent_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Access level
  accessLevel: text("access_level").notNull().default("use"), // 'use', 'manage'
  
  // Tracking
  grantedBy: varchar("granted_by").notNull().references(() => users.id),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userAgentIdx: index("user_agent_access_user_agent_idx").on(table.userId, table.agentId),
  orgIdx: index("user_agent_access_org_idx").on(table.organizationId),
  uniqueUserAgent: index("user_agent_access_unique_idx").on(table.userId, table.agentId, table.organizationId),
}));

// Recurring Schedules - Auto-create assignments on schedule (daily, weekly, monthly, etc.)
export const recurringSchedules = pgTable("recurring_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  
  // Schedule configuration
  frequency: text("frequency").notNull(), // 'daily', 'weekly', 'monthly', 'quarterly', 'annually'
  interval: integer("interval").notNull().default(1), // Every N days/weeks/months/etc
  dayOfWeek: integer("day_of_week"), // 0-6 for weekly (0 = Sunday)
  dayOfMonth: integer("day_of_month"), // 1-31 for monthly
  monthOfYear: integer("month_of_year"), // 1-12 for annually
  timeOfDay: text("time_of_day").default("09:00:00"), // What time to create assignments
  
  // Assignment template
  assignmentTemplate: jsonb("assignment_template").notNull().default(sql`'{}'::jsonb`), // Default values for created assignments
  
  // Active period
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"), // NULL means indefinite
  
  // Status and tracking
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at").notNull(),
  runCount: integer("run_count").notNull().default(0),
  
  // Metadata
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("recurring_schedules_org_idx").on(table.organizationId),
  workflowIdx: index("recurring_schedules_workflow_idx").on(table.workflowId),
  nextRunIdx: index("recurring_schedules_next_run_idx").on(table.nextRunAt),
  activeIdx: index("recurring_schedules_active_idx").on(table.isActive),
}));

// Workflow Assignments - When a client is added to a workflow, it becomes an "assignment"
// Example: Acme Corporation + 1120 Filing Workflow = Assignment
export const workflowAssignments = pgTable("workflow_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Assignment metadata
  name: text("name").notNull(), // e.g., "Acme Corporation - 1120 Filing 2024"
  description: text("description"),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id), // Primary employee responsible
  
  // Status tracking
  status: text("status").notNull().default("not_started"), // 'not_started', 'in_progress', 'waiting_client', 'review', 'completed', 'cancelled'
  currentStageId: varchar("current_stage_id").references(() => workflowStages.id),
  currentStepId: varchar("current_step_id").references(() => workflowSteps.id),
  currentTaskId: varchar("current_task_id").references(() => workflowTasks.id),
  
  // Progress tracking
  progress: integer("progress").notNull().default(0), // 0-100 percentage
  completedStages: integer("completed_stages").notNull().default(0),
  totalStages: integer("total_stages").notNull().default(0),
  
  // Due dates and timeline
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Client point of contact (POC)
  clientContactId: varchar("client_contact_id").references(() => contacts.id),
  
  // Additional metadata
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  orgClientIdx: index("workflow_assignments_org_client_idx").on(table.organizationId, table.clientId),
  workflowStatusIdx: index("workflow_assignments_workflow_status_idx").on(table.workflowId, table.status),
}));

// Folders - Hierarchical folder structure for organizing documents, forms, workflows
export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  parentId: varchar("parent_id").references((): any => folders.id), // Self-referencing for hierarchy
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // What type of content does this folder contain?
  contentType: text("content_type").notNull(), // 'documents', 'forms', 'workflows', 'clients', 'mixed'
  
  // Permissions and access
  createdBy: varchar("created_by").notNull().references(() => users.id),
  sharedWith: jsonb("shared_with").default(sql`'[]'::jsonb`), // Array of user IDs who have access
  
  // Metadata
  color: text("color"), // Optional color for visual organization
  icon: text("icon"), // Optional icon name
  description: text("description"),
  isArchived: boolean("is_archived").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  parentOrgIdx: index("folders_parent_org_idx").on(table.parentId, table.organizationId),
  orgTypeIdx: index("folders_org_type_idx").on(table.organizationId, table.contentType),
  orgArchivedIdx: index("folders_org_archived_idx").on(table.organizationId, table.isArchived),
}));

// Support Tickets - Customer support and help desk system
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Ticket details
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: text("status").notNull().default("open"), // 'open', 'in_progress', 'waiting_response', 'resolved', 'closed'
  category: text("category").notNull(), // 'accounting', 'taxation', 'finance', 'technical', 'billing', 'other'
  
  // User relationships
  createdBy: varchar("created_by").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  
  // Context linking - What is this ticket about?
  contextType: text("context_type"), // 'workflow', 'client', 'document', 'form', null
  contextId: varchar("context_id"), // ID of the related resource
  
  // Resolution tracking
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolution: text("resolution"),
  
  // Metadata
  tags: jsonb("tags").default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  orgStatusIdx: index("support_tickets_org_status_idx").on(table.organizationId, table.status),
  orgPriorityIdx: index("support_tickets_org_priority_idx").on(table.organizationId, table.priority),
  assignedIdx: index("support_tickets_assigned_idx").on(table.assignedTo),
  createdByIdx: index("support_tickets_created_by_idx").on(table.createdBy),
}));

// Support Ticket Comments - Thread of messages for a ticket
export const supportTicketComments = pgTable("support_ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  
  // Comment details
  content: text("content").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  // Metadata
  isInternal: boolean("is_internal").notNull().default(false), // Internal notes vs customer-facing
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  ticketIdx: index("support_ticket_comments_ticket_idx").on(table.ticketId),
}));

// Live Chat Conversations - Priority support chat sessions (Edge subscription only)
export const liveChatConversations = pgTable("live_chat_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Conversation details
  subject: text("subject"),
  status: text("status").notNull().default("active"), // 'active', 'waiting', 'resolved', 'closed'
  priority: text("priority").notNull().default("normal"), // 'low', 'normal', 'high', 'urgent'
  
  // Agent assignment
  assignedAgentId: varchar("assigned_agent_id").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  
  // Timestamps
  startedAt: timestamp("started_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  
  // Metrics
  firstResponseTime: integer("first_response_time"), // seconds until first agent response
  avgResponseTime: integer("avg_response_time"), // average agent response time
  messageCount: integer("message_count").notNull().default(0),
  
  // Metadata
  tags: jsonb("tags").default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("live_chat_conversations_org_idx").on(table.organizationId),
  userIdx: index("live_chat_conversations_user_idx").on(table.userId),
  statusIdx: index("live_chat_conversations_status_idx").on(table.status),
  agentIdx: index("live_chat_conversations_agent_idx").on(table.assignedAgentId),
  lastMessageIdx: index("live_chat_conversations_last_message_idx").on(table.lastMessageAt),
}));

// Live Chat Messages - Messages in chat conversations
export const liveChatMessages = pgTable("live_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => liveChatConversations.id, { onDelete: "cascade" }),
  
  // Message details
  content: text("content").notNull(),
  senderType: text("sender_type").notNull(), // 'user', 'agent', 'system'
  senderId: varchar("sender_id").notNull().references(() => users.id),
  
  // Metadata
  isInternal: boolean("is_internal").notNull().default(false), // Internal agent notes
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`),
  
  // Threading support (scoped within conversation)
  threadId: varchar("thread_id"), // Thread within this conversation
  inReplyTo: varchar("in_reply_to").references((): any => liveChatMessages.id), // Direct parent message
  
  // Read tracking
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index("live_chat_messages_conversation_idx").on(table.conversationId),
  senderIdx: index("live_chat_messages_sender_idx").on(table.senderId),
  createdIdx: index("live_chat_messages_created_idx").on(table.createdAt),
  threadIdx: index("live_chat_messages_thread_idx").on(table.conversationId, table.threadId),
}));

// Agent Availability - Track support agent online status for live chat
export const agentAvailability = pgTable("agent_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  
  // Status
  status: text("status").notNull().default("offline"), // 'online', 'away', 'busy', 'offline'
  statusMessage: text("status_message"),
  
  // Capacity management
  maxConcurrentChats: integer("max_concurrent_chats").notNull().default(3),
  currentChatCount: integer("current_chat_count").notNull().default(0),
  isAcceptingChats: boolean("is_accepting_chats").notNull().default(true),
  
  // Timestamps
  lastOnlineAt: timestamp("last_online_at"),
  lastActivityAt: timestamp("last_activity_at"),
  
  // Auto-away settings
  autoAwayMinutes: integer("auto_away_minutes").default(10),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("agent_availability_status_idx").on(table.status),
  acceptingIdx: index("agent_availability_accepting_idx").on(table.isAcceptingChats),
}));

// Email Accounts - For inbox integration (OAuth/IMAP)
export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Account details
  provider: text("provider").notNull(), // 'gmail', 'outlook', 'imap', 'exchange'
  email: text("email").notNull(),
  displayName: text("display_name"),
  
  // Authentication - encrypted credentials
  authType: text("auth_type").notNull(), // 'oauth', 'password'
  encryptedCredentials: text("encrypted_credentials").notNull(), // Encrypted OAuth tokens or IMAP password
  
  // IMAP/SMTP Configuration (for non-OAuth providers)
  imapHost: text("imap_host"),
  imapPort: integer("imap_port"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  useSsl: boolean("use_ssl").default(true),
  
  // Sync status
  status: text("status").notNull().default("active"), // 'active', 'error', 'disconnected'
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  syncInterval: integer("sync_interval").default(300000), // milliseconds (default 5 min)
  
  // Settings
  autoCreateTasks: boolean("auto_create_tasks").default(false), // Enable AI email processor
  defaultWorkflowId: varchar("default_workflow_id").references(() => workflows.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("email_accounts_org_idx").on(table.organizationId),
  userIdx: index("email_accounts_user_idx").on(table.userId),
  statusIdx: index("email_accounts_status_idx").on(table.status),
}));

// Email Messages - Fetched emails from inbox
export const emailMessages = pgTable("email_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailAccountId: varchar("email_account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Email metadata
  messageId: text("message_id").notNull(), // RFC Message-ID from headers (canonical)
  providerMessageId: text("provider_message_id").notNull(), // Provider's resource ID (Gmail msg.id, Outlook id)
  threadId: text("thread_id"), // For threading conversations (namespaced)
  
  // Email details
  from: text("from").notNull(),
  to: text("to").array().notNull(),
  cc: text("cc").array(),
  bcc: text("bcc").array(),
  replyTo: text("reply_to"),
  subject: text("subject").notNull(),
  normalizedSubject: text("normalized_subject"), // For threading: subject without Re:, Fwd:, etc.
  body: text("body").notNull(),
  bodyHtml: text("body_html"),
  
  // Timestamps
  sentAt: timestamp("sent_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  
  // Flags and status
  isRead: boolean("is_read").default(false),
  isStarred: boolean("is_starred").default(false),
  hasAttachments: boolean("has_attachments").default(false),
  labels: text("labels").array(),
  
  // AI Processing
  aiProcessed: boolean("ai_processed").default(false),
  aiProcessedAt: timestamp("ai_processed_at"),
  aiExtractedData: jsonb("ai_extracted_data").default(sql`'{}'::jsonb`),
  createdTaskId: varchar("created_task_id").references(() => workflowTasks.id),
  
  // Attachments metadata
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`),
  
  // Metadata
  rawHeaders: jsonb("raw_headers").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  accountIdx: index("email_messages_account_idx").on(table.emailAccountId),
  orgIdx: index("email_messages_org_idx").on(table.organizationId),
  messageIdIdx: index("email_messages_message_id_idx").on(table.messageId),
  threadIdx: index("email_messages_thread_idx").on(table.threadId),
  processedIdx: index("email_messages_processed_idx").on(table.aiProcessed),
  // Composite indexes for threading performance
  threadSortIdx: index("email_messages_thread_sort_idx").on(table.organizationId, table.threadId, table.sentAt),
  subjectLookupIdx: index("email_messages_subject_lookup_idx").on(table.organizationId, table.emailAccountId, table.normalizedSubject),
}));

// ==================== 21-Day Onboarding System ====================

// Onboarding Progress - Tracks user's journey through the 21-day onboarding
export const onboardingProgress = pgTable("onboarding_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  // Progress tracking
  currentDay: integer("current_day").notNull().default(1), // 1-21
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  
  // Gamification
  totalScore: integer("total_score").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0), // Consecutive login days
  longestStreak: integer("longest_streak").notNull().default(0),
  
  // Regional customization
  region: text("region").default("USA"), // 'USA', 'UAE', 'India'
  
  // Completed steps (JSONB array of step IDs)
  completedSteps: text("completed_steps").array().default(sql`ARRAY[]::text[]`),
  
  // Unlocked features (JSONB array of feature IDs)
  unlockedFeatures: text("unlocked_features").array().default(sql`ARRAY[]::text[]`),
  
  // Earned badges/milestones
  badges: jsonb("badges").default(sql`'[]'::jsonb`), // [{badgeId, earnedAt, title}]
  
  // Activity tracking
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at").notNull().defaultNow(),
  loginDates: text("login_dates").array().default(sql`ARRAY[]::text[]`), // ISO dates for streak calculation
  
  // User preferences
  skipWalkthroughs: boolean("skip_walkthroughs").notNull().default(false),
  enableNudges: boolean("enable_nudges").notNull().default(true),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("onboarding_progress_user_idx").on(table.userId),
  orgIdx: index("onboarding_progress_org_idx").on(table.organizationId),
  dayIdx: index("onboarding_progress_day_idx").on(table.currentDay),
  streakIdx: index("onboarding_progress_streak_idx").on(table.currentStreak),
}));

// Onboarding Tasks - Granular tracking of individual tasks within each day
export const onboardingTasks = pgTable("onboarding_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  progressId: varchar("progress_id").notNull().references(() => onboardingProgress.id, { onDelete: "cascade" }),
  
  // Task details
  day: integer("day").notNull(), // 1-21
  taskId: text("task_id").notNull(), // e.g., 'day1_profile_setup', 'day2_add_client'
  taskType: text("task_type").notNull(), // 'profile', 'client', 'invoice', 'expense', etc.
  title: text("title").notNull(),
  description: text("description"),
  
  // Completion tracking
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  
  // Task metadata
  requiredForDay: boolean("required_for_day").notNull().default(true), // Required vs optional
  points: integer("points").notNull().default(10), // Points awarded on completion
  
  // Related entities (track which client, invoice, etc. was created)
  relatedEntityType: text("related_entity_type"), // 'client', 'invoice', 'task', etc.
  relatedEntityId: varchar("related_entity_id"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  progressIdx: index("onboarding_tasks_progress_idx").on(table.progressId),
  dayIdx: index("onboarding_tasks_day_idx").on(table.day),
  completedIdx: index("onboarding_tasks_completed_idx").on(table.isCompleted),
  taskTypeIdx: index("onboarding_tasks_type_idx").on(table.taskType),
}));

// Onboarding Nudges - Tracks shown/dismissed contextual nudges
export const onboardingNudges = pgTable("onboarding_nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  progressId: varchar("progress_id").notNull().references(() => onboardingProgress.id, { onDelete: "cascade" }),
  
  // Nudge details
  nudgeId: text("nudge_id").notNull(), // e.g., 'add_first_client_tooltip'
  nudgeType: text("nudge_type").notNull(), // 'tooltip', 'modal', 'banner', 'highlight'
  title: text("title"),
  message: text("message").notNull(),
  
  // Display tracking
  timesShown: integer("times_shown").notNull().default(1),
  maxShowCount: integer("max_show_count").default(3), // Max times to show before auto-dismissing
  
  // User interaction
  isDismissed: boolean("is_dismissed").notNull().default(false),
  dismissedAt: timestamp("dismissed_at"),
  actionTaken: boolean("action_taken").notNull().default(false), // Did user complete the suggested action?
  
  // Timing
  lastShownAt: timestamp("last_shown_at").notNull().defaultNow(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  progressIdx: index("onboarding_nudges_progress_idx").on(table.progressId),
  nudgeIdIdx: index("onboarding_nudges_nudge_id_idx").on(table.nudgeId),
  dismissedIdx: index("onboarding_nudges_dismissed_idx").on(table.isDismissed),
}));

// Zod Schemas and Types
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true });
export const insertSubscriptionInvoiceSchema = createInsertSchema(subscriptionInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSignatureRequestSchema = createInsertSchema(signatureRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectTaskSchema = createInsertSchema(projectTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectWorkflowSchema = createInsertSchema(projectWorkflows).omit({ id: true, createdAt: true });
export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMemberSchema = createInsertSchema(chatMembers).omit({ id: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertAgentSessionSchema = createInsertSchema(agentSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAgentMessageSchema = createInsertSchema(agentMessages).omit({ id: true, createdAt: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentAnnotationSchema = createInsertSchema(documentAnnotations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLlmConfigurationSchema = createInsertSchema(llmConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiAgentConversationSchema = createInsertSchema(aiAgentConversations).omit({ id: true, createdAt: true, updatedAt: true, lastMessageAt: true });
export const insertAiAgentMessageSchema = createInsertSchema(aiAgentMessages).omit({ id: true, createdAt: true });
export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMarketplaceInstallationSchema = createInsertSchema(marketplaceInstallations).omit({ id: true, installedAt: true, updatedAt: true });
export const insertOrganizationAgentSchema = createInsertSchema(organizationAgents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserAgentAccessSchema = createInsertSchema(userAgentAccess).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkflowAssignmentSchema = createInsertSchema(workflowAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportTicketCommentSchema = createInsertSchema(supportTicketComments).omit({ id: true, createdAt: true });
export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({ id: true, createdAt: true });
export const insertClientPortalTaskSchema = createInsertSchema(clientPortalTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskFollowupSchema = createInsertSchema(taskFollowups).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssignmentWorkflowStageSchema = createInsertSchema(assignmentWorkflowStages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssignmentWorkflowStepSchema = createInsertSchema(assignmentWorkflowSteps).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssignmentWorkflowTaskSchema = createInsertSchema(assignmentWorkflowTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlatformSubscriptionSchema = createInsertSchema(platformSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLucaChatSessionSchema = createInsertSchema(lucaChatSessions).omit({ id: true, createdAt: true, updatedAt: true, lastMessageAt: true });
export const insertLucaChatMessageSchema = createInsertSchema(lucaChatMessages).omit({ id: true, createdAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPricingRegionSchema = createInsertSchema(pricingRegions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanVolumeTierSchema = createInsertSchema(planVolumeTiers).omit({ id: true, createdAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCouponRedemptionSchema = createInsertSchema(couponRedemptions).omit({ id: true, redeemedAt: true });
export const insertSubscriptionEventSchema = createInsertSchema(subscriptionEvents).omit({ id: true, createdAt: true });
export const insertProductFamilySchema = createInsertSchema(productFamilies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanSKUSchema = createInsertSchema(planSKUs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanAddonSchema = createInsertSchema(planAddons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionAddonSchema = createInsertSchema(subscriptionAddons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentGatewayConfigSchema = createInsertSchema(paymentGatewayConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServicePlanSchema = createInsertSchema(servicePlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServicePlanPurchaseSchema = createInsertSchema(servicePlanPurchases).omit({ id: true, createdAt: true, updatedAt: true });
// Line item schema for proposals
export const proposalLineItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  rate: z.number().nonnegative("Rate must be non-negative"),
  amount: z.number().nonnegative("Amount must be non-negative"),
  taxable: z.boolean().default(true),
});

export const insertProposalSchema = createInsertSchema(proposals).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  proposalNumber: true, // Auto-generated
  status: true, // Defaults to 'draft'
  viewedAt: true,
  viewCount: true,
  acceptedAt: true,
  rejectedAt: true,
  signedBy: true,
  signatureUrl: true,
  pdfUrl: true,
  pdfGeneratedAt: true,
  sentAt: true,
  sentBy: true,
  reminderSentAt: true,
  reminderCount: true,
  convertedToProjectId: true,
  convertedToInvoiceId: true,
}).extend({
  lineItems: z.array(proposalLineItemSchema).default([]),
  validUntil: z.coerce.date(), // Ensure date conversion
});
export const insertOnboardingProgressSchema = createInsertSchema(onboardingProgress).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOnboardingTaskSchema = createInsertSchema(onboardingTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOnboardingNudgeSchema = createInsertSchema(onboardingNudges).omit({ id: true, createdAt: true });

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertSubscriptionInvoice = z.infer<typeof insertSubscriptionInvoiceSchema>;
export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertSignatureRequest = z.infer<typeof insertSignatureRequestSchema>;
export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type InsertProjectWorkflow = z.infer<typeof insertProjectWorkflowSchema>;
export type ProjectWorkflow = typeof projectWorkflows.$inferSelect;
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannels.$inferSelect;
export type InsertChatMember = z.infer<typeof insertChatMemberSchema>;
export type ChatMember = typeof chatMembers.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;
export type AgentSession = typeof agentSessions.$inferSelect;
export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertDocumentAnnotation = z.infer<typeof insertDocumentAnnotationSchema>;
export type DocumentAnnotation = typeof documentAnnotations.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertLlmConfiguration = z.infer<typeof insertLlmConfigurationSchema>;
export type LlmConfiguration = typeof llmConfigurations.$inferSelect;
export type InsertAiAgentConversation = z.infer<typeof insertAiAgentConversationSchema>;
export type AiAgentConversation = typeof aiAgentConversations.$inferSelect;
export type InsertAiAgentMessage = z.infer<typeof insertAiAgentMessageSchema>;
export type AiAgentMessage = typeof aiAgentMessages.$inferSelect;
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;
export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type InsertMarketplaceInstallation = z.infer<typeof insertMarketplaceInstallationSchema>;
export type MarketplaceInstallation = typeof marketplaceInstallations.$inferSelect;
export type InsertOrganizationAgent = z.infer<typeof insertOrganizationAgentSchema>;
export type OrganizationAgent = typeof organizationAgents.$inferSelect;
export type InsertUserAgentAccess = z.infer<typeof insertUserAgentAccessSchema>;
export type UserAgentAccess = typeof userAgentAccess.$inferSelect;
export type InsertWorkflowAssignment = z.infer<typeof insertWorkflowAssignmentSchema>;
export type WorkflowAssignment = typeof workflowAssignments.$inferSelect;
export type InsertPlatformSubscription = z.infer<typeof insertPlatformSubscriptionSchema>;
export type PlatformSubscription = typeof platformSubscriptions.$inferSelect;
export type InsertLucaChatSession = z.infer<typeof insertLucaChatSessionSchema>;
export type LucaChatSession = typeof lucaChatSessions.$inferSelect;
export type InsertLucaChatMessage = z.infer<typeof insertLucaChatMessageSchema>;
export type LucaChatMessage = typeof lucaChatMessages.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicketComment = z.infer<typeof insertSupportTicketCommentSchema>;
export type SupportTicketComment = typeof supportTicketComments.$inferSelect;
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertClientPortalTask = z.infer<typeof insertClientPortalTaskSchema>;
export type ClientPortalTask = typeof clientPortalTasks.$inferSelect;
export type InsertTaskFollowup = z.infer<typeof insertTaskFollowupSchema>;
export type TaskFollowup = typeof taskFollowups.$inferSelect;
export type InsertAssignmentWorkflowStage = z.infer<typeof insertAssignmentWorkflowStageSchema>;
export type AssignmentWorkflowStage = typeof assignmentWorkflowStages.$inferSelect;
export type InsertAssignmentWorkflowStep = z.infer<typeof insertAssignmentWorkflowStepSchema>;
export type AssignmentWorkflowStep = typeof assignmentWorkflowSteps.$inferSelect;
export type InsertAssignmentWorkflowTask = z.infer<typeof insertAssignmentWorkflowTaskSchema>;
export type AssignmentWorkflowTask = typeof assignmentWorkflowTasks.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertPricingRegion = z.infer<typeof insertPricingRegionSchema>;
export type PricingRegion = typeof pricingRegions.$inferSelect;
export type InsertPlanVolumeTier = z.infer<typeof insertPlanVolumeTierSchema>;
export type PlanVolumeTier = typeof planVolumeTiers.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCouponRedemption = z.infer<typeof insertCouponRedemptionSchema>;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type InsertSubscriptionEvent = z.infer<typeof insertSubscriptionEventSchema>;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type InsertProductFamily = z.infer<typeof insertProductFamilySchema>;
export type ProductFamily = typeof productFamilies.$inferSelect;
export type InsertPlanSKU = z.infer<typeof insertPlanSKUSchema>;
export type PlanSKU = typeof planSKUs.$inferSelect;
export type InsertPlanAddon = z.infer<typeof insertPlanAddonSchema>;
export type PlanAddon = typeof planAddons.$inferSelect;
export type InsertSubscriptionAddon = z.infer<typeof insertSubscriptionAddonSchema>;
export type SubscriptionAddon = typeof subscriptionAddons.$inferSelect;
export type InsertPaymentGatewayConfig = z.infer<typeof insertPaymentGatewayConfigSchema>;
export type PaymentGatewayConfig = typeof paymentGatewayConfigs.$inferSelect;
export type InsertServicePlan = z.infer<typeof insertServicePlanSchema>;
export type ServicePlan = typeof servicePlans.$inferSelect;
export type InsertServicePlanPurchase = z.infer<typeof insertServicePlanPurchaseSchema>;
export type ServicePlanPurchase = typeof servicePlanPurchases.$inferSelect;
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;
export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingTask = z.infer<typeof insertOnboardingTaskSchema>;
export type OnboardingTask = typeof onboardingTasks.$inferSelect;
export type InsertOnboardingNudge = z.infer<typeof insertOnboardingNudgeSchema>;
export type OnboardingNudge = typeof onboardingNudges.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export const subscriptionPlanFormSchema = insertSubscriptionPlanSchema.extend({
  featuresInput: z.string().optional(),
}).omit({ stripePriceIdMonthly: true, stripePriceIdYearly: true, stripeProductId: true });

export const pricingRegionFormSchema = insertPricingRegionSchema.extend({
  countriesInput: z.string().optional(),
});

export const couponFormSchema = insertCouponSchema.extend({
  allowedPlansInput: z.string().optional(),
}).omit({ createdBy: true, currentRedemptions: true });

export type SubscriptionPlanFormData = z.infer<typeof subscriptionPlanFormSchema>;
export type PricingRegionFormData = z.infer<typeof pricingRegionFormSchema>;
export type CouponFormData = z.infer<typeof couponFormSchema>;

export function transformPlanFormData(data: SubscriptionPlanFormData): InsertSubscriptionPlan {
  const { featuresInput, ...rest } = data;
  return {
    ...rest,
    features: featuresInput ? featuresInput.split("\n").filter(f => f.trim()) : [],
  };
}

export function transformRegionFormData(data: PricingRegionFormData): InsertPricingRegion {
  const { countriesInput, ...rest } = data;
  return {
    ...rest,
    countryCodes: countriesInput ? countriesInput.split("\n").filter(c => c.trim()) : [],
  };
}

export function transformCouponFormData(data: CouponFormData): Omit<InsertCoupon, 'createdBy'> {
  const { allowedPlansInput, ...rest } = data;
  return {
    ...rest,
    allowedPlans: allowedPlansInput
      ? allowedPlansInput.split("\n").filter(p => p.trim())
      : null,
  };
}

// ============================
// AI ROUNDTABLE - Multi-Agent Collaborative System
// ============================

// Roundtable Sessions - Teams-style collaborative sessions with multiple AI agents
export const roundtableSessions = pgTable("roundtable_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  title: text("title").notNull().default("New Roundtable Session"),
  description: text("description"),
  objective: text("objective"), // What the user wants to achieve
  
  status: text("status").notNull().default("active"), // 'active', 'paused', 'completed', 'cancelled'
  
  // Shared context snapshot - What all agents know
  sharedContext: jsonb("shared_context").default(sql`'{}'::jsonb`),
  
  // LLM configuration for the session
  llmConfigId: varchar("llm_config_id").references(() => llmConfigurations.id),
  
  // Timestamps
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("roundtable_sessions_user_idx").on(table.userId),
  orgIdx: index("roundtable_sessions_org_idx").on(table.organizationId),
  statusIdx: index("roundtable_sessions_status_idx").on(table.status),
}));

// Roundtable Participants - Agents and users in each session
export const roundtableParticipants = pgTable("roundtable_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => roundtableSessions.id, { onDelete: "cascade" }),
  
  participantType: text("participant_type").notNull(), // 'agent' or 'user'
  participantId: text("participant_id").notNull(), // agentSlug (e.g. 'luca', 'cadence') or userId
  
  role: text("role"), // For agents: 'project_manager', 'workflow_builder', 'document_creator', 'form_builder'
  displayName: text("display_name").notNull(),
  
  status: text("status").notNull().default("active"), // 'active', 'idle', 'left'
  
  // Track agent capabilities for this session
  capabilities: jsonb("capabilities").default(sql`'[]'::jsonb`), // ['create_workflows', 'create_forms', 'send_emails']
  
  // Task queue for this participant
  assignedTasks: jsonb("assigned_tasks").default(sql`'[]'::jsonb`),
  
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => ({
  sessionIdx: index("roundtable_participants_session_idx").on(table.sessionId),
  sessionParticipantIdx: index("roundtable_participants_session_participant_idx").on(table.sessionId, table.participantId),
}));

// Roundtable Messages - Main discussion and private chats
export const roundtableMessages = pgTable("roundtable_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => roundtableSessions.id, { onDelete: "cascade" }),
  
  // Message channel - determines visibility
  channelType: text("channel_type").notNull(), // 'main' (everyone sees), 'private' (1-on-1)
  
  // For private messages
  recipientParticipantId: varchar("recipient_participant_id"), // If private, who receives it
  
  // Sender info
  senderType: text("sender_type").notNull(), // 'user' or 'agent'
  senderId: text("sender_id").notNull(), // userId or agentSlug
  senderName: text("sender_name").notNull(),
  
  // Message content
  content: text("content").notNull(),
  messageType: text("message_type").default("text"), // 'text', 'system', 'deliverable_update', 'task_update'
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Typing indicators, reactions, references
  
  // Streaming support
  isStreaming: boolean("is_streaming").default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("roundtable_messages_session_idx").on(table.sessionId),
  sessionChannelIdx: index("roundtable_messages_session_channel_idx").on(table.sessionId, table.channelType),
  sessionCreatedIdx: index("roundtable_messages_session_created_idx").on(table.sessionId, table.createdAt),
}));

// Roundtable Deliverables - Work products created by agents (workflows, forms, documents)
export const roundtableDeliverables = pgTable("roundtable_deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => roundtableSessions.id, { onDelete: "cascade" }),
  
  // Who created this
  creatorParticipantId: varchar("creator_participant_id").notNull().references(() => roundtableParticipants.id),
  creatorAgentSlug: text("creator_agent_slug").notNull(), // 'cadence', 'forma', 'parity'
  
  // Deliverable details
  deliverableType: text("deliverable_type").notNull(), // 'workflow', 'form', 'document', 'email_template', 'message_template'
  title: text("title").notNull(),
  description: text("description"),
  
  // The actual work product (JSON representation for preview)
  payload: jsonb("payload").notNull(), // Complete data structure
  
  // Presentation state
  isPresentingNow: boolean("is_presenting_now").default(false),
  presentedAt: timestamp("presented_at"),
  
  // Approval workflow
  status: text("status").notNull().default("draft"), // 'draft', 'presented', 'approved', 'rejected', 'needs_changes'
  
  // If approved, where was it saved
  savedToTemplateId: varchar("saved_to_template_id"), // Reference to workflows/forms/documentTemplates table
  savedToType: text("saved_to_type"), // 'workflow', 'form', 'document_template'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("roundtable_deliverables_session_idx").on(table.sessionId),
  sessionStatusIdx: index("roundtable_deliverables_session_status_idx").on(table.sessionId, table.status),
  presentingIdx: index("roundtable_deliverables_presenting_idx").on(table.isPresentingNow),
}));

// Roundtable Approvals - Track user decisions on deliverables
export const roundtableApprovals = pgTable("roundtable_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deliverableId: varchar("deliverable_id").notNull().references(() => roundtableDeliverables.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id").notNull().references(() => roundtableSessions.id, { onDelete: "cascade" }),
  
  // Who made the decision
  userId: varchar("user_id").notNull().references(() => users.id),
  
  decision: text("decision").notNull(), // 'approved', 'rejected', 'needs_changes'
  feedback: text("feedback"), // User's comments/feedback
  
  // If approved, was it auto-saved?
  autoSaved: boolean("auto_saved").default(false),
  savedToTemplateId: varchar("saved_to_template_id"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  deliverableIdx: index("roundtable_approvals_deliverable_idx").on(table.deliverableId),
  sessionIdx: index("roundtable_approvals_session_idx").on(table.sessionId),
}));

// Roundtable Knowledge Entries - Shared context/knowledge base for all agents
export const roundtableKnowledgeEntries = pgTable("roundtable_knowledge_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => roundtableSessions.id, { onDelete: "cascade" }),
  
  entryType: text("entry_type").notNull(), // 'document', 'note', 'requirement', 'reference', 'client_info'
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  // Source of this knowledge
  sourceType: text("source_type"), // 'user_uploaded', 'agent_generated', 'system'
  sourceParticipantId: varchar("source_participant_id"),
  
  // Versioning
  version: integer("version").notNull().default(1),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("roundtable_knowledge_entries_session_idx").on(table.sessionId),
  sessionTypeIdx: index("roundtable_knowledge_entries_session_type_idx").on(table.sessionId, table.entryType),
}));

// Zod schemas and types for Roundtable
export const insertRoundtableSessionSchema = createInsertSchema(roundtableSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
});
export type InsertRoundtableSession = z.infer<typeof insertRoundtableSessionSchema>;
export type RoundtableSession = typeof roundtableSessions.$inferSelect;

export const insertRoundtableParticipantSchema = createInsertSchema(roundtableParticipants).omit({
  id: true,
  joinedAt: true,
});
export type InsertRoundtableParticipant = z.infer<typeof insertRoundtableParticipantSchema>;
export type RoundtableParticipant = typeof roundtableParticipants.$inferSelect;

export const insertRoundtableMessageSchema = createInsertSchema(roundtableMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertRoundtableMessage = z.infer<typeof insertRoundtableMessageSchema>;
export type RoundtableMessage = typeof roundtableMessages.$inferSelect;

export const insertRoundtableDeliverableSchema = createInsertSchema(roundtableDeliverables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRoundtableDeliverable = z.infer<typeof insertRoundtableDeliverableSchema>;
export type RoundtableDeliverable = typeof roundtableDeliverables.$inferSelect;

export const insertRoundtableApprovalSchema = createInsertSchema(roundtableApprovals).omit({
  id: true,
  createdAt: true,
});
export type InsertRoundtableApproval = z.infer<typeof insertRoundtableApprovalSchema>;
export type RoundtableApproval = typeof roundtableApprovals.$inferSelect;

export const insertRoundtableKnowledgeEntrySchema = createInsertSchema(roundtableKnowledgeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRoundtableKnowledgeEntry = z.infer<typeof insertRoundtableKnowledgeEntrySchema>;
export type RoundtableKnowledgeEntry = typeof roundtableKnowledgeEntries.$inferSelect;

// Zod schemas and types for Live Chat
export const insertLiveChatConversationSchema = createInsertSchema(liveChatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  lastMessageAt: true,
});
export type InsertLiveChatConversation = z.infer<typeof insertLiveChatConversationSchema>;
export type LiveChatConversation = typeof liveChatConversations.$inferSelect;

export const insertLiveChatMessageSchema = createInsertSchema(liveChatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertLiveChatMessage = z.infer<typeof insertLiveChatMessageSchema>;
export type LiveChatMessage = typeof liveChatMessages.$inferSelect;

export const insertAgentAvailabilitySchema = createInsertSchema(agentAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentAvailability = z.infer<typeof insertAgentAvailabilitySchema>;
export type AgentAvailability = typeof agentAvailability.$inferSelect;

export const defaultPlanFormValues: SubscriptionPlanFormData = {
  name: "",
  slug: "",
  description: "",
  monthlyPrice: "0",
  yearlyPrice: "0",
  features: [],
  featuresInput: "",
  maxUsers: null,
  maxClients: null,
  maxStorage: null,
  includedSeats: 1,
  additionalSeatPrice: "0",
  isActive: true,
  isFeatured: false,
  displayOrder: 0,
};

export const defaultRegionFormValues: PricingRegionFormData = {
  name: "",
  code: "",
  description: "",
  countryCodes: [],
  countriesInput: "",
  currency: "USD",
  currencySymbol: "$",
  priceMultiplier: "1.0",
  isActive: true,
  displayOrder: 0,
};

export const defaultCouponFormValues: CouponFormData = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "10",
  minSeats: null,
  maxSeats: null,
  allowedPlans: null,
  allowedPlansInput: "",
  maxRedemptions: null,
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: null,
  isActive: true,
};

// ==================== CALENDAR SCHEMAS ====================

// Events
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Event Attendees
export const insertEventAttendeeSchema = createInsertSchema(eventAttendees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
export type EventAttendee = typeof eventAttendees.$inferSelect;

// Time Off Requests
export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;
export type TimeOffRequest = typeof timeOffRequests.$inferSelect;

// ==================== FORECASTING SYSTEM ====================

// Forecasting Models - Configurations for different forecast types
export const forecastingModels = pgTable("forecasting_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  forecastType: text("forecast_type").notNull(), // 'revenue', 'workload', 'capacity', 'client_growth'
  strategy: text("strategy").notNull().default("statistical"), // 'statistical', 'llm', 'hybrid'
  configuration: jsonb("configuration").default(sql`'{}'::jsonb`), // Model-specific settings
  
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgTypeIdx: index("forecasting_models_org_type_idx").on(table.organizationId, table.forecastType),
}));

// Forecasting Runs - Individual forecast executions
export const forecastingRuns = pgTable("forecasting_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  modelId: varchar("model_id").notNull().references(() => forecastingModels.id),
  
  runBy: varchar("run_by").notNull().references(() => users.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  granularity: text("granularity").notNull().default("monthly"), // 'daily', 'weekly', 'monthly', 'quarterly'
  
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  errorMessage: text("error_message"),
  
  // AI-assisted forecasting metadata
  llmProvider: text("llm_provider"),
  llmModel: text("llm_model"),
  llmTokensUsed: integer("llm_tokens_used"),
  
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgModelIdx: index("forecasting_runs_org_model_idx").on(table.organizationId, table.modelId),
  statusIdx: index("forecasting_runs_status_idx").on(table.status),
}));

// Forecasting Scenarios - Best/worst/expected variations
export const forecastingScenarios = pgTable("forecasting_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => forecastingRuns.id, { onDelete: "cascade" }),
  
  label: text("label").notNull(), // 'best_case', 'worst_case', 'expected'
  growthRate: text("growth_rate"), // e.g., "15%", "-10%"
  assumptions: jsonb("assumptions").default(sql`'{}'::jsonb`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  runIdx: index("forecasting_scenarios_run_idx").on(table.runId),
}));

// Forecasting Predictions - Time-series forecast outputs
export const forecastingPredictions = pgTable("forecasting_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => forecastingRuns.id, { onDelete: "cascade" }),
  scenarioId: varchar("scenario_id").references(() => forecastingScenarios.id, { onDelete: "cascade" }),
  
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Predicted metrics (flexible JSON for different forecast types)
  metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
  // Example for revenue: {"predicted_revenue": 125000, "confidence": 0.85}
  // Example for workload: {"predicted_hours": 1200, "capacity_utilization": 0.75}
  
  confidenceScore: text("confidence_score"), // 0.0-1.0
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  runScenarioIdx: index("forecasting_predictions_run_scenario_idx").on(table.runId, table.scenarioId),
  periodIdx: index("forecasting_predictions_period_idx").on(table.periodStart, table.periodEnd),
}));

// Zod schemas for forecasting
export const insertForecastingModelSchema = createInsertSchema(forecastingModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertForecastingModel = z.infer<typeof insertForecastingModelSchema>;
export type ForecastingModel = typeof forecastingModels.$inferSelect;

export const insertForecastingRunSchema = createInsertSchema(forecastingRuns).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertForecastingRun = z.infer<typeof insertForecastingRunSchema>;
export type ForecastingRun = typeof forecastingRuns.$inferSelect;

export const insertForecastingScenarioSchema = createInsertSchema(forecastingScenarios).omit({
  id: true,
  createdAt: true,
});
export type InsertForecastingScenario = z.infer<typeof insertForecastingScenarioSchema>;
export type ForecastingScenario = typeof forecastingScenarios.$inferSelect;

export const insertForecastingPredictionSchema = createInsertSchema(forecastingPredictions).omit({
  id: true,
  createdAt: true,
});
export type InsertForecastingPrediction = z.infer<typeof insertForecastingPredictionSchema>;
export type ForecastingPrediction = typeof forecastingPredictions.$inferSelect;

// ==================== SCHEDULED REPORTS ====================

// Scheduled Reports - Auto-email reports on schedule
export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  reportType: text("report_type").notNull(), // 'time_tracking', 'profitability', 'workload', 'custom'
  reportConfig: jsonb("report_config").notNull().default(sql`'{}'::jsonb`), // Filter/params for report
  
  schedule: text("schedule").notNull(), // 'daily', 'weekly', 'monthly', 'quarterly'
  scheduleDay: integer("schedule_day"), // For weekly (1-7) or monthly (1-31)
  scheduleTime: text("schedule_time").default("09:00"), // Time to send (HH:MM)
  
  recipients: text("recipients").array().notNull(), // Email addresses
  format: text("format").notNull().default("pdf"), // 'pdf', 'csv', 'excel'
  
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("scheduled_reports_org_idx").on(table.organizationId),
  nextRunIdx: index("scheduled_reports_next_run_idx").on(table.nextRunAt),
}));

// Scheduled Report Logs - Execution history
export const scheduledReportLogs = pgTable("scheduled_report_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduledReportId: varchar("scheduled_report_id").notNull().references(() => scheduledReports.id, { onDelete: "cascade" }),
  
  status: text("status").notNull(), // 'success', 'failed'
  errorMessage: text("error_message"),
  emailsSent: integer("emails_sent").default(0),
  
  executedAt: timestamp("executed_at").notNull().defaultNow(),
}, (table) => ({
  reportIdx: index("scheduled_report_logs_report_idx").on(table.scheduledReportId),
}));

// ==================== VIDEO CONFERENCING ====================

// OAuth Connections - Generic OAuth connections for external services
export const oauthConnections = pgTable("oauth_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  provider: text("provider").notNull(), // 'zoom', 'google_meet', 'microsoft_teams'
  encryptedCredentials: text("encrypted_credentials").notNull(), // Encrypted OAuth tokens
  
  status: text("status").notNull().default("active"), // 'active', 'expired', 'revoked'
  expiresAt: timestamp("expires_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userProviderIdx: index("oauth_connections_user_provider_idx").on(table.userId, table.provider),
}));

// Meeting Records - Video conference meeting logs
export const meetingRecords = pgTable("meeting_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  provider: text("provider").notNull(), // 'zoom', 'google_meet', 'microsoft_teams'
  externalMeetingId: text("external_meeting_id"), // Provider's meeting ID
  meetingUrl: text("meeting_url").notNull(),
  
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // Minutes
  
  hostId: varchar("host_id").notNull().references(() => users.id),
  participants: text("participants").array(), // User IDs or email addresses
  
  // Link to related entities
  projectId: varchar("project_id").references(() => projects.id),
  eventId: varchar("event_id").references(() => events.id),
  clientId: varchar("client_id").references(() => clients.id),
  
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'in_progress', 'completed', 'cancelled'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("meeting_records_org_idx").on(table.organizationId),
  hostIdx: index("meeting_records_host_idx").on(table.hostId),
}));

// Zod schemas for scheduled reports
export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  nextRunAt: true,
});
export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;

export const insertScheduledReportLogSchema = createInsertSchema(scheduledReportLogs).omit({
  id: true,
  executedAt: true,
});
export type InsertScheduledReportLog = z.infer<typeof insertScheduledReportLogSchema>;
export type ScheduledReportLog = typeof scheduledReportLogs.$inferSelect;

// Zod schemas for video conferencing
export const insertOAuthConnectionSchema = createInsertSchema(oauthConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOAuthConnection = z.infer<typeof insertOAuthConnectionSchema>;
export type OAuthConnection = typeof oauthConnections.$inferSelect;

export const insertMeetingRecordSchema = createInsertSchema(meetingRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMeetingRecord = z.infer<typeof insertMeetingRecordSchema>;
export type MeetingRecord = typeof meetingRecords.$inferSelect;

// ==================== SKILL-BASED ASSIGNMENT ====================

// Skills - Skills taxonomy
export const skills = pgTable("skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // 'technical', 'accounting', 'soft_skills', etc.
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("skills_org_idx").on(table.organizationId),
  orgNameUnique: index("skills_org_name_unique").on(table.organizationId, table.name),
}));

// User Skills - Skills assigned to users with proficiency levels
export const userSkills = pgTable("user_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillId: varchar("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  
  proficiencyLevel: text("proficiency_level").notNull().default("intermediate"), // 'beginner', 'intermediate', 'advanced', 'expert'
  yearsExperience: integer("years_experience").default(0), // Years of experience with this skill
  certifications: text("certifications").array().default(sql`ARRAY[]::text[]`), // e.g., ['CPA', 'CMA', 'CIA']
  lastUsedDate: timestamp("last_used_date"), // When this skill was last used professionally
  endorsements: integer("endorsements").default(0), // Count of colleague endorsements
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userSkillUnique: index("user_skills_unique").on(table.userId, table.skillId),
}));

// Task Skill Requirements - Skills required for tasks
export const taskSkillRequirements = pgTable("task_skill_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => workflowTasks.id, { onDelete: "cascade" }),
  skillId: varchar("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  
  requiredLevel: text("required_level").default("intermediate"), // Minimum proficiency required
  importance: text("importance").default("required"), // 'required', 'preferred', 'nice_to_have'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  taskIdx: index("task_skill_requirements_task_idx").on(table.taskId),
}));

// ==================== RESOURCE ALLOCATION ====================

// Resource Allocations - % Time allocation per user per project/assignment
export const resourceAllocations = pgTable("resource_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // What are they allocated to?
  assignmentId: varchar("assignment_id").references(() => workflowAssignments.id, { onDelete: "cascade" }), // Specific assignment
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }), // Or project-level allocation
  
  // Time period
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Allocation percentage (0-100)
  allocationPercentage: integer("allocation_percentage").notNull(), // e.g., 50 = 50% of time
  
  // Hours estimates (optional, calculated from percentage)
  estimatedHoursPerWeek: numeric("estimated_hours_per_week", { precision: 10, scale: 2 }),
  
  // Notes and metadata
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("resource_allocations_user_idx").on(table.userId),
  assignmentIdx: index("resource_allocations_assignment_idx").on(table.assignmentId),
  projectIdx: index("resource_allocations_project_idx").on(table.projectId),
  orgIdx: index("resource_allocations_org_idx").on(table.organizationId),
  // Index for finding allocations by date range
  dateRangeIdx: index("resource_allocations_date_range_idx").on(table.startDate, table.endDate),
  // CHECK constraints for data integrity
  percentageCheck: check("resource_allocations_percentage_check", sql`${table.allocationPercentage} >= 0 AND ${table.allocationPercentage} <= 100`),
  dateOrderCheck: check("resource_allocations_date_check", sql`${table.endDate} > ${table.startDate}`),
}));

// ==================== CLIENT BOOKINGS ====================

// Booking Rules - Availability rules for client booking
export const bookingRules = pgTable("booking_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  serviceType: text("service_type"), // e.g., 'consultation', 'tax_prep', 'bookkeeping'
  duration: integer("duration").notNull().default(60), // Minutes
  
  // Availability settings
  availableDays: text("available_days").array().notNull(), // ['monday', 'tuesday', ...]
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "17:00"
  bufferTime: integer("buffer_time").default(15), // Minutes between bookings
  
  // Assigned staff
  assignedTo: text("assigned_to").array(), // User IDs who can handle these bookings
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("booking_rules_org_idx").on(table.organizationId),
}));

// Client Bookings - Scheduled client appointments
export const clientBookings = pgTable("client_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  bookingRuleId: varchar("booking_rule_id").references(() => bookingRules.id),
  
  clientId: varchar("client_id").references(() => clients.id),
  clientName: text("client_name"),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone"),
  
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  
  assignedTo: varchar("assigned_to").references(() => users.id),
  meetingRecordId: varchar("meeting_record_id").references(() => meetingRecords.id), // Link to video conference
  
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("client_bookings_org_idx").on(table.organizationId),
  clientIdx: index("client_bookings_client_idx").on(table.clientId),
  timeIdx: index("client_bookings_time_idx").on(table.startTime),
}));

// ==================== DOCUMENT COMPARISON ====================

// Document Version Diffs - Stores comparison results between document versions
export const documentVersionDiffs = pgTable("document_version_diffs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  fromVersionId: varchar("from_version_id").notNull().references(() => documentVersions.id),
  toVersionId: varchar("to_version_id").notNull().references(() => documentVersions.id),
  
  diffData: jsonb("diff_data").notNull().default(sql`'{}'::jsonb`), // Stores diff result
  diffHtml: text("diff_html"), // Rendered HTML diff for display
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  versionIdx: index("document_version_diffs_versions_idx").on(table.fromVersionId, table.toVersionId),
}));

// ==================== TRACK CHANGES ====================

// Document Collaboration Sessions - Track collaborative editing sessions
export const documentCollaborationSessions = pgTable("document_collaboration_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  
  startedBy: varchar("started_by").notNull().references(() => users.id),
  trackChangesEnabled: boolean("track_changes_enabled").default(true),
  
  status: text("status").notNull().default("active"), // 'active', 'closed'
  
  startedAt: timestamp("started_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
}, (table) => ({
  docIdx: index("document_collaboration_sessions_doc_idx").on(table.documentId),
}));

// Document Change Events - Individual changes during collaboration
export const documentChangeEvents = pgTable("document_change_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => documentCollaborationSessions.id, { onDelete: "cascade" }),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  
  userId: varchar("user_id").notNull().references(() => users.id),
  changeType: text("change_type").notNull(), // 'insert', 'delete', 'format', 'comment'
  changeData: jsonb("change_data").notNull().default(sql`'{}'::jsonb`),
  
  position: integer("position"), // Position in document
  length: integer("length"), // Length of change
  
  isAccepted: boolean("is_accepted"),
  isRejected: boolean("is_rejected"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("document_change_events_session_idx").on(table.sessionId),
  docIdx: index("document_change_events_doc_idx").on(table.documentId),
}));

// ==================== ZOD SCHEMAS FOR NEW FEATURES ====================

// Skills
export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
});
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;

export const insertUserSkillSchema = createInsertSchema(userSkills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserSkill = z.infer<typeof insertUserSkillSchema>;
export type UserSkill = typeof userSkills.$inferSelect;

export const insertTaskSkillRequirementSchema = createInsertSchema(taskSkillRequirements).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskSkillRequirement = z.infer<typeof insertTaskSkillRequirementSchema>;
export type TaskSkillRequirement = typeof taskSkillRequirements.$inferSelect;

// Resource Allocations
export const insertResourceAllocationSchema = createInsertSchema(resourceAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  allocationPercentage: z.number().min(0).max(100), // Validate 0-100%
});
export type InsertResourceAllocation = z.infer<typeof insertResourceAllocationSchema>;
export type ResourceAllocation = typeof resourceAllocations.$inferSelect;

// Client Bookings
export const insertBookingRuleSchema = createInsertSchema(bookingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBookingRule = z.infer<typeof insertBookingRuleSchema>;
export type BookingRule = typeof bookingRules.$inferSelect;

export const insertClientBookingSchema = createInsertSchema(clientBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientBooking = z.infer<typeof insertClientBookingSchema>;
export type ClientBooking = typeof clientBookings.$inferSelect;

// Document Comparison
export const insertDocumentVersionDiffSchema = createInsertSchema(documentVersionDiffs).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentVersionDiff = z.infer<typeof insertDocumentVersionDiffSchema>;
export type DocumentVersionDiff = typeof documentVersionDiffs.$inferSelect;

// Track Changes
export const insertDocumentCollaborationSessionSchema = createInsertSchema(documentCollaborationSessions).omit({
  id: true,
  startedAt: true,
  closedAt: true,
});
export type InsertDocumentCollaborationSession = z.infer<typeof insertDocumentCollaborationSessionSchema>;
export type DocumentCollaborationSession = typeof documentCollaborationSessions.$inferSelect;

export const insertDocumentChangeEventSchema = createInsertSchema(documentChangeEvents).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});
export type InsertDocumentChangeEvent = z.infer<typeof insertDocumentChangeEventSchema>;
export type DocumentChangeEvent = typeof documentChangeEvents.$inferSelect;

// SSO/SAML
export const insertSsoConnectionSchema = createInsertSchema(ssoConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSsoConnection = z.infer<typeof insertSsoConnectionSchema>;
export type SsoConnection = typeof ssoConnections.$inferSelect;

export const insertSsoSessionSchema = createInsertSchema(ssoSessions).omit({
  id: true,
  loginAt: true,
  logoutAt: true,
});
export type InsertSsoSession = z.infer<typeof insertSsoSessionSchema>;
export type SsoSession = typeof ssoSessions.$inferSelect;

// ============================================================================
// AI PERSONALITY PROFILING & PERFORMANCE MONITORING SYSTEM
// ============================================================================
// Revolutionary multi-framework personality assessment with ML fusion
// Designed to be extremely difficult to replicate

// Enums for personality frameworks
export const personalityFrameworkEnum = pgEnum("personality_framework", [
  "big_five",      // Big Five (OCEAN)
  "disc",          // DISC Model
  "mbti",          // Myers-Briggs Type Indicator
  "eq",            // Emotional Intelligence
  "cultural"       // Hofstede Cultural Dimensions
]);

export const mlModelTypeEnum = pgEnum("ml_model_type", [
  "keyword_analysis",     // Fast keyword/pattern matching
  "sentiment_analysis",   // Emotion/tone detection
  "behavioral_patterns",  // Communication style analysis
  "llm_validation",       // LLM-based deep analysis (token-conscious)
  "cultural_inference",   // Location + behavior → cultural traits
  "performance_predictor" // Task success prediction
]);

export const traitTypeEnum = pgEnum("trait_type", [
  // Big Five (OCEAN)
  "openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism",
  // DISC
  "dominance", "influence", "steadiness", "compliance",
  // MBTI dimensions
  "introversion_extraversion", "sensing_intuition", "thinking_feeling", "judging_perceiving",
  // EQ components
  "self_awareness", "self_regulation", "motivation", "empathy", "social_skills",
  // Cultural dimensions (Hofstede)
  "power_distance", "individualism_collectivism", "masculinity_femininity", 
  "uncertainty_avoidance", "long_term_orientation", "indulgence_restraint"
]);

export const metricAggregationTypeEnum = pgEnum("metric_aggregation_type", [
  "sum", "average", "min", "max", "count", "rate", "percentage"
]);

// ML analysis runs (audit trail for fusion jobs) - DEFINED FIRST for FK references
export const mlAnalysisRuns = pgTable("ml_analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Run metadata
  runType: varchar("run_type", { length: 50 }).notNull(), // 'personality_update', 'performance_calculation', 'cultural_inference'
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  
  // Batch details
  totalUsers: integer("total_users").notNull().default(0), // Total users to process in batch
  usersProcessed: integer("users_processed").notNull().default(0), // Successfully completed
  failedUsers: integer("failed_users").notNull().default(0), // Failed processing
  conversationsAnalyzed: integer("conversations_analyzed").notNull().default(0),
  
  // Model fusion details
  modelsUsed: jsonb("models_used"), // Array of model types used
  fusionStrategy: text("fusion_strategy"), // How models were combined
  
  // Resource usage
  tokensConsumed: integer("tokens_consumed").notNull().default(0),
  processingTimeSeconds: integer("processing_time_seconds"),
  
  // Error handling
  errorMessage: text("error_message"),
  
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  orgIdx: index("ml_analysis_runs_org_idx").on(table.organizationId),
  statusIdx: index("ml_analysis_runs_status_idx").on(table.status),
  startedIdx: index("ml_analysis_runs_started_idx").on(table.startedAt),
}));

// ML analysis jobs (individual user tasks for batch processing)
export const mlAnalysisJobs = pgTable("ml_analysis_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisRunId: varchar("analysis_run_id").notNull().references(() => mlAnalysisRuns.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Job status tracking
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  attemptCount: integer("attempt_count").notNull().default(0), // Retry counter
  maxAttempts: integer("max_attempts").notNull().default(3), // Maximum retry attempts
  
  // Result metadata
  tokensUsed: integer("tokens_used").notNull().default(0),
  processingTimeMs: integer("processing_time_ms"), // Milliseconds
  
  // Error handling
  errorMessage: text("error_message"),
  lastAttemptAt: timestamp("last_attempt_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  runIdx: index("ml_analysis_jobs_run_idx").on(table.analysisRunId),
  statusIdx: index("ml_analysis_jobs_status_idx").on(table.status),
  userRunUnique: unique("ml_analysis_jobs_user_run_unique").on(table.userId, table.analysisRunId),
}));

// Main personality profiles table - one per user per organization
export const personalityProfiles = pgTable("personality_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Overall confidence score (0-100) based on ML model consensus
  overallConfidence: integer("overall_confidence").notNull().default(0).$type<number>(),
  
  // Number of analyzed conversations
  conversationsAnalyzed: integer("conversations_analyzed").notNull().default(0),
  
  // MBTI type (16 types) if applicable
  mbtiType: varchar("mbti_type", { length: 4 }), // e.g., "INTJ", "ENFP"
  mbtiConfidence: integer("mbti_confidence").$type<number>(), // 0-100
  
  // DISC primary type
  discPrimary: varchar("disc_primary", { length: 1 }), // D, I, S, or C
  discConfidence: integer("disc_confidence").$type<number>(),
  
  // Cultural profile summary
  culturalContext: jsonb("cultural_context"), // { region, inferred_dimensions, confidence }
  
  // ML fusion metadata
  lastAnalysisRunId: varchar("last_analysis_run_id").references(() => mlAnalysisRuns.id),
  modelsUsedCount: integer("models_used_count").notNull().default(0),
  
  // Privacy & consent
  analysisConsented: boolean("analysis_consented").notNull().default(false),
  consentedAt: timestamp("consented_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("personality_profiles_user_org_idx").on(table.userId, table.organizationId),
  orgIdx: index("personality_profiles_org_idx").on(table.organizationId),
  // One profile per user per organization
  userOrgUnique: unique("personality_profiles_user_org_unique").on(table.userId, table.organizationId),
}));

// Individual personality traits with confidence scores
export const personalityTraits = pgTable("personality_traits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull().references(() => personalityProfiles.id, { onDelete: 'cascade' }),
  
  framework: personalityFrameworkEnum("framework").notNull(),
  traitType: traitTypeEnum("trait_type").notNull(),
  
  // Score normalized to 0-100 scale
  score: integer("score").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  
  // Metadata about how this trait was derived
  derivationMethod: jsonb("derivation_method"), // { models_used, weight_distribution }
  
  // Support for time-series tracking
  observedAt: timestamp("observed_at").notNull().defaultNow(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  profileIdx: index("personality_traits_profile_idx").on(table.profileId),
  frameworkIdx: index("personality_traits_framework_idx").on(table.framework),
  profileFrameworkTraitIdx: index("personality_traits_pft_idx").on(table.profileId, table.framework, table.traitType),
}));

// Aggregated conversation metrics (NO raw message content)
// Privacy-first: stores only statistical patterns
export const conversationMetrics = pgTable("conversation_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Time window for this aggregation
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Channel type
  channelType: varchar("channel_type", { length: 50 }).notNull(), // 'team_chat', 'live_chat', 'email'
  
  // Aggregated metrics
  messageCount: integer("message_count").notNull().default(0),
  avgMessageLength: numeric("avg_message_length", { precision: 10, scale: 2 }),
  avgResponseTimeSeconds: numeric("avg_response_time_seconds", { precision: 10, scale: 2 }),
  
  // Sentiment distribution (percentage)
  sentimentPositive: numeric("sentiment_positive", { precision: 5, scale: 2 }), // 0-100
  sentimentNeutral: numeric("sentiment_neutral", { precision: 5, scale: 2 }),
  sentimentNegative: numeric("sentiment_negative", { precision: 5, scale: 2 }),
  
  // Communication patterns
  questionAskedCount: integer("question_asked_count").notNull().default(0),
  exclamationCount: integer("exclamation_count").notNull().default(0),
  emojiUsageCount: integer("emoji_usage_count").notNull().default(0),
  
  // Interaction patterns
  conversationsInitiated: integer("conversations_initiated").notNull().default(0),
  conversationsParticipated: integer("conversations_participated").notNull().default(0),
  
  // Advanced linguistic markers (extensible)
  linguisticMarkers: jsonb("linguistic_markers"), // { formality_score, vocabulary_diversity, etc. }
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userPeriodIdx: index("conversation_metrics_user_period_idx").on(table.userId, table.periodStart),
  orgPeriodIdx: index("conversation_metrics_org_period_idx").on(table.organizationId, table.periodStart),
}));

// Performance metric definitions (admin-configurable)
export const performanceMetricDefinitions = pgTable("performance_metric_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  name: text("name").notNull(),
  description: text("description"),
  
  // Metric calculation
  metricType: varchar("metric_type", { length: 50 }).notNull(), // 'task_completion_rate', 'response_time', 'client_satisfaction', etc.
  aggregationType: metricAggregationTypeEnum("aggregation_type").notNull(),
  
  // Formula or calculation logic
  calculationFormula: jsonb("calculation_formula"), // For complex metrics
  
  // AI-suggested metadata
  aiSuggested: boolean("ai_suggested").notNull().default(false),
  suggestionReason: text("suggestion_reason"), // Why AI recommended this metric
  suggestionConfidence: integer("suggestion_confidence"), // 0-100
  
  // Weight in overall performance score
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default(sql`1.0`),
  
  // Target/threshold values
  targetValue: numeric("target_value", { precision: 10, scale: 2 }),
  minAcceptable: numeric("min_acceptable", { precision: 10, scale: 2 }),
  maxAcceptable: numeric("max_acceptable", { precision: 10, scale: 2 }),
  
  // Who can view this metric
  visibilityScope: varchar("visibility_scope", { length: 50 }).notNull().default("admins_only"), // 'admins_only', 'managers', 'self', 'team', 'all'
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("performance_metric_definitions_org_idx").on(table.organizationId),
  activeIdx: index("performance_metric_definitions_active_idx").on(table.isActive),
}));

// Performance scores (time-series)
export const performanceScores = pgTable("performance_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  metricDefinitionId: varchar("metric_definition_id").notNull().references(() => performanceMetricDefinitions.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Time period for this score
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Actual score value
  score: numeric("score", { precision: 10, scale: 2 }).notNull(),
  
  // Comparison to target
  targetMet: boolean("target_met"),
  percentageOfTarget: numeric("percentage_of_target", { precision: 5, scale: 2 }),
  
  // Supporting data
  dataPoints: integer("data_points").notNull().default(1), // Number of observations
  rawData: jsonb("raw_data"), // Detailed breakdown if needed
  
  // AI insights
  aiInsight: text("ai_insight"), // LLM-generated interpretation
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userMetricPeriodIdx: index("performance_scores_ump_idx").on(table.userId, table.metricDefinitionId, table.periodStart),
  userPeriodIdx: index("performance_scores_user_period_idx").on(table.userId, table.periodStart),
  orgPeriodIdx: index("performance_scores_org_period_idx").on(table.organizationId, table.periodStart),
}));

// Cultural profiles based on location and behavior
export const culturalProfiles = pgTable("cultural_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Location-based baseline (Hofstede country averages)
  countryCode: varchar("country_code", { length: 2 }), // ISO 3166-1 alpha-2
  locationBasedProfile: jsonb("location_based_profile"), // Hofstede dimensions for country
  
  // Behavior-adjusted scores (learned from conversations)
  powerDistance: integer("power_distance"), // 0-100
  individualismCollectivism: integer("individualism_collectivism"), // 0=Collectivist, 100=Individualist
  masculinityFemininity: integer("masculinity_femininity"), // 0=Feminine, 100=Masculine
  uncertaintyAvoidance: integer("uncertainty_avoidance"), // 0-100
  longTermOrientation: integer("long_term_orientation"), // 0-100
  indulgenceRestraint: integer("indulgence_restraint"), // 0=Restraint, 100=Indulgence
  
  // Confidence in behavioral adjustments
  behavioralConfidence: integer("behavioral_confidence").notNull().default(0), // 0-100
  
  // Data provenance
  conversationsAnalyzed: integer("conversations_analyzed").notNull().default(0),
  lastAnalysisAt: timestamp("last_analysis_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("cultural_profiles_user_org_idx").on(table.userId, table.organizationId),
  userOrgUnique: unique("cultural_profiles_user_org_unique").on(table.userId, table.organizationId),
}));

// Individual ML model outputs (for audit and fusion)
export const mlModelOutputs = pgTable("ml_model_outputs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisRunId: varchar("analysis_run_id").notNull().references(() => mlAnalysisRuns.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  modelType: mlModelTypeEnum("model_type").notNull(),
  
  // Model output (structured JSON)
  output: jsonb("output").notNull(), // Model-specific schema
  
  // Quality metrics
  confidence: integer("confidence").notNull(), // 0-100
  checksum: varchar("checksum", { length: 64 }), // SHA-256 of output for integrity
  
  // Weighting in fusion
  fusionWeight: numeric("fusion_weight", { precision: 5, scale: 4 }).notNull().default(sql`1.0`),
  
  // Resource tracking
  tokensUsed: integer("tokens_used").notNull().default(0),
  processingTimeMs: integer("processing_time_ms"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  runIdx: index("ml_model_outputs_run_idx").on(table.analysisRunId),
  userModelIdx: index("ml_model_outputs_user_model_idx").on(table.userId, table.modelType),
}));

// ============================================================================
// INSERT SCHEMAS & TYPES - AI PERSONALITY PROFILING & PERFORMANCE MONITORING
// ============================================================================

// Personality Profiles
export const insertPersonalityProfileSchema = createInsertSchema(personalityProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPersonalityProfile = z.infer<typeof insertPersonalityProfileSchema>;
export type PersonalityProfile = typeof personalityProfiles.$inferSelect;

// Personality Traits
export const insertPersonalityTraitSchema = createInsertSchema(personalityTraits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
});
export type InsertPersonalityTrait = z.infer<typeof insertPersonalityTraitSchema>;
export type PersonalityTrait = typeof personalityTraits.$inferSelect;

// Conversation Metrics
export const insertConversationMetricsSchema = createInsertSchema(conversationMetrics).omit({
  id: true,
  createdAt: true,
});
export type InsertConversationMetrics = z.infer<typeof insertConversationMetricsSchema>;
export type ConversationMetrics = typeof conversationMetrics.$inferSelect;

// Performance Metric Definitions
export const insertPerformanceMetricDefinitionSchema = createInsertSchema(performanceMetricDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPerformanceMetricDefinition = z.infer<typeof insertPerformanceMetricDefinitionSchema>;
export type PerformanceMetricDefinition = typeof performanceMetricDefinitions.$inferSelect;

// Performance Scores
export const insertPerformanceScoreSchema = createInsertSchema(performanceScores).omit({
  id: true,
  createdAt: true,
});
export type InsertPerformanceScore = z.infer<typeof insertPerformanceScoreSchema>;
export type PerformanceScore = typeof performanceScores.$inferSelect;

// Cultural Profiles
export const insertCulturalProfileSchema = createInsertSchema(culturalProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // All Hofstede dimensions are 0-100
  powerDistance: z.number().min(0).max(100).optional(),
  individualismCollectivism: z.number().min(0).max(100).optional(),
  masculinityFemininity: z.number().min(0).max(100).optional(),
  uncertaintyAvoidance: z.number().min(0).max(100).optional(),
  longTermOrientation: z.number().min(0).max(100).optional(),
  indulgenceRestraint: z.number().min(0).max(100).optional(),
});
export type InsertCulturalProfile = z.infer<typeof insertCulturalProfileSchema>;
export type CulturalProfile = typeof culturalProfiles.$inferSelect;

// ML Analysis Runs
export const insertMlAnalysisRunSchema = createInsertSchema(mlAnalysisRuns).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});
export type InsertMlAnalysisRun = z.infer<typeof insertMlAnalysisRunSchema>;
export type MlAnalysisRun = typeof mlAnalysisRuns.$inferSelect;

// ML Analysis Jobs
export const insertMlAnalysisJobSchema = createInsertSchema(mlAnalysisJobs).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertMlAnalysisJob = z.infer<typeof insertMlAnalysisJobSchema>;
export type MlAnalysisJob = typeof mlAnalysisJobs.$inferSelect;

// ML Model Outputs
export const insertMlModelOutputSchema = createInsertSchema(mlModelOutputs).omit({
  id: true,
  createdAt: true,
}).extend({
  confidence: z.number().min(0).max(100),
});
export type InsertMlModelOutput = z.infer<typeof insertMlModelOutputSchema>;
export type MlModelOutput = typeof mlModelOutputs.$inferSelect;
