// Applies database migrations using only runtime dependencies, so the production image can run it:
//   node apps/api/dist/migrate.js
// Migrations are forward-only; see docs/operations.md before changing schema in production.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { config } from './config.js';

const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../drizzle', import.meta.url));
const client = postgres(config.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder });
  console.log('Migrations are up to date.');
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
