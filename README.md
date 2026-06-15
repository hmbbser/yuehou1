# Yuehou

Yuehou is a Vercel-ready, serverless "burn after reading" app.

It creates 4-character root-path links such as:

```text
https://your-domain.com/ve22
```

No `/s/ve22`, no long URL parameter.

## One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hmbbser/yuehou&env=UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN&envDescription=Create%20a%20Vercel%20KV%20or%20Upstash%20Redis%20database%20and%20paste%20the%20REST%20URL%20and%20token.&project-name=yuehou&repository-name=yuehou)

## Features

- 4-character short links at the root path, for example `/ve22`
- Read once, then delete immediately
- Optional password protection
- Wrong password does not destroy the secret
- Expiration options: 5 minutes, custom minutes, or unlimited until read
- IP anti-enumeration protection for rapid failed requests
- Light/dark theme with local memory
- Daily quote placeholder with author/source
- Mobile, iPad, and desktop responsive UI
- Vercel Serverless API + Vercel KV / Upstash Redis

## How To Use

1. Open the app.
2. Type the secret directly. The text box is focused automatically.
3. Choose an expiration time:
   - `5 minutes`
   - `Custom`
   - `Unlimited`
4. Optionally set a password for important content.
5. Click `Generate`.
6. Copy the generated link and send it to someone.
7. After the secret is read successfully, it is deleted from Redis.

## Deploy On Vercel

1. Click the deploy button above, or import this repository in Vercel:

```text
https://github.com/hmbbser/yuehou
```

2. Create or connect a Vercel KV / Upstash Redis database.
3. Set these environment variables in Vercel:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The app also supports Vercel KV variable names:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

4. Redeploy the project.

## Local Development

Install dependencies:

```bash
pnpm install
```

Create `.env.local`:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Start the dev server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Security Notes

- A 4-character URL is optimized for convenience, not maximum entropy.
- For important content, use a password.
- Password-protected content is encrypted in the browser.
- The server stores encrypted payloads and verification hashes, not the raw password.
- The consume API uses an atomic Redis script to verify, read, and delete.
- Successful reads delete the Redis key before the response is returned.
- API responses use `Cache-Control: no-store` to avoid CDN/browser caching.

## Repository

[Yuehou on GitHub](https://github.com/hmbbser/yuehou)
