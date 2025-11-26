import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

function getDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return process.env.DATABASE_URL;
}

const isProduction = process.env.NODE_ENV === 'production';

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function createPool() {
  const dbUrl = getDatabaseUrl();
  
  if (isProduction) {
    console.log('🔌 Initializing pg pool (production mode - Railway optimized)...');
    
    const poolConfig: PoolConfig = { 
      connectionString: dbUrl,
      // Production-optimized settings for Railway + Neon
      max: 10,                       // Slightly larger pool
      min: 2,                        // Keep 2 warm connections
      idleTimeoutMillis: 20000,      // 20 seconds idle timeout
      connectionTimeoutMillis: 5000, // 5 seconds to connect (fast fail for health checks)
      allowExitOnIdle: false,        // Don't exit when idle
      // SSL required for both Railway proxy and Neon
      ssl: {
        rejectUnauthorized: false    // Works with both Railway proxy and Neon
      }
    };
    
    const pool = new Pool(poolConfig);
    
    // Handle pool errors gracefully
    pool.on('error', (err) => {
      console.error('💥 Database pool error:', err.message);
      // Don't crash - let the pool recover
    });
    
    pool.on('connect', () => {
      console.log('🔗 New database connection established');
    });
    
    return pool;
  } else {
    console.log('🔌 Initializing pg pool (development mode)...');
    
    // Check if using Railway/external database (requires SSL)
    const requiresSSL = dbUrl.includes('railway.app') || 
                        dbUrl.includes('rlwy.net') || 
                        dbUrl.includes('neon.tech');
    
    const poolConfig: PoolConfig = { 
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
    };
    
    // Add SSL for external databases
    if (requiresSSL) {
      console.log('🔒 SSL enabled for external database');
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    
    const pool = new Pool(poolConfig);
    
    pool.on('error', (err) => {
      console.error('💥 Database pool error:', err.message);
    });
    
    return pool;
  }
}

function createDrizzle(pool: Pool) {
  return drizzle({ client: pool, schema });
}

// Test database connection with retry
async function testConnection(pool: Pool, maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`✅ Database connection verified (attempt ${attempt})`);
      return true;
    } catch (error: any) {
      console.error(`⚠️ Connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`   Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  console.error('❌ All database connection attempts failed');
  return false;
}

// Initialize pool immediately for production to warm up connections
function initializePool(): Pool {
  if (!_pool) {
    _pool = createPool();
    console.log('✅ Database pool initialized');
    
    // Test connection in background (don't block)
    if (isProduction) {
      testConnection(_pool).then(success => {
        if (!success) {
          console.error('⚠️ Initial connection test failed - queries may fail until connection is established');
        }
      });
    }
  }
  return _pool;
}

// Lazy initialization with Proxy pattern
export const pool = new Proxy({} as Pool, {
  get(target, prop) {
    const p = initializePool();
    return (p as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      const p = initializePool();
      console.log('🔧 Initializing Drizzle ORM...');
      _db = createDrizzle(p);
      console.log('✅ Drizzle ORM initialized');
    }
    return (_db as any)[prop];
  }
});

// Export test function for health checks
export { testConnection };
