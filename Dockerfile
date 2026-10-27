# Website (apps/web) for Coolify or any Docker host.
# Build from the repo root:  docker build -t wfh-web .
FROM node:24-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.21.0
WORKDIR /app

FROM base AS build
COPY . .
# No build variables needed: every setting, NEXT_PUBLIC_* included, is read when the container starts
# (see apps/web/src/lib/supabase/env.ts). Set them as runtime variables in Coolify.
# Only the website and the shared package; the Expo staff app isn't needed on the server.
RUN pnpm install --frozen-lockfile --filter "@wfh/web..."
RUN pnpm --filter @wfh/web build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["/app/node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
