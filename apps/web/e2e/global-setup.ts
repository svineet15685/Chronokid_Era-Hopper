// Migrates and empties the *_test database before full-stack runs (the script refuses other databases).
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function globalSetup(): void {
  if (!process.env.TEST_DATABASE_URL) return;
  execSync('npm run test:prepare-db', { cwd: fileURLToPath(new URL('../../api/', import.meta.url)), stdio: 'inherit' });
}
