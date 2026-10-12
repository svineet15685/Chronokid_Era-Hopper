// One place that turns failures into small, generic JSON errors. Clients never see stack traces,
// SQL, or database messages; details go to the server log only.
import type { ApiErrorCode } from '@chronokid/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/** An expected failure with a status code and a public error code. */
export class ApiFailure extends Error {
  constructor(readonly statusCode: number, readonly code: ApiErrorCode) {
    super(code);
  }
}

/** Connection-level failures from postgres.js or the network mean the database is unavailable. */
const UNAVAILABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', '57P01', '57P03']);

/** Drizzle wraps driver errors, so look through the `cause` chain for a connection-level code. */
function isUnavailable(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && UNAVAILABLE_CODES.has(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found' }));

  app.setErrorHandler((error: FastifyError | ApiFailure | ZodError, request, reply) => {
    if (error instanceof ApiFailure) return reply.code(error.statusCode).send({ error: error.code });
    if (error instanceof ZodError) return reply.code(400).send({ error: 'invalid_request' });
    const status = 'statusCode' in error ? error.statusCode : undefined;
    if (status === 429) return reply.code(429).send({ error: 'rate_limited' });
    // Fastify's own client errors: malformed JSON, body too large, wrong content type, and so on.
    if (status && status >= 400 && status < 500) return reply.code(status === 413 ? 413 : 400).send({ error: 'invalid_request' });
    if (isUnavailable(error)) {
      request.log.warn('database unavailable');
      return reply.code(503).send({ error: 'unavailable' });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: 'internal' });
  });
}
