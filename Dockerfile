# ---------- Build stage ----------
FROM node:24-slim AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy the whole workspace (source only — .dockerignore trims the rest)
COPY . .

# Install deps for the web app + API server and everything they depend on
RUN pnpm install --no-frozen-lockfile \
    --filter "@workspace/api-server..." \
    --filter "@workspace/meaningbridge..."

# Build shared lib packages (tsc project references)
RUN pnpm exec tsc --build

# Build the web app (static bundle)
RUN BASE_PATH=/ PORT=8080 pnpm --filter "@workspace/meaningbridge" run build

# Build the API server (esbuild bundle -> dist/index.mjs)
RUN pnpm --filter "@workspace/api-server" run build

# The API server serves the web app from dist/public
RUN cp -r artifacts/meaningbridge/dist/public artifacts/api-server/dist/public

# ---------- Runtime stage ----------
FROM node:24-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Packages the server bundle loads at runtime (externalized by esbuild)
RUN npm install --omit=dev --no-audit --no-fund nodemailer@8.0.7 @google-cloud/storage@7.19.0

COPY --from=build /app/artifacts/api-server/dist ./dist

EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
