FROM docker.io/library/node:22-slim AS build
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web ./
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID=classmind-web
RUN npm run build

FROM docker.io/library/caddy:2
COPY --from=build /app/dist /srv
COPY infrastructure/caddy/Caddyfile /etc/caddy/Caddyfile
