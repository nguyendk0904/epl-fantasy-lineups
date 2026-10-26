# =====================================================================
# P1-Q01 - Frontend Dockerfile (Multi-stage build)
# Project: Fantasy Football Lineup Builder & Optimizer
# Stack: Node 20-alpine (build) -> Nginx alpine (static file server)
# =====================================================================

# ---------------------------------------------------------------------
# Stage 1: Builder - compile the React/Vite SPA into static assets
# ---------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (leverages Docker layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Build-time API base URL (relative => routed through Nginx proxy)
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

# Copy remaining sources and produce the production bundle
COPY . .
RUN npm run build

# ---------------------------------------------------------------------
# Stage 2: Runtime - serve the static bundle with Nginx alpine
# ---------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Drop the default welcome site
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy compiled static assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Minimal SPA-friendly config:
#   - SPA fallback: unknown routes fall back to index.html
#   - /api/* reverse-proxied to the FastAPI backend (compose service
#     "backend"); Docker embedded DNS (127.0.0.11) defers resolution
#     so the image still starts fine when run standalone.
RUN printf '%s\n' \
    'server {' \
    '    listen 80;' \
    '    server_name _;' \
    '' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '' \
    '    location /api/ {' \
    '        resolver 127.0.0.11 valid=10s ipv6=off;' \
    '        set $backend_upstream http://backend:8000;' \
    '        proxy_pass $backend_upstream;' \
    '        proxy_set_header Host $host;' \
    '        proxy_set_header X-Real-IP $remote_addr;' \
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
    '        proxy_set_header X-Forwarded-Proto $scheme;' \
    '    }' \
    '' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]