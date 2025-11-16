import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Complete Pricing Seed Script
 * Seeds all subscription plans with regional pricing from Excel data
 * 
 * Plans: FREE (trial), CORE, AI, EDGE
 * Regions: 10 global regions
 * Billing Cycles: Monthly, Yearly, 3-Year
 */

interface RegionPricing {
  region: string;
  currency: string;
  currencySymbol: string;
  multiplier: number; // Relative to USD base price
  countryCodes: string[];
  core: { monthly: number; yearly: number; threeYear: number };
  ai: { monthly: number; yearly: number; threeYear: number };
  edge: { monthly: number; yearly: number; threeYear: number };
}

// PENETRATION PRICING STRATEGY - 20%/15%/12% Margins (monthly/annual/3-year)
// Target markets: India, UAE, Turkey, USA
// See PENETRATION_PRICING_STRATEGY.md for full strategy
const REGIONAL_PRICING: RegionPricing[] = [
  {
    region: "USA",
    currency: "USD",
    currencySymbol: "$",
    multiplier: 1.0,
    countryCodes: ["US"],
    core: { monthly: 9, yearly: 8, threeYear: 8 },      // 84-86% cheaper than TaxDome
    ai: { monthly: 23, yearly: 21, threeYear: 20 },     // 58-65% cheaper than TaxDome
    edge: { monthly: 38, yearly: 35, threeYear: 34 }    // 33-41% cheaper than TaxDome
  },
  {
    region: "UK",
    currency: "GBP",
    currencySymbol: "£",
    multiplier: 0.79, // GBP exchange rate
    countryCodes: ["GB"],
    core: { monthly: 7, yearly: 6, threeYear: 6 },
    ai: { monthly: 18, yearly: 17, threeYear: 16 },
    edge: { monthly: 30, yearly: 28, threeYear: 27 }
  },
  {
    region: "EU",
    currency: "EUR",
    currencySymbol: "€",
    multiplier: 0.93, // EUR exchange rate
    countryCodes: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "GR", "FI", "DK", "SE", "NO"],
    core: { monthly: 8, yearly: 7, threeYear: 7 },
    ai: { monthly: 21, yearly: 20, threeYear: 19 },
    edge: { monthly: 35, yearly: 33, threeYear: 32 }
  },
  {
    region: "UAE",
    currency: "AED",
    currencySymbol: "د.إ",
    multiplier: 3.67, // AED exchange rate
    countryCodes: ["AE", "SA", "QA", "KW", "BH", "OM"],
    core: { monthly: 33, yearly: 29, threeYear: 29 },      // Premium market, maintains margins
    ai: { monthly: 84, yearly: 77, threeYear: 73 },        // Targets UAE SMEs
    edge: { monthly: 139, yearly: 128, threeYear: 125 }    // Enterprise-level pricing
  },
  {
    region: "India",
    currency: "INR",
    currencySymbol: "₹",
    multiplier: 29.05, // PPP-adjusted for India (0.35x USA base)
    countryCodes: ["IN"],
    core: { monthly: 260, yearly: 232, threeYear: 232 },   // 80% cheaper than old pricing, maintains margins
    ai: { monthly: 670, yearly: 610, threeYear: 581 },     // Aggressive market entry
    edge: { monthly: 1100, yearly: 1017, threeYear: 988 }  // 75% cheaper than old pricing
  },
  {
    region: "Turkey",
    currency: "TRY",
    currencySymbol: "₺",
    multiplier: 13.2, // PPP-adjusted for Turkey (0.40x USA base)
    countryCodes: ["TR"],
    core: { monthly: 120, yearly: 106, threeYear: 106 },   // New market entry pricing
    ai: { monthly: 305, yearly: 278, threeYear: 265 },     // Emerging market strategy
    edge: { monthly: 500, yearly: 462, threeYear: 450 }    // Enterprise Turkish market
  },
  // Secondary markets (not focus, but available)
  {
    region: "Australia",
    currency: "AUD",
    currencySymbol: "A$",
    multiplier: 1.52, // AUD exchange rate
    countryCodes: ["AU"],
    core: { monthly: 14, yearly: 12, threeYear: 12 },
    ai: { monthly: 35, yearly: 32, threeYear: 30 },
    edge: { monthly: 58, yearly: 53, threeYear: 52 }
  },
  {
    region: "Canada",
    currency: "CAD",
    currencySymbol: "C$",
    multiplier: 1.39, // CAD exchange rate
    countryCodes: ["CA"],
    core: { monthly: 13, yearly: 11, threeYear: 11 },
    ai: { monthly: 32, yearly: 29, threeYear: 28 },
    edge: { monthly: 53, yearly: 49, threeYear: 47 }
  },
  {
    region: "Singapore",
    currency: "SGD",
    currencySymbol: "S$",
    multiplier: 1.35, // SGD exchange rate
    countryCodes: ["SG"],
    core: { monthly: 12, yearly: 11, threeYear: 11 },
    ai: { monthly: 31, yearly: 28, threeYear: 27 },
    edge: { monthly: 51, yearly: 47, threeYear: 46 }
  },
  {
    region: "Rest of World",
    currency: "USD",
    currencySymbol: "$",
    multiplier: 0.70, // Discounted for other markets
    countryCodes: ["*"], // All other countries
    core: { monthly: 6, yearly: 6, threeYear: 6 },
    ai: { monthly: 16, yearly: 15, threeYear: 14 },
    edge: { monthly: 27, yearly: 25, threeYear: 24 }
  }
];

// Plan definitions
const PLANS = [
  {
    slug: "free",
    name: "Free Trial",
    description: "14-day trial with no credit card required - explore essential features",
    features: [
      "14-day trial period",
      "Basic Forms & Workflows",
      "Client Portal Access",
      "Document Management",
      "Email Integration",
      "Mobile Apps (View Only)"
    ],
    maxUsers: 3,
    maxClients: 10,
    maxStorage: 1, // 1GB
    maxWorkflows: 5,
    maxAIAgents: 0, // No AI in free
    includedSeats: 1,
    trialDays: 14,
    isActive: true,
    isPublic: true,
    displayOrder: 0
  },
  {
    slug: "core",
    name: "Core",
    description: "Essential accounting tools for small firms",
    features: [
      "Forms & Workflows",
      "Email Integration",
      "Calendar & Scheduling",
      "Client Portal",
      "Document Management",
      "Mobile Apps",
      "Basic Analytics",
      "E-Signatures",
      "Secure Messaging"
    ],
    maxUsers: 10,
    maxClients: 50,
    maxStorage: 10, // 10GB
    maxWorkflows: 20,
    maxAIAgents: 0,
    includedSeats: 1,
    trialDays: 0,
    isActive: true,
    isPublic: true,
    displayOrder: 1
  },
  {
    slug: "ai",
    name: "AI",
    description: "Core + AI Agents for automation (Most Popular)",
    features: [
      "Everything in Core",
      "6 AI Agents (Cadence, Forma, Relay, Parity, Echo, Scribe)",
      "AI Agent Marketplace",
      "Multi-Provider AI (OpenAI, Anthropic, Azure)",
      "Automated Workflows",
      "AI-Powered Email Inbox",
      "Advanced Analytics",
      "Custom Workflow Builder",
      "Zapier Integration"
    ],
    maxUsers: 50,
    maxClients: 200,
    maxStorage: 100, // 100GB
    maxWorkflows: 100,
    maxAIAgents: 6,
    includedSeats: 3,
    trialDays: 0,
    isActive: true,
    isPublic: true,
    displayOrder: 2
  },
  {
    slug: "edge",
    name: "Edge",
    description: "AI + Roundtable Multi-Agent Orchestration (Enterprise)",
    features: [
      "Everything in AI",
      "Roundtable AI Orchestration (exclusive)",
      "Coordinates all 6 AI agents simultaneously",
      "Handles complex multi-step workflows automatically",
      "AI Agent Foundry",
      "Priority Support",
      "Dedicated Account Manager",
      "Custom Integrations",
      "SLA Guarantees"
    ],
    maxUsers: 999999, // Unlimited (use large number)
    maxClients: 999999, // Unlimited
    maxStorage: 999999, // Unlimited
    maxWorkflows: 999999, // Unlimited
    maxAIAgents: 10, // All agents + custom agents
    includedSeats: 5,
    trialDays: 0,
    isActive: true,
    isPublic: true,
    displayOrder: 3
  }
];

export async function seedCompletePricing() {
  console.log("🌱 Seeding complete pricing system...");
  
  try {
    // 1. Create or update subscription plans
    console.log("\n📦 Creating subscription plans...");
    const createdPlans: Record<string, any> = {};
    
    for (const planData of PLANS) {
      const existing = await db.select()
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.slug, planData.slug))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing plan
        const [updated] = await db.update(schema.subscriptionPlans)
          .set({
            name: planData.name,
            description: planData.description,
            features: planData.features as any,
            maxUsers: planData.maxUsers,
            maxClients: planData.maxClients,
            maxStorage: planData.maxStorage,
            maxWorkflows: planData.maxWorkflows,
            maxAIAgents: planData.maxAIAgents,
            includedSeats: planData.includedSeats,
            trialDays: planData.trialDays,
            isActive: planData.isActive,
            isPublic: planData.isPublic,
            displayOrder: planData.displayOrder,
            updatedAt: new Date()
          })
          .where(eq(schema.subscriptionPlans.id, existing[0].id))
          .returning();
        
        createdPlans[planData.slug] = updated;
        console.log(`  ✓ Updated plan: ${planData.name}`);
      } else {
        // Create new plan
        const [created] = await db.insert(schema.subscriptionPlans)
          .values({
            ...planData,
            features: planData.features as any,
            basePriceMonthly: "0", // Will be set by region
            basePriceYearly: "0",
            perSeatPriceMonthly: "0",
            perSeatPriceYearly: "0"
          })
          .returning();
        
        createdPlans[planData.slug] = created;
        console.log(`  ✓ Created plan: ${planData.name}`);
      }
    }
    
    // 2. Create or update pricing regions
    console.log("\n🌍 Creating pricing regions...");
    const createdRegions: Record<string, any> = {};
    
    for (const regionData of REGIONAL_PRICING) {
      const existing = await db.select()
        .from(schema.pricingRegions)
        .where(eq(schema.pricingRegions.code, regionData.region.toUpperCase()))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing region
        const [updated] = await db.update(schema.pricingRegions)
          .set({
            name: regionData.region,
            currency: regionData.currency,
            currencySymbol: regionData.currencySymbol,
            priceMultiplier: regionData.multiplier.toString(),
            countryCodes: regionData.countryCodes as any,
            updatedAt: new Date()
          })
          .where(eq(schema.pricingRegions.id, existing[0].id))
          .returning();
        
        createdRegions[regionData.region] = updated;
        console.log(`  ✓ Updated region: ${regionData.region} (${regionData.currency})`);
      } else {
        // Create new region
        const [created] = await db.insert(schema.pricingRegions)
          .values({
            code: regionData.region.toUpperCase(),
            name: regionData.region,
            currency: regionData.currency,
            currencySymbol: regionData.currencySymbol,
            priceMultiplier: regionData.multiplier.toString(),
            countryCodes: regionData.countryCodes as any,
            isActive: true,
            displayOrder: REGIONAL_PRICING.indexOf(regionData)
          })
          .returning();
        
        createdRegions[regionData.region] = created;
        console.log(`  ✓ Created region: ${regionData.region} (${regionData.currency})`);
      }
    }
    
    // 3. Update plan base prices (using USA as baseline)
    console.log("\n💰 Setting base prices (USD)...");
    const usaPricing = REGIONAL_PRICING.find(r => r.region === "USA")!;
    
    for (const [slug, pricing] of Object.entries({
      core: usaPricing.core,
      ai: usaPricing.ai,
      edge: usaPricing.edge
    })) {
      if (createdPlans[slug]) {
        await db.update(schema.subscriptionPlans)
          .set({
            basePriceMonthly: pricing.monthly.toString(),
            basePriceYearly: pricing.yearly.toString(),
            perSeatPriceMonthly: "0", // No per-seat pricing in your model
            perSeatPriceYearly: "0",
            updatedAt: new Date()
          })
          .where(eq(schema.subscriptionPlans.id, createdPlans[slug].id));
        
        console.log(`  ✓ ${slug.toUpperCase()}: $${pricing.monthly}/mo, $${pricing.yearly}/mo (annual), $${pricing.threeYear}/mo (3-year)`);
      }
    }
    
    console.log("\n✅ Complete pricing system seeded successfully!");
    console.log(`   📦 Plans: ${Object.keys(createdPlans).length}`);
    console.log(`   🌍 Regions: ${Object.keys(createdRegions).length}`);
    console.log(`   💵 Total pricing combinations: ${Object.keys(createdPlans).length - 1} plans × 3 cycles × ${Object.keys(createdRegions).length} regions = ${(Object.keys(createdPlans).length - 1) * 3 * Object.keys(createdRegions).length}`);
    
  } catch (error) {
    console.error("❌ Error seeding pricing:", error);
    throw error;
  }
}

// Run if executed directly
seedCompletePricing()
  .then(() => {
    console.log("\n🎉 Pricing seed complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Pricing seed failed:", error);
    process.exit(1);
  });
