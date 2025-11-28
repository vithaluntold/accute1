#!/bin/sh
echo "🚀 Starting Accute deployment..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until pg_isready -h $(echo $DATABASE_URL | cut -d'/' -f3 | cut -d'@' -f2 | cut -d':' -f1) -p $(echo $DATABASE_URL | cut -d':' -f4 | cut -d'/' -f1) 2>/dev/null; do
  echo "🔄 Database not ready, waiting 2 seconds..."
  sleep 2
done

echo "✅ Database is ready!"

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