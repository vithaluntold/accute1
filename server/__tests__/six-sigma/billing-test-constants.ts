/**
 * Shared Billing Test Constants
 * Single source of truth for pricing values used across all billing tests
 * MUST match server/seed-billing.ts exactly
 */

/**
 * Subscription Plan Prices (USD Base Prices)
 * Source: server/seed-billing.ts
 */
export const PLAN_PRICES = {
  CORE: {
    monthly: 9.00,
    yearly: 8.00,
  },
  AI: {
    monthly: 23.00,
    yearly: 21.00,
  },
  EDGE: {
    monthly: 38.00,
    yearly: 35.00,
  },
} as const;

/**
 * Pricing Region PPP Multipliers
 * Source: server/seed-billing.ts lines 172-293
 * 10 regions total: US, IN, AE, TR, GB, EU, AU, CA, SG, GLOBAL
 */
export const REGION_MULTIPLIERS = {
  US: 1.000,    // United States - baseline
  IN: 0.350,    // India - 65% discount
  AE: 1.000,    // UAE/GCC - premium pricing
  TR: 0.400,    // Turkey - 60% discount
  GB: 0.790,    // United Kingdom - currency adjustment
  EU: 0.930,    // European Union - currency adjustment
  AU: 1.520,    // Australia/NZ - currency adjustment
  CA: 1.390,    // Canada - currency adjustment
  SG: 1.350,    // Singapore - currency adjustment
  GLOBAL: 0.700, // Rest of World - 30% discount
} as const;

/**
 * Volume Discount Tiers
 * Applied to additional seats beyond the first included seat
 */
export const VOLUME_DISCOUNTS = {
  '1-4': 0,      // No discount for 1-4 additional seats
  '5-9': 0.05,   // 5% discount for 5-9 additional seats
  '10-24': 0.07, // 7% discount for 10-24 additional seats
  '25-49': 0.10, // 10% discount for 25-49 additional seats
  '50-99': 0.12, // 12% discount for 50-99 additional seats
  '100+': 0.15,  // 15% discount for 100+ additional seats
} as const;

/**
 * Helper function to get volume discount for a given seat count
 */
export function getVolumeDiscount(additionalSeats: number): number {
  if (additionalSeats >= 100) return VOLUME_DISCOUNTS['100+'];
  if (additionalSeats >= 50) return VOLUME_DISCOUNTS['50-99'];
  if (additionalSeats >= 25) return VOLUME_DISCOUNTS['25-49'];
  if (additionalSeats >= 10) return VOLUME_DISCOUNTS['10-24'];
  if (additionalSeats >= 5) return VOLUME_DISCOUNTS['5-9'];
  return VOLUME_DISCOUNTS['1-4'];
}

/**
 * Billing Cycle Discounts
 */
export const BILLING_DISCOUNTS = {
  MONTHLY: 0,    // No discount for monthly billing
  YEARLY: 0.10,  // 10% discount for annual billing (reflected in yearly prices)
} as const;

/**
 * Trial Configuration
 */
export const TRIAL_CONFIG = {
  DAYS: 14,
  REQUIRES_PAYMENT_METHOD: true,
} as const;

/**
 * Subscription Status Values
 */
export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
} as const;

/**
 * Payment Gateway Configuration
 */
export const PAYMENT_GATEWAYS = {
  STRIPE: 'stripe',
  RAZORPAY: 'razorpay',
} as const;

/**
 * Currency Symbols by Region
 */
export const CURRENCY_SYMBOLS = {
  US: '$',
  IN: '₹',
  AE: 'د.إ',
  TR: '₺',
  GB: '£',
  EU: '€',
  AU: 'A$',
  CA: 'C$',
  SG: 'S$',
  GLOBAL: '$',
} as const;

/**
 * Stripe Currency Codes
 */
export const STRIPE_CURRENCIES = {
  US: 'usd',
  IN: 'inr',
  AE: 'aed',
  TR: 'try',
  GB: 'gbp',
  EU: 'eur',
  AU: 'aud',
  CA: 'cad',
  SG: 'sgd',
  GLOBAL: 'usd',
} as const;
