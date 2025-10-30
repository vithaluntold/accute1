import { storage } from "./storage";
import { hashPassword } from "./auth";

async function createSuperAdmin() {
  console.log("🔐 Creating Super Admin user...\n");

  try {
    // Get Super Admin role
    const superAdminRole = await storage.getRoleByName("Super Admin");
    if (!superAdminRole) {
      throw new Error("Super Admin role not found. Run seed script first: npm run db:seed");
    }

    // Check if super admin already exists
    const existingUser = await storage.getUserByEmail("superadmin@accute.com");
    if (existingUser) {
      console.log("✅ Super Admin already exists:");
      console.log(`   Email:    superadmin@accute.com`);
      console.log(`   Password: SuperAdmin123!`);
      console.log(`   Role:     ${superAdminRole.name}\n`);
      return;
    }

    // Create Super Admin user
    const superAdmin = await storage.createUser({
      email: "superadmin@accute.com",
      username: "superadmin",
      password: await hashPassword("SuperAdmin123!"),
      firstName: "Super",
      lastName: "Admin",
      roleId: superAdminRole.id,
      organizationId: null, // Platform-scoped (not tied to any organization)
      isActive: true,
    });

    console.log("✅ Super Admin created successfully:");
    console.log(`   Email:    superadmin@accute.com`);
    console.log(`   Password: SuperAdmin123!`);
    console.log(`   Role:     ${superAdminRole.name}`);
    console.log(`   ID:       ${superAdmin.id}\n`);
    console.log("🔓 You can now login with these credentials");

  } catch (error: any) {
    console.error("❌ Error creating Super Admin:", error.message);
    throw error;
  }
}

createSuperAdmin()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Failed:", error);
    process.exit(1);
  });
