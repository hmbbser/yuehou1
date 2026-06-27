FROM node:20-alpine AS app

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable
RUN apk add --no-cache docker-cli docker-cli-compose git

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_SITE_NAME=阅后即焚
ARG NEXT_PUBLIC_APP_VERSION=1.0.1
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
