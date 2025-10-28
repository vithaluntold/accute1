import { storage } from "./storage";
import { hashPassword } from "./auth";

async function createTestUsers() {
  console.log("🚀 Creating test users for all roles...\n");

  try {
    // Use unique timestamp for usernames to avoid conflicts
    const timestamp = Date.now();
    
    // ==================== 1. SUPER ADMIN ====================
    console.log("1️⃣ Creating Super Admin...");
    
    const superAdminRole = await storage.getRoleByName("Super Admin");
    if (!superAdminRole) {
      throw new Error("Super Admin role not found. Run seed script first.");
    }

    // Create Super Admin user directly
    const superAdminUsername = `superadmin_${timestamp}`;
    const superAdminEmail = `superadmin_${timestamp}@accute.com`;
    const superAdminPassword = "SuperAdmin123!";
    const superAdmin = await storage.createUser({
      email: superAdminEmail,
      username: superAdminUsername,
      password: await hashPassword(superAdminPassword),
      firstName: "Super",
      lastName: "Administrator",
      roleId: superAdminRole.id,
      organizationId: null, // Platform-scoped
      isActive: true,
    });

    console.log("✅ Super Admin created:");
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Username: ${superAdminUsername}`);
    console.log(`   Password: ${superAdminPassword}\n`);

    // ==================== 2. ADMIN (creates organization) ====================
    console.log("2️⃣ Creating Admin with Organization...");
    
    // Create organization with unique slug
    const organization = await storage.createOrganization({
      name: "Acme Accounting Firm",
      slug: `acme-accounting-${timestamp}`,
      settings: {},
    });

    const adminRole = await storage.getRoleByName("Admin");
    if (!adminRole) {
      throw new Error("Admin role not found. Run seed script first.");
    }

    // Create Admin user
    const adminUsername = `admin_${timestamp}`;
    const adminEmail = `admin_${timestamp}@acme.com`;
    const adminPassword = "Admin123!";
    const admin = await storage.createUser({
      email: adminEmail,
      username: adminUsername,
      password: await hashPassword(adminPassword),
      firstName: "Alice",
      lastName: "Administrator",
      roleId: adminRole.id,
      organizationId: organization.id,
      isActive: true,
    });

    console.log("✅ Admin created:");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Organization: ${organization.name}\n`);

    // ==================== 3. CLIENT (company) ====================
    console.log("3️⃣ Creating Client (Company)...");
    
    const clientEmail = `bob_${timestamp}@techstartup.com`;
    const client = await storage.createClient({
      companyName: "TechStartup Inc.",
      contactName: "Bob Builder",
      email: clientEmail,
      phone: "+1-555-0123",
      address: "123 Tech Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "US",
      taxId: "12-3456789",
      organizationId: organization.id,
      assignedTo: admin.id,
      status: "active",
      industry: "Technology",
      notes: "Fast-growing SaaS company",
      metadata: {},
      createdBy: admin.id,
    });

    console.log("✅ Client (Company) created:");
    console.log(`   Company Name: ${client.companyName}`);
    console.log(`   Tax ID: ${client.taxId}`);
    console.log(`   Status: ${client.status}\n`);

    // ==================== 4. CONTACT (Person - POC) ====================
    console.log("4️⃣ Creating Contact (POC for Client)...");
    
    const contact = await storage.createContact({
      clientId: client.id,
      firstName: "Bob",
      lastName: "Builder",
      email: clientEmail,
      phone: "+1-555-0123",
      title: "CEO",
      department: "Executive",
      isPrimary: true,
      notes: "Primary contact and decision maker",
      organizationId: organization.id,
      createdBy: admin.id,
    });

    console.log("✅ Contact (POC) created:");
    console.log(`   Name: ${contact.firstName} ${contact.lastName}`);
    console.log(`   Title: ${contact.title}`);
    console.log(`   Email: ${contact.email}`);
    console.log(`   Primary: ${contact.isPrimary}\n`);

    // ==================== 5. EMPLOYEE ====================
    console.log("5️⃣ Creating Employee...");
    
    const employeeRole = await storage.getRoleByName("Employee");
    if (!employeeRole) {
      throw new Error("Employee role not found. Run seed script first.");
    }

    const employeeUsername = `employee_${timestamp}`;
    const employeeEmail = `employee_${timestamp}@acme.com`;
    const employeePassword = "Employee123!";
    const employee = await storage.createUser({
      email: employeeEmail,
      username: employeeUsername,
      password: await hashPassword(employeePassword),
      firstName: "Emily",
      lastName: "Employee",
      roleId: employeeRole.id,
      organizationId: organization.id,
      isActive: true,
    });

    console.log("✅ Employee created:");
    console.log(`   Email: ${employeeEmail}`);
    console.log(`   Username: ${employeeUsername}`);
    console.log(`   Password: ${employeePassword}`);
    console.log(`   Organization: ${organization.name}\n`);

    // ==================== 6. CLIENT USER ====================
    console.log("6️⃣ Creating Client User...");
    
    const clientRole = await storage.getRoleByName("Client");
    if (!clientRole) {
      throw new Error("Client role not found. Run seed script first.");
    }

    const clientUsername = `client_${timestamp}`;
    const clientUserPassword = "Client123!";
    const clientUser = await storage.createUser({
      email: clientEmail, // Same email as contact
      username: clientUsername,
      password: await hashPassword(clientUserPassword),
      firstName: "Bob",
      lastName: "Builder",
      roleId: clientRole.id,
      organizationId: organization.id,
      isActive: true,
    });

    console.log("✅ Client User created:");
    console.log(`   Email: ${clientEmail}`);
    console.log(`   Username: ${clientUsername}`);
    console.log(`   Password: ${clientUserPassword}`);
    console.log(`   Linked to Client: ${client.companyName}`);
    console.log(`   Organization: ${organization.name}\n`);

    // ==================== SUMMARY ====================
    console.log("=" .repeat(70));
    console.log("📋 CREDENTIALS SUMMARY");
    console.log("=" .repeat(70));
    console.log("\n🔴 SUPER ADMIN (Platform-level - SaaS Management):");
    console.log(`   Email:    ${superAdminEmail}`);
    console.log(`   Username: ${superAdminUsername}`);
    console.log(`   Password: ${superAdminPassword}`);
    console.log(`   Scope:    Platform (organizationId: null)`);
    
    console.log("\n🟠 ADMIN (Tenant-level - Organization Admin):");
    console.log(`   Email:        ${adminEmail}`);
    console.log(`   Username:     ${adminUsername}`);
    console.log(`   Password:     ${adminPassword}`);
    console.log(`   Organization: ${organization.name}`);
    console.log(`   Scope:        Tenant`);
    
    console.log("\n🟡 EMPLOYEE (Tenant-level - Staff Member):");
    console.log(`   Email:        ${employeeEmail}`);
    console.log(`   Username:     ${employeeUsername}`);
    console.log(`   Password:     ${employeePassword}`);
    console.log(`   Organization: ${organization.name}`);
    console.log(`   Scope:        Tenant`);
    
    console.log("\n🟢 CLIENT USER (Tenant-level - Client Portal Access):");
    console.log(`   Email:        ${clientEmail}`);
    console.log(`   Username:     ${clientUsername}`);
    console.log(`   Password:     ${clientUserPassword}`);
    console.log(`   Organization: ${organization.name}`);
    console.log(`   Linked to:    ${client.companyName}`);
    console.log(`   Scope:        Tenant`);
    
    console.log("\n💼 CLIENT COMPANY (Prerequisite for Client User):");
    console.log(`   Company:      ${client.companyName}`);
    console.log(`   Industry:     ${client.industry}`);
    console.log(`   Status:       ${client.status}`);
    console.log(`   Tax ID:       ${client.taxId}`);
    
    console.log("\n👤 CONTACT (POC for Client Company):");
    console.log(`   Name:         ${contact.firstName} ${contact.lastName}`);
    console.log(`   Title:        ${contact.title}`);
    console.log(`   Email:        ${contact.email}`);
    console.log(`   Primary:      ${contact.isPrimary ? 'Yes' : 'No'}`);
    
    console.log("\n" + "=" .repeat(70));
    console.log("✨ All test users created successfully!");
    console.log("=" .repeat(70));
    console.log("\n📝 NOTES:");
    console.log("   • Super Admin: Platform-scoped role for SaaS management");
    console.log("   • Admin/Employee/Client: Tenant-scoped roles for organization");
    console.log("   • Client user is linked to Client company via matching email");
    console.log("   • Contact represents the POC (Point of Contact) for the client");
    console.log("=" .repeat(70) + "\n");

  } catch (error: any) {
    console.error("❌ Error creating test users:", error.message);
    throw error;
  }
}

// Run if executed directly
createTestUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
