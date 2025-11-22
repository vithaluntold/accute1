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

// Lazy initialization - only throws when actually accessed
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export const pool = new Proxy({} as Pool, {
  get(target, prop) {
    if (!_pool) {
      try {
        const dbUrl = getDatabaseUrl();
        console.log('🔌 Initializing database connection pool...');
        _pool = new Pool({ 
          connectionString: dbUrl,
          max: 10, // Maximum 10 connections in pool
          idleTimeoutMillis: 30000, // Close idle connections after 30s
          connectionTimeoutMillis: 30000, // Increased to 30s for cloud databases
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        });
        
        // Add error handler
        _pool.on('error', (err) => {
          console.error('💥 Unexpected database pool error:', err);
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
          _pool = new Pool({ 
            connectionString: dbUrl,
            max: 10, // Maximum 10 connections in pool
            idleTimeoutMillis: 30000, // Close idle connections after 30s
            connectionTimeoutMillis: 30000, // Increased to 30s for cloud databases
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
          });
          
          // Add error handler
          _pool.on('error', (err) => {
            console.error('💥 Unexpected database pool error:', err);
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
