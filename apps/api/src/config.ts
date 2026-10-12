import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url().default('postgres://chronokid:chronokid@localhost:5432/chronokid'),
  // Set to true only when the API runs behind a trusted reverse proxy that sets X-Forwarded-For.
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  // Multiplies every rate limit. Raise it only for automated tests that make many requests from one IP.
  RATE_LIMIT_SCALE: z.coerce.number().int().min(1).max(1000).default(1)
});

export const config = envSchema.parse(process.env);