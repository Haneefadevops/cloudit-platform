# Build stage — uses the monorepo root so workspace dependencies (@cloudit/ui) resolve.
FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL=http://localhost:3009
ARG NEXT_PUBLIC_API_URL=http://localhost:3006/api
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
COPY . .
RUN npm install && npm cache clean --force
# Remove stale build info so the UI package emits fresh artifacts.
RUN rm -rf packages/ui/dist packages/ui/tsconfig.tsbuildinfo && npm run build --workspace=@cloudit/ui
# Place the built shared UI package where Next.js can resolve it inside the app workspace.
RUN rm -rf apps/touchorbit-employee-web/node_modules/@cloudit/ui && \
    mkdir -p apps/touchorbit-employee-web/node_modules/@cloudit/ui && \
    cp -r packages/ui/dist packages/ui/package.json packages/ui/src/globals.css \
          packages/ui/tailwind.config.ts packages/ui/postcss.config.mjs \
          apps/touchorbit-employee-web/node_modules/@cloudit/ui/
RUN npm run build --workspace=@cloudit/touchorbit-employee-web

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_APP_URL=http://localhost:3009
ARG NEXT_PUBLIC_API_URL=http://localhost:3006/api
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN apk add --no-cache curl
COPY --from=builder /app/apps/touchorbit-employee-web/.next/standalone ./
COPY --from=builder /app/apps/touchorbit-employee-web/public ./public
EXPOSE 3009
ENV PORT=3009
CMD ["node", "server.js"]
