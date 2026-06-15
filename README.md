# Yuehou 阅后即焚

一个可以部署到 Vercel 的无服务器阅后即焚应用。

生成 4 位根路径短链接，例如：

```text
https://your-domain.com/ve22
```

没有 `/s/ve22`，也没有很长的 URL 参数。

## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hmbbser/yuehou&env=UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN&envDescription=Create%20a%20Vercel%20KV%20or%20Upstash%20Redis%20database%20and%20paste%20the%20REST%20URL%20and%20token.&project-name=yuehou&repository-name=yuehou)

## 功能

- 4 位短链接，直接是根路径，例如 `/ve22`
- 打开读取一次后立即销毁
- 支持可选密码
- 密码输错不会销毁内容
- 支持 5 分钟、自定义分钟、无限期直到读取
- 支持 IP 撞码防护
- 支持明暗模式记忆
- 支持每日一言占位文案
- 适配手机、iPad、电脑
- 使用 Vercel Serverless API + Vercel KV / Upstash Redis

## 怎么使用

1. 打开网站。
2. 直接输入要分享的秘密内容。
3. 选择销毁时间。
4. 重要内容可以设置访问密码。
5. 点击生成链接。
6. 复制生成的短链接发给别人。
7. 对方成功读取后，Redis 里的内容会被删除，之后再打开就看不到了。

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
11. 保存后重新部署项目。

### 3. 重新部署

环境变量添加完成后，在 Vercel 项目里打开 `Deployments`，点击最新部署右侧菜单，选择 `Redeploy`。

部署成功后就可以使用了。

## 本地开发

安装依赖：

```bash
pnpm install
```

创建 `.env.local`：

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

启动开发服务：

```bash
pnpm dev
```

打开：

```text
http://localhost:3000
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
