# 🚨 EMERGENCY: Data Loss Recovery Guide

## If You Just Lost Data After Publishing

### Option 1: Replit Rollback (Fastest)

Replit has automatic checkpoints of your workspace:

1. **In your Replit workspace**: Look for the "History" or "Rollback" button
2. **Select a checkpoint** from BEFORE you published
3. **Restore** the checkpoint
4. This might restore both your code AND database to previous state

⚠️ **Important**: This rolls back EVERYTHING, including code changes

---

### Option 2: Database Pane Manual Restore

If you exported data before (or if Replit has backups):

1. Open **Database** pane in Replit
2. Toggle to **Production** database
3. Click **Import** 
4. Upload your CSV/SQL backup files
5. Data will be restored

---

### Option 3: Contact Replit Support (For Critical Loss)

Your production database is hosted on **Neon** (PostgreSQL provider):

1. **Neon has point-in-time recovery** - They might be able to restore your database
2. **Contact Replit Support** immediately:
   - Explain you lost production data during publish
   - Provide the time when data was lost
   - Request point-in-time recovery from Neon

3. **Be specific**:
   - "I published at [TIME] and lost all data in tables: clients, llm_configurations"
   - "I need to restore to [TIME BEFORE PUBLISH]"
   - "Database: [YOUR DATABASE_URL host]"

---

## Prevent Future Data Loss

### Before EVERY Publish:

```bash
# 1. Check what will change
./check-schema-safety.sh

# 2. If safe, backup production data
# → Use Database Pane → Production → Export to CSV

# 3. Test in dev first
npm run db:push
# Test your app in dev workspace

# 4. THEN publish
```

---

## Quick Backup: Export Production Data NOW

1. Open Replit workspace
2. Click **Database** icon (left sidebar)
3. Toggle to **Production** database
4. For each important table:
   - Click table name
   - Click **Export** or copy data
   - Save CSV file locally

**Critical tables to backup:**
- ✅ users
- ✅ organizations  
- ✅ clients
- ✅ llm_configurations
- ✅ workflows
- ✅ projects
- ✅ contacts

---

## What Went Wrong (Understanding the Issue)

When you published, this happened:

```
1. You have schema.ts in your code
2. Production database had different schema (old version)
3. Replit ran: drizzle-kit push --force
4. This made production database match your code
5. Any columns/tables not in code → DELETED from production
```

**Example of what happened:**

```typescript
// Your old code (production had this data)
export const clients = pgTable("clients", {
  id: serial("id"),
  companyName: text("company_name"),
  email: text("email"), // ← Production had data here
});

// You updated code to this
export const clients = pgTable("clients", {
  id: serial("id"),
  name: text("name"), // ← renamed from companyName
  // email removed ❌
});

// On publish: Dropped email column = ALL EMAILS LOST
// And companyName column was dropped/recreated as name = DATA LOST
```

---

## Moving Forward: Safe Schema Changes

### ✅ DO THIS:
```typescript
// Add new columns (safe - no data loss)
newColumn: text("new_column"),

// Make columns nullable (safe - existing data stays)
email: text("email"), // not .notNull()

// Add defaults for required fields (safe)
status: text("status").default("active").notNull(),
```

### ❌ NEVER DO THIS:
```typescript
// Remove columns directly (DANGEROUS - data loss)
// email: text("email"), ← commented out = WILL BE DROPPED

// Rename columns directly (DANGEROUS - data loss)
// companyName → name = OLD COLUMN DROPPED

// Change types (DANGEROUS - data corruption)
id: varchar("id"), // was serial("id") = DATA LOST

// Add NOT NULL without default (BREAKS if table has data)
newField: text("new_field").notNull(), // ❌
```

---

## Checklist Before Publishing

- [ ] Run `./check-schema-safety.sh` - no warnings?
- [ ] Exported production data to CSV (Database Pane)
- [ ] Tested schema changes in dev first
- [ ] No columns removed from schema
- [ ] No columns renamed without migration plan
- [ ] All new required fields have defaults
- [ ] Read the dry-run SQL output and understood it

---

## Emergency Contacts

- **Replit Support**: support@replit.com
- **Database Provider**: Neon (via Replit)
- **Recovery Window**: Usually 7-30 days for point-in-time recovery

---

**Remember**: Prevention is better than recovery. Always backup before publishing!
