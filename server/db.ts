import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// DEPLOYMENT FIX: Don't throw at module load time - allow server to start even without DATABASE_URL
// The error will be thrown when database is actually accessed (deferred initialization)
function getDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return process.env.DATABASE_URL;
}

// Railway/Cloud PostgreSQL optimized pool configuration
function createPoolConfig(dbUrl: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    connectionString: dbUrl,
    max: 5, // Reduced for Railway - fewer but more stable connections
    min: 1, // Keep at least 1 connection warm
    idleTimeoutMillis: 10000, // Close idle connections after 10s (Railway has short timeouts)
    connectionTimeoutMillis: 30000, // 30s connection timeout
    // SSL configuration for Railway PostgreSQL
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    // Keepalive settings to prevent ECONNRESET errors
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
    // Statement timeout to prevent hanging queries
    statement_timeout: 30000,
    // Application name for debugging
    application_name: 'accute-app',
  };
}

// Lazy initialization - only throws when actually accessed
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export const pool = new Proxy({} as Pool, {
  get(target, prop) {
    if (!_pool) {
      try {
        const dbUrl = getDatabaseUrl();
        console.log('🔌 Initializing database connection pool...');
        _pool = new Pool(createPoolConfig(dbUrl));
        
        // Add error handler - don't crash on transient errors
        _pool.on('error', (err) => {
          console.error('💥 Database pool error (will attempt reconnect):', err.message);
        });
        
        // Connection event for debugging
        _pool.on('connect', () => {
          console.log('🔗 New database connection established');
        });
        
        console.log('✅ Database pool initialized');
      } catch (error) {
        console.error('❌ Failed to initialize database pool:', error);
        throw error;
      }
    }
    return (_pool as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      if (!_pool) {
        try {
          const dbUrl = getDatabaseUrl();
          console.log('🔌 Initializing database connection pool (via db)...');
          _pool = new Pool(createPoolConfig(dbUrl));
          
          // Add error handler - don't crash on transient errors
          _pool.on('error', (err) => {
            console.error('💥 Database pool error (will attempt reconnect):', err.message);
          });
          
          // Connection event for debugging
          _pool.on('connect', () => {
            console.log('🔗 New database connection established');
          });
          
          console.log('✅ Database pool initialized');
        } catch (error) {
          console.error('❌ Failed to initialize database pool:', error);
          throw error;
        }
      }
      console.log('🔧 Initializing Drizzle ORM...');
      _db = drizzle({ client: _pool, schema });
      console.log('✅ Drizzle ORM initialized');
    }
    return (_db as any)[prop];
  }
});
