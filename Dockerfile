FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN pnpm install --frozen-lockfile
COPY apps ./apps
# The published browser bundle talks to its own HTTPS origin.
ENV CI=true EXPO_NO_DOTENV=1
RUN pnpm build:web
RUN pnpm --filter @memory-chess/server deploy --prod --legacy /runtime

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=10000 SERVE_WEB=true WEB_DIST=/app/public
WORKDIR /app
COPY --from=build --chown=node:node /runtime/ ./
COPY --from=build --chown=node:node /workspace/apps/client/dist/ ./public/
USER node
EXPOSE 10000
CMD ["node", "src/server.js"]
