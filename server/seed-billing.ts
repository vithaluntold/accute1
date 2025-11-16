/**
 * Database Seed Script for Billing System
 * Seeds subscription plans and pricing regions based on penetration pricing strategy
 */

import { db } from './db';
import * as schema from '../shared/schema';

export async function seedBillingData() {
  console.log('🌱 Seeding billing data...');

  try {
    // ========== SUBSCRIPTION PLANS ==========
    console.log('📦 Seeding subscription plans...');

    const plans = [
      {
        name: 'Core',
        slug: 'core',
        description: 'Essential practice management for small accounting firms',
        displayOrder: 1,
        features: JSON.stringify([
          'Client & contact management',
          'Task & workflow automation',
          'Document management',
          'Email integration',
          'Calendar & scheduling',
          'Basic reporting',
          'Mobile app access',
        ]),
        featureIdentifiers: JSON.stringify([
          'clients',
          'workflows',
          'documents',
          'email',
          'calendar',
          'reports_basic',
          'mobile',
        ]),
        // Base pricing (USD) - before regional multipliers
        // Monthly: $7 cost / 0.80 = $9/mo (20% margin)
        basePriceMonthly: '9.00',
        // Yearly: $7 cost / 0.85 = $8/mo (15% margin, 11% discount)
        basePriceYearly: '8.00',
        perSeatPriceMonthly: '9.00',
        perSeatPriceYearly: '8.00',
        // Limits
        maxUsers: 5,
        maxClients: 50,
        maxStorage: 10, // GB
        maxWorkflows: 25,
        maxAIAgents: 0, // No AI in Core plan
        includedSeats: 1,
        trialDays: 14,
        isActive: true,
        isPublic: true,
      },
      {
        name: 'AI',
        slug: 'ai',
        description: 'Advanced AI-powered practice management for growing firms',
        displayOrder: 2,
        features: JSON.stringify([
          'Everything in Core',
          '11 AI agents (Luca, Cadence, Parity, etc.)',
          'AI Psychology Profiling (Patent-pending)',
          'Advanced workflow automation',
          'Client onboarding automation',
          'Advanced reporting & analytics',
          'API access',
          'Priority support',
        ]),
        featureIdentifiers: JSON.stringify([
          'clients',
          'workflows',
          'documents',
          'email',
          'calendar',
          'reports_advanced',
          'mobile',
          'ai_agents',
          'psychology_profiling',
          'api_access',
          'priority_support',
        ]),
        // Monthly: $18 cost / 0.80 = $23/mo (20% margin)
        basePriceMonthly: '23.00',
        // Yearly: $18 cost / 0.85 = $21/mo (15% margin)
        basePriceYearly: '21.00',
        perSeatPriceMonthly: '23.00',
        perSeatPriceYearly: '21.00',
        // Limits
        maxUsers: 25,
        maxClients: 250,
        maxStorage: 50, // GB
        maxWorkflows: 100,
        maxAIAgents: 11,
        includedSeats: 1,
        trialDays: 14,
        isActive: true,
        isPublic: true,
      },
      {
        name: 'Edge',
        slug: 'edge',
        description: 'Enterprise-grade practice management with unlimited features',
        displayOrder: 3,
        features: JSON.stringify([
          'Everything in AI',
          'Unlimited AI agent usage',
          'Custom AI agent training',
          'White-label options',
          'SSO / SAML authentication',
          'Advanced security controls',
          'Dedicated account manager',
          'Custom integrations',
          'SLA guarantee (99.9% uptime)',
        ]),
        featureIdentifiers: JSON.stringify([
          'clients',
          'workflows',
          'documents',
          'email',
          'calendar',
          'reports_advanced',
          'mobile',
          'ai_agents',
          'psychology_profiling',
          'api_access',
          'priority_support',
          'custom_ai_training',
          'white_label',
          'sso',
          'advanced_security',
          'dedicated_manager',
          'custom_integrations',
          'sla',
        ]),
        // Monthly: $30 cost / 0.80 = $38/mo (20% margin)
        basePriceMonthly: '38.00',
        // Yearly: $30 cost / 0.85 = $35/mo (15% margin)
        basePriceYearly: '35.00',
        perSeatPriceMonthly: '38.00',
        perSeatPriceYearly: '35.00',
        // Limits (effectively unlimited)
        maxUsers: 999,
        maxClients: 9999,
        maxStorage: 500, // GB
        maxWorkflows: 999,
        maxAIAgents: 11,
        includedSeats: 1,
        trialDays: 14,
        isActive: true,
        isPublic: true,
      },
    ];

    for (const plan of plans) {
      await db
        .insert(schema.subscriptionPlans)
        .values(plan)
        .onConflictDoUpdate({
          target: schema.subscriptionPlans.slug,
          set: plan,
        });
      console.log(`  ✅ Seeded plan: ${plan.name}`);
    }

    // ========== PRICING REGIONS ==========
    console.log('🌍 Seeding pricing regions...');

    const regions = [
      {
        name: 'United States',
        code: 'US',
        description: 'Baseline market with premium pricing',
        countryCodes: JSON.stringify(['US']),
        currency: 'USD',
        currencySymbol: '$',
        priceMultiplier: '1.000', // Baseline (no discount)
        stripeCurrency: 'usd',
        isActive: true,
        displayOrder: 1,
      },
      {
        name: 'India',
        code: 'IN',
        description: 'Emerging market with purchasing power parity adjustment',
        countryCodes: JSON.stringify(['IN']),
        currency: 'INR',
        currencySymbol: '₹',
        priceMultiplier: '0.350', // 65% discount for PPP
        stripeCurrency: 'inr',
        isActive: true,
        displayOrder: 2,
      },
      {
        name: 'United Arab Emirates',
        code: 'AE',
        description: 'Premium GCC market',
        countryCodes: JSON.stringify(['AE', 'SA', 'QA', 'KW', 'BH', 'OM']),
        currency: 'AED',
        currencySymbol: 'د.إ',
        priceMultiplier: '1.000', // Premium pricing (same as US)
        stripeCurrency: 'aed',
        isActive: true,
        displayOrder: 3,
      },
      {
        name: 'Turkey',
        code: 'TR',
        description: 'Emerging market with growth opportunity',
        countryCodes: JSON.stringify(['TR']),
        currency: 'TRY',
        currencySymbol: '₺',
        priceMultiplier: '0.400', // 60% discount for emerging market
        stripeCurrency: 'try',
        isActive: true,
        displayOrder: 4,
      },
      {
        name: 'United Kingdom',
        code: 'GB',
        description: 'European premium market',
        countryCodes: JSON.stringify(['GB']),
        currency: 'GBP',
        currencySymbol: '£',
        priceMultiplier: '0.790', // Currency exchange adjustment
        stripeCurrency: 'gbp',
        isActive: true,
        displayOrder: 5,
      },
      {
        name: 'European Union',
        code: 'EU',
        description: 'European market',
        countryCodes: JSON.stringify(['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'SE', 'DK', 'PL', 'CZ']),
        currency: 'EUR',
        currencySymbol: '€',
        priceMultiplier: '0.930', // Currency exchange adjustment
        stripeCurrency: 'eur',
        isActive: true,
        displayOrder: 6,
      },
      {
        name: 'Australia',
        code: 'AU',
        description: 'Asia-Pacific premium market',
        countryCodes: JSON.stringify(['AU', 'NZ']),
        currency: 'AUD',
        currencySymbol: 'A$',
        priceMultiplier: '1.520', // Currency exchange adjustment
        stripeCurrency: 'aud',
        isActive: true,
        displayOrder: 7,
      },
      {
        name: 'Canada',
        code: 'CA',
        description: 'North American market',
        countryCodes: JSON.stringify(['CA']),
        currency: 'CAD',
        currencySymbol: 'C$',
        priceMultiplier: '1.390', // Currency exchange adjustment
        stripeCurrency: 'cad',
        isActive: true,
        displayOrder: 8,
      },
      {
        name: 'Singapore',
        code: 'SG',
        description: 'Asia premium market',
        countryCodes: JSON.stringify(['SG']),
        currency: 'SGD',
        currencySymbol: 'S$',
        priceMultiplier: '1.350', // Currency exchange adjustment
        stripeCurrency: 'sgd',
        isActive: true,
        displayOrder: 9,
      },
      {
        name: 'Rest of World',
        code: 'GLOBAL',
        description: 'Catch-all for other markets with moderate discount',
        countryCodes: JSON.stringify([]),
        currency: 'USD',
        currencySymbol: '$',
        priceMultiplier: '0.700', // 30% discount
        stripeCurrency: 'usd',
        isActive: true,
        displayOrder: 10,
      },
    ];

    for (const region of regions) {
      await db
        .insert(schema.pricingRegions)
        .values(region)
        .onConflictDoNothing(); // Don't update existing regions
      console.log(`  ✅ Seeded region: ${region.name} (${region.code})`);
    }

    console.log('✅ Billing data seeded successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  - ${plans.length} subscription plans`);
    console.log(`  - ${regions.length} pricing regions`);
    console.log('');
    console.log('💰 Pricing (USA baseline):');
    console.log('  - Core: $9/mo (monthly), $8/mo (yearly)');
    console.log('  - AI: $23/mo (monthly), $21/mo (yearly)');
    console.log('  - Edge: $38/mo (monthly), $35/mo (yearly)');
    console.log('');
    console.log('🌍 Regional PPP Multipliers:');
    console.log('  - India: 0.35x (65% discount)');
    console.log('  - Turkey: 0.40x (60% discount)');
    console.log('  - UAE/GCC: 1.0x (premium)');
    console.log('  - USA: 1.0x (baseline)');
  } catch (error) {
    console.error('❌ Error seeding billing data:', error);
    throw error;
  }
}

// Run seed immediately
seedBillingData()
  .then(() => {
    console.log('✅ Seed complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
