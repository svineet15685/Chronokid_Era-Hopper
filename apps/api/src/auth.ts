// Guest identity: a random bearer token per player. Only its SHA-256 hash is stored, so a database
// leak does not reveal usable tokens. Tokens have 256 bits of entropy, so a fast hash is sufficient.
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { Db } from './db/index.js';
import { players } from './db/schema.js';
import { ApiFailure } from './errors.js';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AuthenticatedPlayer {
  id: string;
  displayName: string;
}

/** Resolves the player for a request's bearer token, or throws a 401 without saying why. */
export async function requirePlayer(db: Db, request: FastifyRequest): Promise<AuthenticatedPlayer> {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!TOKEN_PATTERN.test(token)) throw new ApiFailure(401, 'unauthorized');
  const [player] = await db
    .select({ id: players.id, displayName: players.displayName })
    .from(players)
    .where(eq(players.tokenHash, hashToken(token)))
    .limit(1);
  if (!player) throw new ApiFailure(401, 'unauthorized');
  return player;
}
