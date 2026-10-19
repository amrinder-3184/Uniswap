# UniSwap API image.
# Stage 1 installs production dependencies; stage 2 copies only what the app
# needs at runtime and runs it as the unprivileged "node" user.

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Exact versions from the lockfile, without devDependencies (jest, eslint, ...)
RUN npm ci --omit=dev && npm cache clean --force


FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json index.js db.js ./
COPY src ./src

# Upload folder owned by the runtime user. When Compose mounts a new named
# volume here, Docker copies this ownership into the volume.
RUN mkdir -p uploads/listings && chown -R node:node uploads

USER node

# The port index.js listens on (PORT, default 3000)
EXPOSE 3000

# Uses Node's built-in fetch, so no extra tools (curl/wget) are needed in the image
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Run node directly (not via npm) so SIGTERM reaches the app's graceful shutdown handler
CMD ["node", "index.js"]
