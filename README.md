# Yuehou 阅后即焚

一个可以部署到 Vercel 的无服务器阅后即焚应用。

生成 4 位根路径短链接，例如：

```text
https://your-domain.com/ve22
```

没有 `/s/ve22`，也没有很长的 URL 参数。

## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hmbbser/yuehou&env=KV_REST_API_URL,KV_REST_API_TOKEN,NEXT_PUBLIC_SITE_NAME&envDescription=Create%20a%20Vercel%20KV%20or%20Upstash%20Redis%20database%20and%20paste%20the%20REST%20URL%20and%20token.%20NEXT_PUBLIC_SITE_NAME%20is%20optional%20and%20changes%20the%20global%20site%20name.&project-name=yuehou&repository-name=yuehou)

## 功能

- 4 位短链接，直接是根路径，例如 `/ve22`
- 打开读取一次后立即销毁
- 支持文字和多张照片一起阅后即焚
- 支持可选密码
- 密码输错不会销毁内容
- 支持 5 分钟、自定义分钟、无限期直到读取
- 支持 IP 撞码防护
- 支持明暗模式记忆
- 支持每日一言占位文案
- 适配手机、iPad、电脑
- 支持 Vercel Serverless + Vercel KV / Upstash Redis
- 支持自有服务器 Docker 部署，本机 Redis 内存保存未读数据

## 怎么使用

1. 打开网站。
2. 直接输入要分享的秘密内容，也可以上传多张照片。
3. 选择销毁时间。
4. 重要内容可以设置访问密码。
5. 点击生成链接。
6. 复制生成的短链接发给别人。
7. 对方成功读取后，Redis 里的文字和照片会被删除，之后再打开就看不到了。

## Vercel 部署步骤

### 1. 导入项目

打开 Vercel，选择 `Add New... -> Project`，导入这个仓库：

```text
https://github.com/hmbbser/yuehou
```

也可以直接点击上面的一键部署按钮。

### 2. 创建 Redis 数据库

这个项目需要 Redis 保存阅后即焚内容。推荐二选一：

### 方法 A：在 Vercel 里创建 Vercel KV / Redis

1. 进入你的 Vercel 项目。
2. 打开顶部或侧边栏的 `Storage`。
3. 点击 `Create Database`。
4. 选择 `KV`、`Redis` 或 `Upstash Redis`。
5. 选择离你的用户较近的 Region。
6. 点击创建。
7. 创建完成后，选择 `Connect Project`，把数据库连接到当前项目。
8. Vercel 会自动注入环境变量，通常是：

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

本项目已经兼容这两个变量名。

如果想把页面上的 `阅后即焚` 改成自己的名字，在 Vercel 的环境变量里再添加：

```bash
NEXT_PUBLIC_SITE_NAME=你的站点名字
```

这个变量会修改全站标题、按钮文字、浏览器标题和聊天软件里的链接预览标题；链接预览的说明文字仍会保留。

### 方法 B：在 Upstash 创建 Redis

1. 打开 [Upstash Console](https://console.upstash.com/)。
2. 登录后点击 `Create Database`。
3. 类型选择 Redis。
4. Region 选择离你的 Vercel 项目较近的区域。
5. 创建完成后进入数据库详情页。
6. 找到 `REST API` 区域。
7. 复制：

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

8. 回到 Vercel 项目。
9. 打开 `Settings -> Environment Variables`。
10. 添加上面两个变量。
11. 如果想自定义站点名字，再添加 `NEXT_PUBLIC_SITE_NAME=你的站点名字`。
12. 保存后重新部署项目。

### 3. 重新部署

环境变量添加完成后，在 Vercel 项目里打开 `Deployments`，点击最新部署右侧菜单，选择 `Redeploy`。

部署成功后就可以使用了。

## Debian / Ubuntu 服务器 Docker 部署

下面适合把项目部署到自己的 Debian 或 Ubuntu 服务器，例如一台 VPS。  
这套方式不需要 Upstash Redis REST Token，Redis 直接跑在服务器本机 Docker 里。

### 1. 安装 Docker

如果服务器还没有 Docker，可以先安装：

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx

sudo install -m 0755 -d /etc/apt/keyrings
. /etc/os-release
curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} \
  ${VERSION_CODENAME} stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

检查 Docker 是否正常：

```bash
sudo docker version
sudo docker compose version
```

### 2. 下载项目

```bash
cd /opt
sudo git clone https://github.com/hmbbser/yuehou.git
sudo chown -R $USER:$USER /opt/yuehou
cd /opt/yuehou
```

如果你是自己 fork 的仓库，把地址换成自己的 GitHub 仓库地址。

### 3. 启动应用和 Redis

项目已经带有 `Dockerfile` 和 `docker-compose.yml`。默认会启动两个容器：

- `yuehou`：Next.js 应用，监听本机 `127.0.0.1:3000`
- `yuehou-redis`：Redis 7，默认关闭 AOF/RDB，未读内容只保存在 Redis 内存里

运行交互部署脚本：

```bash
chmod +x scripts/deploy-docker.sh
./scripts/deploy-docker.sh
```

脚本会先提示你输入网站名字。直接回车会使用默认的 `阅后即焚`，输入自定义名字后，全站标题、按钮文字和链接预览标题都会随之改变。

查看状态和日志：

```bash
sudo docker compose ps
sudo docker compose logs -f yuehou
```

默认配置里，应用通过下面这个变量连接 Docker 内部的 Redis：

```yaml
REDIS_URL: redis://redis:6379
```

Docker 默认配置会关闭 Redis 的 AOF 和 RDB 落盘，避免读过或未读的文字、照片被额外写进服务器磁盘。取舍是：如果 Redis 容器重启、服务器重启，尚未读取的阅后即焚内容会丢失。

如果你之前部署过旧版本，并且服务器上存在旧的 `yuehou-redis-data` volume，里面可能还留有旧版 Redis 持久化文件。确认不需要旧数据后可以删除：

```bash
sudo docker volume ls | grep yuehou-redis-data
for v in $(sudo docker volume ls -q | grep 'yuehou-redis-data$'); do sudo docker volume rm "$v"; done
```

本机测试：

```bash
curl -I http://127.0.0.1:3000
```

### 4. 配置 Nginx 反向代理

假设你的域名是 `example.com`，创建 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/yuehou
```

写入：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/yuehou /etc/nginx/sites-enabled/yuehou
sudo nginx -t
sudo systemctl reload nginx
```

现在可以先通过：

```text
http://example.com
```

访问应用。

### 5. 配置 HTTPS

推荐用 Certbot 自动申请证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

完成后打开：

```text
https://example.com
```

### 6. 更新部署

以后更新代码：

```bash
cd /opt/yuehou
sudo git pull
./scripts/deploy-docker.sh
```

### 7. 常用维护命令

查看日志：

```bash
sudo docker compose logs -f
```

重启应用：

```bash
sudo docker compose restart yuehou
```

停止服务，Redis 内存里的未读内容也会随之清空：

```bash
sudo docker compose down
```

如果你是从旧版升级，并且还想顺手删除旧版 Redis volume：

```bash
sudo docker volume ls | grep yuehou-redis-data
for v in $(sudo docker volume ls -q | grep 'yuehou-redis-data$'); do sudo docker volume rm "$v"; done
```

## 安全说明

- 4 位短链接优先体验，不等于高强度随机密钥。
- 重要内容建议设置访问密码。
- 密码保护内容会在浏览器端加密。
- 服务端不保存原始密码，只保存密文和校验摘要。
- 读取接口使用 Redis 原子脚本完成校验、读取和删除。
- 成功读取时，Redis key 会先删除，再把内容返回给浏览器。
- API 响应使用 `Cache-Control: no-store`，避免 Vercel、CDN、浏览器缓存秘密内容。

## 仓库

[Yuehou on GitHub](https://github.com/hmbbser/yuehou)
