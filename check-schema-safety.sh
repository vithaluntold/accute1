#!/bin/bash

# 🛡️ Production Schema Safety Checker
# Run this BEFORE publishing to prevent data loss

set -e

echo "🔍 Checking schema changes for production safety..."
echo ""

# Run dry-run to see what changes would be made
echo "📋 Running drizzle-kit push in DRY RUN mode..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Capture the dry-run output
DRY_RUN_OUTPUT=$(npm run db:push -- --dry-run 2>&1 || true)

echo "$DRY_RUN_OUTPUT"
echo ""

# Check for dangerous operations
DANGER_FOUND=false

if echo "$DRY_RUN_OUTPUT" | grep -qi "DROP COLUMN"; then
  echo "⚠️  WARNING: DROP COLUMN detected!"
  echo "   This will DELETE data from production!"
  DANGER_FOUND=true
fi

if echo "$DRY_RUN_OUTPUT" | grep -qi "DROP TABLE"; then
  echo "⚠️  WARNING: DROP TABLE detected!"
  echo "   This will DELETE entire tables from production!"
  DANGER_FOUND=true
fi

if echo "$DRY_RUN_OUTPUT" | grep -qi "ALTER COLUMN.*TYPE"; then
  echo "⚠️  WARNING: ALTER COLUMN TYPE detected!"
  echo "   This may cause data loss or corruption!"
  DANGER_FOUND=true
fi

if echo "$DRY_RUN_OUTPUT" | grep -qi "NOT NULL"; then
  if ! echo "$DRY_RUN_OUTPUT" | grep -qi "DEFAULT"; then
    echo "⚠️  WARNING: Adding NOT NULL without DEFAULT!"
    echo "   This will FAIL if table has existing rows!"
    DANGER_FOUND=true
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$DANGER_FOUND" = true ]; then
  echo "❌ UNSAFE SCHEMA CHANGES DETECTED!"
  echo ""
  echo "⛔ DO NOT PUBLISH - This will cause data loss in production!"
  echo ""
  echo "📚 Read PRODUCTION_DATABASE_GUIDE.md for safe migration strategies"
  echo ""
  echo "Safe alternatives:"
  echo "  1. Make columns nullable instead of removing them"
  echo "  2. Add new columns before removing old ones"
  echo "  3. Use default values for new required fields"
  echo "  4. Backup production data first (Database Pane → Production → Export)"
  echo ""
  exit 1
else
  echo "✅ Schema changes appear safe"
  echo ""
  echo "However, ALWAYS:"
  echo "  1. Backup production data before publishing"
  echo "  2. Test thoroughly in development first"
  echo "  3. Review the SQL changes above carefully"
  echo ""
  echo "Ready to publish? Run this command to apply to dev first:"
  echo "  npm run db:push"
  echo ""
  exit 0
fi
