# FROM node:22 AS builder
FROM harbor.gtjaqh.io/library/node:22 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# FROM nginx:1.25-alpine
FROM harbor.gtjaqh.io/library/nginx:1.25-alpine

ENV VITE_BASE_URL=/
ENV VITE_API_BASE_URL=

COPY scripts/prepare-nginx.sh /docker-entrypoint.d/40-prepare-transit-hub.sh
COPY --from=builder /app/dist /tmp/dist
RUN chmod +x /docker-entrypoint.d/40-prepare-transit-hub.sh

EXPOSE 80
