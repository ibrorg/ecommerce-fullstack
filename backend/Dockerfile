# ---- builder stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# install deps with cache
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# copy source and build
COPY backend/ ./backend/
RUN cd backend && npx tsc --noEmit && npm run build

# ---- runtime stage ----
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# copy built output and production deps
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json

# non-root user (distroless already provides nonroot)
USER nonroot

EXPOSE 5000

# tini handles signals correctly
ENTRYPOINT ["node", "dist/server.js"]
