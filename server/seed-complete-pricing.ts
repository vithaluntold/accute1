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

// Pricing data from Accute_Revised_Global_Pricing.xlsx
const REGIONAL_PRICING: RegionPricing[] = [
  {
    region: "USA",
    currency: "USD",
    currencySymbol: "$",
    multiplier: 1.0,
    countryCodes: ["US"],
    core: { monthly: 35, yearly: 29, threeYear: 26 },
    ai: { monthly: 75, yearly: 59, threeYear: 54 },
    edge: { monthly: 125, yearly: 99, threeYear: 89 }
  },
  {
    region: "UK",
    currency: "GBP",
    currencySymbol: "£",
    multiplier: 0.91, // 32/35
    countryCodes: ["GB"],
    core: { monthly: 32, yearly: 27, threeYear: 24 },
    ai: { monthly: 69, yearly: 55, threeYear: 50 },
    edge: { monthly: 115, yearly: 91, threeYear: 82 }
  },
  {
    region: "EU",
    currency: "EUR",
    currencySymbol: "€",
    multiplier: 0.94, // 33/35
    countryCodes: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "GR", "FI", "DK", "SE", "NO"],
    core: { monthly: 33, yearly: 28, threeYear: 25 },
    ai: { monthly: 70, yearly: 56, threeYear: 51 },
    edge: { monthly: 118, yearly: 94, threeYear: 85 }
  },
  {
    region: "UAE",
    currency: "AED",
    currencySymbol: "د.إ",
    multiplier: 3.71, // 130/35
    countryCodes: ["AE", "SA", "QA", "KW", "BH", "OM"],
    core: { monthly: 130, yearly: 108, threeYear: 97 },
    ai: { monthly: 285, yearly: 228, threeYear: 205 },
    edge: { monthly: 480, yearly: 379, threeYear: 341 }
  },
  {
    region: "India",
    currency: "INR",
    currencySymbol: "₹",
    multiplier: 37.11, // 1299/35
    countryCodes: ["IN"],
    core: { monthly: 1299, yearly: 999, threeYear: 899 },
    ai: { monthly: 2699, yearly: 1999, threeYear: 1799 },
    edge: { monthly: 4499, yearly: 3499, threeYear: 3149 }
  },
  {
    region: "Australia",
    currency: "AUD",
    currencySymbol: "A$",
    multiplier: 1.11, // 39/35
    countryCodes: ["AU"],
    core: { monthly: 39, yearly: 33, threeYear: 30 },
    ai: { monthly: 82, yearly: 65, threeYear: 59 },
    edge: { monthly: 136, yearly: 108, threeYear: 97 }
  },
  {
    region: "New Zealand",
    currency: "NZD",
    currencySymbol: "NZ$",
    multiplier: 1.20, // 42/35
    countryCodes: ["NZ"],
    core: { monthly: 42, yearly: 36, threeYear: 32 },
    ai: { monthly: 88, yearly: 70, threeYear: 63 },
    edge: { monthly: 146, yearly: 116, threeYear: 104 }
  },
  {
    region: "Singapore",
    currency: "SGD",
    currencySymbol: "S$",
    multiplier: 1.09, // 38/35
    countryCodes: ["SG"],
    core: { monthly: 38, yearly: 32, threeYear: 29 },
    ai: { monthly: 79, yearly: 63, threeYear: 57 },
    edge: { monthly: 131, yearly: 104, threeYear: 94 }
  },
  {
    region: "SE Asia",
    currency: "USD",
    currencySymbol: "$",
    multiplier: 0.86, // 30/35 (PPP discount)
    countryCodes: ["TH", "MY", "ID", "PH", "VN", "MM", "KH", "LA", "BN"],
    core: { monthly: 30, yearly: 25, threeYear: 22 },
    ai: { monthly: 64, yearly: 50, threeYear: 45 },
    edge: { monthly: 105, yearly: 83, threeYear: 74 }
  },
  {
    region: "Africa",
    currency: "USD",
    currencySymbol: "$",
    multiplier: 0.80, // 28/35 (PPP discount)
    countryCodes: ["ZA", "NG", "KE", "GH", "TZ", "UG", "ET", "EG", "MA", "DZ", "AO", "SD"],
    core: { monthly: 28, yearly: 23, threeYear: 21 },
    ai: { monthly: 60, yearly: 47, threeYear: 42 },
    edge: { monthly: 98, yearly: 78, threeYear: 70 }
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
