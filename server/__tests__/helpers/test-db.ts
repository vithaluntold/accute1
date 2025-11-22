/**
 * Test Database Isolation Helpers
 * Provides transaction-based test isolation to prevent test data pollution
 */

import { db } from '../../db';
import { sql } from 'drizzle-orm';

/**
 * Begin a test transaction
 * Returns a rollback function to clean up after test
 */
export async function beginTestTransaction(): Promise<() => Promise<void>> {
  await db.execute(sql`BEGIN`);
  
  return async () => {
    await db.execute(sql`ROLLBACK`);
  };
}

/**
 * Clean up test data after test completes
 * Use this in afterEach hooks
 */
export async function cleanupTestData(tables: string[]) {
  for (const table of tables) {
    await db.execute(sql.raw(`DELETE FROM ${table} WHERE id LIKE 'test_%'`));
  }
}

/**
 * Create isolated test database schema
 * For tests that need complete isolation
 */
export async function createTestSchema(schemaName: string) {
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));
  await db.execute(sql.raw(`SET search_path TO ${schemaName}, public`));
}

/**
 * Drop test schema
 */
export async function dropTestSchema(schemaName: string) {
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`));
  await db.execute(sql.raw(`SET search_path TO public`));
}
