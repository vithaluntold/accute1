import { Pool } from 'pg';

async function enableExtensions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔧 Enabling PostgreSQL extensions...');
    
    // Enable uuid-ossp extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ uuid-ossp extension enabled');
    
    // Enable pgcrypto extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log('✅ pgcrypto extension enabled');
    
    // Verify extensions
    const result = await pool.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto')"
    );
    console.log('✅ Extensions verified:', result.rows.map(r => r.extname).join(', '));
    
  } catch (error) {
    console.error('❌ Failed to enable extensions:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

enableExtensions()
  .then(() => {
    console.log('✅ Extension setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Extension setup failed:', error);
    process.exit(1);
  });
