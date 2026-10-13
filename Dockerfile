# syntax=docker/dockerfile:1
# One image: the API serves the built game and its own endpoints. Build and run steps are in docs/operations.md.
# Base images are pinned by digest; Dependabot proposes updates.

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
# Install scripts are not needed to build and are a common supply-chain attack path.
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/api apps/api
RUN npm run build --workspace=@chronokid/shared \
 && npm run build --workspace=@chronokid/web \
 && npm run build --workspace=@chronokid/api \
 && npm prune --omit=dev --ignore-scripts

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001 \
    STATIC_DIR=/app/public
WORKDIR /app
# Files stay owned by root and read-only to the app user, so the running app cannot modify itself.
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/drizzle apps/api/drizzle
COPY --from=build /app/apps/web/dist public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- "http://127.0.0.1:${API_PORT}/api/health" >/dev/null || exit 1
CMD ["node", "apps/api/dist/server.js"]
