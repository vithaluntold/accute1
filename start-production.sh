#!/bin/sh
set -e  # Exit on any error

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Accute Production Deployment"
echo "   Timestamp: $(date -Iseconds)"
echo "   Node Version: $(node --version)"
echo "   NPM Version: $(npm --version)"
echo "═══════════════════════════════════════════════════════════════"

# Verify critical files exist
echo "\n📋 Verifying deployment integrity..."
if [ ! -f "dist/start.js" ]; then
  echo "❌ CRITICAL: dist/start.js not found!"
  echo "   Build may have failed. Check build logs."
  exit 1
fi
echo "✅ dist/start.js exists ($(stat -c%s dist/start.js 2>/dev/null || stat -f%z dist/start.js) bytes)"

if [ ! -d "migrations" ]; then
  echo "❌ CRITICAL: migrations/ directory not found!"
  exit 1
fi
echo "✅ migrations/ directory exists"

# Wait for database to be ready
echo "\n⏳ Waiting for database connection..."
sleep 5
echo "✅ Database connection timeout complete"

# Enable required PostgreSQL extensions
echo "\n🔧 Enabling PostgreSQL extensions..."
if npm run db:setup-extensions; then
  echo "✅ PostgreSQL extensions enabled"
else
  echo "⚠️  Extension setup failed, continuing (may not be critical)..."
fi

# Run migrations (CRITICAL: Do NOT run db:generate - preserves custom triggers)
echo "\n🔧 Running database migrations..."
echo "   Migration files:"
ls -lh migrations/*.sql 2>/dev/null || echo "   No SQL migration files found"

if npm run db:migrate; then
  echo "✅ Migrations applied successfully!"
else
  echo "❌ Migration failed - manual intervention may be required"
  echo "   Check database connection and migration files"
  exit 1
fi

# Final verification
echo "\n📋 Pre-flight checks complete"
echo "   Environment: ${NODE_ENV:-not-set}"
echo "   Port: ${PORT:-5000}"

echo "\n═══════════════════════════════════════════════════════════════"
echo "🚀 Starting Accute server..."
echo "═══════════════════════════════════════════════════════════════\n"

# Start the server (exec replaces the shell process)
exec npm start