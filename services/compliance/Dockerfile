# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: run (prod deps only)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["node", "dist/index.js"]
