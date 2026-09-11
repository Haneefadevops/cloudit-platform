FROM node:20-alpine AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/operations-ingest/package.json apps/operations-ingest/package.json
RUN npm ci --workspace=@cloudit/operations-ingest --include-workspace-root=false

FROM node:20-alpine AS builder
WORKDIR /workspace
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY --from=dependencies /workspace/apps/operations-ingest/node_modules ./apps/operations-ingest/node_modules
COPY apps/operations-ingest ./apps/operations-ingest
COPY package.json package-lock.json ./
RUN npm run build --workspace=@cloudit/operations-ingest

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3020
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache curl && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
COPY --from=builder --chown=nodejs:nodejs /workspace/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /workspace/apps/operations-ingest/node_modules ./apps/operations-ingest/node_modules
COPY --from=builder --chown=nodejs:nodejs /workspace/apps/operations-ingest/dist ./dist
USER nodejs
EXPOSE 3020
# Secrets come only from the runtime environment (protected server env files);
# none are present in the image.
CMD ["node", "dist/server.js"]
