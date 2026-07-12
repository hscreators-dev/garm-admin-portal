# Garm Admin Portal — backend (dependency-light Node + Mongoose). Serves :5050.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
EXPOSE 5050
# db.json (catalog/settings) + .server-secret persist via a mounted volume in
# docker-compose. GARM_SECRET_KEY MUST be provided as an env var in production.
CMD ["node", "index.js"]
