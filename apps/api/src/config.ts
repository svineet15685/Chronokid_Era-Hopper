import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url().default('postgres://chronokid:chronokid@localhost:5432/chronokid')
});

export const config = envSchema.parse(process.env);