import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// DEPLOYMENT FIX: Don't throw at module load time - allow server to start even without DATABASE_URL
function getDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return process.env.DATABASE_URL;
}

// Detect if we're in production (Railway, etc.) or development (Replit)
const isProduction = process.env.NODE_ENV === 'production';

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function createPool() {
  const dbUrl = getDatabaseUrl();
  
  if (isProduction) {
    // Production (Railway): Use pg driver with SSL but skip certificate verification
    // Railway's proxy uses a certificate that doesn't match the hostname
    console.log('🔌 Initializing pg pool (production mode - SSL no verify)...');
    const pool = new Pool({ 
      connectionString: dbUrl,
      max: 3, // Keep pool small for Railway
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
      // Critical: Skip SSL certificate verification for Railway proxy
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    pool.on('error', (err) => {
      console.error('💥 Database pool error:', err.message);
    });
    
    return pool;
  } else {
    // Development: Use standard pg driver without SSL
    console.log('🔌 Initializing pg pool (development mode)...');
    const pool = new Pool({ 
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
    });
    
    pool.on('error', (err) => {
      console.error('💥 Database pool error:', err.message);
    });
    
    return pool;
  }
}

function createDrizzle(pool: Pool) {
  return drizzle({ client: pool, schema });
}

// Lazy initialization with Proxy pattern
export const pool = new Proxy({} as Pool, {
  get(target, prop) {
    if (!_pool) {
      _pool = createPool();
      console.log('✅ Database pool initialized');
    }
    return (_pool as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      if (!_pool) {
        _pool = createPool();
        console.log('✅ Database pool initialized');
      }
      console.log('🔧 Initializing Drizzle ORM...');
      _db = createDrizzle(_pool);
      console.log('✅ Drizzle ORM initialized');
    }
    return (_db as any)[prop];
  }
});
