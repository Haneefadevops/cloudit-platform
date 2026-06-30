# Build stage — uses the monorepo root so workspace dependencies (@cloudit/ui) resolve.
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm cache clean --force
# Remove stale build info so the UI package emits fresh artifacts.
RUN rm -rf packages/ui/dist packages/ui/tsconfig.tsbuildinfo && npm run build --workspace=@cloudit/ui
# Place the built shared UI package where Next.js can resolve it inside the app workspace.
RUN rm -rf apps/touchorbit-admin-web/node_modules/@cloudit/ui && \
    mkdir -p apps/touchorbit-admin-web/node_modules/@cloudit/ui && \
    cp -r packages/ui/dist packages/ui/package.json packages/ui/src/globals.css \
          packages/ui/tailwind.config.ts packages/ui/postcss.config.mjs \
          apps/touchorbit-admin-web/node_modules/@cloudit/ui/
RUN npm run build --workspace=@cloudit/touchorbit-admin-web

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/touchorbit-admin-web/.next/standalone ./
COPY --from=builder /app/apps/touchorbit-admin-web/public ./public
EXPOSE 3008
ENV PORT=3008
CMD ["node", "server.js"]
