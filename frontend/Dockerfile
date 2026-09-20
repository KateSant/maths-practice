# Builds the React app and serves it with Caddy.
#
# The build context is the REPOSITORY ROOT, not this directory, because the final
# image needs the top-level Caddyfile (the edge config covers both the static SPA
# and the /api proxy, so it belongs to the whole app rather than to the frontend),
# and because the app imports the misconception register from content/.
#
#   docker build -f frontend/Dockerfile -t realmaths-web .
FROM node:22-alpine AS build
WORKDIR /build

# Copy manifests first so dependency installation is cached independently of source.
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci

# Source, plus the misconception register. The register is content, shared with the
# backend's bank tooling, so it lives at the repository root. Copying it to the same
# relative place (../content from the app) keeps the import in src/lib/misconceptions.ts
# identical to a local build rather than special-casing the path for the image.
COPY frontend/ ./frontend/
COPY content/misconceptions.json ./content/misconceptions.json

# Inlined into the bundle at build time by Vite, so it must be present *here* and not as a
# runtime environment variable on the container. Public, not a secret.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
# --prefix keeps the working directory the same as a local build, so the relative JSON
# import resolves. Runs tsc --noEmit as well as vite build, so a type error fails the build.
RUN npm --prefix frontend run build

FROM caddy:2-alpine
COPY --from=build /build/frontend/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
