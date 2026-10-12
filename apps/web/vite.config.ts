import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';

// Read workspace packages (such as @chronokid/shared) from their TypeScript source.
// The ssr setting covers Vitest, which resolves modules like a server.
export default defineConfig({
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
