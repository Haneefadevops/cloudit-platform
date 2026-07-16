# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies required by Prisma on Alpine
RUN apk add --no-cache openssl libc6-compat curl

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm install && npm cache clean --force
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Runtime deps for Prisma and healthchecks
RUN apk add --no-cache openssl libc6-compat curl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

EXPOSE 3010

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main"]
