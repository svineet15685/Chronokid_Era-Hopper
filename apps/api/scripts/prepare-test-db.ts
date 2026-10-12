// Migrates and empties the test database for the full-stack browser tests. Refuses non-*_test databases.
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { TEST_DATABASE_URL, assertTestDatabase, dbTestsEnabled } from '../test/test-database.js';

if (!dbTestsEnabled) throw new Error('TEST_DATABASE_URL is not set.');
assertTestDatabase(TEST_DATABASE_URL);
const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  await db.execute(sql`truncate table runs, players restart identity cascade`);
} finally {
  await client.end();
}
