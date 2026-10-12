import { buildApp, scaleRateLimits } from './app.js';
import { config } from './config.js';
import { createDatabase } from './db/index.js';

const app = await buildApp({
  rateLimits: scaleRateLimits(config.RATE_LIMIT_SCALE),
  database: createDatabase(config.DATABASE_URL),
  webOrigin: config.WEB_ORIGIN,
  trustProxy: config.TRUST_PROXY
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().finally(() => process.exit(0));
  });
}

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
