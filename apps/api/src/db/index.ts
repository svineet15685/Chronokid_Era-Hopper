import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

export const pool = postgres(config.DATABASE_URL, { max: 10, connect_timeout: 3 });
export const db = drizzle(pool, { schema });