# Build stage — uses the monorepo root so workspace dependencies (@cloudit/ui) resolve.
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm cache clean --force
# Remove stale build info so the UI package emits fresh artifacts.
RUN rm -rf packages/ui/dist packages/ui/tsconfig.tsbuildinfo && npm run build --workspace=@cloudit/ui
# Place the built shared UI package where Next.js can resolve it inside the app workspace.
RUN rm -rf apps/hospitality-web/node_modules/@cloudit/ui && \
    mkdir -p apps/hospitality-web/node_modules/@cloudit/ui && \
    cp -r packages/ui/dist packages/ui/package.json packages/ui/src/globals.css \
          packages/ui/tailwind.config.ts packages/ui/postcss.config.mjs \
          apps/hospitality-web/node_modules/@cloudit/ui/
RUN npm run build --workspace=@cloudit/hospitality-web

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/hospitality-web/.next/standalone ./
COPY --from=builder /app/apps/hospitality-web/public ./public
EXPOSE 3003
ENV PORT=3003
CMD ["node", "server.js"]
