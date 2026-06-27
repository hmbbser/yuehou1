#!/usr/bin/env sh
set -eu

default_site_name="阅后即焚"
existing_site_name=""
existing_update_token=""

if [ -f ".env.docker" ]; then
  existing_site_name="$(sed -n 's/^NEXT_PUBLIC_SITE_NAME=//p' .env.docker | head -n 1)"
  existing_update_token="$(sed -n 's/^YUEHOU_UPDATE_TOKEN=//p' .env.docker | head -n 1)"
fi

if [ -n "$existing_site_name" ]; then
  default_site_name="$existing_site_name"
fi

printf "请输入网站名字 [%s]: " "$default_site_name"
IFS= read -r site_name

if [ -z "$site_name" ]; then
  site_name="$default_site_name"
fi

app_version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n 1)"
host_project_dir="$(pwd -P)"
update_token="$existing_update_token"

if [ -z "$update_token" ]; then
  update_token="$(dd if=/dev/urandom bs=32 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n')"
fi

cat > .env.docker <<EOF
NEXT_PUBLIC_SITE_NAME=$site_name
NEXT_PUBLIC_APP_VERSION=$app_version
YUEHOU_DOCKER_UPDATE_ENABLED=true
YUEHOU_HOST_PROJECT_DIR=$host_project_dir
YUEHOU_UPDATE_TOKEN=$update_token
YUEHOU_UPDATE_VERSION_URL=https://raw.githubusercontent.com/hmbbser/yuehou1/main/package.json
EOF

echo "网站名字：$site_name"
echo "当前版本：$app_version"
echo "Docker 更新密钥：$update_token"
echo "请保存这个密钥，网页右上角设置里的 Docker 更新需要它。"
echo "正在构建并启动 Docker 服务..."

sudo docker compose --env-file .env.docker up -d --build
