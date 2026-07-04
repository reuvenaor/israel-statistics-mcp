# syntax=docker/dockerfile:1
# Digest-pinned base (Renovate keeps the digest fresh — that cadence replaces
# nondeterministic apt-get upgrade layers).
FROM node:24-bookworm-slim@sha256:b31e7a42fdf8b8aa5f5ed477c72d694301273f1069c5a2f71d53c6482e99a2fc AS base
WORKDIR /app
COPY package.json ./
# pnpm pinned from package.json "packageManager" (single source of truth)
# without corepack — corepack is deprecated in Node 24 and removed in 25+.
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"

FROM base AS build
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.base.json tsup.config.ts ./
COPY src ./src
RUN pnpm build

FROM base AS proddeps
COPY pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24-bookworm-slim@sha256:b31e7a42fdf8b8aa5f5ed477c72d694301273f1069c5a2f71d53c6482e99a2fc AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --create-home --uid 1001 appuser \
  # Official docker-node best practice: the runtime image needs only `node` —
  # strip npm/npx/corepack/yarn to shrink the attack surface.
  && rm -rf /usr/local/lib/node_modules \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn*
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER appuser

LABEL org.opencontainers.image.title="israel-statistics-mcp" \
      org.opencontainers.image.description="MCP server for Israeli CBS price indices and economic data (9 tools)" \
      org.opencontainers.image.source="https://github.com/reuvenaor/israel-statistics-mcp" \
      org.opencontainers.image.licenses="MIT" \
      io.modelcontextprotocol.server.name="io.github.reuvenaor/israel-statistics-mcp"

# No HEALTHCHECK by design: this is a stdio MCP server run as
# `docker run --init --rm -i` per client session — it owns no port and its
# liveness IS the stdin/stdout pipe held by the client.
CMD ["node", "dist/index.js"]
