FROM node:20-bookworm-slim

WORKDIR /app

# Install workspace dependencies
COPY package*.json ./
COPY app/frontend-modern/package*.json app/frontend-modern/
COPY backend/package*.json backend/
COPY config/package*.json config/
RUN npm ci
RUN npm ci --prefix backend

# Copy source after dependencies
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Run backend API directly in container
CMD ["node", "backend/server.js"]
