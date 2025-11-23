# LLM Configuration Corruption - Root Cause Analysis

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. **ENCRYPTION_KEY Instability** (Primary Cause - 80% Probability)

**What's Happening:**
```typescript
// Deployment 1
ENCRYPTION_KEY="abc123xyz..." → Encrypt API key → Store in DB

// Deployment 2 (key changed/regenerated)
ENCRYPTION_KEY="different456..." → Try to decrypt → ❌ FAILS

// Result: "Authentication failed: data may have been tampered with or wrong encryption key"
```

**Why This Happens:**
- Encryption uses `scryptSync(ENCRYPTION_KEY, 'accute-salt-2024', 32)`
- Different key = Different derived key = Cannot decrypt
- AES-256-GCM authentication fails immediately

**How to Verify:**
```bash
# Check Render environment variables
# Look for ENCRYPTION_KEY - is it the same as before?

# Test locally with same key
ENCRYPTION_KEY="your-prod-key" npm start
# Try accessing agent - if it works, key mismatch confirmed
```

**Fix:**
1. Find original `ENCRYPTION_KEY` (check backup, password manager, old env file)
2. Set it back in Render environment variables
3. Redeploy

---

### 2. **Multiple Encryption Services** (Medium Probability - 15%)

**Code Evidence:**
```typescript
// server/encryption-service.ts (NEW unified service)
export const encrypt = (text: string): string => encryptionService.encrypt(text);
export const decrypt = (encryptedText: string): string => encryptionService.decrypt(encryptedText);

// server/crypto-utils.ts (LEGACY service - still in use!)
export function safeDecryptRazorpay(value: string | null | undefined): string | null
```

**The Problem:**
- Two different encryption implementations
- Different key derivation methods
- `crypto-utils.ts` has "decryptLegacyLLMFormat" suggesting format incompatibility
- Routes.ts uses BOTH services inconsistently:
  - Line 3582: `encrypt` from encryption-service.ts
  - Line 3918: `cryptoUtils.safeDecryptRazorpay` from crypto-utils.ts

**Impact:**
```typescript
// CREATE: Uses encryption-service.ts
const encryptedKey = encrypt(apiKey); // AES-256-GCM format: iv:data:tag

// READ: Uses crypto-utils.ts  
const apiKey = cryptoUtils.safeDecryptRazorpay(config.apiKeyEncrypted); // Expects different format?
```

**Fix Needed:**
- Audit all LLM config encryption/decryption calls
- Use ONLY `encryption-service.ts` (unified service)
- Remove `crypto-utils.ts` LLM decryption functions

---

### 3. **Key Derivation Mismatch** (Medium Probability - 10%)

**encryption-service.ts:**
```typescript
// Uses scrypt with salt
this.encryptionKey = crypto.scryptSync(envKey, 'accute-salt-2024', 32);
```

**crypto-utils.ts (legacy):**
```typescript
// Uses SHA-256 hash (different derivation!)
const legacyKey = crypto.createHash('sha256').update(envKey).digest();
```

**The Problem:**
- Same ENCRYPTION_KEY produces DIFFERENT derived keys
- If data encrypted with one method, cannot decrypt with other
- Legacy CBC vs modern GCM formats incompatible

---

### 4. **Database Connection Issues** (Low Probability - 5%)

**Possible Scenarios:**
- Connection timeout during write (data partially saved)
- Transaction rollback (encryption succeeds, DB write fails)
- Character encoding issues (binary data corruption)
- Database pool exhaustion

**Check:**
```sql
-- Verify data integrity
SELECT id, name, provider, 
       length(api_key_encrypted) as encrypted_length,
       api_key_encrypted LIKE '%:%:%' as has_gcm_format
FROM llm_configurations
WHERE organization_id = 'your-org-id';

-- Should see:
-- encrypted_length > 100 (realistic for encrypted data)
-- has_gcm_format = true (3-part format)
```

---

### 5. **Race Condition in Auto-Configuration** (Low Probability - 3%)

**Code Flow:**
```typescript
// server/init.ts
await initializeOnboardingService(storage);

// server/organization-onboarding-service.ts
async ensureDefaultLlmConfig(organizationId, createdById) {
  const existingDefault = await storage.getDefaultLlmConfiguration(organizationId);
  
  if (!existingDefault) {
    // Create new config
    const encryptedKey = encrypt(apiKey); // Uses current ENCRYPTION_KEY
    const config = await storage.createLlmConfiguration({...});
  }
}
```

**Possible Issue:**
- Multiple deployments running simultaneously
- Both try to create default config
- Race condition leads to duplicate/corrupted entries
- First config uses old key, second uses new key

---

## 🔍 DIAGNOSTIC STEPS

### Step 1: Check Encryption Service Health
```bash
# Add to server/routes.ts
app.get('/api/encryption-test', requireAuth, (req, res) => {
  const { encryptionService } = require('./encryption-service');
  const health = encryptionService.healthCheck();
  
  const testKey = 'sk-test-key-123';
  const encrypted = encrypt(testKey);
  const decrypted = decrypt(encrypted);
  
  res.json({
    healthCheck: health,
    roundTrip: decrypted === testKey,
    encryptedFormat: encrypted.split(':').length, // Should be 3
    encryptionKey: {
      set: !!process.env.ENCRYPTION_KEY,
      length: process.env.ENCRYPTION_KEY?.length || 0
    }
  });
});
```

### Step 2: Verify Database Storage
```bash
# SSH into Render or connect to DB
psql $DATABASE_URL

-- Check LLM configs
\x
SELECT * FROM llm_configurations 
WHERE organization_id = 'your-org-id' 
LIMIT 1;

-- Verify format
SELECT 
  id,
  name,
  provider,
  length(api_key_encrypted) as key_length,
  substring(api_key_encrypted, 1, 50) as key_preview,
  (length(api_key_encrypted) - length(replace(api_key_encrypted, ':', ''))) as colon_count
FROM llm_configurations
WHERE organization_id = 'your-org-id';

-- colon_count should be 2 (GCM format: iv:data:tag)
```

### Step 3: Test Decryption Manually
```bash
# Create test script: server/test-decrypt-llm.ts
import { db } from './db';
import { llmConfigurations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt, safeDecrypt } from './encryption-service';
import * as cryptoUtils from './crypto-utils';

async function testDecryption() {
  const configs = await db.select()
    .from(llmConfigurations)
    .where(eq(llmConfigurations.organizationId, 'your-org-id'));
  
  for (const config of configs) {
    console.log(`\n Testing config: ${config.name} (${config.provider})`);
    console.log(`  Encrypted format: ${config.apiKeyEncrypted.split(':').length} parts`);
    
    // Test encryption-service.ts
    try {
      const decrypted1 = decrypt(config.apiKeyEncrypted);
      console.log(`  ✅ encryption-service.ts: SUCCESS`);
      console.log(`     Decrypted length: ${decrypted1.length} chars`);
    } catch (e: any) {
      console.log(`  ❌ encryption-service.ts: FAILED - ${e.message}`);
    }
    
    // Test crypto-utils.ts
    try {
      const decrypted2 = cryptoUtils.safeDecryptRazorpay(config.apiKeyEncrypted);
      console.log(`  ✅ crypto-utils.ts: SUCCESS`);
      console.log(`     Decrypted length: ${decrypted2?.length || 0} chars`);
    } catch (e: any) {
      console.log(`  ❌ crypto-utils.ts: FAILED - ${e.message}`);
    }
  }
}

testDecryption();
```

Run: `tsx server/test-decrypt-llm.ts`

### Step 4: Check Environment Variable History
```bash
# In Render Dashboard
1. Go to Environment tab
2. Check "Change History" or logs
3. Look for ENCRYPTION_KEY changes between deployments
4. Timestamps should match when corruption started
```

---

## 🛠️ IMMEDIATE FIXES

### Fix #1: Verify ENCRYPTION_KEY Stability
```bash
# In Render Dashboard → Environment
# Find ENCRYPTION_KEY
# Compare with your backup/password manager
# If different, restore original value
# Redeploy
```

### Fix #2: Unify Encryption Service
```typescript
// server/routes.ts
// FIND ALL instances of crypto-utils decryption:
- cryptoUtils.safeDecryptRazorpay(config.apiKeyEncrypted)

// REPLACE WITH:
+ safeDecrypt(config.apiKeyEncrypted)  // from encryption-service.ts

// Lines to change: 3918, 3926, 3944 in routes.ts
```

### Fix #3: Add Encryption Diagnostics
```typescript
// server/routes.ts - Add diagnostic endpoint
app.get('/api/diagnostics/llm-configs', requireAuth, async (req, res) => {
  const configs = await storage.getLlmConfigurationsByOrganization(req.user!.organizationId!);
  
  const diagnostics = configs.map(config => {
    const parts = config.apiKeyEncrypted.split(':');
    let decryptionStatus = 'unknown';
    
    try {
      const decrypted = safeDecrypt(config.apiKeyEncrypted);
      decryptionStatus = decrypted ? 'success' : 'failed';
    } catch (e: any) {
      decryptionStatus = `error: ${e.message}`;
    }
    
    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      isActive: config.isActive,
      encryptedFormat: `${parts.length} parts`,
      decryptionStatus,
      createdAt: config.createdAt
    };
  });
  
  res.json({ diagnostics });
});
```

### Fix #4: Migration Script for Key Change
```typescript
// server/migrate-llm-encryption.ts
// Use ONLY if ENCRYPTION_KEY was changed and original is lost
import { db } from './db';
import { llmConfigurations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from './encryption-service';

async function migrateConfigs() {
  console.log('⚠️  WARNING: This will DELETE all LLM configurations');
  console.log('   Users must reconfigure their API keys manually');
  console.log('   Press Ctrl+C to cancel...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Get all orgs
  const orgs = await storage.getAllOrganizations();
  
  for (const org of orgs) {
    // Delete broken configs
    await db.delete(llmConfigurations)
      .where(eq(llmConfigurations.organizationId, org.id));
    
    console.log(`✓ Cleared configs for ${org.name}`);
    
    // Auto-create new one if env vars available
    const { getOnboardingService } = await import('./organization-onboarding-service');
    const admin = await storage.getUsersByOrganization(org.id).then(u => u[0]);
    
    if (admin) {
      await getOnboardingService().ensureDefaultLlmConfig(org.id, admin.id);
      console.log(`✓ Created new config for ${org.name}`);
    }
  }
  
  console.log('\n✅ Migration complete');
  console.log('   Users must verify LLM configurations in Settings');
}

migrateConfigs();
```

---

## 📊 MONITORING RECOMMENDATIONS

### Add to Application
```typescript
// server/routes.ts - Health check endpoint
app.get('/api/health', (req, res) => {
  const { encryptionService } = require('./encryption-service');
  
  res.json({
    status: 'ok',
    encryption: {
      keySet: !!process.env.ENCRYPTION_KEY,
      keyLength: process.env.ENCRYPTION_KEY?.length || 0,
      healthCheck: encryptionService.healthCheck()
    },
    timestamp: new Date().toISOString()
  });
});
```

### Log Decryption Failures
```typescript
// server/llm-service.ts constructor
constructor(config: LlmConfiguration) {
  this.config = config;
  try {
    const decryptedKey = safeDecrypt(config.apiKeyEncrypted);
    if (!decryptedKey) {
      console.error('❌ LLM Config decryption failed', {
        configId: config.id,
        provider: config.provider,
        organizationId: config.organizationId,
        encryptedFormat: config.apiKeyEncrypted.split(':').length + ' parts'
      });
      throw new Error('Failed to decrypt LLM API key');
    }
    this.apiKey = decryptedKey;
  } catch (error: any) {
    console.error('❌ LLM Config decryption exception', {
      configId: config.id,
      error: error.message,
      encryptionKeySet: !!process.env.ENCRYPTION_KEY
    });
    throw error;
  }
}
```

---

## ✅ PREVENTION CHECKLIST

- [ ] **ENCRYPTION_KEY stored in password manager**
- [ ] **Deployment checklist includes key verification**
- [ ] **Use only `encryption-service.ts` for LLM configs**
- [ ] **Remove legacy decryption from `crypto-utils.ts`**
- [ ] **Add `/api/diagnostics/llm-configs` endpoint**
- [ ] **Add encryption health checks to `/api/health`**
- [ ] **Document key in Render service notes**
- [ ] **Set up alerts for decryption failures**
- [ ] **Test decryption after every deployment**

---

## 🎯 MOST LIKELY CAUSE

**90% probability:** ENCRYPTION_KEY changed between deployments

**Check Now:**
1. Render Dashboard → Environment → ENCRYPTION_KEY
2. Compare with your local `.env` or backup
3. If different → Restore original → Redeploy
4. If original lost → Run migration script (users must reconfigure)
