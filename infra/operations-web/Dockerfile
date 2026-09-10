FROM node:20-alpine AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/operations-web/package.json apps/operations-web/package.json
RUN npm ci --workspace=@cloudit/operations-web --include-workspace-root=false

FROM node:20-alpine AS builder
WORKDIR /workspace
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY --from=dependencies /workspace/apps/operations-web/node_modules ./apps/operations-web/node_modules
COPY apps/operations-web ./apps/operations-web
COPY package.json package-lock.json ./
RUN npm run build --workspace=@cloudit/operations-web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3016
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache curl && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/operations-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/operations-web/.next/static ./apps/operations-web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/operations-web/public ./apps/operations-web/public
# The standalone trace can include a build-time .env; secrets must come only
# from the runtime environment, never from the image.
RUN rm -f ./apps/operations-web/.env ./.env
USER nextjs
EXPOSE 3016
CMD ["node", "apps/operations-web/server.js"]
