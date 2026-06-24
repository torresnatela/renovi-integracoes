# syntax=docker/dockerfile:1

# Imagem base com pnpm via corepack (versão fixada em package.json#packageManager).
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Instala dependências do monorepo e builda o app web.
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @renovi/web build

# Imagem de runtime: reaproveita o build (inclui node_modules + .next).
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
