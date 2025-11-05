import { db } from "./db";
import { organizations, aiAgents, aiAgentInstallations, users } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function seedLucaInstallations() {
  console.log("🤖 Pre-installing Luca agent for all organizations...");
  
  try {
    // Get Luca agent
    const lucaAgent = await db.select()
      .from(aiAgents)
      .where(eq(aiAgents.slug, "luca"))
      .limit(1);
    
    if (lucaAgent.length === 0) {
      console.log("❌ Luca agent not found in database");
      return;
    }
    
    const luca = lucaAgent[0];
    console.log(`✅ Found Luca agent: ${luca.id} - ${luca.name}`);
    
    // Get all organizations
    const allOrgs = await db.select().from(organizations);
    console.log(`📋 Found ${allOrgs.length} organizations`);
    
    let installedCount = 0;
    let skippedCount = 0;
    
    for (const org of allOrgs) {
      // Check if Luca is already installed for this org
      const existing = await db.select()
        .from(aiAgentInstallations)
        .where(
          and(
            eq(aiAgentInstallations.agentId, luca.id),
            eq(aiAgentInstallations.organizationId, org.id)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`  ⏭️  Skipped ${org.name} - Luca already installed`);
        skippedCount++;
        continue;
      }
      
      // Find the first admin/super admin user in the org to attribute the installation
      const adminUser = await db.select()
        .from(users)
        .where(eq(users.organizationId, org.id))
        .limit(1);
      
      if (adminUser.length === 0) {
        console.log(`  ⚠️  Warning: No users found for organization ${org.name}`);
        continue;
      }
      
      // Install Luca
      await db.insert(aiAgentInstallations).values({
        agentId: luca.id,
        organizationId: org.id,
        installedBy: adminUser[0].id,
        configuration: {},
        isActive: true,
      });
      
      console.log(`  ✅ Installed Luca for ${org.name}`);
      installedCount++;
    }
    
    // Update Luca's install count
    const totalInstallations = await db.select({ count: sql<number>`count(*)::int` })
      .from(aiAgentInstallations)
      .where(eq(aiAgentInstallations.agentId, luca.id));
    
    await db.update(aiAgents)
      .set({ installCount: totalInstallations[0].count })
      .where(eq(aiAgents.id, luca.id));
    
    console.log(`\n📊 Summary:`);
    console.log(`  - New installations: ${installedCount}`);
    console.log(`  - Already installed: ${skippedCount}`);
    console.log(`  - Total Luca installations: ${totalInstallations[0].count}`);
    console.log(`\n✅ Luca pre-installation complete!`);
    
  } catch (error) {
    console.error("❌ Error pre-installing Luca:", error);
    throw error;
  }
  
  process.exit(0);
}

seedLucaInstallations();
