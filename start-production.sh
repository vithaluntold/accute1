#!/bin/sh
echo "🚀 Starting Accute deployment..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 5

echo "✅ Database should be ready!"

# Enable required PostgreSQL extensions using Node.js
echo "🔧 Enabling PostgreSQL extensions..."
npm run db:setup-extensions || echo "⚠️ Extension setup failed, continuing..."

# Try multiple migration approaches
echo "🔧 Starting database migration..."

# Approach 1: Try generate + migrate
if npm run db:generate; then
  echo "✅ Migration files generated"
  if npm run db:migrate; then
    echo "✅ Migration completed successfully"
  else
    echo "⚠️ Migration failed, trying push approach..."
    npm run db:push || echo "⚠️ Push also failed, continuing with existing schema..."
  fi
else
  echo "⚠️ Generation failed, trying direct push..."
  npm run db:push || echo "⚠️ Push failed, continuing with existing schema..."
fi

echo "🚀 Starting server..."
exec npm start