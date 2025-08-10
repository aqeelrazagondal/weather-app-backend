# Dockerfile
# syntax=docker/dockerfile:1.7
# ---- Base build image ----
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
RUN corepack enable

# ---- Dependencies cache ----
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ---- Build ----
FROM deps AS build
WORKDIR /app
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN yarn build

# ---- Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
# Non-root user for security
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
USER nodeuser
EXPOSE 3000
CMD ["node", "dist/main.js"]
