# Builds the React app and serves it with Caddy.
#
# The build context is the REPOSITORY ROOT, not this directory, because the final
# image needs the top-level Caddyfile (the edge config covers both the static SPA
# and the /api proxy, so it belongs to the whole app rather than to the frontend).
#
#   docker build -f frontend/Dockerfile -t realmaths-web .
FROM node:22-alpine AS build
WORKDIR /build

# Copy manifests first so dependency installation is cached independently of source.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Runs tsc --noEmit as well as vite build, so a type error fails the image build.
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /build/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
