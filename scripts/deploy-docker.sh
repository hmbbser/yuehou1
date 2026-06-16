#!/usr/bin/env sh
set -eu

default_site_name="阅后即焚"

printf "请输入网站名字 [%s]: " "$default_site_name"
IFS= read -r site_name

if [ -z "$site_name" ]; then
  site_name="$default_site_name"
fi

cat > .env.docker <<EOF
NEXT_PUBLIC_SITE_NAME=$site_name
EOF

echo "网站名字：$site_name"
echo "正在构建并启动 Docker 服务..."

sudo docker compose --env-file .env.docker up -d --build
