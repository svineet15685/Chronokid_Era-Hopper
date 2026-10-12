import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';

// Read workspace packages (such as @chronokid/shared) from their TypeScript source.
// The ssr setting covers Vitest, which resolves modules like a server.
export default defineConfig({
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  server: {
    proxy: {
      // The browser tests point this at their own API instance.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001'
    }
  }
});
