/**
 * Seed script to populate subscription plans and regional pricing from Excel data
 * Run with: npx tsx server/seed-pricing-from-excel.ts
 */

import { db } from "./db";
import { subscriptionPlans, pricingRegions } from "../shared/schema";
import { eq } from "drizzle-orm";

const EXCEL_PRICING_DATA = {
  plans: [
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
        "Basic Analytics"
      ],
      maxUsers: 10,
      maxClients: 50,
      maxWorkflows: 20,
      includedSeats: 1,
      isPublic: true,
      displayOrder: 1
    },
    {
      slug: "ai",
      name: "AI",
      description: "Core + AI Agents for automation",
      features: [
        "Everything in Core",
        "6 AI Agents (Cadence, Forma, Relay, Parity, Echo, Scribe)",
        "AI Agent Marketplace",
        "Multi-Provider AI (OpenAI, Anthropic, Azure)",
        "Automated Workflows",
        "AI-Powered Inbox",
        "Advanced Analytics"
      ],
      maxUsers: 50,
      maxClients: 200,
      maxWorkflows: 100,
      includedSeats: 3,
      isPublic: true,
      displayOrder: 2
    },
    {
      slug: "edge",
      name: "Edge",
      description: "AI + Roundtable Multi-Agent Orchestration (Exclusive)",
      features: [
        "Everything in AI",
        "Roundtable AI Orchestration (exclusive feature)",
        "Coordinates all 6 AI agents simultaneously",
        "Handles complex multi-step workflows automatically"
      ],
      maxUsers: -1, // Unlimited
      maxClients: -1,
      maxWorkflows: -1,
      includedSeats: 5,
      isPublic: true,
      displayOrder: 3
    }
  ],
  
  regions: [
    {
      code: "USA",
      name: "🇺🇸 USA",
      currency: "USD",
      currencySymbol: "$",
      priceMultiplier: 1.0,
      isActive: true
    },
    {
      code: "UK",
      name: "🇬🇧 UK",
      currency: "GBP",
      currencySymbol: "£",
      priceMultiplier: 0.91, // Calculated from $35 → £32
      isActive: true
    },
    {
      code: "EU",
      name: "🇪🇺 EU",
      currency: "EUR",
      currencySymbol: "€",
      priceMultiplier: 0.94, // Calculated from $35 → €33
      isActive: true
    },
    {
      code: "UAE",
      name: "🇦🇪 UAE",
      currency: "AED",
      currencySymbol: "د.إ",
      priceMultiplier: 3.71, // Calculated from $35 → 130 AED
      isActive: true
    },
    {
      code: "India",
      name: "🇮🇳 India",
      currency: "INR",
      currencySymbol: "₹",
      priceMultiplier: 37.11, // Calculated from $35 → ₹1,299
      isActive: true
    },
    {
      code: "Australia",
      name: "🇦🇺 Australia",
      currency: "AUD",
      currencySymbol: "A$",
      priceMultiplier: 1.11, // Calculated from $35 → A$39
      isActive: true
    },
    {
      code: "New_Zealand",
      name: "🇳🇿 New Zealand",
      currency: "NZD",
      currencySymbol: "NZ$",
      priceMultiplier: 1.20, // Calculated from $35 → NZ$42
      isActive: true
    },
    {
      code: "Singapore",
      name: "🇸🇬 Singapore",
      currency: "SGD",
      currencySymbol: "S$",
      priceMultiplier: 1.09, // Calculated from $35 → S$38
      isActive: true
    },
    {
      code: "SE_Asia",
      name: "🌏 SE Asia",
      currency: "USD",
      currencySymbol: "$",
      priceMultiplier: 0.86, // Calculated from $35 → $30
      isActive: true
    },
    {
      code: "Africa",
      name: "🌍 Africa",
      currency: "USD",
      currencySymbol: "$",
      priceMultiplier: 0.80, // Calculated from $35 → $28
      isActive: true
    }
  ],
  
  pricing: {
    core: {
      monthly_1: 35,   // Core 1 Month in USD
      yearly_1: 29,    // Core 1 Year in USD (per month)
      yearly_3: 26     // Core 3 Year in USD (per month)
    },
    ai: {
      monthly_1: 75,
      yearly_1: 59,
      yearly_3: 54
    },
    edge: {
      monthly_1: 125,
      yearly_1: 99,
      yearly_3: 89
    }
  }
};

async function seedPricing() {
  console.log("🌱 Seeding pricing data from Excel...\n");

  try {
    // 1. Seed Regions
    console.log("📍 Seeding pricing regions...");
    for (const region of EXCEL_PRICING_DATA.regions) {
      const existing = await db.query.pricingRegions.findFirst({
        where: eq(pricingRegions.code, region.code)
      });

      if (existing) {
        await db.update(pricingRegions)
          .set(region)
          .where(eq(pricingRegions.code, region.code));
        console.log(`   ✓ Updated region: ${region.name}`);
      } else {
        await db.insert(pricingRegions).values(region);
        console.log(`   ✓ Created region: ${region.name}`);
      }
    }

    // 2. Seed Plans
    console.log("\n💎 Seeding subscription plans...");
    for (const plan of EXCEL_PRICING_DATA.plans) {
      const pricing = EXCEL_PRICING_DATA.pricing[plan.slug as keyof typeof EXCEL_PRICING_DATA.pricing];
      
      const planData = {
        ...plan,
        basePriceMonthly: pricing.monthly_1.toString(),
        basePriceYearly: (pricing.yearly_1 * 12).toString(), // Convert to annual total
        perSeatPriceMonthly: (pricing.monthly_1 * 0.8).toString(), // 80% of base for additional seats
        perSeatPriceYearly: (pricing.yearly_1 * 12 * 0.8).toString(),
        features: JSON.stringify(plan.features)
      };

      const existing = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.slug, plan.slug)
      });

      if (existing) {
        await db.update(subscriptionPlans)
          .set(planData)
          .where(eq(subscriptionPlans.slug, plan.slug));
        console.log(`   ✓ Updated plan: ${plan.name}`);
        console.log(`     Monthly: $${pricing.monthly_1}, Yearly: $${pricing.yearly_1}/mo ($${pricing.yearly_1 * 12}/yr)`);
      } else {
        await db.insert(subscriptionPlans).values(planData);
        console.log(`   ✓ Created plan: ${plan.name}`);
        console.log(`     Monthly: $${pricing.monthly_1}, Yearly: $${pricing.yearly_1}/mo ($${pricing.yearly_1 * 12}/yr)`);
      }
    }

    console.log("\n✅ Pricing data seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - ${EXCEL_PRICING_DATA.plans.length} subscription plans`);
    console.log(`   - ${EXCEL_PRICING_DATA.regions.length} pricing regions`);
    console.log(`   - 3 billing cycles (monthly, yearly, 3-year)`);
    
  } catch (error) {
    console.error("\n❌ Error seeding pricing data:", error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPricing()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedPricing };
