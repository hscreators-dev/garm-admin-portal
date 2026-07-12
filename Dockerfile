# Garm Admin Portal — frontend (Vite/React) → static, served by nginx on :80.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Empty VITE_API_URL = same-origin: the app calls /api/... and nginx (below)
# proxies to the admin backend. No CORS needed.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
# Keep the app's existing base path (/garm-admin-portal/) — matches the router
# basename in src/main.tsx.
RUN npx vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
