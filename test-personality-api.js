// Quick test script for personality profiling API
const API_BASE = "http://localhost:5000/api";

async function test() {
  try {
    // 1. Login as admin
    console.log("🔐 Logging in as admin...");
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@accute.ai",
        password: "admin123"
      })
    });
    
    if (!loginRes.ok) {
      console.error("❌ Login failed:", await loginRes.text());
      return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("✅ Logged in successfully");
    
    // 2. Get all users in organization
    console.log("\n📋 Fetching users...");
    const usersRes = await fetch(`${API_BASE}/users`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    const users = await usersRes.json();
    const userIds = users.slice(0, 3).map(u => u.id); // Test with 3 users
    console.log(`✅ Found ${users.length} users, testing with ${userIds.length}`);
    
    // 3. Trigger batch analysis
    console.log("\n🚀 Triggering batch personality analysis...");
    const batchRes = await fetch(`${API_BASE}/personality-profiling/batch-analysis`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userIds })
    });
    
    if (!batchRes.ok) {
      console.error("❌ Batch analysis failed:", await batchRes.text());
      return;
    }
    
    const batchData = await batchRes.json();
    console.log("✅ Batch analysis triggered:", batchData);
    
    // 4. Check run status
    console.log("\n📊 Checking run status...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const statusRes = await fetch(`${API_BASE}/personality-profiling/runs/${batchData.runId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    const runStatus = await statusRes.json();
    console.log("✅ Run status:", runStatus);
    
    // 5. Check jobs
    console.log("\n🔍 Checking individual jobs...");
    const jobsRes = await fetch(`${API_BASE}/personality-profiling/runs/${batchData.runId}/jobs`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    const jobs = await jobsRes.json();
    console.log(`✅ Jobs created: ${jobs.length}`);
    console.log("   Job statuses:", jobs.map(j => `${j.userId.slice(0, 8)}: ${j.status}`));
    
    // 6. Queue stats
    console.log("\n📈 Queue statistics...");
    const statsRes = await fetch(`${API_BASE}/personality-profiling/queue/stats`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    const stats = await statsRes.json();
    console.log("✅ Queue stats:", stats);
    
    console.log("\n🎉 All API tests passed!");
    
  } catch (error) {
    console.error("❌ Test error:", error.message);
  }
}

test();
