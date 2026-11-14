# Production image of the app, the one `npm run docker` starts. The Node
# version matches .nvmrc and `engines`; the exact tag and `npm ci` against
# package-lock.json make the build the same on every machine.
# NEXT_STANDALONE builds with `output: "standalone"` (next.config.ts): the
# runtime stage holds only the files `next build` traced, without node_modules.

FROM node:24.11.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_STANDALONE=1
RUN npm run build

FROM node:24.11.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
