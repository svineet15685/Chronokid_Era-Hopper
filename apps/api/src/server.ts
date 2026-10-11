import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}