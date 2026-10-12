// Locates the integration-test database. Tests wipe its tables, so it must be a dedicated *_test database.
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
export const dbTestsEnabled = TEST_DATABASE_URL !== '';

/** CI sets REQUIRE_DB_TESTS=1 so a missing database fails loudly instead of silently skipping tests. */
if (!dbTestsEnabled && process.env.REQUIRE_DB_TESTS === '1') {
  throw new Error('REQUIRE_DB_TESTS=1 but TEST_DATABASE_URL is not set.');
}

export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run destructive tests against database "${name}". Use a database whose name ends in _test.`);
  }
}
