import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

function getDatabaseUrl(): string {
  // Priority 1: Always use DATABASE_URL if provided (Railway, Neon, Supabase, etc.)
  // Railway automatically sets this with proper sslmode
  if (process.env.DATABASE_URL) {
    console.log(`🔌 Using DATABASE_URL`);
    return process.env.DATABASE_URL;
  }
  
  // Priority 2: Build URL from individual PG* vars (Replit fallback)
  // Only if DATABASE_URL is not set
  if (process.env.PGHOST && process.env.PGPORT && process.env.PGUSER && 
      process.env.PGPASSWORD && process.env.PGDATABASE) {
    const dbUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
    console.log(`🔌 Using PostgreSQL from environment variables`);
    return dbUrl;
  }
  
  throw new Error(
    "No database configuration found. Set DATABASE_URL environment variable.",
  );
}

// Track which connection source we're using
let isUsingLocalDb = false;

const isProduction = process.env.NODE_ENV === 'production';

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function createPool(): Pool {
  const dbUrl = getDatabaseUrl();
  
  // Railway database configuration
  isUsingLocalDb = false;
  
  // Check if URL contains sslmode parameter
  const hasSSLParam = dbUrl.includes('sslmode=');
  const requiresNoSSL = dbUrl.includes('sslmode=disable');
  
  console.log(`🔌 Initializing pg pool (${isProduction ? 'production' : 'development'} mode)...`);
  
  const poolConfig: PoolConfig = { 
    connectionString: dbUrl,
    max: isProduction ? 10 : 10,
    min: isProduction ? 1 : 0,
    idleTimeoutMillis: isProduction ? 10000 : 30000,
    connectionTimeoutMillis: isProduction ? 5000 : 30000,
    allowExitOnIdle: isProduction ? false : true,
  };
  
  // SSL configuration based on database provider
  const isReplitLocal = dbUrl.includes('@helium:') || dbUrl.includes('/heliumdb');
  const isLocalhost = dbUrl.includes('@localhost:') || dbUrl.includes('@127.0.0.1:');
  
  if (requiresNoSSL || isLocalhost || isReplitLocal) {
    // Local development or Replit's internal database - no SSL needed
    console.log('🔓 SSL disabled (local database)');
    poolConfig.ssl = false;
  } else {
    // Cloud databases (Railway, Neon, Supabase, etc.) - use SSL with self-signed cert acceptance
    // Railway uses self-signed certificates, so rejectUnauthorized must be false
    console.log('🔒 SSL enabled (cloud database)');
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }
  
  const pool = new Pool(poolConfig);
  
  // Handle pool errors gracefully
  pool.on('error', (err) => {
    const errorMsg = err.message || '';
    // Suppress verbose logging for expected connection resets
    if (errorMsg.includes('Connection terminated') || 
        errorMsg.includes('ECONNRESET') ||
        errorMsg.includes('connection reset')) {
      // Silent recovery - pool will auto-reconnect on next query
    } else {
      console.error('💥 Database pool error:', err.message);
    }
  });
  
  pool.on('connect', () => {
    console.log('🔗 New database connection established');
  });
  
  return pool;
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
      testConnection(_pool).catch(() => {
        console.warn('⚠️ Initial connection test failed - pool will retry on demand');
      });
    }
  }
  return _pool;
}

// Initialize drizzle with pool
function initializeDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    const pool = initializePool();
    _db = createDrizzle(pool);
  }
  return _db;
}

// Export pool and db instances
export const pool = initializePool();
export const db = initializeDb();

// Helper to get a fresh connection for one-off queries
export async function getConnection() {
  return pool.connect();
}

// Export testConnection for use in startup
export { testConnection };

// Export for raw query execution
export async function executeRawQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await executeRawQuery('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// Check if using local Replit database (useful for skipping certain cloud-only features)
export function isLocalDatabase(): boolean {
  return isUsingLocalDb;
}
