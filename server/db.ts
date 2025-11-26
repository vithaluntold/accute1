import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from 'ws';
import * as schema from "@shared/schema";

// Configure Neon for WebSocket connections (works better with Railway proxy)
neonConfig.webSocketConstructor = ws;

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

// Use Neon serverless driver for production (handles Railway proxy better)
// Use standard pg for development (faster for local/Replit connections)
let _pool: NeonPool | PgPool | null = null;
let _db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg> | null = null;

function createPool() {
  const dbUrl = getDatabaseUrl();
  
  if (isProduction) {
    // Production: Use Neon serverless driver with WebSocket
    // This handles Railway's proxy TLS termination much better
    console.log('🔌 Initializing Neon serverless pool (production mode)...');
    const pool = new NeonPool({ 
      connectionString: dbUrl,
      max: 3, // Minimal connections for serverless
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 30000,
    });
    
    pool.on('error', (err) => {
      console.error('💥 Database pool error:', err.message);
    });
    
    return pool;
  } else {
    // Development: Use standard pg driver
    console.log('🔌 Initializing pg pool (development mode)...');
    const pool = new PgPool({ 
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

function createDrizzle(pool: NeonPool | PgPool) {
  if (isProduction) {
    return drizzleNeon({ client: pool as NeonPool, schema });
  } else {
    return drizzlePg({ client: pool as PgPool, schema });
  }
}

// Lazy initialization with Proxy pattern
export const pool = new Proxy({} as NeonPool | PgPool, {
  get(target, prop) {
    if (!_pool) {
      _pool = createPool();
      console.log('✅ Database pool initialized');
    }
    return (_pool as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzleNeon>, {
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
