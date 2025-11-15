# ✅ Safe Publishing Checklist

## Before EVERY Publish - Follow These Steps:

### Step 1: Check Schema Safety
```bash
./check-schema-safety.sh
```

This will show you:
- ✅ What SQL will run on production
- ⚠️ Any dangerous operations (DROP, ALTER, etc.)
- ❌ Blocks publish if data loss detected

---

### Step 2: Backup Production Data

1. Open **Database** pane in Replit (left sidebar)
2. Toggle to **Production** database
3. Export critical tables to CSV:
   - ✅ users
   - ✅ organizations
   - ✅ clients
   - ✅ llm_configurations
   - ✅ workflows
   - ✅ projects

Save these files locally!

---

### Step 3: Test in Development

```bash
# Apply schema to dev database
npm run db:push

# Start dev server
npm run dev

# Test everything works!
```

---

### Step 4: Publish

Only publish if:
- ✅ Safety check passed (Step 1)
- ✅ Production data backed up (Step 2)  
- ✅ Tested in dev (Step 3)
- ✅ You understand what changes will be made

---

## 🚨 If Data Loss Already Happened

**IMMEDIATE ACTIONS:**

1. **Read**: `EMERGENCY_RECOVERY.md`
2. **Try Replit Rollback**: History → Select checkpoint before publish
3. **Contact Support**: If critical data lost, Neon may have backups

---

## 📚 Learn More

- `PRODUCTION_DATABASE_GUIDE.md` - Full explanation of dev vs production
- `EMERGENCY_RECOVERY.md` - What to do if data is lost
- `check-schema-safety.sh` - Safety checker script

---

## TL;DR

**Your data was wiped because:**
- Dev and production are SEPARATE databases
- Schema changes auto-apply to production when you publish
- `drizzle-kit push` can DROP tables/columns that aren't in your code

**To prevent this:**
```bash
# BEFORE EVERY PUBLISH:
./check-schema-safety.sh    # Check what will change
# Backup production (Database Pane)
npm run db:push              # Test in dev
# THEN publish
```

**Never remove columns from schema.ts - mark them deprecated instead!**
