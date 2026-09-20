FROM node:20-alpine AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/operations-agent/package.json apps/operations-agent/package.json
COPY packages/operations-agent-contracts/package.json packages/operations-agent-contracts/package.json
# npm ci hoists every dependency into the root node_modules; the workspace
# dir only appears when something is nested. Create it so the later COPYs
# have a stable source whether or not nesting occurs.
RUN npm ci --workspace=@cloudit/operations-agent --include-workspace-root=false \
  && mkdir -p apps/operations-agent/node_modules

FROM node:20-alpine AS builder
WORKDIR /workspace
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY --from=dependencies /workspace/apps/operations-agent/node_modules ./apps/operations-agent/node_modules
COPY package.json package-lock.json ./
COPY packages/operations-agent-contracts ./packages/operations-agent-contracts
COPY apps/operations-agent ./apps/operations-agent
RUN npm run build --workspace=@cloudit/operations-agent-contracts
RUN npm run build --workspace=@cloudit/operations-agent

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
COPY --from=builder --chown=nodejs:nodejs /workspace/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /workspace/apps/operations-agent/node_modules ./apps/operations-agent/node_modules
COPY --from=builder --chown=nodejs:nodejs /workspace/apps/operations-agent/dist ./apps/operations-agent/dist
COPY --from=builder --chown=nodejs:nodejs /workspace/packages/operations-agent-contracts/package.json ./packages/operations-agent-contracts/package.json
COPY --from=builder --chown=nodejs:nodejs /workspace/packages/operations-agent-contracts/dist ./packages/operations-agent-contracts/dist
USER nodejs
# Headless service: no port is exposed. The agent is a NestJS application
# context (watchdog); secrets come only from the runtime environment.
CMD ["node", "apps/operations-agent/dist/main.js"]
