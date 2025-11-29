#!/bin/sh
echo "🚀 Starting Accute deployment..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 5

echo "✅ Database should be ready!"

# Enable required PostgreSQL extensions using Node.js
echo "🔧 Enabling PostgreSQL extensions..."
npm run db:setup-extensions || echo "⚠️ Extension setup failed, continuing..."

# Run migrations directly (do NOT regenerate - we have custom trigger migrations)
echo "🔧 Running database migrations..."
if npm run db:migrate; then
  echo "✅ Migrations applied successfully!"
else
  echo "❌ Migration failed - manual intervention may be required"
  exit 1
fi

echo "🚀 Starting server..."
exec npm start