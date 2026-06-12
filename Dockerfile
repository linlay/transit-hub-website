FROM harbor.gtjaqh.io/library/node:22 AS builder

ARG VITE_BASE_URL=/
ARG VITE_API_BASE_URL=
ENV VITE_BASE_URL=${VITE_BASE_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM harbor.gtjaqh.io/library/nginx:1.25-alpine

ARG VITE_BASE_URL=/
ARG VITE_API_BASE_URL=
ENV VITE_BASE_URL=${VITE_BASE_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY scripts/prepare-nginx.sh /usr/local/bin/prepare-nginx
COPY --from=builder /app/dist /tmp/dist
RUN chmod +x /usr/local/bin/prepare-nginx && /usr/local/bin/prepare-nginx

EXPOSE 80
