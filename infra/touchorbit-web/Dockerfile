# Build stage — uses the monorepo root so workspace dependencies (@cloudit/ui) resolve.
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm cache clean --force
# Remove stale build info so the UI package emits fresh artifacts.
RUN rm -rf packages/ui/dist packages/ui/tsconfig.tsbuildinfo && npm run build --workspace=@cloudit/ui
# Place the built shared UI package where Next.js can resolve it inside the app workspace.
RUN rm -rf apps/touchorbit-web/node_modules/@cloudit/ui && \
    mkdir -p apps/touchorbit-web/node_modules/@cloudit/ui && \
    cp -r packages/ui/dist packages/ui/package.json packages/ui/src/globals.css \
          packages/ui/tailwind.config.ts packages/ui/postcss.config.mjs \
          apps/touchorbit-web/node_modules/@cloudit/ui/
RUN npm run build --workspace=@cloudit/touchorbit-web

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/touchorbit-web/.next/standalone ./
COPY --from=builder /app/apps/touchorbit-web/public ./apps/touchorbit-web/public
COPY --from=builder /app/apps/touchorbit-web/.next/static ./apps/touchorbit-web/.next/static
EXPOSE 3007
ENV PORT=3007
CMD ["node", "apps/touchorbit-web/server.js"]
