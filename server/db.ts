import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

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
      _pool = new Pool({ connectionString: getDatabaseUrl() });
    }
    return (_pool as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      if (!_pool) {
        _pool = new Pool({ connectionString: getDatabaseUrl() });
      }
      _db = drizzle({ client: _pool, schema });
    }
    return (_db as any)[prop];
  }
});
