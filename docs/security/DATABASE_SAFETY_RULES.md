# 🛡️ Database Safety Rules - READ BEFORE ANY SCHEMA CHANGES

## The One Rule That Prevents Data Loss:

**ONLY ADD to `shared/schema.ts` - NEVER remove or rename**

---

## ✅ SAFE Changes (These are always safe to publish):

```typescript
// ✅ Adding a NEW column
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey(),
  companyName: text("company_name").notNull(),
  email: text("email").notNull(),
  newColumn: text("new_column"),  // ← SAFE: Adding new field
});

// ✅ Adding a NEW table
export const newTable = pgTable("new_table", {
  id: varchar("id").primaryKey(),
  name: text("name"),
});

// ✅ Making a column nullable
phone: text("phone"),  // ← SAFE: Was .notNull(), now nullable

// ✅ Adding a default value
status: text("status").default("active"),  // ← SAFE: Adding default
```

---

## ❌ DANGEROUS Changes (These will DELETE production data):

```typescript
// ❌ REMOVING a column
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey(),
  companyName: text("company_name").notNull(),
  // email: text("email"),  ← DELETED = ALL EMAILS LOST IN PRODUCTION
});

// ❌ RENAMING a column
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey(),
  name: text("name"),  // ← Was "company_name", renamed to "name"
  // = OLD COLUMN DROPPED, DATA LOST
});

// ❌ REMOVING a table
// export const clients = pgTable(...)  ← DELETED = ENTIRE TABLE LOST

// ❌ CHANGING column type
id: text("id"),  // ← Was varchar("id"), now text = DATA LOST
```

---

## 📋 What To Do Instead:

### If you need to "remove" a column:
```typescript
// Don't remove it - mark as deprecated
email: text("email"),  // @deprecated - Will remove in v2.0
```

### If you need to "rename" a column:
```typescript
// Step 1: Add new column
companyName: text("company_name"),  // Old
name: text("name"),  // New

// Step 2: Publish (both columns exist now)
// Step 3: Update code to use new column
// Step 4: MUCH LATER, mark old as deprecated (don't remove)
```

### If you need to change a type:
```typescript
// Step 1: Add new column with new type
oldField: text("old_field"),  // Existing
newField: integer("new_field"),  // New type

// Step 2: Publish
// Step 3: Migrate data manually in production
// Step 4: Update code to use newField
// Step 5: Mark oldField as deprecated (don't remove)
```

---

## 📝 Before Publishing Checklist:

1. **Did `shared/schema.ts` change?**
   - If NO → Safe to publish
   - If YES → Continue to step 2

2. **What changed?**
   - Only NEW columns/tables added? → ✅ Safe to publish
   - Columns/tables removed or renamed? → ❌ DON'T PUBLISH

3. **Backup production data** (just in case):
   - Database Pane → Production → Export to CSV
   - Save: clients, llm_configurations, users, organizations

4. **Then publish**

---

## 🎯 Why This Matters:

When you click "Publish" in Replit:
1. Replit looks at your `shared/schema.ts` file
2. Compares it to production database structure
3. Automatically runs SQL to make production match your code
4. If columns are missing from schema → **Deletes them from production**
5. All data in deleted columns → **PERMANENTLY LOST**

---

## 💾 Emergency Backup Instructions:

**Manual Backup (Do this before risky changes):**

1. Open Replit workspace
2. Click **Database** icon (left sidebar)
3. Toggle to **Production** database
4. For each important table:
   - Click table name
   - Click **"..."** menu → Export
   - Save CSV file locally

**Critical tables to backup:**
- users
- organizations
- clients
- llm_configurations
- workflows
- projects
- contacts

---

## 🆘 If Data Was Lost:

1. **Replit Rollback**:
   - Checkpoints → Select before publish → Rollback
   - Check "Restore databases" option

2. **Import from Backup**:
   - Database Pane → Production → Import CSV

3. **Contact Support**:
   - Neon (database provider) has 7-30 day point-in-time recovery
   - Email support@replit.com with timestamp of data loss

---

## 🔐 Summary:

**Golden Rule**: Think of `shared/schema.ts` as **append-only**. You can add to it, but never subtract from it.

This single rule prevents 99% of data loss scenarios.
