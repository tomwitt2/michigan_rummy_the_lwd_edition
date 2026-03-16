# Stage 1: Build the frontend
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend and server
COPY --from=build /app/dist ./dist
COPY server/ ./server/
COPY src/game/ ./src/game/

ENV NODE_ENV=production
ENV PORT=8001

EXPOSE 8001

CMD ["node", "server/index.js"]
