import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface Database {
  db: Db;
  close(): Promise<void>;
}

export function createDatabase(url: string): Database {
  const client = postgres(url, { max: 10, connect_timeout: 3, onnotice: () => {} });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 })
  };
}
