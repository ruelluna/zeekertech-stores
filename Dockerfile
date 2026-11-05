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
# pg_dump for the backup taken before migrations (client 17 also dumps older Postgres servers).
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && . /etc/os-release \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
# Back up and migrate the database first (scripts/migrate.mjs; does nothing without DATABASE_URL), then start.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec /app/node_modules/.bin/next start -p 3000 -H 0.0.0.0"]
