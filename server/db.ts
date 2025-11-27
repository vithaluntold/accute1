import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import * as tls from 'tls';

function getDatabaseUrl(): string {
  // Check for Replit's built-in database (uses PGHOST, PGPORT, PGUSER, etc.)
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
    const pgHost = process.env.PGHOST;
    const pgPort = process.env.PGPORT || '5432';
    const pgUser = process.env.PGUSER;
    const pgPassword = process.env.PGPASSWORD;
    const pgDatabase = process.env.PGDATABASE;
    
    // Build URL correctly: omit colon when no password
    let localUrl: string;
    if (pgPassword) {
      localUrl = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
    } else {
      localUrl = `postgresql://${pgUser}@${pgHost}:${pgPort}/${pgDatabase}`;
    }
    console.log(`🔌 Using Replit local database: ${pgHost}:${pgPort}/${pgDatabase}`);
    return localUrl;
  }
  
  // Fallback to DATABASE_URL for external databases
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return process.env.DATABASE_URL;
}

// Track which connection source we're using
let isUsingLocalDb = false;

const isProduction = process.env.NODE_ENV === 'production';

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function createPool(): Pool {
  const dbUrl = getDatabaseUrl();
  
  // Check if using Replit local database (hostname "helium" or similar local names)
  const isReplitLocal = dbUrl.includes('@helium:') || dbUrl.includes('@localhost:');
  
  // Detect external cloud database providers
  const isNeon = dbUrl.includes('neon.tech');
  const isRailway = dbUrl.includes('railway.app') || dbUrl.includes('rlwy.net') || dbUrl.includes('proxy.rlwy') || dbUrl.includes('gondola');
  const isCloudDB = !isReplitLocal && (isNeon || isRailway);
  
  // Track connection type
  isUsingLocalDb = isReplitLocal;
  
  console.log(`🔌 Initializing pg pool (${isProduction ? 'production' : 'development'} mode)...`);
  if (isReplitLocal) {
    console.log(`   Using Replit local database (no SSL required)`);
  } else if (isCloudDB) {
    console.log(`   Provider detected: ${isNeon ? 'Neon' : 'Railway'}`);
  }
  
  const poolConfig: PoolConfig = { 
    connectionString: dbUrl,
    max: isProduction ? 10 : 10,
    min: isProduction ? 1 : 0,
    idleTimeoutMillis: isProduction ? 10000 : 30000,
    connectionTimeoutMillis: isProduction ? 5000 : 30000,
    allowExitOnIdle: isProduction ? false : true,
  };
  
  // SSL configuration: all non-local connections require TLS
  if (!isReplitLocal) {
    console.log('🔒 SSL enabled for external database');
    // Railway's proxy uses self-signed certs that require rejectUnauthorized: false
    // All other providers (Neon, Azure, RDS, Supabase, etc.) use strict TLS
    if (isRailway) {
      // Railway's proxy terminates TLS and presents self-signed certs
      poolConfig.ssl = {
        rejectUnauthorized: false,
      };
      console.log('   Railway proxy detected - using relaxed SSL');
    } else {
      // Default: strict TLS for all other providers (Neon, Azure, RDS, Supabase, etc.)
      poolConfig.ssl = true;
      if (isNeon) {
        console.log('   Neon detected - using strict SSL');
      } else {
        console.log('   External provider detected - using strict SSL');
      }
    }
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
