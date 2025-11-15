# 🗄️ Production Database Management Guide

## ⚠️ CRITICAL: Understanding Dev vs Production Databases

### Two Separate Databases
- **Development Database**: Used in your workspace (DATABASE_URL in .env)
- **Production Database**: Used by published app (separate connection string)
- **Schema changes in dev AUTOMATICALLY APPLY to production on publish**

---

## 🚨 The Problem: Data Loss on Publish

When you publish, Replit runs `drizzle-kit push` which:
1. Compares your code schema to production database
2. Generates SQL to make production match your code
3. **Can drop tables/columns if they're not in your code**

### Example of Data-Destroying Changes:
```typescript
// OLD SCHEMA (production has this data)
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(), // ⚠️ If you remove this...
});

// NEW SCHEMA (you change code to this)
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // email removed ❌
});

// On publish: Production database DROPS email column = ALL EMAIL DATA LOST
```

---

## ✅ SAFE Production Workflow

### 1. NEVER Remove Columns Directly
Instead of removing, mark as deprecated first:

```typescript
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // @deprecated - Will be removed in next major version
  email: text("email"),  // Made nullable instead of removing
  newEmail: text("new_email").notNull(), // Add new column first
});
```

### 2. Add Before You Remove
Always add new columns/tables BEFORE removing old ones:

```typescript
// Step 1: Add new column (safe - no data loss)
newColumn: text("new_column"),

// Step 2: Backfill data in production manually

// Step 3: THEN remove old column in next deploy
```

### 3. Use Nullable Columns for New Fields
```typescript
// ❌ BAD - Breaks production if table has existing rows
newField: text("new_field").notNull(),

// ✅ GOOD - Safe for existing data
newField: text("new_field"), // nullable
// OR
newField: text("new_field").default("default_value"),
```

### 4. Test Schema Changes Before Publishing

Before you publish:
```bash
# 1. Review what will change
npm run db:push -- --dry-run  # See SQL that will run

# 2. If safe, apply to dev
npm run db:push

# 3. Test app in dev thoroughly

# 4. THEN publish
```

---

## 🔍 How to Check Production Database

### Via Replit Database Pane:
1. Open your Replit workspace
2. Click **Database** icon in left sidebar
3. Toggle to **Production** database
4. View your live production data
5. You can manually query or edit (be VERY careful!)

### Never Let Agent Touch Production:
- Agent can only edit DEVELOPMENT database
- Schema changes auto-apply to production on publish
- Always review changes before publishing

---

## 💾 Data Backup Strategy

### Before Major Schema Changes:

1. **Manual Backup via Database Pane**:
   - Switch to Production database
   - Export tables as CSV
   - Store backup safely

2. **Schema Migration Checklist**:
   - [ ] Is this change backward compatible?
   - [ ] Will existing data remain intact?
   - [ ] Do I need to backfill data?
   - [ ] Have I tested in dev first?
   - [ ] Do I have a backup?

---

## 🚀 Safe Publishing Checklist

Before every publish:

- [ ] No columns removed from schema
- [ ] All new required fields have defaults
- [ ] No data type changes on existing columns
- [ ] Tested in development first
- [ ] Backed up production data (if risky change)
- [ ] Reviewed `drizzle-kit push --dry-run` output

---

## 🆘 Emergency: Data Already Lost

If you've already lost data:

### Option 1: Replit Rollback (if recent)
1. Use Replit's rollback feature to restore workspace
2. This might restore database to previous state

### Option 2: Restore from Backup
1. If you have CSV backups, re-import them
2. Use Database Pane → Production → Import

### Option 3: Contact Support
- If critical business data lost
- Neon (database provider) may have point-in-time recovery
- Contact Replit support immediately

---

## 📋 Current Schema Inventory

Your app has these critical tables with user data:
- `users` - User accounts
- `organizations` - Workspaces
- `clients` - Client records ⚠️
- `llm_configurations` - LLM API keys ⚠️
- `workflows` - User workflows
- `projects` - Projects data
- `contacts` - Contact records

**All of these tables will be affected by schema changes!**

---

## 🎯 Best Practices Summary

1. **Additive Changes Only** - Add new columns, don't remove old ones
2. **Nullable New Fields** - Don't require data that doesn't exist yet
3. **Test First** - Always test in dev before publishing
4. **Backup Critical Data** - Before major schema changes
5. **Read Dry-Run Output** - Know what SQL will execute
6. **Gradual Migration** - Phase changes over multiple deploys
7. **Document Changes** - Track what changed and why

---

## 🔧 Quick Reference Commands

```bash
# See what will change (DON'T EXECUTE)
npm run db:push -- --dry-run

# Apply to dev database
npm run db:push

# Force push if you get warnings (USE WITH CAUTION)
npm run db:push -- --force

# View production database
# Use Database Pane → Toggle to Production
```

---

## ⚡ TL;DR - Stop Data Loss

1. **Dev ≠ Production** - You have two separate databases
2. **Schema changes auto-apply** - When you publish
3. **Never remove columns** - Mark deprecated instead
4. **Add before remove** - Multi-phase migrations
5. **Test in dev first** - Always
6. **Backup before risky changes** - Database Pane → Export
7. **Use dry-run** - See what will happen before it happens

---

**When in doubt: DON'T PUBLISH until you understand the schema changes!**
