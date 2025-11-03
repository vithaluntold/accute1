import { storage } from "./storage";
import { hashPassword } from "./auth";

async function createPersistentSeedAccounts() {
  console.log("🌱 Creating persistent seed accounts for roleplay...\n");

  try {
    // ==================== 1. SUPER ADMIN ====================
    console.log("1️⃣ Creating Super Admin...");
    
    const superAdminRole = await storage.getRoleByName("Super Admin");
    if (!superAdminRole) {
      throw new Error("Super Admin role not found. Run init first.");
    }

    let superAdmin = await storage.getUserByEmail("superadmin@accute.com");
    if (!superAdmin) {
      superAdmin = await storage.createUser({
        email: "superadmin@accute.com",
        username: "superadmin",
        password: await hashPassword("SuperAdmin123!"),
        firstName: "Super",
        lastName: "Admin",
        roleId: superAdminRole.id,
        organizationId: null, // Platform-scoped
        isActive: true,
      });
      console.log("✅ Super Admin created");
    } else {
      console.log("✅ Super Admin already exists");
    }

    // ==================== 2. CREATE ORGANIZATION ====================
    console.log("\n2️⃣ Creating Organization...");
    
    let organization = await storage.getOrganizationBySlug("sterling-accounting");
    if (!organization) {
      organization = await storage.createOrganization({
        name: "Sterling Accounting Firm",
        slug: "sterling-accounting",
        settings: {},
      });
      console.log("✅ Organization created: Sterling Accounting Firm");
    } else {
      console.log("✅ Organization already exists: Sterling Accounting Firm");
    }

    // ==================== 3. ADMIN ====================
    console.log("\n3️⃣ Creating Admin...");
    
    const adminRole = await storage.getRoleByName("Admin");
    if (!adminRole) {
      throw new Error("Admin role not found.");
    }

    let admin = await storage.getUserByEmail("admin@sterling.com");
    if (!admin) {
      admin = await storage.createUser({
        email: "admin@sterling.com",
        username: "admin",
        password: await hashPassword("Admin123!"),
        firstName: "Sarah",
        lastName: "Sterling",
        roleId: adminRole.id,
        organizationId: organization.id,
        isActive: true,
      });
      console.log("✅ Admin created: Sarah Sterling");
    } else {
      console.log("✅ Admin already exists: Sarah Sterling");
    }

    // ==================== 4. EMPLOYEE ====================
    console.log("\n4️⃣ Creating Employee...");
    
    const employeeRole = await storage.getRoleByName("Employee");
    if (!employeeRole) {
      throw new Error("Employee role not found.");
    }

    let employee = await storage.getUserByEmail("employee@sterling.com");
    if (!employee) {
      employee = await storage.createUser({
        email: "employee@sterling.com",
        username: "employee",
        password: await hashPassword("Employee123!"),
        firstName: "John",
        lastName: "Matthews",
        roleId: employeeRole.id,
        organizationId: organization.id,
        isActive: true,
      });
      console.log("✅ Employee created: John Matthews");
    } else {
      console.log("✅ Employee already exists: John Matthews");
    }

    // ==================== 5. CLIENT COMPANY ====================
    console.log("\n5️⃣ Creating Client Company...");
    
    // Check if client already exists
    const existingClients = await storage.getClientsByOrganization(organization.id);
    const existingClient = existingClients.find(c => c.companyName === "TechNova Solutions");
    
    let client;
    if (!existingClient) {
      client = await storage.createClient({
        companyName: "TechNova Solutions",
        contactName: "David Chen",
        email: "david@technova.com",
        phone: "+1-555-0199",
        address: "456 Innovation Drive",
        city: "San Francisco",
        state: "CA",
        zipCode: "94103",
        country: "US",
        taxId: "94-7654321",
        organizationId: organization.id,
        assignedTo: admin.id,
        status: "active",
        industry: "Technology",
        notes: "SaaS company requiring year-end tax preparation",
        metadata: {},
        createdBy: admin.id,
      });
      console.log("✅ Client Company created: TechNova Solutions");
    } else {
      client = existingClient;
      console.log("✅ Client Company already exists: TechNova Solutions");
    }

    // ==================== 6. CONTACT (POC) ====================
    console.log("\n6️⃣ Creating Contact...");
    
    // Check if contact already exists
    const existingContacts = await storage.getContactsByOrganization(organization.id);
    const existingContact = existingContacts.find(c => c.email === "david@technova.com");
    
    let contact;
    if (!existingContact) {
      contact = await storage.createContact({
        clientId: client.id,
        firstName: "David",
        lastName: "Chen",
        email: "david@technova.com",
        phone: "+1-555-0199",
        title: "CFO",
        department: "Finance",
        isPrimary: true,
        notes: "Primary contact for all accounting matters",
        organizationId: organization.id,
        createdBy: admin.id,
      });
      console.log("✅ Contact created: David Chen (CFO)");
    } else {
      contact = existingContact;
      console.log("✅ Contact already exists: David Chen (CFO)");
    }

    // ==================== 7. CLIENT USER ====================
    console.log("\n7️⃣ Creating Client User...");
    
    const clientRole = await storage.getRoleByName("Client");
    if (!clientRole) {
      throw new Error("Client role not found.");
    }

    let clientUser = await storage.getUserByEmail("david@technova.com");
    if (!clientUser) {
      clientUser = await storage.createUser({
        email: "david@technova.com",
        username: "client",
        password: await hashPassword("Client123!"),
        firstName: "David",
        lastName: "Chen",
        roleId: clientRole.id,
        organizationId: organization.id,
        isActive: true,
      });
      console.log("✅ Client User created: David Chen");
    } else {
      console.log("✅ Client User already exists: David Chen");
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("📋 PERSISTENT SEED ACCOUNTS - ROLEPLAY SCENARIO");
    console.log("=".repeat(70));
    console.log("\n🏢 ORGANIZATION: Sterling Accounting Firm");
    console.log("   Slug: sterling-accounting");
    
    console.log("\n🔴 SUPER ADMIN (Platform Management):");
    console.log("   Email:    superadmin@accute.com");
    console.log("   Password: SuperAdmin123!");
    console.log("   Name:     Super Admin");
    console.log("   Scope:    Platform-level");
    
    console.log("\n🟠 ADMIN (Organization Owner):");
    console.log("   Email:        admin@sterling.com");
    console.log("   Password:     Admin123!");
    console.log("   Name:         Sarah Sterling");
    console.log("   Organization: Sterling Accounting Firm");
    
    console.log("\n🟡 EMPLOYEE (Team Member):");
    console.log("   Email:        employee@sterling.com");
    console.log("   Password:     Employee123!");
    console.log("   Name:         John Matthews");
    console.log("   Organization: Sterling Accounting Firm");
    
    console.log("\n🟢 CLIENT USER (Client Portal Access):");
    console.log("   Email:        david@technova.com");
    console.log("   Password:     Client123!");
    console.log("   Name:         David Chen (CFO)");
    console.log("   Organization: Sterling Accounting Firm");
    
    console.log("\n💼 CLIENT COMPANY:");
    console.log("   Company:      TechNova Solutions");
    console.log("   Industry:     Technology");
    console.log("   Status:       Active");
    console.log("   Tax ID:       94-7654321");
    console.log("   Assigned To:  Sarah Sterling (Admin)");
    
    console.log("\n👤 CONTACT (Point of Contact):");
    console.log("   Name:         David Chen");
    console.log("   Title:        CFO");
    console.log("   Email:        david@technova.com");
    console.log("   Primary:      Yes");
    
    console.log("\n" + "=".repeat(70));
    console.log("✨ All persistent seed accounts ready for roleplay!");
    console.log("=".repeat(70));
    console.log("\n📝 ROLEPLAY SCENARIO:");
    console.log("   • Sarah Sterling (Admin) owns Sterling Accounting Firm");
    console.log("   • John Matthews (Employee) works at Sterling Accounting Firm");
    console.log("   • TechNova Solutions is a client onboarded at Sterling");
    console.log("   • David Chen (CFO) is the contact for TechNova");
    console.log("   • David Chen has portal access to track his company's work");
    console.log("=".repeat(70) + "\n");

  } catch (error: any) {
    console.error("❌ Error creating persistent seed accounts:", error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createPersistentSeedAccounts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default createPersistentSeedAccounts;
