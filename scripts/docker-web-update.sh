#!/usr/bin/env sh
set -eu

sleep "${YUEHOU_UPDATE_DELAY_SECONDS:-2}"

workdir="${YUEHOU_UPDATE_WORKDIR:-}"
force="${YUEHOU_UPDATE_FORCE:-false}"

if [ -z "$workdir" ]; then
  echo "YUEHOU_UPDATE_WORKDIR is not set." >&2
  exit 1
fi

cd "$workdir"

if [ ! -d ".git" ]; then
  echo "Update workdir is not a git repository: $workdir" >&2
  exit 1
fi

git config --global --add safe.directory "$workdir"

current_version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n 1)"
git fetch origin main
latest_version="$(git show origin/main:package.json | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"

if [ -z "$latest_version" ]; then
  echo "Unable to read latest version from origin/main." >&2
  exit 1
fi

if [ "$force" != "true" ] && [ "$current_version" = "$latest_version" ]; then
  echo "Already up to date: $current_version"
  exit 0
fi

git pull --ff-only origin main

if [ -f ".env.docker" ]; then
  tmp_file=".env.docker.tmp"

  if grep -q "^NEXT_PUBLIC_APP_VERSION=" .env.docker; then
    sed "s|^NEXT_PUBLIC_APP_VERSION=.*|NEXT_PUBLIC_APP_VERSION=$latest_version|" .env.docker > "$tmp_file"
    mv "$tmp_file" .env.docker
  else
    printf "\nNEXT_PUBLIC_APP_VERSION=%s\n" "$latest_version" >> .env.docker
  fi
fi

if [ -f ".env.docker" ]; then
  docker compose --env-file .env.docker up -d --build
else
  docker compose up -d --build
fi
