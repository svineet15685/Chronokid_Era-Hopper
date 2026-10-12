// Applies the real migrations to the test database once before the integration tests run.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { TEST_DATABASE_URL, assertTestDatabase, dbTestsEnabled } from './test-database.js';

export default async function setup(): Promise<void> {
  if (!dbTestsEnabled) return;
  assertTestDatabase(TEST_DATABASE_URL);
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  } finally {
    await client.end();
  }
}
