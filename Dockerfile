# ReadySetWeb API — Render deployment (heavy work: builds + 15s hero videos)
# Runs on a permanent web service with ffmpeg for video rendering.
FROM node:20-bookworm-slim

# ffmpeg is required to render each site's unique 15s hero video
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Install deps (full monorepo — the API builds sites with the site-generator)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=3000
# Give Node headroom for Astro builds + ffmpeg
ENV NODE_OPTIONS=--max-old-space-size=768

EXPOSE 3000

WORKDIR /app/apps/generator-api
CMD ["node", "--import", "tsx", "src/index.ts"]
