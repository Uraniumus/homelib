# Многоступенчатая сборка: в финальный образ едет только .output,
# без node_modules сборки и без исходников.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------- зависимости ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: postinstall зовёт `nuxt prepare`, а исходников тут ещё нет.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---------- сборка ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------- рантайм ----------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

# Не от root.
RUN addgroup -S nodejs && adduser -S nuxt -G nodejs

COPY --from=build --chown=nuxt:nodejs /app/.output ./.output
# SQL миграций читается с диска при старте (RUN_MIGRATIONS=true),
# в бандл Nitro он не попадает — поэтому кладём папку рядом.
COPY --from=build --chown=nuxt:nodejs /app/server/database/migrations ./server/database/migrations

USER nuxt
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
