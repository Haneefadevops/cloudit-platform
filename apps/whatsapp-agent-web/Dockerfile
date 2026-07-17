FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.js ./
COPY next-env.d.ts ./
COPY src ./src

# These must be available at build time so Next.js can inline them for rewrites
ARG API_URL=https://api.thereplyte.com/api
ARG NEXT_PUBLIC_API_URL=https://api.thereplyte.com/api
ENV API_URL=${API_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm install && npm cache clean --force
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# curl is used by the Docker healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3011

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3011

CMD ["npm", "start"]
