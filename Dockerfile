# Website (apps/web) for Coolify or any Docker host.
# Build from the repo root:  docker build -t wfh-web .
FROM node:24-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.21.0
WORKDIR /app

FROM base AS build
COPY . .
# NEXT_PUBLIC_* values are baked into the browser bundle at build time, so Coolify must pass them
# as build variables too. Server-only secrets are read at runtime and don't need to be here.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_MAP_TILE_URL
ARG NEXT_PUBLIC_MAP_ATTRIBUTION
ARG NEXT_PUBLIC_FACEBOOK_LOGIN
# Only the website and the shared package; the Expo staff app isn't needed on the server.
RUN pnpm install --frozen-lockfile --filter "@wfh/web..."
RUN pnpm --filter @wfh/web build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["/app/node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
